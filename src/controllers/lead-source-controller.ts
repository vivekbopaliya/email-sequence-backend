import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';

const LeadSourceSchema = z.object({
  name: z.string().min(1, 'Lead source name is required'),
  contacts: z.array(z.object({
    name: z.string().min(1, 'Contact name is required'),
    email: z.string().email('Invalid email address'),
  })).min(1, 'At least one contact is required'),
});

// Create Lead Source
export const createLeadSource = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = LeadSourceSchema.parse(req.body);
    const leadSource = await db.leadSource.create({
      data: {
        ...validatedData,
        userId: req.user.id,
      },
    });
    res.status(201).json(leadSource);
  } catch (error) {
    console.error('Error creating lead source:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid lead source data', errors: error.errors });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get All Lead Sources
export const getLeadSources = async (req: Request, res: Response) => {
  try {
    const leadSources = await db.leadSource.findMany({
      where: { userId: req.user.id },
    });
    res.json(leadSources);
  } catch (error) {
    console.error('Error fetching lead sources:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Update Lead Source
export const updateLeadSource = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const validatedData = LeadSourceSchema.parse(req.body);

    const leadSource = await db.leadSource.update({
      where: { 
        id,
        userId: req.user.id,
      },
      data: validatedData,
    });
    res.json(leadSource);
  } catch (error) {
    console.error('Error updating lead source:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid lead source data', errors: error.errors });
    }
    if (error instanceof Error && error.name === 'NotFoundError') {
      return res.status(404).json({ message: 'Lead source not found' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Delete Lead Source
export const deleteLeadSource = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    await db.leadSource.delete({
      where: { 
        id,
        userId: req.user.id,
      },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting lead source:', error);
    if (error instanceof Error && error.name === 'NotFoundError') {
      return res.status(404).json({ message: 'Lead source not found' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};