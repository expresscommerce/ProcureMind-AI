"use client";

import { useAuth } from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { useProject } from "@/lib/project";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AskDrawer } from "./AskDrawer";
import { TourProvider } from "./TourProvider";
import { MobileHeader } from "./MobileHeader";
import { CreateProjectForm } from "./CreateProjectForm";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading: authLoading } = useAuth();
  const { currentProject, loading: projectLoading } = useProject();
  const queryClient = useQueryClient();
  const [isAskDrawerOpen, setIsAskDrawerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleOpenAskDrawer = () => setIsAskDrawerOpen(true);
    window.addEventListener("open-ask-drawer", handleOpenAskDrawer);
    return () => window.removeEventListener("open-ask-drawer", handleOpenAskDrawer);
  }, []);

  useEffect(() => {
    const handleOpenSidebar = () => setIsSidebarOpen(true);
    window.addEventListener("open-mobile-sidebar", handleOpenSidebar);
    return () => window.removeEventListener("open-mobile-sidebar", handleOpenSidebar);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen]);

  useEffect(() => {
    const refreshResults = () => {
      queryClient.invalidateQueries({
        queryKey: ["results", currentProject?.id],
      });
    };
    window.addEventListener("refresh-results", refreshResults);
    return () => window.removeEventListener("refresh-results", refreshResults);
  }, [currentProject, queryClient]);

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
          <CreateProjectForm />
        </div> 
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-paper">

      <MobileHeader isOpen={isSidebarOpen} onMenuClick={() => setIsSidebarOpen((prev) => !prev)} />

      <Sidebar isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} />

      {isSidebarOpen && (
        <div
        className="fixed inset-0 bg-black/50 z-10 md:hidden"
        onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <TourProvider />
      <main className="ml-0 pt-16 md:pt-0 md:pl-[240px] flex-1 min-w-0">
        <div className="max-w-[1280px] mx-auto p-4 sm:p-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
      <AskDrawer isOpen={isAskDrawerOpen} onClose={() => setIsAskDrawerOpen(false)} />
    </div>
  );
}
