import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildOpenApiSpec } from "./spec.js";

const specPath = fileURLToPath(new URL("../openapi/zivr-gpt-actions.openapi.json", import.meta.url));
writeFileSync(specPath, `${JSON.stringify(buildOpenApiSpec(), null, 2)}\n`);
process.stdout.write(`${specPath}\n`);
