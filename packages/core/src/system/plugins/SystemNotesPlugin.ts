import { Plugin } from '../../plugin/types';
import fs from 'fs';
import path from 'path';
import { getAppDir } from '../../config/paths';

// Initialize notes directory
function getNotesDir(): string {
  const notesDir = path.join(getAppDir(), 'notes');
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
  }
  return notesDir;
}

export class SystemNotesPlugin implements Plugin {
  public name = 'SystemNotesPlugin';
  public description = 'A personal local notes management system replacing Google Keep.';
  public version = '1.0.0';

  public tools = [
    {
      type: "function",
      function: {
        name: "save_note",
        description: "Creates or updates a note (e.g., .txt or .md) in the user's personal notes database.",
        parameters: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The name of the note file (e.g., 'ideas.md', 'shopping.txt').",
            },
            content: {
              type: "string",
              description: "The full content of the note.",
            }
          },
          required: ["filename", "content"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "read_note",
        description: "Reads the content of a specific note from the user's personal notes database.",
        parameters: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The name of the note file to read.",
            }
          },
          required: ["filename"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_notes",
        description: "Lists all available notes in the user's personal notes database.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_note",
        description: "Deletes a specific note from the user's personal notes database.",
        parameters: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The name of the note file to delete.",
            }
          },
          required: ["filename"],
        },
      },
    }
  ];

  public handlers = {
    ['save_note']: async (args: any) => {
      try {
        const notesDir = getNotesDir();
        // Prevent path traversal
        const safeFilename = path.basename(args.filename);
        const filePath = path.join(notesDir, safeFilename);
        fs.writeFileSync(filePath, args.content, 'utf8');
        return `Successfully saved note '${safeFilename}'.`;
      } catch (err: any) {
        return `Failed to save note: ${err.message}`;
      }
    },
    ['read_note']: async (args: any) => {
      try {
        const notesDir = getNotesDir();
        const safeFilename = path.basename(args.filename);
        const filePath = path.join(notesDir, safeFilename);
        if (!fs.existsSync(filePath)) {
          return `Note '${safeFilename}' does not exist.`;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        return content;
      } catch (err: any) {
        return `Failed to read note: ${err.message}`;
      }
    },
    ['list_notes']: async (args: any) => {
      try {
        const notesDir = getNotesDir();
        const files = fs.readdirSync(notesDir);
        if (files.length === 0) return "No notes found.";
        return `Available notes:\n- ${files.join('\n- ')}`;
      } catch (err: any) {
        return `Failed to list notes: ${err.message}`;
      }
    },
    ['delete_note']: async (args: any) => {
      try {
        const notesDir = getNotesDir();
        const safeFilename = path.basename(args.filename);
        const filePath = path.join(notesDir, safeFilename);
        if (!fs.existsSync(filePath)) {
          return `Note '${safeFilename}' does not exist.`;
        }
        fs.unlinkSync(filePath);
        return `Successfully deleted note '${safeFilename}'.`;
      } catch (err: any) {
        return `Failed to delete note: ${err.message}`;
      }
    }
  };
}
