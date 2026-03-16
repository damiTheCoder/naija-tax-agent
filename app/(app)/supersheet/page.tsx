"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    Sheet,
    Workbook,
    createWorkbook,
    createSheet,
    isFormula,
    createCellRef,
    parseCellRef,
} from '@/lib/supersheet/spreadsheet';
import { evaluateFormula, recalculateSheet } from '@/lib/supersheet/formulaEngine';
import {
    getOrCreateActiveWorkbook,
    saveWorkbook,
    exportSheetToCSV,
    importCSVToSheet,
} from '@/lib/supersheet/sheetStorage';
import SpreadsheetGrid from '@/components/supersheet/SpreadsheetGrid';
import SheetToolbar from '@/components/supersheet/SheetToolbar';
import FormulaBar from '@/components/supersheet/FormulaBar';
import SheetChatPanel from '@/components/supersheet/SheetChatPanel';

interface HistoryState {
    sheets: Sheet[];
    activeSheetId: string;
}

export default function SuperSheetPage() {
    const [workbook, setWorkbook] = useState<Workbook | null>(null);
    const [selectedCell, setSelectedCell] = useState<string>('A1');
    const [selectedRange, setSelectedRange] = useState<string[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Undo/Redo history
    const [history, setHistory] = useState<HistoryState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoRedo = useRef(false);

    // CSV import ref
    const csvInputRef = useRef<HTMLInputElement>(null);

    // Load workbook on mount
    useEffect(() => {
        const loadWorkbook = async () => {
            try {
                const wb = getOrCreateActiveWorkbook();
                setWorkbook(wb);
                // Initialize history
                setHistory([{ sheets: wb.sheets, activeSheetId: wb.activeSheetId }]);
                setHistoryIndex(0);
            } catch (error) {
                console.error('Error loading workbook:', error);
                // Create new workbook on error
                const newWb = createWorkbook('My Spreadsheet');
                setWorkbook(newWb);
                saveWorkbook(newWb);
            } finally {
                setIsLoading(false);
            }
        };

        loadWorkbook();
    }, []);

    // Save workbook on changes
    useEffect(() => {
        if (workbook && !isLoading) {
            saveWorkbook(workbook);
        }
    }, [workbook, isLoading]);

    // Get active sheet
    const activeSheet = workbook?.sheets.find(s => s.id === workbook.activeSheetId);

    // Save history state
    const saveToHistory = useCallback((newSheets: Sheet[], activeSheetId: string) => {
        if (isUndoRedo.current) {
            isUndoRedo.current = false;
            return;
        }

        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push({ sheets: newSheets, activeSheetId });
            // Limit history size
            if (newHistory.length > 50) {
                newHistory.shift();
            }
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    }, [historyIndex]);

    // Handle sheet change
    const handleSheetChange = useCallback((updatedSheet: Sheet) => {
        if (!workbook) return;

        const newSheets = workbook.sheets.map(s =>
            s.id === updatedSheet.id ? updatedSheet : s
        );

        const newWorkbook = {
            ...workbook,
            sheets: newSheets,
            updatedAt: Date.now(),
        };

        setWorkbook(newWorkbook);
        saveToHistory(newSheets, workbook.activeSheetId);
    }, [workbook, saveToHistory]);

    // Handle cell select
    const handleCellSelect = useCallback((ref: string) => {
        setSelectedCell(ref);
        setSelectedRange([]);

        // Reset editing state
        if (isEditing) {
            setIsEditing(false);
            setEditValue('');
        }
    }, [isEditing]);

    // Start editing
    const handleEditStart = useCallback(() => {
        if (!activeSheet) return;
        setIsEditing(true);
        const cell = activeSheet.cells[selectedCell];
        setEditValue(cell?.formula || String(cell?.value ?? ''));
    }, [activeSheet, selectedCell]);

    // Commit edit
    const handleEditCommit = useCallback(() => {
        if (!activeSheet || !isEditing) return;

        const newValue = editValue.trim();
        const cell = activeSheet.cells[selectedCell] || {};

        let updatedCell;
        if (isFormula(newValue)) {
            const result = evaluateFormula(newValue, activeSheet);
            updatedCell = {
                ...cell,
                formula: newValue,
                value: result,
                displayValue: String(result),
            };
        } else {
            const numValue = parseFloat(newValue);
            updatedCell = {
                ...cell,
                formula: undefined,
                value: isNaN(numValue) ? newValue : numValue,
                displayValue: newValue,
            };
        }

        const newCells = { ...activeSheet.cells, [selectedCell]: updatedCell };
        let newSheet = { ...activeSheet, cells: newCells };
        newSheet = recalculateSheet(newSheet);

        handleSheetChange(newSheet);
        setIsEditing(false);
        setEditValue('');
    }, [activeSheet, selectedCell, editValue, isEditing, handleSheetChange]);

    // Cancel edit
    const handleEditCancel = useCallback(() => {
        setIsEditing(false);
        setEditValue('');
    }, []);

    // Handle formula insert from chat
    const handleFormulaInsert = useCallback((formula: string, targetCell: string) => {
        if (!activeSheet) return;

        const result = evaluateFormula(formula, activeSheet);
        const updatedCell = {
            ...activeSheet.cells[targetCell],
            formula,
            value: result,
            displayValue: String(result),
        };

        const newCells = { ...activeSheet.cells, [targetCell]: updatedCell };
        let newSheet = { ...activeSheet, cells: newCells };
        newSheet = recalculateSheet(newSheet);

        handleSheetChange(newSheet);
    }, [activeSheet, handleSheetChange]);

    // Undo
    const handleUndo = useCallback(() => {
        if (historyIndex <= 0 || !workbook) return;

        isUndoRedo.current = true;
        const prevState = history[historyIndex - 1];

        setWorkbook({
            ...workbook,
            sheets: prevState.sheets,
            activeSheetId: prevState.activeSheetId,
        });
        setHistoryIndex(historyIndex - 1);
    }, [history, historyIndex, workbook]);

    // Redo
    const handleRedo = useCallback(() => {
        if (historyIndex >= history.length - 1 || !workbook) return;

        isUndoRedo.current = true;
        const nextState = history[historyIndex + 1];

        setWorkbook({
            ...workbook,
            sheets: nextState.sheets,
            activeSheetId: nextState.activeSheetId,
        });
        setHistoryIndex(historyIndex + 1);
    }, [history, historyIndex, workbook]);

    // Export to CSV
    const handleExport = useCallback(() => {
        if (!activeSheet) return;
        exportSheetToCSV(activeSheet, `${workbook?.name || 'sheet'}.csv`);
    }, [activeSheet, workbook]);

    // Import from CSV
    const handleImport = useCallback(() => {
        csvInputRef.current?.click();
    }, []);

    const handleCSVFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeSheet) return;

        try {
            const updatedSheet = await importCSVToSheet(file, activeSheet);
            handleSheetChange(recalculateSheet(updatedSheet));
        } catch (error) {
            console.error('Error importing CSV:', error);
            alert('Failed to import CSV file');
        }

        // Reset input
        if (csvInputRef.current) {
            csvInputRef.current.value = '';
        }
    }, [activeSheet, handleSheetChange]);

    // Add new sheet
    const handleAddSheet = useCallback(() => {
        if (!workbook) return;

        const newSheet = createSheet(
            `sheet_${Date.now()}`,
            `Sheet ${workbook.sheets.length + 1}`
        );

        const newWorkbook = {
            ...workbook,
            sheets: [...workbook.sheets, newSheet],
            activeSheetId: newSheet.id,
            updatedAt: Date.now(),
        };

        setWorkbook(newWorkbook);
        saveToHistory(newWorkbook.sheets, newSheet.id);
    }, [workbook, saveToHistory]);

    // Switch sheet
    const handleSwitchSheet = useCallback((sheetId: string) => {
        if (!workbook) return;

        setWorkbook({
            ...workbook,
            activeSheetId: sheetId,
        });
    }, [workbook]);

    // Rename workbook
    const handleRenameWorkbook = useCallback((newName: string) => {
        if (!workbook) return;

        setWorkbook({
            ...workbook,
            name: newName,
            updatedAt: Date.now(),
        });
    }, [workbook]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                handleRedo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-[#0a0a0a]">
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-600 dark:text-gray-400">Loading spreadsheet...</p>
                </div>
            </div>
        );
    }

    if (!workbook || !activeSheet) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-[#0a0a0a]">
                <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400">Error loading workbook</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        Reload
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#0a0a0a]">
            {/* Hidden CSV input */}
            <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVFileChange}
                className="hidden"
            />

            {/* Header */}
            <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-700">
                {/* Logo/Title */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                        </svg>
                    </div>
                    <div>
                        <input
                            type="text"
                            value={workbook.name}
                            onChange={(e) => handleRenameWorkbook(e.target.value)}
                            className="text-lg font-semibold text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -ml-1"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            SuperSheet
                        </p>
                    </div>
                </div>

                <div className="flex-1" />

                {/* Quick stats */}
                <div className="hidden md:flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
                        {Object.keys(activeSheet.cells).length} cells
                    </span>
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                        ✓ Saved
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <SheetToolbar
                sheet={activeSheet}
                selectedCell={selectedCell}
                selectedRange={selectedRange}
                onSheetChange={handleSheetChange}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onExport={handleExport}
                onImport={handleImport}
                canUndo={historyIndex > 0}
                canRedo={historyIndex < history.length - 1}
            />

            {/* Formula Bar */}
            <FormulaBar
                sheet={activeSheet}
                selectedCell={selectedCell}
                editValue={editValue}
                isEditing={isEditing}
                onEditValueChange={setEditValue}
                onEditStart={handleEditStart}
                onEditCommit={handleEditCommit}
                onEditCancel={handleEditCancel}
            />

            {/* Spreadsheet Grid */}
            <div className="flex-1 overflow-hidden">
                <SpreadsheetGrid
                    sheet={activeSheet}
                    onSheetChange={handleSheetChange}
                    onCellSelect={handleCellSelect}
                    selectedCell={selectedCell}
                />
            </div>

            {/* Sheet Tabs */}
            <div className="flex items-center gap-1 px-2 py-2 bg-gray-100 dark:bg-[#151515] border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
                {workbook.sheets.map((sheet) => (
                    <button
                        key={sheet.id}
                        onClick={() => handleSwitchSheet(sheet.id)}
                        className={`
              px-4 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap
              ${sheet.id === workbook.activeSheetId
                                ? 'bg-white dark:bg-[#252525] text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                            }
            `}
                    >
                        {sheet.name}
                    </button>
                ))}
                <button
                    onClick={handleAddSheet}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                    title="Add Sheet"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            {/* AI Chat Panel */}
            <SheetChatPanel
                sheet={activeSheet}
                onSheetChange={handleSheetChange}
                onFormulaInsert={handleFormulaInsert}
                selectedCell={selectedCell}
            />
        </div>
    );
}
