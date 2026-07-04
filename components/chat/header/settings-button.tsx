"use client";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Settings } from "lucide-react";
import { type FC } from "react";

export const SettingsButton: FC = () => {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <TooltipIconButton
            variant="ghost"
            size="icon"
            tooltip="Settings"
            side="bottom"
            className="size-8"
          >
            <Settings className="size-4" />
          </TooltipIconButton>
        }
      />
      <SheetContent side="right" className="w-80">
        <div className="flex h-full flex-col">
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Settings panel placeholder. Features will be planned here.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
