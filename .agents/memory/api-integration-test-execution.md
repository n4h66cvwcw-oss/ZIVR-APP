---
name: Integration test execution
description: Why tests crossing API or Expo app module boundaries use selective CommonJS bundles.
---

Database-backed API integration tests should compile to a CommonJS bundle before using Node's test runner. Bundle API and workspace-library source, including transitive schema libraries, but externalize runtime packages such as Express and Pino.

**Why:** Node strip-types cannot resolve the API's extensionless ESM imports. A fully bundled ESM test fails on CommonJS dynamic requires, while fully bundling Pino also breaks its worker-file lookup. Selective CommonJS bundling avoids all three failure modes.

**How to apply:** Use the API's test build helper for integration entries that import the app or routes. Keep simple isolated unit tests on strip-types when they do not traverse extensionless imports.

Expo provider tests also need a CommonJS bundle because Node cannot resolve the app's path aliases or native modules directly. Alias native/context dependencies to explicit test mocks, externalize React and its renderer, and emit the bundle beneath the package directory so Node can resolve that package's dependencies.

**Why:** Emitting a bundle in the system temporary directory breaks resolution of externalized workspace dependencies, even when they are correctly installed.

**How to apply:** Keep pure mobile policy tests on strip-types. Use the mobile provider-test runner pattern only when a test mounts a provider and crosses Expo/native module boundaries.