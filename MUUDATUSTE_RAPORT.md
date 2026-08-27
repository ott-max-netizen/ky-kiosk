# KÜ infoekraan 4.4.0 – jätkuarendus 4.3.0 repository põhjal

Aluseks oli kaasas olnud 4.3.0 repository ja selle auditikokkuvõte. Auditit ei
võetud pimesi tõena: failipuu, sõltuvussuund, paneeliliides, CSP, mõõtetööriist,
child-cast'id, package-lock ning baseline'i versioon kontrolliti päris koodist.
Kasutajakäitumise lepinguid C-01..C-37 ega 1920×1080 põhipaigutust ei muudetud.

## Kontrollitud lähteolukord

| Väide / töö | Koodist kinnitatud | 4.4.0 tulemus |
|---|---|---|
| Vanilla TypeScript + 0 runtime-sõltuvust | ✅ `package.json` | säilitatud |
| Importtsüklid puuduvad | ✅ 54 TS faili / 178 suhtelist importi / 0 tsüklit | säilitatud |
| `Panel<T>` ei kirjeldanud `tick()` elutsüklit | ✅ | lisatud `tick?(now: Date)`; kõik roteeruvad paneelid ühtlustatud |
| DebugOverlay tekitas `diagnostics -> ui` sõltuvuse | ✅ | kolitud `src/ui/debug-overlay.ts` alla |
| CSP oli ainult PowerShelli HTTP-päises | ✅ | lisatud `index.html` meta-varuvariant; serveripäis jääb põhiliseks |
| mõõtetööriist ei saanud eelarve ületamisel ebaõnnestuda | ✅ | `--assert-budgets`, 1000 HTML / 200 SVG vaikimisi |
| child-tuple topeltcast'e oli alles | ✅ audit alahindas ulatust: 5 kohta (`WastePanel` 3, `BusesPanel` 1, `WeatherPanel` 1) | kõik asendatud `requireChildElement()` kontrolliga |
| `package-lock.json` versioon oli 4.2.0, projekt 4.3.0 | ✅ | mõlemad 4.4.0 |
| HousePaneli DOM-test kasutas 1970. aasta timestamp'e | ✅ | test kasutab `Date.now()` baashetke ja tõendab päris rotatsiooni |
| visuaalbaseline on vana | ✅ `build-version.txt = 4.0.0` | teadlikult muutmata; release-blokeerija |

## Muudetud failid

- `src/ui/panels/panel.ts` – valikuline `tick(now: Date)` on nüüd paneelilepingu osa.
- `src/ui/panels/{contacts,emergency,house}.ts` – tick kasutab ühtset `Date` sisendit.
- `src/ui/app-view.ts` – saadab kõigile ajapõhistele paneelidele sama `Date` objekti.
- `src/ui/dom.ts` – lisatud kontrollitud `requireChildElement()`.
- `src/ui/panels/{waste,buses,weather}.ts` – eemaldatud kõik viis child-tuple topeltcast'i; auditi loend oli selles punktis mittetäielik.
- `src/diagnostics/debug-overlay.ts` → `src/ui/debug-overlay.ts` – UI kuulub UI kihti.
- `index.html` – CSP meta-varuvariant.
- `tools/measure.mjs` – jõudluseelarve ja mitte-null exit code regressiooni korral.
- `tools/preflight.mjs` – uued arhitektuuri-, CSP-, lock-faili ja perf-värava kontrollid.
- `tests/contract/smoke.spec.ts`, `tests/dom/reconcile.spec.ts` – uued regressioonikontrollid.
- `package.json`, `package-lock.json`, `config.example.js` – 4.4.0 ja `measure:check`.
- `README.md`, `docs/{contracts,baseline,runbook}.md`, `CHANGELOG.md` – release-protsess ja mõõtepiirid.

## Tõendatud kontrollid selles keskkonnas

- ✅ `src/**/*.ts` range typecheck globaalse TypeScript 5.8.3-ga; 0 viga.
- ✅ muudetud DOM-testi typecheck minimaalsete Vitest deklaratsioonidega; 0 viga.
- ✅ smoke-testi typecheck minimaalsete Node/Vitest deklaratsioonidega; 0 viga.
- ✅ `npm run build:fallback` päris projekti build-skriptiga; selles konteineris seoti registri puudumise tõttu skript ajutiselt olemasoleva TypeScript 5.8.3 CLI-ga, mitte projekti lukustatud 7.0.2 paketiga.
- ✅ `KU_ALLOW_STALE_VISUAL_BASELINE=1 npm run preflight`: **132 kontrolli**.
- ✅ genereeritud `dist/**/*.js`, `tools/measure.mjs` ja `tools/preflight.mjs`: `node --check`.
- ✅ importgraafik: 54 TS faili / 178 suhtelist importi / 0 tsüklit; `domain -> ui/data` rikkumisi 0; `diagnostics -> ui` rikkumisi 0.
- ✅ lähtekoodis `as unknown as [HTMLElement, ...]` vasteid 0.
- ⚠️ tavaline `npm run preflight` ebaõnnestub **ainult** baseline'i versiooniväraval: `4.0.0 !== 4.4.0`. Seda ei vaigistatud.
- ⚠️ `npm ci` ei lõpetanud selles konteineris registri/DNS piirangu tõttu; seega siin ei käivitatud päris Vitest/oxlint/Biome/Vite pakette.
- ⚠️ `node tools/check-market-sources.mjs` jõudis Eleringi DNS-i ja ebaõnnestus `EAI_AGAIN`; live-source leping jääb internetiga masinale.
- ⚠️ Chromium tagastab nii `http://127.0.0.1` kui `file://` lehele `ERR_BLOCKED_BY_ADMINISTRATOR`, seega uusi visuaalbaseline'e siin ei genereeritud.
- ⚠️ Windows PowerShelli, Task Schedulerit ega Apps Scripti live-runtime'i Linuxi konteineris ei testitud.

