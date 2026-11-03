import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ACTION_SCOPE_STRING, GPT_ENDPOINT_TEXT_MAX, GPT_PARAM_TEXT_MAX } from "./limits.js";
import { buildOpenApiSpec, type OpenApiDocument } from "./spec.js";

const specPath = fileURLToPath(new URL("../openapi/zivr-gpt-actions.openapi.json", import.meta.url));
const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));

const OPERATIONS = ["listChats", "listEvents", "sendMessage", "proposeCalendar"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function resolveRef(doc: OpenApiDocument, ref: string): unknown {
  if (!ref.startsWith("#/")) throw new Error(`Unsupported ref ${ref}`);
  let cursor: unknown = doc;
  for (const part of ref.slice(2).split("/")) {
    const record = asRecord(cursor);
    if (!record || !(part in record)) throw new Error(`Unresolved ref ${ref}`);
    cursor = record[part];
  }
  return cursor;
}

function walkRefs(doc: OpenApiDocument, value: unknown, stack: string[] = []): void {
  if (Array.isArray(value)) {
    for (const entry of value) walkRefs(doc, entry, stack);
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  const ref = record["$ref"];
  if (typeof ref === "string") {
    if (stack.includes(ref)) throw new Error(`Circular ref ${ref}`);
    walkRefs(doc, resolveRef(doc, ref), [...stack, ref]);
  }
  for (const [key, entry] of Object.entries(record)) {
    if (key !== "$ref") walkRefs(doc, entry, stack);
  }
}

function problems(doc: OpenApiDocument): string[] {
  const errors: string[] = [];
  if (!doc.openapi.startsWith("3.")) errors.push("openapi version");
  if (!doc.info.title || !doc.info.version || !doc.info.description) errors.push("info");
  const server = doc.servers[0]?.url;
  if (!server || !server.startsWith("https://")) errors.push("https server");
  const schemes = asRecord(doc.components.securitySchemes);
  const oauth = asRecord(schemes?.["zivrAgent"]);
  const flows = asRecord(oauth?.["flows"]);
  const code = asRecord(flows?.["authorizationCode"]);
  if (oauth?.["type"] !== "oauth2" || !code) errors.push("oauth2 authorizationCode");
  const authorizationUrl = typeof code?.["authorizationUrl"] === "string" ? code["authorizationUrl"] : "";
  const tokenUrl = typeof code?.["tokenUrl"] === "string" ? code["tokenUrl"] : "";
  if (server && new URL(authorizationUrl).host !== new URL(server).host) errors.push("authorize host");
  if (server && new URL(tokenUrl).host !== new URL(server).host) errors.push("token host");
  if (!authorizationUrl.endsWith("/v1/gpt-actions/oauth/authorize")) errors.push("authorize path");
  if (!tokenUrl.endsWith("/v1/gpt-actions/oauth/token")) errors.push("token path");
  const found = new Set<string>();
  for (const [path, item] of Object.entries(doc.paths)) {
    if (!path.startsWith("/v1/agent/")) errors.push(`path ${path}`);
    const pathItem = asRecord(item);
    if (!pathItem) {
      errors.push(`empty ${path}`);
      continue;
    }
    for (const [method, operation] of Object.entries(pathItem)) {
      const op = asRecord(operation);
      if (!op) continue;
      const id = op["operationId"];
      if (typeof id !== "string") errors.push(`${method} ${path} operationId`);
      else found.add(id);
      for (const field of ["summary", "description"]) {
        const text = op[field];
        if (typeof text !== "string" || text.length === 0 || text.length > GPT_ENDPOINT_TEXT_MAX) {
          errors.push(`${String(id)} ${field} length ${typeof text === "string" ? text.length : "missing"}`);
        }
      }
      if (typeof op["x-openai-isConsequential"] !== "boolean") errors.push(`${String(id)} consequential`);
      const parameters = op["parameters"];
      if (Array.isArray(parameters)) {
        for (const parameter of parameters) {
          const record = asRecord(parameter);
          if (!record) continue;
          if (record["in"] === "header") errors.push(`${String(id)} custom header`);
          const description = record["description"];
          if (typeof description !== "string" || description.length > GPT_PARAM_TEXT_MAX) {
            errors.push(`${String(id)} parameter description`);
          }
        }
      }
      if (method === "post" && !asRecord(op["requestBody"])) errors.push(`${String(id)} body`);
      if (!asRecord(op["responses"])) errors.push(`${String(id)} responses`);
    }
  }
  for (const id of OPERATIONS) {
    if (!found.has(id)) errors.push(`missing ${id}`);
  }
  if (found.size !== OPERATIONS.length) errors.push(`unexpected operations ${[...found].join(",")}`);
  const scope = asRecord(code?.["scopes"]);
  if (scope && Object.keys(scope).join(" ") !== ACTION_SCOPE_STRING) errors.push("scope list");
  try {
    walkRefs(doc, doc);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "ref");
  }
  return errors;
}

test("the action spec is a ChatGPT-sized OpenAPI document", () => {
  const doc = buildOpenApiSpec();
  assert.deepEqual(problems(doc), []);
  assert.equal(readFileSync(specPath, "utf8"), `${JSON.stringify(doc, null, 2)}\n`);
});

test("a non-production origin keeps OAuth on that same host", () => {
  const doc = buildOpenApiSpec("https://gpt.example.com");
  assert.equal(doc.servers[0]?.url, "https://gpt.example.com");
  const scheme = doc.components.securitySchemes["zivrAgent"] as { flows: { authorizationCode: { authorizationUrl: string; tokenUrl: string } } };
  assert.equal(scheme.flows.authorizationCode.authorizationUrl, "https://gpt.example.com/v1/gpt-actions/oauth/authorize");
  assert.equal(scheme.flows.authorizationCode.tokenUrl, "https://gpt.example.com/v1/gpt-actions/oauth/token");
  assert.throws(() => buildOpenApiSpec("https://api.zivrapp.com/api"), /origin/);
});

test("the readme tells a builder how to import the spec and the scope", () => {
  const readme = readFileSync(readmePath, "utf8");
  for (const phrase of [
    "zivr-gpt-actions.openapi.json",
    "/v1/gpt-actions/oauth/authorize",
    "/v1/gpt-actions/oauth/token",
    "Tell AXE",
    ACTION_SCOPE_STRING,
    "API key",
    "authorization code",
  ]) {
    assert.equal(readme.includes(phrase), true, phrase);
  }
});
