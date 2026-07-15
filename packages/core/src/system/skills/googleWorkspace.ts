import { getAccessToken, isAuthenticated, setClientSecret, getAuthUrlCLI, processCallbackCLI, logoutGoogle } from '../../gateway/googleAuthModule';

// ----------------------------------------------------------------------------
// HELPER
// ----------------------------------------------------------------------------
async function fetchGoogleAPI(url: string, method: string = 'GET', body?: any): Promise<any> {
  const isAuth = await isAuthenticated();
  if (!isAuth) throw new Error("Google Auth not configured. You MUST inform the user and call the 'setup_google_auth' tool to generate an authorization link.");
  const token = await getAccessToken();
  if (!token) throw new Error("Failed to retrieve access token.");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  
  if (body && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
  });

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) throw new Error(`Google API Error: ${data.error?.message || JSON.stringify(data)}`);
    return data;
  } else {
    const text = await res.text();
    if (!res.ok) throw new Error(`Google API Error: ${text}`);
    return text;
  }
}

// ----------------------------------------------------------------------------
// SETUP
// ----------------------------------------------------------------------------
export async function setupGoogleAuth(clientSecretPath: string): Promise<string> {
  const success = await setClientSecret(clientSecretPath);
  if (success) {
    const url = getAuthUrlCLI();
    return `Client secret loaded. Tell the user to open this URL in their browser and authorize the app:\n\n${url}\n\nCRITICAL: Instruct the user that after authorizing, their browser will redirect them (possibly to an error page or a blank local page). They MUST copy the full redirect URL from their browser's address bar (or just the 'code=...' parameter) and send it back to you here. Once they reply with the code, you MUST immediately call the 'submit_google_auth_code' tool to finish the setup!`;
  }
  return "Failed to set client secret. Instruct the user to download their OAuth Client ID JSON from Google Cloud Console and provide you the absolute path to it on this machine.";
}

export async function submitGoogleAuth(code: string): Promise<string> {
  const success = await processCallbackCLI(code);
  return success ? "Authentication successful! Google Workspace is now connected." : "Authentication failed.";
}

// ----------------------------------------------------------------------------
// GMAIL
// ----------------------------------------------------------------------------
export async function readGmailInbox(maxResults: number = 5): Promise<string> {
  try {
    const listData = await fetchGoogleAPI(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=in:inbox`);
    if (!listData.messages || listData.messages.length === 0) return 'No emails found in inbox.';

    let output = `Top ${listData.messages.length} recent emails:\n\n`;
    for (const msg of listData.messages) {
      const msgData = await fetchGoogleAPI(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);
      const headers = msgData.payload?.headers;
      if (headers) {
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
        const date = headers.find((h: any) => h.name === 'Date')?.value || 'Unknown Date';
        const snippet = msgData.snippet ? `\nSnippet: ${msgData.snippet}` : '';
        output += `ID: ${msg.id}\nFrom: ${from}\nSubject: ${subject}\nDate: ${date}${snippet}\n---\n`;
      }
    }
    return output.trim();
  } catch (err: any) {
    return `Error reading Gmail: ${err.message}`;
  }
}

export async function searchGmail(query: string, maxResults: number = 5): Promise<string> {
  try {
    const listData = await fetchGoogleAPI(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`);
    if (!listData.messages || listData.messages.length === 0) return 'No emails found matching the query.';

    let output = `Found ${listData.messages.length} emails:\n\n`;
    for (const msg of listData.messages) {
      const msgData = await fetchGoogleAPI(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);
      const headers = msgData.payload?.headers;
      if (headers) {
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
        const date = headers.find((h: any) => h.name === 'Date')?.value || 'Unknown Date';
        output += `- [${msg.id}] From: ${from} | Date: ${date} | Subject: ${subject}\n`;
      }
    }
    return output.trim();
  } catch (err: any) {
    return `Error searching Gmail: ${err.message}`;
  }
}

