import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SHEETS = ["Seaded", "Teated", "Kontaktid", "Avarii", "Prugivedu", "Elekter", "Maja"];
const COLUMNS = [
  "Võti",
  "Väärtus",
  "ID",
  "Pealkiri",
  "Tekst",
  "Tüüp",
  "Algus",
  "Lõpp",
  "Aktiivne",
  "Prioriteet",
  "Roll",
  "Nimi",
  "Telefon",
  "E-post",
  "Nimetus",
  "Märkus",
  "Jäätmeliik",
  "Kuupäev",
  "Sagedus",
  "Pakett",
  "Võimsus VMA2",
  "Hinnad käibemaksuta",
  "Aasta",
  "Kuu",
  "Veekulu m³",
  "Soojusetarbimine MWh",
  "Elektritarbimine kWh",
  "Päikesepaneelide tootlus kWh",
];

describe("Google Sheetsi skeem", () => {
  const source = ["Code.gs", "Sheets.gs"]
    .map((name) => readFileSync(new URL(`../../apps-script/${name}`, import.meta.url), "utf8"))
    .join("\n");
  it.each(SHEETS)("säilitab lehe %s", (name) => expect(source).toContain(name));
  it.each(COLUMNS)("säilitab veeru %s", (name) => expect(source).toContain(name));
  it("ei väljasta kontakti e-posti kliendile", () => {
    expect(source).not.toMatch(/contacts[^\n]{0,200}email/i);
  });
  // Kasutuses olev Maja leht on loodud kirjapildiga "Soojusetarbimine MWh".
  // Lugeja peab taluma ka õigekeelset "Soojustarbimine MWh" varianti, ilma et
  // setup() olemasoleva lehe veerunime muudaks (C-32).
  it("loeb soojusveergu mõlemas kirjapildis", () => {
    expect(source).toContain("Soojusetarbimine MWh");
    expect(source).toContain("Soojustarbimine MWh");
  });
  it("loob uue Maja lehe ajaloolise veerunimega", () => {
    const setupHeaders = source.match(/\['Aasta', 'Kuu',[^\]]*\]/);
    expect(setupHeaders?.[0]).toContain("Soojusetarbimine MWh");
    expect(setupHeaders?.[0]).not.toContain("'Soojustarbimine MWh'");
  });
});
