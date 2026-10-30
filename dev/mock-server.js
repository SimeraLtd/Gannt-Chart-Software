// Local stand-in for Azure: serves the page, fakes the signed-in user, and runs the real
// store code against an in-memory table. Run: node dev/mock-server.js  → http://localhost:4280
const http = require("http");
const fs = require("fs");
const path = require("path");
const { createStore, InputError } = require("../api/src/store");

function memoryTable() {
  const rows = new Map();
  return {
    async createTable() {},
    async *listEntities() { for (const e of rows.values()) yield e; },
    async upsertEntity(e) { rows.set(e.partitionKey + "/" + e.rowKey, { ...e }); },
    async deleteEntity(pk, rk) { if (!rows.delete(pk + "/" + rk)) { const err = new Error("not found"); err.statusCode = 404; throw err; } },
  };
}

const store = createStore(memoryTable());
const USER = "test.user@simera.example";
const PORT = +process.env.PORT || 4280;

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(path.join(__dirname, "..", "src", "index.html")));
    }
    if (url.pathname === "/.auth/me") return send(res, 200, { clientPrincipal: { userDetails: USER, userRoles: ["anonymous", "authenticated"] } });
    if (url.pathname === "/api/state" && req.method === "GET") return send(res, 200, await store.all());
    const m = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)$/);
    if (m && req.method === "PUT") {
      let raw = ""; for await (const c of req) raw += c;
      let body; try { body = JSON.parse(raw); } catch { throw new InputError("The record must be JSON."); }
      return send(res, 200, await store.put(m[1], m[2], body, USER));
    }
    if (m && req.method === "DELETE") { await store.remove(m[1], m[2]); return send(res, 204); }
    send(res, 404, { error: "Not found" });
  } catch (e) {
    if (e instanceof InputError) return send(res, 400, { error: e.message });
    console.error(e); send(res, 500, { error: "Server error" });
  }
}).listen(PORT, () => console.log("Mock planner on http://localhost:" + PORT));
