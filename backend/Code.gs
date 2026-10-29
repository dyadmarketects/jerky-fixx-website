/**
 * Jerky Fixx - website form backend
 * ---------------------------------------------------------------
 * Google Apps Script web app, bound to the Google Sheet
 * "Jerky Fixx Website Leads". The static site (GitHub Pages,
 * https://jerkyfixx.com) POSTs form-urlencoded data here.
 *
 * What it does for every valid submission:
 *   1. Appends a row to a tab named after the form type
 *      (tab + header row are created on first use).
 *   2. Sends ONE notification email to the Jerky Fixx inboxes
 *      (reply-to = the customer).
 *   3. For orders only, sends the customer a short confirmation.
 *
 * Browser side: send a "simple" request so no CORS preflight is needed:
 *   fetch(FORM_ENDPOINT, { method: 'POST', body: new URLSearchParams(data) })
 * Do not add custom headers or a JSON content type.
 *
 * Fields (all strings, read from e.parameter):
 *   form     order | contact | vip | events
 *   name, email, phone, address, topic, message
 *   items    JSON string: [{name, size, qty, price}, ...]
 *   total    order total (number or "$40.00")
 *   page     page URL the form was on
 *   hp       honeypot, must be empty
 *   t        milliseconds the visitor spent on the form (min 2500)
 *   consent  must be "yes" ("I'm not a robot" box)
 */

// ===================== SETTINGS (edit these) =====================

/** Both inboxes get every notification email. */
var NOTIFY_EMAILS = ['jerkyfixx@gmail.com', 'dyadmarketects@gmail.com'];

/** Shown as the "from" name on emails. Address is the script owner's Gmail. */
var SENDER_NAME = 'Jerky Fixx';

/** Where customers should reply to the order confirmation. */
var CUSTOMER_REPLY_TO = 'jerkyfixx@gmail.com';

/** Form type -> sheet tab name. */
var TAB_NAMES = {
  order: 'Orders',
  contact: 'Contact',
  vip: 'VIP Club',
  events: 'Event Alerts'
};

/** Header row used when a tab is created. */
var HEADERS = ['Timestamp', 'Name', 'Email', 'Phone', 'Address', 'Topic', 'Message', 'Items', 'Total', 'Page'];

/** Max characters kept per field, and other limits. */
var LIMITS = {
  name: 100,
  email: 254,
  phone: 40,
  address: 300,
  topic: 150,
  message: 4000,
  page: 300,
  itemName: 80,
  itemSize: 40,
  itemsRaw: 20000, // max length of the raw items JSON string
  maxItems: 50,
  maxQty: 99
};

/** Visitors who submit faster than this (ms) are treated as bots. */
var MIN_FORM_TIME_MS = 2500;

/** How long to wait for the write lock before giving up (ms). */
var LOCK_WAIT_MS = 20000;

// ===================== WEB APP ENTRY POINTS =====================

/** Health check: open the /exec URL in a browser to see this. */
function doGet() {
  return jsonOut_({ ok: true, service: 'jerkyfixx-forms' });
}

/** Main handler for form submissions. */
function doPost(e) {
  try {
    if (!e || !e.parameter) {
      return jsonOut_({ ok: false, error: 'No data received.' });
    }
    var p = e.parameter;

    // ---- 1. Spam checks. Failures look like success to the sender. ----
    var spamReason = checkSpam_(p);
    if (spamReason) {
      // Internal log only (View > Executions in the Apps Script editor).
      console.log(JSON.stringify({ ok: false, rejected: spamReason, form: p.form || '', page: clean_(p.page, LIMITS.page) }));
      return jsonOut_({ ok: true });
    }

    // ---- 2. Clean and validate. These return a real error. ----
    var form = String(p.form || '').toLowerCase().trim();
    if (!TAB_NAMES.hasOwnProperty(form)) {
      return jsonOut_({ ok: false, error: 'Unknown form type.' });
    }

    var data = {
      form: form,
      name: clean_(p.name, LIMITS.name),
      email: clean_(p.email, LIMITS.email).toLowerCase(),
      phone: clean_(p.phone, LIMITS.phone),
      address: cleanMultiline_(p.address, LIMITS.address),
      topic: clean_(p.topic, LIMITS.topic),
      message: cleanMultiline_(p.message, LIMITS.message),
      page: clean_(p.page, LIMITS.page),
      total: parseMoney_(p.total),
      items: parseItems_(p.items)
    };

    var problem = validate_(data);
    if (problem) {
      return jsonOut_({ ok: false, error: problem });
    }

    // ---- 3. Save to the sheet (locked so rows never collide). ----
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(LOCK_WAIT_MS);
    } catch (lockErr) {
      console.log('Lock timeout: ' + lockErr);
      return jsonOut_({ ok: false, error: 'We are busy right now. Please try again in a moment.' });
    }
    try {
      appendRow_(data);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    // ---- 4. Emails. The row is already saved, so a mail failure is
    //         logged but does not make the visitor's submission fail. ----
    try {
      sendNotification_(data);
    } catch (mailErr) {
      console.log('Notification email failed: ' + mailErr);
    }
    if (data.form === 'order') {
      try {
        sendCustomerConfirmation_(data);
      } catch (mailErr2) {
        console.log('Customer confirmation failed: ' + mailErr2);
      }
    }

    return jsonOut_({ ok: true });
  } catch (err) {
    console.log('doPost error: ' + err + (err && err.stack ? '\n' + err.stack : ''));
    return jsonOut_({ ok: false, error: 'Something went wrong. Please try again.' });
  }
}

