import { build } from "esbuild";
import { basename } from "node:path";

const entryPoint = process.argv[2];
if (!entryPoint) {
  throw new Error("A TypeScript test entry point is required.");
}

await build({
  entryPoints: [entryPoint],
  bundle: true,
  platform: "node",
  format: "cjs",
  plugins: [{
    name: "external-runtime-packages",
    setup(buildApi) {
      buildApi.onResolve({ filter: /^[^./]/ }, (args) => {
        if (args.path === "zod" || args.path.startsWith("@workspace/")) return undefined;
        return { path: args.path, external: true };
      });
    },
  }],
  outfile: `dist/${basename(entryPoint, ".ts")}.cjs`,
  sourcemap: "inline",
});