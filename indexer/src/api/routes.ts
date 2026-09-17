import { Router } from "express";
import type { IndexerDb } from "../db/db.js";
import { fetchQuorumThreshold } from "../rpc/liveReads.js";
import { getLatestLedgerInfo } from "./ledgerInfo.js";
import { encodeCursor, decodeCursor } from "./pagination.js";
import type { Config } from "../config.js";
import type { rpc } from "@stellar/stellar-sdk";

export interface RouteDeps {
  db: IndexerDb;
  server: rpc.Server;
  config: Config;
}

/**
 * Every endpoint here matches SLASettle-indexer-api-spec.md exactly — same
 * paths, same response envelope, same field names. If this ever drifts
 * from that document, the document is what the frontend was told to build
 * against, so fix the code, not the doc, unless the doc itself is being
 * deliberately revised.
 */
export function buildRouter(deps: RouteDeps): Router {
  const router = Router();

  router.get("/v1/health", (_req, res) => {
    const cp = deps.db.getCheckpoint();
    res.json({ status: "ok", last_indexed_ledger: cp?.last_ledger ?? null });
  });

  // GET /v1/watchers
  router.get("/v1/watchers", (_req, res) => {
    const rows = deps.db.raw
      .prepare("SELECT address, registered_at FROM watchers WHERE removed_at IS NULL ORDER BY registered_at")
      .all() as Array<{ address: string; registered_at: string }>;

    res.json({
      data: rows.map((r) => ({ address: r.address, registered_at: r.registered_at })),
      next_cursor: null,
    });
  });

  // GET /v1/slas/:slaId/current-round
  router.get("/v1/slas/:slaId/current-round", async (req, res) => {
    const slaId = req.params.slaId as string;
    const ledger = await getLatestLedgerInfo(deps.server);
    const roundId = Math.floor(ledger.closeTimeMs / 1000 / deps.config.ROUND_LENGTH_SECONDS);

    const watchers = deps.db.raw
      .prepare("SELECT address FROM watchers WHERE removed_at IS NULL")
      .all() as Array<{ address: string }>;

    const checkedIn = deps.db.raw
      .prepare("SELECT watcher, status, checked_at FROM checks WHERE sla_id = ? AND round_id = ?")
      .all(slaId, String(roundId)) as Array<{ watcher: string; status: string; checked_at: string }>;

    const checkedInAddresses = new Set(checkedIn.map((c) => c.watcher));
    const notYetCheckedIn = watchers.map((w) => w.address).filter((a) => !checkedInAddresses.has(a));

    res.json({
      round_id: roundId,
      round_started_at: new Date(roundId * deps.config.ROUND_LENGTH_SECONDS * 1000).toISOString(),
      checked_in: checkedIn.map((c) => ({ watcher: c.watcher, status: c.status, checked_at: c.checked_at })),
      not_yet_checked_in: notYetCheckedIn,
    });
  });

  return buildRemainingRoutes(router, deps);
}

// Split for file-size sanity — continued in the same module, not a
// separate concern, just kept the diff reviewable while building this.
function buildRemainingRoutes(router: Router, deps: RouteDeps): Router {
  interface SettlementDbRow {
    event_id: string;
    sla_id: string;
    round_id: string;
    quorum_threshold: number | null;
    penalty_amount: string;
    beneficiary: string;
    tx_hash: string;
    ledger_close_time: string;
  }

  // GET /v1/slas/:slaId/settlements
  router.get("/v1/slas/:slaId/settlements", async (req, res) => {
    const slaId = req.params.slaId as string;
    const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
    const beforeParam = typeof req.query.before === "string" ? decodeCursor(req.query.before) : undefined;

    const rows = beforeParam
      ? (deps.db.raw
          .prepare(
            `SELECT * FROM settlements WHERE sla_id = ? AND (ledger_close_time, event_id) < (?, ?)
             ORDER BY ledger_close_time DESC, event_id DESC LIMIT ?`,
          )
          .all(slaId, beforeParam.ledgerCloseTime, beforeParam.eventId, limit + 1) as SettlementDbRow[])
      : (deps.db.raw
          .prepare(
            `SELECT * FROM settlements WHERE sla_id = ? ORDER BY ledger_close_time DESC, event_id DESC LIMIT ?`,
          )
          .all(slaId, limit + 1) as SettlementDbRow[]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    // Lazily fill quorum_threshold the first time it's needed — see the
    // db schema comment for why it can start out null.
    for (const row of page) {
      if (row.quorum_threshold === null) {
        const threshold = await fetchQuorumThreshold({
          server: deps.server,
          networkPassphrase: deps.config.NETWORK_PASSPHRASE,
          slaVaultContractId: deps.config.SLA_VAULT_CONTRACT_ID,
          slaId,
        });
        deps.db.setSlaQuorumThreshold(slaId, threshold);
        row.quorum_threshold = threshold;
      }
    }

    // votes_up/votes_down are not columns on settlements — they're
    // aggregated from the checks table for the same (sla_id, round_id),
    // computed here rather than duplicated into the settlements row at
    // ingest time, so there's only one source of truth for a round's
    // actual vote counts.
    const voteCountStmt = deps.db.raw.prepare(
      `SELECT
         SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as votes_up,
         SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as votes_down
       FROM checks WHERE sla_id = ? AND round_id = ?`,
    );

    const data = page.map((r) => {
      const votes = voteCountStmt.get(r.sla_id, r.round_id) as { votes_up: number | null; votes_down: number | null };
      return {
        round_id: Number(r.round_id),
        votes_up: votes.votes_up ?? 0,
        votes_down: votes.votes_down ?? 0,
        quorum_threshold: r.quorum_threshold,
        penalty_amount: r.penalty_amount,
        beneficiary: r.beneficiary,
        tx_hash: r.tx_hash,
        ledger_close_time: r.ledger_close_time,
        explorer_url: `https://stellar.expert/explorer/testnet/tx/${r.tx_hash}`,
      };
    });

    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ ledgerCloseTime: last.ledger_close_time, eventId: last.event_id })
        : null;

    res.json({ data, next_cursor: nextCursor });
  });

  // GET /v1/providers/:address/slas
  router.get("/v1/providers/:address/slas", (req, res) => {
    const address = req.params.address as string;
    const rows = deps.db.raw
      .prepare(
        "SELECT sla_id, token, bond_amount_at_creation, beneficiary, created_at, tx_hash FROM slas WHERE provider = ? ORDER BY created_at DESC",
      )
      .all(address) as Array<{
      sla_id: string;
      token: string;
      bond_amount_at_creation: string;
      beneficiary: string;
      created_at: string;
      tx_hash: string;
    }>;

    res.json({
      data: rows.map((r) => ({
        sla_id: Number(r.sla_id),
        token: r.token,
        bond_amount_at_creation: r.bond_amount_at_creation,
        beneficiary: r.beneficiary,
        created_at: r.created_at,
        tx_hash: r.tx_hash,
      })),
      next_cursor: null,
    });
  });

  // GET /v1/clock
  router.get("/v1/clock", async (_req, res) => {
    const ledger = await getLatestLedgerInfo(deps.server);
    const roundId = Math.floor(ledger.closeTimeMs / 1000 / deps.config.ROUND_LENGTH_SECONDS);

    res.json({
      ledger_sequence: ledger.sequence,
      ledger_close_time: new Date(ledger.closeTimeMs).toISOString(),
      current_round_id: roundId,
    });
  });

  return router;
}
