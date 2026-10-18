# KÜ infoekraan 4.5.0

Windowsi ja Microsoft Edge'i kioskirežiimis töötav korteriühistu infoekraan 27-tollisele 1920 × 1080 ekraanile. Kasutajaliides on eesti keeles, ajavöönd on `Europe/Tallinn` ja kogu staatiline rakendus töötab kohalikust veebiserverist ka internetiühenduseta.

Versioon 4.5.0 parandab päris Chromiumi ekraanipiltidelt leitud loetavusvead (ööteema kontrast, graafikute teljed, kuupäevad) ja lisab pikslitest sõltumatu paigutusauditi. 4.4.0 jätkas 4.3.0 mõõdetud paneeliarhitektuuri: renderdus patchib olemasolevat DOM-i, `Panel<T>` leping sisaldab ka valikulist ajapõhist `tick(now: Date)` elutsüklit ning release-värav sisaldab masinloetavat 24 h jõudluseelarvet. Google Sheetsi skeem, IndexedDB vahemälu, JSONP varuvariant ja Windowsi kioskiskriptid jäävad alles.

## Põhiomadused

- raamistikuta TypeScripti ES-moodulid ja **0 runtime-sõltuvust**;
- paneelid kasutavad `mount()` / `update()` / valikulist `tick()` / `destroy()` elutsüklit;
- üks keskne ajastaja: ainus `setInterval` asub failis `src/app/scheduler.ts`;
- sektsioonipõhine last-known-good IndexedDB vahemälu;
- fetch esmane, rangelt piiratud JSONP varuvariant;
- kohalik Kauge peatuse bussisõiduplaan, Eesti riigipühade arvestus ja offline-töö;
- korduv prügivedu, elektri ostuhind koos tariifidega, ilm, maja tarbimine, kütusehinnad ja Euribor;
- automaatne ööteema, pikslinihe, 04:10 hooldusreload ja järelevalve;
- Vite 8 / TypeScript 7 / Vitest / Playwright / oxlint / Biome arendustööriistad;
- valmis `dist/` kaust, mida saab kioskimasinasse paigaldada ilma Node.js-ita.

## Kaustad

```text
index.html
package.json
public/                 demoandmed; runtime-config jääb juurkausta `config.js` faili
src/app/                bootstrap, store, scheduler, lifecycle
src/config/             runtime-configi valideerimine
src/domain/             puhas ajatsoonist sõltuv äriloogika
src/data/               tüübid, valideerimine, transport ja merge
src/cache/              IndexedDB repository
src/ui/                 paneelid, graafikud ja teksti sobitamine
src/styles/             tokenid, paigutus, ööteema ja paneelide CSS
src/diagnostics/        logimine
src/ui/debug-overlay.ts silumisülekatte UI
tests/                  unit-, contract-, integration-, DOM- ja E2E-testid
apps-script/            Google Apps Scripti failid
kiosk/                  Windowsi server, käivitus ja watchdog
docs/                   runbook, lepingud ja mõõdetud lähtetase
dist/                   kioskisse paigaldatav valmis build
```

## Arendus

Nõuded: Node.js 22 või uuem ja npm.

```bash
npm install
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
npm run test:visual
```

