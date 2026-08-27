# Säilitatavad käitumislepingud

| ID | Leping | Rakendus / kontroll |
|---|---|---|
| C-01 | Kell liigub sekundilise täpsusega ajavööndis `Europe/Tallinn`; kuupäev on eesti keeles. | `ClockPanel`, E2E |
| C-02 | Ööteema on 22:00–06:00 ja üle kesköö. | `ClockPanel`, visual `demo-night.png` |
| C-03 | Arvestatakse kõiki 12 Eesti riigipüha; 2. ülestõusmispüha ei ole püha. | `domain/time/holidays`, preflight |
| C-04 | Riigipühal kasutatakse pühapäevast bussigraafikut. | `domain/bus/day-type`, unit |
| C-05 | Liin 7 töötab 01.09–10.06 kaasavalt. | `domain/bus/day-type`, unit |
| C-06 | Kuvatakse kaks järgmist bussi suuna kohta, kuni 7 päeva ette. | `domain/bus/departures` |
| C-07 | Bussi suhteline aeg on „väljub nüüd“, „18 min pärast“ või „1 h 12 min pärast“. | unit / preflight |
| C-08 | Prügiveos toetatakse `Iga: T, R`, `Iga: N`, `Kord 2 nädala tagant N` ja ühekordset vedu. | `domain/waste` |
| C-09 | Mitmenädalase veo `Kuupäev` on tsükli ankur ja vale nädalapäev annab hoiatuse. | `domain/waste`, unit |
| C-10 | Prügiveo aken on 30 päeva ja tavavaates näidatakse iga liigi järgmist vedu. | `WastePanel` |
| C-11 | `maxContacts`, `maxEmergency`, `maxWaste` on 5; ülejäänu roteeritakse. | panelid / visual max |
| C-12 | Teatega kasutatakse `has-notices`, teate puudumisel `no-notices`. | `NoticesPanel`, visual |
| C-13 | Teadete algus/lõpp kontrollitakse kliendis ja offline. | `domain/notices` |
| C-14 | Pikk teade jaguneb lehekülgedeks ja lehed liiguvad edasi. | `text-fit`, E2E 4 lehekülge |
| C-15 | Elektrihind kasutab explicit `unit` väärtust; ühikuta hind on vigane. | `domain/electricity/price` |
| C-16 | Elektri ostuhind kasutab tariife, 24% KM-i ja päeva/öö reeglit. | `domain/electricity/tariff` |
| C-17 | Toetatud on tunni- ja 15-minutilised elektriperioodid. | chart / fixture 96 punkti |
| C-18 | Eilset elektrihinda ei näidata praeguse hinnana. | `MarketElectricityPanel` |
| C-19 | Maja paneelil on kolm fikseeritud mõõduga vaadet: viimane kuu, kuni 12 kuu trendid ja jooksva aasta koond; vaade vahetub iga 8 s. | `domain/house`, `HousePanel`, visual |
| C-20 | Keskkonnaagentuuri vaatlus on eelistatud; tundmatu ingliskeelne nähtus ei leki UI-sse. | `domain/weather` |
| C-21 | Kütus: 95/98/D, varuallikas võib jätta 98 tühjaks. | `Sources.gs`, `MarketFuelPanel` |
| C-22 | Euribor: 6M, päevane, kuni 135 punkti. | `Sources.gs`, chart |
| C-23 | Sektsioonipõhine last-known-good säilib ka puuduva Sheetsi lehe korral. | `mergeIncoming`, contract |
| C-24 | Üle 24 h vanad andmed näitavad nähtavat hoiatusriba. | visual stale |
| C-25 | IndexedDB on `ku-infoekraan` / `cache` / `dashboard-data-v6`. | repository / E2E cache |
| C-26 | Fetch on esmane, JSONP varuvariant ja callback vastab mustrile `^kuInfoCallback_[0-9A-Za-z_]+$`. | data transport |
| C-27 | Retry on 30 s → ×2 → max 300 s. | bootstrap / integration |
| C-28 | Reload toimub pärast 04:10 sihtaega üks kord kalendripäevas ka siis, kui täpne minut jäi vahele; ajalugu säilib localStorage-is. Watchdog teeb max ühe reload'i 6 h jooksul ja mitte offline. | lifecycle / unit |
| C-29 | Demorežiimis pole väliseid andmepäringuid ega reload'e; lokaalset `/heartbeat` signaali saadetakse edasi. | bootstrap / E2E |
| C-30 | `/healthz` tagastab 200 + `KU-INFOEKRAAN-OK`. | kiosk server / smoke |
| C-31 | `config.js` on Gitist välistatud runtime-fail; URL ja token ei lähe buildi. Versioonihalduses on ainult `config.example.js`. | build contract / preflight |
| C-32 | Google Sheetsi lehtede ja veergude nimed ei muutu. | `Sheets.gs`, contract |
| C-33 | Kontakti e-posti ei saadeta kliendile. | `Code.gs`, validator |
| C-34 | `--scale: 0.82`, 1920 × 1080 paigutus ja soe visuaal säilivad. | CSS / visual |
| C-35 | Kontekstimenüü ja lohistamine on blokeeritud, kursor peidetud. | UI guards / CSS |
| C-36 | Service workerit ei registreerita; vanad registreeringud eemaldatakse. | lifecycle / smoke |
| C-37 | Windowsi server, käivitus, watchdog ja Task Scheduler jäävad kasutatavaks. | `kiosk/`, Windowsi käsitest |


## Väliste turuallikate lepingud

| Allikas | Oodatav kuju | Kasutus | Tõrkekäitumine |
|---|---|---|---|
| Elering / Nord Pool EE | JSON; `data.ee[]` või `data.EE[]`, igal hinnareal numbriline `timestamp` ja `price` | tänane elektri börsihind | 15 min negatiivne cache; last-known-good jääb kliendis alles |
| OpenVan.camp | JSON; `data.EE.prices`, 95 väljal `gasoline`/`gasoline_regular`, 98 `gasoline_premium`/varuvariandid, diisel `diesel`/`diesel_regular` | Eesti 95/98/D keskmine | EuroOilWatch varuallikas; seejärel 15 min negatiivne cache |
| EuroOilWatch | JSON; `countries[]`, Eesti `countryCode=EE`, `petrolPrice`, `dieselPrice` | 95/D varuallikas; 98 puudub | 15 min negatiivne cache |
| Soome Pank | XML või HTML ReportViewer; päevaread, millest parser loeb 6 kuu Euribori | 6M Euribor päevase ajalooga | 15 min negatiivne cache; parser on teadlik jääkrisk |

Offline unit/contract-testid kontrollivad parserite lähtelepinguid staatiliselt. Internetiga release-kontroll `npm run test:sources` teeb allikatele live-smoke päringu ja kukub läbi, kui põhiline kuju on muutunud.

## 4.2.0 loetavusleping

1920 × 1080 ja minimaalse runtime skaalaga `0.82` peavad tasemed olema vähemalt: A 34 px, B 23 px, C 17 px, D 12 px. `tools/preflight.mjs` kontrollib tokenid ja kriitilised selektorid. Teate `text-fit` ei tohi minna B-tasemest väiksemaks ning cache on piiratud 32 kirjega.

Bussigraafiku `validUntil` on hoolduslik kontrolltähtaeg, mitte ametliku vedaja avaldatud lõppkuupäev. Selle ületamisel peab UI näitama `Sõiduplaan vajab kontrolli`.
