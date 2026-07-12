import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../components/chat/settings/types.ts";
import {
  normalizeSettings,
  STORAGE_KEY,
} from "../components/chat/settings/storage.ts";

const nextSettings = normalizeSettings({
  general: {
    ...DEFAULT_SETTINGS.general,
    defaultFormat: "react",
  },
});

assert.equal(STORAGE_KEY, "genui-settings");
assert.equal(nextSettings.general.defaultFormat, "react");
assert.equal(nextSettings.general.pickerMode, DEFAULT_SETTINGS.general.pickerMode);
assert.equal(nextSettings.general.hiddenCapture.revealTimeoutMs, 600);
assert.equal(nextSettings.general.hiddenCapture.triggerIntervalMs, 100);
assert.equal(nextSettings.models[0]?.id, DEFAULT_SETTINGS.models[0]?.id);
assert.equal(nextSettings.mentions[0]?.id, DEFAULT_SETTINGS.mentions[0]?.id);
assert.ok(DEFAULT_SETTINGS.general.captureParts.includes("screenshot"));
assert.ok(!DEFAULT_SETTINGS.general.captureParts.includes("hidden"));

const hiddenCaptureSettings = normalizeSettings({
  general: {
    ...DEFAULT_SETTINGS.general,
    captureParts: ["hidden", "html"],
  },
});
assert.deepEqual(hiddenCaptureSettings.general.captureParts, ["hidden", "html"]);

const customHiddenCaptureSettings = normalizeSettings({
  general: {
    ...DEFAULT_SETTINGS.general,
    hiddenCapture: {
      revealTimeoutMs: 5000,
      triggerIntervalMs: 0,
    } as any,
  },
});
assert.deepEqual(customHiddenCaptureSettings.general.hiddenCapture, {
  revealTimeoutMs: 5000,
  triggerIntervalMs: 0,
  actionStrategy: "first-match",
  recursive: false,
  maxDepth: 1,
  hoverRevealTriggers: true,
});

const allActionHiddenCaptureSettings = normalizeSettings({
  general: {
    ...DEFAULT_SETTINGS.general,
    hiddenCapture: {
      revealTimeoutMs: 800,
      triggerIntervalMs: 10,
      actionStrategy: "all",
      recursive: true,
      maxDepth: 5,
      hoverRevealTriggers: false,
    },
  },
});
assert.equal(allActionHiddenCaptureSettings.general.hiddenCapture.actionStrategy, "all");
assert.equal(allActionHiddenCaptureSettings.general.hiddenCapture.recursive, true);
assert.equal(allActionHiddenCaptureSettings.general.hiddenCapture.maxDepth, 5);

console.log("settings storage tests passed");
