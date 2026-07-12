"use client";

import { useSettings } from "../context";
import {
  type CapturePart,
  type HiddenCaptureActionStrategy,
  type OutputFormat,
  type PickerMode,
} from "../types";
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
  {
    value: "hidden",
    label: "隐藏元素",
    description: "启发式尝试点击、悬浮、聚焦选中元素内的安全触发器，捕获弹窗、下拉、Popover 等交互后显示的内容；原生 select 的系统弹层无法直接读取。",
  },
];

const HIDDEN_ACTION_STRATEGY_OPTIONS: {
  value: HiddenCaptureActionStrategy;
  label: string;
  description: string;
}[] = [
  {
    value: "first-match",
    label: "命中后跳过剩余动作",
    description: "更快。每个触发器只保留首次成功捕获的 click / hover / focus 结果。",
  },
  {
    value: "all",
    label: "尝试全部动作",
    description: "更完整但较慢。适合 hover 和 click 会展示不同内容的网站。",
  },
];

function toggleCapturePart(parts: CapturePart[], value: CapturePart) {
  return parts.includes(value)
    ? parts.filter((part) => part !== value)
    : [...parts, value];
}

function parseNumberInput(value: string, fallback: number) {
  if (value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

        {settings.general.captureParts.includes("hidden") && (
          <div className="grid gap-2 rounded-lg border p-3">
            <div>
              <label className="text-sm font-medium">隐藏元素捕获</label>
              <p className="text-muted-foreground mt-1 text-xs">
                控制自动触发隐藏元素时的等待时长。输入不做范围限制，便于特殊页面使用更大值。
              </p>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">隐藏元素展示时长（ms）</span>
              <input
                type="number"
                inputMode="numeric"
                value={settings.general.hiddenCapture.revealTimeoutMs}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    general: {
                      ...prev.general,
                      hiddenCapture: {
                        ...prev.general.hiddenCapture,
                        revealTimeoutMs: parseNumberInput(
                          e.target.value,
                          prev.general.hiddenCapture.revealTimeoutMs,
                        ),
                      },
                    },
                  }))
                }
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
              <span className="text-muted-foreground text-xs">
                触发 click / hover / focus 后最多等待多久来识别弹窗或浮层。
              </span>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">隐藏元素触发间隔（ms）</span>
              <input
                type="number"
                inputMode="numeric"
                value={settings.general.hiddenCapture.triggerIntervalMs}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    general: {
                      ...prev.general,
                      hiddenCapture: {
                        ...prev.general.hiddenCapture,
                        triggerIntervalMs: parseNumberInput(
                          e.target.value,
                          prev.general.hiddenCapture.triggerIntervalMs,
                        ),
                      },
                    },
                  }))
                }
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              />
              <span className="text-muted-foreground text-xs">
                关闭一个隐藏元素后，等待多久再触发下一个候选元素。
              </span>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">隐藏元素触发策略</span>
              <select
                value={settings.general.hiddenCapture.actionStrategy}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    general: {
                      ...prev.general,
                      hiddenCapture: {
                        ...prev.general.hiddenCapture,
                        actionStrategy: e.target.value as HiddenCaptureActionStrategy,
                      },
                    },
                  }))
                }
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                {HIDDEN_ACTION_STRATEGY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground text-xs">
                {HIDDEN_ACTION_STRATEGY_OPTIONS.find(
                  (opt) => opt.value === settings.general.hiddenCapture.actionStrategy,
                )?.description}
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.general.hiddenCapture.hoverRevealTriggers}
                onChange={() =>
                  updateSettings((prev) => ({
                    ...prev,
                    general: {
                      ...prev.general,
                      hiddenCapture: {
                        ...prev.general.hiddenCapture,
                        hoverRevealTriggers: !prev.general.hiddenCapture.hoverRevealTriggers,
                      },
                    },
                  }))
                }
                className="mt-0.5 rounded border"
              />
              <span>
                <span className="font-medium">悬浮显现触发器</span>
                <span className="text-muted-foreground block text-xs">
                  先悬浮选中元素和列表项，让操作按钮显示出来，再尝试触发这些新出现的按钮。
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.general.hiddenCapture.recursive}
                onChange={() =>
                  updateSettings((prev) => ({
                    ...prev,
                    general: {
                      ...prev.general,
                      hiddenCapture: {
                        ...prev.general.hiddenCapture,
                        recursive: !prev.general.hiddenCapture.recursive,
                      },
                    },
                  }))
                }
                className="mt-0.5 rounded border"
              />
              <span>
                <span className="font-medium">递归探索隐藏元素</span>
                <span className="text-muted-foreground block text-xs">
                  捕获到弹窗或菜单后，继续探索其内部的隐藏元素；更完整但更慢，副作用风险更高。
                </span>
              </span>
            </label>
            {settings.general.hiddenCapture.recursive && (
              <label className="grid gap-1 text-sm">
                <span className="font-medium">递归深度</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={settings.general.hiddenCapture.maxDepth}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      general: {
                        ...prev.general,
                        hiddenCapture: {
                          ...prev.general.hiddenCapture,
                          maxDepth: parseNumberInput(
                            e.target.value,
                            prev.general.hiddenCapture.maxDepth,
                          ),
                        },
                      },
                    }))
                  }
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                />
                <span className="text-muted-foreground text-xs">
                  允许输入任意数值。值越大越慢，也越可能触发页面副作用。
                </span>
              </label>
            )}
          </div>
        )}

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
