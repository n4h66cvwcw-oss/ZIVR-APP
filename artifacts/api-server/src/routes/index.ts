import { Router, type IRouter } from "express";
import healthRouter from "./health";
import skinsRouter from "./skins";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/skins", skinsRouter);

export default router;
