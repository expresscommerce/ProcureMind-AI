"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { CreateProjectForm } from "./CreateProjectForm";

type CreateProjectButtonProps = {
  className?: string;
};

export function CreateProjectButton({ className }: CreateProjectButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button
        variant="default"
        size="sm"
        aria-label="Create new project"
        onClick={() => setModalOpen(true)}
        className={className}
      >
        <Plus className="size-3.5" />
      </Button>

      {modalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm">
            <div className="bg-surface border border-rule rounded-md p-6 w-[400px] max-w-[90vw] shadow-lg">
              <h2 className="font-serif text-2xl text-ink font-semibold mb-4">Create New Project</h2>
              <CreateProjectForm
                onCreated={() => setModalOpen(false)}
                onCancel={() => setModalOpen(false)}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
