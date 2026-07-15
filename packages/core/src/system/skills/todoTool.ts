/**
 * todo_write / todo_read — per-session task tracker.
 *
 * Provides the LLM with a lightweight, in-memory kanban-style list so it
 * in-memory kanban-style list so it can track multi-step work (debugging,
 * feature implementation) without losing context between turns.
 *
 * Data is scoped to a sessionId and lives only in process memory — it is
 * intentionally ephemeral. Cleared when the session ends or the server restarts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TodoStatus = 'pending' | 'in_progress' | 'done';
export type TodoPriority = 'high' | 'medium' | 'low';

export interface TodoItem {
  id: string;
  task: string;
  status: TodoStatus;
  priority?: TodoPriority;
}

// ---------------------------------------------------------------------------
// In-memory store — Map<sessionId, TodoItem[]>
// ---------------------------------------------------------------------------

const _store = new Map<string, TodoItem[]>();

const SESSION_KEY = '__global__';

function _key(sessionId?: string): string {
  return sessionId ?? SESSION_KEY;
}

// ---------------------------------------------------------------------------
// todoWrite()
// ---------------------------------------------------------------------------

export function todoWrite(
  todos: TodoItem[],
  sessionId?: string,
): string {
  if (!Array.isArray(todos)) {
    return 'Error: `todos` must be an array of todo items.';
  }

  const key = _key(sessionId);
  const existing = new Map((_store.get(key) ?? []).map(t => [t.id, t]));

  // Upsert: items with matching id are updated, new ids are appended
  for (const item of todos) {
    if (!item.id || !item.task) {
      return `Error: Each todo item must have an 'id' and a 'task' string. Invalid item: ${JSON.stringify(item)}`;
    }
    const valid: TodoStatus[] = ['pending', 'in_progress', 'done'];
    if (!valid.includes(item.status)) {
      return `Error: Invalid status '${item.status}'. Must be one of: ${valid.join(', ')}.`;
    }
    existing.set(item.id, {
      id: item.id,
      task: item.task,
      status: item.status,
      priority: item.priority,
    });
  }

  _store.set(key, Array.from(existing.values()));
  return todoRead(sessionId);
}

// ---------------------------------------------------------------------------
// todoRead()
// ---------------------------------------------------------------------------

export function todoRead(sessionId?: string): string {
  const key = _key(sessionId);
  const items = _store.get(key) ?? [];

  if (items.length === 0) {
    return 'Todo list is empty. Use `todo_write` to add tasks.';
  }

  const ICONS: Record<TodoStatus, string> = {
    pending: '⬜',
    in_progress: '🔄',
    done: '✅',
  };
  const PRIORITY_LABEL: Record<string, string> = {
    high: ' [HIGH]',
    medium: ' [MED]',
    low: ' [LOW]',
  };

  // Group by status for readability
  const groups: Record<TodoStatus, TodoItem[]> = {
    in_progress: [],
    pending: [],
    done: [],
  };
  for (const item of items) groups[item.status].push(item);

  const lines: string[] = ['--- TODO LIST ---'];
  for (const status of ['in_progress', 'pending', 'done'] as TodoStatus[]) {
    for (const item of groups[status]) {
      const prio = item.priority ? PRIORITY_LABEL[item.priority] ?? '' : '';
      lines.push(`${ICONS[item.status]} [${item.id}]${prio} ${item.task}`);
    }
  }

  const pending = items.filter(i => i.status !== 'done').length;
  lines.push(`--- ${pending} task(s) remaining ---`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// clearSession() — called on session end to free memory
// ---------------------------------------------------------------------------

export function clearTodoSession(sessionId?: string): void {
  _store.delete(_key(sessionId));
}

// ---------------------------------------------------------------------------
// Tool definitions (OpenAI function-calling schema)
// ---------------------------------------------------------------------------

export const todoWriteToolDefinition = {
  type: 'function',
  function: {
    name: 'todo_write',
    description: [
      'Create or update the TODO list for the current session.',
      'Use this to track progress on multi-step tasks such as debugging or feature implementation.',
      'Set status to "in_progress" when starting a task, "done" when complete.',
      'Call todo_read at the start of each turn to check remaining tasks.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: 'Array of todo items to create or update.',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for this todo item (e.g. "fix-auth-bug", "add-tests").',
              },
              task: {
                type: 'string',
                description: 'Short description of the task.',
              },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'done'],
                description: 'Current status of the task.',
              },
              priority: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                description: 'Optional task priority.',
              },
            },
            required: ['id', 'task', 'status'],
          },
        },
      },
      required: ['todos'],
    },
  },
};

export const todoReadToolDefinition = {
  type: 'function',
  function: {
    name: 'todo_read',
    description: [
      'Read the current TODO list for this session.',
      'Call this at the start of a turn to review pending and in-progress tasks.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};
