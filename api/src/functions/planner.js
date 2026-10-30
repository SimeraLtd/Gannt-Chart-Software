const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const { createStore, InputError } = require("../store");

let store = null;
function getStore() {
  if (!store) {
    const conn = process.env.STORAGE_CONNECTION_STRING;
    if (!conn) throw new Error("STORAGE_CONNECTION_STRING is not set.");
    store = createStore(TableClient.fromConnectionString(conn, process.env.STORAGE_TABLE || "planner"));
  }
  return store;
}

// Static Web Apps signs users in and passes who they are in this header.
function principal(req) {
  const h = req.headers.get("x-ms-client-principal");
  if (!h) return null;
  try { return JSON.parse(Buffer.from(h, "base64").toString("utf8")); } catch { return null; }
}

async function guarded(req, ctx, fn) {
  const who = principal(req);
  if (!who || !(who.userRoles || []).includes("authenticated")) return { status: 401, jsonBody: { error: "Sign in to use the planner." } };
  try {
    return await fn(who.userDetails || who.userId);
  } catch (e) {
    if (e instanceof InputError) return { status: 400, jsonBody: { error: e.message } };
    ctx.error(e);
    return { status: 500, jsonBody: { error: "The planner could not reach its storage." } };
  }
}

app.http("state", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "state",
  handler: (req, ctx) => guarded(req, ctx, async () => ({ jsonBody: await getStore().all(), headers: { "Cache-Control": "no-store" } })),
});

app.http("record", {
  methods: ["PUT", "DELETE"],
  authLevel: "anonymous",
  route: "{kind}/{id}",
  handler: (req, ctx) => guarded(req, ctx, async user => {
    const { kind, id } = req.params;
    if (req.method === "DELETE") { await getStore().remove(kind, id); return { status: 204 }; }
    let body;
    try { body = await req.json(); } catch { throw new InputError("The record must be JSON."); }
    return { jsonBody: await getStore().put(kind, id, body, user) };
  }),
});
