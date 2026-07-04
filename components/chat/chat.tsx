"use client";

import { useState, type FC } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { ChatThread } from "./thread";

export const Chat: FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="bg-muted/30 flex h-full w-full">
      <div className="hidden md:block">
        <Sidebar collapsed={sidebarCollapsed} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden p-2 md:pl-0">
        <div className="bg-background flex flex-1 flex-col overflow-hidden rounded-lg">
          <Header
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          <main className="flex-1 overflow-hidden">
            <ChatThread />
          </main>
        </div>
      </div>
    </div>
  );
};
