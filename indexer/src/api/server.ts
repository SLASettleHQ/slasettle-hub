import cors from "cors";
import express, { type Express, type ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { buildRouter, type RouteDeps } from "./routes.js";

const errorHandler = (logger: Logger): ErrorRequestHandler => (err, _req, res, _next) => {
  logger.error({ err }, "unhandled error in request handler");
  res.status(500).json({ error: "internal_error" });
};

/**
 * Allowed origins come from config.ALLOWED_ORIGINS (see config.ts), never
 * hardcoded here and never a wildcard `*`, since this API returns
 * provider-address-scoped data, and a wildcard would let any origin read
 * it via a victim's browser. Passing the array to `cors`'s `origin` option
 * makes it check the incoming Origin header against this exact list and
 * only echo back a match; an origin not on the list gets no
 * Access-Control-Allow-Origin header at all, not a reflected value.
 */
export function buildApp(deps: RouteDeps, logger: Logger): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: deps.config.ALLOWED_ORIGINS }));
  app.use(express.json());
  app.use(buildRouter(deps));
  app.use(errorHandler(logger));
  return app;
}
