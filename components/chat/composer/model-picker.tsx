"use client";

import { ModelSelector } from "@/components/assistant-ui/model-selector";
import { useSettings } from "@/components/chat/settings/context";
import { getModelConfigRuntimeKey } from "@/components/chat/settings/models";
import { type ModelOption } from "@/components/assistant-ui/model-selector";
import { type FC } from "react";

function modelConfigToOption(config: {
  id: string;
  name: string;
  api: string;
  provider: string;
  reasoning: boolean;
}): ModelOption {
  return {
    id: getModelConfigRuntimeKey(config),
    name: config.name || config.id,
    description: `${config.provider} · ${config.api}`,
    efforts: config.reasoning,
  };
}

export const ModelPicker: FC = () => {
  const { settings } = useSettings();
  const models = settings.models.map(modelConfigToOption);
  const defaultValue = models[0]?.id ?? "";

  return (
    <ModelSelector
      models={models}
      defaultValue={defaultValue}
      variant="ghost"
      size="sm"
      className="h-7 rounded-full"
    />
  );
};