// ===================== SPAM + VALIDATION =====================

/** Returns a reason string if the submission looks like spam, else ''. */
function checkSpam_(p) {
  if (p.hp !== undefined && String(p.hp).trim() !== '') return 'honeypot filled';

  var t = Number(p.t);
  if (!isFinite(t) || t < MIN_FORM_TIME_MS) return 'too fast or missing timer (t=' + p.t + ')';

  if (String(p.consent || '').toLowerCase().trim() !== 'yes') return 'consent box not ticked';

  return '';
}

/** Returns an error message for the visitor, or '' if the data is fine. */
function validate_(d) {
  if (!isValidEmail_(d.email)) return 'Please enter a valid email address.';

  if ((d.form === 'order' || d.form === 'contact') && !d.name) {
    return 'Please tell us your name.';
  }
  if (d.form === 'contact' && !d.message) {
    return 'Please add a message.';
  }
  if (d.form === 'order') {
    if (d.items === null) return 'We could not read your order. Please try again.';
    if (d.items.length === 0) return 'Your order is empty.';
  }
  return '';
}

/** Simple, strict-enough email check (no spaces, one @, a dot in the domain). */
function isValidEmail_(email) {
  if (!email || email.length > LIMITS.email) return false;
  return /^[^\s@<>"',;:()\[\]\\]+@[^\s@<>"',;:()\[\]\\]+\.[A-Za-z]{2,}$/.test(email);
}

// ===================== CLEANING HELPERS =====================

/** Single-line text: strip control chars, collapse whitespace, trim, cap length. */
function clean_(value, max) {
  var s = (value === undefined || value === null) ? '' : String(value);
  s = s.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.substring(0, max);
}

/** Multi-line text: keep line breaks, strip other control chars, trim, cap length. */
function cleanMultiline_(value, max) {
  var s = (value === undefined || value === null) ? '' : String(value);
  s = s.replace(/\r\n?/g, '\n')
       .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
       .replace(/\n{4,}/g, '\n\n\n')
       .trim();
  return s.substring(0, max);
}

/** "$40.00" / "40" / 40 -> 40 (number rounded to cents), or null if blank/invalid. */
function parseMoney_(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  var n = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  if (!isFinite(n) || n < 0 || n > 100000) return null;
  return Math.round(n * 100) / 100;
}

/** 40 -> "40", 12.5 -> "12.50". Empty string for null. */
function formatMoney_(n) {
  if (n === null || n === undefined) return '';
  return (n % 1 === 0) ? String(n) : n.toFixed(2);
}

/**
 * Parses the items JSON string into a clean array of
 * {name, size, qty, price}. Returns [] when nothing was sent and
 * null when the JSON is unreadable.
 */
function parseItems_(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return [];
  var str = String(raw);
  if (str.length > LIMITS.itemsRaw) return null;

  var arr;
  try {
    arr = JSON.parse(str);
  } catch (err) {
    return null;
  }
  if (!Array.isArray(arr)) return null;

  var out = [];
  for (var i = 0; i < arr.length && out.length < LIMITS.maxItems; i++) {
    var it = arr[i] || {};
    var name = clean_(it.name, LIMITS.itemName);
    if (!name) continue;
    var qty = parseInt(it.qty, 10);
    if (!isFinite(qty) || qty < 1) qty = 1;
    out.push({
      name: name,
      size: clean_(it.size, LIMITS.itemSize),
      qty: Math.min(qty, LIMITS.maxQty),
      price: parseMoney_(it.price)
    });
  }
  return out;
}

/** One readable line per item: "2 × Hot Cheetos (Large) $40". Price is shown as sent. */
function itemLines_(items) {
  return (items || []).map(function (it) {
    var line = it.qty + ' × ' + it.name;
    if (it.size) line += ' (' + it.size + ')';
    if (it.price !== null) line += ' $' + formatMoney_(it.price);
    return line;
  });
}

/** Escape text for safe use inside HTML. */
function esc_(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===================== SHEET =====================

/** Gets the tab for a form type, creating it (with header row) if needed. */
function getSheet_(form) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabName = TAB_NAMES[form];
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) sheet = ss.insertSheet(tabName);

  if (sheet.getLastRow() === 0) {
    var header = sheet.getRange(1, 1, 1, HEADERS.length);
    header.setValues([HEADERS])
          .setFontWeight('bold')
          .setBackground('#fde68a');
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setWrap(false);
    sheet.setColumnWidth(1, 150); // Timestamp
    sheet.setColumnWidth(6, 320); // Message
    sheet.setColumnWidth(7, 260); // Items
    // Plain-text format on data columns so nothing is ever treated as a
    // formula (e.g. a message starting with "=") and phone numbers keep "+".
    sheet.getRange(2, 2, sheet.getMaxRows() - 1, HEADERS.length - 1).setNumberFormat('@');
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
    sheet.getRange(2, 6, sheet.getMaxRows() - 1, 2).setWrap(true); // Message + Items
  }
  return sheet;
}

