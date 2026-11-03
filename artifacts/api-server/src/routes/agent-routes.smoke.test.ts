import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import app from "../app.ts";
import pool from "../lib/db.ts";

let server: http.Server;
let base = "";

async function status(method: string, path: string, body?: unknown): Promise<number> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  await response.arrayBuffer();
  return response.status;
}

test.before(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  base = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await pool.end();
});

test("sub-profile routes answer on /v1 and /api/v1 without a session", async () => {
  assert.equal(await status("POST", "/v1/sub-profiles", { displayName: "Jay's Claude", profileMode: "agent" }), 401);
  assert.equal(await status("GET", "/api/v1/sub-profiles"), 401);
  assert.equal(await status("POST", "/v1/agent/token", { apiKey: "not-a-key" }), 401);
  assert.equal(await status("POST", "/api/v1/agent/token", { apiKey: "not-a-key" }), 401);
  assert.equal(await status("GET", "/v1/agent/chats"), 401);
  assert.equal(await status("GET", "/api/v1/agent/calendar/free-busy"), 401);
  assert.equal(await status("POST", "/v1/agent/calendar/proposals", { title: "Lunch" }), 401);
  const proposalId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  assert.equal(await status("POST", `/v1/calendar/proposals/${proposalId}/respond`, { decision: "yes" }), 401);
  assert.equal(await status("POST", `/api/v1/calendar/proposals/${proposalId}/respond`, { decision: "no" }), 401);
  assert.equal(await status("GET", "/v1/not-a-route"), 404);
});
