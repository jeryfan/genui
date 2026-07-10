"use client";

import { Code2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type FC } from "react";
import { ExportButton } from "./export-button";
import { SettingsButton } from "./settings-button";
import { SyncSettingsButton } from "./sync-settings-button";
import { ThreadTitle } from "./thread-title";
import { ThreadHistoryDrawer } from "../thread-history-drawer";

const handleOpenHtmlPreview = () => {
  browser.tabs.create({
    url: browser.runtime.getURL("/preview.html"),
  });
};

export const Header: FC = () => {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-4">
      <ThreadHistoryDrawer />
      <ThreadTitle />
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={handleOpenHtmlPreview}
        >
          <Code2Icon className="size-4" />
          HTML Preview
        </Button>
        <ExportButton />
        <SyncSettingsButton />
        <SettingsButton />
      </div>
    </header>
  );
};
