import { Router } from 'express';
import { auth } from '../middlewares/auth-middleware';
import {
  saveWorkflow,
  saveAndStartWorkflow,
  getAllWorkflows,
  getOneWorkflow,
  updateWorkflow,
  updateAndStartWorkflow,
  startScheduler,
  deleteWorkflow,
} from '../controllers/workflow-controller';

const router = Router();

router.use(auth);

router.post('/save', saveWorkflow); 
router.post('/save-and-start', saveAndStartWorkflow); 

router.get('/getAll', getAllWorkflows);
router.get('/get/:id', getOneWorkflow);

router.patch('/update/:id', updateWorkflow); 
router.patch('/update-and-start/:id', updateAndStartWorkflow); 

router.post('/start-scheduler/:id', startScheduler);

router.delete('/delete/:id', deleteWorkflow);

export default router;