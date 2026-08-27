/** Google Sheetsi lugemine ja skeemi hooldus. Kõik lehtede ning veergude nimed on avaliku lepingu osa. */
function readSheet_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { present: false, rows: [], error: 'Google Sheetsi leht puudub: ' + sheetName };
  const values = sheet.getDataRange().getValues();
  if (values.length < 1) return { present: true, rows: [], error: '' };
  const headers = values[0].map(function(header) { return String(header).trim(); });
  const rows = values.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== ''; });
  }).map(function(row) {
    const object = {};
    headers.forEach(function(header, index) { object[header] = row[index]; });
    return object;
  });
  return { present: true, rows: rows, error: '' };
}

function sectionForSheet_(packet, updatedAt, warnings) {
  if (!packet.present) return { ok: false, missing: true, updatedAt: updatedAt, error: packet.error, warnings: warnings || [] };
  return { ok: true, missing: false, updatedAt: updatedAt, error: '', warnings: warnings || [] };
}

function finiteNumber_(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  const number = Number(normalized);
  return isFinite(number) ? number : null;
}

function monthNumberEt_(value) {
  const text = normalizeText_(value);
  const months = {
    'jaanuar': 1, 'jaan': 1, 'veebruar': 2, 'veebr': 2, 'märts': 3, 'marts': 3,
    'aprill': 4, 'apr': 4, 'mai': 5, 'juuni': 6, 'juuli': 7, 'august': 8, 'aug': 8,
    'september': 9, 'sept': 9, 'oktoober': 10, 'okt': 10, 'november': 11, 'nov': 11,
    'detsember': 12, 'dets': 12
  };
  if (Object.prototype.hasOwnProperty.call(months, text)) return months[text];
  const numeric = Math.round(num_(value, NaN));
  return isFinite(numeric) && numeric >= 1 && numeric <= 12 ? numeric : null;
}

function readHouseConsumptionFromRows_(rows) {
  const monthNames = ['Jaanuar', 'Veebruar', 'Märts', 'Aprill', 'Mai', 'Juuni', 'Juuli', 'August', 'September', 'Oktoober', 'November', 'Detsember'];
  const months = rows.map(function(row) {
    const year = Math.round(num_(val_(row, 'Aasta'), NaN));
    const month = monthNumberEt_(val_(row, 'Kuu'));
    if (!isFinite(year) || year < 2000 || year > 2200 || !month) return null;
    const item = {
      year: year,
      month: month,
      monthName: monthNames[month - 1],
      key: String(year) + '-' + String(month).padStart(2, '0'),
      waterM3: finiteNumber_(val_(row, 'Veekulu m³')),
      heatMWh: finiteNumber_(val_(row, 'Soojusetarbimine MWh')),
      electricityKWh: finiteNumber_(val_(row, 'Elektritarbimine kWh')),
      solarKWh: finiteNumber_(val_(row, 'Päikesepaneelide tootlus kWh'))
    };
    return [item.waterM3, item.heatMWh, item.electricityKWh, item.solarKWh].some(function(value) { return value !== null; }) ? item : null;
  }).filter(Boolean).sort(function(a, b) { return (a.year * 12 + a.month) - (b.year * 12 + b.month); });
  return { source: 'Google Sheets / ' + KU.sheets.house, months: months };
}

function readElectricityTariffsFromRows_(rows) {
  const tariffs = {
    packageName: 'Võimsus VMA2', monthlyConnectionFee: null, monthlyAmpacityFee: null,
    monthlyConnectionPowerFee: null, monthlyConsumptionPowerFee: null, distributionDay: null,
    distributionNight: null, renewableEnergyFee: null, electricityExcise: null,
    securityOfSupplyFee: null, purchaseMargin: null, vatRate: 24, sourceSheet: KU.sheets.electricity
  };
  rows.forEach(function(row) {
    const label = normalizeText_(val_(row, 'Pakett'));
    if (!label) return;
    const candidates = [val_(row, 'Hinnad käibemaksuta'), val_(row, 'Võimsus VMA2')];
    let value = null;
    for (let index = 0; index < candidates.length; index++) {
      value = finiteNumber_(candidates[index]);
      if (value !== null) break;
    }
    if (value === null) {
      console.warn('Elekter lehel puudub arvuline väärtus real: ' + val_(row, 'Pakett'));
      return;
    }
    if (label.indexOf('võrguühenduse kuutasu') >= 0) tariffs.monthlyConnectionFee = value;
    else if (label.indexOf('võrguühenduse läbilaskevõime') >= 0) tariffs.monthlyAmpacityFee = value;
    else if (label.indexOf('võrguühenduse kasutusvõimsus') >= 0) tariffs.monthlyConnectionPowerFee = value;
    else if (label.indexOf('tarbimiskoha kasutusvõimsus') >= 0) tariffs.monthlyConsumptionPowerFee = value;
    else if (label.indexOf('elektri edastamine päev') >= 0) tariffs.distributionDay = value;
    else if (label.indexOf('elektri edastamine öö') >= 0) tariffs.distributionNight = value;
    else if (label.indexOf('taastuvenergia tasu') >= 0) tariffs.renewableEnergyFee = value;
    else if (label.indexOf('elektriaktsiis') >= 0) tariffs.electricityExcise = value;
    else if (label.indexOf('varustuskindluse tasu') >= 0) tariffs.securityOfSupplyFee = value;
    else if (label.indexOf('elektri ostmise marginaal') >= 0) tariffs.purchaseMargin = value;
  });
  const required = [
    ['elektri edastamine: päev', 'distributionDay'], ['elektri edastamine: öö', 'distributionNight'],
    ['Taastuvenergia tasu', 'renewableEnergyFee'], ['Elektriaktsiis', 'electricityExcise'],
    ['Varustuskindluse tasu', 'securityOfSupplyFee'], ['Elektri ostmise marginaal', 'purchaseMargin']
  ];
  tariffs.missing = required.filter(function(item) { return finiteNumber_(tariffs[item[1]]) === null; }).map(function(item) { return item[0]; });
  return tariffs;
}

