"use client";

import React from 'react';
import { Sheet, isFormula } from '@/lib/supersheet/spreadsheet';
import { getAvailableFunctions } from '@/lib/supersheet/formulaEngine';

interface FormulaBarProps {
    sheet: Sheet;
    selectedCell: string;
    editValue: string;
    isEditing: boolean;
    onEditValueChange: (value: string) => void;
    onEditStart: () => void;
    onEditCommit: () => void;
    onEditCancel: () => void;
}

export default function FormulaBar({
    sheet,
    selectedCell,
    editValue,
    isEditing,
    onEditValueChange,
    onEditStart,
    onEditCommit,
    onEditCancel,
}: FormulaBarProps) {
    const cell = sheet.cells[selectedCell];
    const displayValue = isEditing
        ? editValue
        : cell?.formula || String(cell?.value ?? '');

    const [showFunctionHelp, setShowFunctionHelp] = React.useState(false);
    const [filteredFunctions, setFilteredFunctions] = React.useState<ReturnType<typeof getAvailableFunctions>>([]);

    // Update function suggestions based on input
    React.useEffect(() => {
        if (isEditing && editValue.startsWith('=')) {
            const match = editValue.match(/=([A-Z]+)$/i);
            if (match) {
                const query = match[1].toUpperCase();
                const functions = getAvailableFunctions().filter(f =>
                    f.name.startsWith(query)
                );
                setFilteredFunctions(functions);
                setShowFunctionHelp(functions.length > 0);
            } else {
                setShowFunctionHelp(false);
            }
        } else {
            setShowFunctionHelp(false);
        }
    }, [editValue, isEditing]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onEditCommit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onEditCancel();
        }
    };

    const insertFunction = (funcName: string) => {
        const match = editValue.match(/=([A-Z]*)$/i);
        if (match) {
            const newValue = editValue.slice(0, editValue.length - match[1].length) + funcName + '(';
            onEditValueChange(newValue);
        }
        setShowFunctionHelp(false);
    };

    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-700">
            {/* Cell reference badge */}
            <div className="flex-shrink-0 px-3 py-1.5 bg-gray-100 dark:bg-[#252525] rounded text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[60px] text-center border border-gray-200 dark:border-gray-600">
                {selectedCell}
            </div>

            {/* Function button */}
            <button
                onClick={() => {
                    if (!isEditing) {
                        onEditStart();
                    }
                    onEditValueChange(editValue.startsWith('=') ? editValue : '=' + editValue);
                }}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                title="Insert Function"
            >
                <span className="text-lg font-serif italic">fx</span>
            </button>

            {/* Formula/Value input */}
            <div className="relative flex-1">
                <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => {
                        if (!isEditing) onEditStart();
                        onEditValueChange(e.target.value);
                    }}
                    onFocus={onEditStart}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter value or formula..."
                    className="w-full px-3 py-1.5 bg-transparent border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                {/* Function autocomplete dropdown */}
                {showFunctionHelp && filteredFunctions.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-80 max-h-60 overflow-y-auto bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50">
                        {filteredFunctions.map((func) => (
                            <button
                                key={func.name}
                                onClick={() => insertFunction(func.name)}
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
                                        {func.name}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {func.syntax}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                    {func.description}
                                </p>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Action buttons when editing */}
            {isEditing && (
                <div className="flex items-center gap-1">
                    <button
                        onClick={onEditCancel}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                        title="Cancel (Esc)"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <button
                        onClick={onEditCommit}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400"
                        title="Confirm (Enter)"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Cell info */}
            {!isEditing && cell && (
                <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {cell.formula ? (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                            Formula
                        </span>
                    ) : typeof cell.value === 'number' ? (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                            Number
                        </span>
                    ) : cell.value ? (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                            Text
                        </span>
                    ) : null}
                </div>
            )}
        </div>
    );
}
