import { NextFunction, Request, Response } from 'express';
import { WorkflowSchema } from '../types/workflow-type';
import { cancelScheduledEmails, scheduleEmailsForWorkflow } from '../services/email-service';
import { ZodError } from 'zod';
import { db } from '../lib/db';
import { Node } from 'reactflow';

const validateWorkflowData = (nodes: Node[]): string | null => {
  const leadSourceNodes = nodes.filter((node) => node.type === 'leadSource');
  const coldEmailNodes = nodes.filter((node) => node.type === 'coldEmail');

  // Check if any Lead Source has no contacts
  if (leadSourceNodes.some((node) => !node.data.contacts || node.data.contacts.length === 0)) {
    return 'All Lead Source nodes must have at least one email address.';
  }

  // Check if any Cold Email node has empty subject or body
  if (coldEmailNodes.some((node) => !node.data.subject?.trim() || !node.data.body?.trim())) {
    return 'All Cold Email nodes must have a subject and body.';
  }

  return null;
};

export const saveWorkflow = async (
  req: Request & { user: { id: string; email: string } },
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedData = WorkflowSchema.parse(req.body);

    const validationError = validateWorkflowData(validatedData.nodes);
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

export const saveAndStartWorkflow = async (
  req: Request & { user: { id: string; email: string } },
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedData = WorkflowSchema.parse(req.body);

    const validationError = validateWorkflowData(validatedData.nodes);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const flow = await db.flow.create({
      data: {
        ...validatedData,
        userId: req.user.id,
      },
    });

    await scheduleEmailsForWorkflow(validatedData.nodes as any[], validatedData.edges as any[], req.user.email, flow.id);

    res.status(201).json(flow);
  } catch (error) {
    console.error('Error saving and starting workflow: ', error);
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Please provide valid data.' });
    }
    res.status(500).json({ message: 'Internal Server Error.' });
  }
};

export const getAllWorkflows = async (req: Request & { user: { id: string } }, res: Response) => {
  try {
    const flows = await db.flow.findMany({
      where: { userId: req.user.id },
    });
    res.json(flows);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server error' });
  }
};

export const getOneWorkflow = async (req: Request & { user: { id: string } }, res: Response) => {
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

    const validationError = validateWorkflowData(validatedData.nodes);
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

export const updateAndStartWorkflow = async (
  req: Request & { user: { id: string; email: string } },
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const validatedData = WorkflowSchema.parse(req.body);

    const validationError = validateWorkflowData(validatedData.nodes);
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

    await cancelScheduledEmails(id);

    const updatedFlow = await db.flow.update({
      where: { id },
      data: validatedData,
    });

    await scheduleEmailsForWorkflow(validatedData.nodes as any[], validatedData.edges as any[], req.user.email, id);

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

export const startScheduler = async (
  req: Request & { user: { id: string; email: string } },
  res: Response,
  next: NextFunction
) => {
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

    const validationError = validateWorkflowData(flow.nodes as unknown as Node[]);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await cancelScheduledEmails(id);

    await scheduleEmailsForWorkflow(flow.nodes as any[], flow.edges as any[], req.user.email, id);

    res.status(200).json({ message: 'Scheduler started successfully.' });
  } catch (error) {
    console.error('Error while starting the scheduler:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const stopSchduler = async (
  req: Request & { user: { id: string; email: string } },
  res: Response,
  next: NextFunction
) => {
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