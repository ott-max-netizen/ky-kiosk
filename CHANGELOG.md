# Muudatused

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
