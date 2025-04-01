import { z } from 'zod';

export const WorkflowSchema = z.object({
  name: z.string(),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
});

export const EmailScheduleSchema = z.object({
  email: z.string().email(),
  subject: z.string(),
  body: z.string(),
  sendAt: z.string().datetime(),
});

export type Flow = z.infer<typeof WorkflowSchema>;
export type EmailSchedule = z.infer<typeof EmailScheduleSchema>;