// File: routes/lead-source-routes.ts
import { Router } from 'express';
import { auth } from '../middlewares/auth-middleware';
import { 
  createLeadSource, 
  getLeadSources, 
  updateLeadSource, 
  deleteLeadSource 
} from '../controllers/lead-source-controller';

const router = Router();

router.use(auth);

// Create a new lead source
router.post('/create', createLeadSource);
// Get all lead sources
router.get('/getAll', getLeadSources);
// Update a lead source
router.put('/update/:id', updateLeadSource);
// Delete a lead source
router.delete('/delete/:id', deleteLeadSource);

export default router;