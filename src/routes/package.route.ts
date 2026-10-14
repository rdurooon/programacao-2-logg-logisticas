import { Router } from "express";
import { PackageController } from "@/controllers/package.controller";
import { authenticate, authorize } from "@/middlewares/auth";
import { UserRole } from "@/types";

const router = Router();

const packageController = new PackageController();

router.get("/tracking/:code", packageController.getPackageByCode);
router.use(authenticate);

router.get("/offers", packageController.getOffers);
router.post("/offers/:offerId/respond", packageController.respondToOffer);
router.get("/notifications", packageController.getNotifications);
router.patch("/notifications/:notificationId/read", packageController.markNotificationRead);
router.put("/courier/location", authorize(UserRole.COURIER), packageController.updateCourierLocation);

router.get("/", packageController.getAllPackages);
router.get("/:id", packageController.getPackageById);
router.post("/", authorize(UserRole.ADMIN, UserRole.LOGISTICS_MANAGER, UserRole.CUSTOMER), packageController.addPackage);
router.put("/:id", authorize(UserRole.ADMIN, UserRole.LOGISTICS_MANAGER), packageController.updatePackage);
router.delete("/:id", authorize(UserRole.ADMIN, UserRole.LOGISTICS_MANAGER), packageController.deletePackage);
router.patch("/:id/status", authorize(UserRole.ADMIN, UserRole.LOGISTICS_MANAGER, UserRole.COURIER), packageController.updateStatus);
router.patch("/:id/courier", authorize(UserRole.ADMIN, UserRole.LOGISTICS_MANAGER), packageController.assignCourier);
router.post("/:id/offers", authorize(UserRole.ADMIN, UserRole.LOGISTICS_MANAGER), packageController.createOffer);
router.post("/:id/offers/nearby", authorize(UserRole.ADMIN, UserRole.LOGISTICS_MANAGER), packageController.createNearbyOffers);
router.post("/:id/cancel", authorize(UserRole.ADMIN, UserRole.LOGISTICS_MANAGER, UserRole.COURIER), packageController.cancelPackage);
router.post("/:id/location", authorize(UserRole.COURIER), packageController.updateLocation);
router.get("/:id/location", packageController.getLocation);
router.post("/:id/incidents", authorize(UserRole.ADMIN, UserRole.LOGISTICS_MANAGER, UserRole.COURIER), packageController.createIncident);
router.get("/:id/incidents", packageController.getIncidents);
router.post("/:id/confirm-delivery", authorize(UserRole.COURIER), packageController.confirmDelivery);

export default router;