## Release'i jääktööd

1. Kioskiga võrreldaval Windows/Edge masinal: `npm ci && npm run test:visual:update`; vaata kõik kuus 1920×1080 pilti silmaga üle.
2. Seejärel: `npm run check && npm run measure:check`.
3. Internetiga masinal: `npm run test:sources`.
4. Live Google Sheetil: avalda `apps-script/Sheets.gs` ja kinnita Maja soojusveeru alias.
5. Windowsis: käi `docs/runbook.md` local-server/watchdog/Task Scheduler käsitestid läbi.

---

# KÜ infoekraan 4.2.0 – loetavuse ja töökindluse parandused

Aluseks oli v4.1.0 paranduste spetsifikatsioon. Iga leid kontrolliti tegelikust moodulkoodist enne muutmist. Põhigridi ei muudetud. Viie kontakti mahutamiseks säilitati kõik B/C fondid, kuid kontaktikaardi nimi, amet/selgitus ja telefon paigutati ühe rea hierarhiaks; kirjeid ei lõigata ära.

## Punktide teostus

| Punkt | Olek | Teostus | Põhifailid |
|---|---|---|---|
| 1. Praeguse tüpograafia mõõtmine | ✅ | Kinnitatud: `scale: 0.82` teeb 1 rem = 16,4 px @1920. | `tokens.css`, raport |
| 2. A/B/C/D miinimumid | ✅ | Lisati `--fs-a…--fs-d`; põhitekstid ja joonealused tõsteti miinimumini, suure varuga päis/teatepealkiri vähendati. | `src/styles/**` |
| 3. `--scale` turvaline alampiir | ✅ | Runtime alampiir 0,82. B-token on 1,41rem, seega 23,12 px ka alampiiril. Preflight kontrollib tokenid ja kriitilised selektorid. | `config-schema.ts`, `preflight.mjs` |
| 4. Avariinumber domineeriv | ✅ | Telefon `112` saab eraldi A-taseme kujunduse; muud olulised kontaktid jäävad B-tasemele. | `contacts.ts`, `emergency.ts`, `contacts.css` |
| 5. Ööteema hierarhia | ✅ | `--text #d4dce2`, `--muted #a9b7c2`; väiksem pimestus ja selgem hierarhia. | `night.css` |
| 6. Sisutiheduse otsus | ✅ otsus | Turunäitajaid ega maja paneeli ümber ei tõstetud. 0,5–1 m lähivaate kasutus toetab praegust paigutust. | — |
| 7. Teate text-fit alla B-taseme | ✅ | Kõigepealt leheküljed B-/baassuuruses; vähendamine ainult erandina ja mitte kunagi alla `--fs-b`. | `text-fit.ts` |
| 8. Text-fit cache'i kasv | ✅ | 32-kirjeline LRU; vanim kirje eemaldatakse. | `text-fit.ts` |
| 9. Prügiveo ajavöönd | ✅ | `tick()` ja `update()` kasutavad `zonedParts(..., timeZone)`, masina lokaalset kuupäeva ei kasutata. | `waste.ts` |
| 10. Runtime `config.js` Git'is | ✅ | `config.js` ja `public/config.js` ignoreeritakse ning eemaldati Git indexist; alles on ainult juurkausta `config.example.js`; preflight otsib mittetühja jälgitavat tokenit. | `.gitignore`, `config.example.js`, `preflight.mjs` |
| 11. Vanad visuaalbaseline'id | ⚠️ release-värav | Uuendamise mehhanism ja range versioonikontroll lisatud. Vanu 4.0.0 PNG-sid ei relabeldatud. Selle konteineri Chromiumi `URLBlocklist:*` takistas uute piltide genereerimist; `npm run test:visual:update` tuleb käivitada päris dev-masinal. | `package.json`, `update-visual-baseline-version.mjs`, `preflight.mjs` |
| 12. Pikslinihke serv | ✅ | Shell on 4 px üledimensiooniline ja -2 px nihkega; püsiv `will-change` eemaldatud. | `base.css` |
| 13. Bussigraafiku vananemine | ✅ konservatiivselt | Ametlik lõppkuupäev puudub. Lisati hoolduslik kontrolltähtaeg 27.04.2027; pärast seda UI hoiatab. Uut Sheetsi lehte ei lisatud, sest olemasolevate lehtede nimede leping on fikseeritud. | `bus-timetable.ts`, `schedule-status.ts`, `preflight.mjs` |
| 14. Haprad turuallikad / negatiivne cache | ✅ | Ebaõnnestumine cache'itakse 15 min; last-known-good säilib; turukaartidel kuvatakse viimase eduka värskenduse kellaaeg; lisatud source-contract test ja `npm run test:sources`. | `Sources.gs`, turupaneelid, `market-sources.spec.ts`, `check-market-sources.mjs` |
| 15. Demo vs watchdog | ✅ | Demo saadab lokaalse `/heartbeat` POST-i, kuigi väliseid andmepäringuid ja reloade ei tee. | `bootstrap.ts` |
| 16. Watchdog'i port | ✅ | Edge'i protsessi regex kasutab `$Port`. | `watchdog.ps1` |
| 17. Öine reload võib vahele jääda | ✅ | Reload tehakse pärast päeva sihtaega, kui seda pole täna veel tehtud; seis on `localStorage`-is. | `lifecycle.ts` |
| 18. JSONP hoiab CSP lahti | ⚠️ teadlikult säilitatud | CORS-i ei saa deployment'ita kinnitada, seega JSONP leping säilib. Fetchi 20 s `AbortError` ei käivita enam teist 20 s JSONP katset. | `apps-script-client.ts`, dokumentatsioon |
| 19. Kontaktide e-post | ➖ ei muudetud | Teadlik privaatsusleping: `E-post` jääb Sheetsis, kuid klienti ei saadeta ega ekraanil kuvata. | `contracts.md` |
| 20. Token query-parameetris | ✅ dokumenteeritud | README/runbook kirjeldavad logiriski ja `rotateFeedToken()` tegevust lekke korral. | `README.md`, `runbook.md` |
| 21. Scheduleri 250 ms baasintervall | ✅ | Üksainus `setInterval` kasutab lühima ülesande intervalli, maksimaalse 1 s scheduler-sammuga; faas säilib hilinemisel. | `scheduler.ts` |
| 22. Task Scheduleri RestartCount | ✅ | 10 → 999; watchdog jääb lisakaitseks. | `install-scheduled-task.ps1` |
| 23. Ilmaemoji → SVG | ➖ edasi lükatud | Ei ole funktsionaalne/turbeprobleem ja muudaks visuaali väljaspool kinnitatud minimaalset ulatust. Emoji jääb süsteemifondile; kaaluda eraldi visuaalrelease'is. | — |

