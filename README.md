# SayMe

SayMe is an automated lead generation and cold outreach platform. It streamlines the outbound sales process by handling everything from finding prospects to sending AI-personalized emails and tracking responses.

## Core Workflow

1. **Lead Sourcing**: Users input criteria, and the system searches for relevant businesses or contacts.
2. **Verification**: The system verifies contact information (e.g., email addresses) to reduce bounce rates.
3. **AI Drafting**: Leveraging Gemini, SayMe drafts highly personalized cold emails based on the prospect's background.
4. **Review/Send**: Users can review drafts and schedule them for sending, which queues them up in the system.
5. **Tracking**: The platform tracks sent emails, follow-ups, and replies (via Microsoft/Google Graph integrations).

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org) (App Router) / React
- **Styling**: Tailwind CSS
- **Database**: MongoDB (accessed via Mongoose)
- **Authentication**: NextAuth.js
- **Queue/Cache**: Upstash Redis
- **AI/LLM**: Google Gemini
- **Email Providers**: Integration with Google Workspace (Gmail) & Microsoft Graph (Outlook), plus Resend as a fallback or transactional sender.

---

## Environment Variables

To run the application, create a `.env.local` file in the root directory. Below is the list of required environment variables, what they do, and how to get them.

### Database & Redis
- `MONGODB_URI`: The connection string for your MongoDB database (from MongoDB Atlas).
- `UPSTASH_REDIS_REST_URL`: The REST URL for your Upstash Redis database (from Upstash Console).
- `UPSTASH_REDIS_REST_TOKEN`: The REST token for your Upstash Redis instance (from Upstash Console).

### Authentication & Encryption
- `NEXTAUTH_URL`: The canonical URL of your site (e.g., `http://localhost:3000` for local dev).
- `NEXTAUTH_SECRET`: A random 32+ character string used to encrypt NextAuth session tokens (generate using `openssl rand -base64 32`).
- `TOKEN_ENCRYPTION_KEY`: A 32-character secret key used to symmetrically encrypt sensitive OAuth tokens in the database before saving them.

### OAuth Providers (for User Inboxes)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Used to authenticate users with Google and access their Gmail. (From Google Cloud Console -> APIs & Services -> Credentials).
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`: Used to authenticate users with Microsoft and access Outlook. (From Azure Portal -> App Registrations).

### APIs & Services
- `GEMINI_API_KEY`: Google Gemini API key used for drafting personalized AI emails. (From Google AI Studio).
- `SERPER_API_KEY`: Serper.dev API key used for web search and lead sourcing. (From Serper.dev).
- `RESEND_API_KEY`: Resend API key for sending transactional or fallback emails. (From Resend Dashboard).

### External Cron Security
- `CRON_SECRET`: A secret string used to securely trigger your background cron jobs. (Generate a random string yourself). This must be matched in the external cron service.

---

## Local Setup Instructions

Follow these steps to get the project running locally within minutes.

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd sayme
   ```

2. **Install dependencies:**
   Ensure you have Node.js installed, then run:
   ```bash
   npm install
   # or yarn / pnpm install
   ```

3. **Configure Environment Variables:**
   - Copy `.env.example` to `.env.local` (or create `.env.local` if no example exists).
   - Fill in all the variables listed in the [Environment Variables](#environment-variables) section above.

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment (Vercel)

The easiest way to deploy this Next.js app is on Vercel.

1. Push your code to a GitHub/GitLab repository.
2. Log in to Vercel and import the project.
3. In the Vercel project settings, go to **Environment Variables** and add *all* the variables listed above. (Make sure `NEXTAUTH_URL` reflects your production domain).
4. Deploy the project.

### Setting up External Cron Jobs (cron-job.org)

Since the Vercel Hobby tier doesn't support per-minute crons, we use an external service like [cron-job.org](https://cron-job.org/) to trigger our background tasks.

1. Create a free account on cron-job.org.
2. Create a new cron job to process the email queue:
   - **URL**: `https://<your-vercel-domain>.vercel.app/api/cron/process-queue`
   - **Schedule**: Every 1 minute
   - **Advanced > Headers**: Add a custom header with key `x-cron-secret` and value equal to your `CRON_SECRET` environment variable.
3. Create a second cron job to check for replies:
   - **URL**: `https://<your-vercel-domain>.vercel.app/api/cron/check-replies`
   - **Schedule**: Every 1 hour (or as preferred)
   - **Advanced > Headers**: Add the same `x-cron-secret` header as above.

<!-- 
Note: The native Vercel crons have been removed from vercel.json.
If you upgrade to Vercel Pro and want to use Vercel-native crons, 
you can add the following configuration to a vercel.json file:

{
  "crons": [
    {
      "path": "/api/cron/process-queue",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/check-replies",
      "schedule": "0 * * * *"
    }
  ]
}
-->

---

## Known Limitations & Handoff Notes

If you are acquiring or taking over this project, please be aware of the following current limitations:

- **No Billing Integration Yet**: There is currently no Stripe, Paddle, or equivalent payment processor integrated. To monetize, you will need to build the billing layer and gate access based on subscription tiers.
- **Missing Auth Flows**: The standard "Forgot Password" and "Email Verification" flows are not yet implemented.
- **Unverified OAuth Apps**: The Google and Microsoft OAuth applications used for connecting inboxes are currently in "Testing" mode. This means that to allow someone to connect their inbox, you must manually add their email address as a "Test User" in the Google Cloud Console or Azure Portal. Before launching publicly, you will need to go through the official app verification process with Google and Microsoft.

---

## Architecture Overview

- **Lead Sourcing**: Users input search terms. The app queries external APIs (like Serper.dev) to scrape and structure business data, populating the `Leads` collection in MongoDB.
- **Quota / Usage System**: Every user action (sourcing, AI generation) is gated by a quota system. Upstash Redis handles rate limiting and fast lookups to ensure users don't exceed their limits.
- **Email Queue / Cron**: 
  - Scheduled emails are pushed to an Upstash Redis queue (or tracked via MongoDB `sendAt` fields).
  - An external cron continuously pings `/api/cron/process-queue`, which picks off the next batch of emails, generates any required AI follow-ups, sends them via the user's connected OAuth token, and records the success.
- **Admin Panel**: An internal dashboard (typically gated by admin user roles) used for managing global users, reviewing system logs, and overriding quotas.
