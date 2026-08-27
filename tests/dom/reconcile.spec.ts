// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { requireChildElement } from "../../src/ui/dom";
import { reconcileChildren, reconcileCount } from "../../src/ui/reconcile";
import { ContactsPanel } from "../../src/ui/panels/contacts";
import { EmergencyPanel } from "../../src/ui/panels/emergency";
import { HousePanel } from "../../src/ui/panels/house";
import { createFallbackData } from "../../src/data/merge";
import type { HouseMonth } from "../../src/domain/house/consumption";

function countCreated(run: () => void): number {
  const original = document.createElement.bind(document);
  let created = 0;
  document.createElement = ((...args: Parameters<typeof document.createElement>) => {
    created += 1;
    return original(...args);
  }) as typeof document.createElement;
  try {
    run();
  } finally {
    document.createElement = original;
  }
  return created;
}

describe("DOM child helper", () => {
  it("tagastab olemasoleva lapse ja annab puuduva skeleti korral selge vea", () => {
    const parent = document.createElement("div");
    const child = document.createElement("span");
    parent.appendChild(child);
    expect(requireChildElement(parent, 0)).toBe(child);
    expect(() => requireChildElement(parent, 1)).toThrow(/Puuduv DOM-alamelement/);
  });
});

describe("reconcileChildren", () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement("div");
  });

  it("creates only the missing rows and reuses the existing ones", () => {
    reconcileChildren(
      container,
      [1, 2, 3],
      () => document.createElement("span"),
      (element, item) => {
        element.textContent = String(item);
      },
    );
    expect(container.children).toHaveLength(3);
    const first = container.children[0];
    reconcileChildren(
      container,
      [4, 5, 6],
      () => document.createElement("span"),
      (element, item) => {
        element.textContent = String(item);
      },
    );
    expect(container.children).toHaveLength(3);
    // Sama sõlm, uus sisu — see ongi lepitaja mõte.
    expect(container.children[0]).toBe(first);
    expect(container.textContent).toBe("456");
  });

  it("removes the surplus when the list shrinks", () => {
    reconcileChildren(
      container,
      [1, 2, 3, 4, 5],
      () => document.createElement("span"),
      () => undefined,
    );
    reconcileChildren(
      container,
      [1, 2],
      () => document.createElement("span"),
      () => undefined,
    );
    expect(container.children).toHaveLength(2);
  });

  it("creates nothing when the list length is unchanged", () => {
    reconcileChildren(
      container,
      [1, 2, 3],
      () => document.createElement("span"),
      () => undefined,
    );
    const created = countCreated(() =>
      reconcileChildren(
        container,
        [7, 8, 9],
        () => document.createElement("span"),
        () => undefined,
      ),
    );
    expect(created).toBe(0);
  });

  it("keeps exactly the requested number of identical children", () => {
    reconcileCount(container, 4, () => document.createElement("i"));
    expect(container.children).toHaveLength(4);
    reconcileCount(container, 2, () => document.createElement("i"));
    expect(container.children).toHaveLength(2);
    const created = countCreated(() => reconcileCount(container, 2, () => document.createElement("i")));
    expect(created).toBe(0);
  });
});

