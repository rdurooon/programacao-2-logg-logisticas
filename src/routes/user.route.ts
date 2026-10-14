import { Router } from "express";
import { UserController } from "@/controllers/user.controller";
import { authenticate, authorize } from "@/middlewares/auth";
import { UserRole } from "@/types";

const router = Router();

const userController = new UserController();
router.use(authenticate, authorize(UserRole.ADMIN));

router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.post("/", userController.createUser);
router.put("/:id", userController.updateUser);
router.delete("/:id",   userController.deleteUser);

export default router;