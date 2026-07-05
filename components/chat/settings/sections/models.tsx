"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Api, ProviderId } from "@jeryfan/ai";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useMemo, useState, type FC } from "react";
import {
  createDefaultModelConfig,
  createModelConfigFromCatalog,
  getApiOptions,
  getModelOptionsForProviderApi,
  getProviderOptionsForApi,
} from "../catalog";
import { useSettings } from "../context";
import { type ModelConfig } from "../types";

const isChecked = (arr: string[] | undefined, value: string) =>
  arr?.includes(value) ?? false;

const toggleValue = (arr: string[] | undefined, value: string) => {
  const set = new Set(arr ?? []);
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
  return Array.from(set);
};

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

const SelectField: FC<SelectFieldProps> = ({ label, value, options, onChange }) => {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

function withCurrentOption(
  options: { value: string; label: string }[],
  value: string,
  label: string,
) {
  if (!value || options.some((option) => option.value === value)) {
    return options;
  }

  return [{ value, label }, ...options];
}

export const ModelsSection: FC = () => {
  const { settings, updateSettings } = useSettings();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [showApiKey, setShowApiKey] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [advancedJson, setAdvancedJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const apiOptions = useMemo(() => getApiOptions(), []);
  const normalizedSelectedIndex =
    selectedIndex == null || selectedIndex >= settings.models.length
      ? settings.models.length > 0
        ? 0
        : null
      : selectedIndex;
  const selectedModel =
    normalizedSelectedIndex == null
      ? null
      : settings.models[normalizedSelectedIndex] ?? null;

  const providerOptions = selectedModel
    ? withCurrentOption(
        getProviderOptionsForApi(selectedModel.api),
        selectedModel.provider,
        selectedModel.provider,
      )
    : [];
  const modelOptions = selectedModel
    ? withCurrentOption(
        getModelOptionsForProviderApi(selectedModel.provider, selectedModel.api),
        selectedModel.id,
        `${selectedModel.name || selectedModel.id} (${selectedModel.id})`,
      )
    : [];

  const replaceModel = (index: number, model: ModelConfig) => {
    updateSettings((prev) => ({
      ...prev,
      models: prev.models.map((item, itemIndex) =>
        itemIndex === index ? model : item,
      ),
    }));
  };

  const updateModel = (index: number, patch: Partial<ModelConfig>) => {
    updateSettings((prev) => ({
      ...prev,
      models: prev.models.map((model, itemIndex) =>
        itemIndex === index ? { ...model, ...patch } : model,
      ),
    }));
  };

  const handleAdd = () => {
    const newModel = createDefaultModelConfig();
    const nextIndex = settings.models.length;

    updateSettings((prev) => ({
      ...prev,
      models: [...prev.models, newModel],
    }));
    setSelectedIndex(nextIndex);
    setShowApiKey(false);
  };

  const handleDelete = (index: number) => {
    updateSettings((prev) => ({
      ...prev,
      models: prev.models.filter((_, itemIndex) => itemIndex !== index),
    }));
    setSelectedIndex(index > 0 ? index - 1 : 0);
  };

  const handleApiChange = (index: number, model: ModelConfig, api: Api) => {
    const providerOptions = getProviderOptionsForApi(api);
    const provider = providerOptions.some((option) => option.value === model.provider)
      ? model.provider
      : providerOptions[0]?.value;

    if (!provider) return;

    replaceModel(
      index,
      createModelConfigFromCatalog({
        api,
        provider,
        apiKey: model.apiKey,
      }),
    );
  };

  const handleProviderChange = (
    index: number,
    model: ModelConfig,
    provider: ProviderId,
  ) => {
    replaceModel(
      index,
      createModelConfigFromCatalog({
        api: model.api,
        provider,
        apiKey: model.apiKey,
      }),
    );
  };

  const handleModelChange = (
    index: number,
    model: ModelConfig,
    modelId: string,
  ) => {
    replaceModel(
      index,
      createModelConfigFromCatalog({
        api: model.api,
        provider: model.provider,
        modelId,
        apiKey: model.apiKey,
      }),
    );
  };

  const openAdvancedJson = () => {
    if (!selectedModel) return;
    setAdvancedJson(JSON.stringify(selectedModel, null, 2));
    setJsonError(null);
    setJsonOpen(true);
  };

  const applyAdvancedJson = () => {
    if (normalizedSelectedIndex == null) return;

    try {
      const parsed = JSON.parse(advancedJson) as ModelConfig;
      replaceModel(normalizedSelectedIndex, {
        ...parsed,
        name: parsed.name || parsed.id,
        apiKey: parsed.apiKey ?? "",
      });
      setJsonError(null);
      setJsonOpen(false);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Models</h2>
          <p className="text-muted-foreground text-sm">
            先选择 API，再选择支持该 API 的供应商和模型。
          </p>
        </div>
        <Button size="sm" onClick={handleAdd}>
          Add Model
        </Button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-1/3 min-w-[220px] overflow-auto rounded-lg border p-2">
          {settings.models.length === 0 && (
            <p className="text-muted-foreground p-2 text-sm">
              No models configured.
            </p>
          )}
          {settings.models.map((model, index) => (
            <button
              key={`${model.provider}:${model.id}:${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "w-full cursor-pointer rounded-md p-2 text-left text-sm hover:bg-accent",
                normalizedSelectedIndex === index && "bg-accent",
              )}
            >
              <div className="truncate font-medium">{model.name || model.id}</div>
              <div className="text-muted-foreground truncate text-xs">
                {model.id} · {model.provider}
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {selectedModel == null || normalizedSelectedIndex == null ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              Select or add a model to edit
            </div>
          ) : (
            <div className="flex max-w-3xl flex-col gap-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <SelectField
                    label="API"
                    value={selectedModel.api}
                    options={apiOptions}
                    onChange={(value) =>
                      handleApiChange(
                        normalizedSelectedIndex,
                        selectedModel,
                        value as Api,
                      )
                    }
                  />
                  <SelectField
                    label="Provider"
                    value={selectedModel.provider}
                    options={providerOptions}
                    onChange={(value) =>
                      handleProviderChange(
                        normalizedSelectedIndex,
                        selectedModel,
                        value as ProviderId,
                      )
                    }
                  />
                </div>

                <SelectField
                  label="Model"
                  value={selectedModel.id}
                  options={modelOptions}
                  onChange={(value) =>
                    handleModelChange(normalizedSelectedIndex, selectedModel, value)
                  }
                />

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Base URL</label>
                  <Input
                    value={selectedModel.baseUrl}
                    onChange={(e) =>
                      updateModel(normalizedSelectedIndex, {
                        baseUrl: e.target.value,
                      })
                    }
                  />
                  <p className="text-muted-foreground text-xs">
                    切换 provider 或 model 时会自动填充，可按实际网关地址修改。
                  </p>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">API Key</label>
                  <div className="flex gap-2">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={selectedModel.apiKey}
                      onChange={(e) =>
                        updateModel(normalizedSelectedIndex, {
                          apiKey: e.target.value,
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKey((value) => !value)}
                      aria-label={showApiKey ? "Hide API key" : "Show API key"}
                    >
                      {showApiKey ? (
                        <EyeOffIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Context Window</label>
                    <Input
                      type="number"
                      value={selectedModel.contextWindow}
                      onChange={(e) =>
                        updateModel(normalizedSelectedIndex, {
                          contextWindow: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Max Tokens</label>
                    <Input
                      type="number"
                      value={selectedModel.maxTokens}
                      onChange={(e) =>
                        updateModel(normalizedSelectedIndex, {
                          maxTokens: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedModel.reasoning}
                      onChange={(e) =>
                        updateModel(normalizedSelectedIndex, {
                          reasoning: e.target.checked,
                        })
                      }
                      className="rounded border"
                    />
                    Reasoning
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isChecked(selectedModel.input, "text")}
                      onChange={() =>
                        updateModel(normalizedSelectedIndex, {
                          input: toggleValue(selectedModel.input, "text") as any,
                        })
                      }
                      className="rounded border"
                    />
                    Text Input
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isChecked(selectedModel.input, "image")}
                      onChange={() =>
                        updateModel(normalizedSelectedIndex, {
                          input: toggleValue(selectedModel.input, "image") as any,
                        })
                      }
                      className="rounded border"
                    />
                    Image Input
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openAdvancedJson}
                  >
                    Edit JSON
                  </Button>
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
            </div>
          )}
        </div>
      </div>

      <Dialog open={jsonOpen} onOpenChange={setJsonOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Advanced Model JSON</DialogTitle>
            <DialogDescription>
              用于编辑 Model 的完整配置。保存后会自动同步到当前模型。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={advancedJson}
            onChange={(e) => setAdvancedJson(e.target.value)}
            className="min-h-[420px] font-mono text-xs"
          />
          {jsonError && <p className="text-destructive text-xs">{jsonError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setJsonOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyAdvancedJson}>
              Apply JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
