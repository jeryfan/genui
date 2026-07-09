import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const contentScript = readFileSync("entrypoints/content.ts", "utf8");
const hook = readFileSync("hooks/use-element-selection.ts", "utf8");

assert.doesNotMatch(
  contentScript,
  /restoreOverlayAfterCapture|setTimeout\(\s*\(\) =>[\s\S]*updateOverlay/,
  "element picker overlay must not be restored with a fixed timeout before screenshot completes",
);

assert.match(
  contentScript,
  /RESTORE_ELEMENT_SELECTION_OVERLAY/,
  "content script must support explicit overlay restore after screenshot completes",
);

assert.match(
  contentScript,
  /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => resolve\(\)\)\)/,
  "content script must wait for paint after hiding the overlay before notifying the side panel",
);

const handleElementSelectedStart = hook.indexOf("const handleElementSelected");
assert.notEqual(handleElementSelectedStart, -1);
const handleElementSelected = hook.slice(handleElementSelectedStart);
const screenshotIndex = handleElementSelected.indexOf("browser.tabs.captureVisibleTab");
const markdownIndex = handleElementSelected.indexOf("createMarkdownFile");

assert.ok(screenshotIndex !== -1, "element selection must capture a screenshot");
assert.ok(markdownIndex !== -1, "element selection must create markdown attachment");
assert.ok(
  screenshotIndex < markdownIndex,
  "element selection screenshot must happen before adding markdown attachment to keep overlay hidden window short",
);

assert.match(
  hook,
  /RESTORE_ELEMENT_SELECTION_OVERLAY/,
  "hook must send an explicit overlay restore message",
);

assert.match(
  handleElementSelected,
  /restoreSelectionOverlayInTab\(tabId\)/,
  "continuous mode must restore the overlay only after screenshot work finishes",
);

console.log("element selection overlay tests passed");
