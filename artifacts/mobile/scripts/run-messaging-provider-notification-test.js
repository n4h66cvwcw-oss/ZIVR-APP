const { build } = require("esbuild");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const entryArg = process.argv[2] || "context/MessagingContext.notifications.test.tsx";
const entry = path.resolve(root, entryArg);
const output = path.join(root, "node_modules", ".cache", `zivr-${path.basename(entry, path.extname(entry))}.cjs`);
const mocks = path.join(root, "test", "mocks");

build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  external: ["react", "react-test-renderer", "node:*"],
  alias: {
    "@react-native-async-storage/async-storage": path.join(mocks, "async-storage.ts"),
    "@/utils/notifications": path.join(mocks, "notifications.ts"),
    "@/context/ServerContext": path.join(mocks, "ServerContext.ts"),
    "@/context/ProfileContext": path.join(mocks, "ProfileContext.ts"),
    "@/utils/crypto": path.join(mocks, "crypto.ts"),
    "@/utils/betaFeedback": path.join(mocks, "betaFeedback.ts"),
    "react-native": path.join(mocks, "react-native.ts"),
    "expo-router": path.join(mocks, "expo-router.ts"),
  },
}).then(() => {
  const result = spawnSync(process.execPath, ["--test", output], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});