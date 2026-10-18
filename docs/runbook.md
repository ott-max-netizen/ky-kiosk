# KÜ infoekraani runbook

## 1. Esmane paigaldus

1. Paigalda Windowsi kioskikontole Microsoft Edge ja määra ekraan 1920 × 1080 / 100% skaleeringule.
2. Kopeeri projekt näiteks kausta `C:\KuInfoekraan`.
3. Veendu, et kaustas on `dist`, `config.js` ja `kiosk`.
4. Kopeeri `config.example.js` failiks `config.js` ning määra Apps Scripti `/exec` URL ja `feedToken`. `config.js` peab jääma Gitist välja.
5. Ava administraatori PowerShell ning käivita:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
C:\KuInfoekraan\kiosk\install-scheduled-task.ps1 -Root C:\KuInfoekraan
```

6. Kontrolli:

```powershell
Invoke-WebRequest http://127.0.0.1:8765/healthz -UseBasicParsing
```

Vastus peab olema `KU-INFOEKRAAN-OK`.

## 2. Google Apps Scripti kasutuselevõtt

1. Ava Google Sheetis **Laiendused → Apps Script**.
2. Lisa `Domain.gs`, `Sheets.gs`, `Sources.gs`, `Code.gs` ja `appsscript.json`.
3. Käivita `setup()`.
4. Käivita `getFeedTokenForSetup()` ja kopeeri token kioskimasina `config.js` faili.
5. Avalda Web App: käivitaja **Me**, ligipääs selline, et kiosk ei vaja Google'i interaktiivset sisselogimist.
6. Kopeeri `/exec` URL `config.js` faili.
7. Pärast Apps Scripti muudatust avalda alati **uus versioon**; hoia eelmist deployment'i vähemalt 7 päeva.

## 3. Frontendi uuendamine

1. Arvutis, kus npm registrile on ligipääs, kasuta versioonihalduses olevat `package-lock.json` faili ja paigalda sõltuvused reprodutseeritavalt:

```bash
npm ci
npm run check
npm run test:visual
npm run test:sources   # internetiga release-smoke
npm run measure:check  # 24 h kiirendatud Chromium + DOM/SVG eelarve
npm run build
```

> **4.5.0 seis:** `tests/e2e/snapshots/build-version.txt` on `4.5.0` ja `npm run check`
> läbib. Kuus PNG-baseline'i on renderdatud Linuxi Chromium 1194-ga (vt
> `docs/baseline.md`) ning need on arendus- ja CI-keskkonna võrdlusalus. Windowsi/Edge'i
> masinal erineb teksti rasterdus, seega võivad `npm run test:visual` PNG-võrdlused seal
> kukkuda ilma päris regressioonita. Seal tee **A/B võrdlus**: genereeri võrdluspildid
> eelmise release'i koodiga ja võrdle uut koodi nende vastu. Repos pole release-tag'e,
> seega kasuta eelmise release'i commit'i `main`-is (4.5.0 järelparanduste võrdlusalus
> on `99e557e`):
>
> ```powershell
> git worktree add ..\prev 99e557e
> cd ..\prev; npm ci; npx playwright test --update-snapshots
> Copy-Item ..\prev\tests\e2e\snapshots\*.png <uus-checkout>\tests\e2e\snapshots\
> cd <uus-checkout>; npx playwright test
> ```
>
> Teadlikud renderdusmuudatused ilmuvad erinevustena ja need tuleb silmaga üle vaadata.
> Lõpuks taasta commit'itud pildid (`git checkout -- tests/e2e/snapshots`). **Ära genereeri
> võrdluspilte testitava koodiga**, sest siis läbib võrdlus ka päris regressiooni korral.
> Ära commit'i Windowsis genereeritud PNG-sid. Pikslitest sõltumatu
> `tests/e2e/layout-audit.spec.ts` (kontrast, lõikumine, SVG sildid, kuupäevad) peab
> läbima igas Chromiumis; selle tõrge on päris viga.

Jõudluse kontrollmõõtmine on release-checklisti osa:

```bash
npm run measure:check
```

Käsk ehitab rakenduse, simuleerib Chromiumis 24 tundi ja kukub läbi, kui
dünaamiliselt luuakse üle **1000 HTML-** või **200 SVG-elemendi**. 4.3.0
mõõdetud baas oli vastavalt 266 ja 64, seega jätab värav teadliku varu, kuid
püüab kinni paneeli tagasimineku „lammuta ja ehita iga tick uuesti“ mustrisse.
Mõõdetud võrdlusarvud on `docs/baseline.md` failis.

2. Tee kioskimasinas varukoopia:

```powershell
robocopy C:\KuInfoekraan C:\KuInfoekraan.prev /MIR /XD edge-profile node_modules .git /XF config.js
```

3. Asenda `dist` ja `kiosk` kaustad. **Ära kirjuta üle juurkausta `config.js` faili.**
4. Taaskäivita ajastatud ülesanded või käivita `kiosk\start-kiosk.cmd`.
5. Kontrolli demo-, teatevaba ja debug-vaadet.

### Windowsi kioskiskriptide käsitest (C-30, C-37)

Tee pärast `kiosk/` kausta uuendamist. Linuxis kontrollib `tests/contract/kiosk-server.spec.ts`
ainult serveri C# koodi (Mono, C# 5, hoiatused = vead); PowerShelli, Edge'i ja Task
Scheduleri osa saab kontrollida ainult kioskimasinas.

Sammud 1–3 tehakse käsitsi käivitatud serveriga, seega peata enne mõlemad ülesanded.
Muidu käivitab watchdog 30 s jooksul oma serveri ja käsitsi käivitatud server lõpetab
vaikselt (`exit 0`, sest port 8765 on juba KÜ serveri käes).

1. **Server kompileerub.** Administraatori PowerShellis:

   ```powershell
   Stop-ScheduledTask -TaskName 'KU Infoekraan Watchdog'
   Stop-ScheduledTask -TaskName 'KU Infoekraan Server'
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\KuInfoekraan\kiosk\local-server.ps1 -Root C:\KuInfoekraan\dist
   ```

   Aken peab jääma tööle. Vea `Cannot add type. Compilation errors occurred` korral ära
   paigalda; taasta eelmine `kiosk` kaust. Kui aken sulgub kohe ilma veata, vastab
   pordil 8765 juba teine KÜ server: kontrolli, et mõlemad ülesanded on peatatud.
2. **`/healthz` ilma ühenduse lähtestamiseta.** Teises PowerShelli aknas:

   ```powershell
   curl.exe -sv http://127.0.0.1:8765/healthz
   1..20 | ForEach-Object { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/healthz -TimeoutSec 2).Content }
   ```

   Iga vastus peab olema `200` + `KU-INFOEKRAAN-OK`, ilma `Connection reset` veata.
3. **Paralleelsed ühendused.** `curl.exe` 7.66+ (`curl.exe --version`) avab 40 ühendust
   korraga:

   ```powershell
   curl.exe -s --parallel --parallel-immediate --parallel-max 40 -o NUL -w "%{http_code}\n" "http://127.0.0.1:8765/healthz?[1-40]"
   ```

   Kõik 40 vastust peavad olema `200` ja serveri aken peab jääma tööle. Seejärel
   sulge käsitsi käivitatud server (Ctrl+C) ja käivita ülesanded uuesti:

   ```powershell
   Start-ScheduledTask -TaskName 'KU Infoekraan Server'
   Start-ScheduledTask -TaskName 'KU Infoekraan Watchdog'
   ```

4. **Watchdog sulgeb Edge'i enne taaskäivitust.** Oota pärast watchdogi käivitamist
   vähemalt 2 minutit (taaskäivituste vaheline ooteaeg). Ava tavaline Edge oma
   profiiliga, seejärel `Stop-ScheduledTask -TaskName 'KU Infoekraan Server'` ja oota kuni
   1 minut. `C:\ProgramData\KuInfoekraan\logs\watchdog.log` peab sisaldama read
   `… serverOk=False …` ja `Sulgen N KÜ Edge'i protsessi enne taaskäivitust` (BOM-ita
   UTF-8 skripti tõttu võivad täpitähed logis moonduda). Tulemuseks peab olema **täpselt
   üks** kioskiaken, server vastab taas `/healthz`-ile ja tavaline Edge-aken jääb avatuks.
