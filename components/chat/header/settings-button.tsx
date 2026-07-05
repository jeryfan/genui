"use client";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Settings } from "lucide-react";
import { type FC } from "react";

export const SettingsButton: FC = () => {
  const handleClick = () => {
    browser.runtime.openOptionsPage();
  };

  return (
    <TooltipIconButton
      variant="ghost"
      size="icon"
      tooltip="Settings"
      side="bottom"
      onClick={handleClick}
      className="size-8"
    >
      <Settings className="size-4" />
    </TooltipIconButton>
  );
};
