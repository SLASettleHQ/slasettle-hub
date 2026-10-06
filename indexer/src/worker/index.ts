import type { WorkerEnv } from "./types.js";
import { getAllowedOrigins, getCorsHeaders, handleOptions } from "./cors.js";
import { handleRequest } from "./routes.js";
import { runIngestionStep } from "./ingest.js";

export default {
  async fetch(request: Request, env: WorkerEnv, _ctx: ExecutionContext): Promise<Response> {
    const allowedOrigins = getAllowedOrigins(env.ALLOWED_ORIGINS);

    if (request.method === "OPTIONS") {
      return handleOptions(request, allowedOrigins);
    }

    const corsHeaders = getCorsHeaders(request, allowedOrigins);

    try {
      return await handleRequest(request, env, corsHeaders);
    } catch (err) {
      console.error("Unhandled error in Worker fetch handler:", err);
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }
  },

  async scheduled(_event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runIngestionStep(env).catch((err) => {
        console.error("Error in scheduled ingestion cycle:", err);
      }),
    );
  },
};
