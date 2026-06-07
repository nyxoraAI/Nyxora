# Google Workspace Integration

Nyxora features an Institutional-Grade integration with Google Workspace, allowing your agent to autonomously interact with your emails, calendar, documents, and spreadsheets. 

This is part of Nyxora's **OS Skills** engine, which runs locally and independently, meaning you have absolute control over your data without relying on any third-party SaaS middleman.

## Available Skills

Once configured, your agent will be able to perform the following actions via natural language:
- **Read Gmail Inbox:** (`read_gmail_inbox`) - Fetches and summarizes your most recent emails.
- **List Calendar Events:** (`list_calendar_events`) - Checks your upcoming Google Calendar schedule.
- **Read Google Docs:** (`read_google_docs`) - Extracts raw text from any Google Document.
- **Read Google Forms:** (`read_google_form_responses`) - Reads the latest responses from your Google Forms surveys/questionnaires.
- **Write to Google Sheets:** (`append_row_to_sheets`) - Appends new rows of data (like expense reports or trade logs) to your Google Spreadsheets.

> [!TIP]
> **Ultimate Synergy:** You can combine Web3 Skills and OS Skills! Try prompting the agent: *"Read the latest presale token email from my Gmail, automatically set a Take Profit limit order on Uniswap, and log the execution result to my Google Sheets."*

---

## Setup Guide

To protect your privacy, you must generate your own private OAuth credentials directly from Google Cloud. 

> [!CAUTION]
> The `google-credentials.json` file you download is **HIGHLY CLASSIFIED**. Never upload it to a public GitHub repository. Anyone with this file can access your personal Google data.

### Step 1: Create a Google Cloud Project

1. Open your browser and visit: [Google Cloud Console](https://console.cloud.google.com/)
2. Log in with your Google account.
3. In the top-left corner, click **Select a Project**.
4. Click **New Project** in the pop-up window.
5. Name your project (e.g., `Nyxora Agent Workspace`) and click **Create**.

### Step 2: Enable the Required APIs

The AI agent needs explicit permission to access each Google service.
1. In the left navigation menu, go to **APIs & Services** ➔ **Library**.
2. Search for and **Enable** each of the following APIs:
   - `Gmail API`
   - `Google Drive API`
   - `Google Calendar API`
   - `Google Docs API`
   - `Google Sheets API`
   - `Google Forms API`

> [!TIP]
> If you only want the agent to focus on Emails and Calendar, you can just enable the `Gmail API` and `Google Calendar API` to minimize security surface area.

### Step 3: Configure the OAuth Consent Screen

Before Google hands over the keys, you must configure the "Login Screen".
1. In the left menu, go to **APIs & Services** ➔ **OAuth consent screen**.
2. Choose **External** and click **Create**.
3. Fill in the required fields:
   - **App name**: `Nyxora AI Agent` (or whatever you prefer).
   - **User support email**: Select your email.
   - **Developer contact information**: Fill in your email.
4. Click **Save and Continue** all the way to the end (you can skip the Scopes and Test users sections for now).
5. **CRITICAL:** On the Summary page, click **PUBLISH APP** to push it to production. (Ignore the verification warnings, since you are the only one using this app).

### Step 4: Create and Download Credentials

This is where you print the master key!
1. In the left menu, click **Credentials**.
2. Click **+ CREATE CREDENTIALS** at the top, and select **OAuth client ID**.
3. For *Application type*, select **Web application**.
4. Give it a name, e.g., `Nyxora Web Client`.
5. Under **Authorized redirect URIs**, click *ADD URI* and enter these two URLs exactly:
   `http://localhost:3000/api/auth/google/callback`
   and
   `http://127.0.0.1:3000/api/auth/google/callback`
6. Click **Create**.
7. A pop-up will appear displaying your *Client ID* and *Client Secret*.
8. Click the **DOWNLOAD JSON** button (the down-arrow icon) in that window.

> [!IMPORTANT]
> Do not rename or move the downloaded JSON file manually. You will upload it directly through the Nyxora Dashboard in the next step.

### Step 5: Upload via Dashboard Wizard

Once you have downloaded the JSON file:
1. Open the Nyxora Web Dashboard.
2. Navigate to the **Settings** tab.
3. Scroll down to the **Integrations** section and click **Setup OAuth**.
4. Follow the Wizard and upload your downloaded JSON file.
5. Once uploaded, navigate to the **OS Skills** tab.
6. Click the **Sign in with Google** button and complete the Google login flow.

Your agent is now fully connected! The system will securely encrypt and lock your Google Refresh Token into your OS-Native Keyring Vault for maximum security.
