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

// Create template
router.post('/create', createEmailTemplate);
// Get all the templates
router.get('/getAll', getEmailTemplates);
// Update template
router.put('/update/:id', updateEmailTemplate);
// Delete template
router.delete('/delete/:id', deleteEmailTemplate);

export default router;