// SuperSheet Storage - LocalStorage persistence

import { Workbook, Sheet, createWorkbook, sheetToCSV, csvToSheet } from './spreadsheet';

const STORAGE_KEY = 'supersheet_workbooks';
const ACTIVE_WORKBOOK_KEY = 'supersheet_active_workbook';

// Get all saved workbooks
export function getWorkbooks(): Workbook[] {
    if (typeof window === 'undefined') return [];

    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading workbooks:', error);
        return [];
    }
}

// Save workbooks to localStorage
export function saveWorkbooks(workbooks: Workbook[]): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workbooks));
    } catch (error) {
        console.error('Error saving workbooks:', error);
    }
}

// Get a specific workbook by ID
export function getWorkbook(id: string): Workbook | null {
    const workbooks = getWorkbooks();
    return workbooks.find(wb => wb.id === id) ?? null;
}

// Save a single workbook (creates or updates)
export function saveWorkbook(workbook: Workbook): void {
    const workbooks = getWorkbooks();
    const index = workbooks.findIndex(wb => wb.id === workbook.id);

    const updatedWorkbook = {
        ...workbook,
        updatedAt: Date.now(),
    };

    if (index >= 0) {
        workbooks[index] = updatedWorkbook;
    } else {
        workbooks.push(updatedWorkbook);
    }

    saveWorkbooks(workbooks);
}

// Delete a workbook
export function deleteWorkbook(id: string): void {
    const workbooks = getWorkbooks();
    const filtered = workbooks.filter(wb => wb.id !== id);
    saveWorkbooks(filtered);

    // If the deleted workbook was active, clear active
    if (getActiveWorkbookId() === id) {
        setActiveWorkbookId(null);
    }
}

// Get active workbook ID
export function getActiveWorkbookId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_WORKBOOK_KEY);
}

// Set active workbook ID
export function setActiveWorkbookId(id: string | null): void {
    if (typeof window === 'undefined') return;

    if (id) {
        localStorage.setItem(ACTIVE_WORKBOOK_KEY, id);
    } else {
        localStorage.removeItem(ACTIVE_WORKBOOK_KEY);
    }
}

// Get or create the active workbook
export function getOrCreateActiveWorkbook(): Workbook {
    const activeId = getActiveWorkbookId();

    if (activeId) {
        const workbook = getWorkbook(activeId);
        if (workbook) return workbook;
    }

    // No active workbook, check if any exist
    const workbooks = getWorkbooks();
    if (workbooks.length > 0) {
        setActiveWorkbookId(workbooks[0].id);
        return workbooks[0];
    }

    // Create new workbook
    const newWorkbook = createWorkbook('My Spreadsheet');
    saveWorkbook(newWorkbook);
    setActiveWorkbookId(newWorkbook.id);
    return newWorkbook;
}

// Export sheet to CSV file
export function exportSheetToCSV(sheet: Sheet, filename?: string): void {
    const csv = sheetToCSV(sheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename ?? `${sheet.name}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Import CSV file to sheet
export function importCSVToSheet(file: File, sheet: Sheet): Promise<Sheet> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const csv = e.target?.result as string;
                const updatedSheet = csvToSheet(csv, sheet);
                resolve(updatedSheet);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Export workbook to JSON file
export function exportWorkbookToJSON(workbook: Workbook): void {
    const json = JSON.stringify(workbook, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${workbook.name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Import workbook from JSON file
export function importWorkbookFromJSON(file: File): Promise<Workbook> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const json = e.target?.result as string;
                const workbook = JSON.parse(json) as Workbook;

                // Validate basic structure
                if (!workbook.id || !workbook.sheets || !Array.isArray(workbook.sheets)) {
                    throw new Error('Invalid workbook format');
                }

                // Generate new IDs to avoid conflicts
                workbook.id = `workbook_${Date.now()}`;
                workbook.createdAt = Date.now();
                workbook.updatedAt = Date.now();

                resolve(workbook);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Clear all spreadsheet data
export function clearAllSpreadsheetData(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_WORKBOOK_KEY);
}

// Get recent workbooks (last 5)
export function getRecentWorkbooks(): Workbook[] {
    const workbooks = getWorkbooks();
    return workbooks
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5);
}

// Duplicate a workbook
export function duplicateWorkbook(workbook: Workbook): Workbook {
    const duplicate: Workbook = {
        ...workbook,
        id: `workbook_${Date.now()}`,
        name: `${workbook.name} (Copy)`,
        sheets: workbook.sheets.map(sheet => ({
            ...sheet,
            id: `sheet_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            cells: { ...sheet.cells },
            columnWidths: { ...sheet.columnWidths },
            rowHeights: { ...sheet.rowHeights },
        })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    duplicate.activeSheetId = duplicate.sheets[0]?.id ?? '';

    saveWorkbook(duplicate);
    return duplicate;
}

// Rename workbook
export function renameWorkbook(id: string, newName: string): void {
    const workbook = getWorkbook(id);
    if (workbook) {
        workbook.name = newName;
        saveWorkbook(workbook);
    }
}
