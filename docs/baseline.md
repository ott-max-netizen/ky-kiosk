# Mõõdetud lähtetase ja lõppkontroll

## Auditi lähteseis 3.4.0

Auditi lähteandmete järgi sisaldas projekt 19 lähtefaili ja 6392 koodirida. Kinnitatud probleemid olid muu hulgas:

- pikal katkestusel kuni 240 reload'i nelja tunniga;
- seadistamata masinal reload iga minut;
- pika teate leheküljeindeks jäi mõõtmevõtme lahknevuse tõttu lehele 1;
- 96 elektripunkti korral loodi igal minutil 121 SVG elementi ja tehti 679 `setAttribute` kutset;
- puuduv Sheetsi leht kustutas viimase hea sektsiooni;
- ühikuheuristika võis muuta 3 €/MWh väärtuseks 372 s/kWh.

## Versiooni 4.0.0 mõõtmised

Testkeskkond: Chromium, 1920 × 1080, device scale 1, `Europe/Tallinn`, fikseeritud kell 25.08.2026 16:00.

| Mõõdik | Tulemus |
|---|---:|
| HTML dokument | 1920 × 1080; kerimisribasid ei tekkinud |
| Paneelide horisontaalne/vertikaalne overflow | 0 kuues visualiseeritud olekus |
| DOM elemendid tavavaates | 445 |
| SVG alamelemendid tavavaates | 50 |
| Paneelid | 7 |
| Pika teate test | 4 lehekülge; `lk 1/4` → `lk 2/4` |
| Preflight | 53 kontrolli läbitud |
| `setInterval` lähtekoodis | 1, ainult `src/app/scheduler.ts` |
| `innerHTML` / `insertAdjacentHTML` | 0 |
| Service workeri registreerimine | 0 |
| Runtime dependencies | 0 |
| Fallback `dist/` maht | alla 0,5 MiB ilma visuaalbaseline'ideta |
| Trimmitud sünteetiline 96 elektri + 135 Euribori payload | ligikaudu 15,5 KiB |

## 1920 × 1080 olekud

Playwrighti baselined asuvad `tests/e2e/snapshots`:

1. aktiivse teatega päevavaade;
2. teatevaba lai turunäitajate vaade;
3. ööteema;
4. ainult IndexedDB vahemälu;
5. üle 24 tunni vanade andmete hoiatus;
6. 1200-tähemärgiline teade, 8+8 kontakti, 10 prügiveorida, 96 elektripunkti ja 135 Euribori punkti.

Lisaks kontrolliti 4200-tähemärgilise teatega, et leheküljerotatsioon jõuab järgmisele lehele.


## Lähte-PNG ja deterministliku baseline'i võrdlus

Kaasas olnud dünaamilise lähtekuvatõmmise `demo-1920x1080.png` ja uue fikseeritud kella ning determineeritud andmetega `demo-with-notices.png` täpne pikslivõrdlus andis:

- kõik erinevad pikslid: **4,61%**;
- pikslid, mille vähemalt ühe värvikanali erinevus oli üle 8: **4,35%**;
- keskmine absoluutne kanalierinevus: **2,97**.

Seetõttu ei ole auditis seatud ≤0,05% / ≤0,3% värav vana dünaamilise PNG suhtes tõendatult läbitud. Peamised põhjused on erinev kell ja dünaamiline sisu, fontide rasterdus ning see, et lähte-PNG ei olnud loodud sama külmutatud brauserikeskkonnaga. Versioon 4.0.0 loob edaspidiseks kuus sama keskkonna, sama kella ja samade fixture'itega Playwrighti baseline'i. Enne tootmisse paigaldust tuleb need internetiga arendusmasinas ametliku Node Playwrightiga üle vaadata ja kinnitada.

## Keskkonnapiirangud

Selles teostuskeskkonnas puudus npm registri DNS-ligipääs, mistõttu täpselt määratud Vite 8.2.2, TypeScript 7.0.2, Vitest 4.1.11, Playwright 1.62.1, oxlint 1.80.0 ja Biome 2.5.10 pakette ei saanud alla laadida. Seetõttu:

- lähtekoodi range tüübikontroll tehti globaalse TypeScript 5.8.3 abil;
- build genereeriti kaasasoleva `tools/build-fallback.mjs` abil;
- päris browseritestid tehti Python Playwrighti ja süsteemi Chromiumiga;
- `npm run lint`, `npm run test`, Vite'i päris build ja Node Playwright tuleb käivitada internetiga arendusmasinas;
- PowerShelli, Task Scheduleri ja Google Apps Scripti runtime'i ei saanud Linuxi konteineris lõpuni käivitada; nende jaoks on runbookis Windowsi/Google'i käsitestid.

