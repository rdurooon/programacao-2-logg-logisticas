import { Router } from "express";
import { PackageController } from "@/controllers/package.controller";

const router = Router();

const packageController = new PackageController();

router.get("/", packageController.getAllPackages);
router.get("/:id", packageController.getPackageById);
router.post("/", packageController.addPackage);
router.put("/:id", packageController.updatePackage);
router.delete("/:id", packageController.deletePackage);

export default router;