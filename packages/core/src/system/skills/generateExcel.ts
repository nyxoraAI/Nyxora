import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export async function generateExcelFile(data: any[], filePath: string): Promise<string> {
  try {
    const absolutePath = path.resolve(filePath);
    const dir = path.dirname(absolutePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    if (data && data.length > 0) {
      // Create headers from the keys of the first object
      const firstItem = data[0];
      const headers = Object.keys(firstItem);
      
      worksheet.columns = headers.map(header => ({
        header: header.toUpperCase(),
        key: header,
        width: 20
      }));

      // Add rows
      data.forEach(item => {
        worksheet.addRow(item);
      });

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.commit();
    } else {
      worksheet.addRow(['No data available']);
    }

    await workbook.xlsx.writeFile(absolutePath);
    return `Success: Excel file generated at ${absolutePath}`;
  } catch (error: any) {
    return `Failed to generate Excel file: ${error.message}`;
  }
}

export const generateExcelToolDefinition = {
  type: "function",
  function: {
    name: "generate_excel_file",
    description: "Generates an Excel (.xlsx) file from an array of JSON objects and saves it to the specified local path. Useful for creating trading reports, crypto PnL, or any structured data export.",
    parameters: {
      type: "object",
      properties: {
        data: {
          type: "array",
          description: "An array of JSON objects representing the rows of data. Keys will become column headers.",
          items: {
            type: "object"
          }
        },
        filePath: {
          type: "string",
          description: "The absolute or relative path where the .xlsx file should be saved (e.g., './reports/trading_pnl.xlsx'). MUST end with .xlsx",
        }
      },
      required: ["data", "filePath"],
    },
  },
};
