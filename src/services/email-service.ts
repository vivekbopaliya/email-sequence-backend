import nodemailer from 'nodemailer';
import Agenda, { Job } from 'agenda';
import { db } from '../lib/db';

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
  
  const { email, subject, body } = job.attrs.data;

  try {
    transporter.sendMail({
      to: email,
      subject,
      html: body    
    }, (error, emailResponse) => {
      if(error) throw error;
      console.log('success')
      console.log(emailResponse)
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

 await agenda.schedule(sendAt, 'send email', {
    email,
    subject,
    body,
  });


};

agenda.start();