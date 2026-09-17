import express, { type Express, type ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { buildRouter, type RouteDeps } from "./routes.js";

const errorHandler = (logger: Logger): ErrorRequestHandler => (err, _req, res, _next) => {
  logger.error({ err }, "unhandled error in request handler");
  res.status(500).json({ error: "internal_error" });
};

export function buildApp(deps: RouteDeps, logger: Logger): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use(buildRouter(deps));
  app.use(errorHandler(logger));
  return app;
}
