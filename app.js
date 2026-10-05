/* Tapis Domyos – appli tapis de course (Domyos T900D, FTMS). */
(function () {
'use strict';

/* ---------- Constantes ---------- */
var VERSION = '1.1';
var PROFILS = {
  kevin: { id: 'kevin', nom: 'Kévin', init: 'K', acc: '#2F56E0', ring: '#3D6BFF', soft: '#E3EAFF', ink: '#1E3FB0', pale: '#C9D6FF' },
  susan: { id: 'susan', nom: 'Susan', init: 'S', acc: '#C2401F', ring: '#FF7A55', soft: '#FFE4DC', ink: '#9A3216', pale: '#FFC9B8' }
};
var PROGRAMMES = [
  { id: 'p-fractionne', nom: 'Fractionné 6 × 1 min', desc: 'Accélérations courtes et récupérations',
    etapes: [{ d: 300, v: 7, p: 1, l: 'Échauffement' }].concat(repeat(6, [{ d: 60, v: 11, p: 1, l: 'Rapide' }, { d: 60, v: 7, p: 1, l: 'Récupération' }]), [{ d: 240, v: 6, p: 0, l: 'Retour au calme' }]) },
  { id: 'p-paliers', nom: 'Paliers progressifs', desc: 'La vitesse monte toutes les 4 minutes',
    etapes: [{ d: 300, v: 6, p: 1, l: 'Échauffement' }, { d: 240, v: 8, p: 1, l: 'Palier 1' }, { d: 240, v: 9, p: 1, l: 'Palier 2' },
             { d: 240, v: 10, p: 1, l: 'Palier 3' }, { d: 240, v: 11, p: 1, l: 'Palier 4' }, { d: 240, v: 6, p: 0, l: 'Retour au calme' }] },
  { id: 'p-cote', nom: 'Marche en côte', desc: 'Marche rapide, la pente alterne',
    etapes: [{ d: 300, v: 5, p: 1, l: 'Échauffement' }].concat(repeat(4, [{ d: 180, v: 5.5, p: 6, l: 'Côte' }, { d: 120, v: 5, p: 10, l: 'Forte côte' }]), [{ d: 300, v: 4.5, p: 0, l: 'Retour au calme' }]) }
];
var VMIN = 1, VMAX = 18, PMIN = 0, PMAX = 10;
var LS = {
  profil: 'foulee:profil', code: 'foulee:code', outbox: 'foulee:outbox', sync: 'foulee:sync', live: 'foulee:live',
  data: function (p) { return 'foulee:data:' + p; }, offset: function (p, prog) { return 'foulee:offset:' + p + ':' + prog; }
};
var API_URL = (window.FOULEE_CONFIG && window.FOULEE_CONFIG.apiUrl) || '';

function repeat(n, arr) { var out = []; for (var i = 0; i < n; i++) out = out.concat(arr.map(function (x) { return Object.assign({}, x); })); return out; }

/* ---------- Utilitaires ---------- */
var $ = function (id) { return document.getElementById(id); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fr(n, d) { return (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ','); }
function km(m, d) { return fr((m || 0) / 1000, d == null ? (m >= 10000 ? 1 : 2) : d); }
function mmss(s) { s = Math.max(0, Math.round(s)); var m = Math.floor(s / 60), r = s % 60; return m + ':' + ('0' + r).slice(-2); }
function dureeTxt(s) { s = Math.round(s || 0); var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? h + ' h ' + ('0' + m).slice(-2) : m + ' min'; }
function allure(kmh) { if (!kmh || kmh < 0.5) return '–'; var s = Math.round(3600 / kmh); return Math.floor(s / 60) + "'" + ('0' + (s % 60)).slice(-2) + '"'; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function jget(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dayStart(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function weekStart(d) { var x = dayStart(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function monthStart(d) { var x = dayStart(d); x.setDate(1); return x; }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { var x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
var MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
function dateLongue(d) { d = new Date(d); return JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()]; }
function dateCourte(d) { d = new Date(d); return d.getDate() + ' ' + MOIS_C[d.getMonth()]; }
function heure(d) { d = new Date(d); return d.getHours() + 'h' + ('0' + d.getMinutes()).slice(-2); }
function totalDuree(et) { return et.reduce(function (a, e) { return a + e.d; }, 0); }
function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }

var ICON = {
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11 12 4l9 7v9H3z"/></svg>',
  play: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 4v16l13-8z"/></svg>',
  chart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  user: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  bt: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 7 10 10-5 5V2l5 5L7 17"/></svg>',
  minus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M12 5v14"/></svg>',
  pause: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 5v14M15 5v14"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  run: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2v4M6 12l3-4h4l2 3 3 1M11 8l-1 5"/></svg>',
  star: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>'
};

/* ---------- Profil et thème ---------- */
var profil = null;     // objet PROFILS
function chargerProfil() {
  var id = localStorage.getItem(LS.profil) || sessionStorage.getItem(LS.profil);
  profil = PROFILS[id] || null;
  if (profil) appliquerTheme();
}
function appliquerTheme() {
  var r = document.documentElement.style;
  r.setProperty('--acc', profil.acc); r.setProperty('--acc-ring', profil.ring); r.setProperty('--acc-soft', profil.soft);
  r.setProperty('--acc-ink', profil.ink); r.setProperty('--acc-pale', profil.pale);
}
function avatar(p, size) {
  size = size || 40;
  return '<div class="avatar" style="width:' + size + 'px;height:' + size + 'px;background:' + p.soft + ';color:' + p.ink + ';font-size:' + Math.round(size * 0.42) + 'px">' + p.init + '</div>';
}

/* ---------- Données locales + synchronisation ---------- */
var DB = { seances: [], modeles: [] };
var syncState = { busy: false, error: '', last: 0 };
function chargerDB() { DB = jget(LS.data(profil.id), { seances: [], modeles: [] }); syncState.last = jget(LS.sync + ':' + profil.id, 0); }
function sauverDB() { jset(LS.data(profil.id), DB); }
function outbox() { return jget(LS.outbox, []); }
function appliquerOp(db, o) {
  var key = o.t === 'Seances' ? 'seances' : 'modeles';
  var arr = db[key];
  var id = o.op === 'del' ? o.id : o.row.id;
  var i = arr.findIndex(function (r) { return r.id === id; });
  if (o.op === 'del') { if (i >= 0) arr.splice(i, 1); return; }
  if (i >= 0) arr[i] = Object.assign({}, arr[i], o.row); else arr.push(Object.assign({}, o.row));
}
function commit(op) {
  op.profil = profil.id; op.uid = uid();
  if (op.row) op.row.profil = profil.id;
  appliquerOp(DB, op); sauverDB();
  var ob = outbox(); ob.push(op); jset(LS.outbox, ob);
  flush();
}
function api(fn, args) {
  return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args }) })
    .then(function (r) { return r.json(); })
    .then(function (j) { if (!j.ok) throw new Error(j.error || 'Erreur serveur'); return j.result; });
}
function stable(o) {
  if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
  if (o && typeof o === 'object') return '{' + Object.keys(o).sort().filter(function (k) { return o[k] !== null && o[k] !== '' && o[k] !== undefined; })
    .map(function (k) { return JSON.stringify(k) + ':' + stable(o[k]); }).join(',') + '}';
  return JSON.stringify(o);
}
function dbSig(db) {
  function sig(arr) { return arr.slice().sort(function (x, y) { return String(x.id).localeCompare(String(y.id)); }).map(stable).join('|'); }
  return sig(db.seances) + '#' + sig(db.modeles);
}
var retry = { n: 0, timer: null };
function planifierFlush(ms) { clearTimeout(retry.timer); retry.timer = setTimeout(flush, ms); }
function flush() {
  if (!API_URL || !profil) return Promise.resolve();
  if (syncState.busy) { syncState.again = true; return syncState.promise || Promise.resolve(); }
  var code = localStorage.getItem(LS.code) || '';
  if (!code) return Promise.resolve();
  var p = profil.id;
  var mine = outbox().filter(function (o) { return o.profil === p; });
  var sent = mine.map(function (o) { return o.uid; });
  syncState.busy = true; syncState.again = false;
  syncState.promise = withTimeout(api('sync', [code, p, mine.map(function (o) { return o.op === 'del' ? { op: 'del', t: o.t, id: o.id } : { op: 'put', t: o.t, row: o.row }; })]), 25000)
    .then(function (res) {
      var ob = outbox().filter(function (o) { return sent.indexOf(o.uid) < 0; });
      jset(LS.outbox, ob);
      if (profil && profil.id === p) {
        var db = { seances: res.seances || [], modeles: res.modeles || [] };
        ob.filter(function (o) { return o.profil === p; }).forEach(function (o) { appliquerOp(db, o); });
        var change = dbSig(db) !== dbSig(DB);
        DB = db; sauverDB();
        syncState.last = Date.now(); jset(LS.sync + ':' + p, syncState.last);
        if (change) rafraichir();
      }
      syncState.error = ''; retry.n = 0;
    })
    .catch(function (e) {
      syncState.error = /refusé/.test(e.message || '') ? e.message : 'Pas de réseau ou serveur injoignable, nouvel essai automatique.';
      if (!/refusé/.test(e.message || '')) { retry.n++; planifierFlush(Math.min(60000, 2000 * Math.pow(2, retry.n - 1))); }
    })
    .then(function () {
      syncState.busy = false;
      if (route.name === 'reglages') rafraichir();
      if (syncState.again || outbox().some(function (o) { return o.profil === p; }) && !syncState.error) planifierFlush(300);
    });
  return syncState.promise;
}
/* Redessine sans gêner : jamais pendant une saisie ni pendant la séance en direct. */
function rafraichir() {
  if (route.name === 'live' || route.name === 'profil') return;
  var a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) { syncState.pendingRender = true; return; }
  var y = window.scrollY; render(); window.scrollTo(0, y);
}
document.addEventListener('focusout', function () { setTimeout(function () { if (syncState.pendingRender) { syncState.pendingRender = false; rafraichir(); } }, 50); });
window.addEventListener('online', function () { retry.n = 0; flush(); });
document.addEventListener('visibilitychange', function () {
  if (!profil) return;
  if (document.visibilityState === 'visible') { retry.n = 0; flush(); if (!BLE.connected && !BLE.connecting) bleConnecter(false); }
  else envoiDeSecours();
});
window.addEventListener('pagehide', envoiDeSecours);
/* À la fermeture : envoi « au cas où » (les opérations sont rejouables sans risque, par id). */
function envoiDeSecours() {
  if (!API_URL || !profil || !navigator.sendBeacon) return;
  var code = localStorage.getItem(LS.code) || ''; if (!code) return;
  var mine = outbox().filter(function (o) { return o.profil === profil.id; });
  if (!mine.length) return;
  try {
    navigator.sendBeacon(API_URL, new Blob([JSON.stringify({ fn: 'sync', args: [code, profil.id, mine.map(function (o) { return o.op === 'del' ? { op: 'del', t: o.t, id: o.id } : { op: 'put', t: o.t, row: o.row }; })] })], { type: 'text/plain;charset=utf-8' }));
  } catch (e) {}
}
/* Relecture régulière (autre téléphone sur le même profil). */
setInterval(function () { if (document.visibilityState === 'visible' && route.name !== 'live') flush(); }, 45000);

/* ---------- Bluetooth (FTMS) ---------- */
var FTMS = 0x1826, HRS = 0x180D;
var BLE = {
  device: null, cp: null, connected: false, connecting: false, hasControl: false, error: '',
  data: { speed: 0, incl: 0, kcal: null, hr: null },
  speedRange: { min: VMIN, max: VMAX }, inclRange: { min: PMIN, max: PMAX }, waiter: null, chain: Promise.resolve()
};
function bleDispo() { return !!navigator.bluetooth; }
function bleConnecter(choisir) {
  if (!bleDispo()) { BLE.error = 'Bluetooth indisponible : ouvre l\'appli dans Chrome.'; majBle(); return Promise.resolve(false); }
  BLE.connecting = true; BLE.error = ''; majBle();
  var p = choisir
    ? navigator.bluetooth.requestDevice({ filters: [{ services: [FTMS] }, { namePrefix: 'Domyos' }], optionalServices: [FTMS, HRS] })
    : (navigator.bluetooth.getDevices ? navigator.bluetooth.getDevices() : Promise.resolve([])).then(function (list) {
        var d = list.filter(function (x) { return /domyos/i.test(x.name || ''); })[0] || list[0];
        if (!d) throw { name: 'Silencieux' };
        return d;
      });
  return p.then(function (dev) {
    BLE.device = dev;
    dev.removeEventListener('gattserverdisconnected', onBleDeco);
    dev.addEventListener('gattserverdisconnected', onBleDeco);
    return withTimeout(dev.gatt.connect(), 12000);
  }).then(function (server) { return brancherFtms(server); })
    .then(function () { BLE.connected = true; BLE.connecting = false; majBle(); return true; })
    .catch(function (e) {
      BLE.connecting = false; BLE.connected = false;
      if (e && e.name === 'Silencieux') BLE.error = '';
      else if (e && e.name === 'NotFoundError') BLE.error = '';
      else BLE.error = 'Connexion impossible : ' + (e && e.message || e) + '. Vérifie que le tapis est allumé et que l\'appli Decathlon est fermée.';
      majBle(); return false;
    });
}
function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('délai dépassé')); }, ms); })]); }
function brancherFtms(server) {
  return server.getPrimaryService(FTMS).then(function (svc) {
    return svc.getCharacteristic(0x2AD4).then(function (c) { return c.readValue(); }).then(function (v) {
      BLE.speedRange = { min: v.getUint16(0, true) / 100, max: v.getUint16(2, true) / 100 };
    }).catch(function () {})
    .then(function () { return svc.getCharacteristic(0x2AD5).then(function (c) { return c.readValue(); }).then(function (v) {
      BLE.inclRange = { min: v.getInt16(0, true) / 10, max: v.getInt16(2, true) / 10 };
    }).catch(function () {}); })
    .then(function () { return svc.getCharacteristic(0x2ACD); })
    .then(function (c) { c.addEventListener('characteristicvaluechanged', function (ev) { onTreadmill(ev.target.value); }); return c.startNotifications(); })
    .then(function () { return svc.getCharacteristic(0x2ADA).then(function (c) {
      c.addEventListener('characteristicvaluechanged', function (ev) { onMachineStatus(ev.target.value); }); return c.startNotifications(); }).catch(function () {}); })
    .then(function () { return svc.getCharacteristic(0x2AD9).then(function (c) {
      BLE.cp = c; BLE.hasControl = false;
      c.addEventListener('characteristicvaluechanged', function (ev) { onControlResponse(ev.target.value); }); return c.startNotifications(); }).catch(function () { BLE.cp = null; }); })
    .then(function () { return server.getPrimaryService(HRS).then(function (h) { return h.getCharacteristic(0x2A37); }).then(function (c) {
      c.addEventListener('characteristicvaluechanged', function (ev) { var v = ev.target.value, f = v.getUint8(0); var hr = (f & 1) ? v.getUint16(1, true) : v.getUint8(1); if (hr > 0) BLE.data.hr = hr; });
      return c.startNotifications(); }).catch(function () {}); });
  });
}
function onBleDeco() {
  BLE.connected = false; BLE.cp = null; BLE.hasControl = false; majBle();
  if (Live.s) Live.onDeco();
  if (!BLE.manuel) reconnecter(0);
}
/* Le tapis a décroché : on retente seul, sans demander à l'utilisateur. */
function reconnecter(n) {
  if (BLE.connected || BLE.connecting || !BLE.device || n > 20) return;
  setTimeout(function () {
    if (BLE.connected || BLE.connecting || document.visibilityState !== 'visible') { if (!BLE.connected) reconnecter(n + 1); return; }
    BLE.connecting = true; majBle();
    withTimeout(BLE.device.gatt.connect(), 8000).then(brancherFtms)
      .then(function () { BLE.connecting = false; BLE.connected = true; BLE.error = ''; majBle(); if (Live.s && Live.s.type === 'pilote' && Live.s.debut) Live.appliquerEtape(); })
      .catch(function () { BLE.connecting = false; majBle(); reconnecter(n + 1); });
  }, n === 0 ? 800 : 3000);
}
function onTreadmill(dv) {
  try {
    var o = 0, f = dv.getUint16(o, true); o += 2;
    if (!(f & 1)) { BLE.data.speed = dv.getUint16(o, true) / 100; o += 2; }
    if (f & 2) o += 2;
    if (f & 4) o += 3;
    if (f & 8) { BLE.data.incl = dv.getInt16(o, true) / 10; o += 4; }
    if (f & 16) o += 4;
    if (f & 32) o += 1;
    if (f & 64) o += 1;
    if (f & 128) { var k = dv.getUint16(o, true); BLE.data.kcal = k === 0xFFFF ? null : k; o += 5; }
    if (f & 256) { var h = dv.getUint8(o); if (h > 0) BLE.data.hr = h; o += 1; }
  } catch (e) {}
  if (Live.s) Live.onData();
}
function onMachineStatus(dv) {
  var op = dv.getUint8(0);
  if (op === 0x05 && dv.byteLength >= 3) Live.onConsole('v', dv.getUint16(1, true) / 100);
  else if (op === 0x06 && dv.byteLength >= 3) Live.onConsole('p', dv.getInt16(1, true) / 10);
  else if (op === 0x02) Live.onStop(dv.byteLength > 1 ? dv.getUint8(1) : 1);
  else if (op === 0x03) Live.onStop(1);
  else if (op === 0x04) Live.onStart();
  else if (op === 0x12) BLE.hasControl = false;
}
function onControlResponse(dv) {
  if (dv.getUint8(0) !== 0x80) return;
  var res = dv.getUint8(2);
  if (BLE.waiter) { var w = BLE.waiter; BLE.waiter = null; w(res); }
}
function envoyer(bytes) {
  BLE.chain = BLE.chain.then(function () {
    if (!BLE.cp) return -2;
    return new Promise(function (resolve) {
      var t = setTimeout(function () { BLE.waiter = null; resolve(-1); }, 2500);
      BLE.waiter = function (r) { clearTimeout(t); resolve(r); };
      var w = BLE.cp.writeValueWithResponse ? BLE.cp.writeValueWithResponse.bind(BLE.cp) : BLE.cp.writeValue.bind(BLE.cp);
      w(new Uint8Array(bytes)).catch(function () { clearTimeout(t); BLE.waiter = null; resolve(-2); });
    });
  });
  return BLE.chain;
}
function commande(bytes) {
  function go() { return envoyer(bytes).then(function (r) { if (r === 5) { BLE.hasControl = false; } return r; }); }
  var pre = BLE.hasControl ? Promise.resolve(1) : envoyer([0x00]).then(function (r) { if (r === 1) BLE.hasControl = true; return r; });
  return pre.then(go).then(function (r) {
    if (r !== 5) return r;
    return envoyer([0x00]).then(function (r2) { if (r2 === 1) { BLE.hasControl = true; return envoyer(bytes); } return r2; });
  });
}
function u16(v) { return [v & 0xFF, (v >> 8) & 0xFF]; }
function cibleVitesse(v) { v = Math.round(clamp(v, Math.max(VMIN, BLE.speedRange.min), Math.min(VMAX, BLE.speedRange.max)) * 10) / 10; Live.attendu('v', v); return commande([0x02].concat(u16(Math.round(v * 100)))); }
function ciblePente(p) { p = Math.round(clamp(p, BLE.inclRange.min, Math.min(PMAX, BLE.inclRange.max)) * 2) / 2; Live.attendu('p', p); var x = Math.round(p * 10); if (x < 0) x += 0x10000; return commande([0x03].concat(u16(x))); }
function tapisDemarrer() { return commande([0x07]); }
function tapisPause() { return commande([0x08, 0x02]); }
function tapisStop() { return commande([0x08, 0x01]); }
function bleChip() {
  if (BLE.connected) return '<span class="chip ok"><i></i>Tapis connecté</span>';
  if (BLE.connecting) return '<span class="chip warn"><i></i>Connexion…</span>';
  return '<span class="chip"><i></i>Tapis non connecté</span>';
}
function majBle() {
  var els = document.querySelectorAll('[data-ble]');
  for (var i = 0; i < els.length; i++) els[i].innerHTML = bleChip();
  var bt = document.querySelectorAll('[data-ble-zone]');
  for (var j = 0; j < bt.length; j++) bt[j].innerHTML = bleZone();
  if (route.name === 'live') Live.render();
}
function bleZone() {
  if (BLE.connected) return '';
  var msg = !bleDispo() ? 'Le Bluetooth ne marche que dans Chrome : ouvre l\'appli depuis Chrome.' : (BLE.error || 'Allume le tapis puis connecte-le.');
  return '<div class="banner ' + (BLE.error || !bleDispo() ? 'err' : 'warn') + '"><span>' + esc(msg) + '</span>' +
    (bleDispo() ? '<button class="primary" data-act="connect" ' + (BLE.connecting ? 'disabled' : '') + '>Connecter</button>' : '') + '</div>';
}

