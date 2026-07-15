import writeXlsxFile from 'write-excel-file/node';
import path from 'path';
import fs from 'fs';

export async function generateExcelFile(data: any[], filePath: string): Promise<string> {
  try {
    const absolutePath = path.resolve(filePath);
    const dir = path.dirname(absolutePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let reportData = data;
    if (!reportData || reportData.length === 0) {
      reportData = [{ Message: 'No data available' }];
    }

    const headers = Object.keys(reportData[0]);
    const excelData = [
      headers.map(h => ({ value: h, fontWeight: 'bold' })),
      ...reportData.map(row => headers.map(h => ({ value: String(row[h] || '') })))
    ];

    await writeXlsxFile(excelData).toFile(absolutePath);
    
    return `Success: Excel file generated at ${absolutePath}`;
  } catch (error: any) {
    return `Failed to generate Excel file: ${error.message}`;
  }
}

export const generateExcelToolDefinition = {
  type: "function",
  function: {
    name: "generate_excel_file",
    description: "Generates an Excel (.xlsx) file from an array of JSON objects and saves it to the specified local path. Useful for creating trading reports or crypto PnL. ONLY use this tool if the user explicitly requests an Excel file, a download, or a spreadsheet report.",
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
