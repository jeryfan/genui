"use client";

import { useSettings } from "../context";
import { type CapturePart, type OutputFormat, type PickerMode } from "../types";
import { type FC } from "react";

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "html", label: "HTML" },
  { value: "react", label: "React" },
  { value: "vue", label: "Vue 3" },
];

const PICKER_OPTIONS: { value: PickerMode; label: string }[] = [
  { value: "continuous", label: "连续选择" },
  { value: "single", label: "单次选择" },
];

const CAPTURE_PART_OPTIONS: {
  value: CapturePart;
  label: string;
  description: string;
}[] = [
  {
    value: "screenshot",
    label: "截图",
    description: "发送当前可见截图，视觉还原最好，但会占用上下文。",
  },
  {
    value: "html",
    label: "原始 HTML",
    description: "发送 raw HTML。Element Tree 已包含主要结构，整页时通常可关闭。",
  },
  {
    value: "tree",
    label: "元素树",
    description: "发送递归结构、rect 和 computed styles，适合高保真复刻。",
  },
];

function toggleCapturePart(parts: CapturePart[], value: CapturePart) {
  return parts.includes(value)
    ? parts.filter((part) => part !== value)
    : [...parts, value];
}

export const GeneralSection: FC = () => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">通用设置</h2>
        <p className="text-muted-foreground text-sm">配置默认输出、元素选择和发送内容。</p>
      </div>

      <div className="grid max-w-md gap-4">
        <div className="grid gap-2">
          <label htmlFor="default-format" className="text-sm font-medium">
            默认输出格式
          </label>
          <select
            id="default-format"
            value={settings.general.defaultFormat}
            onChange={(e) =>
              updateSettings((prev) => ({
                ...prev,
                general: {
                  ...prev.general,
                  defaultFormat: e.target.value as OutputFormat,
                },
              }))
            }
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            当用户未指定输出格式时使用。
          </p>
        </div>

        <div className="grid gap-2">
          <div>
            <label className="text-sm font-medium">捕获内容</label>
            <p className="text-muted-foreground mt-1 text-xs">
              选择元素或 Shift 捕获页面时发送给模型的内容，可多选。
            </p>
          </div>
          <div className="grid gap-2 rounded-lg border p-3">
            {CAPTURE_PART_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.general.captureParts.includes(opt.value)}
                  onChange={() =>
                    updateSettings((prev) => ({
                      ...prev,
                      general: {
                        ...prev.general,
                        captureParts: toggleCapturePart(
                          prev.general.captureParts,
                          opt.value,
                        ),
                      },
                    }))
                  }
                  className="mt-0.5 rounded border"
                />
                <span>
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-muted-foreground block text-xs">
                    {opt.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <label htmlFor="picker-mode" className="text-sm font-medium">
            元素选择模式
          </label>
          <select
            id="picker-mode"
            value={settings.general.pickerMode}
            onChange={(e) =>
              updateSettings((prev) => ({
                ...prev,
                general: {
                  ...prev.general,
                  pickerMode: e.target.value as PickerMode,
                },
              }))
            }
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            {PICKER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            单次选择：选择一次后自动结束；连续选择：可连续选择多个元素，按 Esc 结束。
          </p>
        </div>
      </div>
    </div>
  );
};
