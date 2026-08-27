/** Avalike andmeallikate adapterid ja sektsioonipõhine API-vahemälu. */
function sectionMeta_(result, fallbackUpdatedAt) {
  return {
    ok: result.ok === true,
    updatedAt: result.updatedAt || fallbackUpdatedAt,
    error: result.ok ? '' : String(result.error || 'Andmeallika päring ebaõnnestus.')
  };
}

function readApiCache_(key) {
  const hit = CacheService.getScriptCache().get(key);
  if (!hit) return null;
  try {
    const parsed = JSON.parse(hit);
    return parsed && (parsed.data || parsed.negative === true) ? parsed : null;
  } catch (error) {
    CacheService.getScriptCache().remove(key);
    console.warn('Vigane API vahemälu eemaldati (' + key + '): ' + error);
    return null;
  }
}

function storeApiFailure_(key, error, seconds) {
  const message = String(error && error.message ? error.message : error || 'Andmeallika päring ebaõnnestus.');
  const packet = { negative: true, error: message, failedAt: new Date().toISOString() };
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(packet), seconds);
  } catch (cacheError) {
    console.warn('Negatiivse API vahemälu kirjutamine ebaõnnestus (' + key + '): ' + cacheError);
  }
  return { ok: false, data: null, updatedAt: null, error: message, negativeCached: true };
}

function storeApiResult_(key, data, seconds) {
  const updatedAt = new Date().toISOString();
  const packet = { data: data, updatedAt: updatedAt };
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(packet), seconds);
  } catch (error) {
    console.warn('API vahemällu kirjutamine ebaõnnestus (' + key + '): ' + error);
  }
  return { ok: true, data: data, updatedAt: updatedAt, error: '' };
}

function cachedApiResult_(packet) {
  if (!packet) return null;
  if (packet.negative === true) return { ok: false, data: null, updatedAt: null, error: String(packet.error || 'Andmeallika päring ebaõnnestus.'), negativeCached: true };
  return { ok: true, data: packet.data, updatedAt: packet.updatedAt, error: '' };
}


function electricityTariffFingerprint_(tariffs) {
  return [tariffs.distributionDay, tariffs.distributionNight, tariffs.renewableEnergyFee,
    tariffs.electricityExcise, tariffs.securityOfSupplyFee, tariffs.purchaseMargin, tariffs.vatRate]
    .map(function(value) {
      const number = finiteNumber_(value);
      return number === null ? 'x' : number.toFixed(4);
    }).join('_').replace(/[^0-9x_.-]/g, '');
}

function parseYmdParts_(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day, 12));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? { year: year, month: month, day: day }
    : null;
}

function electricityTariffAt_(date, tz, tariffs) {
  const dateKey = Utilities.formatDate(date, tz, 'yyyy-MM-dd');
  const parts = parseYmdParts_(dateKey);
  const hour = Number(Utilities.formatDate(date, tz, 'HH'));
  const minute = Number(Utilities.formatDate(date, tz, 'mm'));
  const weekday = parts ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay() : 0;
  const workday = weekday >= 1 && weekday <= 5 && parts && !isEstonianPublicHoliday_(parts);
  const useDayTariff = workday && hour * 60 + minute >= 7 * 60 && hour * 60 + minute < 22 * 60;
  return {
    type: useDayTariff ? 'day' : 'night',
    labelEt: useDayTariff ? 'päevahind' : 'öö-/pühahind',
    distributionPrice: useDayTariff ? tariffs.distributionDay : tariffs.distributionNight
  };
}

