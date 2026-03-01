"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Sheet,
    Cell,
    DEFAULT_COLUMN_WIDTH,
    DEFAULT_ROW_HEIGHT,
    DEFAULT_COLUMNS,
    DEFAULT_ROWS,
    columnIndexToLetter,
    createCellRef,
    parseCellRef,
    isFormula,
    formatCellValue,
} from '@/lib/supersheet/spreadsheet';
import { evaluateFormula, recalculateSheet } from '@/lib/supersheet/formulaEngine';

interface SpreadsheetGridProps {
    sheet: Sheet;
    onSheetChange: (sheet: Sheet) => void;
    onCellSelect?: (ref: string) => void;
    selectedCell?: string;
}

export default function SpreadsheetGrid({
    sheet,
    onSheetChange,
    onCellSelect,
    selectedCell: externalSelectedCell,
}: SpreadsheetGridProps) {
    const [selectedCell, setSelectedCell] = useState<string>(externalSelectedCell || 'A1');
    const activeSelectedCell = externalSelectedCell || selectedCell;
    const [editingCell, setEditingCell] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [selectedRange, setSelectedRange] = useState<string[]>([]);
    const gridRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Column resize state
    const [resizingCol, setResizingCol] = useState<number | null>(null);
    const [resizeStartX, setResizeStartX] = useState<number>(0);
    const [resizeStartWidth, setResizeStartWidth] = useState<number>(0);

    // Focus input when editing
    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingCell]);

    // Get column width
    const getColumnWidth = useCallback((col: number): number => {
        const letter = columnIndexToLetter(col);
        return sheet.columnWidths[letter] || DEFAULT_COLUMN_WIDTH;
    }, [sheet.columnWidths]);

    // Get row height
    const getRowHeight = useCallback((row: number): number => {
        return sheet.rowHeights[row] || DEFAULT_ROW_HEIGHT;
    }, [sheet.rowHeights]);

    // Handle cell click
    const handleCellClick = useCallback((ref: string, e: React.MouseEvent) => {
        if (e.shiftKey && activeSelectedCell) {
            // Range selection
            const start = parseCellRef(activeSelectedCell);
            const end = parseCellRef(ref);
            if (start && end) {
                const range: string[] = [];
                const minCol = Math.min(start.col, end.col);
                const maxCol = Math.max(start.col, end.col);
                const minRow = Math.min(start.row, end.row);
                const maxRow = Math.max(start.row, end.row);

                for (let r = minRow; r <= maxRow; r++) {
                    for (let c = minCol; c <= maxCol; c++) {
                        range.push(createCellRef(c, r));
                    }
                }
                setSelectedRange(range);
            }
        } else {
            setSelectedCell(ref);
            setSelectedRange([]);
            onCellSelect?.(ref);
        }
    }, [activeSelectedCell, onCellSelect]);

    // Handle cell double-click (start editing)
    const handleCellDoubleClick = useCallback((ref: string) => {
        setEditingCell(ref);
        const cell = sheet.cells[ref];
        setEditValue(cell?.formula || String(cell?.value ?? ''));
    }, [sheet.cells]);

    // Stop editing and save
    const commitEdit = useCallback(() => {
        if (!editingCell) return;

        const newValue = editValue.trim();
        const cell = sheet.cells[editingCell] || {};

        let updatedCell: Cell;

        if (isFormula(newValue)) {
            // It's a formula
            const result = evaluateFormula(newValue, sheet);
            updatedCell = {
                ...cell,
                formula: newValue,
                value: result,
                displayValue: String(result),
            };
        } else {
            // Plain value
            const numValue = parseFloat(newValue);
            updatedCell = {
                ...cell,
                formula: undefined,
                value: isNaN(numValue) ? newValue : numValue,
                displayValue: newValue,
            };
        }

        const newCells = { ...sheet.cells, [editingCell]: updatedCell };
        let newSheet = { ...sheet, cells: newCells };

        // Recalculate dependent cells
        newSheet = recalculateSheet(newSheet);

        onSheetChange(newSheet);
        setEditingCell(null);
        setEditValue('');
    }, [editingCell, editValue, sheet, onSheetChange]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (editingCell) {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitEdit();
                // Move to next row
                const parsed = parseCellRef(editingCell);
                if (parsed && parsed.row < DEFAULT_ROWS - 1) {
                    const nextRef = createCellRef(parsed.col, parsed.row + 1);
                    setSelectedCell(nextRef);
                    onCellSelect?.(nextRef);
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                commitEdit();
                // Move to next column
                const parsed = parseCellRef(editingCell);
                if (parsed && parsed.col < DEFAULT_COLUMNS - 1) {
                    const nextRef = createCellRef(parsed.col + 1, parsed.row);
                    setSelectedCell(nextRef);
                    onCellSelect?.(nextRef);
                }
            } else if (e.key === 'Escape') {
                setEditingCell(null);
                setEditValue('');
            }
            return;
        }

        const parsed = parseCellRef(activeSelectedCell);
        if (!parsed) return;

        let newCol = parsed.col;
        let newRow = parsed.row;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                newRow = Math.max(0, newRow - 1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                newRow = Math.min(DEFAULT_ROWS - 1, newRow + 1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                newCol = Math.max(0, newCol - 1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                newCol = Math.min(DEFAULT_COLUMNS - 1, newCol + 1);
                break;
            case 'Enter':
                e.preventDefault();
                handleCellDoubleClick(activeSelectedCell);
                return;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                // Clear cell
                if (selectedRange.length > 0) {
                    const newCells = { ...sheet.cells };
                    selectedRange.forEach(ref => delete newCells[ref]);
                    onSheetChange({ ...sheet, cells: newCells });
                } else {
                    const newCells = { ...sheet.cells };
                    delete newCells[activeSelectedCell];
                    onSheetChange({ ...sheet, cells: newCells });
                }
                return;
            default:
                // Start typing in cell
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                    setEditingCell(activeSelectedCell);
                    setEditValue(e.key);
                    e.preventDefault();
                }
                return;
        }

        const newRef = createCellRef(newCol, newRow);
        setSelectedCell(newRef);
        setSelectedRange([]);
        onCellSelect?.(newRef);
    }, [activeSelectedCell, editingCell, selectedRange, sheet, onSheetChange, onCellSelect, commitEdit, handleCellDoubleClick]);

    // Handle column resize
    const handleResizeStart = useCallback((col: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setResizingCol(col);
        setResizeStartX(e.clientX);
        setResizeStartWidth(getColumnWidth(col));
    }, [getColumnWidth]);

    // Handle resize move
    useEffect(() => {
        if (resizingCol === null) return;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - resizeStartX;
            const newWidth = Math.max(40, resizeStartWidth + delta);
            const letter = columnIndexToLetter(resizingCol);

            onSheetChange({
                ...sheet,
                columnWidths: {
                    ...sheet.columnWidths,
                    [letter]: newWidth,
                },
            });
        };

        const handleMouseUp = () => {
            setResizingCol(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingCol, resizeStartX, resizeStartWidth, sheet, onSheetChange]);

    // Check if cell is in selection
    const isSelected = useCallback((ref: string): boolean => {
        if (selectedRange.length > 0) {
            return selectedRange.includes(ref);
        }
        return ref === activeSelectedCell;
    }, [activeSelectedCell, selectedRange]);

    // Get cell display value
    const getCellDisplay = useCallback((ref: string): string => {
        const cell = sheet.cells[ref];
        if (!cell) return '';
        return cell.displayValue ?? formatCellValue(cell.value, cell.format);
    }, [sheet.cells]);

    // Get cell style
    const getCellStyle = useCallback((ref: string): React.CSSProperties => {
        const cell = sheet.cells[ref];
        const style = cell?.style || {};

        return {
            fontWeight: style.bold ? 'bold' : 'normal',
            fontStyle: style.italic ? 'italic' : 'normal',
            textDecoration: style.underline ? 'underline' : 'none',
            textAlign: style.textAlign || 'left',
            backgroundColor: style.backgroundColor || 'transparent',
            color: style.textColor || 'inherit',
        };
    }, [sheet.cells]);

    return (
        <div
            ref={gridRef}
            className="relative w-full h-full overflow-auto bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg"
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            <table className="border-collapse min-w-max">
                {/* Header row */}
                <thead className="sticky top-0 z-20">
                    <tr>
                        {/* Corner cell */}
                        <th
                            className="sticky left-0 z-30 w-12 h-7 bg-gray-100 dark:bg-[#252525] border-r border-b border-gray-300 dark:border-gray-600"
                        />
                        {/* Column headers */}
                        {Array.from({ length: DEFAULT_COLUMNS }, (_, i) => (
                            <th
                                key={i}
                                className="relative h-7 bg-gray-100 dark:bg-[#252525] border-r border-b border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 select-none"
                                style={{ width: getColumnWidth(i), minWidth: getColumnWidth(i) }}
                            >
                                {columnIndexToLetter(i)}
                                {/* Resize handle */}
                                <div
                                    className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors"
                                    onMouseDown={(e) => handleResizeStart(i, e)}
                                />
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {Array.from({ length: DEFAULT_ROWS }, (_, rowIndex) => (
                        <tr key={rowIndex}>
                            {/* Row header */}
                            <td
                                className="sticky left-0 z-10 w-12 bg-gray-100 dark:bg-[#252525] border-r border-b border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 text-center select-none"
                                style={{ height: getRowHeight(rowIndex) }}
                            >
                                {rowIndex + 1}
                            </td>

                            {/* Data cells */}
                            {Array.from({ length: DEFAULT_COLUMNS }, (_, colIndex) => {
                                const ref = createCellRef(colIndex, rowIndex);
                                const isEditing = editingCell === ref;
                                const isSel = isSelected(ref);

                                return (
                                    <td
                                        key={colIndex}
                                        className={`
                      relative border-r border-b border-gray-200 dark:border-gray-700 
                      ${isSel && !isEditing ? 'ring-2 ring-blue-500 ring-inset bg-blue-50 dark:bg-blue-900/20' : ''}
                      hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-cell
                    `}
                                        style={{
                                            width: getColumnWidth(colIndex),
                                            minWidth: getColumnWidth(colIndex),
                                            height: getRowHeight(rowIndex),
                                            ...getCellStyle(ref),
                                        }}
                                        onClick={(e) => handleCellClick(ref, e)}
                                        onDoubleClick={() => handleCellDoubleClick(ref)}
                                    >
                                        {isEditing ? (
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={commitEdit}
                                                className="absolute inset-0 w-full h-full px-1 bg-white dark:bg-[#252525] border-2 border-blue-500 outline-none text-sm"
                                                style={getCellStyle(ref)}
                                            />
                                        ) : (
                                            <div className="px-1 text-sm truncate h-full flex items-center">
                                                {getCellDisplay(ref)}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
