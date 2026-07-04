"use client";

import {
  ThreadList,
  ThreadListItems,
  ThreadListNew,
  ThreadListRoot,
} from "@/components/assistant-ui/thread-list";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type FC } from "react";

export const Sidebar: FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  return (
    <aside
      className={cn(
        "flex h-full flex-col overflow-hidden transition-all duration-200",
        collapsed ? "w-12" : "w-65",
      )}
    >
      <div
        className={cn(
          "mt-2 flex h-12 shrink-0 items-center transition-[padding] duration-200",
          collapsed ? "px-3.5" : "px-6",
        )}
      >
        <span
          className={cn(
            "text-foreground/90 ml-2 text-sm font-medium whitespace-nowrap transition-opacity duration-200",
            collapsed && "opacity-0",
          )}
        >
          GenUI
        </span>
      </div>
      <ThreadListRoot
        className={cn(
          "relative flex-1 overflow-y-auto transition-[padding,width] duration-200",
          collapsed ? "w-12 px-2 pt-1" : "w-65 p-3",
        )}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <ThreadListNew
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  collapsed
                    ? "w-8 gap-0 px-2 has-[>svg]:px-2"
                    : "w-full gap-2 px-2.5 has-[>svg]:px-2.5",
                )}
                labelClassName={cn(
                  "overflow-hidden transition-all duration-200",
                  collapsed ? "max-w-0 opacity-0" : "max-w-24 opacity-100",
                )}
              />
            }
          />
          {collapsed && (
            <TooltipContent side="right">New Thread</TooltipContent>
          )}
        </Tooltip>
        <ThreadListItems
          aria-hidden={collapsed}
          inert={collapsed}
          className={cn(
            "transition-[opacity,transform] duration-150",
            collapsed
              ? "pointer-events-none opacity-0 delay-50"
              : "translate-x-0 opacity-100",
          )}
        />
      </ThreadListRoot>
    </aside>
  );
};
