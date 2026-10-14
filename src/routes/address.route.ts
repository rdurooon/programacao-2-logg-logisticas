import { Router } from 'express';
import { AddressController } from '@/controllers/address.controller';
import { authenticate, authorize } from '@/middlewares/auth';
import { UserRole } from '@/types';

const router = Router();
const addressController = new AddressController();
router.use(authenticate, authorize(UserRole.ADMIN, UserRole.LOGISTICS_MANAGER));

router.get('/', addressController.getAllAddresses);
router.get('/:id', addressController.getAddressById);
router.post('/', addressController.createAddress);
router.put('/:id', addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);

export default router;