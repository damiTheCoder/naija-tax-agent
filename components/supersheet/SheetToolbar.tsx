"use client";

import React from 'react';
import { Sheet, Cell, CellFormat, CellStyle } from '@/lib/supersheet/spreadsheet';

interface SheetToolbarProps {
    sheet: Sheet;
    selectedCell: string;
    selectedRange: string[];
    onSheetChange: (sheet: Sheet) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onExport?: () => void;
    onImport?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
}

export default function SheetToolbar({
    sheet,
    selectedCell,
    selectedRange,
    onSheetChange,
    onUndo,
    onRedo,
    onExport,
    onImport,
    canUndo = false,
    canRedo = false,
}: SheetToolbarProps) {
    // Get current cell(s)
    const cells = selectedRange.length > 0
        ? selectedRange.map(ref => sheet.cells[ref]).filter(Boolean)
        : [sheet.cells[selectedCell]].filter(Boolean);

    // Get common style from selected cells
    const getCommonStyle = (): Partial<CellStyle> => {
        if (cells.length === 0) return {};
        const first = cells[0]?.style || {};
        return {
            bold: cells.every(c => c?.style?.bold === first.bold) ? first.bold : undefined,
            italic: cells.every(c => c?.style?.italic === first.italic) ? first.italic : undefined,
            underline: cells.every(c => c?.style?.underline === first.underline) ? first.underline : undefined,
            textAlign: cells.every(c => c?.style?.textAlign === first.textAlign) ? first.textAlign : undefined,
        };
    };

    const commonStyle = getCommonStyle();

    // Apply style to selected cells
    const applyStyle = (styleUpdate: Partial<CellStyle>) => {
        const refs = selectedRange.length > 0 ? selectedRange : [selectedCell];
        const newCells = { ...sheet.cells };

        refs.forEach(ref => {
            const cell = newCells[ref] || { value: null };
            newCells[ref] = {
                ...cell,
                style: {
                    ...cell.style,
                    ...styleUpdate,
                },
            };
        });

        onSheetChange({ ...sheet, cells: newCells });
    };

    // Apply format to selected cells
    const applyFormat = (format: CellFormat) => {
        const refs = selectedRange.length > 0 ? selectedRange : [selectedCell];
        const newCells = { ...sheet.cells };

        refs.forEach(ref => {
            const cell = newCells[ref] || { value: null };
            newCells[ref] = {
                ...cell,
                format,
            };
        });

        onSheetChange({ ...sheet, cells: newCells });
    };

    // Toggle boolean style
    const toggleStyle = (styleProp: keyof CellStyle) => {
        const currentValue = commonStyle[styleProp];
        applyStyle({ [styleProp]: !currentValue });
    };

    // Button component
    const ToolButton = ({
        onClick,
        active = false,
        disabled = false,
        title,
        children
    }: {
        onClick: () => void;
        active?: boolean;
        disabled?: boolean;
        title: string;
        children: React.ReactNode;
    }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`
        w-8 h-8 flex items-center justify-center rounded transition-colors
        ${active
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
        >
            {children}
        </button>
    );

    // Divider component
    const Divider = () => (
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
    );

    return (
        <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-700 flex-wrap">
            {/* Undo/Redo */}
            <ToolButton onClick={onUndo || (() => { })} disabled={!canUndo} title="Undo (Ctrl+Z)">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
            </ToolButton>
            <ToolButton onClick={onRedo || (() => { })} disabled={!canRedo} title="Redo (Ctrl+Y)">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
            </ToolButton>

            <Divider />

            {/* Text formatting */}
            <ToolButton onClick={() => toggleStyle('bold')} active={commonStyle.bold} title="Bold (Ctrl+B)">
                <span className="font-bold text-sm">B</span>
            </ToolButton>
            <ToolButton onClick={() => toggleStyle('italic')} active={commonStyle.italic} title="Italic (Ctrl+I)">
                <span className="italic text-sm">I</span>
            </ToolButton>
            <ToolButton onClick={() => toggleStyle('underline')} active={commonStyle.underline} title="Underline (Ctrl+U)">
                <span className="underline text-sm">U</span>
            </ToolButton>

            <Divider />

            {/* Text alignment */}
            <ToolButton
                onClick={() => applyStyle({ textAlign: 'left' })}
                active={commonStyle.textAlign === 'left'}
                title="Align Left"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
                </svg>
            </ToolButton>
            <ToolButton
                onClick={() => applyStyle({ textAlign: 'center' })}
                active={commonStyle.textAlign === 'center'}
                title="Align Center"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
                </svg>
            </ToolButton>
            <ToolButton
                onClick={() => applyStyle({ textAlign: 'right' })}
                active={commonStyle.textAlign === 'right'}
                title="Align Right"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
                </svg>
            </ToolButton>

            <Divider />

            {/* Number formats */}
            <div className="relative group">
                <button
                    className="h-8 px-2 flex items-center gap-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm"
                    title="Number Format"
                >
                    <span>123</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px]">
                    <button
                        onClick={() => applyFormat({ type: 'number', decimals: 0 })}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                        <span className="w-16 text-gray-500">1234</span>
                        <span>Number</span>
                    </button>
                    <button
                        onClick={() => applyFormat({ type: 'number', decimals: 2 })}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                        <span className="w-16 text-gray-500">1234.56</span>
                        <span>Decimal</span>
                    </button>
                    <button
                        onClick={() => applyFormat({ type: 'currency', currencySymbol: '₦', decimals: 2 })}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                        <span className="w-16 text-gray-500">₦1,234</span>
                        <span>Currency (₦)</span>
                    </button>
                    <button
                        onClick={() => applyFormat({ type: 'currency', currencySymbol: '$', decimals: 2 })}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                        <span className="w-16 text-gray-500">$1,234</span>
                        <span>Currency ($)</span>
                    </button>
                    <button
                        onClick={() => applyFormat({ type: 'percentage', decimals: 0 })}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                        <span className="w-16 text-gray-500">12%</span>
                        <span>Percentage</span>
                    </button>
                    <button
                        onClick={() => applyFormat({ type: 'text' })}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                        <span className="w-16 text-gray-500">Abc</span>
                        <span>Plain Text</span>
                    </button>
                </div>
            </div>

            <Divider />

            {/* Colors */}
            <div className="relative group">
                <button
                    className="h-8 px-2 flex items-center gap-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    title="Background Color"
                >
                    <div className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600 bg-yellow-200" />
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2">
                    <div className="grid grid-cols-6 gap-1">
                        {[
                            'transparent', '#ffffff', '#f3f4f6', '#fef3c7', '#d1fae5', '#dbeafe',
                            '#fce7f3', '#e9d5ff', '#fed7d7', '#ffedd5', '#fef9c3', '#cffafe',
                            '#fecaca', '#fcd34d', '#86efac', '#93c5fd', '#f9a8d4', '#c4b5fd',
                        ].map(color => (
                            <button
                                key={color}
                                onClick={() => applyStyle({ backgroundColor: color === 'transparent' ? undefined : color })}
                                className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                                style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }}
                                title={color === 'transparent' ? 'No fill' : color}
                            >
                                {color === 'transparent' && (
                                    <svg className="w-full h-full text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="relative group">
                <button
                    className="h-8 px-2 flex items-center gap-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    title="Text Color"
                >
                    <span className="text-sm font-bold" style={{ color: '#ef4444' }}>A</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2">
                    <div className="grid grid-cols-6 gap-1">
                        {[
                            '#000000', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#ffffff',
                            '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed',
                            '#db2777', '#0891b2', '#059669', '#4f46e5', '#be185d', '#0d9488',
                        ].map(color => (
                            <button
                                key={color}
                                onClick={() => applyStyle({ textColor: color })}
                                className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform flex items-center justify-center"
                                style={{ backgroundColor: color === '#ffffff' ? '#f3f4f6' : color }}
                                title={color}
                            >
                                {color === '#ffffff' && <span className="text-xs font-bold text-gray-600">A</span>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1" />

            {/* Import/Export */}
            <ToolButton onClick={onImport || (() => { })} title="Import CSV">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
            </ToolButton>
            <ToolButton onClick={onExport || (() => { })} title="Export CSV">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </ToolButton>
        </div>
    );
}
