import { AuthController } from "@/controllers/auth.controller";
import { Router } from "express";
import { authenticate } from "@/middlewares/auth";

const router = Router();
const authController = new AuthController();

router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);

export default router;