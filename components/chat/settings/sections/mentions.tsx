"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useState, type FC } from "react";
import { useSettings } from "../context";
import { type Mention } from "../types";

const emptyMention = (): Mention => ({
  id: "",
  type: "prompt",
  label: "",
  description: "",
  content: "",
  icon: "",
});

export const MentionsSection: FC = () => {
  const { settings, updateSettings } = useSettings();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);

  const normalizedSelectedIndex =
    selectedIndex == null || selectedIndex >= settings.mentions.length
      ? settings.mentions.length > 0
        ? 0
        : null
      : selectedIndex;
  const selectedMention =
    normalizedSelectedIndex == null
      ? null
      : settings.mentions[normalizedSelectedIndex] ?? null;

  const updateMention = (index: number, patch: Partial<Mention>) => {
    updateSettings((prev) => ({
      ...prev,
      mentions: prev.mentions.map((mention, itemIndex) =>
        itemIndex === index ? { ...mention, ...patch } : mention,
      ),
    }));
  };

  const handleAdd = () => {
    const nextIndex = settings.mentions.length;
    updateSettings((prev) => ({
      ...prev,
      mentions: [...prev.mentions, emptyMention()],
    }));
    setSelectedIndex(nextIndex);
  };

  const handleDelete = (index: number) => {
    updateSettings((prev) => ({
      ...prev,
      mentions: prev.mentions.filter((_, itemIndex) => itemIndex !== index),
    }));
    setSelectedIndex(index > 0 ? index - 1 : 0);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mentions</h2>
          <p className="text-muted-foreground text-sm">
            管理输入框中通过 @ 触发的可复用提示词。
          </p>
        </div>
        <Button size="sm" onClick={handleAdd}>
          Add Mention
        </Button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-1/3 min-w-[220px] overflow-auto rounded-lg border p-2">
          {settings.mentions.length === 0 && (
            <p className="text-muted-foreground p-2 text-sm">
              No mentions configured.
            </p>
          )}
          {settings.mentions.map((mention, index) => (
            <button
              key={`${mention.id}:${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "w-full cursor-pointer rounded-md p-2 text-left text-sm hover:bg-accent",
                normalizedSelectedIndex === index && "bg-accent",
              )}
            >
              <div className="truncate font-medium">
                {mention.label || mention.id || "Untitled"}
              </div>
              <div className="text-muted-foreground truncate text-xs">
                :{mention.type}
                {mention.id ? `[name=${mention.id}]` : ""}
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {selectedMention == null || normalizedSelectedIndex == null ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              Select or add a mention to edit
            </div>
          ) : (
            <div className="flex max-w-3xl flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Label</label>
                  <Input
                    value={selectedMention.label}
                    onChange={(e) =>
                      updateMention(normalizedSelectedIndex, {
                        label: e.target.value,
                      })
                    }
                    placeholder="显示名称"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Type</label>
                  <Input
                    value={selectedMention.type}
                    onChange={(e) =>
                      updateMention(normalizedSelectedIndex, {
                        type: e.target.value,
                      })
                    }
                    placeholder="prompt"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">ID</label>
                  <Input
                    value={selectedMention.id}
                    onChange={(e) =>
                      updateMention(normalizedSelectedIndex, {
                        id: e.target.value,
                      })
                    }
                    placeholder="唯一标识"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Icon</label>
                  <Input
                    value={selectedMention.icon}
                    onChange={(e) =>
                      updateMention(normalizedSelectedIndex, {
                        icon: e.target.value,
                      })
                    }
                    placeholder="React / Vue"
                  />
                  <p className="text-muted-foreground text-xs">
                    自定义图标需先在 composer 中注册 iconMap。
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={selectedMention.description}
                  onChange={(e) =>
                    updateMention(normalizedSelectedIndex, {
                      description: e.target.value,
                    })
                  }
                  placeholder="选择器中的简短说明"
                />
                <p className="text-muted-foreground text-xs">
                  显示在 @ 选择器的副标题中，应简短。
                </p>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Content</label>
                <Textarea
                  value={selectedMention.content}
                  onChange={(e) =>
                    updateMention(normalizedSelectedIndex, {
                      content: e.target.value,
                    })
                  }
                  placeholder="实际发送给 AI 的提示词内容"
                  rows={12}
                  className="field-sizing-fixed max-h-64 resize-y"
                />
                <p className="text-muted-foreground text-xs">
                  发送消息时会替换 @ 引用为此内容。
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleDelete(normalizedSelectedIndex)}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