/* ---------- Séance en direct ---------- */
var Live = {
  s: null, timer: null,
  nouvelle: function (cfg) {
    Live.s = {
      type: cfg.type, prog: cfg.prog || null, offset: cfg.offset || 0,
      debut: null, active: 0, dist: 0, elev: 0, vmax: 0, pSum: 0,
      kcal0: null, kcalLast: null, kcalAcc: 0, hrSum: 0, hrN: 0, hrMax: 0,
      courbe: [], bucket: { t: 0, sum: 0 }, changes: [], cible: { v: null, p: null }, initPending: null,
      stepIdx: -1, paused: false, fini: false, lastTick: Date.now(), decompte: false
    };
    BLE.data.kcal = null;
    clearInterval(Live.timer);
    Live.timer = setInterval(Live.tick, 500);
    wakeLock(true);
  },
  etapes: function () {
    var s = Live.s; if (!s || !s.prog) return [];
    return s.prog.etapes.map(function (e) { return { d: e.d, v: clamp(Math.round((e.v + s.offset) * 10) / 10, VMIN, VMAX), p: e.p, l: e.l }; });
  },
  etapeA: function (sec) {
    var et = Live.etapes(), t = 0;
    for (var i = 0; i < et.length; i++) { if (sec < t + et[i].d) return { i: i, reste: t + et[i].d - sec }; t += et[i].d; }
    return { i: et.length, reste: 0 };
  },
  tick: function () {
    var s = Live.s; if (!s || s.fini) return;
    var now = Date.now(), dt = Math.min(now - s.lastTick, 2000); s.lastTick = now;
    var v = BLE.connected ? BLE.data.speed : 0, p = BLE.data.incl || 0;
    if (v > 0.05 && !s.debut) { s.debut = now; s.initPending = now; s.kcal0 = BLE.data.kcal; }
    if (s.initPending && now - s.initPending >= 2000) {
      s.changes.push({ t: 0, v: s.cible.v != null ? s.cible.v : Math.round(v * 10) / 10, p: s.cible.p != null ? s.cible.p : p });
      s.initPending = null;
    }
    if (v > 0.05) {
      s.paused = false;
      s.active += dt;
      var m = v / 3.6 * dt / 1000;
      s.dist += m; if (p > 0) s.elev += m * p / 100;
      s.vmax = Math.max(s.vmax, v); s.pSum += p * dt;
      s.bucket.sum += v * dt; s.bucket.t += dt;
      if (s.bucket.t >= 30000) { s.courbe.push(Math.round(s.bucket.sum / s.bucket.t * 10) / 10); s.bucket = { t: 0, sum: 0 }; }
      var hr = BLE.data.hr; if (hr) { s.hrSum += hr; s.hrN++; s.hrMax = Math.max(s.hrMax, hr); }
    }
    var k = BLE.data.kcal;
    if (k != null && s.debut) {
      if (s.kcal0 == null) s.kcal0 = k;
      if (s.kcalLast != null && k < s.kcalLast) { s.kcalAcc += s.kcalLast - s.kcal0; s.kcal0 = 0; }
      s.kcalLast = k;
    }
    if (s.type === 'pilote' && s.debut && !s.paused && BLE.connected) {
      var st = Live.etapeA(s.active / 1000);
      if (st.i >= Live.etapes().length) { Live.fin('auto'); return; }
      if (st.i !== s.stepIdx) { s.stepIdx = st.i; Live.appliquerEtape(); }
    }
    if (now - (s.saved || 0) > 4000) Live.sauver();
    if (route.name === 'live') Live.render();
  },
  sauver: function () {
    var s = Live.s; if (!s) return; s.saved = Date.now();
    var copie = Object.assign({}, s); copie.decompte = false;
    jset(LS.live, { profil: profil.id, s: copie, savedAt: Date.now() });
  },
  restaurer: function () {
    var x = jget(LS.live, null);
    if (!x || !profil || x.profil !== profil.id || Date.now() - x.savedAt > 3 * 3600 * 1000 || !x.s) { localStorage.removeItem(LS.live); return false; }
    Live.s = x.s; Live.s.lastTick = Date.now(); Live.s.fini = false;
    clearInterval(Live.timer); Live.timer = setInterval(Live.tick, 500); wakeLock(true);
    return true;
  },
  appliquerEtape: function () {
    var e = Live.etapes()[Live.s.stepIdx]; if (!e) return;
    cibleVitesse(e.v).then(function () { return ciblePente(e.p); });
  },
  attendu: function (k, val) { if (Live.s) Live.s.cible[k] = val; },
  onData: function () {},
  onConsole: function (k, val) {
    var s = Live.s; if (!s) return;
    s.cible[k] = val;
    if (s.debut && !s.initPending) {
      var c = { t: Math.round(s.active / 1000) }; c[k] = val;
      s.changes.push(c); Live.sauver();
    }
  },
  onStart: function () { if (Live.s) Live.s.paused = false; },
  onStop: function (param) {
    var s = Live.s; if (!s || !s.debut || s.fini) return;
    if (param === 2) { s.paused = true; if (route.name === 'live') Live.render(); }
    else Live.fin('tapis');
  },
  onDeco: function () { BLE.data.speed = 0; if (route.name === 'live') Live.render(); },
  kcal: function () { var s = Live.s; if (!s || s.kcalLast == null) return null; return Math.max(0, s.kcalAcc + s.kcalLast - (s.kcal0 || 0)); },
  demarrer: function () {
    var s = Live.s; if (!s || s.decompte) return;
    if (!BLE.connected) { toast('Connecte d\'abord le tapis.'); return; }
    s.decompte = true;
    var n = 3, ov = document.createElement('div');
    ov.className = 'overlay'; ov.innerHTML = '<div class="count num">3</div>';
    document.body.appendChild(ov);
    var it = setInterval(function () {
      n--;
      if (n > 0) { ov.firstChild.textContent = n; return; }
      clearInterval(it); ov.remove(); s.decompte = false;
      tapisDemarrer().then(function (r) {
        if (r !== 1) toast(r === 5 ? 'Le tapis refuse le pilotage : démarre-le avec sa console.' : 'Le tapis n\'a pas répondu : démarre-le avec sa console.');
        else if (s.type === 'pilote') { s.stepIdx = 0; Live.appliquerEtape(); }
      });
    }, 1000);
  },
  reprendre: function () {
    var s = Live.s;
    tapisDemarrer().then(function (r) {
      if (r === 1 && s.type === 'pilote') Live.appliquerEtape();
      else if (r !== 1) toast('Reprends avec la console du tapis.');
    });
  },
  vitesse: function (d) { var b = (Live.s.cible.v != null ? Live.s.cible.v : BLE.data.speed) || 0; cibleVitesse(b + d).then(function (r) { if (r !== 1) toast('Le tapis n\'a pas accepté le changement.'); }); },
  pente: function (d) { var b = (Live.s.cible.p != null ? Live.s.cible.p : BLE.data.incl) || 0; ciblePente(b + d).then(function (r) { if (r !== 1) toast('Le tapis n\'a pas accepté le changement.'); }); },
  annuler: function () { clearInterval(Live.timer); Live.s = null; wakeLock(false); localStorage.removeItem(LS.live); },
  fin: function (raison) {
    var s = Live.s; if (!s || s.fini) return;
    s.fini = true; clearInterval(Live.timer); wakeLock(false); localStorage.removeItem(LS.live);
    if (raison !== 'tapis' && BLE.connected && (BLE.data.speed > 0 || s.paused)) tapisStop();
    if (s.bucket.t >= 5000) s.courbe.push(Math.round(s.bucket.sum / s.bucket.t * 10) / 10);
    var duree = Math.round(s.active / 1000);
    if (duree < 30) { Live.s = null; toast('Séance trop courte : elle n\'est pas enregistrée.'); go('accueil'); return; }
    var row = {
      id: uid(), debut: new Date(s.debut).toISOString(), type: s.type, programme: s.prog ? s.prog.nom : '',
      duree: duree, distance: Math.round(s.dist), kcal: Live.kcal(), denivele: Math.round(s.elev),
      vmax: Math.round(s.vmax * 10) / 10, vmoy: Math.round(s.dist / (s.active / 1000) * 3.6 * 10) / 10,
      penteMoy: Math.round(s.pSum / s.active * 10) / 10,
      fcMoy: s.hrN ? Math.round(s.hrSum / s.hrN) : null, fcMax: s.hrMax || null,
      courbe: s.courbe, changements: s.changes, majLe: new Date().toISOString()
    };
    commit({ op: 'put', t: 'Seances', row: row });
    Live.s = null;
    go('fin', { id: row.id });
  },
  render: function () {
    var s = Live.s; if (!s || !$('lvMain')) return;
    var v = BLE.connected ? BLE.data.speed : 0, p = BLE.data.incl || 0;
    var sec = s.active / 1000;
    $('lvTime').textContent = mmss(sec);
    $('lvPace').textContent = allure(v);
    $('lvHr').textContent = BLE.data.hr || '–';
    $('lvV').innerHTML = fr(v, 1) + ' <small>km/h</small>';
    $('lvP').innerHTML = fr(p, 1) + ' <small>%</small>';
    $('lvDist').textContent = km(s.dist, 2);
    var frac, sub;
    if (s.type === 'pilote') {
      var tot = totalDuree(Live.etapes()); frac = clamp(sec / tot, 0, 1); sub = 'km · séance à ' + Math.round(frac * 100) + ' %';
      var st = Live.etapeA(sec), et = Live.etapes(), e = et[Math.min(st.i, et.length - 1)];
      $('lvStep').textContent = s.debut ? (e.l || 'Étape') + ' · ' + fr(e.v, 1) + ' km/h' + (e.p ? ' · ' + fr(e.p, 1) + ' %' : '') : 'Prêt à démarrer';
      $('lvRemain').innerHTML = s.debut ? 'encore <strong style="color:var(--acc)">' + mmss(st.reste) + '</strong>' : mmss(tot);
      $('lvBars').innerHTML = barresEtapes(et, s.debut ? st.i : -1, 72);
    } else {
      frac = (s.dist % 1000) / 1000; sub = 'km';
      var pts = s.courbe.slice(-39); if (s.bucket.t > 3000) pts.push(s.bucket.sum / s.bucket.t);
      $('lvStep').textContent = 'Vitesse toutes les 30 s';
      $('lvRemain').textContent = s.debut ? '' : 'Démarre avec la console ou le bouton';
      $('lvBars').innerHTML = pts.length ? barresCourbe(pts, 72, true) : '<div class="muted small" style="align-self:center;width:100%;text-align:center">La courbe apparaîtra ici.</div>';
    }
    $('lvRing').setAttribute('stroke-dashoffset', String(Math.round(528 * (1 - frac))));
    $('lvRingSub').textContent = sub;
    var main = $('lvMain');
    if (!s.debut) { main.innerHTML = ICON.play + 'Démarrer le tapis'; main.dataset.act = 'lv-start'; }
    else if (s.paused || v < 0.05) { main.innerHTML = ICON.play + 'Reprendre'; main.dataset.act = 'lv-resume'; }
    else { main.innerHTML = ICON.pause + 'Pause'; main.dataset.act = 'lv-pause'; }
    main.disabled = !BLE.connected;
    var ctrl = !!(BLE.connected && BLE.cp && s.debut);
    ['lvVm', 'lvVp', 'lvPm', 'lvPp'].forEach(function (id) { $(id).disabled = !ctrl; });
  }
};
var wl = null;
function wakeLock(on) {
  try {
    if (on && navigator.wakeLock && !wl) navigator.wakeLock.request('screen').then(function (x) { wl = x; x.addEventListener('release', function () { wl = null; }); }).catch(function () {});
    if (!on && wl) { wl.release(); wl = null; }
  } catch (e) {}
}
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Live.s) wakeLock(true); });

