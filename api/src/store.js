// Planner data in one Azure Storage table.
// PartitionKey = "project" | "task", RowKey = id, body = the record as JSON text.
const KINDS = { projects: "project", tasks: "task" };
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BODY = 32 * 1024;

class InputError extends Error {}

function createStore(table) {
  let ready = null;
  const ensure = () => (ready ||= table.createTable().catch(e => { if (e.statusCode !== 409) { ready = null; throw e; } }));

  return {
    async all() {
      await ensure();
      const out = { projects: [], tasks: [] };
      for await (const e of table.listEntities()) {
        const list = e.partitionKey === "project" ? out.projects : e.partitionKey === "task" ? out.tasks : null;
        if (!list) continue;
        try { list.push({ ...JSON.parse(e.body), id: e.rowKey }); } catch { /* skip a damaged row */ }
      }
      return out;
    },

    async put(kind, id, body, user) {
      const pk = KINDS[kind];
      if (!pk || !ID_RE.test(id || "")) throw new InputError("Unknown record.");
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new InputError("The record must be a JSON object.");
      const { id: _drop, ...rest } = body;
      const record = { ...rest, updatedBy: user || "unknown", updatedAt: new Date().toISOString() };
      const text = JSON.stringify(record);
      if (text.length > MAX_BODY) throw new InputError("The record is too large.");
      await ensure();
      await table.upsertEntity({ partitionKey: pk, rowKey: id, body: text }, "Replace");
      return { ...record, id };
    },

    async remove(kind, id) {
      const pk = KINDS[kind];
      if (!pk || !ID_RE.test(id || "")) throw new InputError("Unknown record.");
      await ensure();
      try { await table.deleteEntity(pk, id); } catch (e) { if (e.statusCode !== 404) throw e; }
    },
  };
}

module.exports = { createStore, InputError };