function marketRequestPlan_(now, tz, tariffs) {
  const dayKey = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const electricityKey = 'electricity_v5_' + dayKey + '_' + tz + '_' + electricityTariffFingerprint_(tariffs || {});
  const fuelKey = 'fuel_estonia_v3';
  const euriborKey = 'euribor6m_daily_v2';
  const results = {
    electricity: cachedApiResult_(readApiCache_(electricityKey)),
    fuel: cachedApiResult_(readApiCache_(fuelKey)),
    euribor: cachedApiResult_(readApiCache_(euriborKey))
  };
  if (Array.isArray(tariffs && tariffs.missing) && tariffs.missing.length) {
    results.electricity = { ok: false, data: null, updatedAt: null, error: 'Elekter lehel puuduvad hinnad: ' + tariffs.missing.join(', ') };
  }
  const requests = [];
  const tags = [];
  if (!results.electricity) {
    const start = new Date(now.getTime() - 36 * 3600000).toISOString();
    const end = new Date(now.getTime() + 36 * 3600000).toISOString();
    requests.push({ url: 'https://dashboard.elering.ee/api/nps/price?start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end), muteHttpExceptions: true });
    tags.push('electricity');
  }
  if (!results.fuel) {
    requests.push({ url: 'https://openvan.camp/api/fuel/prices?source=ku-kauge-32', muteHttpExceptions: true, followRedirects: true, headers: { Accept: 'application/json' } });
    tags.push('fuel-primary');
    requests.push({ url: 'https://eurooilwatch.com/api/v1/prices', muteHttpExceptions: true });
    tags.push('fuel-fallback');
  }
  if (!results.euribor) {
    requests.push({
      url: 'https://reports.suomenpankki.fi/WebForms/ReportViewerPage.aspx?output=xml&report=%2Ftilastot%2Fmarkkina-_ja_hallinnolliset_korot%2Feuribor_korot_xml_short_en',
      muteHttpExceptions: true, followRedirects: true,
      headers: { Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5' }
    });
    tags.push('euribor-xml');
    requests.push({
      url: 'https://reports.suomenpankki.fi/WebForms/ReportViewerPage.aspx?output=&report=%2Ftilastot%2Fmarkkina-_ja_hallinnolliset_korot%2Feuriborkorot_pv_chrt_en',
      muteHttpExceptions: true, followRedirects: true,
      headers: { Accept: 'text/html,*/*;q=0.5' }
    });
    tags.push('euribor-html');
  }
  return { dayKey: dayKey, electricityKey: electricityKey, fuelKey: fuelKey, euriborKey: euriborKey, results: results, requests: requests, tags: tags };
}

function getMarketSourcesParallel_(now, tz, tariffs) {
  const plan = marketRequestPlan_(now, tz, tariffs);
  if (!plan.requests.length) return plan.results;
  let responses;
  try {
    responses = UrlFetchApp.fetchAll(plan.requests);
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (!plan.results.electricity && plan.tags.indexOf('electricity') >= 0) plan.results.electricity = storeApiFailure_(plan.electricityKey, message, KU.negativeCacheSeconds);
    if (!plan.results.fuel && (plan.tags.indexOf('fuel-primary') >= 0 || plan.tags.indexOf('fuel-fallback') >= 0)) plan.results.fuel = storeApiFailure_(plan.fuelKey, message, KU.negativeCacheSeconds);
    if (!plan.results.euribor && (plan.tags.indexOf('euribor-xml') >= 0 || plan.tags.indexOf('euribor-html') >= 0)) plan.results.euribor = storeApiFailure_(plan.euriborKey, message, KU.negativeCacheSeconds);
    return plan.results;
  }
  const responseByTag = {};
  plan.tags.forEach(function(tag, index) { responseByTag[tag] = responses[index]; });

  if (!plan.results.electricity) {
    try {
      const data = parseElectricityResponse_(responseByTag.electricity, now, tz, tariffs, plan.dayKey);
      plan.results.electricity = storeApiResult_(plan.electricityKey, data, KU.electricityCacheSeconds);
    } catch (error) {
      plan.results.electricity = storeApiFailure_(plan.electricityKey, error, KU.negativeCacheSeconds);
    }
  }
  if (!plan.results.fuel) {
    try {
      const data = parseFuelResponses_(responseByTag['fuel-primary'], responseByTag['fuel-fallback']);
      plan.results.fuel = storeApiResult_(plan.fuelKey, data, KU.fuelCacheSeconds);
    } catch (error) {
      plan.results.fuel = storeApiFailure_(plan.fuelKey, error, KU.negativeCacheSeconds);
    }
  }
  if (!plan.results.euribor) {
    try {
      const data = parseEuriborResponses_([responseByTag['euribor-xml'], responseByTag['euribor-html']]);
      plan.results.euribor = storeApiResult_(plan.euriborKey, data, KU.euriborCacheSeconds);
    } catch (error) {
      plan.results.euribor = storeApiFailure_(plan.euriborKey, error, KU.negativeCacheSeconds);
    }
  }
  return plan.results;
}

function responseOk_(response, name) {
  if (!response || response.getResponseCode() !== 200) throw new Error(name + ' HTTP ' + (response ? response.getResponseCode() : 'puudub'));
  return response;
}

function parseElectricityResponse_(response, now, tz, tariffs, dayKey) {
  responseOk_(response, 'Elering');
  const raw = JSON.parse(response.getContentText());
  const root = raw && raw.data ? raw.data : raw;
  const rows = root && Array.isArray(root.ee) ? root.ee : root && Array.isArray(root.EE) ? root.EE : Array.isArray(root) ? root : [];
  const points = rows.map(function(row) {
    const timestamp = finiteNumber_(row && row.timestamp);
    const marketPrice = finiteNumber_(row && row.price);
    if (timestamp === null || marketPrice === null) return null;
    const milliseconds = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
    const date = new Date(milliseconds);
    if (isNaN(date) || Utilities.formatDate(date, tz, 'yyyy-MM-dd') !== dayKey) return null;
    const tariff = electricityTariffAt_(date, tz, tariffs);
    const fixed = Number(tariffs.electricityExcise) + Number(tariffs.purchaseMargin) + Number(tariffs.securityOfSupplyFee) + Number(tariffs.renewableEnergyFee);
    const vatMultiplier = 1 + (finiteNumber_(tariffs.vatRate) === null ? 24 : Number(tariffs.vatRate)) / 100;
    const price = (marketPrice / 10 + fixed + Number(tariff.distributionPrice)) * vatMultiplier;
    return { time: date.toISOString(), price: Math.round(price * 10000) / 10000, tariffType: tariff.type, tariffLabelEt: tariff.labelEt, milliseconds: milliseconds };
  }).filter(Boolean).sort(function(a, b) { return a.milliseconds - b.milliseconds; });
  if (!points.length) throw new Error('Eleringi vastuses puuduvad tänase Eesti hinnapiirkonna andmed.');
  let currentIndex = 0;
  points.forEach(function(point, index) { if (point.milliseconds <= now.getTime()) currentIndex = index; });
  const currentPoint = points[currentIndex];
  const publicPoints = points.map(function(point) { return { time: point.time, price: point.price }; });
  const prices = publicPoints.map(function(point) { return point.price; });
  return {
    date: dayKey, zone: 'EE', unit: 's/kWh', includesVat: true,
    currentPrice: currentPoint.price,
    currentTariffType: currentPoint.tariffType,
    currentTariffLabelEt: currentPoint.tariffLabelEt,
    min: Math.round(Math.min.apply(null, prices) * 10000) / 10000,
    average: Math.round((prices.reduce(function(sum, value) { return sum + value; }, 0) / prices.length) * 10000) / 10000,
    max: Math.round(Math.max.apply(null, prices) * 10000) / 10000,
    points: publicPoints,
    source: 'Elering / Nord Pool EE', tariffSource: 'Google Sheets / ' + KU.sheets.electricity
  };
}

function parseFuelResponses_(primary, fallback) {
  if (primary && primary.getResponseCode() === 200) {
    try {
      const raw = JSON.parse(primary.getContentText());
      const estonia = raw && raw.data ? raw.data.EE : null;
      const prices = estonia && estonia.prices ? estonia.prices : null;
      if (prices) {
        const petrol95 = finiteNumber_(prices.gasoline != null ? prices.gasoline : prices.gasoline_regular);
        const petrol98 = finiteNumber_(prices.gasoline_premium != null ? prices.gasoline_premium : prices.premium != null ? prices.premium : prices.gasoline_super);
        const diesel = finiteNumber_(prices.diesel != null ? prices.diesel : prices.diesel_regular);
        if (petrol95 !== null || petrol98 !== null || diesel !== null) {
          const date = datePart_(String(estonia.fetched_at || (raw.meta && raw.meta.updated_at) || ''));
          return { bulletinDate: date, displayDate: date, petrol95: petrol95, petrol98: petrol98, diesel: diesel, unit: 'EUR/l', source: 'OpenVan.camp', note: 'Eesti nädala keskmised jaehinnad' };
        }
      }
    } catch (error) {
      console.warn('OpenVani vastuse töötlemine ebaõnnestus: ' + error);
    }
  }
  responseOk_(fallback, 'EuroOilWatch');
  const raw = JSON.parse(fallback.getContentText());
  const countries = raw && Array.isArray(raw.countries) ? raw.countries : [];
  const estonia = countries.find(function(country) { return String(country.countryCode || '').toUpperCase() === 'EE'; });
  if (!estonia) throw new Error('EuroOilWatchi vastuses puuduvad Eesti hinnad.');
  return {
    bulletinDate: String(raw.bulletinDate || ''), displayDate: String(raw.bulletinDate || ''),
    petrol95: finiteNumber_(estonia.petrolPrice), petrol98: null, diesel: finiteNumber_(estonia.dieselPrice),
    unit: 'EUR/l', source: 'EC Weekly Oil Bulletin / EuroOilWatch', note: 'Varuallikas; 98 hind puudub'
  };
}

function parseEuriborResponses_(responses) {
  let points = [];
  let lastError = '';
  responses.forEach(function(response) {
    if (points.length) return;
    try {
      responseOk_(response, 'Soome Pank');
      points = parseEuriborReport_(response.getContentText('UTF-8'));
      if (!points.length) throw new Error('6 kuu Euribori ridu ei leitud.');
    } catch (error) {
      lastError = String(error && error.message ? error.message : error);
    }
  });
  if (!points.length) throw new Error(lastError || '6 kuu Euribori vaatlusi ei leitud.');
  points = points.sort(function(a, b) { return a.date.localeCompare(b.date); }).slice(-135);
  const latest = points[points.length - 1];
  return { tenor: '6M', unit: '%', latest: latest.value, latestDate: latest.date, points: points, source: 'Bank of Finland / EMMI', note: 'Päevased väärtused; 24 h viitega' };
}

function parseEuriborReport_(content) {
  const text = decodeReportText_(content);
  const rows = {};
  const monthMap = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const number = '([+\\-]?\\d+(?:[.,]\\d+)?)';
  let match;
  const patterns = [
    new RegExp('\\b(\\d{1,2})\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+(\\d{4})\\s+' + number + '\\s+' + number + '\\s+' + number + '\\s+' + number + '\\s+' + number, 'g'),
    new RegExp('\\b(\\d{4})-(\\d{2})-(\\d{2})(?:T[^\\s]+)?\\s+' + number + '\\s+' + number + '\\s+' + number + '\\s+' + number + '\\s+' + number, 'g'),
    new RegExp('\\b(\\d{1,2})[.](\\d{1,2})[.](\\d{4})\\s+' + number + '\\s+' + number + '\\s+' + number + '\\s+' + number + '\\s+' + number, 'g')
  ];
  patterns.forEach(function(pattern, index) {
    while ((match = pattern.exec(text)) !== null) {
      const date = index === 0 ? ymdFromParts_(Number(match[3]), monthMap[match[2]], Number(match[1]))
        : index === 1 ? ymdFromParts_(Number(match[1]), Number(match[2]), Number(match[3]))
          : ymdFromParts_(Number(match[3]), Number(match[2]), Number(match[1]));
      const value = finiteNumber_(match[7]);
      if (date && value !== null) rows[date] = { date: date, value: value };
    }
  });
  return Object.keys(rows).sort().map(function(key) { return rows[key]; });
}

function decodeReportText_(value) {
  return String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&#43;/g, '+').replace(/&#45;/g, '-')
    .replace(/&#(\d+);/g, function(_, code) { return String.fromCharCode(Number(code)); }).replace(/\s+/g, ' ').trim();
}

function ymdFromParts_(year, month, day) {
  if (!isFinite(year) || !isFinite(month) || !isFinite(day)) return '';
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return '';
  return String(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}
function getWeather_(settings, tz) {
  const lat = decimal_(settings.weatherLatitude, 'weatherLatitude');
  const lon = decimal_(settings.weatherLongitude, 'weatherLongitude');
  if (lat === null || lon === null) {
    return { ok: false, data: null, updatedAt: null, error: 'Ilma koordinaadid on vigased.' };
  }

  const stationPreference = String(settings.weatherStationName || settings.weatherLocation || 'Viljandi');
  const cache = CacheService.getScriptCache();
  const key = 'weather_v5_' + lat + '_' + lon + '_' + tz + '_' + normalizeText_(stationPreference);
  const hit = cache.get(key);
  if (hit) {
    try {
      const cached = JSON.parse(hit);
      return { ok: true, data: cached.data, updatedAt: cached.updatedAt };
    } catch (cacheErr) {
      cache.remove(key);
      console.warn('Vigane ilmavahemälu eemaldati: ' + cacheErr);
    }
  }

  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) +
      '&longitude=' + encodeURIComponent(lon) +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
      '&wind_speed_unit=ms' +
      '&timezone=' + encodeURIComponent(tz) +
      '&forecast_days=4';

    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw new Error('Open-Meteo HTTP ' + response.getResponseCode());

    const raw = JSON.parse(response.getContentText());
    if (!raw.current || !raw.daily || !raw.daily.time) throw new Error('Open-Meteo vastus on puudulik.');

    const daily = [];
    for (let i = 0; i < raw.daily.time.length; i++) {
      daily.push({
        date: raw.daily.time[i],
        weatherCode: raw.daily.weather_code[i],
        max: raw.daily.temperature_2m_max[i],
        min: raw.daily.temperature_2m_min[i],
        precipitationProbability: raw.daily.precipitation_probability_max[i],
        sunrise: timePart_(raw.daily.sunrise && raw.daily.sunrise[i]),
        sunset: timePart_(raw.daily.sunset && raw.daily.sunset[i])
      });
    }

    // Open-Meteo hetkeväärtus on mudeliarvutus. Seda kasutatakse varuvariandina ja
    // järgmiste päevade prognoosiks; võimaluse korral asendatakse hetketemperatuur
    // Keskkonnaagentuuri Viljandi ilmajaama mõõtmisega.
    const current = {
      temperature: finiteNumber_(raw.current.temperature_2m),
      apparentTemperature: finiteNumber_(raw.current.apparent_temperature),
      relativeHumidity: finiteNumber_(raw.current.relative_humidity_2m),
      weatherCode: raw.current.weather_code,
      windSpeed: finiteNumber_(raw.current.wind_speed_10m),
      time: String(raw.current.time || ''),
      source: 'open-meteo',
      sourceName: 'Open-Meteo mudel'
    };

    try {
      const observation = getNearestOfficialObservation_(lat, lon, stationPreference);
      if (observation && observation.temperature !== null) {
        current.temperature = observation.temperature;
        current.relativeHumidity = observation.relativeHumidity;
        if (observation.windSpeed !== null) current.windSpeed = observation.windSpeed;
        const apparent = apparentTemperatureFromObservation_(
          observation.temperature,
          observation.relativeHumidity,
          observation.windSpeed
        );
        current.apparentTemperature = apparent !== null ? apparent : observation.temperature;
        current.phenomenon = observation.phenomenonEt;
        current.phenomenonRaw = observation.phenomenonRaw;
        current.observedAt = observation.observedAt;
        current.stationName = observation.stationName;
        current.latitude = observation.latitude;
        current.longitude = observation.longitude;
        current.source = 'keskkonnaagentuur';
        current.sourceName = 'Keskkonnaagentuur / ' + observation.stationName;
      }
    } catch (observationErr) {
      console.warn('Keskkonnaagentuuri hetkevaatlus ei olnud saadaval; kasutan Open-Meteo mudelit: ' + observationErr);
    }

    const weather = {
      current: current,
      daily: daily,
      forecastSource: 'Open-Meteo',
      latitude: lat,
      longitude: lon
    };
    const updatedAt = new Date().toISOString();
    cache.put(key, JSON.stringify({ data: weather, updatedAt: updatedAt }), KU.weatherCacheSeconds);
    return { ok: true, data: weather, updatedAt: updatedAt };
  } catch (err) {
    console.error('Weather error: ' + err);
    return { ok: false, data: null, updatedAt: null, error: String(err && err.message ? err.message : err) };
  }
}

function getNearestOfficialObservation_(lat, lon, preferredName) {
  const response = UrlFetchApp.fetch('https://www.ilmateenistus.ee/ilma_andmed/xml/observations.php', {
    muteHttpExceptions: true,
    followRedirects: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Keskkonnaagentuur HTTP ' + response.getResponseCode());
  }

  const root = XmlService.parse(response.getContentText()).getRootElement();
  const timestampAttr = root.getAttribute('timestamp');
  const timestamp = timestampAttr ? finiteNumber_(timestampAttr.getValue()) : null;
  const observedAt = timestamp !== null
    ? new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000).toISOString()
    : new Date().toISOString();
  const stations = root.getChildren('station');
  const preferred = normalizeText_(preferredName);
  let best = null;

  stations.forEach(function(station) {
    const temperature = finiteNumber_(xmlChildText_(station, 'airtemperature'));
    const stationLat = finiteNumber_(xmlChildText_(station, 'latitude'));
    const stationLon = finiteNumber_(xmlChildText_(station, 'longitude'));
    if (temperature === null || stationLat === null || stationLon === null) return;

    const stationName = String(xmlChildText_(station, 'name') || '');
    const normalizedName = normalizeText_(stationName);
    const exactName = preferred && normalizedName === preferred;
    const partialName = preferred && (normalizedName.indexOf(preferred) >= 0 || preferred.indexOf(normalizedName) >= 0);
    const distanceKm = distanceKm_(lat, lon, stationLat, stationLon);
    const score = (exactName ? -2000 : (partialName ? -1000 : 0)) + distanceKm;
    if (!best || score < best.score) {
      best = {
        score: score,
        distanceKm: distanceKm,
        stationName: stationName,
        temperature: temperature,
        relativeHumidity: finiteNumber_(xmlChildText_(station, 'relativehumidity')),
        windSpeed: finiteNumber_(xmlChildText_(station, 'windspeed')),
        phenomenonEt: weatherPhenomenonEt_(xmlChildText_(station, 'phenomenon')),
        phenomenonRaw: String(xmlChildText_(station, 'phenomenon') || ''),
        latitude: stationLat,
        longitude: stationLon,
        observedAt: observedAt
      };
    }
  });

  if (!best || best.distanceKm > 60) throw new Error('Sobivat lähedast ilmajaama ei leitud.');
  return best;
}

function apparentTemperatureFromObservation_(temperature, relativeHumidity, windSpeed) {
  const t = finiteNumber_(temperature);
  const rh = finiteNumber_(relativeHumidity);
  const wind = finiteNumber_(windSpeed);
  if (t === null) return null;
  if (rh === null || wind === null) return t;

  // Austraalia meteoroloogiateenistuse varjus mõõdetud tajutava temperatuuri valem.
  const vapourPressure = rh / 100 * 6.105 * Math.exp(17.27 * t / (237.7 + t));
  const apparent = t + 0.33 * vapourPressure - 0.70 * wind - 4.0;
  return isFinite(apparent) ? Math.round(apparent * 10) / 10 : t;
}

function xmlChildText_(element, name) {
  const child = element.getChild(name);
  return child ? child.getText() : '';
}

function distanceKm_(lat1, lon1, lat2, lon2) {
  const toRad = function(value) { return value * Math.PI / 180; };
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

