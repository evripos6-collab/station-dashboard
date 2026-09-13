/**
 * satnogs-cors-proxy — Cloudflare Worker
 *
 * WHY THIS EXISTS
 * ---------------
 * network.satnogs.org sends no Access-Control-Allow-Origin header, so a
 * browser will fetch its API and then refuse to let page JavaScript read the
 * response. CORS is enforced by the browser, not the server, and cannot be
 * disabled from the client.
 *
 * It is deliberately NOT a general proxy:
 *   - only network.satnogs.org, only /api/ paths, only GET/HEAD/OPTIONS
 *   - only Origins on the allowlist below
 * Without those, anyone who finds the URL can route arbitrary traffic through
 * our account and exhaust the 100,000 requests/day free quota.
 *
 * Responses are cached at the edge (see CACHE_SECONDS) so a lecture hall of
 * people scanning a QR code produces a handful of upstream requests rather
 * than one per viewer. That protects both our quota and SatNOGS'. The client
 * floors its time-window bounds to a matching grid so the URLs collide.
 */

const UPSTREAM = "https://network.satnogs.org";
const ALLOWED_PATH_PREFIX = "/api/";
const CACHE_SECONDS = 300;


// "*" would work but makes the proxy usable by any site on the internet.
const ALLOWED_ORIGINS = [
  "https://station-dashboard-eda.pages.dev/",
  // "https://<custom-domain>",
];

// Identify ourselves upstream. Operators appreciate being able to tell who is
// polling them, and it gives LSF someone to contact rather than a block.
const USER_AGENT =
  "satnogs-dashboard-proxy (+https://github.com/evripos6-collab/station-dashboard; station 4755/4791/5026)";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// Without CORS headers on the error too, the browser gives page JavaScript a
// generic network failure and hides this message.
function deny(status, message, origin) {
  const headers = { "Content-Type": "application/json" };
  if (origin) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

// Cursor links come back pointing at network.satnogs.org, which the browser
// cannot read. Repoint them here so the client can follow them unchanged.
function rewriteLinkHeader(link, selfOrigin) {
  return link.replace(/<([^>]+)>/g, (whole, target) =>
    target.startsWith(UPSTREAM) ? `<${selfOrigin}${target.slice(UPSTREAM.length)}>` : whole
  );
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const echo = allowed ? origin : "";

    // Preflight. Browsers send this before the real request when it is not a
    // "simple" one; answering it is what makes the real request proceed.
    if (request.method === "OPTIONS") {
      if (!allowed) return deny(403, "origin not allowed");
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return deny(405, "only GET/HEAD are proxied", echo);
    }

    // An Origin header is absent for same-origin and non-browser requests.
    // Reject only when one is present and not on the list — that is the
    // browser case this proxy exists to serve.
    if (origin && !allowed) return deny(403, "origin not allowed");

    const url = new URL(request.url);
    if (!url.pathname.startsWith(ALLOWED_PATH_PREFIX)) {
      return deny(404, `only ${ALLOWED_PATH_PREFIX}* is proxied`, echo);
    }

    const upstreamUrl = UPSTREAM + url.pathname + url.search;

    // Serve from the edge cache when we can, so many viewers collapse into
    // few upstream hits.
    const cache = caches.default;
    const cacheKey = new Request(upstreamUrl, { method: "GET" });
    let response = await cache.match(cacheKey);

    if (!response) {
      const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };
      if (env.SATNOGS_API_TOKEN) {
        headers["Authorization"] = `Token ${env.SATNOGS_API_TOKEN}`;
      }

      let upstream;
      try {
        upstream = await fetch(upstreamUrl, { method: "GET", headers });
      } catch (err) {
        return deny(502, `upstream fetch failed: ${err}`, echo);
      }

      response = new Response(upstream.body, upstream);
      response.headers.set("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
      // Never let an upstream Authorization echo or cookie reach the browser.
      response.headers.delete("Set-Cookie");

      if (upstream.ok) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
    }

    // The Link header carries the cursor for pagination and is not exposed to
    // JavaScript by default — without this the page cannot follow next-page
    // links at all.
    const out = new Response(response.body, response);
    for (const [k, v] of Object.entries(corsHeaders(origin || "*"))) {
      out.headers.set(k, v);
    }
    out.headers.set("Access-Control-Expose-Headers", "Link");

    const link = out.headers.get("Link");
    if (link) out.headers.set("Link", rewriteLinkHeader(link, url.origin));

    return out;
  },
};
