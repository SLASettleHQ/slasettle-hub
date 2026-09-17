import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CheckpointRow {
  last_ledger: number;
  last_cursor: string | null;
}

export interface WatcherRow {
  address: string;
  registered_at: string;
  removed_at: string | null;
}

export interface CheckRow {
  event_id: string;
  sla_id: string;
  round_id: string;
  watcher: string;
  status: "up" | "down";
  checked_at: string;
}

export interface SlaRow {
  sla_id: string;
  provider: string;
  token: string;
  bond_amount_at_creation: string;
  quorum_threshold: number | null;
  beneficiary: string;
  created_at: string;
  tx_hash: string;
}

export interface SettlementRow {
  event_id: string;
  sla_id: string;
  round_id: string;
  quorum_threshold: number | null;
  penalty_amount: string;
  beneficiary: string;
  tx_hash: string;
  ledger_close_time: string;
}

export class IndexerDb {
  readonly raw: Database.Database;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.raw = new Database(dbPath);
    this.raw.pragma("journal_mode = WAL");
    const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
    this.raw.exec(schema);
  }

  getCheckpoint(): CheckpointRow | undefined {
    return this.raw.prepare("SELECT last_ledger, last_cursor FROM checkpoint WHERE id = 1").get() as
      | CheckpointRow
      | undefined;
  }

  /**
   * Writes the checkpoint and a batch of decoded events in a single
   * transaction. This is what makes ingestion crash-consistent — if the
   * process dies mid-cycle, either the whole batch and the new checkpoint
   * landed, or none of it did. There is no in-between state where events
   * are stored but the checkpoint wasn't advanced, which would cause
   * double-processing on restart.
   */
  applyBatch(params: {
    lastLedger: number;
    lastCursor: string | null;
    watcherRegistrations: Array<{ address: string; registeredAt: string }>;
    watcherRemovals: Array<{ address: string; removedAt: string }>;
    checks: CheckRow[];
    slas: SlaRow[];
    settlements: SettlementRow[];
  }): void {
    const tx = this.raw.transaction(() => {
      this.raw
        .prepare(
          `INSERT INTO checkpoint (id, last_ledger, last_cursor) VALUES (1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET last_ledger = excluded.last_ledger, last_cursor = excluded.last_cursor`,
        )
        .run(params.lastLedger, params.lastCursor);

      const insertWatcher = this.raw.prepare(
        `INSERT INTO watchers (address, registered_at, removed_at) VALUES (?, ?, NULL)
         ON CONFLICT(address) DO UPDATE SET removed_at = NULL`,
      );
      for (const w of params.watcherRegistrations) insertWatcher.run(w.address, w.registeredAt);

      const removeWatcher = this.raw.prepare("UPDATE watchers SET removed_at = ? WHERE address = ?");
      for (const w of params.watcherRemovals) removeWatcher.run(w.removedAt, w.address);

      const insertCheck = this.raw.prepare(
        `INSERT OR IGNORE INTO checks (event_id, sla_id, round_id, watcher, status, checked_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const c of params.checks) {
        insertCheck.run(c.event_id, c.sla_id, c.round_id, c.watcher, c.status, c.checked_at);
      }

      const insertSla = this.raw.prepare(
        `INSERT OR IGNORE INTO slas (sla_id, provider, token, bond_amount_at_creation, quorum_threshold, beneficiary, created_at, tx_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const s of params.slas) {
        insertSla.run(
          s.sla_id,
          s.provider,
          s.token,
          s.bond_amount_at_creation,
          s.quorum_threshold,
          s.beneficiary,
          s.created_at,
          s.tx_hash,
        );
      }

      const insertSettlement = this.raw.prepare(
        `INSERT OR IGNORE INTO settlements (event_id, sla_id, round_id, quorum_threshold, penalty_amount, beneficiary, tx_hash, ledger_close_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const s of params.settlements) {
        insertSettlement.run(
          s.event_id,
          s.sla_id,
          s.round_id,
          s.quorum_threshold,
          s.penalty_amount,
          s.beneficiary,
          s.tx_hash,
          s.ledger_close_time,
        );
      }
    });

    tx();
  }

  getSlaQuorumThreshold(slaId: string): number | null {
    const row = this.raw.prepare("SELECT quorum_threshold FROM slas WHERE sla_id = ?").get(slaId) as
      | { quorum_threshold: number | null }
      | undefined;
    return row?.quorum_threshold ?? null;
  }

  /**
   * Caches a quorum_threshold once it's been fetched live, in both tables
   * that need it — it never changes after an SLA is created, so this only
   * ever needs to happen once per sla_id, the first time any API response
   * asks for it.
   */
  setSlaQuorumThreshold(slaId: string, quorumThreshold: number): void {
    const tx = this.raw.transaction(() => {
      this.raw.prepare("UPDATE slas SET quorum_threshold = ? WHERE sla_id = ?").run(quorumThreshold, slaId);
      this.raw
        .prepare("UPDATE settlements SET quorum_threshold = ? WHERE sla_id = ? AND quorum_threshold IS NULL")
        .run(quorumThreshold, slaId);
    });
    tx();
  }

  close(): void {
    this.raw.close();
  }
}
