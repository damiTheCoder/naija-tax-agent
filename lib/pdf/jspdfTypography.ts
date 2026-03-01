import { jsPDF } from "jspdf";

type FallbackFamily = "times" | "helvetica";

const REGULAR_FONT_FILE = "GlacialIndifference-Regular.ttf";
const BOLD_FONT_FILE = "GlacialIndifference-Bold.ttf";
const FONT_NAME = "GlacialIndifference";

type JsPdfWithFontRegistration = jsPDF & {
  addFileToVFS: (fileName: string, fileContent: string) => void;
  addFont: (postScriptName: string, id: string, fontStyle: string) => void;
};

let regularBase64: string | null = null;
let boldBase64: string | null = null;
let registrationAttempted = false;
let registered = false;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function loadFontBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load font from ${url}`);
  }
  const buffer = await response.arrayBuffer();
  return arrayBufferToBase64(buffer);
}

async function ensureRegistered(doc: jsPDF): Promise<boolean> {
  if (registered) return true;
  if (registrationAttempted && !registered) return false;
  registrationAttempted = true;

  try {
    if (!regularBase64) {
      regularBase64 = await loadFontBase64("/fonts/GlacialIndifference-Regular.ttf");
    }
    if (!boldBase64) {
      boldBase64 = await loadFontBase64("/fonts/GlacialIndifference-Bold.ttf");
    }

    const pdf = doc as JsPdfWithFontRegistration;
    pdf.addFileToVFS(REGULAR_FONT_FILE, regularBase64);
    pdf.addFont(REGULAR_FONT_FILE, FONT_NAME, "normal");
    pdf.addFileToVFS(BOLD_FONT_FILE, boldBase64);
    pdf.addFont(BOLD_FONT_FILE, FONT_NAME, "bold");
    registered = true;
    return true;
  } catch (error) {
    console.error("[PDF Typography] Glacial font registration failed:", error);
    registered = false;
    return false;
  }
}

export async function configureJsPdfTypography(
  doc: jsPDF,
  fallbackFamily: FallbackFamily = "times"
): Promise<string> {
  const hasGlacial = typeof window !== "undefined" ? await ensureRegistered(doc) : false;
  const activeFamily = hasGlacial ? FONT_NAME : fallbackFamily;

  const originalSetFont = doc.setFont.bind(doc);
  doc.setFont = ((fontName?: string, fontStyle?: string, fontWeight?: string | number) => {
    const normalized = typeof fontName === "string" ? fontName.toLowerCase() : "";
    const mappedFamily =
      normalized === "times" || normalized === "helvetica" || normalized === "courier" || !fontName
        ? activeFamily
        : fontName;
    return originalSetFont(mappedFamily, fontStyle, fontWeight);
  }) as typeof doc.setFont;

  doc.setLineHeightFactor(1.4);
  doc.setFont(activeFamily, "normal");
  return activeFamily;
}
