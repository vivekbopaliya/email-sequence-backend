import nodemailer from 'nodemailer';
import Agenda, { Job } from 'agenda';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const agenda = new Agenda({ db: { address: process.env.DATABASE_URL! } });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT!),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

agenda.define('send email', async (job: Job) => {
  const { email, subject, body, scheduleId } = job.attrs.data;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject,
      html: body,
    });

    await prisma.emailSchedule.update({
      where: { id: scheduleId },
      data: { sent: true },
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
});

export const scheduleEmail = async (
  email: string,
  subject: string,
  body: string,
  sendAt: Date
) => {
  console.log("this is called")
  const schedule = await prisma.emailSchedule.create({
    data: {
      email,
      subject,
      body,
      sendAt,
    },
  });

 const data =  await agenda.schedule(sendAt, 'send email', {
    email,
    subject,
    body,
    scheduleId: schedule.id,
  });

  console.log("job: ", data)

  return schedule;
};

agenda.start();