function readSettingsFromRows_(rows) {
  const out = {};
  rows.forEach(function(row) {
    const key = String(val_(row, 'Võti') || '').trim();
    if (key) out[key] = val_(row, 'Väärtus');
  });
  return out;
}

function val_(object, key) {
  return object && Object.prototype.hasOwnProperty.call(object, key) ? object[key] : '';
}

function num_(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  const number = Number(normalized);
  return isFinite(number) ? number : fallback;
}

function decimal_(value, label) {
  const normalized = String(value == null ? '' : value).trim().replace(',', '.');
  const number = Number(normalized);
  if (!isFinite(number)) {
    console.warn('Vigane arv seadetes: ' + label + ' = ' + value);
    return null;
  }
  return number;
}

function bool_(value) {
  if (value === true) return true;
  if (value === false || value === '' || value == null) return false;
  return ['true', '1', 'jah', 'yes', 'x'].indexOf(String(value).trim().toLowerCase()) >= 0;
}

function iso_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return value.toISOString();
  const date = new Date(value);
  if (isNaN(date)) {
    console.warn('Vigane kuupäev/kellaaeg: ' + value);
    return null;
  }
  return date.toISOString();
}

function noticeEndIso_(value, tz) {
  if (!value) return null;
  const isDateObject = Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value);
  const text = String(value).trim();
  const dateOnlyText = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const date = isDateObject ? value : new Date(value);
  if (isNaN(date)) {
    console.warn('Vigane teate lõpukuupäev: ' + value);
    return null;
  }
  const hasMidnightTime = isDateObject && Utilities.formatDate(date, tz, 'HH:mm:ss') === '00:00:00';
  if (dateOnlyText || hasMidnightTime) {
    const day = dateOnlyText ? text : Utilities.formatDate(date, tz, 'yyyy-MM-dd');
    const end = Utilities.parseDate(day + ' 23:59:59', tz, 'yyyy-MM-dd HH:mm:ss');
    return new Date(end.getTime() + 999).toISOString();
  }
  return date.toISOString();
}

function dateOnly_(value, tz) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(value);
  if (isNaN(date)) {
    console.warn('Vigane kalendrikuupäev: ' + value);
    return null;
  }
  return Utilities.formatDate(date, tz, 'yyyy-MM-dd');
}

function timePart_(value) {
  const match = String(value || '').match(/T(\d{2}:\d{2})/);
  return match ? match[1] : String(value || '').slice(0, 5);
}

function normalizeText_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9õäöüšž]+/g, ' ').trim();
}

function datePart_(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function ensureSetting_(ss, key, defaultValue) {
  const sheet = ss.getSheetByName(KU.sheets.settings);
  if (!sheet) return;
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row++) {
    if (String(values[row][0] || '').trim() === key) return;
  }
  sheet.appendRow([key, defaultValue]);
}

function nextWeekday_(date, weekday) {
  const result = new Date(date.getTime());
  const delta = (weekday - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + delta);
  return result;
}

function ensureSheetColumn_(ss, sheetName, header) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) { return String(value).trim(); });
  if (headers.indexOf(header) >= 0) return;
  sheet.getRange(1, lastColumn + 1).setValue(header).setFontWeight('bold');
}

function ensureSheet_(ss, name, headers, sampleRows) {
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (sampleRows && sampleRows.length) sheet.getRange(2, 1, sampleRows.length, headers.length).setValues(sampleRows);
  return sheet;
}

function formatSheets_(ss) {
  Object.keys(KU.sheets).forEach(function(key) {
    const sheet = ss.getSheetByName(KU.sheets[key]);
    if (!sheet) return;
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).setFontWeight('bold').setBackground('#f3e7cf');
    sheet.autoResizeColumns(1, Math.max(1, sheet.getLastColumn()));
  });
}
