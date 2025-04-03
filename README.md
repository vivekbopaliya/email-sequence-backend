
# Email Sequence Flows Automation Backend

Frontend Repository: https://github.com/vivekbopaliya/email-sequence-frontend

## Overview
This backend service powers an automated email sequence system that lets users visually design, schedule, and manage email workflows using a drag-and-drop interface. It handles everything from creating workflows to scheduling and sending emails at the right times.

## Technologies Used
- Node.js and Express for the API
- Prisma for database operations
- Agenda.js for job scheduling
- Nodemailer for sending emails
- Zod for data validation

## Database Models

### User Model
```
- id: ObjectId (primary key)
- email: String (unique)
- password: String (hashed)
- createdAt: DateTime
- updatedAt: DateTime
- flows: Relation to Flow[]
```

### Flow Model
```
- id: ObjectId (primary key)
- name: String
- nodes: Json (store ReactFlow nodes)
- edges: Json (store ReactFlow edges)
- userId: ObjectId (foreign key to User)
- status: String (PENDING, RUNNING, COMPLETED)
- createdAt: DateTime
- updatedAt: DateTime
- scheduledEmails: Relation to ScheduledEmail[]
```

### ScheduledEmail Model
```
- id: ObjectId (primary key)
- flowId: ObjectId (foreign key to Flow)
- jobId: String (Agenda.js job ID)
- sendAt: DateTime
- createdAt: DateTime
```

### LeadSource Model
```
- id: String (primary key, UUID)
- name: String
- contacts: Json (array of { name: String, email: String })
- userId: String (foreign key to User)
- createdAt: DateTime
- updatedAt: DateTime
```

### EmailTemplate Model
```
- id: String (primary key, UUID)
- name: String
- subject: String
- body: String
- userId: String (foreign key to User)
- createdAt: DateTime
- updatedAt: DateTime
```

## API Routes

### Authentication Routes
- `POST /auth/register` - Create a new user account
- `POST /auth/login` - Log in and receive an authentication token
- `GET /auth/me` - Get current authenticated user

### Workflow Routes
- `POST /workflow/save` - Save a workflow without starting it
- `POST /workflow/save-and-start` - Save and immediately start a workflow
- `GET /workflow/getAll` - Retrieve all workflows for the current user
- `GET /workflow/get/:id` - Get details of a specific workflow
- `PATCH /workflow/update/:id` - Update a workflow without restarting it
- `PATCH /workflow/update-and-start/:id` - Update and restart a workflow
- `POST /workflow/start-scheduler/:id` - Start a previously saved workflow
- `POST /workflow/stop-scheduler/:id` - Stop a running workflow and cancel pending emails
- `DELETE /workflow/delete/:id` - Delete a workflow and cancel all associated emails

### Lead Source Routes
- `POST /lead-source/create` - Create a new lead source
- `GET /lead-source/getAll` - Retrieve all lead sources for the current user
- `PUT /lead-source/update/:id` - Update a lead source
- `DELETE /lead-source/delete/:id` - Delete a lead source

### Email Template Routes
- `POST /email-template/create` - Create a new email template
- `GET /email-template/getAll` - Retrieve all email templates for the current user
- `PUT /email-template/update/:id` - Update an email template
- `DELETE /email-template/delete/:id` - Delete an email template

