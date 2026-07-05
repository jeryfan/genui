"use client";

import { useSettings } from "../context";
import { type OutputFormat, type PickerMode } from "../types";
import { type FC } from "react";

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "html", label: "HTML" },
  { value: "react", label: "React" },
  { value: "vue", label: "Vue 3" },
];

const PICKER_OPTIONS: { value: PickerMode; label: string }[] = [
  { value: "continuous", label: "Continuous" },
  { value: "single", label: "Single" },
];

export const GeneralSection: FC = () => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">General</h2>
        <p className="text-muted-foreground text-sm">通用行为设置。</p>
      </div>

      <div className="grid gap-4 max-w-md">
        <div className="grid gap-2">
          <label htmlFor="default-format" className="text-sm font-medium">
            Default Output Format
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
            当用户未指定输出格式时，默认使用的格式。
          </p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="picker-mode" className="text-sm font-medium">
            Element Picker Mode
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
            Continuous：连续选择多个元素；Single：选择一次后自动结束。
          </p>
        </div>
      </div>
    </div>
  );
};
