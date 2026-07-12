export type ElementRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
};

export type PseudoElementSnapshot = {
  styles: Record<string, string>;
  content?: string;
};

export type ElementTreeNode = {
  tagName: string;
  selector: string;
  rect: ElementRect;
  attributes: Record<string, string>;
  text: string;
  styles: Record<string, string>;
  pseudo?: {
    before?: PseudoElementSnapshot;
    after?: PseudoElementSnapshot;
  };
  children: ElementTreeNode[];
};

export type HiddenInteractionAction = "click" | "hover" | "focus";

export type HiddenInteractionSnapshot = {
  triggerSelector: string;
  triggerText: string;
  action: HiddenInteractionAction;
  revealedSelector: string;
  revealedRole?: string;
  matchedBy?: string;
  waitTimeMs?: number;
  depth?: number;
  parentTriggerSelector?: string;
  rect: ElementRect;
  html: string;
  styles: Record<string, string>;
  tree?: ElementTreeNode;
};

export type ElementSnapshot = {
  kind?: "element" | "viewport" | "page";
  selector: string;
  rect: ElementRect;
  devicePixelRatio: number;
  viewport?: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
  };
  styles: Record<string, string>;
  html: string;
  tree?: ElementTreeNode;
  hiddenInteractions?: HiddenInteractionSnapshot[];
  hasPendingHiddenInteractions?: boolean;
};

export type ElementSelectedMessage = {
  type: "ELEMENT_SELECTED";
  tabId?: number;
  data: ElementSnapshot;
};

export type ElementHiddenInteractionsSelectedMessage = {
  type: "ELEMENT_HIDDEN_INTERACTIONS_SELECTED";
  tabId?: number;
  selector: string;
  data: HiddenInteractionSnapshot[];
};

export type ElementSelectionCancelledMessage = {
  type: "ELEMENT_SELECTION_CANCELLED";
  tabId?: number;
};

export type ElementPickerMessage =
  | ElementSelectedMessage
  | ElementHiddenInteractionsSelectedMessage
  | ElementSelectionCancelledMessage;

/**
 * Filter out computed styles that are identical to the default computed styles
 * for the same element tag. This removes browser defaults and inherited values
 * that do not affect the element's visual appearance, while preserving every
 * style that actually matters for 1:1 replication.
 */
export function filterComputedStylesByDefault(
  styles: Record<string, string>,
  defaults: Record<string, string>,
): Record<string, string> {
  const filtered: Record<string, string> = {};

  for (const [prop, value] of Object.entries(styles)) {
    if (!value || value === "initial" || value === "unset") continue;
    if (value !== defaults[prop]) {
      filtered[prop] = value;
    }
  }

  return filtered;
}

function formatStyles(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([prop, value]) => `${prop}: ${value};`)
    .join("\n");
}

function formatAttributes(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes);
  if (entries.length === 0) return "- Attributes: none";

  return [
    "- Attributes:",
    ...entries.map(([name, value]) => `  - ${name}: ${value}`),
  ].join("\n");
}

function formatRect(rect: ElementRect): string {
  return [
    `- Rect: x=${rect.x}, y=${rect.y}, width=${rect.width}, height=${rect.height}, top=${rect.top}, left=${rect.left}`,
  ].join("\n");
}

function formatPseudoElement(
  name: "before" | "after",
  pseudo: PseudoElementSnapshot,
): string {
  return [
    `#### ::${name}`,
    pseudo.content ? `- Content: ${pseudo.content}` : "- Content: none",
    "```css",
    formatStyles(pseudo.styles),
    "```",
  ].join("\n");
}

