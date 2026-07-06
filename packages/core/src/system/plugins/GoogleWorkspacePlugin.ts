import { Plugin } from '../../plugin/types';
import * as GW from '../skills/googleWorkspace';

export class GoogleWorkspacePlugin implements Plugin {
  public name = 'GoogleWorkspacePlugin';
  public description = 'Google Workspace operations including Gmail, Calendar, Docs, and Sheets.';
  public version = '1.1.0';

  public tools = [
    GW.setupGoogleAuthToolDefinition,
    GW.submitGoogleAuthToolDefinition,
    GW.readGmailInboxToolDefinition,
    GW.searchGmailToolDefinition,
    GW.getGmailMessageToolDefinition,
    GW.sendEmailToolDefinition,
    GW.replyEmailToolDefinition,
    GW.modifyGmailLabelsToolDefinition,
    GW.listCalendarEventsToolDefinition,
    GW.addCalendarEventToolDefinition,
    GW.deleteCalendarEventToolDefinition,
    GW.searchDriveToolDefinition,
    GW.getDriveFileToolDefinition,
    GW.deleteDriveFileToolDefinition,
    GW.readGoogleDocsToolDefinition,
    GW.appendRowToSheetsToolDefinition,
    GW.readGoogleFormResponsesToolDefinition
  ];

  public handlers = {
    ['setup_google_auth']: async (args: any) => GW.setupGoogleAuth(args.clientSecretPath),
    ['submit_google_auth_code']: async (args: any) => GW.submitGoogleAuth(args.code),
    ['read_gmail_inbox']: async (args: any) => GW.readGmailInbox(args.maxResults),
    ['search_gmail']: async (args: any) => GW.searchGmail(args.query, args.maxResults),
    ['get_gmail_message']: async (args: any) => GW.getGmailMessage(args.messageId),
    ['send_email']: async (args: any) => GW.sendEmail(args.to, args.subject, args.body, args.cc),
    ['reply_email']: async (args: any) => GW.replyEmail(args.messageId, args.body),
    ['modify_gmail_labels']: async (args: any) => GW.modifyGmailLabels(args.messageId, args.addLabels || [], args.removeLabels || []),
    ['list_calendar_events']: async (args: any) => GW.listCalendarEvents(args.maxResults, args.timeMin, args.timeMax),
    ['add_calendar_event']: async (args: any) => GW.addCalendarEvent(args.summary, args.description, args.startTime, args.endTime),
    ['delete_calendar_event']: async (args: any) => GW.deleteCalendarEvent(args.eventId),
    ['search_drive']: async (args: any) => GW.searchDrive(args.query, args.maxResults),
    ['get_drive_file']: async (args: any) => GW.getDriveFile(args.fileId),
    ['delete_drive_file']: async (args: any) => GW.deleteDriveFile(args.fileId),
    ['read_google_docs']: async (args: any) => GW.readGoogleDocs(args.documentId),
    ['append_row_to_sheets']: async (args: any) => GW.appendRowToSheets(args.spreadsheetId, args.range, args.values),
    ['read_google_form_responses']: async (args: any) => GW.readGoogleFormResponses(args.formId)
  };
}
