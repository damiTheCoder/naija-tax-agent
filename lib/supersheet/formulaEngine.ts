// SuperSheet Formula Engine

import { Sheet, parseCellRange, getCellValue, isFormula } from './spreadsheet';

// Supported functions
type FormulaFunction = (args: (number | string | null)[], sheet: Sheet) => number | string;

// Token types for formula parsing
type TokenType = 'NUMBER' | 'STRING' | 'CELL_REF' | 'RANGE' | 'FUNCTION' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'COMMA';

interface Token {
    type: TokenType;
    value: string;
}

// Tokenize formula string
function tokenize(formula: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const str = formula.startsWith('=') ? formula.slice(1) : formula;

    while (i < str.length) {
        const char = str[i];

        // Skip whitespace
        if (/\s/.test(char)) {
            i++;
            continue;
        }

        // Numbers
        if (/[\d.]/.test(char)) {
            let num = '';
            while (i < str.length && /[\d.]/.test(str[i])) {
                num += str[i++];
            }
            tokens.push({ type: 'NUMBER', value: num });
            continue;
        }

        // Strings (quoted)
        if (char === '"' || char === "'") {
            const quote = char;
            let strVal = '';
            i++; // Skip opening quote
            while (i < str.length && str[i] !== quote) {
                strVal += str[i++];
            }
            i++; // Skip closing quote
            tokens.push({ type: 'STRING', value: strVal });
            continue;
        }

        // Cell references, ranges, or function names
        if (/[A-Za-z]/.test(char)) {
            let name = '';
            while (i < str.length && /[A-Za-z0-9]/.test(str[i])) {
                name += str[i++];
            }

            // Check if it's a range (A1:B5)
            if (str[i] === ':') {
                i++; // Skip colon
                let endRef = '';
                while (i < str.length && /[A-Za-z0-9]/.test(str[i])) {
                    endRef += str[i++];
                }
                tokens.push({ type: 'RANGE', value: `${name}:${endRef}` });
            } else if (str[i] === '(') {
                // It's a function
                tokens.push({ type: 'FUNCTION', value: name.toUpperCase() });
            } else if (/^[A-Za-z]\d+$/.test(name)) {
                // It's a cell reference
                tokens.push({ type: 'CELL_REF', value: name.toUpperCase() });
            } else {
                // Unknown identifier, treat as string
                tokens.push({ type: 'STRING', value: name });
            }
            continue;
        }

        // Operators
        if (/[+\-*/<>=&|^%]/.test(char)) {
            let op = char;
            // Handle multi-char operators (>=, <=, <>, etc.)
            if ((char === '<' || char === '>' || char === '=') && /[=><]/.test(str[i + 1])) {
                op += str[++i];
            }
            tokens.push({ type: 'OPERATOR', value: op });
            i++;
            continue;
        }

        // Parentheses
        if (char === '(') {
            tokens.push({ type: 'LPAREN', value: '(' });
            i++;
            continue;
        }
        if (char === ')') {
            tokens.push({ type: 'RPAREN', value: ')' });
            i++;
            continue;
        }

        // Comma
        if (char === ',') {
            tokens.push({ type: 'COMMA', value: ',' });
            i++;
            continue;
        }

        // Unknown character, skip
        i++;
    }

    return tokens;
}

// Get numeric values from a range
function getRangeValues(range: string, sheet: Sheet): number[] {
    const cells = parseCellRange(range);
    const values: number[] = [];

    for (const ref of cells) {
        const val = getCellValue(sheet, ref);
        if (typeof val === 'number') {
            values.push(val);
        } else if (typeof val === 'string') {
            const num = parseFloat(val);
            if (!isNaN(num)) values.push(num);
        }
    }

    return values;
}

