import { handleApi } from "./api/router.ts";

const OPENCODE_URL = process.env.OPENCODE_SERVER_URL || "http://localhost:4096";
const PORT = parseInt(process.env.PORT || "3000");
const DIST_PATH = new URL("../dist", import.meta.url).pathname;

// Map common extensions to MIME types
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

function mimeFor(pathname: string): string {
  const ext = pathname.match(/\.[^.]+$/)?.[0] ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

async function serveStatic(pathname: string): Promise<Response> {
  // Try exact path, then /index.html for SPA fallback
  const candidates =
    pathname === "/" || !pathname.includes(".")
      ? ["/index.html"]
      : [pathname, "/index.html"];

  for (const candidate of candidates) {
    const file = Bun.file(`${DIST_PATH}${candidate}`);
    if (await file.exists()) {
      return new Response(file, {
        headers: { "Content-Type": mimeFor(candidate) },
      });
    }
  }

  return new Response("Not found", { status: 404 });
}

async function proxyOpenCode(req: Request, pathname: string, search: string): Promise<Response> {
  const targetPath = pathname.replace(/^\/opencode/, "") || "/";
  const targetUrl = `${OPENCODE_URL}${targetPath}${search}`;

  const proxyHeaders = new Headers(req.headers);
  proxyHeaders.delete("host");

  try {
    const resp = await fetch(targetUrl, {
      method: req.method,
      headers: proxyHeaders,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    } as RequestInit);

    // Stream the response body through unchanged
    return new Response(resp.body, {
      status: resp.status,
      headers: resp.headers,
    });
  } catch {
    return new Response(JSON.stringify({ error: "OpenCode server unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",

  async fetch(req) {
    const url = new URL(req.url);
    const { pathname, search } = url;

    if (pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname.startsWith("/api/")) {
      return handleApi(req, url);
    }

    if (pathname.startsWith("/opencode")) {
      return proxyOpenCode(req, pathname, search);
    }

    return serveStatic(pathname);
  },
});

console.log(`[control-surface] listening on :${server.port}`);
