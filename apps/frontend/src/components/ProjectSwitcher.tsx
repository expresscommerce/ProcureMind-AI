"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, FolderOpen, Trash2 } from "lucide-react";
import { useProject } from "@/lib/project";
import { Button } from "./ui/button";
import { CreateProjectButton } from "./CreateProjectButton";
import { cn } from "@/lib/utils";

const DROPDOWN_WIDTH = 256;

export function ProjectSwitcher() {
  const { currentProject, projects, setCurrentProject, deleteProject } = useProject();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [deletingProject, setDeletingProject] = useState<{ id: string; name: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    if (!dropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - DROPDOWN_WIDTH - 8)),
      });
    }
    setDropdownOpen((prev) => !prev);
  };

  const openDeleteModal = (project: { id: string; name: string }) => {
    setDropdownOpen(false);
    setConfirmText("");
    setDeletingProject(project);
  };

  const confirmDelete = async () => {
    if (!deletingProject) return;
    setDeleting(true);
    try {
      await deleteProject(deletingProject.id);
      setDeletingProject(null);
      setConfirmText("");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setDropdownOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  return (
    <>
      <div ref={buttonRef} className="inline-flex w-full overflow-hidden rounded-md border border-navy">
        <Button
          variant="default"
          size="sm"
          onClick={toggleDropdown}
          aria-expanded={dropdownOpen}
          aria-label="Switch project"
          className="flex-1 min-w-0 justify-start rounded-none px-2.5"
        >
          <span className="flex-1 min-w-0 truncate text-left">
            {currentProject?.name ?? "Select project"}
          </span>
          <ChevronDown className="size-3.5 shrink-0" />
        </Button>
        <CreateProjectButton className="rounded-none border-l border-paper/30 px-2" />
      </div>

      {dropdownOpen &&
        dropdownPos &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 w-64 bg-surface border border-rule rounded-md shadow-xl py-1"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            <p className="px-3 py-2 text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Switch project
            </p>
            {projects.length === 0 && (
              <p className="px-3 py-2 text-sm text-ink-muted">No projects yet.</p>
            )}
            <ul className="max-h-64 overflow-y-auto">
              {projects.map((project) => {
                const isActive = project.id === currentProject?.id;
                return (
                  <li key={project.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentProject(project);
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 pr-8 text-sm text-left transition-colors hover:bg-rule/30",
                        isActive ? "text-navy font-medium" : "text-ink"
                      )}
                    >
                      <FolderOpen className="size-4 shrink-0" />
                      <span className="flex-1 min-w-0 truncate">{project.name}</span>
                      {isActive && <Check className="size-4 shrink-0" />}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete project ${project.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(project);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-audit-red"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}

      {deletingProject &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm">
            <div className="bg-surface border border-rule rounded-md p-6 w-[400px] max-w-[90vw] shadow-lg">
              <h2 className="font-serif text-2xl text-ink font-semibold mb-4">Delete project</h2>
              <p className="text-sm text-ink mb-4">
                This will permanently delete{" "}
                <span className="font-medium">&quot;{deletingProject.name}&quot;</span> and all of its
                vendors, documents, and analysis. This action cannot be undone.
              </p>
              <label className="block text-sm font-medium text-ink mb-1">
                Type &quot;{deletingProject.name}&quot; to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={deletingProject.name}
                className="w-full border border-rule rounded-sm px-3 py-2 text-sm text-ink bg-paper focus:outline-none focus:border-audit-red"
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" type="button" onClick={() => setDeletingProject(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  type="button"
                  disabled={confirmText !== deletingProject.name || deleting}
                  onClick={confirmDelete}
                >
                  {deleting ? "Deleting..." : "Delete project"}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
