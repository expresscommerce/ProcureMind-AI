"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { useProject } from "@/lib/project";
import { apiFetch } from "@/lib/api";

export function AskDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<{ q: string; a: string; cite: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentProject } = useProject();

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !currentProject) return;

    const q = question;
    setQuestion("");
    setLoading(true);

    try {
      const data = await apiFetch(`/projects/${currentProject.id}/ask`, {
        method: "POST",
        body: JSON.stringify({ question: q }),
      });
      setHistory(prev => [...prev, { q, a: data.answer, cite: data.citation }]);
    } catch (err: any) {
      setHistory(prev => [...prev, { q, a: `Error: ${err.message}`, cite: "None" }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-surface border-l border-rule shadow-lg z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-6 border-b border-rule flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-ink">Ask a Question</h2>
        <button onClick={onClose} className="text-ink-muted hover:text-ink">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-paper">
        {history.map((item, idx) => (
          <div key={idx} className="space-y-3">
            <div className="font-medium text-ink">{item.q}</div>
            <div className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{item.a}</div>
            {item.cite && item.cite !== "None" && (
              <div className="text-xs text-ink-muted border-t border-rule/50 pt-2">{item.cite}</div>
            )}
          </div>
        ))}
        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-3/4 bg-rule rounded"></div>
            <div className="h-20 w-full bg-rule rounded"></div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-rule bg-surface">
        <form onSubmit={handleAsk} className="flex flex-col gap-3">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Ask about vendor compliance, costs, terms..."
            className="w-full min-h-[80px] p-3 text-sm rounded-sm border border-rule bg-paper text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy resize-none"
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk(e);
              }
            }}
          />
          <Button type="submit" disabled={loading || !question.trim()}>Ask</Button>
        </form>
      </div>
    </div>
  );
}