/* Barres : étapes d'un programme ou courbe de vitesse */
function barresEtapes(et, cur, h) {
  var vmax = Math.max.apply(null, et.map(function (e) { return e.v; }).concat([1]));
  return et.map(function (e, i) {
    var col = cur < 0 ? 'var(--acc-pale)' : i < cur ? 'var(--acc-ring)' : i === cur ? 'var(--acc-pale)' : 'var(--track)';
    if (cur >= 0 && i === cur) col = 'var(--acc)';
    return '<div style="flex:' + e.d + ' 1 0;height:' + Math.max(6, Math.round(e.v / vmax * h)) + 'px;background:' + col + '"></div>';
  }).join('');
}
function barresCourbe(pts, h, live) {
  var vmax = Math.max.apply(null, pts.concat([6]));
  return pts.map(function (v, i) {
    var last = live && i === pts.length - 1;
    return '<div style="flex:1 1 0;height:' + Math.max(4, Math.round(v / vmax * h)) + 'px;background:' + (last ? 'var(--acc)' : 'var(--acc-pale)') + '"></div>';
  }).join('');
}

/* Changements enregistrés → étapes d'un modèle */
function versEtapes(changes, duree) {
  var cur = { v: null, p: 0 }, snaps = [];
  changes.slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (c) {
    if (c.v != null) cur.v = c.v; if (c.p != null) cur.p = c.p;
    var snap = { t: c.t, v: cur.v, p: cur.p };
    if (snaps.length && c.t - snaps[snaps.length - 1].t < 3) snaps[snaps.length - 1] = snap; else snaps.push(snap);
  });
  var et = [], report = 0;
  snaps.forEach(function (sn, i) {
    var fin = i + 1 < snaps.length ? snaps[i + 1].t : duree;
    var d = Math.round(fin - sn.t);
    if (d <= 0 || sn.v == null || sn.v < 0.5) return;
    var last = et[et.length - 1];
    if (last && last.v === sn.v && last.p === sn.p) last.d += d;
    else if (d < 5 && last) last.d += d;
    else if (d < 5) report += d;            // démarrage du tapis : rattaché à l'étape suivante
    else { et.push({ d: d + report, v: sn.v, p: sn.p, l: '' }); report = 0; }
  });
  et.forEach(function (e, i) { e.l = 'Étape ' + (i + 1); });
  return et;
}

