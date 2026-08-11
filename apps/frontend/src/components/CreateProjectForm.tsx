"use client";

import { useState } from "react";
import { useProject } from "@/lib/project";
import { Button } from "./ui/button";

type CreateProjectFormProps = {
  onCreated?: () => void;
  onCancel?: () => void;
};

export function CreateProjectForm({ onCreated, onCancel }: CreateProjectFormProps) {
  const { createProject } = useProject();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createProject(name);
      setName("");
      onCreated?.();
    } finally {
      setCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Project Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 2026 Vendor Audit"
          className="w-full border border-rule rounded-sm px-3 py-2 text-sm text-ink bg-paper focus:outline-none focus:border-navy"
        />
      </div>

      {onCancel ? (
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create Project"}
          </Button>
        </div>
      ) : (
        <Button type="submit" className="w-full" disabled={creating}>
          {creating ? "Creating..." : "Create Project"}
        </Button>
      )}
    </form>
  );
}
