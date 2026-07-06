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
assert.equal(nextSettings.models[0]?.id, DEFAULT_SETTINGS.models[0]?.id);
assert.equal(nextSettings.mentions[0]?.id, DEFAULT_SETTINGS.mentions[0]?.id);

console.log("settings storage tests passed");
