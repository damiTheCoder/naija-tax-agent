import { taxEngine } from "../tax/taxEngine";
import { accountingEngine } from "../accounting/transactionBridge";

/**
 * Clears all application data from local storage and resets engines.
 */
export const clearAllData = () => {
    if (typeof window === "undefined") return;

    // 1. Reset Singleton Engines (clears internal state and their specific localStorage keys)
    taxEngine.reset();
    accountingEngine.reset();

    // 2. Clear known standalone localStorage keys
    const keysToClear = [
        "insight::accounting-transactions",
        "insight::automation-confidence",
        "insight::accounting-draft",
        "insight::bank-connections",
        "insight::tax-engine",
        "insight::accounting-engine"
    ];

    keysToClear.forEach((key) => {
        window.localStorage.removeItem(key);
    });

    // 3. Optional: Clear all if we want to be truly thorough (caution: might clear auth/etc if present)
    // window.localStorage.clear();

    // 4. Force a page reload to reset all React states in all open components
    window.location.href = "/";
};
