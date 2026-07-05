"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useComposerRuntime } from "@assistant-ui/react";
import {
  createMarkdownFile,
  createScreenshotFile,
  cropScreenshot,
  type ElementPickerMessage,
  type ElementSnapshot,
} from "@/lib/element-picker";

import type { CapturePart } from "@/components/chat/settings/types";

const DEFAULT_CAPTURE_PARTS: CapturePart[] = ["screenshot", "html", "tree"];

export function useElementSelection(
  mode: "continuous" | "single" = "continuous",
  captureParts: CapturePart[] = DEFAULT_CAPTURE_PARTS,
) {
  const runtime = useComposerRuntime();
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionTabIdRef = useRef<number | null>(null);
  const selectionPortRef = useRef<ReturnType<typeof browser.tabs.connect> | null>(null);

  const includeScreenshot = captureParts.includes("screenshot");
  const markdownOptions = useMemo(
    () => ({
      includeHtml: captureParts.includes("html"),
      includeTree: captureParts.includes("tree"),
    }),
    [captureParts],
  );

  const closeSelectionPort = useCallback(() => {
    const port = selectionPortRef.current;
    selectionPortRef.current = null;
    try {
      port?.disconnect();
    } catch {
      // The port may already be disconnected when the side panel is closing.
    }
  }, []);

  const stopSelectionInTab = useCallback((tabId: number | null) => {
    try {
      selectionPortRef.current?.postMessage({ type: "STOP_ELEMENT_SELECTION" });
    } catch {
      // The port may already be disconnected.
    }
    closeSelectionPort();

    if (tabId == null) return;
    browser.tabs
      .sendMessage(tabId, { type: "STOP_ELEMENT_SELECTION" })
      .catch(() => {
        // The target tab may have navigated or the content script may be gone.
      });
  }, [closeSelectionPort]);

  const getActiveTabWithContentScript = useCallback(async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return null;

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
        return null;
      }
    }

    return tab;
  }, []);

  const startSelection = useCallback(async () => {
    const tab = await getActiveTabWithContentScript();
    if (!tab?.id) return;

    closeSelectionPort();
    const port = browser.tabs.connect(tab.id, { name: "element-selection" });
    selectionPortRef.current = port;
    port.onDisconnect.addListener(() => {
      if (selectionPortRef.current === port) {
        selectionPortRef.current = null;
        selectionTabIdRef.current = null;
        setIsSelecting(false);
      }
    });

    selectionTabIdRef.current = tab.id;
    setIsSelecting(true);
    port.postMessage({ type: "START_ELEMENT_SELECTION" });
  }, [closeSelectionPort, getActiveTabWithContentScript]);

  const cancelSelection = useCallback(async () => {
    let tabId = selectionTabIdRef.current;

    if (tabId == null) {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      tabId = tab?.id ?? null;
    }

    stopSelectionInTab(tabId);
    selectionTabIdRef.current = null;
    setIsSelecting(false);
  }, [stopSelectionInTab]);

  const capturePage = useCallback(async () => {
    try {
      stopSelectionInTab(selectionTabIdRef.current);
      selectionTabIdRef.current = null;
      setIsSelecting(false);

      const tab = await getActiveTabWithContentScript();
      if (!tab?.id || tab.windowId == null) return;

      const data = (await browser.tabs.sendMessage(tab.id, {
        type: "CAPTURE_PAGE_SNAPSHOT",
      })) as ElementSnapshot | undefined;
      if (!data) return;

      const mdFile = createMarkdownFile(data, markdownOptions);
      await runtime.addAttachment(mdFile);

      if (includeScreenshot) {
        const screenshotDataUrl = await browser.tabs.captureVisibleTab(
          tab.windowId,
          { format: "png" },
        );
        const screenshotFile = createScreenshotFile(screenshotDataUrl);
        await runtime.addAttachment(screenshotFile);
      }
    } catch (error) {
      console.error("[useElementSelection] page capture failed:", error);
    }
  }, [getActiveTabWithContentScript, includeScreenshot, markdownOptions, runtime, stopSelectionInTab]);

  const handleElementSelected = useCallback(
    async (data: ElementSnapshot) => {
      // 连续选择模式：保持 isSelecting 为 true，等待用户手动取消
      try {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.windowId) return;

        const mdFile = createMarkdownFile(data, markdownOptions);
        await runtime.addAttachment(mdFile);

        if (includeScreenshot) {
          const screenshotDataUrl = await browser.tabs.captureVisibleTab(
            tab.windowId,
            { format: "png" },
          );
          const screenshotFile =
            data.kind === "page" || data.kind === "viewport"
              ? createScreenshotFile(screenshotDataUrl)
              : createScreenshotFile(
                  await cropScreenshot(
                    screenshotDataUrl,
                    data.rect,
                    data.devicePixelRatio,
                  ),
                );
          await runtime.addAttachment(screenshotFile);
        }

        if (mode === "single") {
          setIsSelecting(false);
          selectionTabIdRef.current = null;
          stopSelectionInTab(tab.id ?? null);
        }
      } catch (error) {
        console.error("[useElementSelection] failed:", error);
      }
    },
    [includeScreenshot, markdownOptions, runtime, mode],
  );

  useEffect(() => {
    const listener = (message: ElementPickerMessage) => {
      if (message.type === "ELEMENT_SELECTED") {
        handleElementSelected(message.data);
      } else if (message.type === "ELEMENT_SELECTION_CANCELLED") {
        selectionTabIdRef.current = null;
        setIsSelecting(false);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, [handleElementSelected]);

  useEffect(() => {
    return () => {
      stopSelectionInTab(selectionTabIdRef.current);
      selectionTabIdRef.current = null;
    };
  }, [stopSelectionInTab]);

  useEffect(() => {
    if (!isSelecting) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      cancelSelection();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isSelecting, cancelSelection]);

  return {
    isSelecting,
    startSelection,
    cancelSelection,
    capturePage,
  };
}
