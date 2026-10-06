const SVG_NS = "http://www.w3.org/2000/svg";

export function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, name);
  patchAttributes(element, attributes);
  return element;
}

export function patchAttribute(element: Element, name: string, value: string | number): void {
  const text = String(value);
  if (element.getAttribute(name) !== text) element.setAttribute(name, text);
}

export function patchAttributes(element: Element, attributes: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(attributes)) patchAttribute(element, key, value);
}

/**
 * Graafiku teljesiltide fondi suurus SVG kasutajaühikutes. CSS-i `font-size` kehtib
 * SVG sees kasutajaühikutes ja skaleerub koos viewBox'iga, seega tuleb sildiruum
 * arvutada samades ühikutes. `getComputedStyle` ei vaja paigutust (ka peidetud SVG).
 */
export function chartFontSize(label: Element, fallback = 12.3): number {
  const size = Number.parseFloat(getComputedStyle(label).fontSize);
  return Number.isFinite(size) && size > 0 ? size : fallback;
}

/**
 * Konservatiivne numbrisildi laiuse hinnang ilma tekstimõõtmiseta (mõõtmine sunniks
 * paigutust ega töötaks peidetud kaardil). Tabelnumbrid ≈ 0,62 em, kirjavahemärgid ≈ 0,32 em.
 */
export function estimateLabelWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const char of text) em += /[.,:\s]/.test(char) ? 0.32 : 0.62;
  return em * fontSize;
}
