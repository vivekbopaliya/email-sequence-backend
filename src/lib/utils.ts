import { Node } from "reactflow";
import { db } from "./db";
import { scheduleEmail } from "../services/email-service";


export const validateWorkflowData = async (nodes: Node[]): Promise<string | null> => {
    const leadSourceNodes = nodes.filter((node) => node.type === 'leadSource');
    const coldEmailNodes = nodes.filter((node) => node.type === 'coldEmail');
  
    if(!leadSourceNodes || leadSourceNodes.length === 0) {
      return 'At least one Lead Source node is required.';
    }
    if(!coldEmailNodes || coldEmailNodes.length === 0) {
      return 'At least one Cold Email node is required.';
    }
    // Validate lead source nodes
    for (const node of leadSourceNodes) {
      const leadSourceId = node.data.leadSourceId;
      if (!leadSourceId) {
        return 'All Lead Source nodes must have a selected lead source.';
      }
  
      const leadSource = await db.leadSource.findUnique({
        where: { id: leadSourceId },
        select: { contacts: true },
      });
  
      if (!leadSource || !leadSource.contacts ) {
        return 'All Lead Source nodes must have at least one contact with an email address.';
      }
      if ((leadSource.contacts as any[]).some((contact: any) => !contact.email || typeof contact.email !== 'string' || !contact.email.trim())) {
        return 'All contacts in Lead Source nodes must have a valid email address.';
      }
    }
  
    // Validate cold email nodes
    for (const node of coldEmailNodes) {
      const emailTemplateId = node.data.emailTemplateId;
      if (!emailTemplateId) {
        return 'All Cold Email nodes must have a selected email template.';
      }
  
      const emailTemplate = await db.emailTemplate.findUnique({
        where: { id: emailTemplateId },
        select: { subject: true, body: true },
      });
  
      if (!emailTemplate || !emailTemplate.subject?.trim() || !emailTemplate.body?.trim()) {
        return 'All Cold Email nodes must have a valid email template with a subject and body.';
      }
    }
  
    return null;
  };


  
  
export const traverseWorkflowAndScheduleEmails  = async (
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
  
 