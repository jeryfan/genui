"use client";

import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, type FC } from "react";
import { ModelsSection } from "./sections/models";
import { SystemPromptSection } from "./sections/system-prompt";
import { GeneralSection } from "./sections/general";
import { MentionsSection } from "./sections/mentions";

type SettingsTab = "models" | "system-prompt" | "general" | "mentions";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "models", label: "Models" },
  { id: "system-prompt", label: "System Prompt" },
  { id: "general", label: "General" },
  { id: "mentions", label: "Mentions" },
];

export const SettingsPage: FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("models");

  return (
    <div className="bg-background flex h-full w-full">
      <aside className="border-border flex w-52 flex-col border-r">
        <div className="flex h-12 items-center gap-2 px-3">
          {onBack && (
            <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
              <ArrowLeftIcon className="size-4" />
            </Button>
          )}
          <span className="text-sm font-medium">Settings</span>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-md px-3 py-2 text-left text-sm transition-colors",
                activeTab === tab.id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "hover:bg-accent/50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden p-4">
        {activeTab === "models" && <ModelsSection />}
        {activeTab === "system-prompt" && <SystemPromptSection />}
        {activeTab === "general" && <GeneralSection />}
        {activeTab === "mentions" && <MentionsSection />}
      </main>
    </div>
  );
};
