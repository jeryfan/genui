"use client";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { useSettings } from "@/components/chat/settings/context";
import { cn } from "@/lib/utils";
import { RefreshCwIcon } from "lucide-react";
import { useState, type FC } from "react";

export const SyncSettingsButton: FC = () => {
  const { reloadSettings } = useSettings();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleClick = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await reloadSettings();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <TooltipIconButton
      variant="ghost"
      size="icon"
      tooltip="Sync settings"
      side="bottom"
      onClick={handleClick}
      disabled={isSyncing}
      className="size-8"
      aria-label="Sync settings"
    >
      <RefreshCwIcon className={cn("size-4", isSyncing && "animate-spin")} />
    </TooltipIconButton>
  );
};
