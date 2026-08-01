/**
 * CJK/emoji-aware markdown table realignment and responsive narrow-screen fallback.
 * 
 * Inspired by hermes-agent's `markdown_tables.py`, this utility re-pads Markdown
 * tables so CJK ideographs, emoji, and full-width characters (which occupy 2 terminal
 * columns) do not cause column borders to drift.
 * 
 * When a rendered table exceeds `availableWidth`, it automatically falls back to a
 * vertical key-value representation (`Header: value`) so terminal soft-wrapping does
 * not visually break the table.
 */

export function getDisplayWidth(str: string): number {
  let width = 0;
  // Strip ANSI escape sequences before calculating width
  const cleanStr = str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  for (const char of cleanStr) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;

    // Zero-width combining characters and variation selectors
    if (
      (code >= 0x0300 && code <= 0x036f) || // Combining Diacritical Marks
      (code >= 0xfe00 && code <= 0xfe0f) || // Variation Selectors
      code === 0x200d // Zero Width Joiner
    ) {
      continue;
    }

    // Wide CJK ideographs, fullwidth forms, and emoji symbols (2 columns)
    if (
      (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
      (code >= 0x2e80 && code <= 0xa4cf) || // CJK Radicals, Ideographs, Yi
      (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
      (code >= 0xfe30 && code <= 0xfe6f) || // CJK Compatibility Forms
      (code >= 0xff01 && code <= 0xff60) || // Fullwidth Forms
      (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth Forms
      (code >= 0x1f000 && code <= 0x1faff) || // Emoji & Symbols
      (code >= 0x20000 && code <= 0x2fffd) || // CJK Unified Ideographs Extension B-G
      (code >= 0x30000 && code <= 0x3fffd)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

export function padToDisplayWidth(str: string, targetWidth: number): string {
  const currentWidth = getDisplayWidth(str);
  const neededSpaces = Math.max(0, targetWidth - currentWidth);
  return str + ' '.repeat(neededSpaces);
}

export function splitTableRow(row: string): string[] {
  let s = row.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map(cell => cell.trim());
}

export function isTableDivider(row: string): boolean {
  const cells = splitTableRow(row);
  if (cells.length < 1) return false;
  return cells.every(c => /^:?-+:?$/.test(c));
}

function renderVerticalTable(
  rows: string[][],
  numCols: number,
  availableWidth: number
): string[] {
  if (rows.length === 0) return [];
  const headers = rows[0].concat(Array(Math.max(0, numCols - rows[0].length)).fill(''));
  const body = rows.slice(1);
  const labels = headers.map((h, idx) => h || `Column ${idx + 1}`);
  const sepWidth = Math.max(20, Math.min(40, availableWidth - 2));
  const separator = '─'.repeat(sepWidth);
  const indent = '  ';

  const out: string[] = [];
  for (let ri = 0; ri < body.length; ri++) {
    if (ri > 0) out.push(separator);
    const row = body[ri];
    for (let ci = 0; ci < numCols; ci++) {
      const label = labels[ci];
      const value = ci < row.length ? row[ci] : '';
      if (!value) {
        out.push(`${label}:`);
      } else {
        out.push(`${label}: ${value}`);
      }
    }
  }
  return out;
}

function renderTableBlock(rows: string[][], availableWidth?: number): string[] {
  const numCols = Math.max(...rows.map(r => r.length));
  const normalizedRows = rows.map((r, rowIdx) => {
    const copy = [...r];
    while (copy.length < numCols) copy.push('');
    // Fill empty cells in table body with '-' so columns never render blank/empty
    if (rowIdx > 0) {
      for (let i = 0; i < copy.length; i++) {
        if (!copy[i] || copy[i].trim() === '') {
          copy[i] = '-';
        }
      }
    }
    return copy;
  });

  const widths: number[] = [];
  for (let c = 0; c < numCols; c++) {
    let colMax = 3; // Minimum width for divider `---`
    for (const r of normalizedRows) {
      const cellWidth = getDisplayWidth(r[c] || '');
      if (cellWidth > colMax) colMax = cellWidth;
    }
    widths.push(colMax);
  }

  const totalHorizontalWidth = widths.reduce((sum, w) => sum + w, 0) + 3 * numCols + 1;
  if (availableWidth !== undefined && totalHorizontalWidth > Math.max(availableWidth, 20)) {
    return renderVerticalTable(normalizedRows, numCols, availableWidth);
  }

  const formatRow = (cells: string[]): string => {
    const paddedCells = cells.map((cell, i) => padToDisplayWidth(cell, widths[i]));
    return '| ' + paddedCells.join(' | ') + ' |';
  };

  const headerStr = formatRow(normalizedRows[0]);
  const dividerStr = '|' + widths.map(w => '-'.repeat(w + 2)).join('|') + '|';
  const bodyStrs = normalizedRows.slice(1).map(r => formatRow(r));

  return [headerStr, dividerStr, ...bodyStrs];
}

/**
 * Realigns all Markdown tables in `text` so CJK and wide characters are properly padded.
 * If a table is wider than `availableWidth`, it is converted to a vertical key-value layout.
 */
export function realignMarkdownTables(text: string, availableWidth?: number): string {
  if (!text || !text.includes('|')) return text;

  // 1. Un-flatten accidentally joined table rows (small model hallucination)
  let normalizedText = text.replace(/([^\n])\s*(\|[^\n]+\|)\s*(?=\|\s*[-:]+[-| :]*\|)/g, '$1\n$2');
  normalizedText = normalizedText
    .replace(/\|\s*\|\s*(?=[-:]+[-| :]*\|)/g, '|\n|')
    .replace(/(\|\s*[-:]+[-| :]*\|)\s*\|/g, '$1\n|');
  normalizedText = normalizedText.replace(/(\|\s*(?::?-+:?|[^|\n]+)\s*\|)\s*\|\s*(?=[^|\n]+\|)/g, '$1\n|');

  const lines = normalizedText.split('\n');
  const out: string[] = [];
  let i = 0;
  const n = lines.length;

  while (i < n) {
    const line = lines[i];
    if (line.includes('|') && i + 1 < n && isTableDivider(lines[i + 1])) {
      const header = splitTableRow(line);
      const body: string[][] = [];
      let j = i + 2;
      while (j < n && lines[j].includes('|') && lines[j].trim() !== '') {
        if (isTableDivider(lines[j])) {
          j++;
          continue;
        }
        body.push(splitTableRow(lines[j]));
        j++;
      }

      if (header.some(c => c.length > 0) || body.length > 0) {
        out.push(...renderTableBlock([header, ...body], availableWidth));
        i = j;
        continue;
      }
    }
    out.push(line);
    i++;
  }

  return out.join('\n');
}
