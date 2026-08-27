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
