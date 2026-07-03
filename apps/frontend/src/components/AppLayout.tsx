"use client";

import { useAuth } from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { useProject } from "@/lib/project";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { AskDrawer } from "./AskDrawer";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading: authLoading } = useAuth();
  const { currentProject, loading: projectLoading, createProject } = useProject();
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [isAskDrawerOpen, setIsAskDrawerOpen] = useState(false);

  useEffect(() => {
    const handleOpenAskDrawer = () => setIsAskDrawerOpen(true);
    window.addEventListener("open-ask-drawer", handleOpenAskDrawer);
    return () => window.removeEventListener("open-ask-drawer", handleOpenAskDrawer);
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      await createProject(newProjectName);
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <>{children}</>;
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-full max-w-md bg-surface p-8 rounded-md border border-rule shadow-sm">
          <h2 className="font-serif text-2xl font-semibold text-ink mb-2">Create your first Project</h2>
          <p className="text-ink-muted mb-6 text-sm">You need a project space before you can upload vendor proposals.</p>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Project Name</label>
              <input 
                type="text" 
                required
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. 2026 Vendor Audit"
                className="w-full h-10 px-3 rounded-sm border border-rule bg-paper text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
              />
            </div>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? "Creating..." : "Create Project"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <main className="flex-1 pl-[240px]">
        <div className="max-w-[1280px] mx-auto p-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
      <AskDrawer isOpen={isAskDrawerOpen} onClose={() => setIsAskDrawerOpen(false)} />
    </div>
  );
}