export async function getGmailMessage(messageId: string): Promise<string> {
  try {
    const msgData = await fetchGoogleAPI(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`);
    const headers = msgData.payload?.headers;
    const subject = headers?.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
    const from = headers?.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
    const date = headers?.find((h: any) => h.name === 'Date')?.value || 'Unknown Date';

    let body = "";
    if (msgData.payload?.body?.data) {
      body = Buffer.from(msgData.payload.body.data, 'base64url').toString('utf8');
    } else if (msgData.payload?.parts) {
      const part = msgData.payload.parts.find((p: any) => p.mimeType === 'text/plain') || msgData.payload.parts.find((p: any) => p.mimeType === 'text/html');
      if (part && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64url').toString('utf8');
      }
    }
    return `Message ID: ${msgData.id}\nFrom: ${from}\nDate: ${date}\nSubject: ${subject}\n\nBody:\n${body}`;
  } catch (err: any) {
    return `Error getting Gmail message: ${err.message}`;
  }
}

export async function sendEmail(to: string, subject: string, body: string, cc?: string): Promise<string> {
  try {
    let mimeStr = `To: ${to}\nSubject: ${subject}\n`;
    if (cc) mimeStr += `Cc: ${cc}\n`;
    mimeStr += `Content-Type: text/plain; charset="UTF-8"\n\n${body}`;
    const raw = Buffer.from(mimeStr).toString('base64url');
    const result = await fetchGoogleAPI(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, 'POST', { raw });
    return `Email sent successfully. Message ID: ${result.id}`;
  } catch (err: any) {
    return `Error sending email: ${err.message}`;
  }
}

export async function replyEmail(messageId: string, body: string): Promise<string> {
  try {
    const original = await fetchGoogleAPI(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID`);
    const headers = original.payload?.headers;
    const from = headers?.find((h: any) => h.name === 'From')?.value || '';
    const subject = headers?.find((h: any) => h.name === 'Subject')?.value || '';
    const msgIdHeader = headers?.find((h: any) => h.name === 'Message-ID')?.value || '';
    
    let replySubject = subject;
    if (!replySubject.startsWith('Re:')) replySubject = `Re: ${subject}`;
    
    let mimeStr = `To: ${from}\nSubject: ${replySubject}\n`;
    if (msgIdHeader) {
      mimeStr += `In-Reply-To: ${msgIdHeader}\nReferences: ${msgIdHeader}\n`;
    }
    mimeStr += `Content-Type: text/plain; charset="UTF-8"\n\n${body}`;
    const raw = Buffer.from(mimeStr).toString('base64url');
    const result = await fetchGoogleAPI(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, 'POST', { raw, threadId: original.threadId });
    return `Reply sent successfully. Message ID: ${result.id}`;
  } catch (err: any) {
    return `Error replying to email: ${err.message}`;
  }
}

export async function modifyGmailLabels(messageId: string, addLabels: string[], removeLabels: string[]): Promise<string> {
  try {
    const result = await fetchGoogleAPI(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, 'POST', {
      addLabelIds: addLabels,
      removeLabelIds: removeLabels
    });
    return `Labels modified for ${messageId}. Current labels: ${result.labelIds?.join(', ')}`;
  } catch (err: any) {
    return `Error modifying labels: ${err.message}`;
  }
}

// ----------------------------------------------------------------------------
// CALENDAR
// ----------------------------------------------------------------------------
export async function listCalendarEvents(maxResults: number = 5, timeMin?: string, timeMax?: string): Promise<string> {
  try {
    const min = timeMin ? encodeURIComponent(timeMin) : encodeURIComponent(new Date().toISOString());
    let url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${min}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;
    if (timeMax) url += `&timeMax=${encodeURIComponent(timeMax)}`;

    const data = await fetchGoogleAPI(url);
    const events = data.items;
    if (!events || events.length === 0) return 'No events found in the specified range.';

    let output = `Upcoming ${events.length} events:\n\n`;
    events.forEach((event: any, i: number) => {
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      output += `${i + 1}. [${event.id}] ${event.summary} (${start} to ${end})\n`;
    });
    return output.trim();
  } catch (err: any) {
    return `Error reading Calendar: ${err.message}`;
  }
}