Need piirangud ei mõjuta kaasasoleva valmis `dist/` kausta kasutamist, kuid enne tootmisse paigaldamist tuleb arendusmasinas läbida kõik npm kvaliteediväravad ja kioskimasinas PowerShelli käsitestid.


## 4.2.0 visuaalbaseline'i olek

4.2.0 muudab tüpograafiat teadlikult, seega 4.0.0 PNG-baseline'e ei tohi käsitleda 4.2.0 tõendusena. Käesolevas teostuskeskkonnas blokeerib Chromium URL-id halduspoliitikaga `URLBlocklist: ["*"]`, mistõttu uut 1920 × 1080 renderdust ei saanud siin usaldusväärselt genereerida.

`tests/e2e/snapshots/build-version.txt` jääb seetõttu ausalt väärtusele `4.0.0`, kuni käsuga `npm run test:visual:update` on päris Playwrighti baseline'id edukalt uuendatud. Tavaline `npm run preflight` **peab** seni versioonierinevuse tõttu läbi kukkuma. Ainult mittevisuaalse diagnostika jaoks saab kasutada `KU_ALLOW_STALE_VISUAL_BASELINE=1 npm run preflight`; seda ei tohi käsitleda release-värava läbimisena.

## 4.3.0 mõõtmised (päris Chromium, täielik tööriistaahel)

Erinevalt 4.0.0 ja 4.2.0 auditist oli selles keskkonnas npm registri ligipääs ja
töötav Chromium olemas, seega sai esimest korda käivitada kõik päris
kvaliteedivärava sammud ja päris brauserimõõtmised.

Kordamiseks: `npm run build && node tools/measure.mjs --hours 24`. Kiirendatud
kell (Playwright `page.clock`), demorežiim, 1920 × 1080, device scale 1,
`Europe/Tallinn`, fikseeritud algus 25.08.2026 16:00.

| Mõõdik | 4.2.0 | 4.3.0 | Muutus |
|---|---:|---:|---:|
| JS bundle | 76 790 B | 82 245 B | +7,1% |
| JS bundle gzip | 24 627 B | 26 176 B | +6,3% |
| CSS bundle | 27 250 B | 27 280 B | +0,1% |
| CSS bundle gzip | 6 122 B | 6 126 B | +0,1% |
| `index.html` | 9 035 B | 9 035 B | 0 |
| Esimene täisrenderdus | 204 ms | 183 ms | −10,3% |
| DOM-sõlmi käivitusel | 398 | 398 | 0 |
| SVG-sõlmi käivitusel | 52 | 52 | 0 |
| DOM-sõlmi 24 h pärast | 397 | 398 | stabiilne |
| Loodud HTML-elemente 24 h | 345 604 | 266 | −99,92% |
| Loodud SVG-elemente 24 h | 43 252 | 64 | −99,85% |
| Sunnitud reflow'sid 24 h | 24 | 24 | 0 |
| `addEventListener` kokku | 23 | 23 | 0 |
| JS-kuhi käivitusel | 2 601 340 B | 2 604 820 B | +0,1% |
| JS-kuhi 24 h pärast | 2 962 680 B | 2 283 148 B | −22,9% |
| Vite build | 201 ms | 178 ms | mõõtemüra piires |

Bundle kasvas teadlikult: lepitaja, vahemälu valideerimine, ajastaja tugevdamine
ja usutavuskontrollid on lisakood. Otsustusjärjekorra (õigsus > töökindlus >
hooldatavus > jõudlus > bundle) järgi on 1,5 KiB gzip vastuvõetav hind.

Kõige olulisem number on elementide loomine: 4.2.0 lõi ööpäevas ligi 350 000
elementi, et kuvada 398-sõlmelist DOM-i, sest iga roteeruv paneel lammutas ja
ehitas oma alampuu uuesti. 4.3.0 loob esimese tunni järel praktiliselt mitte
ühtegi. Ükski neist ei olnud leke — DOM-i suurus oli mõlemal juhul stabiilne —
kuid nädalaid järjest töötaval masinal on see puhas eraldamise ja prügikoristuse
koormus.

### Pika sessiooni kontroll

