"use client";

import { useCallback, useEffect, useState } from "react";
import { useComposerRuntime } from "@assistant-ui/react";
import {
  createMarkdownFile,
  createScreenshotFile,
  cropScreenshot,
  type ElementPickerMessage,
  type ElementSnapshot,
} from "@/lib/element-picker";

export function useElementSelection(mode: "continuous" | "single" = "continuous") {
  const runtime = useComposerRuntime();
  const [isSelecting, setIsSelecting] = useState(false);

  const startSelection = useCallback(async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    // 确保内容脚本已注入（对于扩展加载前已打开的页面，manifest 注入可能不存在）
    try {
      await browser.tabs.sendMessage(tab.id, { type: "PING" });
    } catch {
      try {
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["/content-scripts/content.js"],
        });
      } catch (injectError) {
        console.error("[useElementSelection] inject failed:", injectError);
        return;
      }
    }

    setIsSelecting(true);
    browser.tabs.sendMessage(tab.id, { type: "START_ELEMENT_SELECTION" });
  }, []);

  const cancelSelection = useCallback(async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: "STOP_ELEMENT_SELECTION" });
    }
    setIsSelecting(false);
  }, []);

  const handleElementSelected = useCallback(
    async (data: ElementSnapshot) => {
      // 连续选择模式：保持 isSelecting 为 true，等待用户手动取消
      try {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.windowId) return;

        const screenshotDataUrl = await browser.tabs.captureVisibleTab(
          tab.windowId,
          { format: "png" },
        );
        const croppedDataUrl = await cropScreenshot(
          screenshotDataUrl,
          data.rect,
          data.devicePixelRatio,
        );

        const mdFile = createMarkdownFile(data);
        const screenshotFile = createScreenshotFile(croppedDataUrl);

        await runtime.addAttachment(mdFile);
        await runtime.addAttachment(screenshotFile);

        if (mode === "single") {
          setIsSelecting(false);
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, { type: "STOP_ELEMENT_SELECTION" });
          }
        }
      } catch (error) {
        console.error("[useElementSelection] failed:", error);
      }
    },
    [runtime, mode],
  );

  useEffect(() => {
    const listener = (message: ElementPickerMessage) => {
      if (message.type === "ELEMENT_SELECTED") {
        handleElementSelected(message.data);
      } else if (message.type === "ELEMENT_SELECTION_CANCELLED") {
        setIsSelecting(false);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, [handleElementSelected]);

  return {
    isSelecting,
    startSelection,
    cancelSelection,
  };
}
