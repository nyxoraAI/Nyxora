import { Client } from '@notionhq/client';
import { loadApiKeys } from '../../config/parser';

export async function manageNotion(action: string, pageId?: string, text?: string): Promise<string> {
  try {
    const keys = await loadApiKeys();
    const notionToken = keys['notion_key'];
    
    if (!notionToken) {
      return "Error: Notion API Key not found. Please run 'nyxora set-key notion <TOKEN>'";
    }

    const notion = new Client({ auth: notionToken });

    if (action === 'read_page') {
      if (!pageId) return "Error: pageId is required for read_page";
      const blocks = await notion.blocks.children.list({ block_id: pageId });
      let content = `--- Notion Page Content ---\n`;
      for (const block of blocks.results as any[]) {
        if (block.type === 'paragraph' && block.paragraph.rich_text.length > 0) {
          content += block.paragraph.rich_text.map((t: any) => t.plain_text).join('') + '\n';
        } else if (block.type === 'to_do') {
          const status = block.to_do.checked ? '[x]' : '[ ]';
          content += `${status} ${block.to_do.rich_text.map((t: any) => t.plain_text).join('')}\n`;
        }
      }
      return content;
      
    } else if (action === 'append_todo') {
      if (!pageId || !text) return "Error: pageId and text are required to append_todo";
      await notion.blocks.children.append({
        block_id: pageId,
        children: [
          {
            object: 'block',
            type: 'to_do',
            to_do: {
              rich_text: [{ type: 'text', text: { content: text } }],
              checked: false
            }
          }
        ]
      });
      return "Success: To-Do item appended to Notion page.";
    }

    return `Error: Unsupported action ${action}`;
  } catch (error: any) {
    return `Notion API Error: ${error.message}`;
  }
}

export const notionWorkspaceToolDefinition = {
  type: "function",
  function: {
    name: "manage_notion",
    description: "Reads pages or manages To-Do lists in Notion.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["read_page", "append_todo"],
          description: "The action to perform.",
        },
        pageId: {
          type: "string",
          description: "The Notion Page ID.",
        },
        text: {
          type: "string",
          description: "The text to add. Required for 'append_todo'.",
        }
      },
      required: ["action", "pageId"],
    },
  },
};
