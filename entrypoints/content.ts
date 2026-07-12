import { filterComputedStylesByDefault } from '@/lib/element-picker';
import type {
  ElementRect,
  ElementTreeNode,
  HiddenInteractionAction,
  HiddenInteractionSnapshot,
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
    let selectionTabId: number | null = null;
    let includeHiddenElements = false;
    let isCapturingSelection = false;
    let pendingHiddenInteractionElement: Element | null = null;
    let pendingHiddenInteractionSelector = '';
    let hiddenCaptureOptions = {
      revealTimeoutMs: 600,
      triggerIntervalMs: 100,
      actionStrategy: 'first-match' as 'first-match' | 'all',
      recursive: false,
      maxDepth: 1,
      hoverRevealTriggers: true,
    };

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

    function getSelectableElement(element: Element): Element {
      return element.closest(
        'button, a[href], select, summary, [role="button"], [aria-haspopup], [aria-expanded], [aria-controls], [data-state]',
      ) ?? element;
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

    async function waitForInteraction() {
      await waitForPaint();
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
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

    function isGenuiElement(element: Element): boolean {
      return element.id.startsWith('genui-') || Boolean(element.closest('[id^="genui-"]'));
    }

    function isVisibleElement(element: Element): boolean {
      if (isGenuiElement(element)) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return !isHidden(style) && rect.width > 0 && rect.height > 0;
    }

    function getTriggerText(element: Element): string {
      return (element.textContent ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 200);
    }

    function isDangerousTrigger(element: Element): boolean {
      const text = `${element.textContent ?? ''} ${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''}`.toLowerCase();
      const type = element.getAttribute('type')?.toLowerCase();

      return (
        type === 'submit' ||
        text.includes('delete') ||
        text.includes('remove') ||
        text.includes('logout') ||
        text.includes('sign out') ||
        text.includes('删除') ||
        text.includes('移除') ||
        text.includes('退出') ||
        element.hasAttribute('data-danger')
      );
    }

    function isRecursiveTrigger(element: Element): boolean {
      if (element instanceof HTMLSelectElement) return true;
      if (element.tagName.toLowerCase() === 'summary') return true;
      if (element.hasAttribute('aria-haspopup')) return true;
      if (element.hasAttribute('aria-controls')) return true;
      if (element.hasAttribute('aria-expanded')) return true;
      if (element.getAttribute('data-state') === 'closed') return true;

      const role = element.getAttribute('role');
      return (role === 'menuitem' || role === 'option') && element.hasAttribute('aria-haspopup');
    }

    function findInteractionTriggers(root: Element, depth = 0): Element[] {
      const selectors = [
        'button',
        'a[href]',
        'select',
        'summary',
        '[role="button"]',
        '[role="menuitem"]',
        '[role="option"]',
        '[aria-haspopup]',
        '[aria-expanded]',
        '[aria-controls]',
        '[data-state]',
        '[tabindex]:not([tabindex="-1"])',
      ];
      const triggers = new Set<Element>();

      if (root.matches(selectors.join(','))) {
        triggers.add(root);
      }

      for (const element of Array.from(root.querySelectorAll(selectors.join(',')))) {
        triggers.add(element);
      }

      return Array.from(triggers)
        .filter((element) => {
          if (!isVisibleElement(element) || isDangerousTrigger(element)) return false;
          return depth === 0 || isRecursiveTrigger(element);
        })
        .slice(0, depth === 0 ? 20 : 10);
    }

    function getZIndex(style: CSSStyleDeclaration): number {
      const parsed = Number.parseInt(style.zIndex, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function getOverlayMatchReason(
      element: Element,
      trigger?: Element,
    ): string | null {
      if (!isVisibleElement(element)) return null;

      const role = element.getAttribute('role');
      const style = window.getComputedStyle(element);
      const position = style.position;
      const controlledId = trigger?.getAttribute('aria-controls');
      const overlayRoles = new Set([
        'alertdialog',
        'dialog',
        'listbox',
        'menu',
        'tooltip',
        'tree',
      ]);

      if (controlledId && element.id === controlledId) return 'aria-controls';
      if (role != null && overlayRoles.has(role)) return `role=${role}`;
      if (element.getAttribute('aria-modal') === 'true') return 'aria-modal=true';
      if (element.hasAttribute('popover')) return 'popover attribute';
      if (element.hasAttribute('data-radix-popper-content-wrapper')) {
        return 'data-radix-popper-content-wrapper';
      }
      if (element.hasAttribute('data-side') && element.hasAttribute('data-align')) {
        return 'floating-ui data-side/data-align';
      }
      if (element.getAttribute('data-state') === 'open') return 'data-state=open';
      if (element.getAttribute('data-slot')?.toLowerCase().includes('popover')) {
        return 'data-slot contains popover';
      }
      if (element.hasAttribute('cmdk-root')) return 'cmdk-root';
      if ((position === 'fixed' || position === 'absolute') && getZIndex(style) >= 10) {
        return `position=${position}; z-index=${style.zIndex}`;
      }

      return null;
    }

    function isPotentialOverlay(element: Element): boolean {
      return getOverlayMatchReason(element) != null;
    }

    function getVisibleOverlayCandidates(): Element[] {
      const root = document.body ?? document.documentElement;
      return Array.from(root.querySelectorAll('*')).filter(isPotentialOverlay);
    }

    function getVisibleOverlaySet(): WeakSet<Element> {
      return new WeakSet(getVisibleOverlayCandidates());
    }

    function dispatchPointerMouseEventAt(element: Element, type: string, x: number, y: number) {
      const eventInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 0,
        buttons: type === 'pointerup' || type === 'mouseup' || type === 'click' ? 0 : 1,
        clientX: x,
        clientY: y,
      };
      const event =
        typeof PointerEvent !== 'undefined' && type.startsWith('pointer')
          ? new PointerEvent(type, {
              ...eventInit,
              pointerType: 'mouse',
              isPrimary: true,
            })
          : new MouseEvent(type.replace('pointer', 'mouse'), eventInit);

      element.dispatchEvent(event);
      event.preventDefault();
    }

    function dispatchPointerMouseEvent(element: Element, type: string) {
      const rect = element.getBoundingClientRect();
      dispatchPointerMouseEventAt(
        element,
        type,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
    }

    async function performInteraction(
      trigger: Element,
      action: HiddenInteractionAction,
    ) {
      if (action === 'click') {
        dispatchPointerMouseEvent(trigger, 'pointerdown');
        dispatchPointerMouseEvent(trigger, 'mousedown');
        dispatchPointerMouseEvent(trigger, 'pointerup');
        dispatchPointerMouseEvent(trigger, 'mouseup');
        dispatchPointerMouseEvent(trigger, 'click');
      } else if (action === 'hover') {
        dispatchPointerMouseEvent(trigger, 'pointerover');
        dispatchPointerMouseEvent(trigger, 'mouseover');
        dispatchPointerMouseEvent(trigger, 'mouseenter');
        dispatchPointerMouseEvent(trigger, 'mousemove');
      } else if (trigger instanceof HTMLElement) {
        trigger.focus();
        trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
      }

      await waitForInteraction();
    }

    type RevealedElementMatch = {
      element: Element;
      matchedBy: string;
      waitTimeMs: number;
    };

    function findRevealedElements(
      before: WeakSet<Element>,
      trigger: Element,
      waitTimeMs: number,
    ): RevealedElementMatch[] {
      return getVisibleOverlayCandidates()
        .flatMap((element): RevealedElementMatch[] => {
          if (before.has(element)) return [];
          if (element === trigger || trigger.contains(element)) return [];
          const matchedBy = getOverlayMatchReason(element, trigger);
          return matchedBy ? [{ element, matchedBy, waitTimeMs }] : [];
        })
        .slice(0, 3);
    }

    function delay(ms: number) {
      return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    function getPollingDelays(timeoutMs: number): number[] {
      if (timeoutMs <= 0) return [0];
      const delays = [0, 50, 100, 150, 250, 400, 600].filter(
        (value) => value <= timeoutMs,
      );
      if (!delays.includes(timeoutMs)) delays.push(timeoutMs);
      return delays;
    }

    function getDelayDelta(delays: number[], index: number): number {
      if (index === 0) return delays[0];
      return Math.max(0, delays[index] - delays[index - 1]);
    }

    async function waitForRevealedElements(
      before: WeakSet<Element>,
      trigger: Element,
    ): Promise<RevealedElementMatch[]> {
      const delays = getPollingDelays(hiddenCaptureOptions.revealTimeoutMs);
      for (let index = 0; index < delays.length; index++) {
        const waitTimeMs = delays[index];
        const delta = getDelayDelta(delays, index);
        if (delta > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, delta));
        }
        await waitForPaint();

        const revealedElements = findRevealedElements(before, trigger, waitTimeMs);
        if (revealedElements.length > 0) return revealedElements;
      }

      return [];
    }

    function extractHiddenInteractionSnapshot(
      trigger: Element,
      action: HiddenInteractionAction,
      revealed: Element,
      match?: {
        matchedBy?: string;
        waitTimeMs?: number;
        depth?: number;
        parentTriggerSelector?: string;
      },
    ): HiddenInteractionSnapshot {
      const rect = revealed.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(revealed);

      return {
        triggerSelector: getSelectorPath(trigger),
        triggerText: getTriggerText(trigger),
        action,
        revealedSelector: getSelectorPath(revealed),
        revealedRole: revealed.getAttribute('role') ?? undefined,
        matchedBy: match?.matchedBy,
        waitTimeMs: match?.waitTimeMs,
        depth: match?.depth,
        parentTriggerSelector: match?.parentTriggerSelector,
        rect: rectToSnapshot(rect),
        html: resolveHtmlUrls(revealed.outerHTML),
        styles: applyStyleUrlResolution(getStyleMap(computedStyle, revealed.tagName)),
        tree: extractElementTree(revealed),
      };
    }

    function extractNativeSelectSnapshot(
      select: HTMLSelectElement,
    ): HiddenInteractionSnapshot {
      const rect = select.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(select);
      const selector = getSelectorPath(select);

      return {
        triggerSelector: selector,
        triggerText: getTriggerText(select),
        action: 'focus',
        revealedSelector: `${selector} option-list (native select options)`,
        revealedRole: 'listbox',
        rect: rectToSnapshot(rect),
        html: resolveHtmlUrls(select.outerHTML),
        styles: applyStyleUrlResolution(getStyleMap(computedStyle, select.tagName)),
        tree: extractElementTree(select),
      };
    }

    function isElementVisibleNow(element: Element): boolean {
      if (!element.isConnected) return false;
      return isVisibleElement(element);
    }

    async function waitForRevealedElementsToClose(elements: Element[]) {
      const delays = getPollingDelays(hiddenCaptureOptions.revealTimeoutMs);
      for (let index = 0; index < delays.length; index++) {
        const delta = getDelayDelta(delays, index);
        if (delta > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, delta));
        }
        await waitForPaint();
        if (elements.every((element) => !isElementVisibleNow(element))) return true;
      }
      return false;
    }

    function findOverlayBackdrop(elements: Element[]): Element | null {
      const candidates = Array.from(document.querySelectorAll('*')).filter((element) => {
        if (!isVisibleElement(element)) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const marker = [
          element.getAttribute('data-radix-dialog-overlay'),
          element.getAttribute('data-slot'),
          element.getAttribute('data-state'),
          element.getAttribute('class'),
        ]
          .join(' ')
          .toLowerCase();

        if (elements.some((revealed) => element === revealed || revealed.contains(element))) {
          return false;
        }

        return (
          marker.includes('dialog-overlay') ||
          marker.includes('drawer') ||
          marker.includes('sheet') ||
          (marker.includes('open') && style.position === 'fixed' && rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.8) ||
          (style.position === 'fixed' && getZIndex(style) >= 10 && rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.8)
        );
      });

      return candidates.at(-1) ?? null;
    }

    function getOutsidePoint(elements: Element[]): { x: number; y: number } {
      const points = [
        { x: Math.round(window.innerWidth / 2), y: 8 },
        { x: Math.round(window.innerWidth / 2), y: Math.max(8, window.innerHeight - 8) },
        { x: 8, y: Math.round(window.innerHeight / 2) },
        { x: Math.max(8, window.innerWidth - 8), y: Math.round(window.innerHeight / 2) },
      ];

      return points.find((point) => {
        return !elements.some((element) => {
          const rect = element.getBoundingClientRect();
          return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
        });
      }) ?? points[0];
    }

    function clickTopmostAt(x: number, y: number) {
      const target = document.elementFromPoint(x, y) ?? document.body ?? document.documentElement;
      dispatchPointerMouseEventAt(target, 'pointerdown', x, y);
      dispatchPointerMouseEventAt(target, 'mousedown', x, y);
      dispatchPointerMouseEventAt(target, 'pointerup', x, y);
      dispatchPointerMouseEventAt(target, 'mouseup', x, y);
      dispatchPointerMouseEventAt(target, 'click', x, y);
    }

    async function closeRevealedInteraction(trigger: Element, revealedElements: Element[] = []) {
      const keyboardTargets = [document, window, document.activeElement, ...revealedElements].filter(Boolean) as EventTarget[];
      for (const target of keyboardTargets) {
        target.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
          composed: true,
        }));
      }
      await waitForPaint();
      if (await waitForRevealedElementsToClose(revealedElements)) return;

      const backdrop = findOverlayBackdrop(revealedElements);
      if (backdrop) {
        dispatchPointerMouseEvent(backdrop, 'pointerdown');
        dispatchPointerMouseEvent(backdrop, 'mousedown');
        dispatchPointerMouseEvent(backdrop, 'pointerup');
        dispatchPointerMouseEvent(backdrop, 'mouseup');
        dispatchPointerMouseEvent(backdrop, 'click');
        await waitForPaint();
        if (await waitForRevealedElementsToClose(revealedElements)) return;
      }

      const point = getOutsidePoint(revealedElements);
      clickTopmostAt(point.x, point.y);
      await waitForPaint();
      if (await waitForRevealedElementsToClose(revealedElements)) return;

      if (trigger.getAttribute('aria-expanded') === 'true') {
        dispatchPointerMouseEvent(trigger, 'pointerdown');
        dispatchPointerMouseEvent(trigger, 'mousedown');
        dispatchPointerMouseEvent(trigger, 'pointerup');
        dispatchPointerMouseEvent(trigger, 'mouseup');
        dispatchPointerMouseEvent(trigger, 'click');
        await waitForPaint();
      }

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      await waitForPaint();
    }

    function getTriggerActionSignature(trigger: Element, action: HiddenInteractionAction): string {
      const rect = trigger.getBoundingClientRect();
      const text = getTriggerText(trigger);
      const childStructure = Array.from(trigger.children)
        .slice(0, 8)
        .map((child) => [
          child.tagName.toLowerCase(),
          child.getAttribute('role') ?? '',
          child.getAttribute('aria-hidden') ?? '',
          child.className,
        ].join(':'))
        .join('|');

      return [
        action,
        trigger.tagName.toLowerCase(),
        trigger.getAttribute('role') ?? '',
        trigger.getAttribute('aria-haspopup') ?? '',
        trigger.getAttribute('aria-expanded') != null ? 'aria-expanded' : '',
        trigger.getAttribute('data-state') ?? '',
        trigger.className,
        Math.round(rect.width),
        Math.round(rect.height),
        text,
        childStructure,
      ].join('||');
    }

    function getRevealedSignature(element: Element): string {
      const text = (element.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
      const structure = Array.from(
        element.querySelectorAll('button, [role], a, input, select'),
      )
        .slice(0, 20)
        .map((child) => {
          return [
            child.tagName.toLowerCase(),
            child.getAttribute('role') ?? '',
            (child.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
          ].join(':');
        })
        .join('|');
      const rect = element.getBoundingClientRect();

      return [
        element.tagName.toLowerCase(),
        element.getAttribute('role') ?? '',
        Math.round(rect.width),
        Math.round(rect.height),
        text,
        structure,
      ].join('||');
    }

    function getHiddenSnapshotKey(snapshot: HiddenInteractionSnapshot): string {
      const rect = snapshot.rect;
      return [
        snapshot.triggerSelector,
        snapshot.action,
        snapshot.revealedSelector,
        Math.round(rect.left),
        Math.round(rect.top),
        Math.round(rect.width),
        Math.round(rect.height),
      ].join('|');
    }

    function findHoverRevealContainers(root: Element): Element[] {
      const selectors = [
        ':scope',
        'li',
        'tr',
        '[role="listitem"]',
        '[role="row"]',
        '[data-state]',
        '.group',
      ];
      const containers = new Set<Element>([root]);

      for (const selector of selectors.slice(1)) {
        for (const element of Array.from(root.querySelectorAll(selector))) {
          containers.add(element);
        }
      }

      return Array.from(containers)
        .filter((element) => isVisibleElement(element) && !isDangerousTrigger(element))
        .slice(0, 20);
    }

    function getElementSet(elements: Element[]): WeakSet<Element> {
      return new WeakSet(elements);
    }

    function findHoverRevealedTriggers(container: Element, before: WeakSet<Element>): Element[] {
      return findInteractionTriggers(container, 0)
        .filter((trigger) => !before.has(trigger))
        .slice(0, 10);
    }

    function getTriggerActions(trigger: Element): HiddenInteractionAction[] {
      if (
        trigger.tagName.toLowerCase() === 'button' ||
        trigger.hasAttribute('aria-haspopup') ||
        trigger.hasAttribute('aria-expanded') ||
        trigger.hasAttribute('aria-controls')
      ) {
        return ['click'];
      }
      return ['click', 'hover', 'focus'];
    }

    async function exploreTriggers(
      triggers: Element[],
      depth: number,
      parentTriggerSelector: string | undefined,
      seen: Set<string>,
      seenRevealedSignatures: Set<string>,
      seenTriggerActionSignatures: Set<string>,
      rootForVisibility?: Element,
    ): Promise<HiddenInteractionSnapshot[]> {
      const snapshots: HiddenInteractionSnapshot[] = [];

      for (const trigger of triggers) {
        if (snapshots.length >= 30) break;
        if (depth > 0 && rootForVisibility && !isElementVisibleNow(rootForVisibility)) return snapshots;
        if (!isElementVisibleNow(trigger)) continue;

        if (trigger instanceof HTMLSelectElement) {
          snapshots.push(extractNativeSelectSnapshot(trigger));
          continue;
        }

        for (const action of getTriggerActions(trigger)) {
          if (snapshots.length >= 30) break;
          if (depth > 0 && rootForVisibility && !isElementVisibleNow(rootForVisibility)) return snapshots;
          if (!isElementVisibleNow(trigger)) break;

          const triggerActionSignature = getTriggerActionSignature(trigger, action);
          if (seenTriggerActionSignatures.has(triggerActionSignature)) continue;
          seenTriggerActionSignatures.add(triggerActionSignature);

          const before = getVisibleOverlaySet();
          await performInteraction(trigger, action);
          const revealedElements = await waitForRevealedElements(before, trigger);

          if (depth > 0 && rootForVisibility && revealedElements.length === 0 && !isElementVisibleNow(rootForVisibility)) {
            return snapshots;
          }

          for (const revealed of revealedElements) {
            const signature = getRevealedSignature(revealed.element);
            const snapshot = extractHiddenInteractionSnapshot(trigger, action, revealed.element, {
              matchedBy: revealed.matchedBy,
              waitTimeMs: revealed.waitTimeMs,
              depth,
              parentTriggerSelector,
            });
            const key = getHiddenSnapshotKey(snapshot);
            if (!seen.has(key) && !seenRevealedSignatures.has(signature)) {
              seen.add(key);
              seenRevealedSignatures.add(signature);
              snapshots.push(snapshot);
            }
            if (snapshots.length >= 30) break;

            if (hiddenCaptureOptions.recursive && depth < hiddenCaptureOptions.maxDepth) {
              if (hiddenCaptureOptions.triggerIntervalMs > 0) {
                await delay(hiddenCaptureOptions.triggerIntervalMs);
              }
              const nested = await exploreHiddenInteractions(
                revealed.element,
                depth + 1,
                getSelectorPath(trigger),
                seen,
                seenRevealedSignatures,
                seenTriggerActionSignatures,
              );
              snapshots.push(...nested.slice(0, Math.max(0, 30 - snapshots.length)));
            }
          }

          await closeRevealedInteraction(trigger, revealedElements.map((revealed) => revealed.element));

          if (hiddenCaptureOptions.triggerIntervalMs > 0) {
            await delay(hiddenCaptureOptions.triggerIntervalMs);
          }

          if (
            hiddenCaptureOptions.actionStrategy === 'first-match' &&
            revealedElements.length > 0
          ) {
            break;
          }
        }
      }

      return snapshots;
    }

    type ForcedHoverRevealStyle = {
      element: HTMLElement;
      opacity: string;
      pointerEvents: string;
      display: string;
      visibility: string;
    };

    function findForceHoverRevealCandidates(root: Element): HTMLElement[] {
      const selectors = [
        '[class*="group-hover:opacity-100"]',
        '[class*="group-hover:flex"]',
        '[class*="group-hover:block"]',
        '[class*="opacity-0"][aria-haspopup]',
        '[class*="opacity-0"][aria-controls]',
        '[class*="opacity-0"][data-state]',
      ];

      return Array.from(root.querySelectorAll(selectors.join(',')))
        .filter((element): element is HTMLElement => element instanceof HTMLElement)
        .filter((element) => !isDangerousTrigger(element));
    }

    function forceHoverRevealControls(root: Element): () => void {
      const originals: ForcedHoverRevealStyle[] = [];

      for (const element of findForceHoverRevealCandidates(root)) {
        originals.push({
          element,
          opacity: element.style.getPropertyValue('opacity'),
          pointerEvents: element.style.getPropertyValue('pointer-events'),
          display: element.style.getPropertyValue('display'),
          visibility: element.style.getPropertyValue('visibility'),
        });
        element.style.setProperty('opacity', '1', 'important');
        element.style.setProperty('pointer-events', 'auto', 'important');
        element.style.setProperty('display', element.style.display || 'flex', 'important');
        element.style.setProperty('visibility', 'visible', 'important');
      }

      return () => {
        for (const original of originals) {
          original.element.style.setProperty('opacity', original.opacity);
          original.element.style.setProperty('pointer-events', original.pointerEvents);
          original.element.style.setProperty('display', original.display);
          original.element.style.setProperty('visibility', original.visibility);
        }
      };
    }

    async function exploreHoverRevealedTriggers(
      root: Element,
      depth: number,
      parentTriggerSelector: string | undefined,
      seen: Set<string>,
      seenRevealedSignatures: Set<string>,
      seenTriggerActionSignatures: Set<string>,
    ): Promise<HiddenInteractionSnapshot[]> {
      if (!hiddenCaptureOptions.hoverRevealTriggers || depth > 0) return [];

      const snapshots: HiddenInteractionSnapshot[] = [];
      const restoreForcedHoverReveal = forceHoverRevealControls(root);
      try {
        await waitForPaint();
        const forcedTriggers = findInteractionTriggers(root, 0).filter((trigger) => {
          return trigger instanceof HTMLElement && findForceHoverRevealCandidates(root).includes(trigger);
        });
        snapshots.push(
          ...(await exploreTriggers(
            forcedTriggers,
            depth,
            parentTriggerSelector,
            seen,
            seenRevealedSignatures,
            seenTriggerActionSignatures,
            root,
          )).slice(0, Math.max(0, 30 - snapshots.length)),
        );

        for (const container of findHoverRevealContainers(root)) {
          if (snapshots.length >= 30) break;

          const beforeTriggers = getElementSet(findInteractionTriggers(container, 0));
          await performInteraction(container, 'hover');
          await delay(hiddenCaptureOptions.triggerIntervalMs);
          const revealedTriggers = findHoverRevealedTriggers(container, beforeTriggers);

          snapshots.push(
            ...(await exploreTriggers(
              revealedTriggers,
              depth,
              parentTriggerSelector,
              seen,
              seenRevealedSignatures,
              seenTriggerActionSignatures,
              root,
            )).slice(0, Math.max(0, 30 - snapshots.length)),
          );
        }
      } finally {
        restoreForcedHoverReveal();
      }

      return snapshots;
    }

    async function exploreHiddenInteractions(
      root: Element,
      depth = 0,
      parentTriggerSelector?: string,
      seen = new Set<string>(),
      seenRevealedSignatures = new Set<string>(),
      seenTriggerActionSignatures = new Set<string>(),
    ): Promise<HiddenInteractionSnapshot[]> {
      const triggers = findInteractionTriggers(root, depth);
      const snapshots = await exploreTriggers(
        triggers,
        depth,
        parentTriggerSelector,
        seen,
        seenRevealedSignatures,
        seenTriggerActionSignatures,
        root,
      );

      if (snapshots.length < 30) {
        snapshots.push(
          ...(await exploreHoverRevealedTriggers(
            root,
            depth,
            parentTriggerSelector,
            seen,
            seenRevealedSignatures,
            seenTriggerActionSignatures,
          )).slice(0, Math.max(0, 30 - snapshots.length)),
        );
      }

      return snapshots;
    }

    async function extractElementData(
      element: Element,
      options: { includeHidden?: boolean } = {},
    ) {
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      const data = {
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
        hasPendingHiddenInteractions: options.includeHidden || undefined,
      };

      return data;
    }

    async function extractHiddenInteractionData(
      element: Element,
    ): Promise<HiddenInteractionSnapshot[]> {
      try {
        return await exploreHiddenInteractions(element);
      } catch (error) {
        console.error('[genui] hidden interaction exploration failed:', error);
        return [];
      }
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
      lastHoveredElement = getSelectableElement(target);
      updateOverlay(lastHoveredElement);
    }

    async function selectElement(
      target: Element | null,
      selectingViewport: boolean,
    ) {
      if (!isSelecting) return;
      if (!selectingViewport && !target) return;

      isCapturingSelection = true;
      hideOverlayForCapture();
      await waitForPaint();

      try {
        if (selectingViewport) {
          console.log('[genui] viewport selected');
          browser.runtime.sendMessage({
            type: 'ELEMENT_SELECTED',
            tabId: selectionTabId ?? undefined,
            data: extractPageData(),
          });
          return;
        }

        console.log('[genui] element selected:', target!.tagName);
        const data = await extractElementData(target!, {
          includeHidden: includeHiddenElements,
        });
        browser.runtime.sendMessage({ type: 'ELEMENT_SELECTED', tabId: selectionTabId ?? undefined, data });

        if (includeHiddenElements) {
          pendingHiddenInteractionElement = target!;
          pendingHiddenInteractionSelector = data.selector;
        }
      } finally {
        isCapturingSelection = false;
      }
      // 连续选择模式：保持选择状态，不隐藏遮罩
    }

    async function capturePendingHiddenInteractions(tabId?: number) {
      const hiddenCaptureTabId = tabId ?? selectionTabId;

      if (!pendingHiddenInteractionElement) {
        browser.runtime.sendMessage({
          type: 'ELEMENT_HIDDEN_INTERACTIONS_SELECTED',
          tabId: hiddenCaptureTabId ?? undefined,
          selector: pendingHiddenInteractionSelector,
          data: [],
        });
        return;
      }

      const target = pendingHiddenInteractionElement;
      const selector = pendingHiddenInteractionSelector;
      pendingHiddenInteractionElement = null;
      pendingHiddenInteractionSelector = '';
      isCapturingSelection = true;

      try {
        const hiddenInteractions = await extractHiddenInteractionData(target);
        browser.runtime.sendMessage({
          type: 'ELEMENT_HIDDEN_INTERACTIONS_SELECTED',
          tabId: hiddenCaptureTabId ?? undefined,
          selector,
          data: hiddenInteractions,
        });
      } finally {
        isCapturingSelection = false;
      }
    }

    async function handleSelectionEvent(e: MouseEvent) {
      if (!isSelecting) return;
      if (isCapturingSelection) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      const selectingViewport = e.shiftKey || isViewportSelection;
      const target = selectingViewport
        ? null
        : getSelectableElement(document.elementFromPoint(e.clientX, e.clientY)!);
      await selectElement(target, selectingViewport);
    }

    async function handleEnterKey(e: KeyboardEvent) {
      if (!isSelecting) return;
      e.preventDefault();
      e.stopPropagation();

      const selectingViewport = e.shiftKey || isViewportSelection;
      const target = selectingViewport ? null : lastHoveredElement;
      await selectElement(target, selectingViewport);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isCapturingSelection) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        stopSelection();
        browser.runtime.sendMessage({ type: 'ELEMENT_SELECTION_CANCELLED', tabId: selectionTabId ?? undefined });
        return;
      }

      if (e.key === 'Enter') {
        handleEnterKey(e);
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
      document.addEventListener('click', handleSelectionEvent, true);
      document.addEventListener('contextmenu', handleSelectionEvent, true);
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('keyup', handleKeyUp, true);
      document.body.style.cursor = 'crosshair';
    }

    function stopSelectionChrome() {
      isSelecting = false;
      isViewportSelection = false;
      lastHoveredElement = null;
      isCapturingSelection = false;
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleSelectionEvent, true);
      document.removeEventListener('contextmenu', handleSelectionEvent, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      document.body.style.cursor = '';
      removeOverlay();
    }

    function stopSelection() {
      stopSelectionChrome();
      selectionTabId = null;
      includeHiddenElements = false;
      document.body.style.cursor = '';
    }

    browser.runtime.onMessage.addListener((message: { type: string; tabId?: number; selectViewport?: boolean; includeHidden?: boolean; hiddenCapture?: typeof hiddenCaptureOptions }) => {
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
      if (message.type === 'CAPTURE_HIDDEN_INTERACTIONS') {
        hiddenCaptureOptions = {
          ...hiddenCaptureOptions,
          ...(message.hiddenCapture ?? {}),
        };
        capturePendingHiddenInteractions(message.tabId);
        return;
      }
      if (message.type === 'STOP_ELEMENT_SELECTION_CHROME') {
        stopSelectionChrome();
        return;
      }
      if (message.type === 'SELECT_HIGHLIGHTED_ELEMENT') {
        includeHiddenElements = message.includeHidden ?? includeHiddenElements;
        selectElement(
          message.selectViewport ? null : lastHoveredElement,
          message.selectViewport || isViewportSelection,
        );
        return;
      }
      if (message.type === 'START_ELEMENT_SELECTION') {
        selectionTabId = message.tabId ?? null;
        includeHiddenElements = message.includeHidden ?? false;
        hiddenCaptureOptions = {
          ...hiddenCaptureOptions,
          ...(message.hiddenCapture ?? {}),
        };
        startSelection();
      } else if (message.type === 'STOP_ELEMENT_SELECTION') {
        stopSelection();
      }
    });

    browser.runtime.onConnect.addListener((port) => {
      if (port.name !== 'element-selection') return;

      port.onMessage.addListener((message: { type: string; tabId?: number; selectViewport?: boolean; includeHidden?: boolean; hiddenCapture?: typeof hiddenCaptureOptions }) => {
        if (message.type === 'START_ELEMENT_SELECTION') {
          selectionTabId = message.tabId ?? null;
          includeHiddenElements = message.includeHidden ?? false;
          hiddenCaptureOptions = {
            ...hiddenCaptureOptions,
            ...(message.hiddenCapture ?? {}),
          };
          startSelection();
        } else if (message.type === 'STOP_ELEMENT_SELECTION') {
          stopSelection();
        } else if (message.type === 'RESTORE_ELEMENT_SELECTION_OVERLAY') {
          restoreOverlayForSelection();
        } else if (message.type === 'STOP_ELEMENT_SELECTION_CHROME') {
          stopSelectionChrome();
        } else if (message.type === 'CAPTURE_HIDDEN_INTERACTIONS') {
          hiddenCaptureOptions = {
            ...hiddenCaptureOptions,
            ...(message.hiddenCapture ?? {}),
          };
          capturePendingHiddenInteractions(message.tabId);
        } else if (message.type === 'SELECT_HIGHLIGHTED_ELEMENT') {
          includeHiddenElements = message.includeHidden ?? includeHiddenElements;
          selectElement(
            message.selectViewport ? null : lastHoveredElement,
            message.selectViewport || isViewportSelection,
          );
        }
      });

      port.onDisconnect.addListener(() => {
        stopSelection();
      });
    });

    console.log('[genui] content script ready');
  },
});
