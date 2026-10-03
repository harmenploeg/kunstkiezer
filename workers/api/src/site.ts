import { BASE_PATH, isPagePath } from "../../../packages/domain/src/navigation.ts";
import api from "./index.ts";

interface Bindings { ASSETS: { fetch(request: Request): Promise<Response> } }

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== BASE_PATH && !url.pathname.startsWith(`${BASE_PATH}/`)) return error(404, "not_found");
    if (url.pathname === BASE_PATH) {
      if (request.method !== "GET" && request.method !== "HEAD") return error(405, "method_not_allowed");
      url.pathname += "/";
      return Response.redirect(url.toString(), 308);
    }
    const relativePath = url.pathname.slice(BASE_PATH.length);
    if (relativePath.startsWith("/api/")) {
      url.pathname = relativePath;
      return api.fetch(new Request(url, request));
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const normalizedPath = relativePath.replace(/\/$/, "") || "/";
    const isPage = isPagePath(normalizedPath);
    if (!isPage && !relativePath.startsWith("/assets/")) return error(404, "not_found");
    // Assets serveert index.html via '/'; '/index.html' geeft een canonieke
    // redirect naar de domeinroot en zou daardoor het app-prefix verliezen.
    url.pathname = isPage ? "/" : relativePath;
    const response = await env.ASSETS.fetch(new Request(url, request));
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Robots-Tag", "noindex, nofollow");
    if (isPage) {
      headers.set("Cache-Control", "no-store");
      headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    }
    return new Response(response.body, { status: response.status, headers });
  },
};
