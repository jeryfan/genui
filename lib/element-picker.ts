export type ElementRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
};

export type ElementSnapshot = {
  selector: string;
  rect: ElementRect;
  devicePixelRatio: number;
  styles: Record<string, string>;
  html: string;
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

export function createMarkdownFile(data: ElementSnapshot): File {
  const styleEntries = Object.entries(data.styles).map(
    ([prop, value]) => `${prop}: ${value};`,
  );

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

## Computed Styles
\`\`\`css
${styleEntries.join("\n")}
\`\`\`

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
