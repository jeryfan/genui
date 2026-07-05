import { type Settings, DEFAULT_SETTINGS } from "./types";

const STORAGE_KEY = "genui-settings";

export async function loadSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<Settings> | undefined;
  if (!stored) return DEFAULT_SETTINGS;

  // 合并默认值，防止新增字段缺失
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    general: {
      ...DEFAULT_SETTINGS.general,
      ...stored.general,
    },
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}