/** Appends one submission as a new row. Call while holding the lock. */
function appendRow_(d) {
  var sheet = getSheet_(d.form);
  var row = [
    new Date(),
    d.name,
    d.email,
    d.phone,
    d.address,
    d.topic,
    d.message,
    itemLines_(d.items).join('\n'),
    d.total === null ? '' : '$' + formatMoney_(d.total),
    d.page
  ];
  var target = sheet.getLastRow() + 1;
  // Make sure rows added past the formatted range are still plain text.
  sheet.getRange(target, 2, 1, HEADERS.length - 1).setNumberFormat('@');
  sheet.getRange(target, 1, 1, HEADERS.length).setValues([row]);
}

// ===================== EMAIL =====================

/** Builds the subject line for the team notification. */
function notificationSubject_(d) {
  var who = d.name || d.email;
  switch (d.form) {
    case 'order':
      return 'New order: ' + who + (d.total !== null ? ' ($' + formatMoney_(d.total) + ')' : '');
    case 'contact':
      return 'New question: ' + who;
    case 'vip':
      return 'VIP Club signup: ' + d.email;
    case 'events':
      return 'Event alerts signup: ' + d.email;
  }
  return 'New website submission: ' + who;
}

/** One email to both Jerky Fixx inboxes; reply goes to the customer. */
function sendNotification_(d) {
  var subject = notificationSubject_(d);
  var lines = itemLines_(d.items);

  // Table rows: [label, html, plain]. Blank values are skipped.
  var rows = [
    ['Form', esc_(TAB_NAMES[d.form]), TAB_NAMES[d.form]],
    ['Name', esc_(d.name), d.name],
    ['Email', '<a href="mailto:' + esc_(d.email) + '">' + esc_(d.email) + '</a>', d.email],
    ['Phone', esc_(d.phone), d.phone],
    ['Deliver to', esc_(d.address).replace(/\n/g, '<br>'), d.address],
    ['Topic', esc_(d.topic), d.topic],
    ['Message', esc_(d.message).replace(/\n/g, '<br>'), d.message],
    ['Items', lines.map(esc_).join('<br>'), lines.join('\n')],
    ['Total', d.total === null ? '' : '$' + esc_(formatMoney_(d.total)), d.total === null ? '' : '$' + formatMoney_(d.total)],
    ['Page', esc_(d.page), d.page],
    ['Received', esc_(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'EEE MMM d, yyyy h:mm a z')), '']
  ].filter(function (r) { return r[1] !== ''; });

  var htmlRows = rows.map(function (r) {
    return '<tr>' +
      '<td style="padding:8px 12px;border:1px solid #e5e7eb;background:#fffbeb;font-weight:bold;white-space:nowrap;vertical-align:top;">' + r[0] + '</td>' +
      '<td style="padding:8px 12px;border:1px solid #e5e7eb;vertical-align:top;">' + r[1] + '</td>' +
      '</tr>';
  }).join('');

  var htmlBody =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:600px;">' +
    '<h2 style="margin:0 0 12px;color:#b45309;">' + esc_(subject) + '</h2>' +
    '<table style="border-collapse:collapse;width:100%;font-size:14px;">' + htmlRows + '</table>' +
    '<p style="font-size:12px;color:#6b7280;margin-top:16px;">Hit reply to write back to the customer. Every submission is also saved in the "Jerky Fixx Website Leads" sheet.</p>' +
    '</div>';

  var plainBody = subject + '\n\n' + rows.map(function (r) {
    return r[2] ? r[0] + ': ' + r[2] : '';
  }).filter(Boolean).join('\n');

  MailApp.sendEmail({
    to: NOTIFY_EMAILS.join(','),
    subject: subject.replace(/[\r\n]+/g, ' '),
    body: plainBody,
    htmlBody: htmlBody,
    replyTo: d.email,
    name: SENDER_NAME
  });
}

