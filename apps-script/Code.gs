const KU = {
  sheets: {
    settings: 'Seaded', notices: 'Teated', contacts: 'Kontaktid', emergency: 'Avarii',
    waste: 'Prugivedu', electricity: 'Elekter', house: 'Maja'
  },
  defaultTimezone: 'Europe/Tallinn',
  dashboardCacheKey: 'ku-dashboard-v9',
  dashboardCacheSeconds: 60,
  weatherCacheSeconds: 600,
  electricityCacheSeconds: 900,
  fuelCacheSeconds: 21600,
  euriborCacheSeconds: 21600,
  negativeCacheSeconds: 900
};

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Käivita setup() Google Sheetsi külge seotud Apps Scriptist.');

  const props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', ss.getId());
  ensureFeedToken_();

  ensureSheet_(ss, KU.sheets.settings, ['Võti', 'Väärtus'], [
    ['buildingName', 'KÜ Kauge tn 32'],
    ['buildingAddress', 'Kauge tn 32, Viljandi'],
    ['weatherLocation', 'Viljandi'],
    ['weatherStationName', 'Viljandi'],
    ['weatherLatitude', '58.3639'],
    ['weatherLongitude', '25.5900'],
    ['timeZone', 'Europe/Tallinn']
  ]);

  // Olemasoleva Seaded lehe puhul lisa ainult puuduvad võtmed. Olemasolevaid väärtusi ei kirjutata üle.
  [
    ['buildingName', 'KÜ Kauge tn 32'],
    ['buildingAddress', 'Kauge tn 32, Viljandi'],
    ['weatherLocation', 'Viljandi'],
    ['weatherStationName', 'Viljandi'],
    ['weatherLatitude', '58.3639'],
    ['weatherLongitude', '25.5900'],
    ['timeZone', 'Europe/Tallinn']
  ].forEach(([key, value]) => ensureSetting_(ss, key, value));

  ensureSheet_(ss, KU.sheets.notices,
    ['ID', 'Pealkiri', 'Tekst', 'Tüüp', 'Algus', 'Lõpp', 'Aktiivne', 'Prioriteet'],
    [['T001', 'Tere tulemast infoekraanile', 'Seda teadet saad muuta Google Sheetsis.', 'info', new Date(), '', true, 10]]
  );

  ensureSheet_(ss, KU.sheets.contacts,
    ['Roll', 'Nimi', 'Telefon', 'E-post', 'Aktiivne'],
    [['Juhatus', 'Lisa nimi', '+372 ...', 'juhatus@example.ee', true]]
  );

  ensureSheet_(ss, KU.sheets.emergency,
    ['Nimetus', 'Telefon', 'Märkus', 'Prioriteet', 'Aktiivne'],
    [['Hädaabi', '112', 'Elu, tervise või vara vahetu oht', 1, true]]
  );

  const nextTuesday = nextWeekday_(new Date(), 2);
  const nextThursday = nextWeekday_(new Date(), 4);
  ensureSheet_(ss, KU.sheets.waste,
    ['Jäätmeliik', 'Kuupäev', 'Märkus', 'Aktiivne', 'Sagedus'],
    [
      ['Segaolmejäätmed', nextTuesday, '', true, 'Iga: T, R'],
      ['Biolagunevad jäätmed', nextTuesday, '', true, 'Iga: T, R'],
      ['Segapakend', nextThursday, '', true, 'Iga: N'],
      ['Paber ja papp', nextThursday, '', true, 'Iga: N'],
      ['Klaas', nextThursday, 'Kuupäev on kahenädalase tsükli ankur', true, 'Kord 2 nädala tagant N']
    ]
  );
  ensureSheetColumn_(ss, KU.sheets.waste, 'Sagedus');

  // Elektripaketi muutuv- ja püsitasud. Olemasolevat Elekter-lehte setup() üle ei kirjuta.
  ensureSheet_(ss, KU.sheets.electricity,
    ['Pakett', 'Võimsus VMA2', 'Hinnad käibemaksuta'],
    [
      ['võrguühenduse kuutasu €/kuus', 30.41, ''],
      ['võrguühenduse läbilaskevõime € / A kuus', 0.32, ''],
      ['võrguühenduse kasutusvõimsus € / kW kuus', 2.45, ''],
      ['tarbimiskoha kasutusvõimsus ** € / kW kuus', 2.56, ''],
      ['elektri edastamine: päev senti/kWh', 3.49, ''],
      ['elektri edastamine: öö senti/kWh', 1.99, ''],
      ['Taastuvenergia tasu senti/kWh', 0.84, ''],
      ['Elektriaktsiis senti/kWh', 0.21, ''],
      ['Varustuskindluse tasu alates 01.01.2026 senti/kWh', 0.758, ''],
      ['Elektri ostmise marginaal senti/kWh', 0.78, '']
    ]
  );

  ensureSheet_(ss, KU.sheets.house,
    ['Aasta', 'Kuu', 'Veekulu m³', 'Soojusetarbimine MWh', 'Elektritarbimine kWh', 'Päikesepaneelide tootlus kWh'],
    [
      [2026, 'Jaanuar', 249.00, 73.04, 4924.00, 10],
      [2026, 'Veebruar', 224.00, 57.74, 4607.00, 15],
      [2026, 'Märts', 251.00, 36.97, 4301.58, 20],
      [2026, 'Aprill', 233.00, 36.97, 3699.68, 30],
      [2026, 'Mai', 254.00, 23.36, 3365.28, 45],
      [2026, 'Juuni', 245.00, 15.58, 1237.75, 55],
      [2026, 'Juuli', 258.00, 14.80, 1615.80, 40],
      [2026, 'August', '', '', '', ''],
      [2026, 'September', '', '', '', ''],
      [2026, 'Oktoober', '', '', '', ''],
      [2026, 'November', '', '', '', ''],
      [2026, 'Detsember', '', '', '', '']
    ]
  );

  formatSheets_(ss);
  CacheService.getScriptCache().remove(KU.dashboardCacheKey);

  const token = getFeedTokenForSetup();
  console.log('Infoekraani feedToken (kopeeri config.js faili): ' + token);
  return token;
}

