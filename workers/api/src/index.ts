/** Liveness-check; zegt niets over databaseconnectiviteit. */
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api/health") {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    if (request.method !== "GET") {
      return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "GET" } });
    }
    return Response.json({ status: "ok", service: "kunstkiezer-api" }, {
      headers: { "Cache-Control": "no-store" },
    });
  },
};
