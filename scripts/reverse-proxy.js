const fs = require("fs");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const WEB_TARGET = "http://127.0.0.1:3001";
const API_TARGET = "http://127.0.0.1:3000";
const HTTP_PORT = Number(process.env.VISHU_HTTP_PORT || 80);
const HTTPS_PORT = Number(process.env.VISHU_HTTPS_PORT || 443);
const PFX_PATH = process.env.VISHU_SSL_PFX_PATH || "";
const PFX_PASSPHRASE = process.env.VISHU_SSL_PFX_PASSPHRASE || "";

function chooseTarget(req) {
  const originalUrl = req.url || "/";

  if (originalUrl === "/api" || originalUrl.startsWith("/api/")) {
    const nextPath = originalUrl === "/api" ? "/" : originalUrl.slice(4) || "/";
    return new URL(nextPath, API_TARGET);
  }

  if (originalUrl === "/uploads" || originalUrl.startsWith("/uploads/")) {
    return new URL(originalUrl, API_TARGET);
  }

  return new URL(originalUrl, WEB_TARGET);
}

function proxyRequest(req, res) {
  const target = chooseTarget(req);
  const client = target.protocol === "https:" ? https : http;
  const headers = {
    ...req.headers,
    host: target.host,
    "x-forwarded-host": req.headers.host || "",
    "x-forwarded-proto": req.socket.encrypted ? "https" : "http",
    "x-forwarded-for": req.socket.remoteAddress || "",
  };

  const upstream = client.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers,
    },
    (upstreamResponse) => {
      res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Proxy request failed: ${error.message}`);
  });

  req.pipe(upstream);
}

function createHttpServer(httpsEnabled) {
  return http.createServer((req, res) => {
    if (httpsEnabled) {
      const hostHeader = req.headers.host || "localhost";
      const hostWithoutPort = hostHeader.replace(/:\d+$/, "");
      res.writeHead(308, {
        Location: `https://${hostWithoutPort}${req.url || "/"}`,
      });
      res.end();
      return;
    }

    proxyRequest(req, res);
  });
}

function createHttpsServer() {
  if (!PFX_PATH || !fs.existsSync(PFX_PATH)) {
    return null;
  }

  return https.createServer(
    {
      pfx: fs.readFileSync(PFX_PATH),
      passphrase: PFX_PASSPHRASE,
    },
    proxyRequest,
  );
}

const httpsServer = createHttpsServer();
const httpServer = createHttpServer(Boolean(httpsServer));

httpServer.listen(HTTP_PORT, "0.0.0.0", () => {
  process.stdout.write(`HTTP proxy listening on ${HTTP_PORT}\n`);
});

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, "0.0.0.0", () => {
    process.stdout.write(`HTTPS proxy listening on ${HTTPS_PORT}\n`);
  });
} else {
  process.stdout.write("HTTPS disabled: no PFX certificate configured.\n");
}