function getFeedTokenForSetup() {
  return ensureFeedToken_();
}

function rotateFeedToken() {
  const token = makeToken_();
  PropertiesService.getScriptProperties().setProperty('KU_FEED_TOKEN', token);
  CacheService.getScriptCache().remove(KU.dashboardCacheKey);
  console.log('Uus infoekraani feedToken: ' + token);
  return token;
}

function invalidateDashboardCache() {
  CacheService.getScriptCache().remove(KU.dashboardCacheKey);
}


function doGet(e) {
  const callback = e && e.parameter ? e.parameter.callback : '';
  const suppliedToken = e && e.parameter ? String(e.parameter.token || '') : '';
  const expectedToken = PropertiesService.getScriptProperties().getProperty('KU_FEED_TOKEN') || '';
  if (!expectedToken || !tokenMatches_(suppliedToken, expectedToken)) {
    return respond_({ ok: false, error: 'Ligipääs keelatud.' }, callback);
  }

  const cache = CacheService.getScriptCache();
  const cached = cache.get(KU.dashboardCacheKey);
  if (cached) {
    try { return respond_(JSON.parse(cached), callback); }
    catch (error) { cache.remove(KU.dashboardCacheKey); }
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    const retryHit = cache.get(KU.dashboardCacheKey);
    if (retryHit) {
      try { return respond_(JSON.parse(retryHit), callback); }
      catch (error) { cache.remove(KU.dashboardCacheKey); }
    }
    return respond_({ ok: false, error: 'Andmete uuendamine on juba käimas. Proovi mõne sekundi pärast uuesti.' }, callback);
  }

  try {
    const secondHit = cache.get(KU.dashboardCacheKey);
    if (secondHit) {
      try { return respond_(JSON.parse(secondHit), callback); }
      catch (error) { cache.remove(KU.dashboardCacheKey); }
    }
    const data = getDashboardData_();
    try { cache.put(KU.dashboardCacheKey, JSON.stringify(data), KU.dashboardCacheSeconds); }
    catch (error) { console.warn('Dashboard cache kirjutamine ebaõnnestus: ' + error); }
    return respond_(data, callback);
  } catch (error) {
    return respond_({ ok: false, error: String(error && error.message ? error.message : error) }, callback);
  } finally {
    lock.releaseLock();
  }
}

