export function getAllowedOrigins(allowedOriginsConfig?: string): string[] {
  if (!allowedOriginsConfig) {
    return ["https://slasettle-web.vercel.app", "http://localhost:3000"];
  }
  return allowedOriginsConfig
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

export function getCorsHeaders(request: Request, allowedOrigins: string[]): HeadersInit {
  const origin = request.headers.get("Origin");
  if (!origin) return {};

  if (allowedOrigins.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
  }

  return {};
}

export function handleOptions(request: Request, allowedOrigins: string[]): Response {
  const corsHeaders = getCorsHeaders(request, allowedOrigins);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
