"use client";

/**
 * Transaction Classification Widget
 * Displays AI/Rule-based classification results for transactions
 */

import React, { useState } from "react";
import { 
  CheckCircle2, 
  AlertCircle,
  Brain,
  BookOpen,
  Shuffle,
  Edit3,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  Building,
  Wallet,
  Users
} from "lucide-react";
import { AIClassificationResult } from "@/lib/accounting/aiEngine";
import { RawTransaction } from "@/lib/accounting/types";

interface ClassificationWidgetProps {
  transaction: RawTransaction;
  classification: AIClassificationResult;
  onEditClassification?: (accountCode: string) => void;
  className?: string;
}

// Get confidence badge
function getConfidenceBadge(confidence: number) {
  if (confidence >= 0.9) return { label: "Very High", color: "bg-green-100 text-green-700" };
  if (confidence >= 0.75) return { label: "High", color: "bg-green-50 text-green-600" };
  if (confidence >= 0.5) return { label: "Medium", color: "bg-yellow-100 text-yellow-700" };
  if (confidence >= 0.3) return { label: "Low", color: "bg-orange-100 text-orange-700" };
  return { label: "Very Low", color: "bg-red-100 text-red-700" };
}

// Get source badge
function getSourceBadge(source: "rule" | "ai" | "hybrid") {
  switch (source) {
    case "ai":
      return { 
        icon: Brain, 
        label: "AI", 
        color: "bg-purple-100 text-purple-700",
        description: "Classified by AI"
      };
    case "hybrid":
      return { 
        icon: Shuffle, 
        label: "Hybrid", 
        color: "bg-blue-100 text-blue-700",
        description: "Rule + AI combined"
      };
    default:
      return { 
        icon: BookOpen, 
        label: "Rule", 
        color: "bg-green-100 text-green-700",
        description: "Rule-based classification"
      };
  }
}

// Get transaction type icon and color
function getTypeStyle(type: string) {
  switch (type) {
    case "income":
      return { 
        icon: ArrowDownLeft, 
        color: "text-green-600 bg-green-100",
        label: "Income"
      };
    case "expense":
      return { 
        icon: ArrowUpRight, 
        color: "text-red-600 bg-red-100",
        label: "Expense"
      };
    case "asset":
      return { 
        icon: Building, 
        color: "text-blue-600 bg-blue-100",
        label: "Asset"
      };
    case "liability":
      return { 
        icon: Wallet, 
        color: "text-orange-600 bg-orange-100",
        label: "Liability"
      };
    case "equity":
      return { 
        icon: Users, 
        color: "text-purple-600 bg-purple-100",
        label: "Equity"
      };
    default:
      return { 
        icon: AlertCircle, 
        color: "text-gray-600 bg-gray-100",
        label: "Other"
      };
  }
}

export default function ClassificationWidget({
  transaction,
  classification,
  onEditClassification,
  className = ""
}: ClassificationWidgetProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const confidenceBadge = getConfidenceBadge(classification.confidence);
  const sourceBadge = getSourceBadge(classification.source);
  const typeStyle = getTypeStyle(classification.transactionType);
  const SourceIcon = sourceBadge.icon;
  const TypeIcon = typeStyle.icon;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      {/* Main Content */}
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Type Icon */}
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeStyle.color}`}>
              <TypeIcon className="w-5 h-5" />
            </div>
            
            {/* Transaction Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">
                {transaction.description}
              </h4>
              <p className="text-sm text-gray-500 mt-0.5">
                {transaction.date} • {transaction.category}
              </p>
            </div>
          </div>
          
          {/* Amount */}
          <div className={`text-right flex-shrink-0 ${
            transaction.amount >= 0 ? "text-green-600" : "text-red-600"
          }`}>
            <p className="font-semibold">
              {transaction.amount >= 0 ? "+" : ""}₦{Math.abs(transaction.amount).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Classification Badges */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {/* Source Badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sourceBadge.color}`}>
            <SourceIcon className="w-3.5 h-3.5" />
            {sourceBadge.label}
          </span>
          
          {/* Confidence Badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${confidenceBadge.color}`}>
            {classification.confidence >= 0.75 ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            {Math.round(classification.confidence * 100)}% Confidence
          </span>
          
          {/* Account Code */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {classification.accountCode} - {classification.accountName}
          </span>
          
          {/* Tax Badges */}
          {classification.vatApplicable && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              VAT 7.5%
            </span>
          )}
          {classification.whtApplicable && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
              WHT {classification.whtRate || 10}%
            </span>
          )}
        </div>

        {/* Expand Button */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mt-3"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? "rotate-180" : ""}`} />
          {showDetails ? "Hide details" : "Show details"}
        </button>
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
          {/* Classification Details */}
          <div>
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Classification Details
            </h5>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-2 font-medium text-gray-900">{typeStyle.label}</span>
              </div>
              <div>
                <span className="text-gray-500">Account:</span>
                <span className="ml-2 font-medium text-gray-900">{classification.accountCode}</span>
              </div>
              <div>
                <span className="text-gray-500">Method:</span>
                <span className="ml-2 font-medium text-gray-900">{sourceBadge.description}</span>
              </div>
              <div>
                <span className="text-gray-500">Confidence:</span>
                <span className="ml-2 font-medium text-gray-900">{Math.round(classification.confidence * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Tax Implications */}
          {(classification.vatApplicable || classification.whtApplicable) && (
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Tax Implications
              </h5>
              <div className="space-y-2">
                {classification.vatApplicable && (
                  <div className="flex items-center justify-between text-sm bg-white rounded-lg p-2 border border-gray-200">
                    <span className="text-gray-700">VAT (7.5%)</span>
                    <span className="font-medium text-gray-900">
                      ₦{(Math.abs(transaction.amount) * 0.075).toLocaleString()}
                    </span>
                  </div>
                )}
                {classification.whtApplicable && (
                  <div className="flex items-center justify-between text-sm bg-white rounded-lg p-2 border border-gray-200">
                    <span className="text-gray-700">WHT ({classification.whtRate || 10}%)</span>
                    <span className="font-medium text-gray-900">
                      ₦{(Math.abs(transaction.amount) * (classification.whtRate || 10) / 100).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {classification.suggestions && classification.suggestions.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Alternative Classifications
              </h5>
              <div className="flex flex-wrap gap-2">
                {classification.suggestions.filter(Boolean).map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => onEditClassification?.(suggestion)}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:border-[#64B5F6] hover:text-[#64B5F6] transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {classification.warnings && classification.warnings.length > 0 && (
            <div className="bg-yellow-50 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                {classification.warnings.map((warning, idx) => (
                  <p key={idx}>{warning}</p>
                ))}
              </div>
            </div>
          )}

          {/* Edit Button */}
          <button
            onClick={() => onEditClassification?.(classification.accountCode)}
            className="flex items-center gap-2 text-sm text-[#64B5F6] hover:text-[#42A5F5] font-medium"
          >
            <Edit3 className="w-4 h-4" />
            Edit Classification
          </button>
        </div>
      )}
    </div>
  );
}