describe("roteeruvad paneelid ei ehita DOM-i uuesti", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="contactsArea"></div><div id="contactsPageLabel"></div>
      <div id="emergencyArea"></div><div id="emergencyPageLabel"></div>
      <div id="houseArea"></div><div id="housePeriod"></div><div id="houseViewIndicator"></div>
      <div id="houseStale"></div>`;
  });

  it("ContactsPanel ei loo lehekülge vahetades uusi elemente", () => {
    const panel = new ContactsPanel();
    const items = Array.from({ length: 12 }, (_, index) => ({
      role: `Roll ${index}`,
      name: `Nimi ${index}`,
      phone: `+372 500 ${index}`,
    }));
    panel.update({ items, pageSize: 5, nowMs: 0, rotationMs: 1_000 });
    const before = document.querySelectorAll("#contactsArea *").length;
    const firstCard = document.querySelector("#contactsArea .contact-card");
    const created = countCreated(() => panel.tick(new Date(5_000)));
    expect(created).toBe(0);
    expect(document.querySelectorAll("#contactsArea *").length).toBe(before);
    expect(document.querySelector("#contactsArea .contact-card")).toBe(firstCard);
    expect(document.querySelector("#contactsArea .contact-primary")?.textContent).toBe("Nimi 5");
  });

  it("EmergencyPanel märgib 112 esmaseks ja ei loo pöördel elemente", () => {
    const panel = new EmergencyPanel();
    const items = Array.from({ length: 9 }, (_, index) => ({
      name: index === 0 ? "Hädaabi" : `Kontakt ${index}`,
      phone: index === 0 ? "112" : `+372 510 ${index}`,
      note: "Märkus",
      priority: index + 1,
    }));
    panel.update({ items, pageSize: 5, nowMs: 0, rotationMs: 1_000 });
    expect(document.querySelector(".contact-card-emergency-primary")).not.toBeNull();
    const created = countCreated(() => panel.tick(new Date(5_000)));
    expect(created).toBe(0);
    // Teisel leheküljel ei ole 112, nii et eriklass peab olema eemaldatud.
    expect(document.querySelector(".contact-card-emergency-primary")).toBeNull();
  });

  it("HousePanel läbib kolm vaadet ilma uusi elemente loomata pärast esimest tsüklit", () => {
    const panel = new HousePanel();
    const months: HouseMonth[] = Array.from({ length: 12 }, (_, index) => ({
      year: 2026,
      month: index + 1,
      monthName: `Kuu ${index + 1}`,
      key: `2026-${String(index + 1).padStart(2, "0")}`,
      waterM3: 200 + index,
      heatMWh: 40 - index,
      electricityKWh: 4000 - index * 100,
      solarKWh: index * 5,
    }));
    const data = createFallbackData();
    data.house = { months };
    panel.update({ data, timeZone: "Europe/Tallinn" });

    // Esimene täistsükkel ehitab kõik kolm vaadet ja jätab need alles.
    // Kasutame päris epohhi lähedast baashetke, sest paneel planeerib esimese
    // vahetuse Date.now() suhtes. 1970-01-01 väärtustega test ei tõestaks rotatsiooni.
    const base = Date.now();
    for (let step = 1; step <= 3; step += 1) panel.tick(new Date(base + step * 9_000));
    const created = countCreated(() => {
      for (let step = 4; step <= 12; step += 1) panel.tick(new Date(base + step * 9_000));
    });
    expect(created).toBe(0);
    expect(document.querySelectorAll("#houseArea .house-view")).toHaveLength(1);
    expect(document.querySelectorAll("#houseViewIndicator .house-view-dot")).toHaveLength(3);
  });

  it("HousePanel vabastab osuti alla jäänud pausi ise", () => {
    const panel = new HousePanel();
    const data = createFallbackData();
    data.house = {
      months: [
        {
          year: 2026,
          month: 1,
          monthName: "Jaanuar",
          key: "2026-01",
          waterM3: 1,
          heatMWh: 1,
          electricityKWh: 1,
          solarKWh: 1,
        },
      ],
    };
    panel.update({ data, timeZone: "Europe/Tallinn" });
    document.getElementById("houseArea")?.dispatchEvent(new Event("pointerenter"));
    const activeBefore = [...document.querySelectorAll("#houseViewIndicator .house-view-dot")].findIndex(
      (dot) => dot.classList.contains("is-active"),
    );
    // Ilma pausi ülempiirita jääks rotatsioon siia igaveseks seisma (C-19).
    panel.tick(new Date(Date.now() + 120_000));
    panel.tick(new Date(Date.now() + 140_000));
    const activeAfter = [...document.querySelectorAll("#houseViewIndicator .house-view-dot")].findIndex(
      (dot) => dot.classList.contains("is-active"),
    );
    expect(activeAfter).not.toBe(activeBefore);
  });
});
