"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { ConnectedApp } from "@/lib/ConnectedAppsContext";

// Initialize Gemini
const apiKey = process.env.GOOGLE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const SYSTEM_PROMPT = `
You are the "Quantum Ledger Personal Finance Assistant", a helpful, secure, and intelligent AI for Nigerian users.
Your goal is to help users manage their personal finances, investments, and business automated tasks.

CONTEXT:
- The user has connected various financial apps (banks, investment platforms, utilities).
- You can only see data from apps that are currently marked as "CONNECTED".
- If a user asks about an app that is "DISCONNECTED", politely ask them to connect it in the "Connected Apps" section.
- Allow users to ask about spending, balances, investments, and reconciliation.
- Keep responses concise, friendly, and formatted (use bullet points, bold text for amounts).
- Currency: Nigerian Naira (₦).

AVAILABLE DATA (Simulated for this context):
- Zenith Business: ₦8,450,000 (Active)
- GTB Treasury: ₦4,230,000 (Active)
- RiseVest: ₦5.2M (12% returns)
- Bamboo: $2,400 (₦3.1M)
- Cowrywise: ₦850,000
- PiggyVest: ₦1.2M

When you receive the list of connected apps, strictly adhere to what is available.
`;

export async function generatePfmResponse(message: string, connectedApps: ConnectedApp[]): Promise<string> {
  if (!apiKey) {
    return "⚠️ Google Gemini API Key is missing. Please configure it in your environment variables.";
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Filter for connected apps to build context
    const activeConnections = connectedApps.filter(app => app.status === "connected").map(app => app.name).join(", ");
    const disconnected = connectedApps.filter(app => app.status === "disconnected").map(app => app.name).join(", ");

    const userPrompt = `
User Message: "${message}"

User's Connected Apps: ${activeConnections || "None"}
User's Disconnected Apps: ${disconnected || "None"}

Based on the connected apps, provide a helpful response. If they ask for data from a disconnected app, guide them to connect it.
`;

    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\n${userPrompt}`);

    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini PFM Error:", error);
    return "I'm having trouble connecting to Google AI right now. Please try again later.";
  }
}
