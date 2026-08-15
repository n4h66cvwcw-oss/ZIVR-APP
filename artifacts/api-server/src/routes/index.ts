import { Router, type IRouter } from "express";
import healthRouter from "./health";
import skinsRouter from "./skins";
import usersRouter from "./users";
import chatsRouter from "./chats";
import translateRouter from "./translate";
import suggestReplyRouter from "./suggestReply";
import parentalRouter from "./parental";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/skins", skinsRouter);
router.use("/users", usersRouter);
router.use("/chats", chatsRouter);
router.use(translateRouter);
router.use(suggestReplyRouter);
router.use("/parental", parentalRouter);

export default router;
