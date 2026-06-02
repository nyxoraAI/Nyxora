import { getAccessToken, isAuthenticated } from '../../gateway/googleAuthModule';

export async function readGmailInbox(maxResults: number = 5): Promise<string> {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    return "Google Auth not configured. Please link your Google account in the dashboard.";
  }

  const token = await getAccessToken();
  if (!token) return "Failed to retrieve access token.";

  try {
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=in:inbox`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();

    if (!listData.messages || listData.messages.length === 0) {
      return 'No emails found in inbox.';
    }

    let output = `Top ${listData.messages.length} recent emails:\n\n`;
    
    for (const msg of listData.messages) {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const msgData = await msgRes.json();
      const headers = msgData.payload?.headers;
      
      if (headers) {
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
        const date = headers.find((h: any) => h.name === 'Date')?.value || 'Unknown Date';
        const snippet = msgData.snippet ? `\nIsi/Snippet: ${msgData.snippet}` : '';
        output += `From: ${from}\nSubject: ${subject}\nDate: ${date}${snippet}\n---\n`;
      }
    }
    
    return output.trim();
  } catch (err: any) {
    return `Error reading Gmail: ${err.message}`;
  }
}

export async function listCalendarEvents(maxResults: number = 5): Promise<string> {
  const isAuth = await isAuthenticated();
  if (!isAuth) return "Google Auth not configured. Please link your Google account in the dashboard.";
  const token = await getAccessToken();
  if (!token) return "Failed to retrieve access token.";

  try {
    const timeMin = encodeURIComponent(new Date().toISOString());
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    const events = data.items;
    if (!events || events.length === 0) {
      return 'No upcoming events found.';
    }

    let output = `Upcoming ${events.length} events:\n\n`;
    events.map((event: any, i: number) => {
      const start = event.start?.dateTime || event.start?.date;
      output += `${i + 1}. ${event.summary} (${start})\n`;
    });
    
    return output.trim();
  } catch (err: any) {
    return `Error reading Calendar: ${err.message}`;
  }
}

export async function appendRowToSheets(spreadsheetId: string, range: string, values: any[]): Promise<string> {
  const isAuth = await isAuthenticated();
  if (!isAuth) return "Google Auth not configured. Please link your Google account in the dashboard.";
  const token = await getAccessToken();
  if (!token) return "Failed to retrieve access token.";

  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [values] })
    });
    
    const data = await res.json();
    if (!res.ok) {
      return `Failed to append to Sheets: ${data.error?.message || JSON.stringify(data)}`;
    }
    
    return `Successfully appended row to ${spreadsheetId} at range ${data.updates?.updatedRange}.`;
  } catch (err: any) {
    return `Error appending to Sheets: ${err.message}`;
  }
}

export async function readGoogleDocs(documentId: string): Promise<string> {
  const isAuth = await isAuthenticated();
  if (!isAuth) return "Google Auth not configured. Please link your Google account in the dashboard.";
  const token = await getAccessToken();
  if (!token) return "Failed to retrieve access token.";

  try {
    const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) return `Failed to read document: ${data.error?.message || JSON.stringify(data)}`;

    let text = '';
    data.body?.content?.forEach((c: any) => {
      if (c.paragraph) {
        c.paragraph.elements?.forEach((e: any) => {
          if (e.textRun) text += e.textRun.content;
        });
      }
    });

    return text ? text.substring(0, 2000) + (text.length > 2000 ? '... (truncated)' : '') : 'Document is empty.';
  } catch (err: any) {
    return `Error reading Google Docs: ${err.message}`;
  }
}

export async function readGoogleFormResponses(formId: string): Promise<string> {
  const isAuth = await isAuthenticated();
  if (!isAuth) return "Google Auth not configured. Please link your Google account in the dashboard.";
  const token = await getAccessToken();
  if (!token) return "Failed to retrieve access token.";

  try {
    const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) return `Failed to read form responses: ${data.error?.message || JSON.stringify(data)}`;

    if (!data.responses || data.responses.length === 0) {
      return 'No responses found for this form.';
    }

    let output = `Total ${data.responses.length} responses:\n\n`;
    
    // Only return the last 10 responses to avoid overflowing context window
    const recentResponses = data.responses.slice(-10);
    
    recentResponses.forEach((response: any, i: number) => {
      output += `Response ${i + 1} (Submitted at ${response.createTime}):\n`;
      if (response.answers) {
        for (const [questionId, answer] of Object.entries(response.answers)) {
          const ans = answer as any;
          const textAnswers = ans.textAnswers?.answers?.map((a: any) => a.value).join(', ') || 'No text answer';
          output += `- Question ID ${questionId}: ${textAnswers}\n`;
        }
      }
      output += '---\n';
    });

    return output.trim();
  } catch (err: any) {
    return `Error reading Google Forms: ${err.message}`;
  }
}

export const readGmailInboxToolDefinition = {
  type: "function",
  function: {
    name: "read_gmail_inbox",
    description: "Reads the most recent emails from the user's Gmail inbox.",
    parameters: {
      type: "object",
      properties: {
        maxResults: { type: "number", description: "Number of emails to fetch (default: 5)." }
      },
      required: [],
    },
  },
};

export const listCalendarEventsToolDefinition = {
  type: "function",
  function: {
    name: "list_calendar_events",
    description: "Lists upcoming events from the user's Google Calendar.",
    parameters: {
      type: "object",
      properties: {
        maxResults: { type: "number", description: "Number of events to fetch (default: 5)." }
      },
      required: [],
    },
  },
};

export const appendRowToSheetsToolDefinition = {
  type: "function",
  function: {
    name: "append_row_to_sheets",
    description: "Appends a row of data to a Google Spreadsheet.",
    parameters: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "The ID of the spreadsheet (found in the URL)." },
        range: { type: "string", description: "The A1 notation of a range to search for a logical table of data, e.g. 'Sheet1!A:D'." },
        values: { 
          type: "array", 
          items: { type: "string" },
          description: "An array of strings representing the columns of the new row." 
        }
      },
      required: ["spreadsheetId", "range", "values"],
    },
  },
};

export const readGoogleDocsToolDefinition = {
  type: "function",
  function: {
    name: "read_google_docs",
    description: "Reads the text content of a Google Document.",
    parameters: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "The ID of the document (found in the URL)." }
      },
      required: ["documentId"],
    },
  },
};

export const readGoogleFormResponsesToolDefinition = {
  type: "function",
  function: {
    name: "read_google_form_responses",
    description: "Reads the most recent responses from a Google Form.",
    parameters: {
      type: "object",
      properties: {
        formId: { type: "string", description: "The ID of the form (found in the URL)." }
      },
      required: ["formId"],
    },
  },
};