/* ---------- Navigation ---------- */
var route = { name: 'profil', params: {} };
var ui = { profilSel: null, retenir: true, resume: { mode: 'semaine', ref: new Date() }, modeleSauve: {}, nomModele: {} };
function go(name, params) { route = { name: name, params: params || {} }; render(); window.scrollTo(0, 0); }
var TABS = [['accueil', 'Accueil', ICON.home], ['seances', 'Séances', ICON.play], ['resume', 'Résumé', ICON.chart], ['reglages', 'Profil', ICON.user]];
function render() {
  var app = $('app'), tabs = $('tabs');
  var fn = SCREENS[route.name] || SCREENS.accueil;
  var withNav = ['accueil', 'seances', 'resume', 'reglages'].indexOf(route.name) >= 0;
  app.className = withNav ? '' : 'nonav';
  app.innerHTML = fn(route.params);
  tabs.hidden = !withNav;
  if (withNav) tabs.innerHTML = TABS.map(function (t) {
    return '<button data-act="tab" data-to="' + t[0] + '" class="' + (route.name === t[0] ? 'on' : '') + '">' + t[2] + t[1] + '</button>';
  }).join('');
  if (route.name === 'live') Live.render();
}
function salut() { var h = new Date().getHours(); return h >= 18 || h < 5 ? 'Bonsoir' : 'Bonjour'; }
function seancesEntre(a, b) { return DB.seances.filter(function (x) { var d = new Date(x.debut); return d >= a && d < b; }); }
function somme(list, k) { return list.reduce(function (a, x) { return a + (Number(x[k]) || 0); }, 0); }
function tousModeles() { return DB.modeles.slice().sort(function (a, b) { return String(b.creeLe).localeCompare(String(a.creeLe)); }); }
function trouverProg(id) {
  var p = PROGRAMMES.filter(function (x) { return x.id === id; })[0];
  if (p) return p;
  var m = DB.modeles.filter(function (x) { return x.id === id; })[0];
  return m ? { id: m.id, nom: m.nom, desc: 'Ton modèle', etapes: m.etapes || [], modele: true } : null;
}
function seanceItem(x) {
  return '<button class="item" data-act="detail" data-id="' + esc(x.id) + '"><div class="ic">' + (x.type === 'pilote' ? ICON.star : ICON.run) + '</div>' +
    '<div class="grow"><div class="t">' + esc(x.programme || 'Course libre') + '</div><div class="s">' + esc(dateLongue(x.debut)) + ' · ' + heure(x.debut) + '</div></div>' +
    '<div style="text-align:right"><div class="t num">' + km(x.distance) + ' km</div><div class="s num">' + mmss(x.duree) + '</div></div></button>';
}
function backBar(title, to) {
  return '<div class="between" style="margin:-6px 0 2px"><button class="ghost" data-act="tab" data-to="' + to + '" aria-label="Retour">' + ICON.back + 'Retour</button>' + (title || '') + '</div>';
}

