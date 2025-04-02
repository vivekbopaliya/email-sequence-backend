import nodemailer from 'nodemailer';
import Agenda, { Job } from 'agenda';
import { db } from '../lib/db';
import { ObjectId } from 'mongodb';

const agenda = new Agenda({ db: { address: process.env.DATABASE_URL! } });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  port: parseInt(process.env.SMTP_PORT!),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

agenda.define('send email', async (job: Job) => {
  const { currentUserEmail, recipientUserEmail, subject, body, flowId } = job.attrs.data;

  try {
    await transporter.sendMail({
      from: currentUserEmail,
      to: recipientUserEmail,
      subject,
      html: body,
    });
    console.log('Email sent successfully');

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
    console.log('FLOW RUNNING');
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

  for (const leadSource of leadSourceNodes) {
    const contacts = leadSource.data.contacts || []; // Array of email addresses

    for (const contact of contacts) {
      for (const emailNode of emailNodes) {
        let totalDelayMs = 0;
        const pathToEmail = [];
        let currentSource = leadSource.id;

        // Traverse the path from Lead Source to Cold Email
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
          console.log(`Scheduling email for ${contact} at ${sendAt}`);

          const jobId = await scheduleEmail(
            userEmail,
            contact,
            emailNode.data.subject,
            emailNode.data.body,
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
        }
      }
    }
  }

  const scheduledEmails = await db.scheduledEmail.count({ where: { flowId } });
  if (scheduledEmails === 0) {
    await db.flow.update({
      where: { id: flowId },
      data: { status: 'COMPLETED' },
    });
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
    console.log(`${scheduledEmail.id} job cancelled!`);
    await db.scheduledEmail.delete({
      where: { id: scheduledEmail.id },
    });
  }

  const remainingEmails = await db.scheduledEmail.count({ where: { flowId } });
  if (remainingEmails === 0) {
    await db.flow.update({
      where: { id: flowId },
      data: { status: 'COMPLETED' },
    });
  }
};

agenda.start();