## Tüpograafia @1920 × 1080, `scale: 0.82`

Arvutus: 1 rem = 16,4 px; `mm = px × 0,3113`; mugav kaugus = `mm × 0,7 × 200`.

| Selektor / element | Deklareeritud rem | px | mm | Loetav kaugus | Tase | Seis |
|---|---:|---:|---:|---:|---|---|
| `.clock` | 2,40 | 39,36 | 12,25 | 1,72 m | A | ✅ |
| `.notice-title` | 2,40 | 39,36 | 12,25 | 1,72 m | A | ✅ |
| `.identity h1` | 2,10 | 34,44 | 10,72 | 1,50 m | A | ✅ |
| `.contact-card-emergency-primary .contact-phone` | 2,10 | 34,44 | 10,72 | 1,50 m | A | ✅ |
| `.panel h2` | 1,70 | 27,88 | 8,68 | 1,22 m | B | ✅ |
| `.bus-departure-time` | 2,00 | 32,80 | 10,21 | 1,43 m | B | ✅ |
| `.address`, `.date` | 1,80 | 29,52 | 9,19 | 1,29 m | B | ✅ |
| `.contacts-panel h2` | 1,55 | 25,42 | 7,91 | 1,11 m | B | ✅ |
| `.waste-date strong` | 1,50 | 24,60 | 7,66 | 1,07 m | B | ✅ |
| `.notice-body` | 1,45 | 23,78 | 7,40 | 1,04 m | B | ✅ |
| `.contact-primary`, `.contact-phone`, `.waste-name`, `.weather-desc`, `.market-current`, `.market-fuel-price`, `.euribor-current`, `.bus-relative` | 1,41 token | 23,12 | 7,20 | 1,01 m | B | ✅ |
| `.contact-secondary`, `.section-kicker`, `.small-label`, `.market-title`, `.market-stat strong`, maja C-väärtused | 1,05 token | 17,22 | 5,36 | 0,75 m | C | ✅ |
| `.market-meta`, `.market-card-source`, `.market-stat span`, `.market-chart-label`, `.market-chart-scale`, `.house-trend-value`, `.house-year-meta`, `.statusbar` | 0,75 token | 12,30 | 3,83 | 0,54 m | D | ✅ |

`scale` alampiiri ei tõstetud 0,85-ni, sest uue 1,41rem B-tokeniga täidab olemasolev 0,82 juba 23 px nõude. Nii säilib senine paigutusskaala ilma loetavuspiiri rikkumata.

## Testid selles keskkonnas

