import { Router } from 'express';
import { auth } from '../middlewares/auth-middleware';
import { createWorkflow, getAllWorkflows, getOneWorkflow } from '../controllers/workflow-controller';

const router = Router();

router.use(auth);

router.post('/create', createWorkflow);
router.get('/getAll', getAllWorkflows);
router.get('/get/:id', getOneWorkflow);

export default router;