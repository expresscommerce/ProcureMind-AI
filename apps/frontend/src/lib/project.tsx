"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "./api";
import { useAuth } from "@/components/AuthProvider";

type Project = {
  id: string;
  name: string;
};

type ProjectContextType = {
  currentProject: Project | null;
  setCurrentProject: (project: Project) => void;
  projects: Project[];
  createProject: (name: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  loading: boolean;
};

const ProjectContext = createContext<ProjectContextType>({
  currentProject: null,
  setCurrentProject: () => {},
  projects: [],
  createProject: async () => { throw new Error("Not initialized"); },
  deleteProject: async () => {},
  loading: true
});

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      loadProjects();
    } else {
      setProjects([]);
      setCurrentProject(null);
      setLoading(false);
    }
  }, [session]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/projects");
      setProjects(data);
      if (data.length > 0) {
        setCurrentProject(data[0]);
      }
    } catch (e) {
      console.error("Failed to load projects", e);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (name: string) => {
    const data = await apiFetch(`/projects?name=${encodeURIComponent(name)}`, { method: "POST" });
    setProjects([...projects, data]);
    setCurrentProject(data);
    return data;
  };

  const deleteProject = async (id: string) => {
    await apiFetch(`/projects/${id}`, { method: "DELETE" });
    const next = projects.filter((p) => p.id !== id);
    setProjects(next);
    if (currentProject?.id === id) {
      setCurrentProject(next[0] ?? null);
    }
  };

  return (
    <ProjectContext.Provider value={{ currentProject, setCurrentProject, projects, createProject, deleteProject, loading }}>
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => useContext(ProjectContext);
