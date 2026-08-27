import type { DashboardData, IncomingDashboardPayload, SectionName, SectionVersions } from "./types";
import { SECTION_NAMES } from "./types";

export function createFallbackData(timeZone = "Europe/Tallinn"): DashboardData {
  return {
    ok: true,
    updatedAt: null,
    sections: {},
    sectionUpdatedAt: {},
    sectionErrors: {},
    sectionWarnings: {},
    settings: {
      buildingName: "KÜ Kauge 32 infoekraan",
      buildingAddress: "",
      weatherLocation: "Viljandi",
      timeZone,
    },
    notices: [
      {
        id: "start",
        title: "Infoekraan on valmis seadistamiseks",
        body: "Lisa Google Sheetsi teated, kontaktid, avariinumbrid ja prügiveo andmed. Viimased head andmed jäävad võrguühenduse katkemisel nähtavaks.",
        type: "info",
        priority: 1,
        start: null,
        end: null,
      },
    ],
    contacts: [],
    emergency: [{ name: "Hädaabi", phone: "112", note: "Elu, tervise või vara vahetu oht", priority: 1 }],
    waste: [],
    weather: null,
    house: null,
    electricity: null,
    fuel: null,
    euribor: null,
  };
}

export function createSectionVersions(): SectionVersions {
  return {
    settings: 0,
    notices: 0,
    contacts: 0,
    emergency: 0,
    waste: 0,
    weather: 0,
    house: 0,
    electricity: 0,
    fuel: 0,
    euribor: 0,
    status: 0,
  };
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => deepEqual(value, right[index]));
  }
  if (typeof left === "object") {
    if (Array.isArray(right)) return false;
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(rightRecord, key) &&
        deepEqual(leftRecord[key], rightRecord[key]),
    );
  }
  return false;
}

function withChangedVersion(
  versions: SectionVersions,
  key: keyof SectionVersions,
  changed: boolean,
): SectionVersions {
  if (!changed) return versions;
  return { ...versions, [key]: versions[key] + 1 };
}

export interface MergeResult {
  data: DashboardData;
  versions: SectionVersions;
  changed: Set<keyof SectionVersions>;
}

export function mergeIncoming(
  previous: DashboardData | null,
  incoming: IncomingDashboardPayload,
  previousVersions: SectionVersions = createSectionVersions(),
  now = new Date(),
): MergeResult {
  const base = previous ?? createFallbackData(incoming.settings?.timeZone);
  let versions = previousVersions;
  const changed = new Set<keyof SectionVersions>();
  let settings = base.settings;
  if (incoming.settings && !deepEqual(base.settings, incoming.settings)) {
    settings = incoming.settings;
    versions = withChangedVersion(versions, "settings", true);
    changed.add("settings");
  }

  const next = {
    ...base,
    ok: true,
    updatedAt: incoming.updatedAt ?? now.toISOString(),
    cachedAt: now.toISOString(),
    settings,
    sections: { ...base.sections, ...incoming.sections },
    sectionUpdatedAt: { ...base.sectionUpdatedAt },
    sectionErrors: {} as DashboardData["sectionErrors"],
    sectionWarnings: {} as DashboardData["sectionWarnings"],
  } satisfies DashboardData;

  for (const name of SECTION_NAMES) {
    const meta = incoming.sections[name];
    const hasPayload = Object.prototype.hasOwnProperty.call(incoming, name);
    const successful = meta ? meta.ok === true && meta.missing !== true : hasPayload;
    if (successful && hasPayload) {
      const payload = incoming[name] as DashboardData[SectionName];
      if (!deepEqual(base[name], payload)) {
        (next as unknown as Record<string, unknown>)[name] = payload;
        versions = withChangedVersion(versions, name, true);
        changed.add(name);
      }
      next.sectionUpdatedAt[name] = meta?.updatedAt ?? incoming.updatedAt ?? now.toISOString();
    } else {
      if (meta?.error) next.sectionErrors[name] = meta.error;
      else if (meta?.missing) next.sectionErrors[name] = "Google Sheetsi leht puudub";
    }
    if (meta?.warnings?.length) next.sectionWarnings[name] = [...meta.warnings];
  }

  const statusChanged =
    !deepEqual(base.sectionErrors, next.sectionErrors) ||
    !deepEqual(base.sectionWarnings, next.sectionWarnings) ||
    !deepEqual(base.sectionUpdatedAt, next.sectionUpdatedAt) ||
    base.updatedAt !== next.updatedAt;
  if (statusChanged) {
    versions = withChangedVersion(versions, "status", true);
    changed.add("status");
  }
  return { data: next, versions, changed };
}