24 h kiirendatud sessiooni jooksul: taimerid ei kasva (üks jagatud
`setInterval`), kuulajad ei kasva (23, kõik lehe elueaga), DOM ei kasva,
rotatsioon jääb tööle, ajastaja jääb tööle. 7 päeva mõõdeti loogilise ajaga
`tests/integration/longrun.spec.ts` kaudu, mitte brauseris — see on ausalt
märgitud allpool.

### Mida selles keskkonnas EI saanud tõendada

- **Visuaalne regressioon commit'itud baseline'ide vastu: BLOCKED.**
  `tests/e2e/snapshots/*.png` on versioonist 4.0.0 ja need näitavad veel vana
  nelja kuu maja-paneeli, mis asendati 4.1.0-s kolme vaatega. Need ei saa 4.2.0
  ega 4.3.0 vastu kunagi läbi minna. Lisaks erineb selle konteineri fondistack
  baseline'i loonud masinast (~9% pikslitest, ainult teksti rasterdus; kastid ja
  graafikud kattusid täpselt).
- **Mida siiski tõendati:** refaktooring ei muutnud renderdust. Kuus 1920 × 1080
  fixture'it renderdati eelmise commit'i koodiga *samas keskkonnas*, salvestati
  baseline'iks ja uus kood võrreldi nende vastu — kõik 7 Playwright testi
  läbisid pikslitäpselt.
- **Windowsi kiosk, PowerShell, Task Scheduler, Apps Scripti runtime:** Linuxi
  konteineris ei saa käivitada; muutmata jäetud, käsitestid on runbookis.
- **7 päeva päris brauserimälu profileerimine:** ei ole automatiseeritud.

## 4.4.0 arenduse kontroll

4.4.0 ei muuda paneelide visuaalset paigutust ega andmelepinguid. Muudatused on
elutsükli tüübilepingus, CSP meta-varuvariandis, DOM-abifunktsioonis ja release'i
jõudluseelarves.

Tõendatud selles teostuskeskkonnas:

- `src/**/*.ts` range kontroll globaalse TypeScript 5.8.3-ga, DOM/ES2023 teekidega: PASS;
- importgraafik: 54 TypeScripti faili, 178 suhtelist importi, 0 tsüklit;
- `src/domain/**` ei impordi `src/ui/**` ega `src/data/**`: PASS;
- `src/diagnostics/**` ei impordi enam `src/ui/**`: PASS;
- `as unknown as [HTMLElement, ...]` child-tuple cast'e lähtekoodis: 0;
- Chromiumi visuaalkatset ei saanud 4.4.0 arenduskeskkonnas käivitada, sest
  masinapoliitika tagastas nii `http://127.0.0.1` kui `file://` URL-idele
  `ERR_BLOCKED_BY_ADMINISTRATOR`.

### 4.4.0 järelkontroll töötava Chromiumiga

Muudatused võeti hiljem vastu keskkonnas, kus Chromium oli kasutatav, ja
brauseripoolne osa sai tõendatud:

- **Renderdus ei muutunud.** Kuus 1920 × 1080 fixture'it renderdati 4.3.0
  koodiga samas keskkonnas, salvestati baseline'iks ja 4.4.0 võrreldi nende
  vastu — kõik 7 Playwright testi läbisid pikslitäpselt. CSP meta, `tick(now:
  Date)` ühtlustus ega `requireChildElement` ei muutnud ühtki pikslit.
- **CSP meta ei riku rakendust.** Konsooli jälgides oli nii `vite preview`
  (production build) kui `vite dev` puhul **0 CSP rikkumist**; teated
  renderdusid mõlemal juhul. Ainsad konsoolivead olid eelvaates ootuspärased
  404-d puuduvale `config.js`-ile ja `/heartbeat`-ile, mida serveerib alles
  kioski PowerShelli server.
- **Jõudluseelarve värav töötab.** `npm run measure:check` läbis 24 h
  kiirendatud sessiooniga (väljundi viimane rida
  `Jõudluseelarve läbitud: HTML ≤ 1000, SVG ≤ 200`, väljumiskood 0).

| Mõõdik | 4.3.0 | 4.4.0 | Eelarve |
|---|---:|---:|---:|
| Loodud HTML-elemente 24 h | 266 | 266 | ≤ 1000 |
| Loodud SVG-elemente 24 h | 64 | 64 | ≤ 200 |
| DOM-sõlmi (algus → 24 h) | 398 → 398 | 399 → 399 | stabiilne |
| Sunnitud reflow'sid 24 h | 24 | 24 | — |
| `addEventListener` kokku | 23 | 23 | — |
| `index.html` | 9 035 B | 9 395 B | — |

