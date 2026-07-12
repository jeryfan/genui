"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useComposerRuntime } from "@assistant-ui/react";
import {
  createHiddenInteractionsMarkdownFile,
  createMarkdownFile,
  createScreenshotFile,
  cropScreenshot,
  type ElementPickerMessage,
  type ElementSnapshot,
  type HiddenInteractionTriggerCandidate,
} from "@/lib/element-picker";

import {
  DEFAULT_GENERAL_SETTINGS,
  type CapturePart,
  type GeneralSettings,
} from "@/components/chat/settings/types";

const DEFAULT_CAPTURE_PARTS: CapturePart[] = DEFAULT_GENERAL_SETTINGS.captureParts;

export function useElementSelection(
  mode: "continuous" | "single" = "continuous",
  captureParts: CapturePart[] = DEFAULT_CAPTURE_PARTS,
  hiddenCapture: GeneralSettings["hiddenCapture"] = DEFAULT_GENERAL_SETTINGS.hiddenCapture,
  captureDetail: GeneralSettings["captureDetail"] = DEFAULT_GENERAL_SETTINGS.captureDetail,
) {
  const runtime = useComposerRuntime();
  const [isSelecting, setIsSelecting] = useState(false);
  const [hiddenTriggerDialog, setHiddenTriggerDialog] = useState<{
    tabId: number;
    selector: string;
    candidates: HiddenInteractionTriggerCandidate[];
    loading: boolean;
    picking: boolean;
  } | null>(null);
  const selectionTabIdRef = useRef<number | null>(null);
  const hiddenCaptureTabIdRef = useRef<number | null>(null);
  const pendingHiddenFinishRef = useRef<(() => void) | null>(null);
  const selectionPortRef = useRef<ReturnType<typeof browser.tabs.connect> | null>(null);

  const includeScreenshot = captureParts.includes("screenshot");
  const includeHidden = captureParts.includes("hidden");
  const markdownOptions = useMemo(
    () => ({
      includeHtml: captureParts.includes("html"),
      includeTree: captureParts.includes("tree"),
      detail: captureDetail,
    }),
    [captureParts, captureDetail],
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

  const restoreSelectionOverlayInTab = useCallback((tabId: number | null) => {
    if (tabId == null) return;
    browser.tabs
      .sendMessage(tabId, { type: "RESTORE_ELEMENT_SELECTION_OVERLAY" })
      .catch(() => {
        // The target tab may have navigated or the content script may be gone.
      });
  }, []);

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
    port.postMessage({
      type: "START_ELEMENT_SELECTION",
      tabId: tab.id,
      includeHidden,
      hiddenCapture,
    });
  }, [closeSelectionPort, getActiveTabWithContentScript, includeHidden, hiddenCapture]);

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
      // 连续选择模式：截图完成后恢复遮罩，等待用户手动取消
      let tabId: number | null = null;
      let didFinishSelection = false;

      const finishSelection = () => {
        if (didFinishSelection) return;
        didFinishSelection = true;

        if (mode === "single") {
          setIsSelecting(false);
          selectionTabIdRef.current = null;
          stopSelectionInTab(tabId);
        } else {
          restoreSelectionOverlayInTab(tabId);
        }
      };

      try {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        tabId = tab?.id ?? null;
        if (!tab?.windowId) return;

        let screenshotFile: File | null = null;
        if (includeScreenshot) {
          const screenshotDataUrl = await browser.tabs.captureVisibleTab(
            tab.windowId,
            { format: "png" },
          );
          screenshotFile =
            data.kind === "page" || data.kind === "viewport"
              ? createScreenshotFile(screenshotDataUrl)
              : createScreenshotFile(
                  await cropScreenshot(
                    screenshotDataUrl,
                    data.rect,
                    data.devicePixelRatio,
                  ),
                );
        }

        const shouldCaptureHiddenInteractions = Boolean(
          data.hasPendingHiddenInteractions,
        );

        const mdFile = createMarkdownFile(data, markdownOptions);
        await runtime.addAttachment(mdFile);

        if (screenshotFile) {
          await runtime.addAttachment(screenshotFile);
        }

        if (shouldCaptureHiddenInteractions && tabId != null) {
          const candidates = data.hiddenInteractionCandidates;
          browser.tabs
            .sendMessage(tabId, { type: "STOP_ELEMENT_SELECTION_CHROME" })
            .catch(() => {
              // The target tab may have navigated; keep the confirmation dialog usable.
            });
          hiddenCaptureTabIdRef.current = tabId;
          pendingHiddenFinishRef.current = finishSelection;
          setHiddenTriggerDialog({
            tabId,
            selector: data.selector,
            candidates: candidates ?? [],
            loading: false,
            picking: false,
          });
          return;
        }

        finishSelection();
      } catch (error) {
        console.error("[useElementSelection] failed:", error);
        finishSelection();
      }
    },
    [includeScreenshot, markdownOptions, runtime, mode, restoreSelectionOverlayInTab, stopSelectionInTab, hiddenCapture],
  );

  const locateHiddenTrigger = useCallback((candidate: HiddenInteractionTriggerCandidate) => {
    const tabId = hiddenTriggerDialog?.tabId;
    if (tabId == null) return;
    browser.tabs
      .sendMessage(tabId, {
        type: "LOCATE_HIDDEN_INTERACTION_TRIGGER",
        selector: candidate.selector,
      })
      .catch(() => {
        // The target tab may have navigated or the content script may be gone.
      });
  }, [hiddenTriggerDialog?.tabId]);

  const removeHiddenTrigger = useCallback((candidate: HiddenInteractionTriggerCandidate) => {
    setHiddenTriggerDialog((dialog) => {
      if (!dialog) return dialog;
      return {
        ...dialog,
        candidates: dialog.candidates.filter((item) => item.id !== candidate.id),
      };
    });
  }, []);

  const addHiddenTrigger = useCallback(() => {
    const tabId = hiddenTriggerDialog?.tabId;
    if (tabId == null) return;
    setHiddenTriggerDialog((dialog) => dialog ? { ...dialog, picking: true } : dialog);
    browser.tabs
      .sendMessage(tabId, {
        type: "START_HIDDEN_INTERACTION_TRIGGER_PICK",
        tabId,
      })
      .catch(() => {
        // The target tab may have navigated or the content script may be gone.
      });
  }, [hiddenTriggerDialog?.tabId]);

  const clearHiddenTriggers = useCallback(() => {
    setHiddenTriggerDialog((dialog) => {
      if (!dialog) return dialog;
      return {
        ...dialog,
        candidates: [],
      };
    });
  }, []);

  const stopHiddenTriggerPick = useCallback((tabId: number | null | undefined) => {
    if (tabId == null) return;
    browser.tabs
      .sendMessage(tabId, { type: "STOP_HIDDEN_INTERACTION_TRIGGER_PICK" })
      .catch(() => {
        // The target tab may have navigated or the content script may be gone.
      });
  }, []);

  const cancelHiddenTriggerCapture = useCallback(() => {
    stopHiddenTriggerPick(hiddenTriggerDialog?.tabId);
    pendingHiddenFinishRef.current?.();
    pendingHiddenFinishRef.current = null;
    hiddenCaptureTabIdRef.current = null;
    setHiddenTriggerDialog(null);
    selectionTabIdRef.current = null;
    setIsSelecting(false);
  }, [hiddenTriggerDialog?.tabId, stopHiddenTriggerPick]);

  const submitHiddenTriggerCapture = useCallback(() => {
    const dialog = hiddenTriggerDialog;
    if (!dialog) return;

    const tabId = dialog.tabId;
    stopHiddenTriggerPick(tabId);
    setHiddenTriggerDialog({ ...dialog, loading: true, picking: false });
    browser.tabs
      .sendMessage(tabId, {
        type: "CAPTURE_HIDDEN_INTERACTIONS",
        tabId,
        hiddenCapture,
        candidates: dialog.candidates,
      })
      .catch(() => {
        pendingHiddenFinishRef.current?.();
        pendingHiddenFinishRef.current = null;
        hiddenCaptureTabIdRef.current = null;
        setHiddenTriggerDialog(null);
        selectionTabIdRef.current = null;
        setIsSelecting(false);
      });
  }, [hiddenTriggerDialog, hiddenCapture, stopHiddenTriggerPick]);

  const handleHiddenInteractionsSelected = useCallback(
    async (selector: string, message: Extract<ElementPickerMessage, { type: "ELEMENT_HIDDEN_INTERACTIONS_SELECTED" }>) => {
      try {
        if (message.data.length > 0) {
          await runtime.addAttachment(
            createHiddenInteractionsMarkdownFile(
              selector,
              message.data,
              captureDetail,
            ),
          );
        }
      } catch (error) {
        console.error("[useElementSelection] failed to add hidden interactions:", error);
      } finally {
        pendingHiddenFinishRef.current?.();
        pendingHiddenFinishRef.current = null;
        hiddenCaptureTabIdRef.current = null;
        setHiddenTriggerDialog(null);
      }
    },
    [runtime, captureDetail],
  );

  useEffect(() => {
    const listener = (message: ElementPickerMessage) => {
      if (
        message.type === "ELEMENT_SELECTED" &&
        message.tabId === selectionTabIdRef.current
      ) {
        handleElementSelected(message.data);
      } else if (
        message.type === "ELEMENT_HIDDEN_INTERACTIONS_SELECTED" &&
        message.tabId === hiddenCaptureTabIdRef.current
      ) {
        handleHiddenInteractionsSelected(message.selector, message);
      } else if (
        message.type === "ELEMENT_HIDDEN_INTERACTION_TRIGGER_PICKED" &&
        message.tabId === hiddenTriggerDialog?.tabId
      ) {
        setHiddenTriggerDialog((dialog) => {
          if (!dialog) return dialog;
          const exists = dialog.candidates.some((candidate) => candidate.id === message.candidate.id);
          if (exists) return dialog;
          return {
            ...dialog,
            candidates: [...dialog.candidates, message.candidate],
            picking: true,
          };
        });
      } else if (
        message.type === "ELEMENT_HIDDEN_INTERACTION_TRIGGER_PICK_STOPPED" &&
        message.tabId === hiddenTriggerDialog?.tabId
      ) {
        setHiddenTriggerDialog((dialog) => dialog ? { ...dialog, picking: false } : dialog);
      } else if (
        message.type === "ELEMENT_SELECTION_CANCELLED" &&
        message.tabId === selectionTabIdRef.current
      ) {
        selectionTabIdRef.current = null;
        setIsSelecting(false);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, [handleElementSelected, handleHiddenInteractionsSelected, hiddenTriggerDialog?.tabId]);

  useEffect(() => {
    return () => {
      stopSelectionInTab(selectionTabIdRef.current);
      selectionTabIdRef.current = null;
    };
  }, [stopSelectionInTab]);

  const pickHighlightedHiddenTrigger = useCallback(() => {
    const tabId = hiddenTriggerDialog?.tabId;
    if (tabId == null) return;
    browser.tabs
      .sendMessage(tabId, { type: "SELECT_HIGHLIGHTED_HIDDEN_INTERACTION_TRIGGER" })
      .catch(() => {
        // The target tab may have navigated or the content script may be gone.
      });
  }, [hiddenTriggerDialog?.tabId]);

  useEffect(() => {
    if (!hiddenTriggerDialog) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== "Escape") return;
      if (!hiddenTriggerDialog.picking) return;
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Enter") {
        pickHighlightedHiddenTrigger();
        return;
      }

      stopHiddenTriggerPick(hiddenTriggerDialog.tabId);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [hiddenTriggerDialog, pickHighlightedHiddenTrigger, stopHiddenTriggerPick]);

  useEffect(() => {
    if (!isSelecting || hiddenTriggerDialog) return;

    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelSelection();
        return;
      }

      if (event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();

      let tabId = selectionTabIdRef.current;
      if (tabId == null) {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        tabId = tab?.id ?? null;
      }
      if (tabId == null) return;

      try {
        await browser.tabs.sendMessage(tabId, {
          type: "SELECT_HIGHLIGHTED_ELEMENT",
          selectViewport: event.shiftKey,
          includeHidden,
          hiddenCapture,
        });
      } catch {
        // The target tab may have navigated or the content script may be gone.
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isSelecting, hiddenTriggerDialog, cancelSelection, includeHidden, hiddenCapture]);

  return {
    isSelecting,
    startSelection,
    cancelSelection,
    capturePage,
    hiddenTriggerDialog,
    locateHiddenTrigger,
    removeHiddenTrigger,
    addHiddenTrigger,
    clearHiddenTriggers,
    cancelHiddenTriggerCapture,
    submitHiddenTriggerCapture,
  };
}
