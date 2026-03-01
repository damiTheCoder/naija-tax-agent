"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBudgetingData } from "@/lib/budgeting/useBudgetingData";
import type { Budget, BudgetCategoryAllocation, BudgetDepartmentAllocation, BudgetPeriod } from "@/lib/budgeting/types";

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const todayIso = () => new Date().toISOString().slice(0, 10);

const createBlankBudget = (): Budget => {
  const now = new Date();
  const year = now.getFullYear();
  return {
    id: makeId("budget"),
    name: "",
    period: "monthly",
    startDate: `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    endDate: `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-28`,
    totalAmount: 0,
    categories: [{ id: makeId("cat"), category: "", amount: 0, accountCodes: [], department: "" }],
    departments: [{ id: makeId("dep"), department: "", amount: 0 }],
    linkedAccountCodes: [],
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export default function CreateEditBudgetPage() {
  const searchParams = useSearchParams();
  const budgetId = searchParams.get("id");
  const { isReady, budgets, saveBudget } = useBudgetingData();

  const editTarget = useMemo(() => budgets.find((budget) => budget.id === budgetId), [budgets, budgetId]);
  const [form, setForm] = useState<Budget>(createBlankBudget());
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    const frame = window.requestAnimationFrame(() => {
      if (editTarget) {
        setForm(editTarget);
        return;
      }
      setForm(createBlankBudget());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editTarget, isReady]);

  const updateCategory = (id: string, patch: Partial<BudgetCategoryAllocation>) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const updateDepartment = (id: string, patch: Partial<BudgetDepartmentAllocation>) => {
    setForm((prev) => ({
      ...prev,
      departments: prev.departments.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const categoryTotal = form.categories.reduce((sum, category) => sum + (category.amount || 0), 0);
  const departmentTotal = form.departments.reduce((sum, department) => sum + (department.amount || 0), 0);

  const canSubmit = form.name.trim().length > 0 && form.totalAmount > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{editTarget ? "Edit Budget" : "Create Budget"}</h1>
          <p className="text-sm text-gray-500">Set budget name, period, categories, departments, and control limits.</p>
        </div>
        <Link href="/budgeting/budgets" className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Back to Budgets
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Budget Setup</h2>

          <label className="block text-sm">
            <span className="text-gray-600">Budget Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              placeholder="Marketing Budget 2026"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-gray-600">Budget Period</span>
              <select
                value={form.period}
                onChange={(event) => setForm((prev) => ({ ...prev, period: event.target.value as BudgetPeriod }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-gray-600">Budget Amount (₦)</span>
              <input
                type="number"
                min={0}
                value={form.totalAmount}
                onChange={(event) => setForm((prev) => ({ ...prev, totalAmount: Number(event.target.value || 0) }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-gray-600">Start Date</span>
              <input
                type="date"
                value={form.startDate || todayIso()}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">End Date</span>
              <input
                type="date"
                value={form.endDate || todayIso()}
                onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-gray-600">Linked Account Codes (comma-separated)</span>
            <input
              value={form.linkedAccountCodes.join(",")}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  linkedAccountCodes: event.target.value
                    .split(",")
                    .map((code) => code.trim())
                    .filter(Boolean),
                }))
              }
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              placeholder="5500,5600,6000"
            />
          </label>

          <label className="block text-sm">
            <span className="text-gray-600">Notes</span>
            <textarea
              value={form.notes || ""}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              className="mt-1 h-20 w-full rounded-xl border border-gray-300 px-3 py-2"
              placeholder="Any additional assumptions"
            />
          </label>
        </div>

        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Category Allocations</h2>
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  categories: [...prev.categories, { id: makeId("cat"), category: "", amount: 0, accountCodes: [], department: "" }],
                }))
              }
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Add Category
            </button>
          </div>

          <div className="space-y-3">
            {form.categories.map((category) => (
              <div key={category.id} className="rounded-xl border border-gray-200 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={category.category}
                    onChange={(event) => updateCategory(category.id, { category: event.target.value })}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Category"
                  />
                  <input
                    type="number"
                    min={0}
                    value={category.amount}
                    onChange={(event) => updateCategory(category.id, { amount: Number(event.target.value || 0) })}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Amount"
                  />
                  <input
                    value={category.department || ""}
                    onChange={(event) => updateCategory(category.id, { department: event.target.value })}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Department"
                  />
                  <input
                    value={(category.accountCodes || []).join(",")}
                    onChange={(event) =>
                      updateCategory(category.id, {
                        accountCodes: event.target.value
                          .split(",")
                          .map((code) => code.trim())
                          .filter(Boolean),
                      })
                    }
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Account codes"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, categories: prev.categories.filter((item) => item.id !== category.id) }))}
                  className="mt-2 text-xs font-semibold text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
            Category total allocation: <span className="font-semibold text-gray-900">₦{categoryTotal.toLocaleString("en-NG")}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Department Allocations</h2>
          <button
            type="button"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                departments: [...prev.departments, { id: makeId("dep"), department: "", amount: 0 }],
              }))
            }
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Add Department
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {form.departments.map((department) => (
            <div key={department.id} className="rounded-xl border border-gray-200 p-3">
              <input
                value={department.department}
                onChange={(event) => updateDepartment(department.id, { department: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Department"
              />
              <input
                type="number"
                min={0}
                value={department.amount}
                onChange={(event) => updateDepartment(department.id, { amount: Number(event.target.value || 0) })}
                className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Amount"
              />
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, departments: prev.departments.filter((item) => item.id !== department.id) }))}
                className="mt-2 text-xs font-semibold text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
          Department total allocation: <span className="font-semibold text-gray-900">₦{departmentTotal.toLocaleString("en-NG")}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            if (!canSubmit) return;
            const payload: Budget = {
              ...form,
              updatedAt: new Date().toISOString(),
              createdAt: editTarget?.createdAt || new Date().toISOString(),
              categories: form.categories.filter((category) => category.category.trim().length > 0),
              departments: form.departments.filter((department) => department.department.trim().length > 0),
            };
            saveBudget(payload);
            setMessage("Budget saved successfully.");
          }}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {editTarget ? "Update Budget" : "Create Budget"}
        </button>
        <Link href="/budgeting/budgets" className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Cancel
        </Link>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      </div>
    </div>
  );
}
