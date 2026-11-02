import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getRealtimeStatus } from "../lib/realtime-bus";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Content-free realtime diagnostics (no ids of users, no message data, no secrets).
// Hit it several times: each Autoscale instance reports its own instanceId.
router.get("/healthz/realtime", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await getRealtimeStatus());
});

export default router;
