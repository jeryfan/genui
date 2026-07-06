"use client";

import { type FC } from "react";
import { ExportButton } from "./export-button";
import { SettingsButton } from "./settings-button";
import { SyncSettingsButton } from "./sync-settings-button";
import { ThreadTitle } from "./thread-title";

export const Header: FC = () => {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-4">
      <ThreadTitle />
      <div className="ml-auto flex items-center gap-1">
        <ExportButton />
        <SyncSettingsButton />
        <SettingsButton />
      </div>
    </header>
  );
};
