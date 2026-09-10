---
name: API integration test execution
description: Why database-backed API tests use a selective CommonJS bundle instead of Node strip-types.
---

Database-backed API integration tests should compile to a CommonJS bundle before using Node's test runner. Bundle API and workspace-library source, including transitive schema libraries, but externalize runtime packages such as Express and Pino.

**Why:** Node strip-types cannot resolve the API's extensionless ESM imports. A fully bundled ESM test fails on CommonJS dynamic requires, while fully bundling Pino also breaks its worker-file lookup. Selective CommonJS bundling avoids all three failure modes.

**How to apply:** Use the API's test build helper for integration entries that import the app or routes. Keep simple isolated unit tests on strip-types when they do not traverse extensionless imports.