// Built-in functions
const functions: Record<string, FormulaFunction> = {
    SUM: (args, sheet) => {
        let total = 0;
        for (const arg of args) {
            if (typeof arg === 'number') {
                total += arg;
            } else if (typeof arg === 'string' && arg.includes(':')) {
                // It's a range
                total += getRangeValues(arg, sheet).reduce((a, b) => a + b, 0);
            }
        }
        return total;
    },

    AVG: (args, sheet) => {
        const values: number[] = [];
        for (const arg of args) {
            if (typeof arg === 'number') {
                values.push(arg);
            } else if (typeof arg === 'string' && arg.includes(':')) {
                values.push(...getRangeValues(arg, sheet));
            }
        }
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    },

    AVERAGE: (args, sheet) => functions.AVG(args, sheet),

    MIN: (args, sheet) => {
        const values: number[] = [];
        for (const arg of args) {
            if (typeof arg === 'number') {
                values.push(arg);
            } else if (typeof arg === 'string' && arg.includes(':')) {
                values.push(...getRangeValues(arg, sheet));
            }
        }
        return values.length > 0 ? Math.min(...values) : 0;
    },

    MAX: (args, sheet) => {
        const values: number[] = [];
        for (const arg of args) {
            if (typeof arg === 'number') {
                values.push(arg);
            } else if (typeof arg === 'string' && arg.includes(':')) {
                values.push(...getRangeValues(arg, sheet));
            }
        }
        return values.length > 0 ? Math.max(...values) : 0;
    },

    COUNT: (args, sheet) => {
        let count = 0;
        for (const arg of args) {
            if (typeof arg === 'number') {
                count++;
            } else if (typeof arg === 'string' && arg.includes(':')) {
                count += getRangeValues(arg, sheet).length;
            }
        }
        return count;
    },

    COUNTA: (args, sheet) => {
        let count = 0;
        for (const arg of args) {
            if (arg !== null && arg !== '') {
                if (typeof arg === 'string' && arg.includes(':')) {
                    const cells = parseCellRange(arg);
                    for (const ref of cells) {
                        const val = getCellValue(sheet, ref);
                        if (val !== null && val !== '') count++;
                    }
                } else {
                    count++;
                }
            }
        }
        return count;
    },

    IF: (args) => {
        const [condition, trueVal, falseVal] = args;
        return condition ? (trueVal ?? 0) : (falseVal ?? 0);
    },

    ABS: (args) => {
        const val = args[0];
        return typeof val === 'number' ? Math.abs(val) : 0;
    },

    ROUND: (args) => {
        const [val, decimals = 0] = args;
        if (typeof val !== 'number') return 0;
        const d = typeof decimals === 'number' ? decimals : 0;
        return Math.round(val * Math.pow(10, d)) / Math.pow(10, d);
    },

    FLOOR: (args) => {
        const val = args[0];
        return typeof val === 'number' ? Math.floor(val) : 0;
    },

    CEIL: (args) => {
        const val = args[0];
        return typeof val === 'number' ? Math.ceil(val) : 0;
    },

    SQRT: (args) => {
        const val = args[0];
        return typeof val === 'number' && val >= 0 ? Math.sqrt(val) : 0;
    },

    POWER: (args) => {
        const [base, exp] = args;
        if (typeof base !== 'number' || typeof exp !== 'number') return 0;
        return Math.pow(base, exp);
    },

    CONCAT: (args) => {
        return args.map(a => String(a ?? '')).join('');
    },

    CONCATENATE: (args, sheet) => functions.CONCAT(args, sheet),

    LEFT: (args) => {
        const [text, num = 1] = args;
        if (typeof text !== 'string') return '';
        const n = typeof num === 'number' ? num : 1;
        return text.slice(0, n);
    },

    RIGHT: (args) => {
        const [text, num = 1] = args;
        if (typeof text !== 'string') return '';
        const n = typeof num === 'number' ? num : 1;
        return text.slice(-n);
    },

    LEN: (args) => {
        const text = args[0];
        return typeof text === 'string' ? text.length : 0;
    },

    UPPER: (args) => {
        const text = args[0];
        return typeof text === 'string' ? text.toUpperCase() : '';
    },

    LOWER: (args) => {
        const text = args[0];
        return typeof text === 'string' ? text.toLowerCase() : '';
    },

    TRIM: (args) => {
        const text = args[0];
        return typeof text === 'string' ? text.trim() : '';
    },

    NOW: () => Date.now(),

    TODAY: () => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now.getTime();
    },

    // Financial functions
    PMT: (args) => {
        // Payment for a loan: PMT(rate, nper, pv)
        const [rate, nper, pv] = args;
        if (typeof rate !== 'number' || typeof nper !== 'number' || typeof pv !== 'number') return 0;
        if (rate === 0) return -pv / nper;
        return (rate * pv) / (1 - Math.pow(1 + rate, -nper));
    },

    FV: (args) => {
        // Future value: FV(rate, nper, pmt, pv)
        const [rate, nper, pmt, pv = 0] = args;
        if (typeof rate !== 'number' || typeof nper !== 'number' || typeof pmt !== 'number') return 0;
        const presentValue = typeof pv === 'number' ? pv : 0;
        if (rate === 0) return -(presentValue + pmt * nper);
        return -(presentValue * Math.pow(1 + rate, nper) + pmt * ((Math.pow(1 + rate, nper) - 1) / rate));
    },

    NPV: (args, sheet) => {
        // Net present value: NPV(rate, values...)
        const [rate, ...values] = args;
        if (typeof rate !== 'number') return 0;

        const cashFlows: number[] = [];
        for (const val of values) {
            if (typeof val === 'number') {
                cashFlows.push(val);
            } else if (typeof val === 'string' && val.includes(':')) {
                cashFlows.push(...getRangeValues(val, sheet));
            }
        }

        let npv = 0;
        for (let i = 0; i < cashFlows.length; i++) {
            npv += cashFlows[i] / Math.pow(1 + rate, i + 1);
        }
        return npv;
    },
};

