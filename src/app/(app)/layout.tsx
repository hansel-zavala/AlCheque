"use client";

import { useState } from "react";
import { Sidebar, TopBar } from "@/components/shared/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="app-main">
        <TopBar onMenuOpen={() => setSidebarOpen(true)} />
        <div className="app-content">
          {children}
        </div>
      </main>
    </div>
  );
}
