import { Router } from 'express';
import { healthCheck, getRequestLogs } from '../controllers/healthController';
import { basicAuth } from '../middleware/auth';

const router = Router();

router.get('/health', healthCheck);
router.get('/logs', basicAuth, getRequestLogs);

export default router;
