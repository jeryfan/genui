"use client";

import { ModelSelector } from "@/components/assistant-ui/model-selector";
import { AI_MODELS, DEFAULT_AI_MODEL } from "../models";
import { type FC } from "react";

export const ModelPicker: FC = () => {
  return (
    <ModelSelector
      models={AI_MODELS}
      defaultValue={DEFAULT_AI_MODEL.id}
      variant="ghost"
      size="sm"
      className="h-7 rounded-full"
    />
  );
};
