// File: controllers/email-template-controller.ts
import { Request, Response } from 'express';
import { db } from '../lib/db';
import { z } from 'zod';

const EmailTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
});

// Create Email Template
export const createEmailTemplate = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = EmailTemplateSchema.parse(req.body);
    const template = await db.emailTemplate.create({
      data: {
        ...validatedData,
        userId: req.user.id,
      },
    });
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating email template:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid template data', errors: error.errors });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get All Email Templates
export const getEmailTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await db.emailTemplate.findMany({
      where: { userId: req.user.id },
    });
    res.json(templates);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Update Email Template
export const updateEmailTemplate = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const validatedData = EmailTemplateSchema.parse(req.body);

    const template = await db.emailTemplate.update({
      where: { 
        id,
        userId: req.user.id, // Ensure user can only update their own templates
      },
      data: validatedData,
    });
    res.json(template);
  } catch (error) {
    console.error('Error updating email template:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid template data', errors: error.errors });
    }
    if (error instanceof Error && error.name === 'NotFoundError') {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Delete Email Template
export const deleteEmailTemplate = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    await db.emailTemplate.delete({
      where: { 
        id,
        userId: req.user.id, // Ensure user can only delete their own templates
      },
    });
    res.status(200).json({message:"Email template deleted successfully"})
  } catch (error) {
    console.error('Error deleting email template:', error);
    if (error instanceof Error && error.name === 'NotFoundError') {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};