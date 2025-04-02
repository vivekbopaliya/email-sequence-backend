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


# Required environment variables
```
DATABASE_URL=your-mongodb-url
JWT_SECRET=your-secure-jwt-secret
SMTP_HOST="smtp.gmail.com"
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_PORT=465
```
- Ensure your Gmail account has 2FA enabled before creating an app password for SMTP authentication

- Don't know how to create an app password? Follow [this tutorial.](https://bestsoftware.medium.com/how-to-create-an-app-password-on-gmail-e00eff3af4e0)




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

-  Both the frontend (website) and backend (server) need to be running simultaneously for the application to work properly.

- Verify that MongoDB is running and accessible via the provided DATABASE_URL


# How Things Work Exactly?

### Node Types
The system processes three types of nodes from the ReactFlow frontend:

#### 1. Lead Source Node
Contains a list of email recipients:
```javascript
{
    id: "node1",
    type: "leadSource",
    data: {
        name: "New Leads",
        contacts: ["john@example.com", "jane@example.com"]
    }
}
```

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
Contains the actual email content:
```javascript
{
    id: "node3",
    type: "coldEmail",
    data: {
        subject: "Follow-up on our conversation",
        body: "<p>Hi there,</p><p>Just checking in...</p>"
    }
}
```

## How Email Scheduling Works?

When a workflow is started:

1. The system looks for all **Lead Source nodes** to get the list of recipients
2. For each recipient, it finds all paths to **Email nodes**
3. For each path, it calculates the total delay by adding up all **Wait nodes** along the path
4. It schedules each email using Agenda.js with the calculated delay
5. The system records each scheduled email in the database and links it to the workflow
6. The workflow status is updated to "RUNNING"

When all emails are sent, the workflow status changes to "COMPLETED". If a workflow is stopped manually, all pending emails are canceled.

## The Email Scheduling Process (Step by Step)

1. **Workflow Creation**:
   - User designs a workflow in the frontend by connecting Lead Source → Wait → Email nodes
   - The frontend sends this data to the backend as JSON

2. **Validation**:
   - Backend checks that Lead Source nodes have contacts
   - Verifies Email nodes have subject and body content

3. **Path Finding**:
   - For each contact in each Lead Source node
   - The system traces all possible paths through the workflow that lead to Email nodes
   - It calculates the total delay time by summing all Wait nodes in each path

4. **Email Scheduling**:
   - For each valid path, the system:
     - Calculates when the email should be sent (current time + total delay)
     - Creates a job in Agenda.js to send the email at that time
     - Stores the job ID in the ScheduledEmail table

5. **Email Sending**:
   - When the scheduled time arrives, Agenda.js runs the job
   - The system sends the email using Nodemailer
   - After sending, it checks if there are any remaining emails in the workflow
   - If no emails remain, it updates the workflow status to "COMPLETED"

6. **Workflow Management**:
   - Users can view all their workflows and their current status
   - They can stop a running workflow (cancels all pending emails)
   - They can update a workflow (if running, it cancels existing emails and reschedules)
   - They can delete a workflow (also removes all scheduled emails)

## Example Flow Execution

Imagine a workflow with:
- **Lead Source**: Contains 2 contacts (alice@example.com, bob@example.com)
- **Wait Node**: Set to 2 days delay
- **Email Node**: Contains a follow-up message

When the workflow starts:
1. System finds 2 contacts in the Lead Source
2. For each contact, it calculates:
   - Send time = current time + 2 days
3. It schedules 2 emails (one for each contact) to be sent in 2 days
4. These scheduled emails are recorded in the database
5. The workflow status is set to "RUNNING"
6. After 2 days, emails are sent automatically
7. After the last email sends, workflow status changes to "COMPLETED"



