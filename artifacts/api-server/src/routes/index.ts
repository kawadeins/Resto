import { Router, type IRouter } from "express";
import healthRouter from "./health";
import overviewRouter from "./overview";
import employeesRouter from "./employees";
import shiftsRouter from "./shifts";
import inventoryRouter from "./inventory";
import salesRouter from "./sales";
import discountsRouter from "./discounts";
import reservationsRouter from "./reservations";
import analyticsRouter from "./analytics";
import menuRouter from "./menu";
import posRouter from "./pos";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/overview", overviewRouter);
router.use("/employees", employeesRouter);
router.use("/shifts", shiftsRouter);
router.use("/inventory", inventoryRouter);
router.use("/sales", salesRouter);
router.use("/discounts", discountsRouter);
router.use("/reservations", reservationsRouter);
router.use("/analytics", analyticsRouter);
router.use("/menu", menuRouter);
router.use("/pos", posRouter);

export default router;
