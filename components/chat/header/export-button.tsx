"use client";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { useAuiState, useThreadRuntime } from "@assistant-ui/react";
import { DownloadIcon } from "lucide-react";
import { type FC } from "react";

export const ExportButton: FC = () => {
  const runtime = useThreadRuntime();
  const hasMessages = useAuiState((s) =>
    s.thread.messages.some((m) => m.role === "user" || m.role === "assistant"),
  );

  const handleExport = () => {
    const repository = runtime.export();
    const json = JSON.stringify(repository, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `genui-conversation-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipIconButton
      variant="ghost"
      size="icon"
      tooltip="Export conversation"
      side="bottom"
      onClick={handleExport}
      disabled={!hasMessages}
      className="size-8"
    >
      <DownloadIcon className="size-4" />
    </TooltipIconButton>
  );
};
