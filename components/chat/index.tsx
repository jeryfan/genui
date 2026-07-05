"use client";

import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  unstable_defaultDirectiveFormatter,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
} from "@assistant-ui/react";
import type { Message, AssistantMessageEvent, Usage } from "@jeryfan/ai";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Chat } from "./chat";
import { SettingsProvider, useSettings } from "./settings/context";
import {
  createModelsFromConfigs,
  findModelByRuntimeKey,
} from "./settings/models";
import { type Settings, type Mention } from "./settings/types";

class ChatErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ChatWithProvider] caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, color: "red" }}>
          <strong>Chat 渲染错误</strong>
          <pre>{this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function getMessageText(message: ThreadMessage): string {
  return message.content
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  if (dataUrl.startsWith("data:")) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], data: match[2] };
    }
  }
  return { mimeType: "image/*", data: dataUrl };
}

function expandMentions(text: string, mentions: Mention[]): string {
  const segments = unstable_defaultDirectiveFormatter.parse(text);
  return segments
    .map((seg) => {
      if (seg.kind === "mention") {
        const mention = mentions.find(
          (m) => m.id === seg.id && m.type === seg.type,
        );
        if (mention) {
          return `\n\n${mention.content}\n\n`;
        }
        return `:${seg.type}[${seg.label}]{name=${seg.id}}`;
      }
      return seg.text;
    })
    .join("");
}

function createBackgroundStream<T>() {
  const port = browser.runtime.connect({ name: "ai-stream" });
  const queue: T[] = [];
  let resolve: ((value: T) => void) | null = null;

  port.onMessage.addListener((msg: T) => {
    if (resolve) {
      resolve(msg);
      resolve = null;
    } else {
      queue.push(msg);
    }
  });

  return {
    port,
    async next(): Promise<T> {
      if (queue.length > 0) {
        return queue.shift()!;
      }
      return new Promise((r) => {
        resolve = r;
      });
    },
  };
}

const attachmentAdapter = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimpleTextAttachmentAdapter(),
]);

function createAiAdapter(
  settingsRef: React.MutableRefObject<Settings>,
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal, context }) {
      const settings = settingsRef.current;
      const modelId = context.config?.modelName;
      const models = createModelsFromConfigs(settings.models);
      const model = findModelByRuntimeKey(models.getModels(), modelId);

      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      const userSystemPrompt = messages
        .filter(
          (m): m is Extract<ThreadMessage, { role: "system" }> =>
            m.role === "system",
        )
        .map(getMessageText)
        .join("\n");

      const formatInstruction = settings.general.defaultFormat
        ? `When the user does not explicitly ask for a format, generate ${settings.general.defaultFormat.toUpperCase()} code by default.`
        : "";

      const systemPrompt = [settings.systemPrompt, formatInstruction, userSystemPrompt]
        .filter(Boolean)
        .join("\n\n");

      const aiMessages = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => {
          if (m.role === "assistant") {
            const text = getMessageText(m);
            return {
              role: "assistant" as const,
              content: [{ type: "text" as const, text }],
              timestamp: Date.now(),
            };
          }

          const allContent = [
            ...m.content,
            ...(m.attachments?.flatMap((att) => att.content ?? []) ?? []),
          ];

          const content = allContent
            .map((part) => {
              if (part.type === "text") {
                return {
                  type: "text" as const,
                  text: expandMentions(part.text, settings.mentions),
                };
              }
              if (part.type === "image") {
                const { mimeType, data } = parseDataUrl(part.image);
                return { type: "image" as const, data, mimeType };
              }
              if (part.type === "file") {
                return {
                  type: "text" as const,
                  text: `<file name="${part.filename ?? "unknown"}">${part.data}</file>`,
                };
              }
              return null;
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);

          const finalContent =
            content.length === 1 && content[0].type === "text"
              ? content[0].text
              : content;

          return {
            role: "user" as const,
            content: finalContent,
            timestamp: Date.now(),
          };
        }) as Message[];

      const { port, next } = createBackgroundStream<
        | { type: "event"; event: AssistantMessageEvent }
        | { type: "done"; usage?: Usage }
        | { type: "error"; error: string }
      >();

      port.postMessage({
        type: "start",
        model,
        messages: aiMessages,
        systemPrompt,
      });

      const onAbort = () => port.postMessage({ type: "abort" });
      abortSignal?.addEventListener("abort", onAbort);

      try {
        let fullText = "";

        while (true) {
          const msg = await next();

          if (msg.type === "done") {
            return;
          }

          if (msg.type === "error") {
            throw new Error(msg.error);
          }

          if (msg.type === "event") {
            const event = msg.event;
            switch (event.type) {
              case "text_start":
                yield { content: [{ type: "text" as const, text: "" }] };
                break;
              case "text_delta":
                fullText += event.delta;
                yield { content: [{ type: "text" as const, text: fullText }] };
                break;
              case "text_end":
                break;
              case "done": {
                const textPart = { type: "text" as const, text: fullText };
                const usage = event.message?.usage;
                const metadata = usage ? { custom: { usage } } : undefined;
                if (event.reason === "length") {
                  yield {
                    content: [textPart],
                    status: {
                      type: "incomplete",
                      reason: "length",
                      error: "输出已截断，可能因 token 限制未完整生成",
                    },
                    metadata,
                  };
                } else if (event.reason === "toolUse") {
                  yield {
                    content: [textPart],
                    status: { type: "requires-action", reason: "tool-calls" },
                    metadata,
                  };
                } else {
                  yield {
                    content: [textPart],
                    status: { type: "complete", reason: "stop" },
                    metadata,
                  };
                }
                return;
              }
              case "error":
                throw new Error(
                  event.error.errorMessage ?? "AI request failed",
                );
            }
          }
        }
      } finally {
        abortSignal?.removeEventListener("abort", onAbort);
        port.disconnect();
      }
    },
  };
}

export function ChatWithProvider() {
  return (
    <SettingsProvider>
      <ChatWithProviderInner />
    </SettingsProvider>
  );
}

function ChatWithProviderInner() {
  const { settings } = useSettings();
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const adapter = useMemo(
    () => createAiAdapter(settingsRef),
    [],
  );

  const runtime = useLocalRuntime(adapter, {
    adapters: {
      attachments: attachmentAdapter,
    },
  });

  return (
    <ChatErrorBoundary>
      <AssistantRuntimeProvider runtime={runtime}>
        <Chat />
      </AssistantRuntimeProvider>
    </ChatErrorBoundary>
  );
}
