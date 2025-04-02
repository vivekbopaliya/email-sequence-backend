import { Router } from 'express';
import { register, login, logout } from '../controllers/auth-controller';

const router = Router();

// User signup
router.post('/register', register);
// User login
router.post('/login', login);
// User logout
router.post('/logout', logout);

export default router;