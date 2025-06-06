import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth-route';
import workflowRoutes from './routes/workflow-route';
import emailTemplateRoutes from './routes/email-template-route';
import leadSourceRoutes from './routes/lead-source-route';



dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true, // For cookies
}));

app.use(express.json()); // Parse JSON bodies
app.use(cookieParser()); // Parse cookies

app.use('/auth', authRoutes);
app.use('/workflow', workflowRoutes);
app.use('/email-template', emailTemplateRoutes);
app.use('/lead-source', leadSourceRoutes);



const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// For auth middleware
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}