var SCREENS = {
  profil: function () {
    var sel = ui.profilSel || (profil && profil.id) || null;
    var needCode = API_URL && !localStorage.getItem(LS.code);
    var cards = ['kevin', 'susan'].map(function (id) {
      var p = PROFILS[id];
      return '<button class="profcard' + (sel === id ? ' sel' : '') + '" data-act="pick" data-id="' + id + '" style="' + (sel === id ? 'outline-color:' + p.ring : '') + '">' +
        avatar(p, 88) + '<div style="font-size:20px;font-weight:700">' + p.nom + '</div></button>';
    }).join('');
    var p = PROFILS[sel];
    return '<div class="stack" style="gap:24px;padding-top:24px;flex:1">' +
      '<div><p class="muted" style="font-weight:500">' + salut() + '</p><h1 style="margin-top:4px">Qui s\'entraîne&nbsp;?</h1></div>' +
      '<div class="grid2" style="gap:14px">' + cards + '</div>' +
      '<div class="card row" style="gap:14px"><img src="icons/icon-192.png" alt="" width="56" height="56" style="flex-shrink:0">' +
        '<div><div style="font-weight:700">Tapis Domyos T900D</div><div class="small muted">Allume-le avant de commencer une séance. Ouvre l\'appli dans Chrome.</div></div></div>' +
      (needCode ? '<div class="stack" style="gap:8px"><label for="code" style="font-weight:600">Code d\'accès</label><input id="code" type="password" inputmode="numeric" autocomplete="off" placeholder="Code donné par Kévin"></div>' : '') +
      '<label class="check"><input type="checkbox" id="retenir" ' + (ui.retenir ? 'checked' : '') + '>Retenir mon choix sur ce téléphone</label>' +
      '<button class="primary big full" data-act="continuer" style="margin-top:auto;' + (p ? 'background:' + p.acc : '') + '" ' + (p ? '' : 'disabled') + '>' + (p ? 'Continuer en tant que ' + p.nom : 'Choisis ton profil') + '</button>' +
      '</div>';
  },

  accueil: function () {
    var ws = weekStart(new Date()), list = seancesEntre(ws, addDays(ws, 7));
    var jours = [0, 1, 2, 3, 4, 5, 6].map(function (i) { var a = addDays(ws, i); return somme(seancesEntre(a, addDays(a, 1)), 'distance'); });
    var max = Math.max.apply(null, jours.concat([1])), today = (new Date().getDay() + 6) % 7;
    var bars = jours.map(function (m, i) {
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;justify-content:flex-end;height:96px">' +
        '<div style="width:100%;border-radius:8px;height:' + (m ? Math.max(8, Math.round(m / max * 70)) : 4) + 'px;background:' + (m ? 'var(--acc-ring)' : 'var(--track)') + '"></div>' +
        '<div class="small" style="font-size:11px;color:' + (i === today ? 'var(--ink)' : 'var(--muted)') + ';font-weight:' + (i === today ? 700 : 500) + '">' + 'LMMJVSD'[i] + '</div></div>';
    }).join('');
    var last = DB.seances.slice().sort(function (a, b) { return String(b.debut).localeCompare(String(a.debut)); })[0];
    return '<div class="stack">' +
      '<div class="between"><div class="row">' + avatar(profil, 44) + '<div><div class="small muted">' + salut() + '</div><div style="font-weight:800;font-size:20px">' + profil.nom + '</div></div></div><span data-ble>' + bleChip() + '</span></div>' +
      '<div data-ble-zone>' + bleZone() + '</div>' +
      '<button class="card" data-act="libre" style="border:0;text-align:left;font:inherit;color:#fff;background:var(--acc);display:flex;justify-content:space-between;align-items:center;min-height:110px;cursor:pointer">' +
        '<div><div style="font-size:22px;font-weight:800">Course libre</div><div style="opacity:.85;font-size:14px;margin-top:4px">Tu règles le tapis, l\'appli enregistre tout.</div></div>' + ICON.next + '</button>' +
      '<button class="item" data-act="tab" data-to="seances"><div class="ic">' + ICON.star + '</div><div class="grow"><div class="t">Séance guidée</div><div class="s">Le tapis change vitesse et pente pour toi</div></div>' + ICON.next + '</button>' +
      '<div class="card"><div class="between"><h2>Cette semaine</h2><span class="small muted">' + list.length + ' séance' + (list.length > 1 ? 's' : '') + '</span></div>' +
        '<div style="font-size:36px;font-weight:800;letter-spacing:-0.02em;margin-top:4px" class="num">' + km(somme(list, 'distance')) + ' <span class="muted" style="font-size:16px">km</span></div>' +
        '<div style="display:flex;gap:8px;margin-top:8px">' + bars + '</div></div>' +
      (last ? '<div class="stack" style="gap:10px"><h2>Dernière séance</h2>' + seanceItem(last) + '</div>' : '') +
      '</div>';
  },

  seances: function () {
    var mods = tousModeles();
    function progItem(p) {
      var et = p.etapes || [];
      return '<button class="item" data-act="prep" data-id="' + esc(p.id) + '" style="flex-direction:column;align-items:stretch;gap:10px">' +
        '<div class="between"><div><div class="t">' + esc(p.nom) + '</div><div class="s">' + esc(p.desc || '') + '</div></div><div class="t num" style="white-space:nowrap">' + dureeTxt(totalDuree(et)) + '</div></div>' +
        '<div class="bars" style="height:34px">' + barresEtapes(et, -1, 34) + '</div></button>';
    }
    return '<div class="stack">' +
      '<h1>Séances</h1>' +
      '<div class="stack" style="gap:10px"><h2>Programmes</h2>' + PROGRAMMES.map(progItem).join('') + '</div>' +
      '<div class="stack" style="gap:10px"><h2>Mes modèles</h2>' +
        (mods.length ? mods.map(function (m) { return progItem({ id: m.id, nom: m.nom, desc: 'Enregistré le ' + dateCourte(m.creeLe), etapes: m.etapes || [] }); }).join('')
          : '<div class="card empty">Fais une course libre en réglant le tapis avec sa console, puis touche « Enregistrer comme modèle » à la fin. Elle apparaîtra ici et le tapis la rejouera tout seul.</div>') +
      '</div></div>';
  },

  prep: function (pr) {
    var p = trouverProg(pr.id); if (!p) return SCREENS.seances();
    var off = jget(LS.offset(profil.id, p.id), 0);
    var et = p.etapes.map(function (e) { return { d: e.d, v: clamp(Math.round((e.v + off) * 10) / 10, VMIN, VMAX), p: e.p, l: e.l }; });
    var dist = et.reduce(function (a, e) { return a + e.v / 3.6 * e.d; }, 0);
    var lignes = et.map(function (e) {
      return '<div class="between small" style="padding:8px 0;border-bottom:1px solid var(--line)"><span>' + esc(e.l || '') + '</span><span class="num muted">' + mmss(e.d) + ' · <strong style="color:var(--ink)">' + fr(e.v, 1) + ' km/h</strong>' + (e.p ? ' · ' + fr(e.p, 1) + ' %' : '') + '</span></div>';
    }).join('');
    return '<div class="stack">' + backBar('', 'seances') +
      '<div><h1>' + esc(p.nom) + '</h1><p class="muted" style="margin-top:4px">' + esc(p.desc || '') + '</p></div>' +
      '<div class="card"><div class="between small muted"><span>' + dureeTxt(totalDuree(et)) + '</span><span>environ ' + km(dist, 1) + ' km</span></div>' +
        '<div class="bars" style="height:80px;margin-top:12px">' + barresEtapes(et, -1, 80) + '</div></div>' +
      '<div class="card"><div class="between"><div><h2>Intensité</h2><div class="small muted">Décale toutes les vitesses</div></div>' +
        '<div class="row"><button class="white" data-act="off" data-d="-0.5" aria-label="Moins vite" style="width:48px;padding:0">' + ICON.minus + '</button>' +
        '<strong class="num" style="min-width:74px;text-align:center">' + (off > 0 ? '+' : '') + fr(off, 1) + ' km/h</strong>' +
        '<button class="white" data-act="off" data-d="0.5" aria-label="Plus vite" style="width:48px;padding:0">' + ICON.plus + '</button></div></div></div>' +
      '<div class="card" style="padding-top:8px;padding-bottom:8px">' + lignes + '</div>' +
      (p.modele ? '<div class="grid2"><button class="white" data-act="renommer" data-id="' + esc(p.id) + '">Renommer</button><button class="danger" data-act="suppr-modele" data-id="' + esc(p.id) + '">Supprimer</button></div>' : '') +
      '<button class="primary big full" data-act="go-pilote" data-id="' + esc(p.id) + '">Commencer</button></div>';
  },

  live: function () {
    var s = Live.s; if (!s) return SCREENS.accueil();
    var titre = s.prog ? s.prog.nom : 'Course libre';
    function ctrl(label, id, m, pl, act) {
      return '<div class="card" style="padding:14px"><div class="small muted" style="font-weight:600">' + label + '</div>' +
        '<div class="num" id="' + id + '" style="font-size:26px;font-weight:800;margin-top:2px">–</div>' +
        '<div class="stepper"><button class="minus" id="' + m + '" data-act="' + act + '" data-d="-1" aria-label="Diminuer">' + ICON.minus + '</button>' +
        '<button id="' + pl + '" data-act="' + act + '" data-d="1" aria-label="Augmenter">' + ICON.plus + '</button></div></div>';
    }
    return '<div class="stack" style="gap:14px;flex:1">' +
      '<div class="between"><div class="row">' + avatar(profil, 40) + '<div><div style="font-weight:700">' + esc(titre) + '</div><div class="small muted">' + profil.nom + (s.type === 'pilote' ? ' · séance guidée' : ' · course libre') + '</div></div></div><span data-ble>' + bleChip() + '</span></div>' +
      '<div data-ble-zone>' + bleZone() + '</div>' +
      '<div class="card" style="padding:16px"><div class="between small" style="margin-bottom:12px"><strong id="lvStep">–</strong><span class="muted num" id="lvRemain"></span></div>' +
        '<div class="bars" id="lvBars" style="height:72px"></div></div>' +
      '<div class="ring" style="width:196px;height:196px"><svg width="196" height="196" viewBox="0 0 196 196">' +
        '<circle cx="98" cy="98" r="84" fill="#fff" stroke="var(--track)" stroke-width="14"/>' +
        '<circle id="lvRing" cx="98" cy="98" r="84" fill="none" stroke="var(--acc-ring)" stroke-width="14" stroke-linecap="round" stroke-dasharray="528" stroke-dashoffset="528" transform="rotate(-90 98 98)"/></svg>' +
        '<div class="c"><div class="small muted" style="font-weight:600">Distance</div><div class="num" id="lvDist" style="font-size:44px;font-weight:800;letter-spacing:-0.03em;line-height:1.05">0,00</div><div class="small muted" id="lvRingSub">km</div></div></div>' +
      '<div class="card grid3" style="padding:14px 6px;text-align:center;gap:0">' +
        '<div><div class="small muted">Temps</div><div class="num" id="lvTime" style="font-size:22px;font-weight:800">0:00</div></div>' +
        '<div style="border-left:1px solid var(--line);border-right:1px solid var(--line)"><div class="small muted">Allure</div><div class="num" id="lvPace" style="font-size:22px;font-weight:800">–</div></div>' +
        '<div><div class="small muted">Cardio</div><div class="num" id="lvHr" style="font-size:22px;font-weight:800;color:#C2401F">–</div></div></div>' +
      '<div class="grid2">' + ctrl('Vitesse', 'lvV', 'lvVm', 'lvVp', 'lv-v') + ctrl('Pente', 'lvP', 'lvPm', 'lvPp', 'lv-p') + '</div>' +
      '<div class="row" style="margin-top:auto;gap:12px"><button class="primary big" id="lvMain" style="flex:1">–</button><button class="white big" data-act="lv-end">Terminer</button></div>' +
      '</div>';
  },

  fin: function (pr) {
    var x = DB.seances.filter(function (r) { return r.id === pr.id; })[0];
    if (!x) return SCREENS.accueil();
    var peutModele = x.type === 'libre' && x.changements && versEtapes(x.changements, x.duree).length >= 2;
    var sauve = ui.modeleSauve[x.id];
    return '<div class="stack">' +
      '<div style="padding-top:10px"><p class="muted">' + esc(dateLongue(x.debut)) + ' · ' + heure(x.debut) + '</p><h1 style="margin-top:4px">Bravo ' + profil.nom + '&nbsp;!</h1></div>' +
      statsSeance(x) +
      '<div class="row small muted">' + (API_URL ? (outbox().length ? '<span class="chip warn"><i></i>Enregistrée, en attente d\'envoi</span>' : '<span class="chip ok"><i></i>Séance enregistrée</span>') : '<span class="chip ok"><i></i>Séance enregistrée sur ce téléphone</span>') + '</div>' +
      (peutModele ? (sauve ? '<div class="card"><h2>Modèle enregistré</h2><p class="small muted" style="margin-top:4px">Retrouve-le dans Séances › Mes modèles : le tapis refera les mêmes changements tout seul.</p></div>'
        : '<div class="card stack" style="gap:10px"><div><h2>Enregistrer comme modèle&nbsp;?</h2><p class="small muted" style="margin-top:4px">L\'appli a noté ' + versEtapes(x.changements, x.duree).length + ' réglages de vitesse et de pente. La prochaine fois, le tapis les refera tout seul.</p></div>' +
          '<div class="bars" style="height:44px">' + barresEtapes(versEtapes(x.changements, x.duree), -1, 44) + '</div>' +
          '<input type="text" id="nomModele" maxlength="40" placeholder="Nom du modèle" value="' + esc(ui.nomModele[x.id] != null ? ui.nomModele[x.id] : 'Ma séance du ' + dateCourte(x.debut)) + '">' +
          '<button data-act="save-modele" data-id="' + esc(x.id) + '">Enregistrer comme modèle</button></div>') : '') +
      '<button class="primary big full" data-act="tab" data-to="accueil">Retour à l\'accueil</button></div>';
  },

  detail: function (pr) {
    var x = DB.seances.filter(function (r) { return r.id === pr.id; })[0];
    if (!x) return SCREENS.resume();
    return '<div class="stack">' + backBar('', pr.from || 'resume') +
      '<div><p class="muted">' + esc(dateLongue(x.debut)) + ' · ' + heure(x.debut) + '</p><h1 style="margin-top:4px">' + esc(x.programme || 'Course libre') + '</h1></div>' +
      statsSeance(x) +
      '<button class="danger full" data-act="suppr-seance" data-id="' + esc(x.id) + '">Supprimer cette séance</button></div>';
  },

  resume: function () {
    var r = ui.resume, mois = r.mode === 'mois';
    var a = mois ? monthStart(r.ref) : weekStart(r.ref), b = mois ? addMonths(a, 1) : addDays(a, 7);
    var pa = mois ? addMonths(a, -1) : addDays(a, -7);
    var list = seancesEntre(a, b), prev = seancesEntre(pa, a);
    var dist = somme(list, 'distance'), dprev = somme(prev, 'distance'), duree = somme(list, 'duree');
    var kcal = somme(list, 'kcal');
    var label = mois ? (MOIS[a.getMonth()].charAt(0).toUpperCase() + MOIS[a.getMonth()].slice(1) + ' ' + a.getFullYear()) : 'Du ' + dateCourte(a) + ' au ' + dateCourte(addDays(b, -1));
    var futur = b > new Date();
    var delta = dprev > 0 ? Math.round((dist - dprev) / dprev * 100) : null;
    var groups = [];
    if (mois) { for (var w = weekStart(a); w < b; w = addDays(w, 7)) groups.push({ l: dateCourte(w > a ? w : a), v: somme(seancesEntre(w < a ? a : w, addDays(w, 7) > b ? b : addDays(w, 7)), 'distance') }); }
    else for (var i = 0; i < 7; i++) { var d0 = addDays(a, i); groups.push({ l: 'LMMJVSD'[i], v: somme(seancesEntre(d0, addDays(d0, 1)), 'distance') }); }
    var gmax = Math.max.apply(null, groups.map(function (g) { return g.v; }).concat([1]));
    var bars = groups.map(function (g) {
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:118px;min-width:0">' +
        '<div class="num" style="font-size:11px;font-weight:700">' + (g.v ? km(g.v, 1) : '') + '</div>' +
        '<div style="width:100%;border-radius:8px;height:' + (g.v ? Math.max(8, Math.round(g.v / gmax * 72)) : 4) + 'px;background:' + (g.v === gmax && g.v ? 'var(--acc-ring)' : g.v ? 'var(--acc-pale)' : 'var(--track)') + '"></div>' +
        '<div style="font-size:11px;color:var(--muted);white-space:nowrap">' + g.l + '</div></div>';
    }).join('');
    var cal = '';
    if (mois) {
      var cells = [], off = (a.getDay() + 6) % 7, nb = addDays(b, -1).getDate();
      for (var k = 0; k < off; k++) cells.push('<div></div>');
      for (var j = 1; j <= nb; j++) {
        var dj = new Date(a.getFullYear(), a.getMonth(), j), m = somme(seancesEntre(dj, addDays(dj, 1)), 'distance');
        var st = m >= 8000 ? 'background:var(--acc);color:#fff' : m > 0 ? 'background:var(--acc-pale);color:var(--acc-ink)' : 'background:var(--bg);color:#8A93A3';
        cells.push('<div class="num" style="' + st + '">' + j + '</div>');
      }
      cal = '<div class="card"><div class="cal" style="margin-bottom:6px;font-size:11px;color:var(--muted);text-align:center"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div class="cal">' + cells.join('') + '</div></div>';
    }
    return '<div class="stack">' +
      '<div class="between"><h1>Résumé</h1></div>' +
      '<div class="seg"><button data-act="mode" data-m="semaine" class="' + (mois ? '' : 'on') + '">Semaine</button><button data-act="mode" data-m="mois" class="' + (mois ? 'on' : '') + '">Mois</button></div>' +
      '<div class="between"><button class="white" data-act="periode" data-d="-1" aria-label="Période précédente" style="width:48px;padding:0">' + ICON.back + '</button>' +
        '<strong>' + esc(label) + '</strong>' +
        '<button class="white" data-act="periode" data-d="1" aria-label="Période suivante" style="width:48px;padding:0" ' + (futur ? 'disabled' : '') + '>' + ICON.next + '</button></div>' +
      '<div class="card"><div class="between" style="align-items:flex-start"><div><div class="small muted" style="font-weight:600">Distance</div>' +
        '<div class="num" style="font-size:44px;font-weight:800;letter-spacing:-0.03em">' + km(dist) + ' <span class="muted" style="font-size:18px">km</span></div></div>' +
        (delta != null ? '<span class="chip ' + (delta >= 0 ? 'ok' : 'warn') + '">' + (delta >= 0 ? '+' : '') + delta + ' %</span>' : '') + '</div>' +
        '<div style="display:flex;gap:' + (mois ? 12 : 8) + 'px;margin-top:6px">' + bars + '</div></div>' +
      '<div class="grid2">' +
        '<div class="tile"><div class="l">Séances</div><div class="v num">' + list.length + '</div></div>' +
        '<div class="tile"><div class="l">Temps</div><div class="v num">' + dureeTxt(duree) + '</div></div>' +
        '<div class="tile"><div class="l">Allure moyenne</div><div class="v num">' + (duree ? allure(dist / duree * 3.6) : '–') + '</div></div>' +
        '<div class="tile"><div class="l">Calories</div><div class="v num">' + (kcal ? Math.round(kcal) : '–') + '</div></div></div>' +
      cal +
      '<div class="stack" style="gap:10px"><h2>Séances</h2>' + (list.length ? list.sort(function (x, y) { return String(y.debut).localeCompare(String(x.debut)); }).map(seanceItem).join('') : '<div class="card empty">Aucune séance sur cette période.</div>') + '</div>' +
      '</div>';
  },

  reglages: function () {
    var nb = outbox().filter(function (o) { return o.profil === profil.id; }).length;
    var sync = !API_URL ? 'Pas de serveur configuré : les séances restent sur ce téléphone.'
      : syncState.error ? 'Erreur : ' + syncState.error
      : syncState.busy ? 'Synchronisation…'
      : (nb ? nb + ' modification' + (nb > 1 ? 's' : '') + ' en attente' : (syncState.last ? 'À jour (' + heure(syncState.last) + ')' : 'Jamais synchronisé'));
    return '<div class="stack">' +
      '<h1>Profil</h1>' +
      '<div class="card row" style="gap:16px">' + avatar(profil, 64) + '<div class="grow"><div style="font-size:22px;font-weight:800">' + profil.nom + '</div><div class="small muted">' + DB.seances.length + ' séance' + (DB.seances.length > 1 ? 's' : '') + ' enregistrée' + (DB.seances.length > 1 ? 's' : '') + '</div></div></div>' +
      '<button class="white full" data-act="changer-profil">Changer de profil</button>' +
      '<div class="card stack" style="gap:10px"><div class="between"><h2>Tapis</h2><span data-ble>' + bleChip() + '</span></div>' +
        '<p class="small muted">' + (BLE.device ? esc(BLE.device.name || 'Tapis') : 'Aucun tapis mémorisé') + '</p>' +
        '<button data-act="connect-new">Choisir le tapis</button></div>' +
      '<div class="card stack" style="gap:10px"><h2>Sauvegarde</h2><p class="small ' + (syncState.error ? '' : 'muted') + '" style="' + (syncState.error ? 'color:var(--err)' : '') + '">' + esc(sync) + '</p>' +
        (API_URL ? '<button data-act="sync">Synchroniser maintenant</button>' +
          '<label for="code2" class="small" style="font-weight:600">Code d\'accès</label><div class="row"><input id="code2" type="password" inputmode="numeric" autocomplete="off" placeholder="Nouveau code"><button data-act="save-code">OK</button></div>' : '') + '</div>' +
      '<p class="small muted" style="text-align:center">Tapis Domyos ' + VERSION + '</p></div>';
  }
};

