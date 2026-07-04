"use client";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { PanelLeftIcon } from "lucide-react";
import { type FC } from "react";
import { ExportButton } from "./export-button";
import { MobileSidebar } from "./mobile-sidebar";
import { SettingsButton } from "./settings-button";
import { ThreadTitle } from "./thread-title";

export const Header: FC<{
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}> = ({ sidebarCollapsed, onToggleSidebar }) => {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-4">
      <MobileSidebar />
      <TooltipIconButton
        variant="ghost"
        size="icon"
        tooltip={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        side="bottom"
        onClick={onToggleSidebar}
        className="hidden size-8 md:flex"
      >
        <PanelLeftIcon className="size-4" />
      </TooltipIconButton>
      <ThreadTitle />
      <div className="ml-auto flex items-center gap-1">
        <ExportButton />
        <SettingsButton />
      </div>
    </header>
  );
};
