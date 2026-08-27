# Muudatused

## 4.3.0 – 2026-08-27

### Parandatud (P0/P1)

- `validateCachedDashboard` valideeris sisendi, aga tagastas seejärel ikkagi valideerimata toorobjekti. Rikutud või vanema versiooni kirjutatud IndexedDB vahemälu jõudis otse paneelidesse, viskas esimesel renderdusel erindi ja jättis kioski tühjale ekraanile ilma uue sünkroonimiskatseta. Nüüd koostatakse täielikult valideeritud `DashboardData` ja ka vahemälu teelt eemaldatakse kontakti e-post (C-33).
- Öine reload ei tea enam ainult kalendripäeva, vaid ka sessiooni algust: pärast 04:10 käivitunud kiosk ei tee enam 30 s pärast starti üleliigset reload'i. Kui `localStorage` ei ole kättesaadav, ei teki enam lõputut reload-tsüklit iga 30 sekundi järel. C-28 vahelejäänud minuti käitumine on muutmata.
- `DashboardRepository` sulgeb ühenduse ka veateel (varem lekkis iga ebaõnnestunud lugemine ühe ühenduse), avamisel on ajalimiit ja `onblocked` käsitlus ning `onversionchange` vabastab ühenduse.
- Vahemällu kirjutamise tõrge ei teata enam „Ühendus puudub“ ega käivita backoff'i; see kajastub runtime-probleemina.
- `Scheduler` teatab asünkroonse ülesande tagasilükkamisest (varem käsitlemata rejection), ei lase aeglasel ülesandel iseendaga kattuda ja taastub kella tahapoole hüppest (NTP, suveaeg), mis varem jättis kella seisma.
- Id-ta teatele antakse püsiv tuletatud id; varem sai teade igal valideerimisel uue juhusliku id ja rotatsioon hüppas iga sünkroonimise järel esimesele leheküljele.
- Väliste allikate väärtustele lisandus usutavusvahemik: ühikumuutus ülesvoolu (sendid euro asemel) ei jõua enam vaikselt ekraanile, vaid annab kriipsu või viimase hea väärtuse.
- `HousePanel` ei jää enam osuti alla igaveseks pausile; C-19 kolme vaate rotatsioon jätkub hiljemalt 60 sekundi pärast.

### Jõudlus

Mõõdetud Chromiumis 1920 × 1080, kiirendatud kell, 24 h simuleeritud tööaega (`node tools/measure.mjs`):

| Mõõdik | 4.2.0 | 4.3.0 |
|---|---:|---:|
| Loodud HTML-elemente 24 h jooksul | 345 604 | 266 |
| Loodud SVG-elemente 24 h jooksul | 43 252 | 64 |
| DOM-sõlmi (algus → 24 h) | 398 → 397 | 398 → 398 |
| JS-kuhi 24 h pärast | 2,96 MB | 2,28 MB |
| Esimene täisrenderdus | 204 ms | 183 ms |

