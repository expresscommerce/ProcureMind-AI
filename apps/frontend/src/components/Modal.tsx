import React from "react";
import { Button } from "./ui/button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-ink-muted/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-lg border border-rule bg-surface p-6 shadow-xl transition-all space-y-4">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <h3 className="font-serif text-xl font-semibold text-ink">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-ink-muted hover:text-ink transition-colors font-medium text-lg"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {children}
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="secondary">Close</Button>
        </div>
      </div>
    </div>
  );
}
