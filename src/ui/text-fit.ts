import type { Notice } from "../data/types";

export interface NoticePage {
  text: string;
  fontPx: number;
}

interface CacheEntry {
  pages: NoticePage[];
}

const CACHE_LIMIT = 32;
const cache = new Map<string, CacheEntry>();

function keyFor(notice: Notice, width: number, height: number): string {
  return `${notice.id}|${Math.round(width)}x${Math.round(height)}|${notice.title}|${notice.body}`;
}

function readCache(key: string): NoticePage[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  cache.delete(key);
  cache.set(key, entry);
  return entry.pages;
}

function writeCache(key: string, pages: NoticePage[]): void {
  cache.delete(key);
  cache.set(key, { pages });
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

function cssLengthPx(variableName: string, fallbackPx: number): number {
  const rootStyle = getComputedStyle(document.documentElement);
  const raw = rootStyle.getPropertyValue(variableName).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallbackPx;
  if (raw.endsWith("rem")) {
    const rootPx = Number.parseFloat(rootStyle.fontSize);
    return Number.isFinite(rootPx) ? value * rootPx : fallbackPx;
  }
  if (raw.endsWith("px")) return value;
  return fallbackPx;
}

export function clearNoticeFitCache(): void {
  cache.clear();
}

function fits(clone: HTMLElement): boolean {
  return clone.scrollHeight <= clone.clientHeight + 1;
}

function paginate(body: HTMLElement, clone: HTMLElement, text: string, fontPx: number): NoticePage[] {
  body.style.fontSize = `${fontPx}px`;
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [{ text: "", fontPx }];

  const pages: NoticePage[] = [];
  let start = 0;
  while (start < words.length && pages.length < 30) {
    let low = start + 1;
    let high = words.length;
    let best = start;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      body.textContent = words.slice(start, mid).join(" ");
      if (fits(clone)) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    if (best <= start) return [];
    pages.push({ text: words.slice(start, best).join(" "), fontPx });
    start = best;
  }
  if (start < words.length && pages.length) pages[pages.length - 1]!.text += " …";
  return pages;
}

export function fitNoticeToPages(
  notice: Notice,
  sourceCard: HTMLElement,
  sourceBody: HTMLElement,
): NoticePage[] {
  const rect = sourceCard.getBoundingClientRect();
  const width = Math.max(1, rect.width || sourceCard.clientWidth);
  const height = Math.max(1, rect.height || sourceCard.clientHeight);
  const key = keyFor(notice, width, height);
  const cached = readCache(key);
  if (cached) return cached;

  const clone = sourceCard.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.style.position = "fixed";
  clone.style.left = "-10000px";
  clone.style.top = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.visibility = "hidden";
  clone.style.pointerEvents = "none";
  const body = clone.querySelector<HTMLElement>(".notice-body");
  if (!body) return [{ text: notice.body, fontPx: cssLengthPx("--fs-b", 23) }];
  body.textContent = notice.body;
  document.body.appendChild(clone);

  const basePx = Number.parseFloat(getComputedStyle(sourceBody).fontSize) || cssLengthPx("--fs-b", 23);
  const minimumPx = cssLengthPx("--fs-b", 23);
  const candidates = [basePx, Math.max(minimumPx, basePx * 0.94), Math.max(minimumPx, basePx * 0.88)].filter(
    (value, index, values) => values.findIndex((other) => Math.abs(other - value) < 0.1) === index,
  );

  let pages: NoticePage[] = [];
  try {
    // Eelista alati loetavat lehekülgedeks jagamist. Väiksemat kirja kasutatakse
    // ainult siis, kui isegi üks sõna ei mahu baassuuruses olemasolevasse kasti.
    const baseFontPx = Math.max(minimumPx, candidates[0] ?? basePx);
    body.style.fontSize = `${baseFontPx}px`;
    body.textContent = notice.body;
    if (fits(clone)) {
      pages = [{ text: notice.body, fontPx: baseFontPx }];
    } else {
      pages = paginate(body, clone, notice.body, baseFontPx);
    }

    if (!pages.length) {
      for (const candidate of candidates.slice(1)) {
        const fontPx = Math.max(minimumPx, candidate);
        pages = paginate(body, clone, notice.body, fontPx);
        if (pages.length) break;
      }
    }
  } finally {
    clone.remove();
  }

  if (!pages.length) pages = [{ text: notice.body, fontPx: minimumPx }];
  writeCache(key, pages);
  return pages;
}
