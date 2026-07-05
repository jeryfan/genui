"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useSettings } from "../context";
import { DEFAULT_SYSTEM_PROMPT } from "../types";
import { type FC } from "react";

export const SystemPromptSection: FC = () => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">System Prompt</h2>
          <p className="text-muted-foreground text-sm">
            系统提示词会在每次请求时发送给模型。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            updateSettings((prev) => ({
              ...prev,
              systemPrompt: DEFAULT_SYSTEM_PROMPT,
            }))
          }
        >
          Restore Default
        </Button>
      </div>
      <Textarea
        value={settings.systemPrompt}
        onChange={(e) =>
          updateSettings((prev) => ({
            ...prev,
            systemPrompt: e.target.value,
          }))
        }
        className="flex-1 min-h-[300px] font-mono text-sm resize-none"
        placeholder="Enter system prompt..."
      />
      <p className="text-muted-foreground text-xs">
        修改会自动保存到本地存储。
      </p>
    </div>
  );
};
