import assert from "node:assert/strict";
import {
  createModelConfigFromCatalog,
  getModelsForProviderApi,
  getProvidersForApi,
} from "../components/chat/settings/catalog.ts";
import {
  createModelsFromConfigs,
  getModelRuntimeKey,
} from "../components/chat/settings/models.ts";
import type { ModelConfig } from "../components/chat/settings/types.ts";

function testFiltersProvidersByApi() {
  const anthropicProviders = getProvidersForApi("anthropic-messages").map(
    (provider) => provider.id,
  );

  assert.ok(anthropicProviders.includes("kimi-coding"));
  assert.ok(!anthropicProviders.includes("openai"));
}

function testCreatesDefaultModelConfigFromSelectedApiProvider() {
  const [firstKimiModel] = getModelsForProviderApi(
    "kimi-coding",
    "anthropic-messages",
  );
  const config = createModelConfigFromCatalog({
    api: "anthropic-messages",
    provider: "kimi-coding",
    apiKey: "sk-test",
  });

  assert.equal(config.id, firstKimiModel.id);
  assert.equal(config.name, firstKimiModel.name);
  assert.equal(config.api, "anthropic-messages");
  assert.equal(config.provider, "kimi-coding");
  assert.equal(config.baseUrl, firstKimiModel.baseUrl);
  assert.equal(config.apiKey, "sk-test");
}

function testRuntimeModelKeyUsesProviderAndModelId() {
  const configs: ModelConfig[] = [
    createModelConfigFromCatalog({
      api: "openai-responses",
      provider: "openai",
      modelId: "gpt-4",
      apiKey: "sk-openai",
    }),
    createModelConfigFromCatalog({
      api: "azure-openai-responses",
      provider: "azure-openai-responses",
      modelId: "gpt-4",
      apiKey: "sk-azure",
    }),
  ];

  const models = createModelsFromConfigs(configs).getModels();
  const keys = models.map(getModelRuntimeKey);

  assert.equal(new Set(keys).size, models.length);
}

function testCreateModelsPreservesFullModelMetadata() {
  const headers = { "x-test-header": "1" };
  const config: ModelConfig = {
    ...createModelConfigFromCatalog({
      api: "openai-completions",
      provider: "github-copilot",
      modelId: "gpt-4.1",
      apiKey: "gh-test",
    }),
    headers,
  };

  const [model] = createModelsFromConfigs([config]).getModels();

  assert.deepEqual(model.headers, headers);
}

testFiltersProvidersByApi();
testCreatesDefaultModelConfigFromSelectedApiProvider();
testRuntimeModelKeyUsesProviderAndModelId();
testCreateModelsPreservesFullModelMetadata();

console.log("settings model tests passed");
