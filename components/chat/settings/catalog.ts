import { builtinProviders } from "@jeryfan/ai/providers/all";
import type { Api, Model, ProviderId } from "@jeryfan/ai";
import type { ModelConfig } from "./types";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

const API_LABELS: Record<string, string> = {
  "openai-completions": "OpenAI Completions",
  "openai-responses": "OpenAI Responses",
  "anthropic-messages": "Anthropic Messages",
  "mistral-conversations": "Mistral Conversations",
  "azure-openai-responses": "Azure OpenAI Responses",
  "google-generative-ai": "Google Generative AI",
  "google-vertex": "Google Vertex",
};

const API_ORDER = Object.keys(API_LABELS);
const PROVIDERS = builtinProviders();

function compareApi(a: string, b: string) {
  const aIndex = API_ORDER.indexOf(a);
  const bIndex = API_ORDER.indexOf(b);

  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
      (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  }

  return a.localeCompare(b);
}

function cloneModelForConfig(model: Model<Api>, apiKey = ""): ModelConfig {
  return {
    ...model,
    input: [...model.input],
    cost: { ...model.cost },
    thinkingLevelMap: model.thinkingLevelMap
      ? { ...model.thinkingLevelMap }
      : undefined,
    headers: model.headers ? { ...model.headers } : undefined,
    compat: model.compat ? ({ ...model.compat } as ModelConfig["compat"]) : undefined,
    apiKey,
  };
}

export function getApiLabel(api: Api): string {
  return API_LABELS[api] ?? api;
}

export function getApiOptions(): SelectOption<Api>[] {
  const apis = new Set<Api>();

  for (const provider of PROVIDERS) {
    for (const model of provider.getModels()) {
      apis.add(model.api);
    }
  }

  return Array.from(apis)
    .sort(compareApi)
    .map((api) => ({ value: api, label: getApiLabel(api) }));
}

export function getProvidersForApi(api: Api) {
  return PROVIDERS.filter((provider) =>
    provider.getModels().some((model) => model.api === api),
  );
}

export function getProviderOptionsForApi(api: Api): SelectOption<ProviderId>[] {
  return getProvidersForApi(api).map((provider) => ({
    value: provider.id,
    label: provider.name,
  }));
}

export function getProviderLabel(providerId: ProviderId): string {
  return PROVIDERS.find((provider) => provider.id === providerId)?.name ?? providerId;
}

export function getModelsForProviderApi(
  providerId: ProviderId,
  api: Api,
): Model<Api>[] {
  return (
    PROVIDERS.find((provider) => provider.id === providerId)
      ?.getModels()
      .filter((model) => model.api === api) ?? []
  );
}

export function getModelOptionsForProviderApi(
  providerId: ProviderId,
  api: Api,
): SelectOption[] {
  return getModelsForProviderApi(providerId, api).map((model) => ({
    value: model.id,
    label: `${model.name} (${model.id})`,
  }));
}

export function findCatalogModel(
  providerId: ProviderId,
  api: Api,
  modelId: string,
): Model<Api> | undefined {
  return getModelsForProviderApi(providerId, api).find(
    (model) => model.id === modelId,
  );
}

export function getFirstApi(): Api {
  const [firstApi] = getApiOptions();
  if (!firstApi) {
    throw new Error("No built-in AI APIs are available");
  }
  return firstApi.value;
}

export function getFirstProviderForApi(api: Api): ProviderId {
  const [firstProvider] = getProvidersForApi(api);
  if (!firstProvider) {
    throw new Error(`No providers support API: ${api}`);
  }
  return firstProvider.id;
}

export function getFirstModelForProviderApi(
  providerId: ProviderId,
  api: Api,
): Model<Api> {
  const [firstModel] = getModelsForProviderApi(providerId, api);
  if (!firstModel) {
    throw new Error(`No models for provider ${providerId} and API ${api}`);
  }
  return firstModel;
}

export function createModelConfigFromCatalog({
  api,
  provider,
  modelId,
  apiKey = "",
  baseUrl,
}: {
  api: Api;
  provider?: ProviderId;
  modelId?: string;
  apiKey?: string;
  baseUrl?: string;
}): ModelConfig {
  const providerId = provider ?? getFirstProviderForApi(api);
  const model =
    (modelId ? findCatalogModel(providerId, api, modelId) : undefined) ??
    getFirstModelForProviderApi(providerId, api);
  const config = cloneModelForConfig(model, apiKey);

  return {
    ...config,
    baseUrl: baseUrl ?? model.baseUrl,
  };
}

export function createDefaultModelConfig(apiKey = ""): ModelConfig {
  const api = getFirstApi();
  return createModelConfigFromCatalog({ api, apiKey });
}
