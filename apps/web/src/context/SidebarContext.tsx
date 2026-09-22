'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  toggleCollapse: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
  toggleCollapse: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsedState] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gss_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsedState(saved === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  const setIsCollapsed = (v: boolean) => {
    setIsCollapsedState(v);
    try {
      localStorage.setItem('gss_sidebar_collapsed', String(v));
    } catch {
      // ignore
    }
  };

  const toggleCollapse = () => {
    setIsCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gss_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, toggleCollapse }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
