/**
 * Centre Ishema ry'Umuryango — appointment booking backend
 * Google Apps Script web app, bound to a Google Sheet.
 *
 * Sheet tabs (created by running setup() once):
 *   Settings  key / value pairs (session length, how far ahead, notice, email)
 *   Hours     weekly opening hours, one or more rows per day
 *   Closed    dates (or parts of dates) when no one can book
 *   Bookings  every booking made from the website
 *
 * The website calls:
 *   GET  <web app URL>?action=availability   -> open dates and times
 *   POST <web app URL>  (JSON body)          -> books one slot
 *
 * See SETUP-BOOKING.md for step-by-step instructions.
 */

var TZ_DEFAULT = 'Africa/Kigali';
var BOOKING_HEADERS = ['Booked at', 'Reference', 'Date', 'Time', 'Service', 'Name', 'Phone', 'Email', 'Message', 'Status'];
var SERVICES = [
  'Couple therapy', 'Child therapy', 'Family therapy', 'Educational follow-up', 'Rehabilitation',
  'Baby care centre', 'Psychometric assessment', 'Events and team building', 'Consultancy', "I'm not sure yet"
];

/* ---------- one-time setup ---------- */

function setup() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ_DEFAULT);

  var s = sheet_('Settings', ['Setting', 'Value', 'What it means']);
  if (s.getLastRow() < 2) {
    s.getRange(2, 1, 6, 3).setValues([
      ['session_minutes', 60, 'Length of one appointment, in minutes'],
      ['days_ahead', 45, 'How many days ahead people can book'],
      ['min_notice_hours', 24, 'Earliest a booking can be made before the appointment'],
      ['max_per_slot', 1, 'How many people can book the same time (e.g. 2 if two therapists are free)'],
      ['notify_email', 'tuadiel6@gmail.com', 'TESTING: change to centre.ishemaryumuryango@yahoo.com before launch. Where new booking alerts are sent (comma-separate several)'],
      ['centre_phone', '+250 788 733 368', 'Shown in confirmation emails']
    ]);
  }

  var h = sheet_('Hours', ['Day', 'Start', 'End']);
  if (h.getLastRow() < 2) {
    h.getRange(2, 1, 6, 3).setNumberFormat('@').setValues([
      ['Monday', '08:30', '12:30'], ['Monday', '14:00', '17:00'],
      ['Wednesday', '08:30', '12:30'], ['Wednesday', '14:00', '17:00'],
      ['Friday', '08:30', '12:30'], ['Saturday', '09:00', '12:00']
    ]);
  }
  h.getRange('B:C').setNumberFormat('@');

  var c = sheet_('Closed', ['Date (YYYY-MM-DD)', 'Start (optional)', 'End (optional)', 'Reason']);
  c.getRange('A:C').setNumberFormat('@');

  var b = sheet_('Bookings', BOOKING_HEADERS);
  b.getRange('C:D').setNumberFormat('@');
  b.setFrozenRows(1);

  SpreadsheetApp.flush();
}

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ---------- web endpoints ---------- */

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'availability';
    if (action !== 'availability') return json_({ ok: false, error: 'unknown_action' });
    return json_(availability_());
  } catch (err) {
    return json_({ ok: false, error: 'server', detail: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Spam trap: real visitors never fill the hidden "website" field.
    if (data.website) return json_({ ok: true, reference: 'CIU-000000' });

    var v = validate_(data);
    if (v) return json_({ ok: false, error: 'invalid', detail: v });

    lock.waitLock(20000);
    var av = availability_();
    var times = av.days[data.date] || [];
    if (times.indexOf(data.time) < 0) return json_({ ok: false, error: 'taken' });

    var ref = 'CIU-' + Utilities.formatDate(new Date(), tz_(), 'yyMMdd') + '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase();
    var row = [new Date(), ref, data.date, data.time, data.service, data.name, data.phone, data.email || '', data.message || '', 'Confirmed'];
    SpreadsheetApp.getActive().getSheetByName('Bookings').appendRow(row);
    SpreadsheetApp.flush();
    lock.releaseLock();

    notify_(ref, data, av.sessionMinutes);
    return json_({ ok: true, reference: ref, date: data.date, time: data.time, sessionMinutes: av.sessionMinutes });
  } catch (err) {
    return json_({ ok: false, error: 'server', detail: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ---------- availability ---------- */

function availability_() {
  var tz = tz_();
  var set = settings_();
  var session = Number(set.session_minutes) || 60;
  var daysAhead = Number(set.days_ahead) || 45;
  var notice = Number(set.min_notice_hours) || 0;
  var perSlot = Number(set.max_per_slot) || 1;

  // Times are read as displayed text: spreadsheet time values sit on 30 Dec 1899,
  // where time-zone history can shift them by a few minutes.
  var hours = rows_('Hours', true).map(function (r) {
    return { day: String(r[0]).trim().toLowerCase(), start: hhmm_(r[1]), end: hhmm_(r[2]) };
  }).filter(function (r) { return r.day && r.start && r.end; });

  var closedDates = rows_('Closed');
  var closed = rows_('Closed', true).map(function (r, i) {
    return { date: ymd_(closedDates[i][0]), start: hhmm_(r[1]), end: hhmm_(r[2]) };
  }).filter(function (r) { return r.date; });

  var taken = {};
  var bookingTimes = rows_('Bookings', true);
  rows_('Bookings').forEach(function (r, i) {
    if (String(r[9]).trim().toLowerCase() === 'cancelled') return;
    var k = ymd_(r[2]) + ' ' + hhmm_(bookingTimes[i][3]);
    taken[k] = (taken[k] || 0) + 1;
  });

  var cutoff = Utilities.formatDate(new Date(Date.now() + notice * 3600000), tz, 'yyyy-MM-dd HH:mm');
  var names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  var days = {};
  var first = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var last = first;

  for (var i = 0; i <= daysAhead; i++) {
    var d = new Date(Date.now() + i * 86400000);
    var date = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    var dow = names[Number(Utilities.formatDate(d, tz, 'u')) % 7];
    last = date;
    var slots = [];
    hours.forEach(function (h) {
      if (h.day !== dow) return;
      for (var m = toMin_(h.start); m + session <= toMin_(h.end); m += session) {
        var t = fromMin_(m);
        var key = date + ' ' + t;
        if (key <= cutoff) continue;
        if ((taken[key] || 0) >= perSlot) continue;
        if (isClosed_(closed, date, m, m + session)) continue;
        if (slots.indexOf(t) < 0) slots.push(t);
      }
    });
    if (slots.length) days[date] = slots.sort();
  }
  return { ok: true, timezone: tz, sessionMinutes: session, firstDate: first, lastDate: last, days: days, services: SERVICES };
}

function isClosed_(closed, date, from, to) {
  return closed.some(function (c) {
    if (c.date !== date) return false;
    if (!c.start || !c.end) return true; // whole day closed
    return from < toMin_(c.end) && to > toMin_(c.start);
  });
}

/* ---------- helpers ---------- */

function validate_(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) return 'date';
  if (!/^\d{2}:\d{2}$/.test(d.time || '')) return 'time';
  if (SERVICES.indexOf(d.service) < 0) return 'service';
  if (!d.name || String(d.name).trim().length < 2 || String(d.name).length > 120) return 'name';
  if (!d.phone || !/^[+0-9 ()-]{7,20}$/.test(String(d.phone).trim())) return 'phone';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return 'email';
  if (d.message && String(d.message).length > 1500) return 'message';
  ['name', 'phone', 'email', 'message'].forEach(function (k) { if (d[k]) d[k] = clean_(d[k]); });
  return '';
}

function clean_(s) {
  s = String(s).trim();
  return /^[=+\-@]/.test(s) && !/^\+?[0-9 ()-]+$/.test(s) ? "'" + s : s; // stop spreadsheet formulas
}

function notify_(ref, d, session) {
  var set = settings_();
  var when = prettyDate_(d.date) + ' at ' + d.time + ' (' + session + ' minutes)';
  var lines = [
    'Reference: ' + ref, 'When: ' + when, 'Service: ' + d.service,
    'Name: ' + d.name, 'Phone: ' + d.phone, 'Email: ' + (d.email || '-'),
    '', 'Message:', d.message || '-'
  ].join('\n');
  if (set.notify_email) {
    MailApp.sendEmail({ to: String(set.notify_email), subject: 'New booking ' + ref + ': ' + d.service + ', ' + when, body: lines });
  }
  if (d.email) {
    MailApp.sendEmail({
      to: d.email,
      subject: 'Your appointment at Centre Ishema ry\'Umuryango is booked',
      body: 'Muraho ' + d.name + ',\n\nYour appointment is booked.\n\nWhen: ' + when + '\nService: ' + d.service +
        '\nReference: ' + ref + '\n\nTo change or cancel, please call ' + (set.centre_phone || 'the centre') +
        ' and give your reference.\n\nCentre Ishema ry\'Umuryango\nJourney to happiness'
    });
  }
}

function settings_() {
  var out = {};
  rows_('Settings').forEach(function (r) { if (r[0]) out[String(r[0]).trim()] = r[1]; });
  return out;
}

function rows_(name, asDisplayed) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var r = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn());
  return asDisplayed ? r.getDisplayValues() : r.getValues();
}

function tz_() { return SpreadsheetApp.getActive().getSpreadsheetTimeZone() || TZ_DEFAULT; }

function ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  var s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function hhmm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'HH:mm');
  var m = String(v || '').trim().toUpperCase().match(/^(\d{1,2})[:.H](\d{2})(?::\d{2})?\s*(AM|PM)?$/);
  if (!m) return '';
  var h = Number(m[1]);
  if (m[3] === 'PM' && h < 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  return ('0' + h).slice(-2) + ':' + m[2];
}

function toMin_(t) { var p = t.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
function fromMin_(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }

function prettyDate_(ymd) {
  var p = ymd.split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEEE d MMMM yyyy');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