/** Friendly order confirmation to the customer. */
function sendCustomerConfirmation_(d) {
  var firstName = (d.name.split(' ')[0]) || 'friend';
  var lines = itemLines_(d.items);
  var totalText = d.total === null ? '' : '$' + formatMoney_(d.total);

  var intro = 'Thanks, your order request is in. The Jerky Fixx crew will text or email you to confirm your order and payment (Cash App, Venmo, Apple Pay or cash). Once your package is dropped off, your dealer will send you a photo so you know it arrived.';

  var htmlBody =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;">' +
    '<h2 style="margin:0 0 8px;color:#b45309;">Hey ' + esc_(firstName) + ', get your fixx!</h2>' +
    '<p style="font-size:15px;line-height:1.5;">' + esc_(intro) + '</p>' +
    '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;">' +
    '<div style="font-weight:bold;margin-bottom:6px;">Your order request</div>' +
    lines.map(function (l) { return '<div>' + esc_(l) + '</div>'; }).join('') +
    (totalText ? '<div style="margin-top:8px;font-weight:bold;">Total: ' + esc_(totalText) + '</div>' : '') +
    (d.address ? '<div style="margin-top:8px;"><b>Deliver to:</b><br>' + esc_(d.address).replace(/\n/g, '<br>') + '</div>' : '') +
    '</div>' +
    '<p style="font-size:15px;">Got a change or a question? Just reply to this email.</p>' +
    '<p style="font-size:15px;">Stay snacky,<br>The Jerky Fixx crew</p>' +
    '</div>';

  var plainBody = 'Hey ' + firstName + ', get your fixx!\n\n' + intro + '\n\n' +
    'Your order request:\n' + lines.join('\n') +
    (totalText ? '\nTotal: ' + totalText : '') +
    (d.address ? '\nDeliver to: ' + d.address : '') +
    '\n\nGot a change or a question? Just reply to this email.\n\nStay snacky,\nThe Jerky Fixx crew';

  MailApp.sendEmail({
    to: d.email,
    subject: 'Your Jerky Fixx order request is in',
    body: plainBody,
    htmlBody: htmlBody,
    replyTo: CUSTOMER_REPLY_TO,
    name: SENDER_NAME
  });
}

// ===================== OUTPUT =====================

/** JSON response helper. */
function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================== TESTING (run from the editor) =====================

/**
 * Pick "testOrder" in the editor's function menu and press Run.
 * It writes a sample row to "Orders" and sends REAL emails (to both
 * Jerky Fixx inboxes, plus a confirmation to the address below).
 * It is also a handy way to trigger the Google permission prompt.
 */
function testOrder() {
  var result = doPost({
    parameter: {
      form: 'order',
      name: 'Test Customer',
      email: 'dyadmarketects@gmail.com', // change to test the customer email
      phone: '505-555-0100',
      message: 'Test order, please ignore.',
      items: JSON.stringify([{ name: 'Hot Cheetos', size: 'Large', qty: 2, price: 40 }]),
      total: '40',
      page: 'https://jerkyfixx.com/',
      hp: '',
      t: '5000',
      consent: 'yes'
    }
  });
  console.log(result.getContent());
}