- ✅ `npm run build:fallback`
- ✅ `KU_ALLOW_STALE_VISUAL_BASELINE=1 npm run preflight` — 125 kontrolli läbitud; visuaalbaseline'i stale-hoiatus teadlikult alles
- ✅ kõik genereeritud `dist/src/*.js` failid `node --check`
- ✅ koondatud Apps Scripti `node --check`
- ✅ `public/sample-data.json` JSON-parsimine
- ⚠️ `tsc --noEmit`: arendussõltuvused (`@types/node`, `vitest/globals`) pole selles konteineris installitud
- ⚠️ Vitest/Vite/Node Playwright/oxlint/Biome: `node_modules` puudub
- ⚠️ Chromiumi 1920 × 1080 renderdus: keskkonna hallatud Chromiumil on `URLBlocklist: ["*"]`; lokaalse URL-i avamine annab `ERR_BLOCKED_BY_ADMINISTRATOR`
- ⚠️ tavaline `npm run preflight` jääb tahtlikult punaseks, kuni 4.2.0 PNG-baseline'id on päriselt genereeritud

## Kohapealne testinimekiri

1. **Loetavus:** A-tase 1–1,5 m; B 0,5–1 m; C ~0,75 m; D ~0,5 m.
2. **Pikk teade:** sisesta ~1200–4000 märki; kontrolli, et kiri ei lähe B-tasemest väiksemaks ja `lk 1/n` liigub järgmisele lehele.
3. **4-leheküljeline teade:** `?demo=1`, max fixture või pikk teade; oota rotatsiooni ning kinnita lk 1→2→3→4.
4. **Võrgukatkestus:** eemalda võrk vähemalt 10 min; kell/buss/prügivedu peavad edasi töötama, cache jääb nähtavaks, reload-tsüklit ei teki.
5. **Katkine turuallikas:** test-deploymentis riku ajutiselt üks allika URL; esimese vea järel ei tohi 15 min sama allikat uuesti pärida, last-known-good jääb ekraanile.
6. **Aegunud bussigraafik:** testi ajaga pärast 27.04.2027; bussi allikareal peab olema `Sõiduplaan vajab kontrolli`.
7. **Kesköö:** testi 23:59→00:01 Europe/Tallinn; prügiveo `Täna/Homme`, bussid ja kuupäev peavad ümber arvutuma.
8. **Öine reload:** jäta scheduler 04:10 minutist üle; järgmine maintenance-tick peab ikkagi tegema ainult ühe reload'i selle päeva kohta.
9. **Demo heartbeat:** ava kioskis `?demo=1` üle 4 minuti; watchdog ei tohi Edge'i taaskäivitada.
10. **Port:** käivita watchdog mittestandardsel testpordil; Edge'i protsessi tuvastus peab kasutama sama `$Port` väärtust.
11. **Visuaalbaseline:** internetiga dev-masinal `npm ci && npm run test:visual:update && npm run preflight`; alles siis märgi 4.2.0 visuaalvärav läbituks.
12. **Token:** `git ls-files config.js public/config.js` peab olema tühi; päris tokeni lekke korral `rotateFeedToken()` ja kioskikonfi uuendus.

---

# KÜ infoekraan 4.1.0 – maja tarbimise täiendus

## 4.1.0

- Maja tarbimise paneelil on kolm püsiva mõõduga vaadet: viimane kuu, kuni 12 kuu trendid ja jooksva aasta koond.
- Vaated roteeruvad iga 8 sekundi järel olemasoleva keskse scheduleri `time-sensitive` tikiga; uut `setInterval`-i ei lisatud.
- Viimase kuu vaade näitab väärtust ja muutust võrreldes vahetult eelmise kalendrikuuga.
- Trendivaates on iga näitaja oma andmetest skaleeritud SVG sparkline, kuid kasutajaliidesest eemaldati tekst „iga näitaja oma skaalal“.
- Aastavaade summeerib ainult olemasolevaid numbrilisi väärtusi ja näitab andmetega kuude arvu.
- Lisatud on `tests/unit/house-consumption.spec.ts`.
- Fallback-build, 53 preflight-kontrolli, kogu `src/**` range TypeScripti kontroll ja genereeritud JavaScripti süntaksikontroll läbisid.
- Selles konteineris blokeeris Chromium kohaliku URL-i poliitikaga `ERR_BLOCKED_BY_ADMINISTRATOR`, seetõttu ei märgita 1920×1080 runtime-visuaalkontrolli siin läbituks.

---

# KÜ infoekraan 4.0.0 – teostus- ja kontrolliraport

## 1. Tulemus

Projekt moderniseeriti etapiviisiliselt Vite + TypeScripti raamistikuta ES-moodulrakenduseks. Runtime-sõltuvusi ei lisatud, Google Sheetsi skeem ja Windowsi kioskiloogika säilitati ning lähteversiooni kinnitatud P0/P1/P2 probleemid parandati.

Olulised arhitektuurilised tulemused:

