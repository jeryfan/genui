"use client";

import { useAuiState } from "@assistant-ui/react";
import type { Usage } from "@jeryfan/ai";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  createContext,
  useContext,
  useMemo,
  type FC,
  type ReactNode,
} from "react";

export type TokenUsage = {
  totalTokens: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
};

const formatTokenCount = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${tokens}`;
};

const getUsagePercent = (
  totalTokens: number | undefined,
  modelContextWindow: number,
): number => {
  if (!totalTokens) return 0;
  return Math.min((totalTokens / modelContextWindow) * 100, 100);
};

type UsageSeverity = "normal" | "warning" | "critical";

const getUsageSeverity = (percent: number): UsageSeverity => {
  if (percent > 85) return "critical";
  if (percent >= 65) return "warning";
  return "normal";
};

const getBarColor = (percent: number): string => {
  const severity = getUsageSeverity(percent);
  if (severity === "critical") return "bg-red-500";
  if (severity === "warning") return "bg-amber-500";
  return "bg-emerald-500";
};

type ContextDisplayContextValue = {
  usage: TokenUsage | undefined;
  totalTokens: number;
  percent: number;
  modelContextWindow: number;
};

const ContextDisplayContext = createContext<ContextDisplayContextValue | null>(
  null,
);

function useContextDisplay(): ContextDisplayContextValue {
  const ctx = useContext(ContextDisplayContext);
  if (!ctx) {
    throw new Error("ContextDisplay.* must be used within ContextDisplay.Root");
  }
  return ctx;
}

type PresetProps = {
  modelContextWindow: number;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  usage?: TokenUsage | undefined;
};

type ContextDisplayRootProps = {
  modelContextWindow: number;
  children: ReactNode;
  usage?: TokenUsage | undefined;
};

function ContextDisplayRoot({
  modelContextWindow,
  children,
  usage,
}: ContextDisplayRootProps) {
  const totalTokens = usage?.totalTokens ?? 0;
  const percent = getUsagePercent(totalTokens, modelContextWindow);

  const contextValue = useMemo(
    () => ({
      usage,
      totalTokens,
      percent,
      modelContextWindow,
    }),
    [usage, totalTokens, percent, modelContextWindow],
  );

  return (
    <ContextDisplayContext.Provider value={contextValue}>
      <TooltipProvider delay={0}>
        <Tooltip>{children}</Tooltip>
      </TooltipProvider>
    </ContextDisplayContext.Provider>
  );
}

function ContextDisplayTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <TooltipTrigger
      render={
        <button
          type="button"
          data-slot="context-display-trigger"
          className={cn(
            "inline-flex items-center rounded-md transition-colors",
            className,
          )}
          {...props}
        >
          {children}
        </button>
      }
    />
  );
}

function ContextDisplayContent({
  side = "top",
  className,
}: {
  side?: "top" | "bottom" | "left" | "right" | undefined;
  className?: string;
}) {
  const { usage, totalTokens, percent, modelContextWindow } = useContextDisplay();

  return (
    <TooltipContent
      side={side}
      sideOffset={8}
      data-slot="context-display-popover"
      className={cn(
        "bg-popover text-popover-foreground rounded-lg border px-3 py-2 shadow-md",
        className,
      )}
    >
      <div className="grid min-w-40 gap-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Usage</span>
          <span className="font-mono tabular-nums">{Math.round(percent)}%</span>
        </div>
        {usage?.inputTokens !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Input</span>
            <span className="font-mono tabular-nums">
              {formatTokenCount(usage.inputTokens)}
            </span>
          </div>
        )}
        {usage?.cachedInputTokens !== undefined &&
          usage.cachedInputTokens > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Cached</span>
              <span className="font-mono tabular-nums">
                {formatTokenCount(usage.cachedInputTokens)}
              </span>
            </div>
          )}
        {usage?.outputTokens !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Output</span>
            <span className="font-mono tabular-nums">
              {formatTokenCount(usage.outputTokens)}
            </span>
          </div>
        )}
        {usage?.reasoningTokens !== undefined && usage.reasoningTokens > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Reasoning</span>
            <span className="font-mono tabular-nums">
              {formatTokenCount(usage.reasoningTokens)}
            </span>
          </div>
        )}
        <div className="mt-0.5 border-t pt-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Total</span>
            <span className="font-mono tabular-nums">
              {formatTokenCount(totalTokens)} /{" "}
              {formatTokenCount(modelContextWindow)}
            </span>
          </div>
        </div>
      </div>
    </TooltipContent>
  );
}

function BarVisual() {
  const { percent, totalTokens } = useContextDisplay();

  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            getBarColor(percent),
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-muted-foreground text-[10px] tabular-nums">
        {formatTokenCount(totalTokens)} ({Math.round(percent)}%)
      </span>
    </div>
  );
}

const ContextDisplayBar: FC<PresetProps> = ({
  modelContextWindow,
  className,
  side,
  usage,
}) => (
  <ContextDisplayRoot modelContextWindow={modelContextWindow} usage={usage}>
    <ContextDisplayTrigger
      className={cn("px-2 py-1", className)}
      aria-label="Context usage"
    >
      <BarVisual />
    </ContextDisplayTrigger>
    <ContextDisplayContent side={side} />
  </ContextDisplayRoot>
);

const ContextDisplay = {} as {
  Root: typeof ContextDisplayRoot;
  Trigger: typeof ContextDisplayTrigger;
  Content: typeof ContextDisplayContent;
  Bar: typeof ContextDisplayBar;
};

ContextDisplay.Root = ContextDisplayRoot;
ContextDisplay.Trigger = ContextDisplayTrigger;
ContextDisplay.Content = ContextDisplayContent;
ContextDisplay.Bar = ContextDisplayBar;

export function useEstimatedTokenUsage(): TokenUsage {
  const messages = useAuiState((s) => s.thread.messages);

  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  const usage = (lastAssistant as { metadata?: { custom?: Record<string, unknown> } } | undefined)
    ?.metadata?.custom?.usage as Usage | undefined;

  if (usage) {
    return {
      totalTokens: usage.totalTokens,
      inputTokens: usage.input,
      outputTokens: usage.output,
      cachedInputTokens: usage.cacheRead,
      reasoningTokens: usage.reasoning,
    };
  }

  const text = messages
    .map((message) =>
      message.content
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join(""),
    )
    .join("");

  const totalTokens = Math.max(1, Math.ceil(text.length / 4));

  return { totalTokens };
}

export {
  ContextDisplay,
  ContextDisplayRoot,
  ContextDisplayTrigger,
  ContextDisplayContent,
  ContextDisplayBar,
};
