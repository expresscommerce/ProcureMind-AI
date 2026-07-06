"use client";

import { useViewMode } from "@/lib/viewMode";
import { GlossaryTerm } from "@/components/GlossaryTerm";

interface PlainLanguageItemProps {
  id: string;
  plainLanguage?: string;
  expertContent: React.ReactNode;
  type?: "cost" | "risk" | "compliance" | "sla";
}

/**
 * Renders either plain-language text (Simple mode) or raw expert content.
 * Uses the same data — this is a rendering difference, not a data difference.
 */
export function PlainLanguageItem({
  plainLanguage,
  expertContent,
}: Omit<PlainLanguageItemProps, "id" | "type">) {
  const { mode } = useViewMode();

  if (mode === "expert" || !plainLanguage) {
    return <>{expertContent}</>;
  }

  // In Simple mode, render the plain-language sentence with glossary terms auto-linked
  return (
    <div className="text-sm text-ink leading-relaxed py-1">
      <AutoGlossary text={plainLanguage} />
    </div>
  );
}

/**
 * Auto-link glossary terms found in text
 */
function AutoGlossary({ text }: { text: string }) {
  // Common procurement terms to auto-link
  const terms = [
    "SLA", "TCO", "SOC 2", "GDPR", "HIPAA", "ISO 27001", "SSO",
    "indemnification", "warranty period", "compliance", "uptime",
    "data retention", "auto-renewal", "price cap", "overage fee",
    "per-seat pricing", "per-active-user pricing", "go-live date",
    "delivery days", "liquidated damages", "force majeure", "escrow",
    "SaaS", "RFP", "NDA", "MSA", "KPI", "SOW",
    "termination for convenience", "subprocessor",
  ];

  // Sort by length descending so longer terms match first
  const sortedTerms = [...terms].sort((a, b) => b.length - a.length);

  // Build regex pattern
  const pattern = new RegExp(
    `\\b(${sortedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "gi"
  );

  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const matchedTerm = sortedTerms.find(
          (t) => t.toLowerCase() === part.toLowerCase()
        );
        if (matchedTerm) {
          return (
            <GlossaryTerm key={i} term={matchedTerm}>
              {part}
            </GlossaryTerm>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

interface PlainLanguageExplanation {
  id: string;
  plain_language: string;
}

interface PlainLanguageData {
  cost_explanations?: PlainLanguageExplanation[];
  risk_explanations?: PlainLanguageExplanation[];
  compliance_explanations?: PlainLanguageExplanation[];
  sla_explanations?: PlainLanguageExplanation[];
  [key: string]: PlainLanguageExplanation[] | undefined;
}

/**
 * Helper to get plain language text for an item from the plain_language data
 */
export function getPlainLanguage(
  plainLanguageData: PlainLanguageData | null | undefined,
  itemId: string,
  type: "cost" | "risk" | "compliance" | "sla"
): string | undefined {
  if (!plainLanguageData) return undefined;

  const keyMap: Record<string, string> = {
    cost: "cost_explanations",
    risk: "risk_explanations",
    compliance: "compliance_explanations",
    sla: "sla_explanations",
  };

  const key = keyMap[type];
  if (!key || !plainLanguageData[key]) return undefined;

  const item = (plainLanguageData[key] as PlainLanguageExplanation[]).find(
    (e) => e.id === itemId
  );
  return item?.plain_language;
}
