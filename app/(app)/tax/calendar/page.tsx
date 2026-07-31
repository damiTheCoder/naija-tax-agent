"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { mapJournalEntriesToCompliance } from "@/lib/tax/compliance/adapters";
import { runTaxComputation } from "@/lib/tax/compliance";
import { loadComplianceStatuses, loadPayments, loadSchedules } from "@/lib/tax/compliance/store";
import { withTaxAdjustments } from "@/lib/tax/adjustments";

type CalendarTaxType = "VAT" | "CIT" | "PAYE" | "WHT";
type EventCategory = "filing" | "payment" | "reminder";

type ReminderSettings = {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  email: string;
  whatsapp: string;
  leadDays: number;
};

type TaxObligation = {
  id: string;
  taxType: CalendarTaxType;
  period: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  outstanding: number;
  filingDone: boolean;
  paymentDone: boolean;
};

type CalendarEvent = {
  id: string;
  date: string;
  taxType: CalendarTaxType;
  period: string;
  amount: number;
  category: EventCategory;
  status: "pending" | "done";
  title: string;
};

type DayCell = {
  isoDate: string;
  day: number;
  inMonth: boolean;
};

type CalendarViewMode = "month" | "year";

const REMINDER_SETTINGS_KEY = "ql::tax::calendar-reminder-settings";
const PAYE_ESTIMATE_RATE = 0.15;

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => currencyFormatter.format(Math.round(value || 0));

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const monthLabel = (date: Date) =>
  date.toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
  });

const shortMonthLabel = (date: Date) =>
  date.toLocaleDateString("en-NG", {
    month: "short",
  });

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

const defaultReminderSettings: ReminderSettings = {
  emailEnabled: false,
  whatsappEnabled: false,
  email: "",
  whatsapp: "",
  leadDays: 5,
};

const readReminderSettings = (): ReminderSettings => {
  if (typeof window === "undefined") return defaultReminderSettings;
  try {
    const raw = window.localStorage.getItem(REMINDER_SETTINGS_KEY);
    if (!raw) return defaultReminderSettings;
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      emailEnabled: Boolean(parsed.emailEnabled),
      whatsappEnabled: Boolean(parsed.whatsappEnabled),
      email: typeof parsed.email === "string" ? parsed.email : "",
      whatsapp: typeof parsed.whatsapp === "string" ? parsed.whatsapp : "",
      leadDays: Math.min(30, Math.max(1, Number(parsed.leadDays) || 5)),
    };
  } catch {
    return defaultReminderSettings;
  }
};

const saveReminderSettings = (settings: ReminderSettings) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
};

