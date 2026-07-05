"use client";

import { useAuiState, useThreadRuntime } from "@assistant-ui/react";
import { PlusIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import {
  ContextDisplayBar,
  useEstimatedTokenUsage,
} from "@/components/assistant-ui/context-display";
import { useSettings } from "@/components/chat/settings/context";
import {
  createModelsFromConfigs,
  findModelByRuntimeKey,
} from "@/components/chat/settings/models";

type AssistantFooterProps = {
  onNewThread?: () => void;
  contextWindow?: number;
};

const DEFAULT_CONTEXT_WINDOW = 128_000;

export function AssistantFooter(props: AssistantFooterProps = {}): ReactNode {
  if (props.contextWindow !== undefined) {
    return (
      <AssistantFooterContent {...props} contextWindow={props.contextWindow} />
    );
  }

  return <DefaultAssistantFooter {...props} />;
}

function DefaultAssistantFooter(props: AssistantFooterProps): ReactNode {
  const threadRuntime = useThreadRuntime();
  const { settings } = useSettings();
  const models = useMemo(() => createModelsFromConfigs(settings.models), [settings.models]);
  const modelName = threadRuntime.getModelContext().config?.modelName;
  const model = modelName
    ? findModelByRuntimeKey(models.getModels(), modelName)
    : undefined;
  const contextWindow = model?.contextWindow ?? DEFAULT_CONTEXT_WINDOW;

  return (
    <AssistantFooterContent
      {...props}
      contextWindow={contextWindow}
    />
  );
}

function AssistantFooterContent({
  onNewThread,
  contextWindow,
}: AssistantFooterProps & { contextWindow: number }): ReactNode {
  const threadRuntime = useThreadRuntime();
  const messages = useAuiState((s) => s.thread.messages);
  const lastUsage = useEstimatedTokenUsage();

  if (messages.length === 0) return null;

  return (
    <div className="mx-auto flex w-full max-w-(--thread-max-width) items-center justify-between px-3 py-1.5">
      <button
        type="button"
        onClick={() => {
          if (onNewThread) {
            onNewThread();
          } else {
            threadRuntime.reset();
          }
        }}
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors"
      >
        <PlusIcon className="size-3.5" />
        <span>New thread</span>
      </button>

      <ContextDisplayBar modelContextWindow={contextWindow} usage={lastUsage} />
    </div>
  );
}
