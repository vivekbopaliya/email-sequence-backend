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
        // Update flow status to COMPLETED if no pending emails
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
  // Start the job scheduler
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

  // Update flow status to RUNNING if it is not already running
  if (flow && flow.status !== 'RUNNING') {
    await db.flow.update({
      where: { id: flowId },
      data: { status: 'RUNNING' },
    });
    console.log(`Flow ${flowId} status set to RUNNING!`);
  }

  return job.attrs._id.toString();
};


export const cancelScheduledEmails = async (flowId: string): Promise<void> => {
  const scheduledEmails = await db.scheduledEmail.findMany({
    where: { flowId },
  });

  for (const scheduledEmail of scheduledEmails) {
    // Cancel the job in the agenda
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