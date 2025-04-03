// File: routes/email-template-routes.ts
import { Router } from 'express';
import { auth } from '../middlewares/auth-middleware';
import { 
  createEmailTemplate, 
  getEmailTemplates, 
  updateEmailTemplate, 
  deleteEmailTemplate 
} from '../controllers/email-template-controller';

const router = Router();

// Protect all routes with auth middleware
router.use(auth);

router.post('/create', createEmailTemplate);
router.get('/getAll', getEmailTemplates);
router.put('/update/:id', updateEmailTemplate);
router.delete('/delete/:id', deleteEmailTemplate);

export default router;