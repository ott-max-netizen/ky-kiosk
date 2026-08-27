// GENEREERITUD fail. Allikas: src/domain/**
var WEATHER_PHENOMENON_TRANSLATIONS_ = {
  "clear": "Selge",
  "few clouds": "Vähene pilvisus",
  "variable clouds": "Vahelduv pilvisus",
  "cloudy with clear spells": "Pilves selgimistega",
  "cloudy": "Pilves",
  "light snow shower": "Nõrk hooglumi",
  "moderate snow shower": "Mõõdukas hooglumi",
  "heavy snow shower": "Tugev hooglumi",
  "light shower": "Nõrk hoogvihm",
  "moderate shower": "Mõõdukas hoogvihm",
  "heavy shower": "Tugev hoogvihm",
  "light rain": "Nõrk vihm",
  "moderate rain": "Mõõdukas vihm",
  "heavy rain": "Tugev vihm",
  "risk of glaze": "Jäiteoht",
  "glaze": "Jäide",
  "light sleet": "Nõrk lörtsisadu",
  "moderate sleet": "Mõõdukas lörtsisadu",
  "heavy sleet": "Tugev lörtsisadu",
  "light snowfall": "Nõrk lumesadu",
  "moderate snowfall": "Mõõdukas lumesadu",
  "heavy snowfall": "Tugev lumesadu",
  "snowstorm": "Üldtuisk",
  "blowing snow": "Üldtuisk",
  "drifting snow": "Pinnatuisk",
  "hail": "Rahe",
  "mist": "Uduvine",
  "fog": "Udu",
  "thunder": "Äike",
  "thunderstorm": "Äikesevihm",
  "light freezing rain": "Nõrk jäävihm",
  "moderate freezing rain": "Mõõdukas jäävihm",
  "heavy freezing rain": "Tugev jäävihm",
  "freezing rain": "Jäävihm"
};

function addCalendarDaysParts_(parts, days) {
  var date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function sameCalendarDateParts_(left, right) {
  return !!left && !!right && left.year === right.year && left.month === right.month && left.day === right.day;
}

function easterSundayParts_(year) {
  var a = year % 19; var b = Math.floor(year / 100); var c = year % 100; var d = Math.floor(b / 4);
  var e = b % 4; var f = Math.floor((b + 8) / 25); var g = Math.floor((b - f + 1) / 3);
  var h = (19 * a + b - d - g + 15) % 30; var i = Math.floor(c / 4); var k = c % 4;
  var l = (32 + 2 * e + 2 * i - h - k) % 7; var m = Math.floor((a + 11 * h + 22 * l) / 451);
  var month = Math.floor((h + l - 7 * m + 114) / 31); var day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year: year, month: month, day: day };
}

function isEstonianPublicHoliday_(parts) {
  var fixed = ['01-01','02-24','05-01','06-23','06-24','08-20','12-24','12-25','12-26'];
  var mmdd = String(parts.month).padStart(2, '0') + '-' + String(parts.day).padStart(2, '0');
  if (fixed.indexOf(mmdd) >= 0) return true;
  var easter = easterSundayParts_(parts.year);
  return sameCalendarDateParts_(parts, addCalendarDaysParts_(easter, -2)) || sameCalendarDateParts_(parts, easter) || sameCalendarDateParts_(parts, addCalendarDaysParts_(easter, 49));
}

function safeTimeZone_(value) {
  var tz = String(value || KU.defaultTimezone);
  try { Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'); return tz; }
  catch (err) { console.warn('Vigane ajavöönd "' + tz + '", kasutan ' + KU.defaultTimezone); return KU.defaultTimezone; }
}

function normalizePhenomenon_(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9õäöüšž]+/g, ' ').trim();
}

function weatherPhenomenonEt_(value) {
  var key = normalizePhenomenon_(value);
  if (!key) return '';
  if (WEATHER_PHENOMENON_TRANSLATIONS_[key]) return WEATHER_PHENOMENON_TRANSLATIONS_[key];
  var values = Object.keys(WEATHER_PHENOMENON_TRANSLATIONS_).map(function(k){ return normalizePhenomenon_(WEATHER_PHENOMENON_TRANSLATIONS_[k]); });
  if (values.indexOf(key) >= 0) { var text = String(value || '').trim(); return text.charAt(0).toUpperCase() + text.slice(1); }
  return /^[a-z0-9 ]+$/.test(key) ? '' : String(value || '').trim();
}
