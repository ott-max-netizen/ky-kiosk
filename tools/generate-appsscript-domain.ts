import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { WEATHER_PHENOMENON_TRANSLATIONS } from "../src/domain/weather/phenomenon.ts";

const target = resolve(process.cwd(), "apps-script/Domain.gs");
const translations = JSON.stringify(WEATHER_PHENOMENON_TRANSLATIONS, null, 2);
const output = `// GENEREERITUD fail. Allikas: src/domain/**\n` +
`var WEATHER_PHENOMENON_TRANSLATIONS_ = ${translations};\n\n` +
`function addCalendarDaysParts_(parts, days) {\n` +
`  var date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12));\n` +
`  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };\n` +
`}\n\n` +
`function sameCalendarDateParts_(left, right) {\n` +
`  return !!left && !!right && left.year === right.year && left.month === right.month && left.day === right.day;\n` +
`}\n\n` +
`function easterSundayParts_(year) {\n` +
`  var a = year % 19; var b = Math.floor(year / 100); var c = year % 100; var d = Math.floor(b / 4);\n` +
`  var e = b % 4; var f = Math.floor((b + 8) / 25); var g = Math.floor((b - f + 1) / 3);\n` +
`  var h = (19 * a + b - d - g + 15) % 30; var i = Math.floor(c / 4); var k = c % 4;\n` +
`  var l = (32 + 2 * e + 2 * i - h - k) % 7; var m = Math.floor((a + 11 * h + 22 * l) / 451);\n` +
`  var month = Math.floor((h + l - 7 * m + 114) / 31); var day = ((h + l - 7 * m + 114) % 31) + 1;\n` +
`  return { year: year, month: month, day: day };\n` +
`}\n\n` +
`function isEstonianPublicHoliday_(parts) {\n` +
`  var fixed = ['01-01','02-24','05-01','06-23','06-24','08-20','12-24','12-25','12-26'];\n` +
`  var mmdd = String(parts.month).padStart(2, '0') + '-' + String(parts.day).padStart(2, '0');\n` +
`  if (fixed.indexOf(mmdd) >= 0) return true;\n` +
`  var easter = easterSundayParts_(parts.year);\n` +
`  return sameCalendarDateParts_(parts, addCalendarDaysParts_(easter, -2)) || sameCalendarDateParts_(parts, easter) || sameCalendarDateParts_(parts, addCalendarDaysParts_(easter, 49));\n` +
`}\n\n` +
`function safeTimeZone_(value) {\n` +
`  var tz = String(value || KU.defaultTimezone);\n` +
`  try { Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'); return tz; }\n` +
`  catch (err) { console.warn('Vigane ajavöönd \"' + tz + '\", kasutan ' + KU.defaultTimezone); return KU.defaultTimezone; }\n` +
`}\n\n` +
`function normalizePhenomenon_(value) {\n` +
`  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9õäöüšž]+/g, ' ').trim();\n` +
`}\n\n` +
`function weatherPhenomenonEt_(value) {\n` +
`  var key = normalizePhenomenon_(value);\n` +
`  if (!key) return '';\n` +
`  if (WEATHER_PHENOMENON_TRANSLATIONS_[key]) return WEATHER_PHENOMENON_TRANSLATIONS_[key];\n` +
`  var values = Object.keys(WEATHER_PHENOMENON_TRANSLATIONS_).map(function(k){ return normalizePhenomenon_(WEATHER_PHENOMENON_TRANSLATIONS_[k]); });\n` +
`  if (values.indexOf(key) >= 0) { var text = String(value || '').trim(); return text.charAt(0).toUpperCase() + text.slice(1); }\n` +
`  return /^[a-z0-9 ]+$/.test(key) ? '' : String(value || '').trim();\n` +
`}\n`;
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, output, "utf8");
console.log(`Generated ${target}`);
