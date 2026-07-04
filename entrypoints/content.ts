export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // 避免重复注入导致事件监听重复注册
    if ((window as any).__genuiElementPickerReady) return;
    (window as any).__genuiElementPickerReady = true;

    let isSelecting = false;
    let overlay: HTMLElement | null = null;

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

    function extractElementData(element: Element) {
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      const styles: Record<string, string> = {};

      for (let i = 0; i < computedStyle.length; i++) {
        const prop = computedStyle[i];
        const value = computedStyle.getPropertyValue(prop);
        if (value && value !== 'initial' && value !== 'none') {
          styles[prop] = value;
        }
      }

      return {
        selector: getSelectorPath(element),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
        },
        devicePixelRatio: window.devicePixelRatio,
        styles,
        html: element.outerHTML,
      };
    }

    function handleMouseMove(e: MouseEvent) {
      if (!isSelecting) return;
      console.log('[genui] mousemove, isSelecting:', isSelecting);
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || target === overlay || overlay?.contains(target)) {
        console.log('[genui] mousemove ignored target:', target, 'overlay:', overlay);
        return;
      }
      updateOverlay(target);
    }

    function handleClick(e: MouseEvent) {
      if (!isSelecting) return;
      e.preventDefault();
      e.stopPropagation();

      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target) return;

      console.log('[genui] element selected:', target.tagName);
      const data = extractElementData(target);
      browser.runtime.sendMessage({ type: 'ELEMENT_SELECTED', data });
      // 连续选择模式：保持选择状态，不隐藏遮罩
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        stopSelection();
        browser.runtime.sendMessage({ type: 'ELEMENT_SELECTION_CANCELLED' });
      }
    }

    function startSelection() {
      if (isSelecting) return;
      isSelecting = true;
      createOverlay();
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
      document.body.style.cursor = 'crosshair';
    }

    function stopSelection() {
      isSelecting = false;
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.cursor = '';
      removeOverlay();
    }

    browser.runtime.onMessage.addListener((message: { type: string }) => {
      if (message.type === 'PING') {
        return;
      }
      if (message.type === 'START_ELEMENT_SELECTION') {
        startSelection();
      } else if (message.type === 'STOP_ELEMENT_SELECTION') {
        stopSelection();
      }
    });

    console.log('[genui] content script ready');
  },
});