const getPayeDueDate = (period: string) => {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) return `${new Date().getFullYear()}-12-10`;

  let year = Number(match[1]);
  let month = Number(match[2]) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}-10`;
};

const buildMonthGrid = (focusDate: Date): DayCell[] => {
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: cells }, (_, index) => {
    const dayOffset = index - firstWeekday + 1;
    const cellDate = new Date(year, month, dayOffset);
    return {
      isoDate: dateKey(cellDate),
      day: cellDate.getDate(),
      inMonth: cellDate.getMonth() === month,
    };
  });
};

const mapEventColor = (category: EventCategory) => {
  if (category === "filing") return "bg-indigo-100 text-indigo-700";
  if (category === "payment") return "bg-emerald-100 text-emerald-700";
  return "bg-amber-100 text-amber-700";
};

const eventPriority = (event: CalendarEvent) => {
  if (event.category === "reminder") return 0;
  if (event.category === "filing") return 1;
  return 2;
};

export default function TaxCalendarPage() {
  const [obligations, setObligations] = useState<TaxObligation[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("year");
  const [focusMonth, setFocusMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [settingsDraft, setSettingsDraft] = useState<ReminderSettings>(defaultReminderSettings);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    setSettingsDraft(readReminderSettings());
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshCalendar = useCallback(
    (settings: ReminderSettings) => {
      if (!isMountedRef.current) return;
      setIsRefreshing(true);
      setError(null);

      try {
        accountingEngine.load();
        const postedEntries: JournalEntry[] = accountingEngine
          .getState()
          .journalEntries.filter((entry) => entry.status === "posted");

        const mappedTransactions = mapJournalEntriesToCompliance("entity-default", postedEntries);
        const computationTransactions = withTaxAdjustments("entity-default", mappedTransactions);
        if (computationTransactions.length > 0) {
          runTaxComputation({
            entityId: "entity-default",
            period: "current",
            transactions: computationTransactions,
          });
        }

        const schedules = loadSchedules().filter(
          (schedule) =>
            schedule.entityId === "entity-default" &&
            (schedule.taxType === "VAT" || schedule.taxType === "CIT" || schedule.taxType === "WHT")
        );

        const paidByKey = new Map<string, number>();
        loadPayments()
          .filter((payment) => payment.status === "paid")
          .forEach((payment) => {
            const taxType = String(payment.taxType).toUpperCase();
            const key = `${taxType}::${payment.period}`;
            paidByKey.set(key, (paidByKey.get(key) || 0) + (payment.amount || 0));
          });

        const stageByKey = new Map<string, string>();
        loadComplianceStatuses()
          .filter((status) => status.entityId === "entity-default")
          .forEach((status) => {
            const key = `${status.taxType}::${status.period}`;
            if (!stageByKey.has(key)) {
              stageByKey.set(key, status.stage);
            }
          });

        const scheduleObligations: TaxObligation[] = schedules.map((schedule) => {
          const taxType = schedule.taxType as CalendarTaxType;
          const key = `${taxType}::${schedule.period}`;
          const amountDue = Math.max(0, schedule.totalTax || 0);
          const amountPaid = Math.max(0, paidByKey.get(key) || 0);
          const outstanding = Math.max(0, amountDue - amountPaid);
          const stage = stageByKey.get(key);
          const filingDone = stage === "filed" || stage === "paid" || stage === "reconciled";
          const paymentDone = outstanding <= 0 || stage === "paid" || stage === "reconciled";

          return {
            id: `${taxType}-${schedule.period}`,
            taxType,
            period: schedule.period,
            dueDate: schedule.dueDate,
            amountDue,
            amountPaid,
            outstanding,
            filingDone,
            paymentDone,
          };
        });

        const payeBuckets = new Map<string, { payrollBase: number; payeRecorded: number }>();
        postedEntries.forEach((entry) => {
          const date = new Date(entry.date || entry.createdAt);
          if (Number.isNaN(date.getTime())) return;

          const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          const bucket = payeBuckets.get(period) || { payrollBase: 0, payeRecorded: 0 };

          entry.lines.forEach((line) => {
            const code = (line.accountCode || "").trim();
            if (code === "5500") {
              bucket.payrollBase += Math.max(0, (line.debit || 0) - (line.credit || 0));
            }
            if (code === "2210") {
              bucket.payeRecorded += Math.max(0, (line.credit || 0) - (line.debit || 0));
            }
          });

          if (bucket.payrollBase > 0 || bucket.payeRecorded > 0) {
            payeBuckets.set(period, bucket);
          }
        });

        const payeObligations: TaxObligation[] = Array.from(payeBuckets.entries()).map(([period, bucket]) => {
          const amountDue =
            bucket.payeRecorded > 0
              ? Math.max(0, bucket.payeRecorded)
              : Math.max(0, bucket.payrollBase * PAYE_ESTIMATE_RATE);
          const key = `PAYE::${period}`;
          const amountPaid = Math.max(0, paidByKey.get(key) || 0);
          const outstanding = Math.max(0, amountDue - amountPaid);

          return {
            id: `PAYE-${period}`,
            taxType: "PAYE",
            period,
            dueDate: getPayeDueDate(period),
            amountDue,
            amountPaid,
            outstanding,
            filingDone: outstanding <= 0,
            paymentDone: outstanding <= 0,
          };
        });

        const allObligations = [...scheduleObligations, ...payeObligations].sort((a, b) => {
          const periodDiff = periodRank(b.period) - periodRank(a.period);
          if (periodDiff !== 0) return periodDiff;
          return a.taxType.localeCompare(b.taxType);
        });

        const calendarEvents: CalendarEvent[] = [];
        allObligations.forEach((item) => {
          calendarEvents.push({
            id: `filing-${item.id}`,
            date: item.dueDate,
            taxType: item.taxType,
            period: item.period,
            amount: item.amountDue,
            category: "filing",
            status: item.filingDone ? "done" : "pending",
            title: `${item.taxType} filing deadline`,
          });

          calendarEvents.push({
            id: `payment-${item.id}`,
            date: item.dueDate,
            taxType: item.taxType,
            period: item.period,
            amount: item.outstanding,
            category: "payment",
            status: item.paymentDone ? "done" : "pending",
            title: `${item.taxType} payment deadline`,
          });

          const due = new Date(item.dueDate);
          if (!Number.isNaN(due.getTime())) {
            due.setDate(due.getDate() - settings.leadDays);
            calendarEvents.push({
              id: `reminder-${item.id}`,
              date: dateKey(due),
              taxType: item.taxType,
              period: item.period,
              amount: item.outstanding,
              category: "reminder",
              status: item.paymentDone ? "done" : "pending",
              title: `${item.taxType} compliance reminder`,
            });
          }
        });

        if (!isMountedRef.current) return;
        setObligations(allObligations);
        setEvents(calendarEvents);
        setStatusMessage(`Loaded ${allObligations.length} obligations with filing/payment deadlines and reminders.`);
      } catch (refreshError) {
        console.error("Unable to load tax calendar", refreshError);
        if (!isMountedRef.current) return;
        setError("Unable to load tax calendar right now.");
      } finally {
        if (!isMountedRef.current) return;
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isMountedRef.current) return;
    refreshCalendar(settingsDraft);
    const unsubscribe = accountingEngine.subscribe(() => {
      refreshCalendar(settingsDraft);
    });
    return () => unsubscribe();
  }, [refreshCalendar, settingsDraft]);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const list = grouped.get(event.date) || [];
      list.push(event);
      grouped.set(event.date, list);
    });
    grouped.forEach((list, key) => {
      grouped.set(
        key,
        [...list].sort((a, b) => eventPriority(a) - eventPriority(b))
      );
    });
    return grouped;
  }, [events]);

  const grid = useMemo(() => buildMonthGrid(focusMonth), [focusMonth]);
  const yearMonths = useMemo(
    () => Array.from({ length: 12 }, (_, monthIndex) => new Date(focusMonth.getFullYear(), monthIndex, 1)),
    [focusMonth]
  );

  const filingDeadlines = useMemo(
    () => events.filter((event) => event.category === "filing").sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  );

  const paymentDeadlines = useMemo(
    () => events.filter((event) => event.category === "payment").sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  );

  const complianceReminders = useMemo(() => {
    const todayKey = dateKey(new Date());
    return events
      .filter((event) => event.category === "reminder" && event.date >= todayKey)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  const reminderChannels = useMemo(() => {
    const channels: string[] = [];
    if (settingsDraft.emailEnabled) channels.push("Email");
    if (settingsDraft.whatsappEnabled) channels.push("WhatsApp");
    return channels;
  }, [settingsDraft.emailEnabled, settingsDraft.whatsappEnabled]);

  const saveReminderConfig = () => {
    const sanitized: ReminderSettings = {
      ...settingsDraft,
      leadDays: Math.min(30, Math.max(1, Number(settingsDraft.leadDays) || 5)),
      email: settingsDraft.email.trim(),
      whatsapp: settingsDraft.whatsapp.trim(),
    };
    saveReminderSettings(sanitized);
    setSettingsDraft(sanitized);
    setStatusMessage("Reminder settings saved.");
    refreshCalendar(sanitized);
  };

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Calendar</h1>
          <p className="mt-1 text-sm text-gray-500">Compliance tracking for filing deadlines, payment deadlines, and reminders.</p>
        </div>
        <button
          type="button"
          onClick={() => refreshCalendar(settingsDraft)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1a1a] disabled:opacity-60"
        >
          <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Calendar
        </button>
      </div>

      {(statusMessage || error) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-600"}`}>
          {error || statusMessage}
        </div>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Calendar View</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("year")}
              className={`rounded-lg border px-3 py-1.5 text-sm ${viewMode === "year" ? "border-gray-800 bg-gray-900 text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              Year View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`rounded-lg border px-3 py-1.5 text-sm ${viewMode === "month" ? "border-gray-800 bg-gray-900 text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              Month View
            </button>
            {viewMode === "month" ? (
              <>
                <button
                  type="button"
                  onClick={() => setFocusMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Prev Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setFocusMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Current Month
                </button>
                <button
                  type="button"
                  onClick={() => setFocusMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Next Month
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setFocusMonth((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1))}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Prev Year
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setFocusMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Current Year
                </button>
                <button
                  type="button"
                  onClick={() => setFocusMonth((prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1))}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Next Year
                </button>
              </>
            )}
          </div>
        </div>

        {viewMode === "month" ? (
          <>
            <p className="mt-2 text-sm font-medium text-gray-700">{monthLabel(focusMonth)}</p>

            <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="bg-gray-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {day}
                </div>
              ))}

              {grid.map((cell) => {
                const dayEvents = eventsByDate.get(cell.isoDate) || [];
                return (
                  <div key={cell.isoDate} className={`min-h-[110px] bg-white p-2 ${cell.inMonth ? "" : "opacity-45"}`}>
                    <p className="text-xs font-semibold text-gray-700">{cell.day}</p>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div key={event.id} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${mapEventColor(event.category)}`}>
                          {event.category === "filing" ? "F" : event.category === "payment" ? "P" : "R"}: {event.taxType}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] font-medium text-gray-500">+{dayEvents.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm font-medium text-gray-700">{focusMonth.getFullYear()} full-year calendar</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {yearMonths.map((monthDate) => {
                const monthGrid = buildMonthGrid(monthDate);
                return (
                  <div key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`} className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">
                        {shortMonthLabel(monthDate)} {monthDate.getFullYear()}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFocusMonth(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
                          setViewMode("month");
                        }}
                        className="rounded-md border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Open
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-[10px] text-gray-500">
                      {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                        <div key={`${monthDate.getMonth()}-${index}`} className="text-center font-semibold">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                      {monthGrid.map((cell) => {
                        const dayEvents = eventsByDate.get(cell.isoDate) || [];
                        const hasEvents = dayEvents.length > 0;
                        return (
                          <div
                            key={`${monthDate.getMonth()}-${cell.isoDate}`}
                            className={`h-8 rounded border border-gray-100 px-1 py-0.5 text-[10px] ${cell.inMonth ? "text-gray-700" : "text-gray-300"} ${hasEvents ? "bg-blue-50" : "bg-white"}`}
                            title={
                              hasEvents
                                ? dayEvents.map((event) => `${event.title} (${event.taxType} ${event.period})`).join(" • ")
                                : cell.isoDate
                            }
                          >
                            <div className="flex items-center justify-between">
                              <span>{cell.day}</span>
                              {hasEvents && <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" />}
                            </div>
                            {hasEvents && (
                              <div className="mt-0.5 truncate text-[9px] font-semibold text-[#1e3a8a]">
                                {dayEvents.length}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Compliance Reminders</h2>
        <p className="mt-1 text-sm text-gray-500">Configure Email and WhatsApp reminder channels.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settingsDraft.emailEnabled}
              onChange={(event) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  emailEnabled: event.target.checked,
                }))
              }
            />
            Email reminders
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settingsDraft.whatsappEnabled}
              onChange={(event) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  whatsappEnabled: event.target.checked,
                }))
              }
            />
            WhatsApp reminders
          </label>

          <input
            type="email"
            value={settingsDraft.email}
            onChange={(event) => setSettingsDraft((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="Reminder email"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
          />

          <input
            type="text"
            value={settingsDraft.whatsapp}
            onChange={(event) => setSettingsDraft((prev) => ({ ...prev, whatsapp: event.target.value }))}
            placeholder="WhatsApp number"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
          />
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Reminder lead time (days):
            <input
              type="number"
              min={1}
              max={30}
              value={settingsDraft.leadDays}
              onChange={(event) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  leadDays: Math.min(30, Math.max(1, Number(event.target.value) || 1)),
                }))
              }
              className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
            />
          </label>

          <button
            type="button"
            onClick={saveReminderConfig}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Save Reminder Settings
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Active channels: {reminderChannels.length > 0 ? reminderChannels.join(" + ") : "None selected"}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-3xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-semibold text-gray-900">Filing Deadlines</h3>
          <div className="mt-3 space-y-2">
            {filingDeadlines.length === 0 && <p className="text-sm text-gray-500">No filing deadlines available.</p>}
            {filingDeadlines.slice(0, 10).map((event) => (
              <div key={event.id} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                <p className="text-sm font-semibold text-gray-900">{event.taxType} • {event.period}</p>
                <p className="text-xs text-gray-500">Due {formatDate(event.date)} • {formatCurrency(event.amount)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-semibold text-gray-900">Payment Deadlines</h3>
          <div className="mt-3 space-y-2">
            {paymentDeadlines.length === 0 && <p className="text-sm text-gray-500">No payment deadlines available.</p>}
            {paymentDeadlines.slice(0, 10).map((event) => (
              <div key={event.id} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                <p className="text-sm font-semibold text-gray-900">{event.taxType} • {event.period}</p>
                <p className="text-xs text-gray-500">Due {formatDate(event.date)} • Outstanding {formatCurrency(event.amount)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-semibold text-gray-900">Compliance Reminders</h3>
          <div className="mt-3 space-y-2">
            {complianceReminders.length === 0 && <p className="text-sm text-gray-500">No upcoming reminders.</p>}
            {complianceReminders.slice(0, 10).map((event) => (
              <div key={event.id} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                <p className="text-sm font-semibold text-gray-900">{event.taxType} • {event.period}</p>
                <p className="text-xs text-gray-500">Remind on {formatDate(event.date)} • {event.title}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Obligations Snapshot</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Tax Type</th>
                <th className="px-4 py-3 text-left font-semibold">Period</th>
                <th className="px-4 py-3 text-left font-semibold">Due Date</th>
                <th className="px-4 py-3 text-right font-semibold">Amount Due</th>
                <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {obligations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No tax obligations found yet.</td>
                </tr>
              )}
              {obligations.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-900">{item.taxType}</td>
                  <td className="px-4 py-3 text-gray-700">{item.period}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(item.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.amountDue)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function periodRank(period: string): number {
  const quarterMatch = period.match(/^(\d{4})-Q(\d)$/i);
  if (quarterMatch) {
    return Number(quarterMatch[1]) * 100 + Number(quarterMatch[2]) * 3;
  }
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    return Number(monthMatch[1]) * 100 + Number(monthMatch[2]);
  }
  const yearMatch = period.match(/^(\d{4})/);
  if (yearMatch) {
    return Number(yearMatch[1]) * 100 + 12;
  }
  return 0;
}
