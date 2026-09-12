import { Router, type IRouter } from "express";
import healthRouter from "./health";
import skinsRouter from "./skins";
import usersRouter from "./users";
import chatsRouter from "./chats";
import translateRouter from "./translate";
import suggestReplyRouter from "./suggestReply";
import chatExportSummaryRouter from "./chatExportSummary";
import parentalRouter from "./parental";
import scheduledMessagesRouter from "./scheduled-messages";
import backupRouter from "./backup";
import checkinsRouter from "./checkins";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/skins", skinsRouter);
router.use("/users", usersRouter);
router.use("/chats", chatsRouter);
router.use(translateRouter);
router.use(suggestReplyRouter);
router.use(chatExportSummaryRouter);
router.use("/parental", parentalRouter);
router.use("/scheduled-messages", scheduledMessagesRouter);
router.use(backupRouter);
router.use("/checkins", checkinsRouter);

export default router;
