import { Router } from 'express';
import { auth } from '../middlewares/auth-middleware';
import { createWorkflow, deleteWorkflow, getAllWorkflows, getOneWorkflow, updateWorkflow } from '../controllers/workflow-controller';

const router = Router();

router.use(auth);
router.post('/create', createWorkflow);
router.get('/getAll', getAllWorkflows);
router.get('/get/:id', getOneWorkflow);
router.patch('/update/:id', updateWorkflow); 
router.delete('/delete/:id', deleteWorkflow)

export default router;