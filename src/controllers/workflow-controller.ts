import { NextFunction, Request, Response } from 'express';
import { WorkflowSchema } from '../types/workflow-type';
import { cancelScheduledEmails } from '../services/email-service';
import { ZodError } from 'zod';
import { db } from '../lib/db';
import { Node } from 'reactflow';
import { traverseWorkflowAndScheduleEmails , validateWorkflowData } from '../lib/utils';

// Save workflow
export const saveWorkflow = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = WorkflowSchema.parse(req.body);
    const validationError = await validateWorkflowData(validatedData.nodes);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const flow = await db.flow.create({
      data: {
        ...validatedData,
        userId: req.user.id,
      },
    });

    res.status(201).json(flow);
  } catch (error) {
    console.error('Error saving workflow: ', error);
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Please provide valid data.' });
    }
    res.status(500).json({ message: 'Internal Server Error.' });
  }
};

// Save workflow & Start Schuduler
export const saveAndStartWorkflow = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = WorkflowSchema.parse(req.body);
    const validationError = await validateWorkflowData(validatedData.nodes);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const flow = await db.flow.create({
      data: {
        ...validatedData,
        userId: req.user.id,
      },
    });

    await traverseWorkflowAndScheduleEmails (validatedData.nodes as any[], validatedData.edges as any[], req.user.email, flow.id);

    res.status(201).json(flow);
  } catch (error) {
    console.error('Error saving and starting workflow: ', error);
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Please provide valid data.' });
    }
    res.status(500).json({ message: 'Internal Server Error.' });
  }
};

// Get all workflows
export const getAllWorkflows = async (req: Request, res: Response): Promise<any> => {
  try {
    const flows = await db.flow.findMany({
      where: { userId: req.user.id },
    });
    res.json(flows);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server error' });
  }
};

// Get one workflow
export const getOneWorkflow = async (req: Request, res: Response): Promise<any> => {
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


// Update workflow
export const updateWorkflow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;
    const validatedData = WorkflowSchema.parse(req.body);

    const validationError = await validateWorkflowData(validatedData.nodes);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

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

    const updatedFlow = await db.flow.update({
      where: { id },
      data: validatedData,
    });

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

// Update workflow & Start Scheduler
export const updateAndStartWorkflow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;
    const validatedData = WorkflowSchema.parse(req.body);

    const validationError =await validateWorkflowData(validatedData.nodes);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

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

    // Cancel any existing scheduled emails
    await cancelScheduledEmails(id);

    const updatedFlow = await db.flow.update({
      where: { id },
      data: validatedData,
    });

    // Start scheduling new emails
    await traverseWorkflowAndScheduleEmails (validatedData.nodes as any[], validatedData.edges as any[], req.user.email, id);

    res.status(200).json(updatedFlow);
  } catch (error) {
    console.error('Error updating and starting workflow:', error);
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: 'Please provide valid data.',
        errors: error.errors,
      });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Start Scheduler
export const startScheduler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;

    const flow = await db.flow.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!flow) {
      return res.status(404).json({
        message: 'Workflow not found or you do not have permission to start it',
      });
    }

    const validationError = await validateWorkflowData(flow.nodes as unknown as Node[]);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    // Stop scheduled emails if they are running
    await cancelScheduledEmails(id);

    // Reschedule them
    await traverseWorkflowAndScheduleEmails (flow.nodes as any[], flow.edges as any[], req.user.email, id);

    res.status(200).json({ message: 'Scheduler started successfully.' });
  } catch (error) {
    console.error('Error while starting the scheduler:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Stop Scheduler
export const stopSchduler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;

    const flow = await db.flow.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!flow) {
      return res.status(404).json({
        message: 'Workflow not found or you do not have permission to start it',
      });
    }

    // Stop scheduled emails and set status
    await cancelScheduledEmails(id);

    await db.flow.update({
      where: { id },
      data: {
        status: 'PENDING',
      },
    });

    res.status(200).json({ message: 'Scheduler stopped successfully.' });
  } catch (error) {
    console.error('Error while stopping the scheduler:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Delete workflow
export const deleteWorkflow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
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