import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "../../src/config/config-schema";
import { createFallbackData, createSectionVersions, mergeIncoming } from "../../src/data/merge";
import { validateDashboardPayload } from "../../src/data/validate";

describe("data layer", () => {
  it("keeps last-known-good when a sheet is missing", () => {
    const previous = createFallbackData();
    previous.contacts = [{ role: "Juhatus", name: "Mari", phone: "5000000" }];
    const result = mergeIncoming(
      previous,
      {
        ok: true,
        updatedAt: "2026-08-25T10:00:00.000Z",
        sections: { contacts: { ok: false, missing: true, error: "Leht puudub" } },
      },
      createSectionVersions(),
    );
    expect(result.data.contacts).toEqual(previous.contacts);
    expect(result.data.sectionErrors.contacts).toBe("Leht puudub");
  });

  it("accepts an explicitly empty successful sheet", () => {
    const previous = createFallbackData();
    previous.contacts = [{ role: "Juhatus", name: "Mari", phone: "5000000" }];
    const result = mergeIncoming(previous, {
      ok: true,
      updatedAt: "2026-08-25T10:00:00.000Z",
      sections: { contacts: { ok: true } },
      contacts: [],
    });
    expect(result.data.contacts).toEqual([]);
    expect(result.versions.contacts).toBe(1);
  });

  it("does not increment a section version for identical data", () => {
    const previous = createFallbackData();
    const result = mergeIncoming(previous, {
      ok: true,
      updatedAt: "2026-08-25T10:00:00.000Z",
      sections: { contacts: { ok: true } },
      contacts: previous.contacts,
    });
    expect(result.versions.contacts).toBe(0);
  });

  it("rejects electricity without an explicit unit", () => {
    const result = validateDashboardPayload({
      ok: true,
      sections: { electricity: { ok: true } },
      electricity: { date: "2026-08-25", points: [{ time: "2026-08-25T00:00:00.000Z", price: 3 }] },
    });
    expect(result.value?.electricity).toBeUndefined();
    expect(result.problems.join(" ")).toContain("ühik");
  });

  it("removes contact e-mail from validated client data", () => {
    const result = validateDashboardPayload({
      ok: true,
      sections: { contacts: { ok: true } },
      contacts: [{ role: "Juhatus", name: "Mari", phone: "5000000", email: "private@example.test" }],
    });
    expect(result.value?.contacts?.[0]).toEqual({ role: "Juhatus", name: "Mari", phone: "5000000" });
  });

  it("clamps runtime limits to their contracts", () => {
    const config = parseRuntimeConfig({ maxContacts: 99, maxEmergency: -2, maxWaste: 5 });
    expect(config.maxContacts).toBe(8);
    expect(config.maxEmergency).toBe(1);
    expect(config.maxWaste).toBe(5);
  });
});
