// SuperSheet Core Types and Utilities

export interface CellStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    textAlign?: 'left' | 'center' | 'right';
    backgroundColor?: string;
    textColor?: string;
    fontSize?: number;
}

export interface CellFormat {
    type: 'text' | 'number' | 'currency' | 'percentage' | 'date';
    decimals?: number;
    currencySymbol?: string;
}

export interface Cell {
    value: string | number | null;
    formula?: string;
    format?: CellFormat;
    style?: CellStyle;
    displayValue?: string;
}

export interface Sheet {
    id: string;
    name: string;
    cells: Record<string, Cell>; // Key: "A1", "B2", etc.
    columnWidths: Record<string, number>; // Key: "A", "B", etc.
    rowHeights: Record<number, number>; // Key: row number
    selectedCell?: string;
    selectedRange?: string[];
}

export interface Workbook {
    id: string;
    name: string;
    sheets: Sheet[];
    activeSheetId: string;
    createdAt: number;
    updatedAt: number;
}

// Default dimensions
export const DEFAULT_COLUMN_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 28;
export const DEFAULT_COLUMNS = 26; // A-Z
export const DEFAULT_ROWS = 100;

// Convert column index to letter (0 -> A, 1 -> B, ..., 25 -> Z)
export function columnIndexToLetter(index: number): string {
    if (index < 0 || index > 25) return '';
    return String.fromCharCode(65 + index);
}

// Convert column letter to index (A -> 0, B -> 1, ..., Z -> 25)
export function columnLetterToIndex(letter: string): number {
    const upper = letter.toUpperCase();
    if (upper.length !== 1 || upper < 'A' || upper > 'Z') return -1;
    return upper.charCodeAt(0) - 65;
}

// Parse cell reference (e.g., "A1" -> { col: 0, row: 0 })
export function parseCellRef(ref: string): { col: number; row: number } | null {
    const match = ref.match(/^([A-Za-z])(\d+)$/);
    if (!match) return null;
    const col = columnLetterToIndex(match[1]);
    const row = parseInt(match[2], 10) - 1; // Convert to 0-indexed
    if (col < 0 || row < 0) return null;
    return { col, row };
}

// Create cell reference from column and row indices
export function createCellRef(col: number, row: number): string {
    return `${columnIndexToLetter(col)}${row + 1}`;
}

// Parse cell range (e.g., "A1:B5" -> ["A1", "A2", ..., "B5"])
export function parseCellRange(range: string): string[] {
    const parts = range.split(':');
    if (parts.length === 1) {
        // Single cell
        return [parts[0].toUpperCase()];
    }

    if (parts.length !== 2) return [];

    const start = parseCellRef(parts[0]);
    const end = parseCellRef(parts[1]);

    if (!start || !end) return [];

    const cells: string[] = [];
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);

    for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
            cells.push(createCellRef(col, row));
        }
    }

    return cells;
}

// Create a new empty sheet
export function createSheet(id: string, name: string): Sheet {
    return {
        id,
        name,
        cells: {},
        columnWidths: {},
        rowHeights: {},
    };
}

// Create a new workbook
export function createWorkbook(name: string = 'Untitled Workbook'): Workbook {
    const sheetId = `sheet_${Date.now()}`;
    return {
        id: `workbook_${Date.now()}`,
        name,
        sheets: [createSheet(sheetId, 'Sheet 1')],
        activeSheetId: sheetId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

// Get cell value (resolved, not formula)
export function getCellValue(sheet: Sheet, ref: string): string | number | null {
    const cell = sheet.cells[ref.toUpperCase()];
    if (!cell) return null;
    return cell.value;
}

// Format cell value for display
export function formatCellValue(value: string | number | null, format?: CellFormat): string {
    if (value === null || value === undefined || value === '') return '';

    if (format) {
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));

        if (!isNaN(numValue)) {
            switch (format.type) {
                case 'currency':
                    const symbol = format.currencySymbol || '₦';
                    return `${symbol}${numValue.toLocaleString('en-NG', {
                        minimumFractionDigits: format.decimals ?? 2,
                        maximumFractionDigits: format.decimals ?? 2
                    })}`;
                case 'percentage':
                    return `${(numValue * 100).toFixed(format.decimals ?? 0)}%`;
                case 'number':
                    return numValue.toLocaleString('en-NG', {
                        minimumFractionDigits: format.decimals ?? 0,
                        maximumFractionDigits: format.decimals ?? 0
                    });
                case 'date':
                    return new Date(numValue).toLocaleDateString('en-NG');
            }
        }
    }

    return String(value);
}

