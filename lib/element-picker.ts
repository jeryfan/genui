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

export type ElementSnapshot = {
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
};

export type ElementSelectedMessage = {
  type: "ELEMENT_SELECTED";
  data: ElementSnapshot;
};

export type ElementSelectionCancelledMessage = {
  type: "ELEMENT_SELECTION_CANCELLED";
};

export type ElementPickerMessage =
  | ElementSelectedMessage
  | ElementSelectionCancelledMessage;

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

export function createMarkdownFile(data: ElementSnapshot): File {
  const treeContent = data.tree
    ? `\n## Element Tree\n\n${formatElementTreeNode(data.tree)}\n`
    : "";
  const viewportContent = data.viewport
    ? `\n## Viewport\n| Key | Value |\n| --- | --- |\n| width | ${data.viewport.width} |\n| height | ${data.viewport.height} |\n| scrollX | ${data.viewport.scrollX} |\n| scrollY | ${data.viewport.scrollY} |\n`
    : "";

  const content = `# Element Snapshot

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
${treeContent}
## HTML
\`\`\`html
${data.html}
\`\`\`
`;

  return new File([content], `element-${Date.now()}.md`, {
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
