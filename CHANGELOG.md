# Muudatused

## 4.5.0 – 2026-10-06

Ülevaatus päris Chromiumis renderdatud 1920 × 1080 ekraanipiltide põhjal. Kõik allolevad
vead olid nähtavad, kuid jäid märkamata, sest PNG-baseline on 4.0.0 päritolu ja
visuaalvõrdlus ei saanud ühegi praeguse buildi vastu läbi minna.

### Parandatud – kasutajale nähtav

- **Ööteemas olid kontaktid ja avariinumbrid loetamatud.** `.contact-card` ja
  `.contact-card-important` kasutasid kõvakodeeritud heledaid taustu (`rgba(255,255,255,.48)`,
  `#fbefeb`), mida `night.css` üle ei kirjutanud; hele tekst heledal pinnal andis
  kontrastiks 1,2–2,5 : 1. Pinnad on nüüd tokenid `--contact-surface` ja
  `--contact-important-surface`, mille ööteema defineerib ümber. Ka elektri hetkehind
  (`#a2554b` tumedal) sai ööteemas loetava värvi.
- **Elektrigraafiku y-telje sildid olid poolikud** ("22,3" kuvati kui ",2,3"). Sildid
  skaleeruvad koos viewBox'iga, kuid vasak veeris oli fikseeritud 25 ühikut. Veeris
  arvutatakse nüüd siltide pikkusest ja arvutatud fondi suurusest; sama Euribori
  graafikul, kus alumine y-silt kattus ka kuupäevasildiga.
- **Euribori telje kuupäev oli KK.PP järjekorras** (7. august kui "08.07", 26. juuni
  kui "06.26"). Nüüd PP.KK.
- **Avariinimi lõigati poolikuks ilma kolmikpunktita** ("Kanalisatsiooni ava|").
  Nimi lüheneb nüüd kolmikpunktiga ja lisainfo annab ruumi esimesena.
- **Turukaardi vanusemärk ("2 p vana") kattis allikarida.** Vananenud kaardil
  reserveeritakse märgile ruum.
- **Bussikaardid olid eri kõrgusega**, kui väljumisel puudus suhteline aeg (homsed
  väljumised), ja suundade pealkirjad ei olnud samal joonel.
- Prügiveo jäätmeliigi nimi sai kuupäevaveeru arvelt rohkem ruumi
  ("Biolagunevad jäätmed" ei lühene enam).
- Vananenud andmete vaates puutus elektrikaardi min/keskm/max rida vastu telje
  kellaaegu; statistikareal on nüüd püsiv vahe.

### Parandatud – töökindlus

- `formatDateValue` kontrollis `formatter instanceof Intl.DateTimeFormat`. Kui
  `Intl.DateTimeFormat` on asendatud (Playwrighti kell, polüfill), jäid kõik
  kuupäevaväljad tühjaks: "seisuga ", "Eesti keskmine · ", prognoosi nädalapäevad,
  prügiveo kuupäevad. Tootmis-Edge'is viga ei avaldunud, kuid kõik visuaaltestid
  renderdasid vale ekraani. Vormindaja valitakse nüüd tüübikindla tabeliga.
- Edukas sünkroonimine kirjutas `runtimeProblems` serveri probleemidega üle: samas
  tsüklis lisatud „Vahemälu: viimaseid andmeid ei õnnestunud salvestada“ ja prügiveo
  sageduse hoiatused kadusid kohe diagnostikast. Kliendi enda probleemid säilivad
  nüüd (`replaceRemoteProblems`).
- `Scheduler` arvutab vahelejäänud intervallid ühe sammuga. Kella hüpe aastaid edasi
  (tühi CMOS-patarei, seejärel NTP) tegi varem sammhaaval sadu miljoneid kordusi ja
  külmutas lehe mitmeks sekundiks (mõõdetud 2,5 s ühe 1 s ülesande kohta).

### Kvaliteediväravad

