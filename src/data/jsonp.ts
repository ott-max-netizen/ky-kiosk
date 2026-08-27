const CALLBACK_PATTERN = /^kuInfoCallback_[0-9A-Za-z_]+$/;

export function jsonpRequest(url: URL, timeoutMs = 20_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const callback = `kuInfoCallback_${Date.now()}_${Math.floor(Math.random() * 100_000)}`;
    if (!CALLBACK_PATTERN.test(callback)) {
      reject(new Error("Vigane JSONP callback nimi"));
      return;
    }
    const script = document.createElement("script");
    let settled = false;
    const cleanup = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        delete (window as unknown as Record<string, unknown>)[callback];
      } catch {
        (window as unknown as Record<string, unknown>)[callback] = undefined;
      }
      script.remove();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = window.setTimeout(() => cleanup(new Error("Sünkroonimise ajalimiit ületatud")), timeoutMs);
    (window as unknown as Record<string, unknown>)[callback] = (data: unknown) => cleanup(undefined, data);
    script.onerror = () => cleanup(new Error("Apps Scripti JSONP-varuühendus ebaõnnestus"));
    script.referrerPolicy = "no-referrer";
    url.searchParams.set("callback", callback);
    url.searchParams.set("_", String(Date.now()));
    script.src = url.toString();
    document.head.appendChild(script);
  });
}

export { CALLBACK_PATTERN };
