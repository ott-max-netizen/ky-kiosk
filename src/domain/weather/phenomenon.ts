export const WEATHER_PHENOMENON_TRANSLATIONS: Readonly<Record<string, string>> = {
  clear: "Selge",
  "few clouds": "Vähene pilvisus",
  "variable clouds": "Vahelduv pilvisus",
  "cloudy with clear spells": "Pilves selgimistega",
  cloudy: "Pilves",
  "light snow shower": "Nõrk hooglumi",
  "moderate snow shower": "Mõõdukas hooglumi",
  "heavy snow shower": "Tugev hooglumi",
  "light shower": "Nõrk hoogvihm",
  "moderate shower": "Mõõdukas hoogvihm",
  "heavy shower": "Tugev hoogvihm",
  "light rain": "Nõrk vihm",
  "moderate rain": "Mõõdukas vihm",
  "heavy rain": "Tugev vihm",
  "risk of glaze": "Jäiteoht",
  glaze: "Jäide",
  "light sleet": "Nõrk lörtsisadu",
  "moderate sleet": "Mõõdukas lörtsisadu",
  "heavy sleet": "Tugev lörtsisadu",
  "light snowfall": "Nõrk lumesadu",
  "moderate snowfall": "Mõõdukas lumesadu",
  "heavy snowfall": "Tugev lumesadu",
  snowstorm: "Üldtuisk",
  "blowing snow": "Üldtuisk",
  "drifting snow": "Pinnatuisk",
  hail: "Rahe",
  mist: "Uduvine",
  fog: "Udu",
  thunder: "Äike",
  thunderstorm: "Äikesevihm",
  "light freezing rain": "Nõrk jäävihm",
  "moderate freezing rain": "Mõõdukas jäävihm",
  "heavy freezing rain": "Tugev jäävihm",
  "freezing rain": "Jäävihm",
};

const ESTONIAN_VALUES = new Set(Object.values(WEATHER_PHENOMENON_TRANSLATIONS).map((value) => normalizePhenomenon(value)));

export function normalizePhenomenon(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("et-EE").replace(/[^a-z0-9õäöüšž]+/g, " ").trim();
}

export function weatherPhenomenonEt(value: unknown): string {
  const key = normalizePhenomenon(value);
  if (!key) return "";
  const translated = WEATHER_PHENOMENON_TRANSLATIONS[key];
  if (translated) return translated;
  if (ESTONIAN_VALUES.has(key)) {
    const text = String(value ?? "").trim();
    return text.charAt(0).toLocaleUpperCase("et-EE") + text.slice(1);
  }
  return /^[a-z0-9 ]+$/.test(key) ? "" : String(value ?? "").trim();
}
