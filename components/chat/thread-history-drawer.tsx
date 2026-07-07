"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { MenuIcon, MessageSquareIcon, Trash2Icon } from "lucide-react";
import { type FC, useState } from "react";

function formatLastMessageAt(value?: Date) {
  if (!value) return "No messages yet";

  const now = Date.now();
  const timestamp = value.getTime();
  const diffMinutes = Math.max(0, Math.floor((now - timestamp) / 60_000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export const ThreadHistoryDrawer: FC = () => {
  const [open, setOpen] = useState(false);
  const threadCount = useAuiState((s) => s.threads.threadIds.length);
  const isLoading = useAuiState((s) => s.threads.isLoading);
  const mainThreadId = useAuiState((s) => s.threads.mainThreadId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open thread history"
            className="-ml-2"
          />
        }
      >
        <MenuIcon className="size-4" aria-hidden />
      </SheetTrigger>

      <SheetContent
        side="bottom"
        showCloseButton={false}
        style={{ height: "65vh" }}
        className="gap-0 rounded-t-3xl border-border/70 p-0"
      >
        <ThreadListPrimitive.Root className="min-h-0 overflow-y-auto p-3 pt-4">
          {threadCount === 0 && !isLoading ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-10 text-center text-sm">
              <MessageSquareIcon className="size-5" />
              <span>No thread history yet.</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <ThreadListPrimitive.Items>
              {({ threadListItem }) => (
                <ThreadHistoryItem
                  key={threadListItem.id}
                  title={threadListItem.title}
                  isMain={threadListItem.id === mainThreadId}
                  lastMessageAt={threadListItem.lastMessageAt}
                  onSelect={() => setOpen(false)}
                />
              )}
            </ThreadListPrimitive.Items>
          </div>
        </ThreadListPrimitive.Root>
      </SheetContent>
    </Sheet>
  );
};

type ThreadHistoryItemProps = {
  title?: string;
  isMain: boolean;
  lastMessageAt?: Date;
  onSelect: () => void;
};

const ThreadHistoryItem: FC<ThreadHistoryItemProps> = ({
  title,
  isMain,
  lastMessageAt,
  onSelect,
}) => {
  return (
    <ThreadListItemPrimitive.Root
      className={cn(
        "group flex items-center gap-2 rounded-2xl border border-transparent p-1 transition-colors",
        isMain ? "border-border bg-muted/70" : "hover:bg-muted/60",
      )}
    >
      <ThreadListItemPrimitive.Trigger
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left"
      >
        <span className="bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full border">
          <MessageSquareIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {title || "New thread"}
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {formatLastMessageAt(lastMessageAt)}
          </span>
        </span>
      </ThreadListItemPrimitive.Trigger>

      <ThreadListItemPrimitive.Delete
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-8 shrink-0 items-center justify-center rounded-full opacity-70 transition-colors group-hover:opacity-100 disabled:hidden"
        aria-label="Delete thread"
      >
        <Trash2Icon className="size-3.5" />
      </ThreadListItemPrimitive.Delete>
    </ThreadListItemPrimitive.Root>
  );
};
