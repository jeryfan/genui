import { createModels, createProvider } from "@jeryfan/ai";
import { builtinProviders } from "@jeryfan/ai/providers/all";
import type { Api, Model } from "@jeryfan/ai";
import type { ModelConfig } from "./types";

const BUILTIN_PROVIDERS = builtinProviders();

export function getEndpointId(config: Pick<ModelConfig, "provider" | "id">): string {
  return `${config.provider}-${config.id}`;
}

export function getModelRuntimeKey(model: Pick<Model<Api>, "provider" | "id">): string {
  return `${encodeURIComponent(model.provider)}:${encodeURIComponent(model.id)}`;
}

export function getModelConfigRuntimeKey(
  config: Pick<ModelConfig, "provider" | "id">,
): string {
  return getModelRuntimeKey({
    provider: getEndpointId(config),
    id: config.id,
  });
}

export function findModelByRuntimeKey(
  models: readonly Model<Api>[],
  key: string | undefined,
): Model<Api> | undefined {
  if (!key) return undefined;
  return models.find((model) => getModelRuntimeKey(model) === key);
}

function createStaticApiKeyAuth(name: string, apiKey: string) {
  return {
    name,
    resolve: async () =>
      apiKey
        ? {
            auth: { apiKey },
            source: name,
          }
        : undefined,
  };
}

function modelConfigToRuntimeModel(config: ModelConfig): Model<Api> {
  const { apiKey: _apiKey, ...model } = config;

  return {
    ...model,
    name: model.name || model.id,
    provider: getEndpointId(config),
    input: [...model.input],
    cost: { ...model.cost },
    thinkingLevelMap: model.thinkingLevelMap
      ? { ...model.thinkingLevelMap }
      : undefined,
    headers: model.headers ? { ...model.headers } : undefined,
    compat: model.compat ? ({ ...model.compat } as Model<Api>["compat"]) : undefined,
  };
}

export function createModelsFromConfigs(configs: ModelConfig[]) {
  const models = createModels();

  for (const config of configs) {
    const source = BUILTIN_PROVIDERS.find(
      (provider) => provider.id === config.provider,
    );

    if (!source) {
      throw new Error(`Unknown provider: ${config.provider}`);
    }

    models.setProvider(
      createProvider({
        id: getEndpointId(config),
        name: source.name,
        baseUrl: config.baseUrl,
        auth: {
          apiKey: createStaticApiKeyAuth(`${source.name} API Key`, config.apiKey),
        },
        models: [modelConfigToRuntimeModel(config)],
        api: source,
      }),
    );
  }

  return models;
}