function formatHiddenInteraction(
  interaction: HiddenInteractionSnapshot,
  index: number,
): string {
  const treeContent = interaction.tree
    ? `\n#### Revealed Element Tree\n\n${formatElementTreeNode(interaction.tree)}\n`
    : "";

  return [
    `### Interaction ${index + 1}`,
    `- Trigger Selector: ${interaction.triggerSelector}`,
    interaction.triggerText
      ? `- Trigger Text: ${interaction.triggerText}`
      : "- Trigger Text: none",
    `- Action: ${interaction.action}`,
    `- Revealed Selector: ${interaction.revealedSelector}`,
    interaction.revealedRole
      ? `- Revealed Role: ${interaction.revealedRole}`
      : "- Revealed Role: none",
    interaction.matchedBy
      ? `- Matched By: ${interaction.matchedBy}`
      : "- Matched By: inferred overlay",
    interaction.waitTimeMs != null
      ? `- Wait Time: ${interaction.waitTimeMs}ms`
      : "- Wait Time: unknown",
    interaction.depth != null
      ? `- Depth: ${interaction.depth}`
      : "- Depth: 0",
    interaction.parentTriggerSelector
      ? `- Parent Trigger Selector: ${interaction.parentTriggerSelector}`
      : "- Parent Trigger Selector: none",
    formatRect(interaction.rect),
    "#### Revealed Computed Styles",
    "```css",
    formatStyles(interaction.styles),
    "```",
    treeContent,
    "#### Revealed HTML",
    "```html",
    interaction.html,
    "```",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatElementTreeNode(node: ElementTreeNode, depth = 0): string {
  const headingLevel = Math.min(3 + depth, 6);
  const heading = `${"#".repeat(headingLevel)} ${node.selector}`;
  const pseudo = [
    node.pseudo?.before ? formatPseudoElement("before", node.pseudo.before) : "",
    node.pseudo?.after ? formatPseudoElement("after", node.pseudo.after) : "",
  ].filter(Boolean);
  const children = node.children.map((child) =>
    formatElementTreeNode(child, depth + 1),
  );

  return [
    heading,
    `- Tag: ${node.tagName}`,
    formatRect(node.rect),
    formatAttributes(node.attributes),
    node.text ? `- Text: ${node.text}` : "- Text: none",
    "```css",
    formatStyles(node.styles),
    "```",
    ...pseudo,
    ...children,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type CreateMarkdownFileOptions = {
  includeHtml?: boolean;
  includeTree?: boolean;
};

export function createMarkdownFile(
  data: ElementSnapshot,
  options: CreateMarkdownFileOptions = {},
): File {
  const { includeHtml = true, includeTree = true } = options;
  const kind = data.kind ?? "element";
  const screenshotScope =
    kind === "page"
      ? "Current screenshot attachment is the visible viewport only. HTML and Element Tree contain the full captured page DOM available at capture time."
      : kind === "viewport"
        ? "Current screenshot attachment is the visible viewport."
        : "Current screenshot attachment is cropped from the visible viewport, so off-screen portions of the selected element may not appear in the image.";
  const treeContent = includeTree && data.tree
    ? `\n## Element Tree\n\n${formatElementTreeNode(data.tree)}\n`
    : "";
  const viewportContent = data.viewport
    ? `\n## Viewport\n| Key | Value |\n| --- | --- |\n| width | ${data.viewport.width} |\n| height | ${data.viewport.height} |\n| scrollX | ${data.viewport.scrollX} |\n| scrollY | ${data.viewport.scrollY} |\n`
    : "";

  const htmlContent = includeHtml
    ? `\n## HTML\n\`\`\`html\n${data.html}\n\`\`\`\n`
    : "";
  const hiddenInteractionContent = data.hiddenInteractions?.length
    ? `\n## Hidden Interaction Elements\n\n${data.hiddenInteractions
        .map(formatHiddenInteraction)
        .join("\n\n")}\n`
    : "";

  const content = `# Element Snapshot

注意：HTML 和 CSS 中提供的图片、SVG、背景图 URL 已解析为绝对地址，请直接使用这些 URL，不要将其重写为内联 SVG 或占位元素。

## Snapshot Type
${kind}

## Screenshot Scope
${screenshotScope}

## Selector
\`\`\`\n${data.selector}\n\`\`\`

## Bounding Rect
| Key | Value |
| --- | --- |
| x | ${data.rect.x} |
| y | ${data.rect.y} |
| width | ${data.rect.width} |
| height | ${data.rect.height} |
| top | ${data.rect.top} |
| left | ${data.rect.left} |
${viewportContent}
## Root Computed Styles
\`\`\`css
${formatStyles(data.styles)}
\`\`\`
${treeContent}${htmlContent}${hiddenInteractionContent}`;

  return new File([content], `${kind}-${Date.now()}.md`, {
    type: "text/markdown",
  });
}

export function createHiddenInteractionsMarkdownFile(
  selector: string,
  interactions: HiddenInteractionSnapshot[],
): File {
  const content = `# Hidden Interaction Elements

## Source Selector
\`\`\`\n${selector}\n\`\`\`

## Interaction Implementation Notes

When implementing click outside, close, toggle, menu, dialog, popover, dropdown, or tooltip behavior, the event target may be a nested icon, svg, path, span, or other child inside the trigger button.

Use containment-based checks:
~~~js
if (!popover.contains(event.target) && !trigger.contains(event.target)) {
  closePopover();
}

const button = event.target.closest("button");
~~~

Do not use root-node-only checks:
~~~js
if (event.target !== trigger) closePopover();
if (event.target === trigger) togglePopover();
~~~

${interactions.map(formatHiddenInteraction).join("\n\n")}\n`;

  return new File([content], `hidden-interactions-${Date.now()}.md`, {
    type: "text/markdown",
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Invalid data URL");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "image/png" });
}

export function createScreenshotFile(dataUrl: string): File {
  const blob = dataUrlToBlob(dataUrl);
  return new File([blob], `element-screenshot-${Date.now()}.png`, {
    type: "image/png",
  });
}

export function cropScreenshot(
  screenshotDataUrl: string,
  rect: ElementRect,
  devicePixelRatio: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      const sx = Math.round(rect.left * devicePixelRatio);
      const sy = Math.round(rect.top * devicePixelRatio);
      const sWidth = Math.round(rect.width * devicePixelRatio);
      const sHeight = Math.round(rect.height * devicePixelRatio);

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, rect.width, rect.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = screenshotDataUrl;
  });
}
