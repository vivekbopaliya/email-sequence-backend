import { NextFunction, Request, Response } from 'express';
import { WorkflowSchema } from '../types/workflow-type';
import { cancelScheduledEmails,  scheduleEmailsForWorkflow } from '../services/email-service';
import { ZodError } from 'zod';
import { db } from '../lib/db';

export const createWorkflow = async (
  req: Request & { user: { id: string; email: string } },
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedData = WorkflowSchema.parse(req.body);

    const flow = await db.flow.create({
      data: {
        ...validatedData,
        userId: req.user.id,
      },
    });

    await scheduleEmailsForWorkflow(
      validatedData.nodes as any[],
      validatedData.edges as any[],
      req.user.email,
      flow.id
    );

    res.status(201).json(flow);
  } catch (error) {
    console.error('Error creating workflow: ', error);
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Please provide valid data.' });
    }
    res.status(500).json({ message: 'Internal Server Error.' });
  }
};
export const getAllWorkflows = async (req: Request & {
  user: { id: string }
}, res: Response) => {
  try {
    const flows = await db.flow.findMany({
      where: { userId: req.user.id },
    });
    res.json(flows);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server error' });
  }
};

export const getOneWorkflow = async (req: Request & {
  user: { id: string }
}, res: Response) => {
  try {
    const flow = await db.flow.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!flow) {
      return res.status(404).json({ message: 'Flow not found' });
    }

    res.json(flow);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server error' });
  }
};

export const updateWorkflow = async (
  req: Request & { user: { id: string; email: string } },
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const validatedData = WorkflowSchema.parse(req.body);

    const existingFlow = await db.flow.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!existingFlow) {
      return res.status(404).json({
        message: 'Workflow not found or you do not have permission to update it',
      });
    }

    // Cancel existing scheduled emails
    await cancelScheduledEmails(id);

    // Update the workflow
    const updatedFlow = await db.flow.update({
      where: { id },
      data: validatedData,
    });

    // Reschedule emails
    await scheduleEmailsForWorkflow(
      validatedData.nodes as any[],
      validatedData.edges as any[],
      req.user.email,
      id
    );

    res.status(200).json(updatedFlow);
  } catch (error) {
    console.error('Error updating workflow:', error);
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: 'Please provide valid data.',
        errors: error.errors,
      });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


export const deleteWorkflow = async (
  req: Request & { user: { id: string } },
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const existingFlow = await db.flow.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!existingFlow) {
      return res.status(404).json({
        message: 'Workflow not found or you do not have permission to delete it',
      });
    }

    await cancelScheduledEmails(id);

    await db.flow.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Workflow deleted successfully' });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};