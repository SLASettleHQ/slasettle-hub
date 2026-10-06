import type {
  CheckpointRow,
  WatcherEvent,
  CheckRow,
  SlaRow,
  SettlementRow,
} from "./db.js";

export interface SettlementDbRow {
  event_id: string;
  sla_id: string;
  round_id: string;
  quorum_threshold: number | null;
  penalty_amount: string;
  beneficiary: string;
  tx_hash: string;
  ledger_close_time: string;
}

export class IndexerD1 {
  constructor(private readonly db: D1Database) {}

  async getCheckpoint(): Promise<CheckpointRow | undefined> {
    const row = await this.db
      .prepare("SELECT last_ledger, last_cursor FROM checkpoint WHERE id = 1")
      .first<CheckpointRow>();
    return row ?? undefined;
  }

  async applyBatch(params: {
    lastLedger: number;
    lastCursor: string | null;
    watcherEvents: WatcherEvent[];
    checks: CheckRow[];
    slas: SlaRow[];
    settlements: SettlementRow[];
  }): Promise<void> {
    const stmts: D1PreparedStatement[] = [];

    stmts.push(
      this.db
        .prepare(
          `INSERT INTO checkpoint (id, last_ledger, last_cursor) VALUES (1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET last_ledger = excluded.last_ledger, last_cursor = excluded.last_cursor`,
        )
        .bind(params.lastLedger, params.lastCursor),
    );

    const insertWatcher = this.db.prepare(
      `INSERT INTO watchers (address, registered_at, removed_at) VALUES (?, ?, NULL)
       ON CONFLICT(address) DO UPDATE SET removed_at = NULL`,
    );
    const removeWatcher = this.db.prepare("UPDATE watchers SET removed_at = ? WHERE address = ?");

    for (const w of params.watcherEvents) {
      if (w.type === "registered") {
        stmts.push(insertWatcher.bind(w.address, w.at));
      } else {
        stmts.push(removeWatcher.bind(w.at, w.address));
      }
    }

    const insertCheck = this.db.prepare(
      `INSERT OR IGNORE INTO checks (event_id, sla_id, round_id, watcher, status, checked_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const c of params.checks) {
      stmts.push(insertCheck.bind(c.event_id, c.sla_id, c.round_id, c.watcher, c.status, c.checked_at));
    }

    const insertSla = this.db.prepare(
      `INSERT OR IGNORE INTO slas (sla_id, provider, token, bond_amount_at_creation, quorum_threshold, beneficiary, created_at, tx_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const s of params.slas) {
      stmts.push(
        insertSla.bind(
          s.sla_id,
          s.provider,
          s.token,
          s.bond_amount_at_creation,
          s.quorum_threshold,
          s.beneficiary,
          s.created_at,
          s.tx_hash,
        ),
      );
    }

    const insertSettlement = this.db.prepare(
      `INSERT OR IGNORE INTO settlements (event_id, sla_id, round_id, quorum_threshold, penalty_amount, beneficiary, tx_hash, ledger_close_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const s of params.settlements) {
      stmts.push(
        insertSettlement.bind(
          s.event_id,
          s.sla_id,
          s.round_id,
          s.quorum_threshold,
          s.penalty_amount,
          s.beneficiary,
          s.tx_hash,
          s.ledger_close_time,
        ),
      );
    }

    await this.db.batch(stmts);
  }

  async getEligibleWatchers(): Promise<Array<{ address: string; registered_at: string }>> {
    const res = await this.db
      .prepare("SELECT address, registered_at FROM watchers WHERE removed_at IS NULL ORDER BY registered_at")
      .all<{ address: string; registered_at: string }>();
    return res.results;
  }

  async getCheckedInForRound(
    slaId: string,
    roundId: string,
  ): Promise<Array<{ watcher: string; status: string; checked_at: string }>> {
    const res = await this.db
      .prepare("SELECT watcher, status, checked_at FROM checks WHERE sla_id = ? AND round_id = ?")
      .bind(slaId, roundId)
      .all<{ watcher: string; status: string; checked_at: string }>();
    return res.results;
  }

  async getSettlementsPage(
    slaId: string,
    limit: number,
    before?: { ledgerCloseTime: string; eventId: string },
  ): Promise<{ rows: SettlementDbRow[]; hasMore: boolean }> {
    let res: D1Result<SettlementDbRow>;
    if (before) {
      res = await this.db
        .prepare(
          `SELECT * FROM settlements WHERE sla_id = ? AND (ledger_close_time, event_id) < (?, ?)
           ORDER BY ledger_close_time DESC, event_id DESC LIMIT ?`,
        )
        .bind(slaId, before.ledgerCloseTime, before.eventId, limit + 1)
        .all<SettlementDbRow>();
    } else {
      res = await this.db
        .prepare(
          `SELECT * FROM settlements WHERE sla_id = ? ORDER BY ledger_close_time DESC, event_id DESC LIMIT ?`,
        )
        .bind(slaId, limit + 1)
        .all<SettlementDbRow>();
    }

    const rows = res.results;
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return { rows: page, hasMore };
  }

  async getVoteCounts(slaId: string, roundId: string): Promise<{ votes_up: number; votes_down: number }> {
    const row = await this.db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as votes_up,
           SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as votes_down
         FROM checks WHERE sla_id = ? AND round_id = ?`,
      )
      .bind(slaId, roundId)
      .first<{ votes_up: number | null; votes_down: number | null }>();

    return {
      votes_up: row?.votes_up ?? 0,
      votes_down: row?.votes_down ?? 0,
    };
  }

  async getSlaQuorumThreshold(slaId: string): Promise<number | null> {
    const row = await this.db
      .prepare("SELECT quorum_threshold FROM slas WHERE sla_id = ?")
      .bind(slaId)
      .first<{ quorum_threshold: number | null }>();
    return row?.quorum_threshold ?? null;
  }

  async setSlaQuorumThreshold(slaId: string, threshold: number): Promise<void> {
    await this.db.batch([
      this.db.prepare("UPDATE slas SET quorum_threshold = ? WHERE sla_id = ?").bind(threshold, slaId),
      this.db
        .prepare("UPDATE settlements SET quorum_threshold = ? WHERE sla_id = ? AND quorum_threshold IS NULL")
        .bind(threshold, slaId),
    ]);
  }

  async getProviderSlas(address: string): Promise<
    Array<{
      sla_id: string;
      token: string;
      bond_amount_at_creation: string;
      beneficiary: string;
      created_at: string;
      tx_hash: string;
    }>
  > {
    const res = await this.db
      .prepare(
        "SELECT sla_id, token, bond_amount_at_creation, beneficiary, created_at, tx_hash FROM slas WHERE provider = ? ORDER BY created_at DESC",
      )
      .bind(address)
      .all<{
        sla_id: string;
        token: string;
        bond_amount_at_creation: string;
        beneficiary: string;
        created_at: string;
        tx_hash: string;
      }>();
    return res.results;
  }
}