DOM-sõlmede 398 → 399 vahe on CSP meta-silt `<head>`-is; `querySelectorAll("*")`
loeb ka `<head>` elemendid. `index.html` kasvas sama sildi võrra 360 baiti.
Renderdusega seotud numbrid on muutumatud, mis oligi 4.4.0 eesmärk: muudatused
puudutavad tüübilepingut, kihijaotust ja release-väravat, mitte renderdust.

Commit'itud PNG-baseline'ide seis ei muutu: need on endiselt 4.0.0 päritolu ja
neid ei tohi selle keskkonna fontidega üle kirjutada.

Jõudluse release-värav on nüüd masinloetav:

```bash
npm run measure:check
```

Vaikimisi piirid: kuni **1000 HTML-elementi** ja **200 SVG-elementi** 24 h
kiirendatud sessioonis. 4.3.0 mõõdetud baas 266 / 64 jääb mõlemast piirist suure
varuga allapoole. Piirid on tahtlikult lõdvemad kui baas: eesmärk on avastada
paneeli tagasiminek pidevasse DOM-i taasehitusse, mitte püüda mõõtemüra.

Commit'itud PNG-baseline'id jäävad teadlikult versioonile 4.0.0. Neid ei nimetata
4.4.0 baseline'iks enne, kui `npm run test:visual:update` on käivitatud
kioskiga võrreldava fontide, Edge/Chromiumi ja 1920×1080 renderdusega masinal ning
kuus pilti on visuaalselt üle vaadatud.

## 4.5.0 kontroll

Kontrollitud Linuxi konteineris eelpaigaldatud Chromiumiga (Playwright 1.62.1,
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`), 1920 × 1080.

- `npm run lint`, `format:check`, `typecheck`: PASS.
- `npm test`: 15 faili / 134 testi PASS, ka puhtast checkout'ist (ilma `dist/` kaustata).
- `tests/e2e/layout-audit.spec.ts`: 4/4 PASS. Sama audit 4.4.0 lähtekoodi vastu:
  4/4 FAIL — ööteemas 27 kontrastiviga (1,23–2,46 : 1), 5–9 viewBox'ist väljuvat
  y-telje silti, tühjad kuupäevaväljad.
- `tests/e2e/visual.spec.ts`: 6 PNG-võrdlust FAIL (baseline 4.0.0, oodatud), 1 PASS.
- `npm run measure:check`: PASS.

| Mõõdik | 4.4.0 | 4.5.0 | Eelarve |
|---|---:|---:|---:|
| Loodud HTML-elemente 24 h | 266 | 266 | ≤ 1000 |
| Loodud SVG-elemente 24 h | 64 | 64 | ≤ 200 |
| DOM-sõlmi (algus → 24 h) | 399 → 399 | 399 → 399 | stabiilne |
| Sunnitud reflow'sid 24 h | 24 | 24 | — |
| JS bundle gzip | — | 26 910 B | — |
| CSS bundle gzip | — | 6 220 B | — |

PNG-baseline'e ei kirjutatud konteineri fontidega üle (vt 4.4.0 põhjendus).

## 4.5.0 järelparandused (2026-10-18)

Kontrollitud Linuxi konteineris eelpaigaldatud Chromium 1194-ga (Playwright 1.62.1,
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium`), 1920 × 1080.

- `npm run lint`, `format:check`, `typecheck`, `build`: PASS.
- `npm test`: 19 faili / 169 testi PASS (oli 15 / 134), ka `TZ=UTC`, `TZ=America/Los_Angeles` ja `TZ=Asia/Tokyo` korral.
- `npx playwright test`: 11/11 PASS (4 paigutusauditit, 7 visuaaltesti).
- `npm run preflight`: 148 kontrolli PASS, **ilma** `KU_ALLOW_STALE_VISUAL_BASELINE` erandita.
- `npm run measure:check`: PASS.

### Visuaalbaseline'id

Kuus PNG-d uuendati käsuga `npm run test:visual:update`; `build-version.txt` on `4.5.0`.
Enne seda renderdati samad kuus olekut **muutmata 4.5.0 koodiga** (commit `99e557e`)
samas keskkonnas ja võrreldi uue koodi renderdusega pikslite kaupa:

| PNG | uus kood vs muutmata 4.5.0 | uus vs commit'itud 4.0.0 |
|---|---:|---:|
| `demo-with-notices.png` | 0,000% | 33,6% |
| `demo-without-notices.png` | 0,000% | 38,8% |
| `demo-night.png` | 0,000% | 30,5% |
| `cache-only.png` | 0,000% | 33,6% |
| `stale-banner.png` | 0,000% | 34,5% |
| `max-content.png` | 0,000% | 38,7% |

