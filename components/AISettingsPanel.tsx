"use client";

/**
 * AI Settings Panel Component
 * Configuration UI for the dual rule-based + AI accounting system
 */

import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Brain, 
  Shield, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { AccountingConfig, DEFAULT_ACCOUNTING_CONFIG } from "@/lib/accounting/types";

interface AISettingsPanelProps {
  onSave?: (config: AccountingConfig) => void;
  className?: string;
}

export default function AISettingsPanel({ onSave, className = "" }: AISettingsPanelProps) {
  const [config, setConfig] = useState<AccountingConfig>(DEFAULT_ACCOUNTING_CONFIG);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Load config from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("insight::accounting-config");
      if (saved) {
        setConfig(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to load config:", e);
    }
  }, []);

  // Save config
  const handleSave = () => {
    try {
      localStorage.setItem("insight::accounting-config", JSON.stringify(config));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      onSave?.(config);
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  };

  // Update nested AI settings
  const updateAISettings = (key: string, value: unknown) => {
    setConfig(prev => ({
      ...prev,
      aiSettings: {
        ...prev.aiSettings,
        [key]: value,
      },
    }));
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">AI Classification Settings</h3>
            <p className="text-sm text-gray-500">
              Configure dual rule-based + AI accounting system
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            config.aiSettings.enabled 
              ? "bg-green-100 text-green-700" 
              : "bg-gray-100 text-gray-600"
          }`}>
            {config.aiSettings.enabled ? "AI Enabled" : "Rule-based Only"}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-6">
          {/* AI Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Enable AI Classification</label>
              <p className="text-sm text-gray-500">
                Use AI for low-confidence transactions
              </p>
            </div>
            <button
              onClick={() => updateAISettings("enabled", !config.aiSettings.enabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config.aiSettings.enabled ? "bg-[#64B5F6]" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  config.aiSettings.enabled ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>

          {/* AI API Endpoint */}
          <div>
            <label className="block font-medium text-gray-900 mb-1">
              AI API Endpoint
            </label>
            <input
              type="url"
              value={config.aiSettings.apiEndpoint || ""}
              onChange={(e) => updateAISettings("apiEndpoint", e.target.value)}
              placeholder="https://api.openai.com/v1/chat/completions"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#64B5F6] focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              OpenAI-compatible endpoint for AI classification
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block font-medium text-gray-900 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={config.aiSettings.apiKey || ""}
              onChange={(e) => updateAISettings("apiKey", e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#64B5F6] focus:border-transparent"
            />
          </div>

          {/* Model */}
          <div>
            <label className="block font-medium text-gray-900 mb-1">
              AI Model
            </label>
            <select
              value={config.aiSettings.model || "gpt-4"}
              onChange={(e) => updateAISettings("model", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#64B5F6] focus:border-transparent"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="claude-3-opus">Claude 3 Opus</option>
              <option value="claude-3-sonnet">Claude 3 Sonnet</option>
            </select>
          </div>

          {/* Confidence Threshold */}
          <div>
            <label className="block font-medium text-gray-900 mb-1">
              Confidence Threshold: {Math.round(config.aiSettings.confidenceThreshold * 100)}%
            </label>
            <input
              type="range"
              min="0.3"
              max="0.95"
              step="0.05"
              value={config.aiSettings.confidenceThreshold}
              onChange={(e) => updateAISettings("confidenceThreshold", parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="mt-1 text-xs text-gray-500">
              Below this threshold, AI will be used for classification
            </p>
          </div>

          {/* Auto Features */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-gray-700">Auto-classify transactions</span>
              </div>
              <button
                onClick={() => updateAISettings("autoClassify", !config.aiSettings.autoClassify)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  config.aiSettings.autoClassify ? "bg-[#64B5F6]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.aiSettings.autoClassify ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                <span className="text-gray-700">Auto-generate journal entries</span>
              </div>
              <button
                onClick={() => updateAISettings("autoGenerateJournals", !config.aiSettings.autoGenerateJournals)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  config.aiSettings.autoGenerateJournals ? "bg-[#64B5F6]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.aiSettings.autoGenerateJournals ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Compliance Mode */}
          <div>
            <label className="block font-medium text-gray-900 mb-1">
              FIRS Compliance Mode
            </label>
            <div className="flex gap-2">
              {(["strict", "advisory", "off"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => updateAISettings("complianceMode", mode)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    config.aiSettings.complianceMode === mode
                      ? "border-[#64B5F6] bg-blue-50 text-[#64B5F6]"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Strict: Block non-compliant entries | Advisory: Warn only | Off: No checks
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 rounded-lg p-4 flex gap-3">
            <Info className="w-5 h-5 text-[#64B5F6] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-900 mb-1">Dual Classification System</p>
              <p>
                The system uses rule-based classification first. When confidence is below the threshold, 
                AI is used for intelligent classification following Nigerian accounting standards (FIRS, CAMA, IFRS for SMEs).
              </p>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full py-2.5 bg-[#64B5F6] text-white rounded-lg font-medium hover:bg-[#42A5F5] transition-colors flex items-center justify-center gap-2"
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Saved!
              </>
            ) : (
              <>
                <Settings className="w-5 h-5" />
                Save Settings
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
