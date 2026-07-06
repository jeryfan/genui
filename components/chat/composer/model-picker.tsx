"use client";

import {
  ModelSelector,
  resolveModelEffort,
  type ModelOption,
  type ModelSelectorEffortOption,
} from "@/components/assistant-ui/model-selector";
import { useSettings } from "@/components/chat/settings/context";
import { getModelConfigRuntimeKey } from "@/components/chat/settings/models";
import type { ModelConfig } from "@/components/chat/settings/types";
import {
  clampThinkingLevel,
  getSupportedThinkingLevels,
  type ModelThinkingLevel,
} from "@jeryfan/ai";
import { useEffect, useMemo, useState, type FC } from "react";

const EFFORT_LABELS: Record<Exclude<ModelThinkingLevel, "off">, string> = {
  minimal: "Min",
  low: "Low",
  medium: "Med",
  high: "High",
  xhigh: "XHigh",
};

function thinkingLevelToOption(
  level: ModelThinkingLevel,
): ModelSelectorEffortOption | null {
  if (level === "off") return null;
  return {
    id: level,
    name: EFFORT_LABELS[level],
  };
}

function getEffortOptions(config: ModelConfig) {
  const options = getSupportedThinkingLevels(config)
    .map(thinkingLevelToOption)
    .filter((option): option is ModelSelectorEffortOption => option !== null);

  return options.length > 0 ? options : undefined;
}

function getDefaultEffort(config: ModelConfig | undefined): string | undefined {
  if (!config?.reasoning) return undefined;
  const level = clampThinkingLevel(config, config.thinkingLevel ?? "medium");
  return level === "off" ? undefined : level;
}

function modelConfigToOption(config: ModelConfig): ModelOption {
  return {
    id: getModelConfigRuntimeKey(config),
    name: config.name || config.id,
    description: `${config.provider} · ${config.api}`,
    efforts: getEffortOptions(config),
  };
}

export const ModelPicker: FC = () => {
  const { settings } = useSettings();
  const models = useMemo(
    () => settings.models.map(modelConfigToOption),
    [settings.models],
  );
  const configById = useMemo(
    () =>
      new Map(
        settings.models.map((config) => [getModelConfigRuntimeKey(config), config]),
      ),
    [settings.models],
  );
  const firstValue = models[0]?.id;
  const [value, setValue] = useState<string | undefined>(firstValue);
  const [effort, setEffort] = useState<string | undefined>(() =>
    getDefaultEffort(firstValue ? configById.get(firstValue) : undefined),
  );

  useEffect(() => {
    setValue((current) => {
      if (current && models.some((model) => model.id === current)) {
        return current;
      }
      return firstValue;
    });
  }, [firstValue, models]);

  useEffect(() => {
    const selectedConfig = value ? configById.get(value) : undefined;
    const fallbackEffort = getDefaultEffort(selectedConfig);

    setEffort((current) =>
      resolveModelEffort(models, value, current) ?? fallbackEffort,
    );
  }, [configById, models, value]);

  return (
    <ModelSelector
      models={models}
      value={value}
      onValueChange={setValue}
      effort={effort}
      onEffortChange={setEffort}
      variant="ghost"
      size="sm"
      className="h-7 rounded-full"
      contentClassName="[&_[cmdk-item][data-selected=false]]:bg-transparent [&_[cmdk-item][data-selected=false]]:text-popover-foreground"
    />
  );
};