Järelparandused ei muutnud ühtki pikslit. Erinevus 4.0.0 piltidest tuleb 4.1.0–4.5.0
teadlikest muudatustest (kolme vaatega maja paneel, tüpograafia, turukaardid) ja
fondistackist.

**Poliitika muutus.** 4.3.0–4.4.0 jaotised ütlevad, et PNG-sid ei tohi konteineri fontidega
üle kirjutada enne kioskiga võrreldavat renderdust. Projekti omanik otsustas 2026-10-18
teisiti: commit'itud baseline'id on nüüd **Linuxi Chromium 1194 võrdlusalus** arendus- ja
CI-keskkonnale ning `build-version.txt` on `4.5.0`. Tõendus, et pildid ei peida
regressiooni, on ülaltoodud A/B võrdlus muutmata koodiga ja käsitsi ülevaatus.

**Fondihoiatus:** 4.3.0 auditis erines konteineri tekstirasterdus kioskimasinast umbes
9% pikslitest, seega ei sobi need pildid Windowsi/Edge'i võrdluseks. Seal tee A/B
võrdlus eelmise release'i koodiga genereeritud piltide vastu (`docs/runbook.md` §3).
Võrdluspilte ei tohi genereerida testitava koodiga.

### 24 h jõudlus

| Mõõdik | 4.5.0 | järelparandused | Eelarve |
|---|---:|---:|---:|
| Loodud HTML-elemente 24 h | 266 | 266 | ≤ 1000 |
| Loodud SVG-elemente 24 h | 64 | 64 | ≤ 200 |
| DOM-sõlmi (algus → 24 h) | 399 → 399 | 399 → 399 | stabiilne |
| Sunnitud reflow'sid 24 h | 24 | 24 | — |
| `addEventListener` kokku | 23 | 23 | — |
| JS bundle gzip | 26 910 B | 27 192 B | — |
| CSS bundle gzip | 6 220 B | 6 221 B | — |

Kesköine lisauuendus (ilm, maja, kütus, Euribor) ja minutiline turukaardi
`tick` ei loonud 24 h jooksul ühtki lisaelementi.

### Endiselt käivitamata

- PowerShelli, Task Scheduleri ja Edge'i osa ei saanud Linuxis käivitada; käsitestid on
  `docs/runbook.md` jaotises „Windowsi kioskiskriptide käsitest“. Serveri C# kood
  kompileeriti ja käivitati Monoga (vt allpool).
- Apps Scripti muudatusi kontrolliti `node:vm`-is Google'i teenuste asendustega
  (`tests/contract/apps-script-sources.spec.ts`), mitte päris Apps Scripti runtime'is.
- `npm run test:sources` (live välisallikad) jäi käivitamata.

### Kioskiserveri C# kontroll (Mono)

`kiosk/local-server.ps1` C# koodi kompileeriti Mono `mcs -langversion:5 -warn:4
-warnaserror+` ja Roslyniga (LangVersion 5, `TreatWarningsAsErrors`), mis vastavad
Windows PowerShell 5.1 `Add-Type` käitumisele (hoiatused = vead):

| Versioon | mcs | Roslyn |
|---|---|---|
| 99e557e (enne) | CS4014 → viga | CS4014 → viga |
| 5c9d1fa | CS4014 → viga | CS4014 → viga |
| parandatud | 0 hoiatust | 0 hoiatust |

Parandatud server käivitati Mono all (`127.0.0.1`, `dist/`):

| Kontroll | Tulemus |
|---|---|
| `/healthz` 20× järjest | 20/20 `KU-INFOEKRAAN-OK`, ühendus ei lähtestunud |
| 40 paralleelset `/healthz` | 40 × 200 |
| `/healthz` 10 jõudeoleva ühendusega | enne `SetMinThreads` 3,29 s, pärast 0,02 s |
| `/healthz` 15 / 16 jõudeoleva ühendusega | 0,03 s / 4,88 s (piirang täis, ootab 5 s lugemisaega) |
| `POST /heartbeat` | 204, fail kirjutatud |
| `/../package.json` | 404 |

Mono ei ole .NET Framework 4.x: lõimekogumi ajastus ja soklite RST-käitumine võivad
Windowsis erineda, seega käsitest (runbook) jääb kohustuslikuks.