- `dependencies` on tühi; brauseris ei kasutata ühtegi kolmanda osapoole runtime-teeki;
- runtime `config.js` jääb buildist välja ja kioskiserver serveerib seda eraldi;
- ainus `setInterval` asub `src/app/scheduler.ts` failis;
- kõik paneelid kasutavad `mount()` / `update()` / `destroy()` elutsüklit;
- välised andmed läbivad `src/data/validate.ts` type guard'id;
- olekumuutused põhinevad `sectionVersion` loenduritel, mitte `JSON.stringify` hashil;
- fetch on esmane ja piiratud JSONP-varuvariant säilib;
- IndexedDB, sektsioonipõhine last-known-good ja täielik offline-käitumine säilivad;
- service workerit ei lisatud ning vana registreeringu eemaldamine säilib;
- valmis kioskibuild asub `dist/` kaustas.

## 2. Auditi leidude teostus

### P0

| ID | Leid | Olek | Teostus | Põhifailid |
|---|---|---|---|---|
| P0-1 | Pikal internetikatkestusel korduv reload-tsükkel | **Parandatud** | `sessionStorage` võti `ku-reload-log`, ainult viimase 6 h ajatemplid, maksimaalselt üks watchdog-reload kuue tunni kohta; offline-olekus reload'i ei tehta. | `src/app/lifecycle.ts` |
| P0-2 | Seadistamata kiosk reloadib iga minut | **Parandatud** | `lastSuccessfulSyncMs === 0` korral järelevalve lõpetab töö ilma reload'ita; seadistusviga jääb jaluses püsivalt nähtavaks. | `src/app/lifecycle.ts`, `src/app/bootstrap.ts`, `src/ui/panels/status-bar.ts` |

### P1

| ID | Leid | Olek | Teostus | Põhifailid |
|---|---|---|---|---|
| P1-1 | Pika teate lehekülg 2+ ei jõudnud ekraanile | **Parandatud ja brauseris kontrollitud** | Teksti mõõdetakse peidetud kloonil, mõõtmevõti tuletatakse ühest allikast ja arvutatud lehed jäävad paneeli olekusse. 4200 tähemärgi testis liikus `lk 1/4` väärtusele `lk 2/4`. | `src/ui/text-fit.ts`, `src/ui/panels/notices.ts` |
| P1-2 | Eilne elektrihind kuvati hetkehinnana | **Parandatud** | Kui andmete kuupäev ei ole Tallinna ajavööndi tänane kuupäev, kuvatakse hetkehinna asemel `–` ja vananenud andmete märge. | `src/domain/electricity/price.ts`, `src/ui/panels/market-electricity.ts` |
| P1-3 | Puuduv Sheetsi leht kustutas head andmed | **Parandatud** | Server tagastab iga lehe kohta `present`, `ok` ja `missing`; klient ei asenda sektsiooni, kui see on puudu või vigane. | `apps-script/Sheets.gs`, `apps-script/Code.gs`, `src/data/merge.ts` |
| P1-4 | Külm `doGet` võis ületada 15 s | **Parandatud koodis; Google runtime'is mõõtmata** | Lisati `LockService.getScriptLock().tryLock(5000)`, elektri-, kütuse- ja Euribori päringud koondati `UrlFetchApp.fetchAll()` kutseks ning kliendi timeout tõsteti 20 sekundile. | `apps-script/Code.gs`, `apps-script/Sources.gs`, `src/data/apps-script-client.ts` |
| P1-5 | Ühelõimeline kohalik HTTP-server | **Parandatud koodis; Windowsis lõplikult testimata** | Päringuid käsitletakse paralleelsetes C# `Task`-ides, receive timeout on 1000 ms ja `/healthz` on kiire tee. | `kiosk/local-server.ps1` |
| P1-6 | Elektri ühikuheuristika põhjustas absurdseid hindu | **Parandatud** | Ühik on valideeritud kohustuslik väli; ühikuta väärtus on vigane ja UI kuvab `–`. Madalaid ning negatiivseid hindu ei tõlgendata enam suurusjärgu järgi ümber. | `src/domain/electricity/price.ts`, `src/data/validate.ts` |
| P1-7 | Sheetsi kuupäevapõhine lõpukuupäev polnud kaasav | **Parandatud** | Kuupäev ilma kellaajata teisendatakse serveris Tallinna ajavööndi päeva lõpuks 23:59:59.999; ajatemplit käsitletakse täpse hetkena. | `apps-script/Sheets.gs`, `apps-script/Code.gs` |

### P2 ja turbekõvendused

