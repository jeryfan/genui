import { filterComputedStylesByDefault } from '@/lib/element-picker';
import type {
  ElementRect,
  ElementTreeNode,
  PseudoElementSnapshot,
} from '@/lib/element-picker';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // 避免重复注入导致事件监听重复注册
    if ((window as any).__genuiElementPickerReady) return;
    (window as any).__genuiElementPickerReady = true;

    let isSelecting = false;
    let isViewportSelection = false;
    let overlay: HTMLElement | null = null;
    let lastHoveredElement: Element | null = null;

    const defaultStyleCache = new Map<string, Record<string, string>>();

    function createOverlay() {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.id = 'genui-element-picker-overlay';
      overlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        border: 2px solid #3b82f6;
        background-color: rgba(59, 130, 246, 0.15);
        border-radius: 4px;
        display: none;
        transition: all 0.05s ease;
      `;
      document.body.appendChild(overlay);
    }

    function removeOverlay() {
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
    }

    function updateOverlay(element: Element) {
      if (!overlay) return;
      const rect = element.getBoundingClientRect();
      overlay.style.display = 'block';
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.borderRadius = '4px';
    }

    function updateViewportOverlay() {
      if (!overlay) return;
      overlay.style.display = 'block';
      overlay.style.left = '0px';
      overlay.style.top = '0px';
      overlay.style.width = `${window.innerWidth}px`;
      overlay.style.height = `${window.innerHeight}px`;
      overlay.style.borderRadius = '0px';
    }

    function restoreOverlayForSelection() {
      if (!overlay || !isSelecting) return;
      if (isViewportSelection) {
        updateViewportOverlay();
      } else if (lastHoveredElement) {
        updateOverlay(lastHoveredElement);
      }
    }

    function hideOverlayForCapture() {
      if (!overlay) return;
      overlay.style.display = 'none';
    }

    function waitForPaint() {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    }

    function getSelectorPath(element: Element): string {
      const path: string[] = [];
      let current: Element | null = element;

      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector += `#${current.id}`;
          path.unshift(selector);
          break;
        }
        const classes = Array.from(current.classList)
          .filter((c) => !c.startsWith('aui-'))
          .slice(0, 2);
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
        path.unshift(selector);
        current = current.parentElement;
      }

      return path.join(' > ');
    }

    function rectToSnapshot(rect: DOMRect): ElementRect {
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
      };
    }

    function getOrCreateStyleSandbox(): HTMLElement {
      let sandbox = document.getElementById('genui-style-sandbox');
      if (sandbox) return sandbox;

      sandbox = document.createElement('div');
      sandbox.id = 'genui-style-sandbox';
      sandbox.style.cssText = `
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 100px !important;
        height: 100px !important;
        visibility: hidden !important;
        pointer-events: none !important;
        z-index: -2147483647 !important;
      `;
      (document.body ?? document.documentElement).appendChild(sandbox);
      return sandbox;
    }

    function getDefaultStyleMap(
      tagName: string,
      pseudoElement?: string,
    ): Record<string, string> {
      const key = pseudoElement
        ? `${tagName.toLowerCase()}::${pseudoElement}`
        : tagName.toLowerCase();
      if (defaultStyleCache.has(key)) return defaultStyleCache.get(key)!;

      const sandbox = getOrCreateStyleSandbox();
      const element = document.createElement(tagName);
      sandbox.appendChild(element);

      const style = window.getComputedStyle(element, pseudoElement);
      const defaults: Record<string, string> = {};
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        const value = style.getPropertyValue(prop);
        if (value) defaults[prop] = value;
      }

      sandbox.removeChild(element);
      defaultStyleCache.set(key, defaults);
      return defaults;
    }

    function getStyleMap(
      style: CSSStyleDeclaration,
      tagName: string,
      pseudoElement?: string,
    ): Record<string, string> {
      const styles: Record<string, string> = {};

      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        const value = style.getPropertyValue(prop);
        if (value) styles[prop] = value;
      }

      const defaults = getDefaultStyleMap(tagName, pseudoElement);
      return filterComputedStylesByDefault(styles, defaults);
    }

    function getRelevantAttributes(element: Element): Record<string, string> {
      const attributes: Record<string, string> = {};
      const allowed = new Set([
        'id',
        'class',
        'role',
        'href',
        'src',
        'alt',
        'title',
        'type',
        'value',
        'placeholder',
        'name',
        'target',
        'rel',
      ]);

      for (const attr of Array.from(element.attributes)) {
        if (
          allowed.has(attr.name) ||
          attr.name.startsWith('aria-') ||
          attr.name.startsWith('data-')
        ) {
          attributes[attr.name] = attr.value;
        }
      }

      return attributes;
    }

    function getDirectText(element: Element): string {
      return Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .slice(0, 500);
    }

    function isHidden(style: CSSStyleDeclaration): boolean {
      return (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0'
      );
    }

    function resolveUrl(url: string): string {
      if (!url) return url;
      const trimmed = url.trim();
      if (
        trimmed.startsWith('data:') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('#')
      ) {
        return trimmed;
      }
      try {
        return new URL(trimmed, document.baseURI).href;
      } catch {
        return trimmed;
      }
    }

    function resolveHtmlUrls(html: string): string {
      return html
        .replace(
          /\b(src|href|poster|data-src|data-original)=(["'])([^"']*)\2/gi,
          (match, attr, quote, value) => {
            return `${attr}=${quote}${resolveUrl(value)}${quote}`;
          },
        )
        .replace(
          /\bsrcset=(["'])([^"']*)\1/gi,
          (match, quote, value) => {
            const parts = value.split(',').map((part: string) => {
              const trimmed = part.trim();
              const spaceIdx = trimmed.search(/\s+/);
              if (spaceIdx === -1) return resolveUrl(trimmed);
              const url = trimmed.slice(0, spaceIdx);
              const descriptor = trimmed.slice(spaceIdx + 1);
              return `${resolveUrl(url)} ${descriptor}`;
            });
            return `srcset=${quote}${parts.join(', ')}${quote}`;
          },
        )
        .replace(
          /style=(["'])([^"']*)\1/gi,
          (match, quote, value) => {
            const resolved = value.replace(
              /url\((['"]?)([^'"\)]+)\1\)/gi,
              (_: string, q: string, url: string) => {
                return `url(${q}${resolveUrl(url)}${q})`;
              },
            );
            return `style=${quote}${resolved}${quote}`;
          },
        );
    }

    function resolveBackgroundImageUrls(value: string): string {
      return value.replace(
        /url\((['"]?)([^'"\)]+)\1\)/gi,
        (match, quote, url) => {
          return `url(${quote}${resolveUrl(url)}${quote})`;
        },
      );
    }

    function extractPseudoElement(
      element: Element,
      pseudoElement: '::before' | '::after',
    ): PseudoElementSnapshot | undefined {
      const style = window.getComputedStyle(element, pseudoElement);
      const content = style.getPropertyValue('content');

      if (
        isHidden(style) ||
        ((!content || content === 'none') &&
          style.getPropertyValue('background-image') === 'none' &&
          style.getPropertyValue('background-color') === 'rgba(0, 0, 0, 0)')
      ) {
        return undefined;
      }

      const styles = getStyleMap(style, element.tagName, pseudoElement);
      return {
        content: content && content !== 'none' ? content : undefined,
        styles: applyStyleUrlResolution(styles),
      };
    }

    function applyStyleUrlResolution(
      styles: Record<string, string>,
    ): Record<string, string> {
      const resolved: Record<string, string> = {};
      for (const [prop, value] of Object.entries(styles)) {
        resolved[prop] = prop === 'background-image' || prop === 'mask-image'
          ? resolveBackgroundImageUrls(value)
          : value;
      }
      return resolved;
    }

    function intersectsViewport(rect: DOMRect): boolean {
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right >= 0 &&
        rect.bottom >= 0 &&
        rect.left <= window.innerWidth &&
        rect.top <= window.innerHeight
      );
    }

    function extractElementTree(
      element: Element,
      options: { viewportOnly?: boolean; isRoot?: boolean } = {},
    ): ElementTreeNode | undefined {
      const computedStyle = window.getComputedStyle(element);
      if (isHidden(computedStyle)) return undefined;

      const rect = element.getBoundingClientRect();
      const children = Array.from(element.children)
        .map((child) =>
          extractElementTree(child, {
            viewportOnly: options.viewportOnly,
          }),
        )
        .filter((child): child is ElementTreeNode => child != null);

      if (
        options.viewportOnly &&
        !options.isRoot &&
        !intersectsViewport(rect) &&
        children.length === 0
      ) {
        return undefined;
      }

      const before = extractPseudoElement(element, '::before');
      const after = extractPseudoElement(element, '::after');
      const pseudo = before || after ? { before, after } : undefined;

      return {
        tagName: element.tagName.toLowerCase(),
        selector: getSelectorPath(element),
        rect: rectToSnapshot(rect),
        attributes: getRelevantAttributes(element),
        text: getDirectText(element),
        styles: applyStyleUrlResolution(getStyleMap(computedStyle, element.tagName)),
        pseudo,
        children,
      };
    }

    function extractElementData(element: Element) {
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);

      return {
        kind: 'element' as const,
        selector: getSelectorPath(element),
        rect: rectToSnapshot(rect),
        devicePixelRatio: window.devicePixelRatio,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        },
        styles: applyStyleUrlResolution(getStyleMap(computedStyle, element.tagName)),
        html: resolveHtmlUrls(element.outerHTML),
        tree: extractElementTree(element),
      };
    }

    function getDocumentRect(): ElementRect {
      const root = document.documentElement;
      const body = document.body;

      return {
        x: 0,
        y: 0,
        width: Math.max(
          root.scrollWidth,
          root.clientWidth,
          body?.scrollWidth ?? 0,
          body?.clientWidth ?? 0,
        ),
        height: Math.max(
          root.scrollHeight,
          root.clientHeight,
          body?.scrollHeight ?? 0,
          body?.clientHeight ?? 0,
        ),
        top: 0,
        left: 0,
      };
    }

    function extractViewportData() {
      const root = document.body ?? document.documentElement;
      const computedStyle = window.getComputedStyle(root);
      const viewportRect = {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        top: 0,
        left: 0,
      };

      return {
        kind: 'viewport' as const,
        selector: 'viewport',
        rect: viewportRect,
        devicePixelRatio: window.devicePixelRatio,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        },
        styles: applyStyleUrlResolution(getStyleMap(computedStyle, root.tagName)),
        html: resolveHtmlUrls(root.outerHTML),
        tree: extractElementTree(root, {
          viewportOnly: true,
          isRoot: true,
        }),
      };
    }

    function extractPageData() {
      const root = document.body ?? document.documentElement;
      const computedStyle = window.getComputedStyle(root);

      return {
        kind: 'page' as const,
        selector: 'document.body',
        rect: getDocumentRect(),
        devicePixelRatio: window.devicePixelRatio,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        },
        styles: applyStyleUrlResolution(getStyleMap(computedStyle, root.tagName)),
        html: resolveHtmlUrls(root.outerHTML),
        tree: extractElementTree(root),
      };
    }

    function handleMouseMove(e: MouseEvent) {
      if (!isSelecting) return;
      isViewportSelection = e.shiftKey;

      if (isViewportSelection) {
        updateViewportOverlay();
        return;
      }

      console.log('[genui] mousemove, isSelecting:', isSelecting);
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || target === overlay || overlay?.contains(target)) {
        console.log(
          '[genui] mousemove ignored target:',
          target,
          'overlay:',
          overlay,
        );
        return;
      }
      lastHoveredElement = target;
      updateOverlay(target);
    }

    async function handleClick(e: MouseEvent) {
      if (!isSelecting) return;
      e.preventDefault();
      e.stopPropagation();

      const selectingViewport = e.shiftKey || isViewportSelection;
      const target = selectingViewport
        ? null
        : document.elementFromPoint(e.clientX, e.clientY);
      if (!selectingViewport && !target) return;

      hideOverlayForCapture();
      await waitForPaint();

      if (selectingViewport) {
        console.log('[genui] viewport selected');
        browser.runtime.sendMessage({
          type: 'ELEMENT_SELECTED',
          data: extractPageData(),
        });
        return;
      }

      console.log('[genui] element selected:', target!.tagName);
      const data = extractElementData(target!);
      browser.runtime.sendMessage({ type: 'ELEMENT_SELECTED', data });
      // 连续选择模式：保持选择状态，不隐藏遮罩
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        stopSelection();
        browser.runtime.sendMessage({ type: 'ELEMENT_SELECTION_CANCELLED' });
        return;
      }

      if (e.key === 'Shift' && isSelecting) {
        isViewportSelection = true;
        updateViewportOverlay();
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key !== 'Shift') return;
      isViewportSelection = false;
      if (lastHoveredElement) {
        updateOverlay(lastHoveredElement);
      }
    }

    function startSelection() {
      if (isSelecting) return;
      isSelecting = true;
      createOverlay();
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('keyup', handleKeyUp, true);
      document.body.style.cursor = 'crosshair';
    }

    function stopSelection() {
      isSelecting = false;
      isViewportSelection = false;
      lastHoveredElement = null;
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      document.body.style.cursor = '';
      removeOverlay();
    }

    browser.runtime.onMessage.addListener((message: { type: string }) => {
      if (message.type === 'PING') {
        return;
      }
      if (message.type === 'CAPTURE_VIEWPORT_SNAPSHOT') {
        return extractViewportData();
      }
      if (message.type === 'CAPTURE_PAGE_SNAPSHOT') {
        return extractPageData();
      }
      if (message.type === 'RESTORE_ELEMENT_SELECTION_OVERLAY') {
        restoreOverlayForSelection();
        return;
      }
      if (message.type === 'START_ELEMENT_SELECTION') {
        startSelection();
      } else if (message.type === 'STOP_ELEMENT_SELECTION') {
        stopSelection();
      }
    });

    browser.runtime.onConnect.addListener((port) => {
      if (port.name !== 'element-selection') return;

      port.onMessage.addListener((message: { type: string }) => {
        if (message.type === 'START_ELEMENT_SELECTION') {
          startSelection();
        } else if (message.type === 'STOP_ELEMENT_SELECTION') {
          stopSelection();
        } else if (message.type === 'RESTORE_ELEMENT_SELECTION_OVERLAY') {
          restoreOverlayForSelection();
        }
      });

      port.onDisconnect.addListener(() => {
        stopSelection();
      });
    });

    console.log('[genui] content script ready');
  },
});