- Uus `src/ui/reconcile.ts` taaskasutab olemasolevaid ridu, loob ainult puuduva ja eemaldab ainult ülearuse. Kõik roteeruvad paneelid (maja, kontaktid, avarii, prügivedu, teadete punktid, bussid, elekter, kütus, ilm) uuendavad nüüd sisu kohapeal.
- `safeTimeZone` on memoiseeritud: 117,438 µs → 0,025 µs kutse kohta (Node'i mikromõõtmine, 200 000 kutset). Seda kutsuti `zonedParts`-i ja `getFormatters`-i kaudu kümneid kordi sekundis.
- Silumisülekatte arvutused tehakse ainult siis, kui `?debug=1` on sees.

### Kvaliteedivärav

Kõik `npm run check` sammud olid 4.2.0-s katki ja seetõttu ei kaitsnud midagi:

- `typecheck` – 13 viga (`vite/client` puudus `types` loendist);
- `test` – 7 testi ei saanud käivituda (Vitesti `node` keskkond DOM-i vajavatele testidele, `tests/e2e` sattus Vitesti alla);
- `format:check` – 64 viga;
- `build:fallback` – TypeScript 7-l ei ole enam JavaScripti kompilaatori API-t, `ts.transpileModule` puudus täielikult;
- `preflight` – importis `dist/src/**`, mida toodab ainult `build:fallback`, seega kukkus alati pärast `vite build`-i;
- `test:visual` – projekti `use` kirjutas 1920 × 1080 vaateava üle 1280 × 720-ga, nii et kogu visuaalne regressioonikontroll jooksis vale resolutsiooniga (C-34 jäi kontrollimata).

Kõik need on parandatud. Vitest: 125 testi läbitud (varem 88 läbitud / 7 katki).

### Muu

- `apps-script/Sheets.gs` loeb Maja lehe soojusveergu nii ajaloolise kui õigekeelse kirjapildiga; `setup()` loob endiselt ajaloolise nime, nii et olemasolev tabel ei muutu (C-32).
- Lisatud `tools/measure.mjs` – kordusmõõtmise tööriist päris Chromiumis.
- `biome.json` ei vormista enam `config.js` ega genereeritud kaustu.

## 4.2.0 – 2026-08-25

- Lisatud kontrollitavad A/B/C/D tüpograafiatasemed; kriitilised põhitekstid tõstetud 23 px, sekundaarsed 17 px ja joonealused 12 px miinimumini praeguse `scale: 0.82` juures.
- Kell, KÜ nimi, teate pealkiri ja üldised paneelipealkirjad vähendatud ainult olemasoleva loetavusvaru arvelt.
- `112` on oluliste kontaktide paneelis eraldi A-taseme telefonina rõhutatud.
- Teate fit-to-box eelistab B-taseme juures lehekülgi; cache on 32-kirjeline LRU.
- Prügiveo päevavahetus kasutab `Europe/Tallinn` ajavööndit.
- Ööteema põhitekst ja muted-hierarhia muudetud pehmemaks ja selgemalt eristatavaks.
- Pikslinihe ei paljasta enam body serva ja püsiv `will-change` eemaldati.
- Runtime `config.js` eemaldatud versioonihaldusest; jälgitakse ainult `config.example.js`; preflight otsib tokenilekkeid.
- Öine reload toimib ka vahelejäänud täpse minuti järel ning reload'i ajalugu säilib `localStorage`-is.
- Demorežiim saadab lokaalset heartbeat'i; watchdog kasutab seadistatud `$Port` väärtust.
- Turuallikatel on 15 min negatiivne vahemälu ja kaardid näitavad viimase eduka värskenduse aega.
- Fetch-timeout ei käivita enam teist 20 s JSONP-katset; muude fetch-vigade korral JSONP säilib.
- Bussigraafikul on hoolduslik kontrolltähtaeg 27.04.2027 ja preflighti vanusekontroll.
- Lisatud `npm run test:sources` live-contract smoke ja range visuaalbaseline'i versioonivärav.

## 4.1.0 – 2026-08-25

- Maja tarbimise plokil on kolm automaatselt vahetuvat vaadet: viimane kuu, kuni 12 kuu trendid ja jooksva aasta koond.
- Vaated vahetuvad iga 8 sekundi järel olemasoleva keskse scheduleri kaudu; uut `setInterval`-i ei lisatud.
- Lisatud on eelmise kuu muutuse protsendid, eraldi sparkline igale näitajale ja aasta summad.
- Eemaldatud on tekst „iga näitaja oma skaalal“.

# Muudatuste ajalugu

## 4.0.0 – 2026-08-25

### Parandatud

- reload-tsükkel pikal internetikatkestusel ja seadistamata kioskis;
- pika teate lehekülgede mõõtmine ja rotatsioon;
- eilse elektrihinna kuvamine hetkehinna asemel;
- puuduva Sheetsi lehe last-known-good käitumine;
- Apps Scripti külmkäivituse paralleelsed turupäringud ja 20 s klienditimeout;
- ühikuheuristika, kuupäevapõhise teate kaasav lõpupäev ning prügiveo ankrupäeva valideerimine;
- maja tühjade tulevikukuude käsitlemine;
- kioskiserveri paralleelsus, 1 s receive timeout, teede lubatud loend ja CSP;
- watchdog'i renderdaja heartbeat ning käivituse armuaeg.

### Muudetud

- rakendus jagati Vite/TypeScripti ES-mooduliteks ja paneelideks;
- kõik välistest allikatest tulevad andmed läbivad type guard'id;
- olekumuutused kasutavad `sectionVersion` loendureid, mitte JSON-hashi;
- elektri- ja Euribori graafikud kasutavad `mount/update` patchimist;
- CSS jagati tokeniteks, paigutuseks, ööteemaks ja paneelifailideks;
- Apps Script jagati `Code`, `Sheets`, `Sources` ja genereeritud `Domain` failiks;
- server serveerib ainult `dist` faile ja eraldi runtime `config.js` faili;
- Edge'i profiil koliti `%LOCALAPPDATA%\KuInfoekraan` alla.

### Testimine

- 53-kontrolliline preflight;
- kuus deterministlikku 1920 × 1080 visuaalbaseline'i;
- unit-, contract-, integration-, DOM- ja E2E-testid;
- 4-leheküljelise pika teate rotatsioonitest;
- offline/cache ja stale-banner brauseritest.
