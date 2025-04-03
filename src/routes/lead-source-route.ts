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

router.post('/create', createLeadSource);
router.get('/getAll', getLeadSources);
router.put('/update/:id', updateLeadSource);
router.delete('/delete/:id', deleteLeadSource);

export default router;