# Required Environment Variables
```
DATABASE_URL=your-mongodb-url
JWT_SECRET=your-secure-jwt-secret
SMTP_HOST="smtp.gmail.com"
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_PORT=465
```
- Ensure your Gmail account has 2FA enabled before creating an app password for SMTP authentication
- Don’t know how to create an app password? Follow [this tutorial](https://bestsoftware.medium.com/how-to-create-an-app-password-on-gmail-e00eff3af4e0).

## Running the Application

### Before You Start
- Make sure you have [Bun](https://bun.sh/) installed on your computer
- You'll need to set up the frontend from [this link](https://github.com/vivekbopaliya/email-sequence-frontend)

```bash
# Install dependencies
bun install

# Generate Prisma client
bunx prisma generate

# Push Prisma models to Database
bunx prisma db push

# Start development server
bun run dev

# Start production server
bun start
```

### Things to Make Sure
- Both the frontend (website) and backend (server) need to be running simultaneously for the application to work properly.
- Verify that MongoDB is running and accessible via the provided `DATABASE_URL`.

# How Things Work Exactly?

### Node Types
The system processes three types of nodes from the ReactFlow frontend:

#### 1. Lead Source Node
References a lead source by ID, which contains a list of email recipients:
```javascript
{
    id: "node1",
    type: "leadSource",
    data: {
        leadSourceId: "uuid-of-lead-source"
    }
}
```
- The backend fetches the lead source data (including contacts) using `leadSourceId`.

#### 2. Wait/Delay Node
Specifies how long to wait between emails:
```javascript
{
    id: "node2",
    type: "wait",
    data: {
        delay: {
            days: 1,
            hours: 2,
            minutes: 30
        }
    }
}
```

#### 3. Email Node
References an email template by ID, which contains the email content:
```javascript
{
    id: "node3",
    type: "coldEmail",
    data: {
        emailTemplateId: "uuid-of-email-template"
    }
}
```
- The backend fetches the email template data (subject and body) using `emailTemplateId`.

## How Email Scheduling Works?

When a workflow is started:

1. The system looks for all **Lead Source nodes** and retrieves the associated `LeadSource` data (including contacts) from the database using `leadSourceId`.
2. For each contact in the retrieved lead sources, it finds all paths to **Email nodes**.
3. For each email node, it retrieves the `EmailTemplate` data (subject and body) from the database using `emailTemplateId`.
4. For each path, it calculates the total delay by adding up all **Wait nodes** along the path.
5. It schedules each email using Agenda.js with the calculated delay, using the fetched subject and body from the email template.
6. The system records each scheduled email in the database and links it to the workflow.
7. The workflow status is updated to "RUNNING".

When all emails are sent, the workflow status changes to "COMPLETED". If a workflow is stopped manually, all pending emails are canceled.

## The Email Scheduling Process (Step by Step)

1. **Workflow Creation**:
   - User designs a workflow in the frontend by connecting Lead Source → Wait → Email nodes.
   - The frontend sends this data to the backend as JSON, with only `leadSourceId` and `emailTemplateId` in the node data.

2. **Validation**:
   - Backend fetches `LeadSource` data by `leadSourceId` and checks that it has contacts with valid email addresses.
   - Fetches `EmailTemplate` data by `emailTemplateId` and verifies it has a subject and body.

3. **Path Finding**:
   - For each contact in each retrieved `LeadSource`, the system traces all possible paths through the workflow that lead to `Email` nodes.
   - It calculates the total delay time by summing all `Wait` nodes in each path.

4. **Email Scheduling**:
   - For each valid path, the system:
     - Retrieves the `EmailTemplate` data using `emailTemplateId`.
     - Calculates when the email should be sent (current time + total delay).
     - Creates a job in Agenda.js to send the email at that time with the fetched subject and body.
     - Stores the job ID in the `ScheduledEmail` table.

5. **Email Sending**:
   - When the scheduled time arrives, Agenda.js runs the job.
   - The system sends the email using Nodemailer.
   - After sending, it checks if there are any remaining emails in the workflow.
   - If no emails remain, it updates the workflow status to "COMPLETED".

6. **Workflow Management**:
   - Users can view all their workflows and their current status.
   - They can stop a running workflow (cancels all pending emails).
   - They can update a workflow (if running, it cancels existing emails and reschedules with updated data).
   - They can delete a workflow (also removes all scheduled emails).

## Example Flow Execution

Imagine a workflow with:
- **Lead Source Node**: Contains `leadSourceId` referencing a lead source with 2 contacts (`alice@example.com`, `bob@example.com`).
- **Wait Node**: Set to 2 days delay.
- **Email Node**: Contains `emailTemplateId` referencing a template with a follow-up message.

When the workflow starts:
1. System fetches the `LeadSource` by `leadSourceId` and finds 2 contacts.
2. Fetches the `EmailTemplate` by `emailTemplateId` to get the subject and body.
3. For each contact, it calculates:
   - Send time = current time + 2 days.
4. It schedules 2 emails (one for each contact) to be sent in 2 days using the template’s subject and body.
5. These scheduled emails are recorded in the database.
6. The workflow status is set to "RUNNING".
7. After 2 days, emails are sent automatically.
8. After the last email sends, workflow status changes to "COMPLETED".