function getDashboardData_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('Käivita enne setup().');
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const now = new Date();
  const nowIso = now.toISOString();

  const sheets = {
    settings: readSheet_(ss, KU.sheets.settings),
    notices: readSheet_(ss, KU.sheets.notices),
    contacts: readSheet_(ss, KU.sheets.contacts),
    emergency: readSheet_(ss, KU.sheets.emergency),
    waste: readSheet_(ss, KU.sheets.waste),
    electricity: readSheet_(ss, KU.sheets.electricity),
    house: readSheet_(ss, KU.sheets.house)
  };
  const settings = sheets.settings.present ? readSettingsFromRows_(sheets.settings.rows) : {};
  const tz = safeTimeZone_(settings.timeZone || KU.defaultTimezone);
  const tariffs = sheets.electricity.present ? readElectricityTariffsFromRows_(sheets.electricity.rows) : { missing: ['Elekter leht puudub'] };

  const weatherResult = getWeather_(settings, tz);
  const market = getMarketSourcesParallel_(now, tz, tariffs);
  if (!sheets.electricity.present) {
    market.electricity = { ok: false, data: null, updatedAt: null, error: sheets.electricity.error, missing: true };
  }

  const payload = {
    ok: true,
    updatedAt: nowIso,
    settings: {
      buildingName: String(settings.buildingName || 'KÜ Kauge 32 infoekraan'),
      buildingAddress: String(settings.buildingAddress || ''),
      weatherLocation: String(settings.weatherLocation || 'Viljandi'),
      weatherStationName: String(settings.weatherStationName || settings.weatherLocation || 'Viljandi'),
      weatherLatitude: finiteNumber_(settings.weatherLatitude),
      weatherLongitude: finiteNumber_(settings.weatherLongitude),
      timeZone: tz
    },
    weather: weatherResult.ok ? weatherResult.data : undefined,
    electricity: market.electricity && market.electricity.ok ? market.electricity.data : undefined,
    fuel: market.fuel && market.fuel.ok ? market.fuel.data : undefined,
    euribor: market.euribor && market.euribor.ok ? market.euribor.data : undefined,
    sections: {
      notices: sectionForSheet_(sheets.notices, nowIso),
      contacts: sectionForSheet_(sheets.contacts, nowIso),
      emergency: sectionForSheet_(sheets.emergency, nowIso),
      waste: sectionForSheet_(sheets.waste, nowIso),
      weather: sectionMeta_(weatherResult, nowIso),
      house: sectionForSheet_(sheets.house, nowIso),
      electricity: sheets.electricity.present ? sectionMeta_(market.electricity, nowIso) : sectionForSheet_(sheets.electricity, nowIso),
      fuel: sectionMeta_(market.fuel, nowIso),
      euribor: sectionMeta_(market.euribor, nowIso)
    }
  };

  if (sheets.notices.present) {
    payload.notices = sheets.notices.rows.map(function(row) {
      return {
        id: String(val_(row, 'ID') || ''), title: String(val_(row, 'Pealkiri') || ''),
        body: String(val_(row, 'Tekst') || ''), type: String(val_(row, 'Tüüp') || 'info').toLowerCase(),
        start: iso_(val_(row, 'Algus')), end: noticeEndIso_(val_(row, 'Lõpp'), tz),
        active: bool_(val_(row, 'Aktiivne')), priority: num_(val_(row, 'Prioriteet'), 100)
      };
    }).filter(function(item) { return item.active; }).sort(function(a, b) { return a.priority - b.priority; });
  }
  if (sheets.contacts.present) {
    payload.contacts = sheets.contacts.rows.map(function(row) {
      return { role: String(val_(row, 'Roll') || ''), name: String(val_(row, 'Nimi') || ''), phone: String(val_(row, 'Telefon') || ''), active: bool_(val_(row, 'Aktiivne')) };
    }).filter(function(item) { return item.active; });
  }
  if (sheets.emergency.present) {
    payload.emergency = sheets.emergency.rows.map(function(row) {
      return { name: String(val_(row, 'Nimetus') || ''), phone: String(val_(row, 'Telefon') || ''), note: String(val_(row, 'Märkus') || ''), priority: num_(val_(row, 'Prioriteet'), 100), active: bool_(val_(row, 'Aktiivne')) };
    }).filter(function(item) { return item.active; }).sort(function(a, b) { return a.priority - b.priority; });
  }
  if (sheets.waste.present) {
    payload.waste = sheets.waste.rows.map(function(row) {
      return { type: String(val_(row, 'Jäätmeliik') || ''), date: dateOnly_(val_(row, 'Kuupäev'), tz), frequency: String(val_(row, 'Sagedus') || '').trim(), note: String(val_(row, 'Märkus') || ''), active: bool_(val_(row, 'Aktiivne')) };
    }).filter(function(item) { return item.active && (item.date || item.frequency); });
  }
  if (sheets.house.present) payload.house = readHouseConsumptionFromRows_(sheets.house.rows);
  return payload;
}

function ensureFeedToken_() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('KU_FEED_TOKEN');
  if (!token) {
    token = makeToken_();
    props.setProperty('KU_FEED_TOKEN', token);
  }
  return token;
}

function makeToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function tokenMatches_(supplied, expected) {
  const left = String(supplied || '');
  const right = String(expected || '');
  if (left.length !== right.length) return false;

  // Võrdle sama pikkusega väärtused täielikult läbi. Apps Scripti JavaScripti runtime ei anna
  // krüptograafilist konstantaja garantiid, mistõttu funktsiooni nimi ei väida seda.
  let diff = 0;
  for (let i = 0; i < right.length; i++) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function respond_(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    const safe = /^kuInfoCallback_[0-9A-Za-z_]+$/.test(String(callback)) ? String(callback) : '';
    if (!safe) {
      return ContentService.createTextOutput('/* invalid callback */').setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(safe + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