| ID | Leid | Olek | Teostus | Põhifailid |
|---|---|---|---|---|
| P2-1 | Turugraafikute täielik DOM-i taasloomine iga minut | **Parandatud** | Elektri- ja Euribori graafikud luuakse ühe korra ning `update()` patch'ib muutunud geomeetria ja klassid. | `src/ui/charts/electricity-chart.ts`, `src/ui/charts/euribor-chart.ts` |
| P2-2 | Ajadomeen ja 67 ilmatõlget olid kliendis/serveris duplitseeritud | **Parandatud** | Üks TypeScripti allikas `src/domain/**`; Apps Scripti `Domain.gs` genereeritakse tööriistaga. | `src/domain/**`, `tools/generate-appsscript-domain.ts`, `apps-script/Domain.gs` |
| P2-3 | JSON-hashid ja kogu andmestiku sügavkoopia | **Parandatud** | Struktuurne merge ja sektsioonide täisarvulised versiooniloendurid. | `src/data/merge.ts`, `src/app/store.ts` |
| P2-4 | Prügiveo vigane sagedus vaikis ning ankrupäeva nädalapäeva ei kontrollitud | **Parandatud** | Parser tagastab vead/hoiatused, tundmatu sagedus ei degradeeru vaikselt ning kahe nädala ankur peab vastama määratud nädalapäevale. | `src/domain/waste/frequency.ts`, `src/domain/waste/occurrences.ts` |
| P2-5 | Apps Scripti elektripayload sisaldas korduvaid välju | **Parandatud** | Iga punkt sisaldab ainult aega ja lõpphinda; tariifi meta jääb üks kord sektsiooni tasemele. 96 elektri + 135 Euribori sünteetiline vastus oli ligikaudu 15,5 KiB. | `apps-script/Sources.gs`, `apps-script/Code.gs` |
| P2-6 | Server serveeris kogu projektipuud ja Edge'i profiili | **Parandatud** | Serveri juur on ainult `dist`; runtime `config.js` on ainus erand. Lubatud laiendite loend, CSP, `nosniff`, `no-referrer` ja frame-blokeering. Edge'i profiil asub `%LOCALAPPDATA%\KuInfoekraan\edge-profile`. | `kiosk/local-server.ps1`, `kiosk/start-kiosk.cmd` |
| P2-7 | Demoandmed sõltusid kalendrikuupäevast | **Parandatud** | Fixture'i generaator ja Playwrighti külmutatud kell; kuus determineeritud 1920 × 1080 baseline'i. | `tests/fixtures/make-demo-data.ts`, `tests/e2e/visual.spec.ts` |
| P2-8 | Viis prügirida laienes 31 esinemiseks ja seitsmeks leheks | **Parandatud** | Tavavaates kuvatakse iga jäätmeliigi järgmine vedu; täielik esinemiste loend jääb diagnostikasse. | `src/domain/waste/occurrences.ts`, `src/ui/panels/waste.ts` |
| P2-9 | Surnud CSS/HTML | **Parandatud** | Vanad `.compact-market-head`, `.market-axis` ja `#marketColumn` eemaldati; monoliitne CSS jagati paneelifailideks. | `index.html`, `src/styles/**` |
| P2-10 | Teema ja kuupäeva DOM-kirjutus iga sekund | **Parandatud** | Kell jääb sekundiliseks, kuid kuupäev ja teema kirjutatakse ainult väärtuse muutumisel. | `src/ui/panels/clock.ts` |
| S-01 | Edge'i profiil oli serveeritava juure all | **Parandatud** | Profiil koliti LocalAppData alla. | `kiosk/start-kiosk.cmd` |
| S-02 | CSP puudus | **Parandatud** | Lisati lokaalse rakenduse ja Apps Scripti transporti lubav piiratud CSP. Dünaamiliste CSS-muutujate tõttu on `style-src` all teadlikult `'unsafe-inline'`. | `kiosk/local-server.ps1` |
| S-03 | DevTools jäi kioskikontol avatavaks | **Parandatud paigaldusskriptis** | `DeveloperToolsAvailability=2` Microsoft Edge'i masinapoliitikas. | `kiosk/install-scheduled-task.ps1` |
| S-05 | Väliste tekstide pikkus polnud piiratud | **Parandatud** | Kõik tekstiväljad läbivad pikkuspiiridega `clampText()` valideerimise. | `src/data/validate.ts` |
| S-06 | Debug-viga võis sisaldada tokenit | **Parandatud** | Tokeni query-parameeter redigeeritakse enne logimist ja debug-overlay'd. | `src/diagnostics/logger.ts`, `src/diagnostics/debug-overlay.ts` |
| S-07 | JSONP tee ei valideerinud endpointi eraldi | **Parandatud** | Üks valideeritud `URL` luuakse enne nii fetch- kui JSONP-transporti; lubatud on ainult Apps Scripti `/exec` muster. | `src/config/config-schema.ts`, `src/data/apps-script-client.ts` |

## 3. Etapid ja commit'id

| Etapp | Sisu | Commit / tulemus |
|---|---|---|
| 0 | Lähteseis Git'i ja mõõtmiste alus | `e08d33f` |
| 1 | P0 watchdog hotfix ainult vana `app.js` peal | `7766f67` |
| 2 | Käitumislepingute testiskelett | `d010337` |
| 3 | Vite + TypeScript skelett, runtime-config `public/` alla | `396b3f9` |
| 4 | Puhas domeeniloogika ja Apps Scripti domeenigeneraator | `596d185` |
| 5 | Andmekiht, valideerimine, LKG, transport | `cff5011` |
| 6 | Scheduler, store, lifecycle ja sectionVersion | `44522fe` |
| 7 | 13 paneeli, graafikute patchimine, teate teksti sobitus | `250915c` |
| 8 | CSS jagamine tokeniteks ja paneelifailideks | `aaba95a` |
| 9 | Apps Scripti adapterid, fetchAll, puuduv vs tühi leht | `d1a9d1c`, `af0024f` |
| 10 | Kioskiserveri ja Windowsi skriptide kõvendamine | `13e55cd`, `d51444e` |
| 11 | Determineeritud demoandmed ja visuaalregressioon | `f7de9c3` |
| 12 | Runbook, lepingud, baseline, changelog, vana `sw.js` eemaldamine | dokumentatsiooni commit (vt `git log`) |

