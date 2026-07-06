"use client";

import { createContext, useContext } from "react";

type ViewMode = "simple" | "expert";

type ViewModeContextType = {
  mode: ViewMode;
  toggleMode: () => void;
  isLoading: boolean;
};

const ViewModeContext = createContext<ViewModeContextType>({
  mode: "simple",
  toggleMode: () => {},
  isLoading: false,
});

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ViewModeContext.Provider value={{ mode: "simple", toggleMode: () => {}, isLoading: false }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export const useViewMode = () => useContext(ViewModeContext);
