"use client";

import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
} from "@assistant-ui/react";
import type { Message } from "@jeryfan/ai";
import { AI_MODELS } from "./models";
import { Chat } from "./chat";
import { Component, type ReactNode } from "react";

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

// 通过 background service worker 流式请求 AI，绕过 side panel 的 CORS 限制
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

const aiAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal, context }) {
    const modelId = context.config?.modelName;
    const model = AI_MODELS.find((m) => m.id === modelId);

    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const systemPrompt = messages
      .filter(
        (m): m is Extract<ThreadMessage, { role: "system" }> =>
          m.role === "system",
      )
      .map(getMessageText)
      .join("\n");

    const aiMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => {
        const text = getMessageText(m);
        if (m.role === "assistant") {
          // AssistantMessage.content 必须是数组，不能是字符串
          return {
            role: "assistant" as const,
            content: [{ type: "text" as const, text }],
            timestamp: Date.now(),
          };
        }
        return {
          role: "user" as const,
          content: text,
          timestamp: Date.now(),
        };
      }) as Message[];

    const { port, next } = createBackgroundStream<
      | { type: "event"; event: any }
      | { type: "done" }
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
            case "done":
              return;
            case "error":
              throw new Error(event.error.errorMessage ?? "AI request failed");
          }
        }
      }
    } finally {
      abortSignal?.removeEventListener("abort", onAbort);
      port.disconnect();
    }
  },
};

export function ChatWithProvider() {
  const runtime = useLocalRuntime(aiAdapter);

  return (
    <ChatErrorBoundary>
      <AssistantRuntimeProvider runtime={runtime}>
        <Chat />
      </AssistantRuntimeProvider>
    </ChatErrorBoundary>
  );
}
