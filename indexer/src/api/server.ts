import cors from "cors";
import express, { type Express, type ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { buildRouter, type RouteDeps } from "./routes.js";

const errorHandler = (logger: Logger): ErrorRequestHandler => (err, _req, res, _next) => {
  logger.error({ err }, "unhandled error in request handler");
  res.status(500).json({ error: "internal_error" });
};

/**
 * Only the local Next.js dev server's origin is allowed here, not a
 * wildcard `*` — this API returns provider-address-scoped data, and a
 * wildcard would let any origin read it via a victim's browser. This is a
 * local-development allowlist, not a real one: before deploying anywhere
 * but localhost, replace this with the actual list of deployed frontend
 * origins (e.g. from an env var), since this hardcoded localhost value
 * will never match a real deployed frontend's origin.
 */
const LOCAL_FRONTEND_ORIGIN = "http://localhost:3000";

export function buildApp(deps: RouteDeps, logger: Logger): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: LOCAL_FRONTEND_ORIGIN }));
  app.use(express.json());
  app.use(buildRouter(deps));
  app.use(errorHandler(logger));
  return app;
}
