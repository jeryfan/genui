"use client";

import { useAuiState } from "@assistant-ui/react";
import { type FC } from "react";

export const ThreadTitle: FC = () => {
  const title = useAuiState(
    (s) =>
      s.threads.threadItems.find((t) => t.id === s.threads.mainThreadId)?.title,
  );

  return (
    <span className="min-w-0 truncate text-sm font-medium">
      {title ?? "New Chat"}
    </span>
  );
};
