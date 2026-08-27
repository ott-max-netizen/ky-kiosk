import type { RuntimeConfig } from "../config/config-schema";
import { endpointConfigured, tokenConfigured } from "../config/config-schema";
import { jsonpRequest } from "./jsonp";
import type { IncomingDashboardPayload } from "./types";
import { validateDashboardPayload } from "./validate";

export class ConfigurationError extends Error {}

export class AppsScriptClient {
  private controller: AbortController | null = null;

  constructor(private readonly config: RuntimeConfig) {}

  abort(): void {
    this.controller?.abort();
    this.controller = null;
  }

  private endpoint(): URL {
    if (!endpointConfigured(this.config))
      throw new ConfigurationError("Apps Scripti URL on seadistamata või vigane");
    if (!tokenConfigured(this.config)) throw new ConfigurationError("Feed'i token on seadistamata");
    const url = new URL(this.config.appsScriptUrl);
    url.searchParams.set("token", this.config.feedToken);
    url.searchParams.set("_", String(Date.now()));
    return url;
  }

  private async fetchJson(url: URL, timeoutMs = 20_000): Promise<unknown> {
    this.abort();
    const controller = new AbortController();
    this.controller = controller;
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
      if (this.controller === controller) this.controller = null;
    }
  }

  async load(): Promise<{ payload: IncomingDashboardPayload; problems: string[] }> {
    const endpoint = this.endpoint();
    let raw: unknown;
    try {
      raw = await this.fetchJson(new URL(endpoint.toString()));
    } catch (fetchError) {
      if (fetchError instanceof ConfigurationError) throw fetchError;
      // Kui fetch jõudis juba 20 s timeoutini, ei aita sama backendiga uus 20 s JSONP-katse.
      if (fetchError instanceof DOMException && fetchError.name === "AbortError")
        throw new Error("Sünkroonimise ajalimiit ületatud");
      raw = await jsonpRequest(new URL(endpoint.toString()), 20_000);
    }
    const validated = validateDashboardPayload(raw);
    if (!validated.value || validated.value.ok === false) {
      const message =
        raw && typeof raw === "object" && "error" in raw
          ? String((raw as { error?: unknown }).error)
          : "Vigane serverivastus";
      throw new Error(message);
    }
    return { payload: validated.value, problems: validated.problems };
  }
}