// Evaluate a single value (number, string, cell reference, or range)
function evaluateValue(token: Token, sheet: Sheet): number | string | null {
    switch (token.type) {
        case 'NUMBER':
            return parseFloat(token.value);
        case 'STRING':
            return token.value;
        case 'CELL_REF':
            const cell = sheet.cells[token.value];
            if (cell?.formula && isFormula(cell.formula)) {
                // Recursively evaluate the formula
                return evaluateFormula(cell.formula, sheet);
            }
            return getCellValue(sheet, token.value);
        case 'RANGE':
            // Return the range string for function processing
            return token.value;
        default:
            return null;
    }
}

// Parse and evaluate function call
function evaluateFunction(funcName: string, tokens: Token[], startIdx: number, sheet: Sheet): { result: number | string; endIdx: number } {
    const args: (number | string | null)[] = [];
    let i = startIdx;
    let depth = 1;
    let currentArgTokens: Token[] = [];

    while (i < tokens.length && depth > 0) {
        const token = tokens[i];

        if (token.type === 'LPAREN') {
            depth++;
            if (depth > 1) currentArgTokens.push(token);
        } else if (token.type === 'RPAREN') {
            depth--;
            if (depth > 0) currentArgTokens.push(token);
        } else if (token.type === 'COMMA' && depth === 1) {
            // Evaluate current argument
            if (currentArgTokens.length > 0) {
                args.push(evaluateTokens(currentArgTokens, sheet));
            }
            currentArgTokens = [];
        } else {
            currentArgTokens.push(token);
        }
        i++;
    }

    // Evaluate last argument
    if (currentArgTokens.length > 0) {
        // Special case: if it's just a range, pass it as string
        if (currentArgTokens.length === 1 && currentArgTokens[0].type === 'RANGE') {
            args.push(currentArgTokens[0].value);
        } else {
            args.push(evaluateTokens(currentArgTokens, sheet));
        }
    }

    const func = functions[funcName];
    if (!func) {
        return { result: `#NAME?`, endIdx: i };
    }

    const result = func(args, sheet);
    return { result, endIdx: i };
}

// Evaluate tokens (handles operators)
function evaluateTokens(tokens: Token[], sheet: Sheet): number | string {
    if (tokens.length === 0) return 0;

    // First pass: evaluate all values and function calls
    const values: (number | string)[] = [];
    const operators: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === 'FUNCTION') {
            // Skip the opening paren
            i++; // Move past LPAREN
            const { result, endIdx } = evaluateFunction(token.value, tokens, i + 1, sheet);
            values.push(result);
            i = endIdx - 1;
        } else if (token.type === 'OPERATOR') {
            operators.push(token.value);
        } else if (token.type !== 'LPAREN' && token.type !== 'RPAREN' && token.type !== 'COMMA') {
            const val = evaluateValue(token, sheet);
            if (val !== null) {
                values.push(val);
            }
        }
    }

    // If no operators, return first value
    if (operators.length === 0) {
        return values[0] ?? 0;
    }

    // Apply operators (simple left-to-right for now, respecting precedence)
    // First handle * / %
    let i = 0;
    while (i < operators.length) {
        const op = operators[i];
        if (op === '*' || op === '/' || op === '%') {
            const a = typeof values[i] === 'number' ? values[i] : parseFloat(String(values[i])) || 0;
            const b = typeof values[i + 1] === 'number' ? values[i + 1] : parseFloat(String(values[i + 1])) || 0;
            let result: number;
            switch (op) {
                case '*': result = (a as number) * (b as number); break;
                case '/': result = b !== 0 ? (a as number) / (b as number) : 0; break;
                case '%': result = b !== 0 ? (a as number) % (b as number) : 0; break;
                default: result = 0;
            }
            values.splice(i, 2, result);
            operators.splice(i, 1);
        } else {
            i++;
        }
    }

    // Then handle + -
    i = 0;
    while (i < operators.length) {
        const op = operators[i];
        if (op === '+' || op === '-') {
            const a = typeof values[i] === 'number' ? values[i] : parseFloat(String(values[i])) || 0;
            const b = typeof values[i + 1] === 'number' ? values[i + 1] : parseFloat(String(values[i + 1])) || 0;
            const result = op === '+' ? (a as number) + (b as number) : (a as number) - (b as number);
            values.splice(i, 2, result);
            operators.splice(i, 1);
        } else {
            i++;
        }
    }

    // Handle comparison operators
    i = 0;
    while (i < operators.length) {
        const op = operators[i];
        if (['<', '>', '<=', '>=', '=', '==', '<>'].includes(op)) {
            const a = values[i];
            const b = values[i + 1];
            let result: boolean;
            switch (op) {
                case '<': result = a < b; break;
                case '>': result = a > b; break;
                case '<=': result = a <= b; break;
                case '>=': result = a >= b; break;
                case '=':
                case '==': result = a === b; break;
                case '<>': result = a !== b; break;
                default: result = false;
            }
            values.splice(i, 2, result ? 1 : 0);
            operators.splice(i, 1);
        } else {
            i++;
        }
    }

    // Handle string concatenation with &
    i = 0;
    while (i < operators.length) {
        const op = operators[i];
        if (op === '&') {
            const result = String(values[i] ?? '') + String(values[i + 1] ?? '');
            values.splice(i, 2, result);
            operators.splice(i, 1);
        } else {
            i++;
        }
    }

    return values[0] ?? 0;
}

