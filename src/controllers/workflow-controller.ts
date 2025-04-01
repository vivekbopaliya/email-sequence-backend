import { NextFunction, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WorkflowSchema } from '../types/workflow-type';
import { scheduleEmail } from '../services/email-service';

const prisma = new PrismaClient();

export const createWorkflow = async (req: Request & {
  user: { id: string }
}, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = WorkflowSchema.parse(req.body);
    
    const flow = await prisma.flow.create({
      data: {
        ...validatedData,
        userId: req.user.id,
      },
    });

    const nodes = validatedData.nodes as any[];
    const emailNodes = nodes.filter(node => node.type === 'emailNode');
    const delayNodes = nodes.filter(node => node.type === 'delayNode');

    for (const emailNode of emailNodes) {
      const connectedDelay = delayNodes.find(delay => 
        validatedData.edges.some((edge: any) => 
        edge.source === delay.id && edge.target === emailNode.id
        )
      );

      const delay = connectedDelay ? parseInt(connectedDelay.data.delay) : 0;
      const sendAt = new Date(Date.now() + delay * 60 * 60 * 1000);

      console.log("sent at", sendAt)
      await scheduleEmail(
        emailNode.data.email,
        emailNode.data.subject,
        emailNode.data.body,
        sendAt
      );
    }

    res.status(201).json(flow);
  } catch (error) {
    res.status(400).json({ message: 'Invalid input data' });
  }
};

export const getAllWorkflows = async (req: Request & {
  user: { id: string }
}, res: Response) => {
  try {
    const flows = await prisma.flow.findMany({
      where: { userId: req.user.id },
    });
    res.json(flows);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getOneWorkflow = async (req: Request & {
  user: { id: string }
}, res: Response) => {
  try {
    const flow = await prisma.flow.findFirst({
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
    res.status(500).json({ message: 'Server error' });
  }
};