Iga commit jätab projekti loogiliselt taastatavasse olekusse. Detailne rollback on `docs/runbook.md` failis.

## 4. Säilitatud käitumislepingud

Kõik ülesandes nimetatud lepingud on kaardistatud `docs/contracts.md` faili. Eriti säilisid:

- sekundiline kell ja eesti kuupäev ajavööndis `Europe/Tallinn`;
- ööteema 22:00–06:00 ja 04:10 üks kord päevas hooldusreload;
- 12 Eesti riigipüha, riigipühal pühapäevane bussigraafik ning liini 7 kooliaeg;
- kaks järgmist bussi mõlemas suunas kuni seitse päeva ette;
- kõik kokkulepitud prügiveo sagedused ja 30 päeva aken;
- 5 kontakti / 5 olulist kontakti / 5 prügiliiki koos rotatsiooniga;
- `has-notices` / `no-notices` dünaamiline paigutus;
- kliendipoolne teate kehtivus ka offline-režiimis;
- elektri hinna valem, päeva/öö tariif, 24% KM ning tunni- ja 15-minutilised perioodid;
- maja neli viimast andmetega kuud;
- Keskkonnaagentuuri mõõtmise eelistus ja eestikeelne nähtus;
- 95/98/D kütus ning 6 kuu Euribor;
- sektsioonipõhine last-known-good ja üle 24 h vananemishoiatus;
- IndexedDB `ku-infoekraan` / `cache` / `dashboard-data-v6`;
- fetch + JSONP callback muster `^kuInfoCallback_[0-9A-Za-z_]+$`;
- demorežiimis null välispäringut ja null reload'i;
- `/healthz` vastus `KU-INFOEKRAAN-OK`;
- täpselt samad Google Sheetsi lehtede ja veergude nimed;
- kontakti e-posti aadressi mitte saatmine;
- `--scale: 0.82`, soe visuaal, peidetud kursor ja blokeeritud kontekstimenüü;
- service workeri puudumine ning vana registreeringu retire-loogika.

## 5. Kontrollitulemused

### Edukalt käivitatud

| Kontroll | Tulemus |
|---|---|
| `npm run check:fallback` | Läbitud |
| Fallback build | `dist/` genereeritud |
| `tools/preflight.mjs` | **53 kontrolli läbitud** |
| Lähtekoodi strict typecheck globaalse TypeScript 5.8.3-ga | Läbitud (`src/**/*.ts`) |
| Kõigi genereeritud `dist/src/*.js` failide `node --check` | Läbitud |
| Koondatud Apps Scripti JavaScripti `node --check` | Läbitud |
| `setInterval` otsing | 1 vaste, ainult `src/app/scheduler.ts` |
| `innerHTML` / `insertAdjacentHTML` otsing | 0 vastet |
| `serviceWorker.register` otsing | 0 vastet |
| Tokeni/`PASTA_SIIA` kontroll buildis | 0 leidu; `dist/config.js` väärtused tühjad |
| Chromium 1920 × 1080 – kuus olekut | Kõigis 0 dokumendi/paneeli overflow'd ja 0 page error'it |
| Pika teate rotatsioon | `lk 1/4` → `lk 2/4` |
| Tavavaate DOM | 445 elementi, 50 SVG alamelementi, 7 paneeli |

Brauseris kontrollitud kuus olekut:

1. `?demo=1` aktiivse teatega;
2. `?demo=1&notices=0`;
3. ööteema;
4. ainult IndexedDB cache;
5. üle 24 h vana info koos hoiatusribaga;
6. 1200 tähemärgi teade, 8+8 kontakti, 10 prügirida, 96 elektripunkti ja 135 Euribori punkti.

### Npm kvaliteediväravate olek selles konteineris

Npm registri DNS ei olnud kättesaadav ja `node_modules` puudus. Seetõttu käivitati käsud, kuid need ei saanud sõltuvusteta lõpuni minna:

| Käsk | Tulemus selles keskkonnas |
|---|---|
| `npm run lint` | `oxlint: not found` |
| `npm run typecheck` | `@types/node` ja `vitest/globals` tüübid puuduvad; eraldi source-only typecheck läbis |
| `npm run test` | `vitest: not found` |
| `npm run build` | `vite: not found` |
| `npm run test:visual` | Node Playwrighti CLI puudub; sama testimaatriks käivitati Python Playwrightiga |

