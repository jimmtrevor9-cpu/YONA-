// Petit serveur HTTP Node qui sert le build Cloudflare (.output) pour les tests locaux.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
const root = process.cwd();
const { default: app } = await import(`${root}/.output/server/index.mjs`);
const types = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
};
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.includes(".") && !url.pathname.startsWith("/_serverFn")) {
      try {
        const buf = await readFile(join(root, ".output/public", url.pathname));
        res.writeHead(200, {
          "content-type": types[extname(url.pathname)] ?? "application/octet-stream",
        });
        return res.end(buf);
      } catch {}
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = await app.fetch(
      new Request(url, {
        method: req.method,
        headers: req.headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
        duplex: "half",
      }),
      {},
      { waitUntil() {}, passThroughOnException() {} },
    );
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  })
  .listen(Number(process.env.PORT ?? 4173), () => console.log("serveur prêt"));