export async function addCalendarEvent(summary: string, description: string, startTime: string, endTime: string): Promise<string> {
  try {
    const event = { summary, description, start: { dateTime: startTime }, end: { dateTime: endTime } };
    const data = await fetchGoogleAPI(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, 'POST', event);
    return `Successfully added event '${summary}'. Event link: ${data.htmlLink}\nEvent ID: ${data.id}`;
  } catch (err: any) {
    return `Error adding calendar event: ${err.message}`;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<string> {
  try {
    await fetchGoogleAPI(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, 'DELETE');
    return `Event ${eventId} deleted successfully.`;
  } catch (err: any) {
    return `Error deleting Calendar event: ${err.message}`;
  }
}

// ----------------------------------------------------------------------------
// DRIVE
// ----------------------------------------------------------------------------
export async function searchDrive(query: string, maxResults: number = 10): Promise<string> {
  try {
    const q = encodeURIComponent(`fullText contains '${query}'`);
    const data = await fetchGoogleAPI(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=${maxResults}&fields=files(id,name,mimeType,modifiedTime,webViewLink)`);
    if (!data.files || data.files.length === 0) return 'No files found matching the query.';

    let output = `Found ${data.files.length} files:\n\n`;
    data.files.forEach((f: any) => {
      output += `- [${f.id}] ${f.name} (${f.mimeType}) - Modified: ${f.modifiedTime}\n  Link: ${f.webViewLink}\n`;
    });
    return output.trim();
  } catch (err: any) {
    return `Error searching Drive: ${err.message}`;
  }
}

export async function getDriveFile(fileId: string): Promise<string> {
  try {
    const data = await fetchGoogleAPI(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,webViewLink,parents`);
    let output = `File ID: ${data.id}\nName: ${data.name}\nMIME Type: ${data.mimeType}\nModified: ${data.modifiedTime}\nLink: ${data.webViewLink}\n`;
    if (data.size) output += `Size: ${data.size} bytes\n`;
    if (data.parents) output += `Parents: ${data.parents.join(', ')}\n`;
    return output.trim();
  } catch (err: any) {
    return `Error getting Drive file metadata: ${err.message}`;
  }
}

export async function deleteDriveFile(fileId: string): Promise<string> {
  try {
    await fetchGoogleAPI(`https://www.googleapis.com/drive/v3/files/${fileId}`, 'DELETE');
    return `File ${fileId} deleted successfully.`;
  } catch (err: any) {
    return `Error deleting Drive file: ${err.message}`;
  }
}

// ----------------------------------------------------------------------------
// DOCS & SHEETS
// ----------------------------------------------------------------------------
export async function readGoogleDocs(documentId: string): Promise<string> {
  try {
    const data = await fetchGoogleAPI(`https://docs.googleapis.com/v1/documents/${documentId}`);
    let text = '';
    data.body?.content?.forEach((element: any) => {
      if (element.paragraph) {
        element.paragraph.elements?.forEach((el: any) => {
          if (el.textRun?.content) text += el.textRun.content;
        });
      }
    });
    return text.trim() || 'Document is empty.';
  } catch (err: any) {
    return `Error reading Google Docs: ${err.message}`;
  }
}

export async function appendRowToSheets(spreadsheetId: string, range: string, values: any[]): Promise<string> {
  try {
    const data = await fetchGoogleAPI(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, 'POST', { values: [values] });
    return `Successfully appended row to ${spreadsheetId} at range ${data.updates?.updatedRange}.`;
  } catch (err: any) {
    return `Error appending to Sheets: ${err.message}`;
  }
}

export async function readGoogleFormResponses(formId: string): Promise<string> {
  try {
    const data = await fetchGoogleAPI(`https://forms.googleapis.com/v1/forms/${formId}/responses`);
    if (!data.responses || data.responses.length === 0) return 'No responses found.';
    let output = `Recent responses for form ${formId}:\n\n`;
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

// ----------------------------------------------------------------------------
// TOOL DEFINITIONS
// ----------------------------------------------------------------------------
const _t = (name: string, desc: string, props: any, req: string[]) => ({
  type: "function", function: { name, description: desc, parameters: { type: "object", properties: props, required: req } }
});

export const setupGoogleAuthToolDefinition = _t("setup_google_auth", "Sets up Google Workspace auth using a client_secret.json file.", { clientSecretPath: { type: "string", description: "Absolute path to client_secret.json" } }, ["clientSecretPath"]);
export const submitGoogleAuthToolDefinition = _t("submit_google_auth_code", "Submits the OAuth authorization code to finish authentication.", { code: { type: "string", description: "The auth code or full redirect URL." } }, ["code"]);

export const readGmailInboxToolDefinition = _t("read_gmail_inbox", "Reads recent emails from Gmail inbox.", { maxResults: { type: "number", description: "Number of emails (default 5)" } }, []);
export const searchGmailToolDefinition = _t("search_gmail", "Searches Gmail messages.", { query: { type: "string" }, maxResults: { type: "number" } }, ["query"]);
export const getGmailMessageToolDefinition = _t("get_gmail_message", "Gets full content of a specific Gmail message.", { messageId: { type: "string" } }, ["messageId"]);
export const sendEmailToolDefinition = _t("send_email", "Sends an email.", { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, cc: { type: "string" } }, ["to", "subject", "body"]);
export const replyEmailToolDefinition = _t("reply_email", "Replies to an email.", { messageId: { type: "string" }, body: { type: "string" } }, ["messageId", "body"]);
export const modifyGmailLabelsToolDefinition = _t("modify_gmail_labels", "Modifies labels on an email.", { messageId: { type: "string" }, addLabels: { type: "array", items: { type: "string" } }, removeLabels: { type: "array", items: { type: "string" } } }, ["messageId", "addLabels", "removeLabels"]);

export const listCalendarEventsToolDefinition = _t("list_calendar_events", "Lists upcoming Calendar events.", { maxResults: { type: "number" }, timeMin: { type: "string", description: "ISO date" }, timeMax: { type: "string", description: "ISO date" } }, []);
export const addCalendarEventToolDefinition = _t("add_calendar_event", "Creates a Calendar event.", { summary: { type: "string" }, description: { type: "string" }, startTime: { type: "string", description: "ISO string" }, endTime: { type: "string", description: "ISO string" } }, ["summary", "description", "startTime", "endTime"]);
export const deleteCalendarEventToolDefinition = _t("delete_calendar_event", "Deletes a Calendar event.", { eventId: { type: "string" } }, ["eventId"]);

export const searchDriveToolDefinition = _t("search_drive", "Searches Google Drive files.", { query: { type: "string" }, maxResults: { type: "number" } }, ["query"]);
export const getDriveFileToolDefinition = _t("get_drive_file", "Gets Google Drive file metadata.", { fileId: { type: "string" } }, ["fileId"]);
export const deleteDriveFileToolDefinition = _t("delete_drive_file", "Deletes a Google Drive file.", { fileId: { type: "string" } }, ["fileId"]);

export const readGoogleDocsToolDefinition = _t("read_google_docs", "Reads content of a Google Doc.", { documentId: { type: "string" } }, ["documentId"]);
export const appendRowToSheetsToolDefinition = _t("append_row_to_sheets", "Appends a row to a Google Sheet.", { spreadsheetId: { type: "string" }, range: { type: "string" }, values: { type: "array", items: { type: "string" } } }, ["spreadsheetId", "range", "values"]);
export const readGoogleFormResponsesToolDefinition = _t("read_google_form_responses", "Reads Google Form responses.", { formId: { type: "string" } }, ["formId"]);