5. **Aegunud heartbeat.** Oota jälle 2 minutit ja lõpeta kioski renderdajaprotsessid
   (Edge jääb tööle, kuid leht ei saada enam heartbeat'i):

   ```powershell
   Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" |
     Where-Object { $_.CommandLine -match 'KuInfoekraan\\edge-profile' -and $_.CommandLine -match '--type=renderer' } |
     ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
   ```

   Kuni ~4 minuti pärast (210 s heartbeat'i piir + 30 s kontrollivahemik) peab logis olema
   `… heartbeatOk=False` koos Edge'i sulgemisreaga ja ekraanile peab tulema üks uus
   kioskiaken, ilma profiilivea dialoogita. `renderer-heartbeat.txt` aja käsitsi muutmine
   ei sobi testiks: töötav leht kirjutab faili iga 30 s järel üle.

## 4. Igapäevane diagnostika

- Jaluses peab olema roheline ühenduse olek või arusaadav offline-teade.
- `?debug=1` näitab sünkroonimisaega, viimast viga, ajavööndit, sektsioonide suurusi ja ajastaja kuut ülesannet.
- Logid asuvad `%ProgramData%\KuInfoekraan\logs`.
- Renderdaja heartbeat asub `%ProgramData%\KuInfoekraan\renderer-heartbeat.txt`.
- Edge'i profiil asub `%LOCALAPPDATA%\KuInfoekraan\edge-profile` ja ei ole veebiserveri juure all.

## 5. Tüüpilised tõrked

### Jaluses „Apps Scripti URL on seadistamata või vigane“

Kontrolli `config.js` välja `appsScriptUrl`. Värske paigalduse korral ei käivita järelevalve seadistamata ekraani reload-tsüklit.

### Jaluses „Feed'i token on seadistamata“

Käivita Apps Scriptis `getFeedTokenForSetup()` ja uuenda `config.js`.

### Ühe paneeli andmed puuduvad

Kontrolli `?debug=1` vaadet. Puuduv või ümber nimetatud Sheetsi leht märgitakse `missing`; viimast head väärtust ei kustutata. Taasta täpne lehe nimi.

### Kõik välised andmed on vanad

Kontrolli internetti ja Apps Scripti deployment'i. Kell, bussid ja prügiveo arvutus peavad jääma tööle. Üle 24 tunni vanuse info korral on ekraanil merevaigukollane riba.

### Vale ilm

Kontrolli `Seaded` lehe `weatherStationName`, `weatherLatitude`, `weatherLongitude` ja `timeZone` väärtusi. Hetkevaatluse juures kuvatakse allikas ja mõõtmisaeg.

### Server ei käivitu

Kontrolli, kas port 8765 on hõivatud. `local-server.ps1` aktsepteerib hõivatud porti ainult siis, kui `/healthz` tagastab täpse projekti signatuuri.

## 6. Turvatoimingud

- Token on bearer-secret. Ära lisa seda Git'i, ZIP-i, ekraanipilti ega logisse.
- Tokeni lekke korral käivita `rotateFeedToken()`, uuenda `config.js` ja taaskäivita Edge.
- Kioskipaigaldaja määrab Edge'i poliitika `DeveloperToolsAvailability = 2`.
- Server serveerib ainult `dist` sisu ning erandina juurkausta `config.js` faili; `.ps1`, logid ja Edge'i profiil ei ole HTTP kaudu kättesaadavad.

## 7. Rollback

### Apps Script

Muuda `config.js` URL tagasi eelmise deployment'i `/exec` URL-ile ja taaskäivita Edge. Eeldatav aeg alla 2 minuti.

### Frontend

```powershell
robocopy C:\KuInfoekraan.prev C:\KuInfoekraan /MIR /XF config.js
```

Taaskäivita ülesanded `KU Infoekraan Server` ja `KU Infoekraan Watchdog`. Eeldatav aeg alla 5 minuti.

Rollback'i käivitajad:

- ekraan tühi või vale üle 5 minuti;
- üle 5 reload'i tunnis;
- sünkroonimine ebaõnnestub järjest üle 30 minuti;
- watchdog taaskäivitab kioski üle 3 korra tunnis.


## 4.2.0 kohapealne loetavuskontroll

- A-tase (KÜ nimi, kell, teate pealkiri, 112): loe mugavalt 1–1,5 m kauguselt.
- B-tase (teate tekst, kontaktinimed/-numbrid, prügiliigid, bussiajad, turu põhiväärtused): loe mugavalt 0,5–1 m kauguselt.
- C-tase (rollid ja teisejärgulised sildid): kontrolli umbes 0,75 m kauguselt.
- D-tase (allikad, teljesildid, jalus): kontrolli umbes 0,5 m kauguselt.

Ära vähenda `config.js` väärtust `scale` alla 0,82; parser piirab selle automaatselt 0,82-ni.

## Visuaalbaseline pärast tüpograafia muutmist

Enne 4.2.0 tootmisse märkimist käivita internetiga arendusmasinal, kus Playwright/Chromium on paigaldatud:

```bash
npm ci
npm run check
npm run test:visual:update
npm run preflight
```

`npm run test:visual:update` on ainus toetatud viis baseline'i versioonimärgise uuendamiseks. Kui PNG-sid ei saanud päriselt genereerida, ära muuda `tests/e2e/snapshots/build-version.txt` käsitsi.

## Turuallika tõrke simulatsioon

Ajutiseks arendustestiks muuda ühe välise URL-i host tahtlikult vigaseks ja avalda test-deployment. Esimene päring peab andma sektsioonivea; järgmise 15 minuti jooksul ei tohi sama allika välispäringut uuesti teha ning ekraan peab säilitama last-known-good väärtuse. Pärast testi taasta URL. Internetiga ohutu kuju-smoke on `npm run test:sources`.

## Bussigraafiku hooldus

`src/data/bus-timetable.ts` kontrolltähtaeg `2027-04-27` ei ole vedaja ametlik lõppkuupäev. See sunnib hiljemalt aasta pärast 28.04.2026 sõiduplaani käsitsi üle kontrollima. Pärast kontrolli uuenda tabelit, `validFrom`/`validUntil` ja sourceLabel koos uue release'iga.

## Demo ja watchdog

`?demo=1` ei tee väliseid andmepäringuid ega rakenduse reload'e, kuid saadab lokaalse `/heartbeat` POST-i. Seetõttu ei tapa watchdog enam kohapeal avatud demoekraani 210 sekundi järel.
