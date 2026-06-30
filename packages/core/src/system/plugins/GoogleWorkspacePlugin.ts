import { Plugin } from '../../plugin/types';
import { 
  readGmailInbox, 
  listCalendarEvents, 
  appendRowToSheets, 
  readGoogleDocs, 
  readGoogleFormResponses,
  readGmailInboxToolDefinition,
  listCalendarEventsToolDefinition,
  appendRowToSheetsToolDefinition,
  readGoogleDocsToolDefinition,
  readGoogleFormResponsesToolDefinition
} from '../skills/googleWorkspace';

export class GoogleWorkspacePlugin implements Plugin {
  public name = 'GoogleWorkspacePlugin';
  public description = 'Google Workspace operations including Gmail, Calendar, Docs, and Sheets.';
  public version = '1.0.1';

  public tools = [
    readGmailInboxToolDefinition,
    listCalendarEventsToolDefinition,
    appendRowToSheetsToolDefinition,
    readGoogleDocsToolDefinition,
    readGoogleFormResponsesToolDefinition
  ];

  public handlers = {
    ['read_gmail_inbox']: async (args: any) => {
      return await readGmailInbox(args.maxResults);
    },
    ['list_calendar_events']: async (args: any) => {
      return await listCalendarEvents(args.maxResults);
    },
    ['append_row_to_sheets']: async (args: any) => {
      return await appendRowToSheets(args.spreadsheetId, args.range, args.values);
    },
    ['read_google_docs']: async (args: any) => {
      return await readGoogleDocs(args.documentId);
    },
    ['read_google_form_responses']: async (args: any) => {
      return await readGoogleFormResponses(args.formId);
    }
  };
}
