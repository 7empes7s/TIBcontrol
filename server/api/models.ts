import { getModelsDetail } from "../adapters/models.ts";
import { ok, type ApiEnvelope, type ModelsDetail } from "./types.ts";

export function modelsHandler(): Response {
  const detail = getModelsDetail();

  const data: ModelsDetail = {
    models: detail.models,
    cooldowns: detail.cooldowns,
    fallbacks: detail.fallbacks,
    summary: detail.summary,
    discoveryLog: detail.discoveryLog,
  };

  const envelope: ApiEnvelope<ModelsDetail> = ok(data, { models: "ok" });
  return new Response(JSON.stringify(envelope), { headers: { "Content-Type": "application/json" } });
}
