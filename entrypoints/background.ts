import {
  createModelsFromConfigs,
  getModelConfigRuntimeKey,
  getModelRuntimeKey,
} from "@/components/chat/settings/models";
import { loadSettings } from "@/components/chat/settings/storage";
import type { StreamOptions, ThinkingLevel, Usage } from "@jeryfan/ai";
import type {
  ModelConfig,
  ModelThinkingLevel,
} from "@/components/chat/settings/types";

type StreamOptionsWithReasoning = StreamOptions & {
  reasoning?: ThinkingLevel;
};

const MODEL_THINKING_LEVELS = new Set<ModelThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

function isModelThinkingLevel(value: unknown): value is ModelThinkingLevel {
  return (
    typeof value === "string" &&
    MODEL_THINKING_LEVELS.has(value as ModelThinkingLevel)
  );
}

export default defineBackground(() => {
  // 禁用全局默认面板，避免未点击的标签页也显示
  browser.sidePanel.setOptions({ enabled: false }).catch(console.error);

  // 点击插件图标时，只为当前标签页启用并打开侧边栏
  browser.action.onClicked.addListener((tab) => {
    if (tab.id == null) return;
    const tabId = tab.id;

    // 先同步启用当前标签页的面板
    browser.sidePanel.setOptions({
      tabId,
      path: '/sidepanel.html',
      enabled: true,
    });

    // sidePanel.open() 必须在用户手势回调中同步调用；
    // 如果前面加了 await/setTimeout/回调，Chrome 会报 user gesture 错误。
    browser.sidePanel.open({ tabId }).catch(console.error);
  });

  // 在后台处理 AI 流式请求，绕过 side panel 的 CORS 限制
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'ai-stream') return;

    let abortController: AbortController | null = null;

    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'abort') {
        abortController?.abort();
        return;
      }

      if (msg.type !== 'start') return;

      abortController = new AbortController();
      const { model, messages, systemPrompt } = msg;

      try {
        const settings = await loadSettings();
        const models = createModelsFromConfigs(settings.models);

        const runtimeKey = getModelRuntimeKey(model);
        const config = settings.models.find(
          (m): m is ModelConfig =>
            getModelConfigRuntimeKey(m) === runtimeKey,
        );

        const streamOptions: StreamOptionsWithReasoning = {
          signal: abortController.signal,
        };
        const requestedThinkingLevel = isModelThinkingLevel(msg.reasoningEffort)
          ? msg.reasoningEffort
          : undefined;
        const thinkingLevel =
          requestedThinkingLevel ??
          config?.thinkingLevel ??
          (model.reasoning ? "medium" : "off");
        if (model.reasoning && thinkingLevel !== "off") {
          streamOptions.reasoning = thinkingLevel;
        }

        const eventStream = models.stream(
          model,
          { systemPrompt, messages },
          streamOptions,
        );

        let lastUsage: Usage | undefined;

        for await (const event of eventStream) {
          port.postMessage({ type: 'event', event });
          if (event.type === 'done') {
            lastUsage = event.message?.usage;
          }
        }

        port.postMessage({ type: 'done', usage: lastUsage });
      } catch (error: any) {
        port.postMessage({
          type: 'error',
          error: error?.message ?? String(error),
        });
      }
    });

    port.onDisconnect.addListener(() => {
      abortController?.abort();
    });
  });
});
