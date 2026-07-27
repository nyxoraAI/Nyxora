import { describe, it, expect } from 'vitest';
import {
  getDisplayWidth,
  padToDisplayWidth,
  isTableDivider,
  realignMarkdownTables,
} from './markdownTables';

describe('markdownTables', () => {
  describe('getDisplayWidth', () => {
    it('should count ASCII characters as width 1', () => {
      expect(getDisplayWidth('hello')).toBe(5);
    });

    it('should count CJK characters and emoji as width 2', () => {
      expect(getDisplayWidth('你好')).toBe(4);
      expect(getDisplayWidth('🚀')).toBe(2);
      expect(getDisplayWidth('a你b')).toBe(4);
    });
  });

  describe('padToDisplayWidth', () => {
    it('should pad ASCII strings correctly', () => {
      expect(padToDisplayWidth('abc', 5)).toBe('abc  ');
    });

    it('should pad wide CJK strings correctly', () => {
      expect(padToDisplayWidth('你好', 5)).toBe('你好 ');
    });
  });

  describe('isTableDivider', () => {
    it('should detect table separators', () => {
      expect(isTableDivider('|---|---|')).toBe(true);
      expect(isTableDivider('| :--- | ---: |')).toBe(true);
      expect(isTableDivider('| :- | :- |')).toBe(true);
      expect(isTableDivider('| -- | -- |')).toBe(true);
      expect(isTableDivider('| abc | def |')).toBe(false);
    });
  });

  describe('realignMarkdownTables', () => {
    it('should realign basic ASCII table columns', () => {
      const input = `| a | bb |
|---|---|
| cccc | d |`;
      const output = realignMarkdownTables(input);
      const lines = output.split('\n');
      expect(lines[0]).toBe('| a    | bb  |');
      expect(lines[1]).toBe('|------|-----|');
      expect(lines[2]).toBe('| cccc | d   |');
    });

    it('should fill empty table body cells with hyphens so columns are never blank', () => {
      const input = `| Process | CPU% | RAM |
|---|---|---|
| ps aux | | |
| Nyxora | | |`;
      const output = realignMarkdownTables(input);
      const lines = output.split('\n');
      expect(lines[0]).toBe('| Process | CPU% | RAM |');
      expect(lines[1]).toBe('|---------|------|-----|');
      expect(lines[2]).toBe('| ps aux  | -    | -   |');
      expect(lines[3]).toBe('| Nyxora  | -    | -   |');
    });

    it('should auto-split accidentally flattened table rows onto separate lines', () => {
      const input = `| Mount | Size | | :--- | :--- | | /home | 100G |`;
      const output = realignMarkdownTables(input);
      const lines = output.split('\n');
      expect(lines.length).toBe(3);
      expect(lines[0]).toBe('| Mount | Size |');
      expect(lines[1]).toBe('|-------|------|');
      expect(lines[2]).toBe('| /home | 100G |');
    });

    it('should realign tables with CJK characters without drifting', () => {
      const input = `| Nama | Kota |
|---|---|
| Budi | 北京 |
| Andi | Surabaya |`;
      const output = realignMarkdownTables(input);
      const lines = output.split('\n');
      // "Surabaya" length is 8. "Kota" length is 4. "北京" display width is 4. Max width 8.
      expect(lines[0]).toBe('| Nama | Kota     |');
      expect(lines[1]).toBe('|------|----------|');
      expect(lines[2]).toBe('| Budi | 北京     |');
      expect(lines[3]).toBe('| Andi | Surabaya |');
    });

    it('should fall back to vertical key-value layout when availableWidth is exceeded', () => {
      const input = `| Header Satu Yang Panjang | Header Dua Yang Panjang |
|---|---|
| Nilai Kolom Satu | Nilai Kolom Dua |`;
      const output = realignMarkdownTables(input, 35);
      const lines = output.split('\n');
      expect(lines[0]).toBe('Header Satu Yang Panjang: Nilai Kolom Satu');
      expect(lines[1]).toBe('Header Dua Yang Panjang: Nilai Kolom Dua');
    });
  });
});
