import { Router } from 'express';
import userRoutes from './userRoutes';
import healthRoutes from './healthRoutes';

const router = Router();

router.use('/api/users', userRoutes);
router.use('/api', healthRoutes);

export default router;