`npm run test:visual` sisaldab ka `tests/e2e/layout-audit.spec.ts` auditit (WCAG kontrast,
poolikuks lõigatud tekst, viewBox'ist väljuvad SVG sildid, tühjad kuupäevaväljad). See ei
sõltu PNG-baseline'ist ega fontidest ja peab läbima igas Chromiumis; ainult audit:

```bash
npx playwright test tests/e2e/layout-audit.spec.ts
```

`package-lock.json` on versioonihalduses. Reprodutseeritava paigalduse jaoks kasuta tavapäraselt `npm ci`; `npm install` on vajalik ainult sõltuvuste teadlikul uuendamisel.

Isolatsiooniga keskkonna jaoks on kaasas varuehitus, mis käivitab projekti lukustatud kohaliku TypeScripti `tsc` CLI (`node_modules/typescript/lib/tsc.js`) ilma Vite runtime'ita:

```bash
npm run build:fallback
npm run preflight
```

Varuehitus ei asenda Vite kvaliteediväravat, kuid võimaldab genereerida ja kontrollida kioskisse paigaldatavat `dist/` kausta ka siis, kui npm registrile puudub ligipääs.

## Jõudluse mõõtmine

```bash
npm run measure:check
```

Käivitab rakenduse päris Chromiumis 1920 × 1080 juures kiirendatud kellaga ja
raporteerib bundle'i mahud, esimese täisrenderduse aja, DOM- ja SVG-sõlmede arvu,
loodud elementide arvu, sunnitud reflow'd, kuulajad ja JS-kuhja. `measure:check`
kukub läbi, kui 24 h jooksul luuakse üle 1000 HTML- või üle 200 SVG-elemendi.
`node tools/measure.mjs --hours 24 --json fail.json` salvestab toorandmed. Kui brauser on juba masinas olemas, saab selle ette anda
muutujaga `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; sama muutuja kehtib ka
`npm run test:visual` jaoks.

Mõõdetud tulemused on `docs/baseline.md` failis.

## Runtime-config

`config.js` ei kompileerita rakenduse moodulitesse. Kioskiserver serveerib projekti juurkaustas olevat `config.js` faili eraldi ning buildi vahetamine seda ei kirjuta üle.

Kopeeri väärtused failist `config.example.js` juurkausta `config.js` ja määra vähemalt:

```js
window.KU_CONFIG = {
  appsScriptUrl: "https://script.google.com/macros/s/.../exec",
  feedToken: "...",
  scale: 0.82,
  refreshMinutes: 5,
  noticeRotationSeconds: 14,
  listRotationSeconds: 18,
  maxContacts: 5,
  maxEmergency: 5,
  maxWaste: 5,
  wasteWindowDays: 30,
  timeZone: "Europe/Tallinn",
  nightThemeStartHour: 22,
  nightThemeEndHour: 6,
  nightlyReloadHour: 4,
  nightlyReloadMinute: 10,
  buildVersion: "4.5.0",
  buildDate: "2026-10-06"
};
```

Ära lisa päris URL-i ega tokenit `src/`, `public/` ega versioonihaldusse. `config.js` on `.gitignore`-s; versioonihalduses on ainult `config.example.js`.

## Google Sheetsi leping

Lehtede ja veergude nimed jäävad täpselt samaks:

- `Seaded`: `Võti`, `Väärtus`
- `Teated`: `ID`, `Pealkiri`, `Tekst`, `Tüüp`, `Algus`, `Lõpp`, `Aktiivne`, `Prioriteet`
- `Kontaktid`: `Roll`, `Nimi`, `Telefon`, `E-post`, `Aktiivne`
- `Avarii`: `Nimetus`, `Telefon`, `Märkus`, `Prioriteet`, `Aktiivne`
- `Prugivedu`: `Jäätmeliik`, `Kuupäev`, `Märkus`, `Aktiivne`, `Sagedus`
- `Elekter`: `Pakett`, `Võimsus VMA2`, `Hinnad käibemaksuta`
- `Maja`: `Aasta`, `Kuu`, `Veekulu m³`, `Soojusetarbimine MWh`, `Elektritarbimine kWh`, `Päikesepaneelide tootlus kWh`

### Maja tarbimise plokk

Maja tarbimise paneel kasutab olemasolevat `Maja` sektsiooni ja vahetab automaatselt iga 8 sekundi järel kolme vaadet: viimase kuu näitajad koos eelmise kuu muutusega, kuni 12 kuu eraldi skaalal sparkline-trendid ning viimase andmerea aasta koondnäitajad. Vahetus kasutab rakenduse keskset `Scheduler`-it; eraldi intervalle ega uusi välispäringuid ei tehta. Puuduvad kuuväärtused kuvatakse kriipsuna ja neid ei käsitleta nullina.

`Kontaktid` lehe e-posti aadressi kliendile ei saadeta.

## Apps Script

Google Apps Scripti projekti lisa selles järjekorras:

1. `apps-script/Domain.gs`
2. `apps-script/Sheets.gs`
3. `apps-script/Sources.gs`
4. `apps-script/Code.gs`
5. `apps-script/appsscript.json`

Käivita üks kord `setup()`, kopeeri `getFeedTokenForSetup()` tagastatud token `config.js` faili ning avalda uus Web App deployment. Puuduva Sheetsi lehe korral tagastab server sektsioonile `missing: true`; klient säilitab selle sektsiooni viimase teadaoleva hea väärtuse.

## Build ja paigaldus

```bash
npm run build
```

Kopeeri kioskimasinasse vähemalt:

```text
dist/
config.js
kiosk/
```

Käivita administraatorina:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\kiosk\install-scheduled-task.ps1
```

Käsitsi käivitamiseks:

```text
kiosk\start-kiosk.cmd
```

Server vastab ainult loopback-aadressil. Kontroll:

```text
http://127.0.0.1:8765/healthz
```

Vastus peab olema `KU-INFOEKRAAN-OK`.

## Demo ja diagnostika

```text
http://127.0.0.1:8765/?demo=1
http://127.0.0.1:8765/?demo=1&notices=0
http://127.0.0.1:8765/?debug=1
```

Demorežiimis ei tehta välispäringuid ega reload'e. Visuaalregressioon kasutab fikseeritud kella ja kuut 1920 × 1080 olekut. Commit'itud baseline'e tohib release-tõendina kasutada alles siis, kui nende `build-version.txt` vastab projekti versioonile. 4.5.0 baseline'id on renderdatud Linuxi Chromium 1194-ga ja on arendus/CI keskkonna võrdlusalus (vt `docs/baseline.md`). Windowsi/Edge'i masinal tee A/B võrdlus eelmise release'i koodiga genereeritud piltide vastu (`docs/runbook.md` §3); ära genereeri võrdluspilte testitava koodiga.

## Offline-käitumine

Internetita töötavad edasi kell, kuupäev, bussid, teate kehtivus, prügiveo arvutus ning IndexedDB-s olevad viimased head andmed. Ühe välise allika rike ei kustuta teiste sektsioonide andmeid. Üle 24 tunni vanuse info korral kuvatakse nähtav hoiatusriba.

Service workerit ei kasutata. `retireServiceWorkers()` eemaldab varasemate versioonide võimalikud registreeringud ja vanad vahemälud.

## Täiendav dokumentatsioon

- [Kasutuselevõtu ja taastamise runbook](docs/runbook.md)
- [Säilitatavad käitumislepingud](docs/contracts.md)
- [Mõõdetud lähtetase ja kontrollitulemused](docs/baseline.md)
- [Muudatuste ajalugu](CHANGELOG.md)
- [Teostusraport](MUUDATUSTE_RAPORT.md)


## 4.2.0 loetavustasemed

1920 × 1080 ja `scale: 0.82` juures on 1 rem = 16,4 px. Rakendus kasutab nelja minimaalset tüpograafiataset:

- `--fs-a: 2.10rem` ≈ 34,4 px — kell, KÜ nimi, teate pealkiri ja 112;
- `--fs-b: 1.41rem` ≈ 23,1 px — põhisisu, kontaktid, prügiliigid, busside suhteline aeg ja turu põhiväärtused;
- `--fs-c: 1.05rem` ≈ 17,2 px — rollid, sildid ja teisejärguline info;
- `--fs-d: 0.75rem` ≈ 12,3 px — graafikute teljesildid, allikad, olekuriba ja versioon.

Runtime `scale` alampiir on 0,82. See säilitab varasema 0,82 paigutuse, kuid uute tokenite tõttu ei lange B-tase alla 23 px. `tools/preflight.mjs` kontrollib nii tokenite kui kriitiliste selektorite miinimumsuurusi.

## Runtime-config ja tokeni turve

`config.js` on kioskimasina lokaalne saladust sisaldav runtime-fail ja **ei kuulu Git'i**. Kui see on kunagi päris tokeniga commititud, tuleb token lugeda lekkinuks: käivita Apps Scriptis `rotateFeedToken()`, uuenda kioskimasina `config.js` ja kustuta vana tokeni kasutus. Token saadetakse Apps Scriptile URL-i query-parameetrina; see võib seetõttu ilmuda Google'i täitmis-/päringulogidesse. Jagatud token on praktiline kioskifeedi ligipääsutõke, mitte kasutajapõhine tugev autentimine.

Fetch jääb esmaseks transpordiks. JSONP-varuvariant säilib, sest konkreetse Apps Script Web App deployment'i CORS-käitumist ei saa lähtekoodist garanteerida; selle tõttu peab CSP lubama `script.google.com` ja `script.googleusercontent.com`. Kui fetch ise jõuab 20 s timeoutini, ei alustata enam teist 20 s JSONP-katset.

## Turuallikate töökindlus

Elektri-, kütuse- ja Euribori allikatel on 15-minutiline negatiivne vahemälu. Katkine välisallikas ei tekita seega iga järgmise dashboard-cache'i tsükliga uusi korduspäringuid. Ekraan säilitab sektsioonipõhise last-known-good väärtuse ning turukaardi allikarea lõpus näidatakse viimase eduka andmestiku kellaaega.

Väliste allikate lepingud on kirjeldatud `docs/contracts.md` failis. Internetiga arendusmasinal saab kuju kontrollida käsuga `npm run test:sources`. Euribori päevase ajaloo jaoks jääb praegu Soome Panga raport, sest ECB avalikust andmeportaalist ei ole projekti nõutava päevase 6 kuu Euribori voo otsest samaväärset asendust kinnitatud; HTML/XML raportiparser on seetõttu dokumenteeritud jääkrisk.

## Bussigraafiku kontrolltähtaeg

Koodiga kaasas oleva Kauge peatuse sõiduplaani ametlikul allikal on algus `28.04.2026`, kuid avaldatud lõppkuupäeva ei ole. `validUntil: 2027-04-27` on **hoolduslik kontrolltähtaeg**, mitte vedaja ametlik kehtivuse lõpp. Pärast seda kuvatakse ekraanil `Sõiduplaan vajab kontrolli`. Preflight hoiatab ka siis, kui `validFrom` on üle 12 kuu vana.

## Visuaalbaseline'i uuendamine

Commit'itud 1920 × 1080 baseline'id genereeritakse Linuxi Chromium 1194 võrdluskeskkonnas (vt `docs/baseline.md`) käsuga:

```bash
npm run test:visual:update
```

Käsk uuendab Playwrighti kuus PNG-baseline'i, kirjutab `tests/e2e/snapshots/build-version.txt` väärtuseks praeguse `package.json` versiooni ning loob juurkausta kaks demonstratsioonipilti (neid ei commit'ita). Tavaline preflight kukub läbi, kui baseline'i versioon ja paketi versioon ei ühti; see väldib vanade piltide esitlust uue release'i tõendusena.

Uuenda baseline'e ainult siis, kui renderdus muutub teadlikult, ja tõenda enne, et muutus on ainult see: renderda samad olekud eelmise commit'iga samas keskkonnas, võrdle uue koodiga (A/B) ja vaata pildid silmaga üle. Commit'itud pildid on tehtud Linuxi Chromium 1194-ga; teise fondistackiga masinas (nt Windows/Edge) genereeritud pilte ei commit'ita ning seal tehakse A/B võrdlus `docs/runbook.md` §3 järgi.
