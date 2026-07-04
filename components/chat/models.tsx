import { createModelsWithEndpoints } from "@jeryfan/ai"


export const models = createModelsWithEndpoints([
  {
    id: "kimi",
    provider: "kimi-coding",
    baseUrl: "https://api.kimi.com/coding",
    apiKey: "sk-kimi-Hub9crXvNE2tMoaf7wzOhTlbkt2fPe0hqqAmiYJrQpSXIZdgSRfVtewfsjVNFJ11",
    modelIds: ["kimi-for-coding"]
  },
])


export const AI_MODELS = models.getModels()


export const DEFAULT_AI_MODEL = AI_MODELS[0]

