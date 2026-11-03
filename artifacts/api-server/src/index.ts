import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachSocket } from "./lib/socket";
import { migrate } from "./lib/migrate";
import { resetOnlinePresence } from "./lib/realtime-bus";
import { startScheduledMessageDispatcher } from "./routes/scheduled-messages";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

migrate()
  .then(async () => {
    logger.info("Database migration complete");
    // Redeploy leaves the previous process's sockets looking online. Clear
    // that before accepting traffic so presence is not stuck after boot.
    await resetOnlinePresence();
    logger.info("Cleared vm_users.is_online after boot");
    const httpServer = http.createServer(app);
    attachSocket(httpServer);
    startScheduledMessageDispatcher();
    // Bind every interface. Render's health check reaches the service over IPv4
    // on process.env.PORT; a localhost-only listen would fail that check.
    httpServer.listen(port, "0.0.0.0", () => {
      logger.info({ port }, "Server listening (HTTP + Socket.io)");
    });
  })
  .catch((err) => {
    logger.error(err, "Database migration failed — server not started");
    process.exit(1);
  });
