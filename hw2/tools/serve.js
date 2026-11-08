/* 可选的本地静态预览；双击index.html也能运行。仅监听本机。 */
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  port = Number(process.env.PORT) || 8772;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};
http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch (e) {
      res.writeHead(400);
      res.end();
      return;
    }
    const file = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    const relative = path.relative(root, file).replace(/\\/g, "/");
    if (
      !file.startsWith(root + path.sep) ||
      relative.split("/").some((s) => s.startsWith(".")) ||
      /^(private|data\/raw|data\/pilot|research\/papers|research\/previews)(\/|$)/.test(
        relative,
      )
    ) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(data);
    });
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Attention Field Lab: http://127.0.0.1:${port}`),
  );