// Main formula evaluation function
export function evaluateFormula(formula: string, sheet: Sheet): number | string {
    try {
        if (!formula || !isFormula(formula)) {
            return typeof formula === 'string' ? formula : 0;
        }

        const tokens = tokenize(formula);
        if (tokens.length === 0) return 0;

        const result = evaluateTokens(tokens, sheet);

        // Round numeric results to avoid floating point issues
        if (typeof result === 'number') {
            return Math.round(result * 1e10) / 1e10;
        }

        return result;
    } catch (error) {
        console.error('Formula evaluation error:', error);
        return '#ERROR!';
    }
}

// Update all cells that depend on a changed cell
export function recalculateSheet(sheet: Sheet): Sheet {
    const updatedCells = { ...sheet.cells };

    // Evaluate all formulas
    for (const [ref, cell] of Object.entries(updatedCells)) {
        if (cell.formula && isFormula(cell.formula)) {
            const result = evaluateFormula(cell.formula, sheet);
            updatedCells[ref] = {
                ...cell,
                value: result,
                displayValue: String(result),
            };
        }
    }

    return {
        ...sheet,
        cells: updatedCells,
    };
}

// Get list of available functions for autocomplete
export function getAvailableFunctions(): { name: string; description: string; syntax: string }[] {
    return [
        { name: 'SUM', description: 'Adds all numbers in a range', syntax: 'SUM(range)' },
        { name: 'AVG', description: 'Calculates the average', syntax: 'AVG(range)' },
        { name: 'AVERAGE', description: 'Calculates the average', syntax: 'AVERAGE(range)' },
        { name: 'MIN', description: 'Returns the minimum value', syntax: 'MIN(range)' },
        { name: 'MAX', description: 'Returns the maximum value', syntax: 'MAX(range)' },
        { name: 'COUNT', description: 'Counts numeric values', syntax: 'COUNT(range)' },
        { name: 'COUNTA', description: 'Counts non-empty cells', syntax: 'COUNTA(range)' },
        { name: 'IF', description: 'Conditional logic', syntax: 'IF(condition, true_val, false_val)' },
        { name: 'ABS', description: 'Absolute value', syntax: 'ABS(number)' },
        { name: 'ROUND', description: 'Rounds to decimal places', syntax: 'ROUND(number, decimals)' },
        { name: 'FLOOR', description: 'Rounds down', syntax: 'FLOOR(number)' },
        { name: 'CEIL', description: 'Rounds up', syntax: 'CEIL(number)' },
        { name: 'SQRT', description: 'Square root', syntax: 'SQRT(number)' },
        { name: 'POWER', description: 'Raises to power', syntax: 'POWER(base, exponent)' },
        { name: 'CONCAT', description: 'Joins text', syntax: 'CONCAT(text1, text2, ...)' },
        { name: 'LEFT', description: 'Left characters', syntax: 'LEFT(text, num_chars)' },
        { name: 'RIGHT', description: 'Right characters', syntax: 'RIGHT(text, num_chars)' },
        { name: 'LEN', description: 'Text length', syntax: 'LEN(text)' },
        { name: 'UPPER', description: 'Uppercase', syntax: 'UPPER(text)' },
        { name: 'LOWER', description: 'Lowercase', syntax: 'LOWER(text)' },
        { name: 'TRIM', description: 'Remove extra spaces', syntax: 'TRIM(text)' },
        { name: 'NOW', description: 'Current timestamp', syntax: 'NOW()' },
        { name: 'TODAY', description: 'Today\'s date', syntax: 'TODAY()' },
        { name: 'PMT', description: 'Loan payment', syntax: 'PMT(rate, periods, present_value)' },
        { name: 'FV', description: 'Future value', syntax: 'FV(rate, periods, payment, present_value)' },
        { name: 'NPV', description: 'Net present value', syntax: 'NPV(rate, cash_flows...)' },
    ];
}