- Uus `tests/e2e/layout-audit.spec.ts`: pikslitest sõltumatu audit päeva-, öö-,
  maksimaalse sisu ja vananenud andmete vaates — WCAG kontrast (4,5 / 3 : 1, ka
  gradienttaustadel), ilma kolmikpunktita lõigatud tekst, viewBox'ist väljuvad SVG
  sildid ja tühjad kuupäevaväljad. Tõendatud, et audit kukub 4.4.0 koodi vastu läbi
  kõigi ülalnimetatud vigadega ja läbib 4.5.0 koodiga. Erinevalt PNG-baseline'ist
  töötab see igas Chromiumis.
- `npm test` ja `npm run check` töötavad puhtas checkout'is: build-lepingu testid
  lugesid `dist/` kausta, mida veel polnud (`check` jooksutas testid enne buildi).
  `check` ehitab nüüd enne teste ja Vitesti `globalSetup` loob puuduva buildi.
- E2E abifunktsioonid koliti `tests/e2e/helpers.ts` faili.
- 6 uut regressioonitesti (`tests/unit/review-4-5.spec.ts`); iga test kukub vana koodiga läbi.

### Jõudlus

`npm run measure:check` (24 h kiirendatud Chromium): loodud 266 HTML- / 64 SVG-elementi,
DOM 399 → 399 — identne 4.4.0-ga. Graafikute veerise arvutus kasutab olemasolevaid
silte ega loo lisaelemente.

### Teadlikult lahendamata

- PNG-baseline'id on endiselt 4.0.0 päritolu ja 4.5.0 muudab piksleid teadlikult
  (ööteema, graafikuteljed, kuupäevad). Neid ei genereeritud Linuxi konteineri
  fontidega; release vajab kioskiga võrreldaval masinal `npm run test:visual:update`
  käivitamist ja visuaalset ülevaatust.

## 4.4.0 – 2026-08-27

### Arhitektuuri ja release-värava tugevdamine

- `Panel<T>` kirjeldab nüüd ka valikulist `tick(now: Date)` elutsüklit. Kõik roteeruvad paneelid kasutavad sama `Date` sisendit; `AppView` ei pea enam teadma, milline paneel ootas millisekundeid ja milline `Date` objekti.
- `DebugOverlay` koliti `src/diagnostics/` alt `src/ui/` alla. Diagnostikakiht ei impordi enam UI DOM-abifunktsioone.
- Prügiveo-, bussi- ja ilmapaneeli viis child-tuple cast'i asendati kontrollitud `requireChildElement()` abifunktsiooniga. Audit nimetas neist ainult kolme prügiveo paneelis; repository kontroll leidis lisaks ühe bussides ja ühe ilmas. DOM-skeleti regressioon annab nüüd kohe arusaadava vea, mitte vaikse vale tüübi.
- `index.html` sisaldab CSP meta-varuvarianti, et põhiline poliitika kehtiks ka juhul, kui lehte serveeritakse ajutiselt ilma PowerShelli serverita. PowerShelli HTTP-päis jääb põhikaitseks ja sisaldab lisaks `frame-ancestors 'none'`.
- `tools/measure.mjs --assert-budgets` muudab 24 h Chromiumi mõõtmise masinloetavaks release-väravaks: vaikimisi kuni 1000 HTML- ja 200 SVG-elementi. Lisatud `npm run measure:check`.
- `docs/runbook.md` release-kontroll kasutab nüüd jõudluseelarvet, mitte ainult käsitsi numbrite vaatamist.
- `package-lock.json` juurversioon viidi projekti versiooniga kooskõlla.
- HousePaneli DOM-test kasutab nüüd realistlikku epohhiaega; varasem 1970. aasta timestamp ei tõendanud päriselt vaadete roteerumist.

### Teadlikult lahendamata

- Playwrighti commit'itud PNG-baseline'id on endiselt 4.0.0 päritolu. Neid ei nimetatud ümber ega genereeritud selles keskkonnas uueks; release vajab kioskiga võrreldaval masinal `npm run test:visual:update` käivitamist ja visuaalset ülevaatust.
- Apps Scripti live-spreadsheet, Windowsi Task Scheduler/watchdog ja väliste turuallikate live-kuju vajavad jätkuvalt vastavat Google/Windows/internetiga keskkonda.

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
