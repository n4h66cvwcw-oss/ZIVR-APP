const { build } = require("esbuild");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "node_modules", ".cache", "zivr-messaging-provider-notification-test.cjs");
const mocks = path.join(root, "test", "mocks");

build({
  entryPoints: [path.join(root, "context", "MessagingContext.notifications.test.tsx")],
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
  },
}).then(() => {
  const result = spawnSync(process.execPath, ["--test", output], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});