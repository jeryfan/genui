import { type Settings, type Mention, DEFAULT_SETTINGS } from "./types";

const STORAGE_KEY = "genui-settings";

function migrateMentions(mentions?: Partial<Settings>["mentions"]): Settings["mentions"] {
  if (!Array.isArray(mentions)) return DEFAULT_SETTINGS.mentions;

  return mentions.map((mention) => {
    const migrated: Mention = {
      id: mention.id ?? "",
      type: mention.type ?? "prompt",
      label: mention.label ?? "",
      content: mention.content ?? "",
      description: mention.description ?? "",
      icon: mention.icon ?? "",
      metadata: mention.metadata,
    };

    // 旧版本使用 description 作为提示词内容；新版本迁移到 content
    if (!migrated.content && migrated.description) {
      migrated.content = migrated.description;
      migrated.description = "";
    }

    return migrated;
  });
}

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
    mentions: migrateMentions(stored.mentions),
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}
