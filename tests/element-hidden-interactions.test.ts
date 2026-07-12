import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const contentScript = readFileSync("entrypoints/content.ts", "utf8");
const hook = readFileSync("hooks/use-element-selection.ts", "utf8");

assert.match(
  contentScript,
  /includeHiddenElements/,
  "content script must store the includeHidden selection option",
);

assert.match(
  contentScript,
  /findInteractionTriggers/,
  "content script must find candidate interaction triggers",
);

assert.match(
  contentScript,
  /getVisibleOverlaySet/,
  "content script must snapshot visible overlays before interactions",
);

assert.match(
  contentScript,
  /performInteraction/,
  "content script must perform click, hover, and focus interactions",
);

assert.match(
  contentScript,
  /exploreHiddenInteractions/,
  "content script must explore hidden interactions when enabled",
);

assert.match(
  contentScript,
  /hiddenInteractions/,
  "content script must attach hidden interaction snapshots to element data",
);

assert.match(
  contentScript,
  /aria-controls/,
  "content script must use aria-controls to identify revealed elements",
);

assert.match(
  contentScript,
  /KeyboardEvent\('keydown'/,
  "content script must dispatch Escape to close revealed interactions",
);

assert.match(
  contentScript,
  /HTMLSelectElement/,
  "content script must handle native select limitations explicitly",
);

assert.match(
  hook,
  /captureParts\.includes\("hidden"\)/,
  "element selection hook must read the hidden capture option",
);

assert.match(
  hook,
  /includeHidden/,
  "element selection hook must pass includeHidden to content script messages",
);

assert.match(
  hook,
  /type: "START_ELEMENT_SELECTION"[\s\S]*includeHidden/,
  "START_ELEMENT_SELECTION must include the hidden capture flag",
);

assert.match(
  contentScript,
  /try \{[\s\S]*exploreHiddenInteractions[\s\S]*\} catch/,
  "hidden exploration failures must not prevent the base element snapshot from being sent",
);

assert.match(
  contentScript,
  /preventDefault\(\)/,
  "synthetic click exploration must suppress default navigation and form submission",
);

assert.match(
  contentScript,
  /function handleKeyDown\(e: KeyboardEvent\) \{\n\s+if \(isCapturingSelection\) return;/,
  "internal Escape dispatches used to close popovers must not cancel element selection",
);

assert.match(
  contentScript,
  /hasPendingHiddenInteractions/,
  "base element snapshot must mark hidden interactions as pending instead of embedding them immediately",
);

assert.match(
  contentScript,
  /CAPTURE_HIDDEN_INTERACTIONS/,
  "content script must defer hidden exploration until the side panel has captured screenshot and base HTML",
);

assert.match(
  hook,
  /createHiddenInteractionsMarkdownFile/,
  "hidden interactions must be written to a separate attachment file",
);

assert.match(
  hook,
  /captureVisibleTab[\s\S]*createMarkdownFile[\s\S]*CAPTURE_HIDDEN_INTERACTIONS/,
  "side panel must capture screenshots and base markdown before requesting hidden interactions",
);

assert.match(
  hook,
  /captureVisibleTab[\s\S]*createMarkdownFile[\s\S]*addAttachment\(mdFile\)[\s\S]*addAttachment\(screenshotFile\)[\s\S]*CAPTURE_HIDDEN_INTERACTIONS/,
  "selected element base markdown and screenshot must be attached before hidden interactions are triggered",
);

assert.match(
  hook,
  /pendingHiddenFinishRef/,
  "selection should finish after hidden interaction capture returns, not as a detached background task",
);

assert.match(
  contentScript,
  /const hiddenCaptureTabId = tabId \?\? selectionTabId;[\s\S]*ELEMENT_HIDDEN_INTERACTIONS_SELECTED[\s\S]*tabId: hiddenCaptureTabId/,
  "hidden interaction responses must keep the original tabId even if interaction cleanup changes selection state",
);

assert.match(
  contentScript,
  /isCapturingSelection = true;[\s\S]*extractHiddenInteractionData[\s\S]*isCapturingSelection = false;/,
  "hidden interaction cleanup must not let synthetic Escape cancel the selection before the response is sent",
);

assert.match(
  contentScript,
  /waitForRevealedElements/,
  "content script must poll for animated or delayed overlays after interactions",
);

assert.match(
  contentScript,
  /data-radix-popper-content-wrapper|data-side|data-align|getAttribute\('data-state'\) === 'open'/,
  "overlay detection must include Radix and floating-ui markers",
);

assert.match(
  contentScript,
  /pointerType: 'mouse'[\s\S]*isPrimary: true/,
  "synthetic pointer events must include mouse pointer metadata for Radix-style handlers",
);

assert.match(
  contentScript,
  /function getSelectableElement/,
  "content script must promote clicks on SVG/path children to their interactive parent button",
);

assert.match(
  hook,
  /STOP_ELEMENT_SELECTION_CHROME[\s\S]*CAPTURE_HIDDEN_INTERACTIONS/,
  "page picker chrome should stop before popovers open while side panel remains in cancel/generating state",
);

assert.doesNotMatch(
  hook,
  /STOP_ELEMENT_SELECTION_CHROME[\s\S]{0,300}setIsSelecting\(false\)/,
  "side panel cancel state must remain visible until all attachments are generated",
);

assert.match(
  contentScript,
  /STOP_ELEMENT_SELECTION_CHROME[\s\S]*stopSelectionChrome/,
  "content script must support removing page highlight without clearing pending hidden capture state",
);

assert.doesNotMatch(
  contentScript,
  /pendingHiddenInteractionElement = null;\n\s+pendingHiddenInteractionSelector = '';\n\s+document\.removeEventListener\('mousemove'/,
  "stopping the picker chrome must not clear the pending hidden interaction target",
);

assert.match(
  hook,
  /type: "CAPTURE_HIDDEN_INTERACTIONS",\n\s+tabId,/,
  "hidden interaction capture request must include the original tab id after picker chrome is removed",
);

assert.match(
  contentScript,
  /capturePendingHiddenInteractions\(tabId\?: number\)/,
  "content script must accept the original tab id for hidden interaction responses",
);

assert.match(
  hook,
  /setIsSelecting\(false\);/,
  "side panel selection button must return to non-cancel state after hidden interactions complete",
);

assert.match(
  contentScript,
  /closeRevealedInteraction\(trigger, revealedElements\.map/,
  "drawer cleanup should receive revealed elements so it can click outside their rects",
);

assert.match(
  contentScript,
  /elementFromPoint/,
  "drawer cleanup must use real topmost hit testing instead of dispatching clicks directly to body",
);

assert.match(
  contentScript,
  /data-radix-dialog-overlay|dialog-overlay|drawer|sheet/,
  "drawer cleanup must detect common overlay/backdrop markers",
);

assert.match(
  contentScript,
  /waitForRevealedElementsToClose/,
  "drawer cleanup must wait until revealed elements are actually closed",
);

assert.match(
  hook,
  /hiddenCapture/,
  "element selection hook must pass hidden capture timing options to content script",
);

assert.match(
  contentScript,
  /getPollingDelays\(hiddenCaptureOptions\.revealTimeoutMs\)/,
  "content script must use configured reveal timeout for hidden overlay polling",
);

assert.match(
  contentScript,
  /triggerIntervalMs[\s\S]*setTimeout/,
  "content script must use configured trigger interval between hidden interactions",
);

assert.match(
  contentScript,
  /actionStrategy === 'first-match'[\s\S]*revealedElements\.length > 0[\s\S]*break;/,
  "first-match strategy must skip remaining actions after the first successful hidden capture",
);

assert.match(
  contentScript,
  /recursive && depth < hiddenCaptureOptions\.maxDepth/,
  "recursive hidden capture must only explore nested hidden elements when enabled and within max depth",
);

assert.match(
  contentScript,
  /getHiddenSnapshotKey/,
  "recursive hidden capture must dedupe repeated hidden snapshots",
);

assert.match(
  contentScript,
  /triggerIntervalMs[\s\S]*await delay\(hiddenCaptureOptions\.triggerIntervalMs\)[\s\S]*const nested = await exploreHiddenInteractions/,
  "recursive hidden capture must explore nested popovers before closing the current revealed element",
);

assert.match(
  contentScript,
  /depth === 0 \|\| isRecursiveTrigger/,
  "recursive hidden capture must use conservative trigger filtering after the root layer",
);

assert.match(
  contentScript,
  /depth > 0 && rootForVisibility && revealedElements\.length === 0 && !isElementVisibleNow\(rootForVisibility\)/,
  "recursive hidden capture must stop a branch when an internal action closes its parent without opening a child overlay",
);

assert.match(
  contentScript,
  /if \(depth > 0 && rootForVisibility && !isElementVisibleNow\(rootForVisibility\)\) return snapshots;/,
  "recursive hidden capture must stop the whole branch when the parent hidden element is no longer visible",
);

assert.match(
  contentScript,
  /if \(!isElementVisibleNow\(trigger\)\) (continue|break);/,
  "recursive hidden capture must skip stale or invisible trigger references",
);

assert.match(
  contentScript,
  /depth > 0 && rootForVisibility && revealedElements\.length === 0 && !isElementVisibleNow\(rootForVisibility\)\) \{\n\s+return snapshots;/,
  "recursive hidden capture must return, not just break an action loop, when an internal action closes the parent",
);

assert.match(
  contentScript,
  /getRevealedSignature/,
  "hidden capture must dedupe repeated revealed overlays from list items by content signature",
);

assert.match(
  contentScript,
  /seenRevealedSignatures\.has\(signature\)/,
  "hidden capture must skip duplicate revealed overlay signatures",
);

assert.match(
  contentScript,
  /getTriggerActionSignature/,
  "hidden capture must dedupe repeated list item triggers before opening identical overlays",
);

assert.match(
  contentScript,
  /seenTriggerActionSignatures\.has\(triggerActionSignature\)/,
  "hidden capture must skip repeated trigger/action signatures to avoid repeatedly opening identical list popovers",
);

assert.match(
  contentScript,
  /hoverRevealTriggers/,
  "hidden capture must support hover-revealed action buttons independently from recursive capture",
);

assert.match(
  contentScript,
  /exploreHoverRevealedTriggers/,
  "hidden capture must hover containers and rescan newly visible triggers",
);

assert.match(
  contentScript,
  /findHoverRevealedTriggers/,
  "hidden capture must only click triggers that appeared after hover",
);

assert.match(
  contentScript,
  /forceHoverRevealControls/,
  "hidden capture must force common CSS group-hover controls visible during hover-reveal capture",
);

assert.match(
  contentScript,
  /group-hover:opacity-100/,
  "hidden capture must detect Tailwind group-hover opacity controls",
);

assert.match(
  contentScript,
  /restoreForcedHoverReveal\(\)/,
  "forced hover reveal styles must be restored after capture",
);

console.log("element hidden interaction tests passed");
