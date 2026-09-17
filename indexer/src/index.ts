import pino from "pino";
import { rpc } from "@stellar/stellar-sdk";
import { loadConfig } from "./config.js";
import { IndexerDb } from "./db/db.js";
import { SorobanEventClient } from "./rpc/client.js";
import { runForever } from "./ingest/poller.js";
import { buildApp } from "./api/server.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

async function main(): Promise<void> {
  const config = loadConfig();
  logger.info({ rpcUrl: config.RPC_URL, dbPath: config.DB_PATH }, "starting slasettle-indexer");

  const db = new IndexerDb(config.DB_PATH);
  const client = new SorobanEventClient(config.RPC_URL);
  const server = new rpc.Server(config.RPC_URL);

  const app = buildApp({ db, server, config }, logger);
  const httpServer = app.listen(config.HTTP_PORT, () => {
    logger.info({ port: config.HTTP_PORT }, "API server listening");
  });

  const abortController = new AbortController();
  const pollerPromise = runForever({ client, db, logger, config }, abortController.signal);

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutting down");
    abortController.abort();
    httpServer.close(() => {
      db.close();
      logger.info("shutdown complete");
      process.exit(0);
    });
    // Force-exit if graceful shutdown hangs longer than this.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await pollerPromise;
}

main().catch((err) => {
  logger.fatal({ err }, "fatal error during startup");
  process.exit(1);
});
