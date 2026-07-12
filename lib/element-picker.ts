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

export type HiddenInteractionTriggerCandidate = {
  id: string;
  selector: string;
  text: string;
  tagName: string;
  role?: string;
  actions: HiddenInteractionAction[];
  source: "auto" | "manual";
  rect: ElementRect;
};

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
  hiddenInteractionCandidates?: HiddenInteractionTriggerCandidate[];
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

export type ElementHiddenInteractionTriggerPickedMessage = {
  type: "ELEMENT_HIDDEN_INTERACTION_TRIGGER_PICKED";
  tabId?: number;
  candidate: HiddenInteractionTriggerCandidate;
};

export type ElementHiddenInteractionTriggerPickStoppedMessage = {
  type: "ELEMENT_HIDDEN_INTERACTION_TRIGGER_PICK_STOPPED";
  tabId?: number;
};

export type ElementSelectionCancelledMessage = {
  type: "ELEMENT_SELECTION_CANCELLED";
  tabId?: number;
};

export type ElementPickerMessage =
  | ElementSelectedMessage
  | ElementHiddenInteractionsSelectedMessage
  | ElementHiddenInteractionTriggerPickedMessage
  | ElementHiddenInteractionTriggerPickStoppedMessage
  | ElementSelectionCancelledMessage;

export type CaptureDetail = "compact" | "balanced" | "full";

const BALANCED_STYLE_PREFIXES = [
  "align-",
  "background",
  "border",
  "box-shadow",
  "color",
  "column-",
  "display",
  "filter",
  "flex",
  "font",
  "gap",
  "grid",
  "height",
  "justify-",
  "left",
  "letter-spacing",
  "line-height",
  "margin",
  "max-",
  "min-",
  "object-",
  "opacity",
  "outline",
  "overflow",
  "padding",
  "position",
  "right",
  "row-",
  "text-",
  "top",
  "transform",
  "transition",
  "width",
  "z-index",
];

const COMPACT_STYLE_PROPS = new Set([
  "background-color",
  "border-bottom-color",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border-bottom-width",
  "border-left-color",
  "border-left-width",
  "border-radius",
  "border-right-color",
  "border-right-width",
  "border-top-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-top-width",
  "box-shadow",
  "color",
  "display",
  "font-size",
  "font-weight",
  "height",
  "line-height",
  "opacity",
  "position",
  "transform",
  "width",
  "z-index",
]);

const LOW_VALUE_TREE_TAGS = new Set(["path", "defs", "clippath", "mask"]);
const MEDIA_TREE_TAGS = new Set(["img", "picture", "video", "canvas"]);
const INTERACTIVE_TREE_TAGS = new Set([
  "a",
  "button",
  "details",
  "dialog",
  "input",
  "option",
  "select",
  "summary",
  "textarea",
]);

const INTERACTIVE_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "dialog",
  "link",
  "listbox",
  "menu",
  "menuitem",
  "option",
  "radio",
  "searchbox",
  "slider",
  "switch",
  "tab",
  "textbox",
  "tooltip",
]);

function isLowValueStyle(prop: string, value: string): boolean {
  if (value === "normal" || value === "none" || value === "auto") return true;
  if (value === "visible" && prop === "visibility") return true;
  if (value === "auto" && prop === "pointer-events") return true;
  return (
    prop === "block-size" ||
    prop === "inline-size" ||
    prop.startsWith("inset-") ||
    prop.startsWith("border-block-") ||
    prop.startsWith("border-inline-") ||
    prop === "perspective-origin" ||
    prop === "transform-origin" ||
    prop === "unicode-bidi" ||
    prop === "text-rendering"
  );
}

function compactEqualSides(
  styles: Record<string, string>,
  shorthand: string,
  sides: string[],
): void {
  if (styles[shorthand]) return;

  const values = sides.map((side) => styles[side]);
  const first = values[0];
  if (!first || !values.every((value) => value === first)) return;

  styles[shorthand] = first;
  for (const side of sides) delete styles[side];
}

function compactEqualBorderStyles(styles: Record<string, string>): void {
  compactEqualSides(styles, "border-color", [
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
  ]);
  compactEqualSides(styles, "border-width", [
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
  ]);
  compactEqualSides(styles, "border-radius", [
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
  ]);
}

function normalizeStylesForDetail(
  styles: Record<string, string>,
  detail: CaptureDetail,
): Record<string, string> {
  if (detail === "full") return styles;

  const normalized = { ...styles };
  compactEqualSides(normalized, "margin", [
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
  ]);
  compactEqualSides(normalized, "padding", [
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
  ]);
  compactEqualBorderStyles(normalized);
  return normalized;
}

function filterStylesForDetail(
  styles: Record<string, string>,
  detail: CaptureDetail,
): Record<string, string> {
  if (detail === "full") return styles;

  const filtered: Record<string, string> = {};
  for (const [prop, value] of Object.entries(styles)) {
    if (isLowValueStyle(prop, value)) continue;

    if (detail === "compact") {
      if (COMPACT_STYLE_PROPS.has(prop)) filtered[prop] = value;
      continue;
    }

    if (
      BALANCED_STYLE_PREFIXES.some(
        (prefix) => prop === prefix || prop.startsWith(prefix),
      )
    ) {
      filtered[prop] = value;
    }
  }
  return normalizeStylesForDetail(filtered, detail);
}

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
  detail: CaptureDetail,
): string {
  const styles = filterStylesForDetail(pseudo.styles, detail);
  return [
    `#### ::${name}`,
    pseudo.content ? `- Content: ${pseudo.content}` : "- Content: none",
    Object.keys(styles).length > 0 ? "```css" : "",
    Object.keys(styles).length > 0 ? formatStyles(styles) : "",
    Object.keys(styles).length > 0 ? "```" : "",
  ].filter(Boolean).join("\n");
}

