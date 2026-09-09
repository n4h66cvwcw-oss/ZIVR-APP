import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachSocket } from "./lib/socket";
import { migrate } from "./lib/migrate";
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
  .then(() => {
    logger.info("Database migration complete");
    const httpServer = http.createServer(app);
    attachSocket(httpServer);
    startScheduledMessageDispatcher();
    httpServer.listen(port, () => {
      logger.info({ port }, "Server listening (HTTP + Socket.io)");
    });
  })
  .catch((err) => {
    logger.error(err, "Database migration failed — server not started");
    process.exit(1);
  });
