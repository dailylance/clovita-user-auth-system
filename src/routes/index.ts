import { Router } from 'express';
import userRoutes from './userRoutes.js';
import authRoutes from './authRoutes.js';
import healthRoutes from './healthRoutes.js';

const router = Router();

router.use('/api/auth', authRoutes);
router.use('/api/users', userRoutes);
router.use('/api', healthRoutes);

export default router;