function formatHiddenInteraction(
  interaction: HiddenInteractionSnapshot,
  index: number,
  detail: CaptureDetail,
): string {
  const styles = filterStylesForDetail(interaction.styles, detail);
  const treeContent = interaction.tree
    ? `\n#### Revealed Element Tree\n\n${formatElementTreeNode(interaction.tree, 0, detail)}\n`
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
    Object.keys(styles).length > 0 ? "```css" : "",
    Object.keys(styles).length > 0 ? formatStyles(styles) : "- Styles: none",
    Object.keys(styles).length > 0 ? "```" : "",
    treeContent,
    "#### Revealed HTML",
    "```html",
    interaction.html,
    "```",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function hasInteractiveRole(node: ElementTreeNode): boolean {
  const role = node.attributes.role?.toLowerCase();
  return !!role && INTERACTIVE_ROLES.has(role);
}

function hasUsefulAttributes(node: ElementTreeNode): boolean {
  return Object.keys(node.attributes).some((name) => {
    if (name === "class" || name === "style") return false;
    if (name.startsWith("data-")) return false;
    return true;
  });
}

function isUsefulTreeNode(node: ElementTreeNode, detail: CaptureDetail): boolean {
  if (detail === "full") return true;

  const tagName = node.tagName.toLowerCase();
  if (LOW_VALUE_TREE_TAGS.has(tagName)) return false;
  if (MEDIA_TREE_TAGS.has(tagName)) return true;
  if (INTERACTIVE_TREE_TAGS.has(tagName) || hasInteractiveRole(node)) return true;
  if (node.text.trim()) return true;
  if (hasUsefulAttributes(node)) return true;

  return Object.keys(filterStylesForDetail(node.styles, detail)).length > 0;
}

function getTreeChildrenToFormat(
  node: ElementTreeNode,
  depth: number,
  detail: CaptureDetail,
): ElementTreeNode[] {
  if (detail === "full") return node.children;

  const maxDepth = detail === "compact" ? 2 : 4;
  if (depth >= maxDepth) return [];

  const maxChildren = detail === "compact" ? 8 : 20;
  return node.children
    .filter((child) => isUsefulTreeNode(child, detail))
    .slice(0, maxChildren);
}

function formatElementTreeNode(
  node: ElementTreeNode,
  depth = 0,
  detail: CaptureDetail = "balanced",
): string {
  const headingLevel = Math.min(3 + depth, 6);
  const heading = `${"#".repeat(headingLevel)} ${node.selector}`;
  const styles = filterStylesForDetail(node.styles, detail);
  const pseudo = [
    node.pseudo?.before ? formatPseudoElement("before", node.pseudo.before, detail) : "",
    node.pseudo?.after ? formatPseudoElement("after", node.pseudo.after, detail) : "",
  ].filter(Boolean);
  const children = getTreeChildrenToFormat(node, depth, detail).map((child) =>
    formatElementTreeNode(child, depth + 1, detail),
  );

  return [
    heading,
    `- Tag: ${node.tagName}`,
    formatRect(node.rect),
    formatAttributes(node.attributes),
    node.text ? `- Text: ${node.text}` : "- Text: none",
    Object.keys(styles).length > 0 ? "```css" : "",
    Object.keys(styles).length > 0 ? formatStyles(styles) : "- Styles: none",
    Object.keys(styles).length > 0 ? "```" : "",
    ...pseudo,
    ...children,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type CreateMarkdownFileOptions = {
  includeHtml?: boolean;
  includeTree?: boolean;
  detail?: CaptureDetail;
};

export function createMarkdownFile(
  data: ElementSnapshot,
  options: CreateMarkdownFileOptions = {},
): File {
  const { includeHtml = true, includeTree = true, detail = "balanced" } = options;
  const kind = data.kind ?? "element";
  const screenshotScope =
    kind === "page"
      ? "Current screenshot attachment is the visible viewport only. HTML and Element Tree contain the full captured page DOM available at capture time."
      : kind === "viewport"
        ? "Current screenshot attachment is the visible viewport."
        : "Current screenshot attachment is cropped from the visible viewport, so off-screen portions of the selected element may not appear in the image.";
  const rootStyles = filterStylesForDetail(data.styles, detail);
  const treeContent = includeTree && data.tree
    ? `\n## Element Tree\n\n${formatElementTreeNode(data.tree, 0, detail)}\n`
    : "";
  const viewportContent = data.viewport
    ? `\n## Viewport\n| Key | Value |\n| --- | --- |\n| width | ${data.viewport.width} |\n| height | ${data.viewport.height} |\n| scrollX | ${data.viewport.scrollX} |\n| scrollY | ${data.viewport.scrollY} |\n`
    : "";

  const htmlContent = includeHtml
    ? `\n## HTML\n\`\`\`html\n${data.html}\n\`\`\`\n`
    : "";
  const hiddenInteractionContent = data.hiddenInteractions?.length
    ? `\n## Hidden Interaction Elements\n\n${data.hiddenInteractions
        .map((interaction, index) => formatHiddenInteraction(interaction, index, detail))
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
${formatStyles(rootStyles)}
\`\`\`
${treeContent}${htmlContent}${hiddenInteractionContent}`;

  return new File([content], `${kind}-${Date.now()}.md`, {
    type: "text/markdown",
  });
}

export function createHiddenInteractionsMarkdownFile(
  selector: string,
  interactions: HiddenInteractionSnapshot[],
  detail: CaptureDetail = "balanced",
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

${interactions
  .map((interaction, index) => formatHiddenInteraction(interaction, index, detail))
  .join("\n\n")}\n`;

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