function statsSeance(x) {
  var tiles = [
    ['Distance', km(x.distance) + ' <small>km</small>'], ['Durée', mmss(x.duree)],
    ['Allure moyenne', allure(x.vmoy)], ['Calories', x.kcal != null && x.kcal !== '' ? Math.round(x.kcal) : '–'],
    ['Dénivelé', (x.denivele || 0) + ' <small>m</small>'], ['Vitesse max', fr(x.vmax || 0, 1) + ' <small>km/h</small>']
  ];
  if (x.fcMoy) tiles.push(['Cardio moyen', x.fcMoy + ' <small>bpm</small>'], ['Cardio max', x.fcMax + ' <small>bpm</small>']);
  var c = x.courbe || [];
  return '<div class="grid2">' + tiles.map(function (t) { return '<div class="tile"><div class="l">' + t[0] + '</div><div class="v num">' + t[1] + '</div></div>'; }).join('') + '</div>' +
    (c.length ? '<div class="card"><div class="small muted" style="font-weight:600;margin-bottom:10px">Vitesse au fil de la séance</div><div class="bars" style="height:70px">' + barresCourbe(c, 70, false) + '</div></div>' : '');
}

/* ---------- Actions ---------- */
document.addEventListener('click', function (ev) {
  var el = ev.target.closest('[data-act]'); if (!el || el.disabled) return;
  var a = el.dataset.act, id = el.dataset.id;
  switch (a) {
    case 'pick': ui.profilSel = id; var r = $('retenir'); if (r) ui.retenir = r.checked; render(); break;
    case 'continuer': {
      var sel = ui.profilSel || (profil && profil.id); if (!PROFILS[sel]) return;
      var codeEl = $('code');
      if (codeEl) { if (!codeEl.value.trim()) { toast('Entre le code d\'accès.'); codeEl.focus(); return; } localStorage.setItem(LS.code, codeEl.value.trim()); }
      var keep = $('retenir') ? $('retenir').checked : true;
      localStorage.removeItem(LS.profil); sessionStorage.removeItem(LS.profil);
      (keep ? localStorage : sessionStorage).setItem(LS.profil, sel);
      ui.profilSel = null; chargerProfil(); chargerDB(); go('accueil'); flush();
      if (!BLE.connected) bleConnecter(false);
      break;
    }
    case 'tab': go(el.dataset.to); break;
    case 'connect': bleConnecter(true); break;
    case 'connect-new': BLE.manuel = true; if (BLE.device && BLE.device.gatt.connected) BLE.device.gatt.disconnect(); BLE.manuel = false; bleConnecter(true).then(function () { render(); }); break;
    case 'libre': Live.nouvelle({ type: 'libre' }); go('live'); if (!BLE.connected) bleConnecter(false); break;
    case 'prep': go('prep', { id: id }); break;
    case 'off': {
      var k = LS.offset(profil.id, route.params.id), v = clamp(jget(k, 0) + Number(el.dataset.d), -3, 4);
      jset(k, v); render(); break;
    }
    case 'go-pilote': {
      var p = trouverProg(id); if (!p) return;
      Live.nouvelle({ type: 'pilote', prog: { id: p.id, nom: p.nom, etapes: p.etapes }, offset: jget(LS.offset(profil.id, p.id), 0) });
      go('live');
      if (BLE.connected) Live.demarrer(); else bleConnecter(false);
      break;
    }
    case 'lv-start': Live.demarrer(); break;
    case 'lv-pause': tapisPause().then(function (r) { if (r !== 1) toast('Mets en pause avec la console du tapis.'); }); break;
    case 'lv-resume': Live.reprendre(); break;
    case 'lv-v': Live.vitesse(0.5 * Number(el.dataset.d)); break;
    case 'lv-p': Live.pente(0.5 * Number(el.dataset.d)); break;
    case 'lv-end':
      if (!Live.s || !Live.s.debut) { Live.annuler(); go('accueil'); }
      else if (confirm('Terminer la séance et l\'enregistrer ?')) Live.fin('bouton');
      break;
    case 'save-modele': {
      var x = DB.seances.filter(function (r) { return r.id === id; })[0]; if (!x) return;
      var nom = ($('nomModele').value || '').trim() || 'Ma séance du ' + dateCourte(x.debut);
      var now = new Date().toISOString();
      commit({ op: 'put', t: 'Modeles', row: { id: uid(), nom: nom, etapes: versEtapes(x.changements, x.duree), source: x.id, creeLe: now, majLe: now } });
      ui.modeleSauve[x.id] = true; render(); break;
    }
    case 'renommer': {
      var m = DB.modeles.filter(function (r) { return r.id === id; })[0]; if (!m) return;
      var n = prompt('Nouveau nom du modèle', m.nom); if (!n || !n.trim()) return;
      commit({ op: 'put', t: 'Modeles', row: { id: id, nom: n.trim().slice(0, 40), majLe: new Date().toISOString() } }); render(); break;
    }
    case 'suppr-modele': if (confirm('Supprimer ce modèle ?')) { commit({ op: 'del', t: 'Modeles', id: id }); go('seances'); } break;
    case 'detail': go('detail', { id: id, from: route.name }); break;
    case 'suppr-seance': if (confirm('Supprimer définitivement cette séance ?')) { commit({ op: 'del', t: 'Seances', id: id }); go('resume'); } break;
    case 'mode': ui.resume.mode = el.dataset.m; ui.resume.ref = new Date(); render(); break;
    case 'periode': {
      var rr = ui.resume; rr.ref = rr.mode === 'mois' ? addMonths(monthStart(rr.ref), Number(el.dataset.d)) : addDays(rr.ref, 7 * Number(el.dataset.d)); render(); break;
    }
    case 'changer-profil':
      if (Live.s) return;
      localStorage.removeItem(LS.profil); sessionStorage.removeItem(LS.profil);
      ui.profilSel = profil.id; go('profil'); break;
    case 'sync': flush().then(render); render(); break;
    case 'save-code': {
      var c = $('code2').value.trim(); if (!c) return;
      localStorage.setItem(LS.code, c); syncState.error = ''; toast('Code enregistré.'); flush().then(render); break;
    }
  }
});
document.addEventListener('change', function (ev) { if (ev.target.id === 'retenir') ui.retenir = ev.target.checked; });
document.addEventListener('input', function (ev) { if (ev.target.id === 'nomModele' && route.params.id) ui.nomModele[route.params.id] = ev.target.value; });

/* ---------- Démarrage ---------- */
chargerProfil();
if (profil) {
  chargerDB(); route = { name: 'accueil', params: {} };
  if (Live.restaurer()) { route = { name: 'live', params: {} }; setTimeout(function () { toast('Séance en cours reprise.'); }, 300); }
}
render();
if (profil) { flush(); bleConnecter(false); }
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  var avaitSw = !!navigator.serviceWorker.controller, majEnAttente = false;
  navigator.serviceWorker.register('sw.js').catch(function () {});
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!avaitSw) return;                     // première installation : rien à recharger
    if (Live.s) majEnAttente = true; else location.reload();
  });
  setInterval(function () { if (majEnAttente && !Live.s) location.reload(); }, 5000);
}
window.__foulee = { Live: Live, BLE: BLE, versEtapes: versEtapes, DB: function () { return DB; }, flush: flush };
})();
