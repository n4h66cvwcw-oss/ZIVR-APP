import { Router, type IRouter } from "express";
import healthRouter from "./health";
import skinsRouter from "./skins";
import usersRouter from "./users";
import chatsRouter from "./chats";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/skins", skinsRouter);
router.use("/users", usersRouter);
router.use("/chats", chatsRouter);

export default router;