// Check if a value is a formula
export function isFormula(value: string): boolean {
    return typeof value === 'string' && value.startsWith('=');
}

// Get all cell references from a formula
export function extractCellRefs(formula: string): string[] {
    const refs: string[] = [];
    // Match cell references (A1) and ranges (A1:B5)
    const pattern = /([A-Za-z]\d+)(?::([A-Za-z]\d+))?/g;
    let match;

    while ((match = pattern.exec(formula)) !== null) {
        if (match[2]) {
            // Range
            refs.push(...parseCellRange(`${match[1]}:${match[2]}`));
        } else {
            // Single cell
            refs.push(match[1].toUpperCase());
        }
    }

    return [...new Set(refs)];
}

// Check for circular dependencies
export function hasCircularDependency(
    sheet: Sheet,
    cellRef: string,
    formula: string,
    visited: Set<string> = new Set()
): boolean {
    if (visited.has(cellRef)) return true;
    visited.add(cellRef);

    const refs = extractCellRefs(formula);

    for (const ref of refs) {
        if (ref === cellRef) return true;

        const cell = sheet.cells[ref];
        if (cell?.formula) {
            if (hasCircularDependency(sheet, ref, cell.formula, visited)) {
                return true;
            }
        }
    }

    return false;
}

// Export sheet to CSV
export function sheetToCSV(sheet: Sheet, maxRow: number = DEFAULT_ROWS, maxCol: number = DEFAULT_COLUMNS): string {
    const rows: string[] = [];

    for (let row = 0; row < maxRow; row++) {
        const cells: string[] = [];
        let hasData = false;

        for (let col = 0; col < maxCol; col++) {
            const ref = createCellRef(col, row);
            const cell = sheet.cells[ref];
            const value = cell?.displayValue ?? cell?.value ?? '';

            if (value !== '') hasData = true;

            // Escape quotes and wrap in quotes if contains comma or newline
            let cellValue = String(value);
            if (cellValue.includes(',') || cellValue.includes('\n') || cellValue.includes('"')) {
                cellValue = `"${cellValue.replace(/"/g, '""')}"`;
            }
            cells.push(cellValue);
        }

        if (hasData || row < 10) { // Always include first 10 rows
            rows.push(cells.join(','));
        }
    }

    // Trim trailing empty rows
    while (rows.length > 1 && rows[rows.length - 1].replace(/,/g, '') === '') {
        rows.pop();
    }

    return rows.join('\n');
}

// Import CSV to sheet
export function csvToSheet(csv: string, sheet: Sheet): Sheet {
    const lines = csv.split('\n');
    const newCells: Record<string, Cell> = {};

    for (let row = 0; row < lines.length; row++) {
        const line = lines[row];
        let col = 0;
        let i = 0;
        let currentValue = '';
        let inQuotes = false;

        while (i <= line.length) {
            const char = line[i];

            if (char === '"' && !inQuotes) {
                inQuotes = true;
            } else if (char === '"' && inQuotes) {
                if (line[i + 1] === '"') {
                    currentValue += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else if ((char === ',' || i === line.length) && !inQuotes) {
                if (currentValue.trim() !== '') {
                    const ref = createCellRef(col, row);
                    const numValue = parseFloat(currentValue);
                    newCells[ref] = {
                        value: isNaN(numValue) ? currentValue : numValue,
                    };
                }
                col++;
                currentValue = '';
            } else if (char !== undefined) {
                currentValue += char;
            }

            i++;
        }
    }

    return {
        ...sheet,
        cells: { ...sheet.cells, ...newCells },
    };
}