Need käsud tuleb internetiga arendusmasinas pärast `npm install` / `npm ci` käivitada. Paketis ei ole `package-lock.json` faili, sest seda ei saa usaldusväärselt genereerida ilma registrita; esimese internetiga paigalduse juhis on README-s ja runbookis.

### Visuaalse pixel-diff'i aus tulemus

Kaasas olnud dünaamilise lähte-PNG ja uue determineeritud kuvatõmmise täpne võrdlus andis 4,61% muutunud piksleid, mitte ülesandes seatud 0,05–0,3%. See võrdlus ei ole võrreldava kella, sisu ega sama rasterdajaga. Seetõttu ei väideta, et vana PNG suhtes on pixel-diff värav läbitud. Uueks stabiilseks lähteks on kuus külmutatud Playwrighti baseline'i; need tuleb ametliku Node Playwrightiga internetiga arendusmasinas üle vaadata ja kinnitada.

## 6. Google Apps Script ja Windows – vajalikud sihttestid

Linuxi teostuskeskkonnas ei olnud Google Apps Scripti runtime'i, Windows PowerShell 5.1, Task Schedulerit ega päris Microsoft Edge'i kioskiseanssi. Enne tootmisse paigaldamist tuleb sihtkeskkonnas kontrollida:

1. külm `doGet` p95 kestus ja eesmärk ≤ 8 s;
2. puuduva ning tühja Sheetsi lehe erinevus;
3. kuupäevapõhise `Lõpp` välja kaasavus;
4. kümme paralleelset HTTP-päringut ja üks vaikiv sokkel; `/healthz` peab jääma alla 200 ms;
5. `/watchdog.ps1`, `/apps-script/Code.gs` ja muud keelatud teed peavad andma 404;
6. CSP päis ja JSONP-varuühendus;
7. Edge'i eraldi profiil, DevTools-poliitika ja fullscreen kiosk;
8. renderdaja heartbeat ning krahhist taastumine ≤ 210 s;
9. Task Scheduleri `Restart on failure`;
10. internetikaabli eemaldamisel kell, bussid, prügivedu, teate aegumine ja cache.

## 7. Eeldused

- Microsoft Edge on vähemalt versioon 120; buildi siht `edge111` on konservatiivne.
- Sheetsi kuupäev ilma kellaajata väljal `Lõpp` tähendab kaasavat kohaliku päeva lõppu.
- Prügiveo tavavaade näitab iga liigi järgmist vedu; kõik esinemised on diagnostikas.
- Sõiduplaani `validUntil` jääb `null`, kuni ametlikus allikas on tegelik lõppkuupäev.
- Kioskikonto on tavakasutaja automaatse sisselogimisega; Assigned Access on soovitatav, kuid mitte eeltingimus.
- Apps Scripti Web Appi URL + jagatud token on praktiline ligipääsutõke, mitte tugev kasutajapõhine autentimine.

## 8. Jääkriskid

1. **Npm lock-fail puudub.** Esimesel internetiga arendusmasinal tuleb käivitada `npm install`, üle vaadata resolved versioonid ja lisada `package-lock.json`.
2. **Ametlikud npm kvaliteediväravad on selles keskkonnas käivitamata.** Fallback-kontrollid ja brauseritestid läbisid, kuid need ei asenda Vitesti, oxlinti, Biome'i, Vite'i ega Node Playwrighti.
3. **Windowsi runtime on testimata.** PowerShelli skriptid on hoitud Windows PowerShell 5.1 süntaksiga, kuid paralleelsus, Scheduled Tasks, registripoliitika ja Edge'i krahhitaaste vajavad päris masinat.
4. **Apps Scripti jõudlus on mõõtmata.** `fetchAll` ja lukk on rakendatud, kuid külma `doGet` p95 tuleb Google'is mõõta.
5. **Vana PNG täpne visuaalvärav ei ole läbitud.** Tulevikus kasutatakse determineeritud baseline'e; esmane heakskiit vajab inimese visuaalset ülevaatust.
6. **Jagatud token on kliendis loetav.** DevTools on poliitikaga keelatud ja referrer blokeeritud, kuid tokenit ei tohi käsitleda tugevate kasutajaõigustena; kvartaalne rotatsioon on soovitatav.
7. **JSONP nõuab script.google.com lubamist CSP-s.** See on säilitatud lepinguline varuvariant ja suurem ründepind kui tavaline fetch.

## 9. Kasutuselevõtt ja rollback

Täielik samm-sammuline juhis on failis `docs/runbook.md`. Lühidalt:

1. internetiga arendusmasinal `npm install`, seejärel `npm run check`, `npm run test:visual` ja `npm run build`;
2. avalda uus Apps Scripti deployment, eelmine jäta vähemalt 7 päevaks alles;
3. varunda kioskikaust `C:\KuInfoekraan.prev`;
4. asenda `dist/` ja `kiosk/`, kuid **ära kirjuta üle `config.js`**;
5. kontrolli `/healthz`, demo-, teatevaba ja debug-vaadet;
6. tõrke korral taasta eelmine frontend või suuna `appsScriptUrl` tagasi eelmisele deployment'ile.
