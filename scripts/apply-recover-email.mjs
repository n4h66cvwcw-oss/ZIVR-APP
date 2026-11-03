#!/usr/bin/env node
// Idempotent in-place edits for the 3 EXISTING files the recover-email pack
// touches, so it works on whichever users.ts / migrate.ts line is live.
// Run from the ZIVR repo root after extracting the tgz:
//   node scripts/apply-recover-email.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const API = "artifacts/api-server";
const changed = [];

function edit(path, fn) {
  if (!existsSync(path)) throw new Error(`missing ${path} — run from the ZIVR repo root`);
  const before = readFileSync(path, "utf8");
  const after = fn(before);
  if (after !== before) {
    writeFileSync(path, after);
    changed.push(path);
  }
}

// 1) routes/index.ts — mount the additive router BEFORE usersRouter.
edit(`${API}/src/routes/index.ts`, (s) => {
  if (s.includes("users-recover-email")) return s;
  const importAnchor = 'import usersRouter from "./users";';
  const useAnchor = 'router.use("/users", usersRouter);';
  if (!s.includes(importAnchor) || !s.includes(useAnchor)) {
    throw new Error("routes/index.ts: usersRouter anchors not found; apply manually");
  }
  return s
    .replace(importAnchor, `import usersRecoverEmailRouter from "./users-recover-email";\n${importAnchor}`)
    .replace(useAnchor, `router.use("/users", usersRecoverEmailRouter);\n${useAnchor}`);
});

// 2) lib/migrate.ts — call migrateUserEmail() at the end of migrate().
edit(`${API}/src/lib/migrate.ts`, (s) => {
  if (s.includes("migrateUserEmail")) return s;
  const dbImport = 'import { query } from "./db";';
  if (!s.includes(dbImport)) throw new Error("lib/migrate.ts: db import anchor not found");
  const end = s.trimEnd();
  if (!end.endsWith("}")) throw new Error("lib/migrate.ts: expected migrate() to close the file");
  const body = end.slice(0, -1).trimEnd();
  return (
    body.replace(dbImport, `${dbImport}\nimport { migrateUserEmail } from "./user-email-migrate";`) +
    "\n  // vm_users.email + unique lower(email) (recover-email pack)\n  await migrateUserEmail();\n}\n"
  );
});

// 3) package.json — nodemailer dep + test script.
edit(`${API}/package.json`, (s) => {
  const pkg = JSON.parse(s);
  pkg.dependencies ??= {};
  pkg.scripts ??= {};
  let dirty = false;
  if (!pkg.dependencies.nodemailer) {
    pkg.dependencies.nodemailer = "^10.2.1";
    pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).sort(([a], [b]) => a.localeCompare(b)));
    dirty = true;
  }
  if (!pkg.scripts["test:recover-email"]) {
    pkg.scripts["test:recover-email"] =
      "node ./test-build.mjs src/lib/recover-email.test.ts && node ./test-build.mjs src/lib/recover-email-service.test.ts && node --test dist/recover-email.test.cjs dist/recover-email-service.test.cjs";
    dirty = true;
  }
  return dirty ? JSON.stringify(pkg, null, 2) + "\n" : s;
});

console.log(changed.length ? `updated:\n  ${changed.join("\n  ")}` : "already applied (no changes)");
