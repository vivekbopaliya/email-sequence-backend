import nodemailer from 'nodemailer';
import Agenda, { Job } from 'agenda';
import { db } from '../lib/db';
import { ObjectId } from 'mongodb';

// Set up Agenda for scheduling
const agenda = new Agenda({ db: { address: process.env.DATABASE_URL! } });

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  port: parseInt(process.env.SMTP_PORT!), 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Define email sending job
agenda.define('send email', async (job: Job) => {
  const { currentUserEmail, recipientUserEmail, subject, body, flowId } = job.attrs.data;

  try {
    console.log(`Sending email from ${currentUserEmail} to ${recipientUserEmail} for flow ${flowId}...`);
    await transporter.sendMail({
      from: currentUserEmail,
      to: recipientUserEmail,
      subject,
      html: body,
    });
    console.log(`Email sent successfully to ${recipientUserEmail}!`);

    const pendingEmails = await db.scheduledEmail.count({
      where: {
        flowId,
        sendAt: { gt: new Date() },
      },
    });

    if (pendingEmails === 0) {
      await db.flow.update({
        where: { id: flowId },
        data: { status: 'COMPLETED' },
      });
      console.log(`Flow ${flowId} completed, no pending emails.`);
    }
  } catch (error) {
    console.error('Failed to send email:', error);
  }
});

export const scheduleEmail = async (
  currentUserEmail: string,
  recipientUserEmail: string,
  subject: string,
  body: string,
  sendAt: Date,
  flowId: string
): Promise<string> => {
  const job = await agenda.schedule(sendAt, 'send email', {
    currentUserEmail,
    recipientUserEmail,
    subject,
    body,
    flowId,
  });

  if (!job.attrs._id) {
    throw new Error('Error while scheduling job.');
  }

  const flow = await db.flow.findUnique({ where: { id: flowId } });

  if (flow && flow.status !== 'RUNNING') {
    await db.flow.update({
      where: { id: flowId },
      data: { status: 'RUNNING' },
    });
    console.log(`Flow ${flowId} status set to RUNNING!`);
  }

  return job.attrs._id.toString();
};

export const scheduleEmailsForWorkflow = async (
  nodes: any[],
  edges: any[],
  userEmail: string,
  flowId: string
): Promise<void> => {
  const leadSourceNodes = nodes.filter((node) => node.type === 'leadSource');
  const emailNodes = nodes.filter((node) => node.type === 'coldEmail');

  for (const leadSourceNode of leadSourceNodes) {
    const leadSourceId = leadSourceNode.data.leadSourceId;
    const leadSource = await db.leadSource.findUnique({
      where: { id: leadSourceId },
      select: { contacts: true },
    });

    if (!leadSource || !leadSource.contacts) {
      console.warn(`Lead source ${leadSourceId} not found or has no contacts`);
      continue;
    }

    const contacts = leadSource.contacts as { name: string; email: string }[];

    for (const contact of contacts) {
      const recipientEmail = contact.email;
      for (const emailNode of emailNodes) {
        const emailTemplateId = emailNode.data.emailTemplateId;
        const emailTemplate = await db.emailTemplate.findUnique({
          where: { id: emailTemplateId },
          select: { subject: true, body: true },
        });

        if (!emailTemplate) {
          console.warn(`Email template ${emailTemplateId} not found`);
          continue;
        }

        let totalDelayMs = 0;
        const pathToEmail = [];
        let currentSource = leadSourceNode.id;

        while (true) {
          const nextEdge = edges.find((edge) => edge.source === currentSource);
          if (!nextEdge) break;

          const nextNode = nodes.find((node) => node.id === nextEdge.target);
          if (!nextNode) break;

          if (nextNode.type === 'wait') {
            const delay = nextNode.data.delay || { days: 0, hours: 0, minutes: 0 };
            const delayMs =
              (parseInt(delay.days) || 0) * 24 * 60 * 60 * 1000 +
              (parseInt(delay.hours) || 0) * 60 * 60 * 1000 +
              (parseInt(delay.minutes) || 0) * 60 * 1000;
            totalDelayMs += delayMs;
            pathToEmail.push(nextNode);
          } else if (nextNode.id === emailNode.id) {
            pathToEmail.push(nextNode);
            break;
          }
          currentSource = nextNode.id;
        }

        if (pathToEmail.some((node) => node.id === emailNode.id)) {
          const sendAt = new Date(Date.now() + totalDelayMs);
          console.log(`Scheduling email for ${recipientEmail} at ${sendAt}...`);

          const jobId = await scheduleEmail(
            userEmail,
            recipientEmail,
            emailTemplate.subject,
            emailTemplate.body,
            sendAt,
            flowId
          );

          await db.scheduledEmail.create({
            data: {
              flowId,
              jobId,
              sendAt,
            },
          });
          console.log(`Email job ${jobId} scheduled for ${recipientEmail}!`);
        }
      }
    }
  }
};

export const cancelScheduledEmails = async (flowId: string): Promise<void> => {
  const scheduledEmails = await db.scheduledEmail.findMany({
    where: { flowId },
  });

  for (const scheduledEmail of scheduledEmails) {
    const data = await agenda.cancel({
      _id: new ObjectId(scheduledEmail.jobId),
    });
    if (data === 0) {
      throw new Error(`Error while cancelling job ID: ${scheduledEmail.id}`);
    }
    console.log(`Canceled job ${scheduledEmail.jobId} for flow ${flowId}!`);
    await db.scheduledEmail.delete({
      where: { id: scheduledEmail.id },
    });
  }
  console.log(`All emails canceled for flow ${flowId}!`);
};

// Start the scheduler
agenda.start();