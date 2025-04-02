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
  stopSchduler,
} from '../controllers/workflow-controller';

const router = Router();

// Protect all workflow routes with auth middleware
router.use(auth);

// Save a new workflow
router.post('/save', saveWorkflow);
// Save and run a workflow
router.post('/save-and-start', saveAndStartWorkflow);

// Fetch all workflows
router.get('/getAll', getAllWorkflows);
// Fetch one workflow by ID
router.get('/get/:id', getOneWorkflow);

// Update a workflow
router.patch('/update/:id', updateWorkflow);
// Update and run a workflow
router.patch('/update-and-start/:id', updateAndStartWorkflow);

// Start workflow scheduler
router.post('/start-scheduler/:id', startScheduler);
// Stop workflow scheduler
router.post('/stop-scheduler/:id', stopSchduler);

// Delete a workflow
router.delete('/delete/:id', deleteWorkflow);

export default router;