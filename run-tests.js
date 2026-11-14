/**
 * Deutsch Qadam — avtomatik testlar (QA)
 * GitHub har safar APK yig'ishdan oldin shu faylni ishga tushiradi.
 * Biror test o'tmasa, APK yig'ilmaydi — buzilgan ilova telefoningizga yetib bormaydi.
 *
 * Ishga tushirish:  npm install jsdom@24  &&  node tests/run-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML_PATH = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; failures.push(name); console.log('  ❌ ' + name + '\n     → ' + (e && e.message ? e.message : e)); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert'); }
function eq(a, b, msg) { if (a !== b) throw new Error((msg ? msg + ': ' : '') + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }

/* Ilovani "soxta brauzer" (jsdom) ichida ochamiz */
function boot(localData, setup) {
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://deutsch-qadam.test/',
    beforeParse(window) {
      window.__TEST__ = true;
      window.scrollTo = () => {};
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
      window.HTMLMediaElement.prototype.pause = () => {};
      window.addEventListener('error', (e) => errors.push(e.message || String(e.error)));
      if (localData) window.localStorage.setItem('deutschQadam_v1', JSON.stringify(localData));
      if (setup) setup(window);
    }
  });
  dom.window.__errors = errors;
  return dom.window;
}
function run(w, code) { return w.eval(code); }

console.log('\n🧪 Deutsch Qadam — avtomatik testlar\n');

/* ---------- 1. Ilova ishga tushadi ---------- */
console.log('1) Ishga tushish');
const w = boot();
test('Ilova xatosiz ochiladi', () => eq(w.__errors.length, 0, 'JS xatolar: ' + w.__errors.join(' | ')));
test('Bosh sahifa chiziladi (Musofir, kunlik maqsad, yo\'l)', () => assert(w.document.querySelector('.buddy') && w.document.querySelector('.goalbar') && w.document.querySelector('.path-wrap'), 'bosh sahifa qismlari topilmadi'));
test('Pastda 4 ta bo\'lim, tepada til tanlash', () => { eq(w.document.querySelectorAll('#tabbar .tbi').length, 4); assert(w.document.querySelector('#tbx [data-act="courseSheet"]'), 'til tugmasi yo\'q'); });
test('"made by shoxrux" yozuvi bor', () => assert(/made by/.test(w.document.querySelector('.made').textContent) && /shoxrux/.test(w.document.querySelector('.made').textContent)));

/* ---------- 2. Ma'lumotlar butunligi ---------- */
console.log('\n2) Ma\'lumotlar butunligi');
test('Lug\'atda kamida 1000 ta so\'z bor', () => assert(run(w, 'ALLW.length') >= 1000, 'so\'zlar: ' + run(w, 'ALLW.length')));
test('Har bir so\'zda nemischa, o\'qilishi va tarjima bor', () => {
  const bad = run(w, 'ALLW.filter(function(x){ return !x.de || !x.tr || !x.uz; }).map(function(x){ return x.id; })');
  eq(bad.length, 0, 'to\'liq bo\'lmagan so\'zlar: ' + bad.join(','));
});
test('Nemischa so\'zlar takrorlanmaydi', () => {
  const dup = run(w, '(function(){ var s={}, d=[]; ALLW.forEach(function(x){ if(s[x.de]) d.push(x.de); s[x.de]=1; }); return d; })()');
  eq(dup.length, 0, 'takroriy: ' + dup.join(', '));
});
test('So\'z ID lari noyob', () => eq(run(w, 'Object.keys(WMAP).length'), run(w, 'ALLW.length')));
test('Har bir mavzuda kamida 8 ta ibora bor (mini test uchun)', () => {
  const small = run(w, 'LESSONS.filter(function(l){ return l.items.length<8; }).map(function(l){ return l.id; })');
  eq(small.length, 0, small.join(','));
});
test('Har bir dialogda kamida 4 ta replika bor', () => eq(run(w, 'DIALOGS.filter(function(d){ return d.lines.length<4; }).length'), 0));

/* ---------- 3. Sonlar ---------- */
console.log('\n3) Sonlarni nemischaga o\'girish');
const NUMS = { 0: 'null', 1: 'eins', 7: 'sieben', 16: 'sechzehn', 17: 'siebzehn', 21: 'einundzwanzig', 30: 'dreißig',
  99: 'neunundneunzig', 100: 'einhundert', 101: 'einhunderteins', 121: 'einhunderteinundzwanzig', 1000: 'eintausend',
  1001: 'eintausendeins', 2026: 'zweitausendsechsundzwanzig', 21000: 'einundzwanzigtausend', 999999: 'neunhundertneunundneunzigtausendneunhundertneunundneunzig',
  1000000: 'eine Million' };
Object.keys(NUMS).forEach((n) => test(n + ' → ' + NUMS[n], () => eq(run(w, 'numDe(' + n + ')'), NUMS[n])));

/* ---------- 4. Testlar (savollar) to'g'ri tuziladi ---------- */
console.log('\n4) Savollar to\'g\'ri tuziladi');
function checkQs(qs, label) {
  assert(qs.length > 0, label + ': savol yo\'q');
  qs.forEach((q, i) => {
    assert(q.options.indexOf(q.answer) > -1, label + ' #' + i + ': to\'g\'ri javob variantlar ichida yo\'q');
    eq(new Set(q.options).size, q.options.length, label + ' #' + i + ': variantlar takrorlangan');
    assert(q.options.length >= 2, label + ' #' + i + ': variant kam');
  });
}
test('Barcha bo\'lim va rejimlarda lug\'at testi', () => {
  run(w, "VOCAB.forEach(function(c){ state.seen.c[c.id]=1; })"); // hamma bo'limlar o'rganilgan deb olamiz
  const cats = run(w, 'VOCAB.map(function(c){ return c.id; })').concat(['all']);
  ['de2uz', 'uz2de', 'audio', 'art'].forEach((m) => cats.forEach((c) => {
    for (let k = 0; k < 3; k++) checkQs(run(w, "TCFG.mode='" + m + "';TCFG.cat='" + c + "';TCFG.n=10;buildVocabQuiz()"), m + '/' + c);
  }));
});
test('Har bir mavzu mini testi', () => run(w, 'LESSONS.map(function(l){ return l.id; })').forEach((id) => checkQs(run(w, "buildLessonQuiz('" + id + "')"), id)));
test('Talaffuz testi', () => { for (let k = 0; k < 5; k++) checkQs(run(w, 'buildSoundQuiz(10)'), 'sound'); });
test('Sonlar testi', () => { for (let k = 0; k < 10; k++) checkQs(run(w, 'buildNumberQuiz(10)'), 'numbers'); });
test('Dialog testlari', () => { checkQs(run(w, "buildDialogQuiz(['d2','d4'],8)"), 'dlg1'); checkQs(run(w, "buildDialogQuiz(['d1','d3','d5'],8)"), 'dlg2'); });
test('Bo\'lim imtihonlari va yakuniy imtihon to\'liq', () => {
  run(w, "NODES.filter(function(n){ return n.spec; }).map(function(n){ return n.id; })").forEach((id) => {
    for (let k = 0; k < 3; k++) {
      const qs = run(w, "(function(){ var n=nodeById('" + id + "'); return buildExam(n.spec, n.n); })()");
      checkQs(qs, id);
      eq(qs.length, run(w, "nodeById('" + id + "').n"), id + ' savollar soni');
    }
  });
});
test('Daraja aniqlash testi 15 savol', () => { const qs = run(w, 'buildPlacement()'); checkQs(qs, 'placement'); eq(qs.length, 15); });

/* ---------- 5. Progress saqlanadi ---------- */
console.log('\n5) Progressni saqlash');
test('O\'rganilgan so\'zlar ixcham saqlanib, qayta o\'qiladi', () => {
  run(w, 'ALLW.forEach(function(x,i){ if(i%3===0) state.learned[x.id]=1; }); saveState();');
  const before = run(w, 'learnedCount()');
  const back = run(w, 'Object.keys(unpackLearned(packLearned())).length');
  eq(back, before);
});
test('Saqlangan ma\'lumot Google limitidan (8800 belgi) kichik', () => {
  run(w, 'ALLW.forEach(function(x){ state.learned[x.id]=1; }); for(var i=0;i<200;i++){ state.wrong[ALLW[i].id]=3; } for(var d=0; d<100; d++){ var dt=new Date(); dt.setDate(dt.getDate()-d); state.days[dayKey(dt)]=50; } saveState();');
  const len = run(w, 'localStorage.getItem(LS_KEY).length');
  assert(len < 8800, 'hajm: ' + len);
});
test('Eski formatdagi progress yo\'qolmaydi', () => {
  const w2 = boot({ xp: 120, name: 'Ali', learned: { oila0: 1, feyl3: 1 }, ts: 1 });
  eq(w2.eval('state.xp'), 120); eq(w2.eval('state.name'), 'Ali'); eq(w2.eval('learnedCount()'), 2);
});

/* ---------- 6. Daraja va XP ---------- */
console.log('\n6) XP, daraja va kunlik maqsad');
test('Daraja XP oshgan sari kamaymaydi', () => {
  let prev = 0; for (let x = 0; x < 20000; x += 37) { const L = run(w, 'levelOf(' + x + ')'); assert(L >= prev, 'xp=' + x); prev = L; }
});
test('Daraja chegaralari to\'g\'ri', () => { eq(run(w, 'levelOf(0)'), 1); eq(run(w, 'levelOf(39)'), 1); eq(run(w, 'levelOf(40)'), 2); eq(run(w, 'levelOf(120)'), 3); });
test('XP qo\'shilganda bugungi kun va seriya yangilanadi', () => {
  const w3 = boot({ name: 'T', onboarded: true, ts: 1 });
  w3.eval('gainXp(30)');
  eq(w3.eval('state.xp'), 30); eq(w3.eval('state.days[dayKey()]'), 30); eq(w3.eval('state.streak'), 1);
  assert(w3.eval("!!state.ach.first"), '"Birinchi qadam" yutug\'i ochilmadi');
});

/* ---------- 7. O'rganish yo'li ---------- */
console.log('\n7) O\'rganish yo\'li');
test('Boshida faqat birinchi bosqich ochiq', () => {
  const w4 = boot({ name: 'T', onboarded: true, ts: 1 });
  eq(w4.eval('currentNode().id'), 'abc');
  assert(w4.eval("nodeUnlocked('abc')"), 'abc yopiq'); assert(!w4.eval("nodeUnlocked('salom')"), 'salom ochiq bo\'lmasligi kerak');
});
test('Testdan o\'tilganda keyingi bosqich ochiladi', () => {
  const w5 = boot({ name: 'T', onboarded: true, ts: 1 });
  w5.eval("startNodeTest('abc'); QZ.qs.forEach(function(q){ var i=q.options.indexOf(q.answer); quizPick({dataset:{p:String(i)}}); quizNext(); });");
  assert(w5.eval("nodeIsDone('abc')"), 'abc tugamadi'); assert(w5.eval("nodeUnlocked('salom')"), 'salom ochilmadi');
});
test('Past natijada bosqich ochilmaydi', () => {
  const w6 = boot({ name: 'T', onboarded: true, ts: 1 });
  w6.eval("startNodeTest('abc'); QZ.qs.forEach(function(q){ var i=(q.options.indexOf(q.answer)+1)%q.options.length; quizPick({dataset:{p:String(i)}}); quizNext(); });");
  assert(!w6.eval("nodeIsDone('abc')"), 'abc noto\'g\'ri tugatildi'); assert(w6.eval('weakWords().length') >= 0);
});
test('Yakuniy imtihondan o\'tilganda sertifikat ochiladi', () => {
  const w7 = boot({ name: 'Shoxrux', onboarded: true, ts: 1 });
  w7.eval("NODES.forEach(function(n){ if(n.id!=='final') state.path[n.id]=90; }); startNodeTest('final'); QZ.qs.forEach(function(q){ var i=q.options.indexOf(q.answer); quizPick({dataset:{p:String(i)}}); quizNext(); }); go('cert');");
  assert(w7.eval("nodeIsDone('final')"), 'final tugamadi');
  assert(/Shoxrux/.test(w7.document.querySelector('.cert').textContent), 'sertifikatda ism yo\'q');
});

/* ---------- 8. Barcha sahifalar ochiladi ---------- */
console.log('\n8) Barcha sahifalar');
const w8 = boot({ name: 'T', onboarded: true, ts: 1 });
w8.eval("bootStep('splash'); bootStep('data');");
const VIEWS = [['home'], ['stats'], ['sounds'], ['lessons'], ['lesson', 'salom'], ['dialogs'], ['dialog', 'd1'], ['numbers', 'learn'], ['numbers', 'conv'], ['numbers', 'practice'],
  ['vocab'], ['tests'], ['games'], ['game', 'memory'], ['game', 'scramble'], ['game', 'sentence'], ['game', 'dictation'], ['game', 'speed'], ['grammar'], ['cert']];
VIEWS.forEach((v) => test('Sahifa: ' + v.join('/'), () => {
  const before = w8.__errors.length;
  w8.eval("go('" + v[0] + "'," + (v[1] ? "'" + v[1] + "'" : 'null') + ')');
  eq(w8.__errors.length, before, 'xato: ' + w8.__errors.slice(before).join(' | '));
  assert(w8.document.getElementById('main').innerHTML.length > 100, 'sahifa bo\'sh');
}));
test('Sozlamalar oynasi ochiladi', () => { w8.eval('openSettings()'); assert(w8.document.getElementById('modal').classList.contains('show')); w8.eval('closeModal()'); });
test('Tungi rejim almashadi', () => { w8.eval("state.settings.theme='light'; ACT.toggleTheme()"); eq(w8.document.documentElement.getAttribute('data-theme'), 'dark'); });
test('"Orqaga" tugmasi oldingi sahifaga qaytaradi', () => {
  w8.eval("go('home'); HIST=[]; go('vocab'); go('tests');");
  w8.eval('window.__back()'); eq(w8.eval('current.view'), 'vocab');
  w8.eval('window.__back()'); eq(w8.eval('current.view'), 'home');
  eq(w8.eval('window.__back()'), false, 'bosh sahifada ilovadan chiqish kerak');
});

/* ---------- 8b. Talaffuz baholash ---------- */
console.log('\n8b) Talaffuzni baholash');
test('To\'g\'ri aytilgan ibora 100 ball', () => eq(w.eval('scorePron("Ich heiße Shoxrux.", ["ich heiße Shoxrux"]).score'), 100));
test('Raqam bilan tanilgan son ham to\'g\'ri hisoblanadi', () => eq(w.eval('scorePron("Ich bin fünfundzwanzig Jahre alt.", ["Ich bin 25 Jahre alt"]).score'), 100));
test('Umuman boshqa gap past ball oladi', () => assert(w.eval('scorePron("Entschuldigung, wo ist der Bahnhof?", ["und so weiter"]).score') < 40));
test('Talaffuz mashqi sahifasi ochiladi', () => { const b = w8.__errors.length; w8.eval("go('game','pron')"); eq(w8.__errors.length, b); });

/* ---------- 9. Onboarding ---------- */
console.log('\n9) Onboarding');
test('Yangi foydalanuvchiga onboarding ko\'rsatiladi va saqlanadi', () => {
  const w9 = boot();
  w9.eval("bootStep('splash'); bootStep('data');");
  assert(w9.document.getElementById('onb').classList.contains('show'), 'onboarding chiqmadi');
  w9.eval("obNext(); document.getElementById('obName').value='lola'; obNext(); OB.reason='ish'; obNext(); OB.goal=100; obNext(); obNext(); obFinish();");
  eq(w9.eval('state.name'), 'Lola'); eq(w9.eval('state.goal'), 100); eq(w9.eval('state.onboarded'), true);
});


/* ---------- 10. Faqat o'rganilgan materialdan test va o'yin ---------- */
console.log('\n10) Faqat o\'rganilgan materialdan test va o\'yin');
const w10 = boot({ name: 'Ali', onboarded: true, ts: 1, goal: 50 });
test('Yangi foydalanuvchida o\'rganilgan so\'z yo\'q', () => eq(run(w10, 'studiedWords().length'), 0));
test('Hech narsa o\'rganilmaganda lug\'at testi boshlanmaydi', () => {
  run(w10, "go('tests'); TCFG.mode='de2uz'; TCFG.cat='all'; TCFG.n=10;");
  eq(run(w10, 'buildVocabQuiz().length'), 0);
  run(w10, 'ACT.tStart()'); eq(run(w10, 'current.view'), 'tests');
});
test('O\'yin qulflangan va tushuntirish chiqadi', () => {
  ['memory', 'scramble', 'sentence', 'dictation', 'speed'].forEach((g) => {
    run(w10, "G=null; go('game','" + g + "')");
    assert(run(w10, '!!(G && G.locked)'), g + ' qulflanmadi');
    assert(/Avval o'rganib oling/.test(w10.document.getElementById('main').textContent), g + ': tushuntirish yo\'q');
  });
  eq(w10.__errors.length, 0, 'JS xatolar: ' + w10.__errors.join(' | '));
});
test('Lug\'atda bo\'lim ochilsa — o\'sha so\'zlar o\'rganilgan hisoblanadi', () => {
  run(w10, "go('vocab','oila')");
  const n = run(w10, 'studiedWords().length'), tot = run(w10, "ALLW.filter(function(w){ return w.cat==='oila'; }).length");
  eq(n, tot);
  assert(run(w10, "studiedWords().every(function(w){ return w.cat==='oila'; })"), 'boshqa bo\'lim so\'zi aralashdi');
});
test('Test faqat o\'rganilgan so\'zlardan tuziladi (barcha rejimlar)', () => {
  ['de2uz', 'uz2de', 'audio'].forEach((m) => {
    for (let k = 0; k < 5; k++) {
      const qs = run(w10, "TCFG.mode='" + m + "';TCFG.cat='all';TCFG.n=20; buildVocabQuiz().map(function(q){ return WMAP[q.wid].cat; })");
      assert(qs.length > 0, 'test bo\'sh: ' + m);
      assert(qs.every((c) => c === 'oila'), m + ': o\'rganilmagan so\'z tushdi');
    }
  });
});
test('Testlar sahifasida o\'rganilmagan bo\'limlar qulflangan', () => {
  run(w10, "go('tests')");
  const d = w10.document;
  assert(d.querySelector('#tCat option[value="oila"]:not([disabled])'), 'oila ochiq bo\'lishi kerak');
  assert(d.querySelector('#tCat option[value="ovqat"][disabled]'), 'ovqat qulflangan bo\'lishi kerak');
  assert(d.querySelector('[data-act="lockedLesson"][data-p="salom"]'), 'salom darsi qulflangan bo\'lishi kerak');
  assert(d.querySelector('[data-act="lockedGram"][data-p="g_perf1"]'), 'grammatika qulflangan bo\'lishi kerak');
});
test('Dars va grammatika o\'qilgach testi ochiladi', () => {
  run(w10, "go('lesson','salom'); go('gram','g_perf1'); go('tests')");
  const d = w10.document;
  assert(d.querySelector('[data-act="lessonQuiz"][data-p="salom"]'), 'salom testi ochilmadi');
  assert(d.querySelector('[data-act="gramTest"][data-p="g_perf1"]'), 'grammatika testi ochilmadi');
  assert(d.querySelector('[data-act="lockedLesson"][data-p="kafe"]'), 'kafe hali qulflangan bo\'lishi kerak');
});
test('O\'yinlar endi o\'rganilgan so\'zlardan', () => {
  run(w10, "G=null; go('game','memory')");
  assert(!run(w10, 'G.locked'), 'memory ochilmadi');
  assert(run(w10, "G.cards.every(function(c){ return WMAP[c.wid].cat==='oila'; })"), 'memory: begona so\'z');
  run(w10, "G=null; go('game','speed'); spStart(); clearInterval(window.__spT)");
  for (let k = 0; k < 20; k++) { run(w10, 'spNewQ()'); eq(run(w10, 'G.q.w.cat'), 'oila'); }
  run(w10, "G.left=0; G.over=true;");
  run(w10, "G=null; go('game','sentence')");
  assert(!run(w10, 'G.locked'), 'gap tuzish ochilmadi');
  const salom = run(w10, "LESSONS.filter(function(l){ return l.id==='salom'; })[0].items.map(function(i){ return i.de; })");
  assert(run(w10, 'G.list.map(function(p){ return p.de; })').every((x) => salom.indexOf(x) > -1), 'gap tuzish: o\'qilmagan darsdan gap');
  eq(w10.__errors.length, 0, 'JS xatolar: ' + w10.__errors.join(' | '));
});
test('Yo\'lda o\'tilgan qadamning so\'zlari ham hisoblanadi', () => {
  run(w10, "state.path['v_a2feyl']=80");
  assert(run(w10, "studiedWords().some(function(w){ return w.cat==='a2feyl'; })"), 'a2feyl hisoblanmadi');
});
test('«Ko\'rilgan» belgilari saqlanadi va qayta ochilganda tiklanadi', () => {
  run(w10, 'saveState()');
  const saved = JSON.parse(w10.localStorage.getItem('deutschQadam_v1'));
  assert(saved.seen && saved.seen.c.oila && saved.seen.l.salom && saved.seen.g.g_perf1, 'saqlanmadi: ' + JSON.stringify(saved.seen));
  const w10b = boot(saved);
  assert(run(w10b, "studiedCatMap().oila===1 && lessonStudied('salom') && gramStudied('g_perf1')"), 'tiklanmadi');
});

/* ---------- 11. Google bilan kirish va bulutli zaxira ---------- */
console.log('\n11) Google bilan kirish va bulutli zaxira');
function fakeCloud() {
  const db = { users: {}, prog: {} }, log = [];
  function handle(req) {
    log.push(req.action);
    if (req.action === 'login') {
      const m = /^tok:(.+)$/.exec(req.idToken || ''); if (!m) return { ok: false, err: 'token_invalid' };
      const uid = m[1]; if (!db.users[uid]) db.users[uid] = { secret: 's-' + uid, email: uid + '@gmail.com' };
      const p = db.prog[uid];
      return { ok: true, uid, secret: db.users[uid].secret, name: 'User ' + uid, email: db.users[uid].email, progress: p ? p.json : null, ts: p ? p.ts : 0 };
    }
    const u = db.users[req.uid]; if (!u || u.secret !== req.secret) return { ok: false, err: 'auth' };
    if (req.action === 'save') { const o = db.prog[req.uid]; if (o && o.ts > req.ts) return { ok: true, stale: true, ts: o.ts }; db.prog[req.uid] = { json: req.progress, ts: req.ts, sum: req.sum }; return { ok: true, ts: req.ts }; }
    if (req.action === 'load') { const p = db.prog[req.uid]; return { ok: true, progress: p ? p.json : null, ts: p ? p.ts : 0 }; }
    return { ok: false, err: 'unknown' };
  }
  return { db, log, handle };
}
function nativeBoot(local, cloud, who, opts) {
  opts = opts || {};
  const calls = [];
  const win = boot(local, (win) => {
    if (!opts.noConfig) win.DQ_CONFIG = { cloudUrl: 'https://script.google.com/macros/s/TEST/exec', googleClientId: '123-abc.apps.googleusercontent.com' };
    win.AndroidTTS = {
      status: () => 1, speak: () => {}, stop: () => {}, installVoice: () => {}, openSettings: () => {}, sttAvailable: () => 1, listen: () => {}, stopListening: () => {}, openAppSettings: () => {},
      notifSync: () => {}, notifPermission: () => 1, notifRequest: () => {}, notifTest: () => {}, openNotifSettings: () => {},
      googleSignIn: (cid) => { calls.push(['signin', cid]); win.__gAuth(JSON.stringify(who.v ? { ok: true, idToken: 'tok:' + who.v, email: who.v + '@gmail.com', name: 'User ' + who.v } : { ok: false, err: 'cancelled' })); },
      googleSignOut: () => calls.push(['signout']),
      chatSetup: (u, uid, sec) => calls.push(['chatSetup', u, uid]), chatSeen: () => {},
      cloudPost: (url, body, id) => { calls.push(['post', JSON.parse(body).action]); const r = cloud.handle(JSON.parse(body)); win.__cloudCb(id, true, JSON.stringify(r)); }
    };
  });
  win.__calls = calls;
  return win;
}
const cloud = fakeCloud(), who = { v: 'ali' };
const c1 = nativeBoot({ name: 'Ali', onboarded: true, ts: 5, xp: 120, goal: 50, path: { abc: 90 } }, cloud, who);
test('Sozlamalarda «Google bilan kirish» tugmasi bor', () => {
  run(c1, 'openSettings()');
  assert(c1.document.querySelector('#cloudBox [data-act="gLogin"]'), 'tugma yo\'q');
});
test('Bosh sahifada «progressni yo\'qotmang» kartasi chiqadi', () => {
  run(c1, "closeModal(); go('home')");
  assert(c1.document.querySelector('.cloud-card'), 'karta yo\'q');
});
test('Kirgandan keyin progress bulutga yuboriladi', () => {
  run(c1, "ACT.gLogin({dataset:{}})");
  eq(run(c1, 'state.cloud && state.cloud.uid'), 'ali');
  const p = cloud.db.prog.ali; assert(p, 'bulutga saqlanmadi');
  const o = JSON.parse(p.json); eq(o.xp, 120); assert(!o.cloud, 'kalit bulutga ketib qoldi');
  eq(p.sum.xp, 120); eq(p.sum.name, 'Ali');
  run(c1, "go('home')"); assert(!c1.document.querySelector('.cloud-card'), 'kirgandan keyin karta yo\'qolishi kerak');
  run(c1, 'openSettings()'); assert(/ali@gmail\.com/.test(c1.document.getElementById('cloudBox').textContent), 'email ko\'rinmadi'); run(c1, 'closeModal()');
});
test('Yangi XP bulutga ham yetadi', () => {
  run(c1, 'gainXp(30); cloudSave()');
  eq(JSON.parse(cloud.db.prog.ali.json).xp, 150);
});
test('Yangi telefonda kirganda progress tiklanadi (onboardingsiz)', () => {
  const c2 = nativeBoot(null, cloud, who);
  run(c2, "bootStep('splash'); bootStep('data');");
  assert(c2.document.getElementById('onb').classList.contains('show'), 'onboarding chiqmadi');
  assert(c2.document.querySelector('#onb [data-act="gLogin"]'), 'onboardingda Google tugmasi yo\'q');
  run(c2, "ACT.gLogin({dataset:{p:'ob'}})");
  eq(run(c2, 'state.xp'), 150); eq(run(c2, 'state.name'), 'Ali'); eq(run(c2, 'state.onboarded'), true);
  assert(!c2.document.getElementById('onb').classList.contains('show'), 'onboarding yopilmadi');
  eq(run(c2, "current.view"), 'home');
  eq(c2.__errors.length, 0, 'JS xatolar: ' + c2.__errors.join(' | '));
});
test('Ikkala joyda progress bo\'lsa — tanlash oynasi chiqadi', () => {
  const c3 = nativeBoot({ name: 'Ali', onboarded: true, ts: 9, xp: 40, goal: 50, path: { abc: 90 } }, cloud, who);
  run(c3, "ACT.gLogin({dataset:{}})");
  assert(c3.document.querySelector('#modal.show [data-act="cloudPick"]'), 'tanlash oynasi chiqmadi');
  run(c3, "ACT.cloudPick({dataset:{p:'srv'}})");
  eq(run(c3, 'state.xp'), 150);
});
test('Shu telefondagini tanlasa — bulut yangilanadi', () => {
  const c4 = nativeBoot({ name: 'Ali', onboarded: true, ts: Date.now(), xp: 999, goal: 50, path: { abc: 90 } }, cloud, who);
  run(c4, "ACT.gLogin({dataset:{}}); ACT.cloudPick({dataset:{p:'loc'}})");
  eq(JSON.parse(cloud.db.prog.ali.json).xp, 999);
});
test('Hisobdan chiqish', () => {
  run(c1, 'saveState()');
  run(c1, 'ACT.cloudLogoutYes()');
  eq(run(c1, 'state.cloud'), null);
  assert(c1.__calls.some((c) => c[0] === 'signout'), 'googleSignOut chaqirilmadi');
  eq(run(c1, 'state.xp'), 150, 'progress telefonda qolishi kerak');
});
test('Kalit noto\'g\'ri bo\'lsa — hisobdan chiqariladi', () => {
  const c5 = nativeBoot({ name: 'X', onboarded: true, ts: 1, xp: 10, cloud: { uid: 'ali', secret: 'yolgon' } }, cloud, who);
  run(c5, 'cloudSave()');
  eq(run(c5, 'state.cloud'), null);
});
test('Bekor qilinsa hech narsa buzilmaydi', () => {
  const c6 = nativeBoot({ name: 'Y', onboarded: true, ts: 1, xp: 10 }, cloud, { v: null });
  run(c6, "ACT.gLogin({dataset:{}})");
  eq(run(c6, 'state.cloud'), null); eq(c6.__errors.length, 0);
});
test('config.js to\'ldirilmagan bo\'lsa — Google tugmasi ko\'rinmaydi', () => {
  const c7 = nativeBoot({ name: 'Z', onboarded: true, ts: 1, xp: 100 }, cloud, who, { noConfig: true });
  eq(run(c7, 'cloudCan()'), false);
  run(c7, "go('home')"); assert(!c7.document.querySelector('.cloud-card'), 'karta chiqmasligi kerak');
});


/* ---------- 12. Musofir: hikoya, ism va mimikalar ---------- */
console.log('\n12) Musofir: hikoya, ism va mimikalar');
test('Ilk ochilishda Musofir hikoyasi chiqadi va oxirida ism so\'raladi', () => {
  const w12 = boot();
  w12.eval("bootStep('splash'); bootStep('data');");
  const d = w12.document;
  assert(d.querySelector('#onb .st-card'), 'hikoya chiqmadi');
  const n = run(w12, 'STORY.length');
  for (let k = 0; k < n - 1; k++) { w12.eval('ACT.obStory()'); }
  assert(/Shartlarimiz/.test(d.getElementById('onb').textContent), 'oxirgi sahifa emas');
  w12.eval('ACT.obStory()');
  assert(d.getElementById('obName'), 'ism so\'ralmadi');
  w12.eval('obBack()'); assert(d.querySelector('#onb .st-card'), 'orqaga hikoyaga qaytmadi');
  eq(w12.__errors.length, 0, 'JS xatolar: ' + w12.__errors.join(' | '));
});
test('Hikoyani o\'tkazib yuborish mumkin', () => {
  const w12 = boot(); w12.eval("bootStep('splash'); bootStep('data'); ACT.obStorySkip()");
  assert(w12.document.getElementById('obName'), 'ism sahifasi chiqmadi');
});
test('Darslardagi ism foydalanuvchining o\'z ismi bilan almashadi', () => {
  const w12 = boot();
  w12.eval("bootStep('splash'); bootStep('data'); ACT.obStorySkip(); document.getElementById('obName').value='lola'; obNext(); obNext(); obNext(); obNext(); obFinish();");
  const all = run(w12, 'JSON.stringify([LESSONS, DIALOGS, GRAMMAR, GRAM])');
  assert(all.indexOf('Shoxrux') < 0 && all.indexOf('shoxrux') < 0, 'Shoxrux qolib ketdi');
  assert(all.indexOf('Ich heiße Lola.') > -1 && all.indexOf('Mening ismim Lola.') > -1, 'Lola qo\'yilmadi');
  assert(all.indexOf('Hallo Anna! Ich heiße Lola.') > -1, 'dialogda ism almashmadi');
  w12.eval("state.name='Aziz'; saveState();");
  assert(run(w12, 'JSON.stringify(LESSONS)').indexOf('Ich heiße Aziz.') > -1, 'ism o\'zgarganda yangilanmadi');
});
test('Saqlangan ism qayta ochilganda darslarda turadi', () => {
  const w12 = boot({ name: 'Bekzod', onboarded: true, ts: 1 });
  assert(run(w12, 'JSON.stringify(LESSONS)').indexOf('Ich heiße Bekzod.') > -1, 'ism qo\'llanmadi');
});
test('Musofirning 16 ta mimikasi to\'g\'ri chiziladi', () => {
  const moods = ['idle','wave','happy','celebrate','surprised','think','confused','sad','determined','love','sleep','angry','smug','joke','flirt','compliment'];
  const w12 = boot({ name: 'X', onboarded: true, ts: 1 });
  moods.forEach((m) => {
    const html = run(w12, "BZ.html('" + m + "', 80)");
    const box = w12.document.createElement('div'); box.innerHTML = html; w12.document.body.appendChild(box);
    const mouths = Array.from(box.querySelectorAll('.mf-m')).filter((e) => w12.getComputedStyle(e).display !== 'none');
    eq(mouths.length, 1, m + ': og\'iz soni');
    box.remove();
  });
  eq(w12.__errors.length, 0);
});

/* ---------- Natija ---------- */
/* ---------- 13. Bir nechta til: nemis, rus, ingliz ---------- */
console.log('\n13) Tillar: nemis, rus, ingliz');
const w13 = boot({ name: 'Aziz', onboarded: true, ts: 1, xp: 40, goal: 50, path: { abc: 90, salom: 80 } });
w13.eval("bootStep('splash'); bootStep('data');");
const PAGES = [['home'], ['practice'], ['profile'], ['social'], ['stats'], ['sounds'], ['lessons'], ['lesson', 'salom'], ['lesson', 'tanish'], ['dialogs'], ['dialog', 'd1'],
  ['numbers', 'learn'], ['numbers', 'conv'], ['numbers', 'practice'], ['vocab'], ['flash'], ['tests'], ['games'], ['game', 'memory'], ['game', 'scramble'], ['game', 'sentence'],
  ['game', 'dictation'], ['game', 'speed'], ['grammar'], ['cert']];
['ru', 'en'].forEach((c) => {
  test(c.toUpperCase() + ': kursga o\'tish va barcha sahifalar xatosiz', () => {
    w13.eval("setCourse('" + c + "')");
    eq(w13.eval('COURSE'), c);
    PAGES.forEach((v) => {
      const b = w13.__errors.length;
      w13.eval("go('" + v[0] + "'," + (v[1] ? "'" + v[1] + "'" : 'null') + ')');
      eq(w13.__errors.length, b, c + ' ' + v.join('/') + ': ' + w13.__errors.slice(b).join(' | '));
      assert(w13.document.getElementById('main').innerHTML.length > 100, c + ' ' + v.join('/') + ' bo\'sh');
    });
  });
});
test('Rus tili: so\'zlar, darslar, sonlar ruscha', () => {
  w13.eval("setCourse('ru')");
  assert(w13.eval('ALLW.length') > 900, 'so\'z kam');
  eq(w13.eval('numDe(21)'), 'двадцать один'); eq(w13.eval('numDe(2026)'), 'две тысячи двадцать шесть');
  eq(w13.eval('curTts()'), 'ru-RU');
  assert(/Азиз/.test(w13.eval("DIALOGS[0].lines[1].de")), 'ism kirillga o\'girilmadi: ' + w13.eval("DIALOGS[0].lines[1].de"));
  w13.eval("go('vocab')"); assert(!/der — erkak/.test(w13.document.getElementById('main').innerHTML), 'nemischa artikl izohi qoldi');
  assert(!/[Nn]emis/.test(w13.document.getElementById('main').textContent), '«nemis» so\'zi qoldi');
});
test('Ingliz tili: so\'zlar, darslar, sonlar inglizcha', () => {
  w13.eval("setCourse('en')");
  assert(w13.eval('ALLW.length') > 650, 'so\'z kam');
  eq(w13.eval('numDe(21)'), 'twenty-one'); eq(w13.eval('numDe(101)'), 'one hundred and one');
  eq(w13.eval('curTts()'), 'en-US');
  eq(w13.eval("LESSONS[1].items[0].de"), 'My name is Aziz.');
  w13.eval("go('tests')"); assert(!w13.document.querySelector('[data-act="tMode"][data-p="art"]'), 'der/die/das rejimi inglizchada bo\'lmasligi kerak');
  eq(w13.eval('NODES.filter(function(n){ return n.type===\'final\'; }).length'), 1);
});
test('Har bir tilning progressi alohida saqlanadi', () => {
  w13.eval("setCourse('en'); state.path.abc=95; state.learned['oila0']=1; saveState();");
  w13.eval("setCourse('de')");
  eq(w13.eval('state.path.salom'), 80, 'nemischa progress yo\'qoldi');
  eq(w13.eval('state.path.abc'), 90);
  w13.eval("setCourse('en')"); eq(w13.eval('state.path.abc'), 95); eq(w13.eval("state.learned['oila0']"), 1); eq(w13.eval('state.path.salom'), undefined);
  const saved = JSON.parse(w13.localStorage.getItem('deutschQadam_v1'));
  eq(saved.course, 'en'); eq(saved.courses.de.path.salom, 80);
});
test('Qayta ochilganda oxirgi til tiklanadi', () => {
  const saved = JSON.parse(w13.localStorage.getItem('deutschQadam_v1'));
  const w13b = boot(saved);
  eq(w13b.eval('COURSE'), 'en'); eq(w13b.eval('state.path.abc'), 95); eq(w13b.eval("LESSONS[0].items[0].de"), 'Hello!');
  eq(w13b.__errors.length, 0, w13b.__errors.join(' | '));
});
test('XP va seriya barcha tillar uchun umumiy', () => {
  const x = w13.eval('state.xp'); w13.eval("setCourse('ru')"); eq(w13.eval('state.xp'), x);
});
test('Imtihon faqat daraja oxirida: A1 da 1 ta imtihon, oldin qulflangan', () => {
  w13.eval("setCourse('de')");
  eq(w13.eval("NODES.filter(function(n){ return n.unit.lv==='A1' && (n.type==='exam'||n.type==='final'); }).length"), 1);
  eq(w13.eval("NODES.filter(function(n){ return n.type==='exam'; }).length"), 0, 'oraliq imtihonlar qolib ketgan');
  eq(w13.eval("nodeUnlocked('final')"), false);
  w13.eval("openNode('final')");
  assert(/barcha darslari tugagach/.test(w13.document.getElementById('modalBody').textContent), 'qulf izohi yo\'q');
  w13.eval('closeModal()');
});
test('Til tanlash oynasi va til almashtirish', () => {
  w13.eval("ACT.courseSheet()");
  eq(w13.document.querySelectorAll('#modalBody [data-act="pickCourse"]').length, 3);
  w13.eval("ACT.pickCourse({dataset:{p:'ru'}})");
  eq(w13.eval('COURSE'), 'ru'); eq(w13.eval('current.view'), 'home');
  assert(/RU/.test(w13.document.getElementById('tbx').textContent), 'tepada RU yo\'q');
});
test('Onboardingda til tanlanadi', () => {
  const w = boot();
  w.eval("bootStep('splash'); bootStep('data');");
  w.eval("ACT.obStorySkip(); document.getElementById('obName').value='lola'; obNext();");
  assert(w.document.querySelector('#onb [data-act="obCourse"][data-p="en"]'), 'til tanlash chiqmadi');
  w.eval("ACT.obCourse({dataset:{p:'en'}}); obNext();");
  eq(w.eval('COURSE'), 'en');
  assert(/[Ii]ngliz/.test(w.document.getElementById('onb').textContent), 'keyingi qadam inglizchaga moslashmadi');
  w.eval("OB.reason='ish'; obNext(); OB.goal=30; obNext(); obNext(); obFinish();");
  eq(w.eval('state.course'), 'en'); eq(w.eval('state.name'), 'Lola');
  eq(w.__errors.length, 0, w.__errors.join(' | '));
});

/* ---------- 14. Profil, do'stlar va chat ---------- */
console.log('\n14) Profil, do\'stlar va chat');
function socServer(){
  const me = { uid: 'ali', name: 'Ali', avatar: 'mf:wave', code: 'K7M2QX', week: 40, xp: 150, streak: 2 };
  const bek = { uid: 'bek', name: 'Bek', avatar: 'mf:happy', week: 90, xp: 300, streak: 5, course: 'en' };
  const st = { friends: [bek], incoming: [{ uid: 'sar', name: 'Sardor', avatar: 'mf:joke' }], msgs: [{ id: 'm1', chat: 'd:ali|bek', from: 'bek', text: 'Hello!', ts: Date.now() - 5000 }], log: [] };
  return { st, handle(req) {
    st.log.push(req);
    if (req.action === 'soc') return { ok: true, week: '2026-11-09', me, friends: st.friends, incoming: st.incoming, outgoing: [], blocked: [], groups: st.groups || [], others: [],
      inbox: { 'd:ali|bek': { unread: 1, last: { from: 'bek', text: 'Hello!', ts: st.msgs[0].ts } } } };
    if (req.action === 'friend_add') return req.code === 'BEK123' ? { ok: true, pending: true, name: 'Bek' } : { ok: false, err: 'no_user' };
    if (req.action === 'friend_respond') { st.incoming = []; if (req.accept) st.friends.push({ uid: 'sar', name: 'Sardor', avatar: 'mf:joke', week: 0 }); return { ok: true }; }
    if (req.action === 'msg_list') return { ok: true, chat: req.chat, msgs: st.msgs.filter((m) => m.chat === req.chat && m.ts > (req.since || 0)) };
    if (req.action === 'msg_send') { const m = { id: 'm' + st.msgs.length + 1, chat: req.chat, from: 'ali', text: req.text, ts: Date.now() }; st.msgs.push(m); return { ok: true, msg: m }; }
    if (req.action === 'group_create') { st.groups = [{ gid: 'g1', name: req.name, owner: 'ali', members: ['ali'].concat(req.members) }]; return { ok: true, gid: 'g1' }; }
    if (req.action === 'inbox') { const now = Date.now(); const it = (st.ib || []).filter((x) => x.ts > (req.since || 0)); return { ok: true, now, items: it }; }
    if (req.action === 'profile_set' && st.failProfile) return { ok: false, err: 'server', detail: 'Lock timeout' };
    if (req.action === 'profile_set' || req.action === 'report' || req.action === 'block') return { ok: true };
    return null;
  } };
}
const srv = socServer();
const cloud14 = fakeCloud(); const _h = cloud14.handle; cloud14.handle = (req) => srv.handle(req) || _h(req);
const w14 = nativeBoot({ name: 'Ali', onboarded: true, ts: 1, xp: 150, cloud: { uid: 'ali', secret: 's-ali', email: 'ali@gmail.com' } }, cloud14, { v: 'ali' });
cloud14.db.users.ali = { secret: 's-ali', email: 'ali@gmail.com' };
test('Profil sahifasi: rasm, ism, tillar', () => {
  w14.eval("go('profile')");
  const m = w14.document.getElementById('main');
  assert(m.querySelector('.prof-h .av'), 'avatar yo\'q'); assert(/Ali/.test(m.textContent));
  eq(m.querySelectorAll('[data-act="pickCourse"]').length, 3);
  assert(/made by/.test(m.textContent) && /shoxrux/.test(m.textContent), 'made by shoxrux yo\'q');
});
test('Profil rasmini Musofir kayfiyatidan tanlash', () => {
  w14.eval("ACT.avatarSheet()");
  assert(w14.document.querySelectorAll('#modalBody [data-act="avPick"]').length >= 12, 'tanlovlar yo\'q');
  assert(w14.document.getElementById('avFile'), 'rasm yuklash tugmasi yo\'q');
  w14.eval("ACT.avPick({dataset:{p:'mf:love'}})");
  eq(w14.eval('state.avatar'), 'mf:love');
  assert(srv.st.log.some((r) => r.action === 'profile_set' && r.avatar === 'mf:love'), 'serverga yuborilmadi');
});
test('Do\'stlar: haftalik reyting va kiruvchi taklif', () => {
  w14.eval("go('social')");
  const m = w14.document.getElementById('main');
  assert(/K7M2QX/.test(m.textContent), 'do\'stlik kodi yo\'q');
  const rows = m.querySelectorAll('.lb .lr'); eq(rows.length, 2);
  assert(/Bek/.test(rows[0].textContent) && /90 XP/.test(rows[0].textContent), 'reyting tartibi noto\'g\'ri');
  assert(m.querySelector('[data-act="socResp"][data-p="sar"]'), 'taklif ko\'rinmadi');
  assert(w14.document.querySelector('#tabbar .bdg'), 'o\'qilmagan nishon yo\'q');
});
test('Taklifni qabul qilish', () => {
  w14.eval("ACT.socResp({dataset:{p:'sar', a:'1'}, disabled:false})");
  eq(w14.eval('SOC.data.friends.length'), 2);
});
test('Do\'st qo\'shish (kod bilan)', () => {
  w14.eval("ACT.socAdd(); document.getElementById('frCode').value='bek-123'; ACT.socAddGo();");
  assert(srv.st.log.some((r) => r.action === 'friend_add' && r.code === 'BEK123'), 'so\'rov yuborilmadi');
});
test('Chat: xabarlarni o\'qish va yozish', () => {
  w14.eval("go('chat','d:ali|bek')");
  assert(/Hello!/.test(w14.document.getElementById('msgs').textContent), 'xabar ko\'rinmadi');
  assert(w14.document.getElementById('chatTx'), 'yozish maydoni yo\'q');
  w14.eval("document.getElementById('chatTx').value='Hi Bek!'; ACT.chatSend();");
  assert(/Hi Bek!/.test(w14.document.getElementById('msgs').textContent), 'yuborilgan xabar ko\'rinmadi');
  assert(w14.eval("state.soc.read['d:ali|bek']") > 0, 'o\'qildi deb belgilanmadi');
  w14.eval("go('home')"); assert(!w14.document.getElementById('chatIn'), 'chat maydoni yopilmadi');
});
test('Guruh tuzish', () => {
  w14.eval("go('social'); ACT.socGroupNew(); document.getElementById('grName').value='Ekipaj'; document.querySelector('.grM').checked=true; ACT.socGroupGo();");
  eq(w14.eval('current.view'), 'chat'); eq(w14.eval('current.p'), 'g:g1');
  w14.eval("go('home')");
});
test('Google bilan kirmagan bo\'lsa — Do\'stlar bo\'limi kirishni taklif qiladi', () => {
  w8.eval("go('social')");
  assert(/Google/.test(w8.document.getElementById('main').textContent));
});
test('Yangi xabar kelsa — ilova ichida xabar va nishon', () => {
  w14.eval("go('home'); SOC.ibSince=0; inboxPoll();");
  assert(w14.eval('SOC.ibSince') > 0, 'birinchi so\'rov server vaqtini olmadi');
  srv.st.ib = [{ k: 'd:ali|bek', f: 'bek', n: 'Bekzod', t: 'Qalaysan?', ts: Date.now() + 5000, id: 'e1' }];
  w14.eval('inboxPoll()');
  assert(/Bekzod: Qalaysan\?/.test(w14.document.getElementById('toast').textContent), 'toast chiqmadi: ' + w14.document.getElementById('toast').textContent);
  assert(w14.document.querySelector('#tabbar .bdg'), 'nishon yo\'q');
});
test('Telefon bildirishnomalari uchun kalit Android\'ga beriladi', () => {
  w14.eval('chatNativeSync()');
  assert(w14.__calls.some((c) => c[0] === 'chatSetup' && c[2] === 'ali'), 'chatSetup chaqirilmadi');
});
test('Bildirishnoma bosilganda chat ochiladi', () => {
  w14.eval("BOOT.done=true; window.__openChat('d:ali|bek')");
  eq(w14.eval('current.view'), 'chat'); eq(w14.eval('current.p'), 'd:ali|bek');
  w14.eval("go('home')");
});
test('Server xatosi tushunarli ko\'rsatiladi', () => {
  srv.st.failProfile = true;
  w14.eval("ACT.avPick({dataset:{p:'mf:joke'}})");
  assert(/Lock timeout|saqlanmadi/.test(w14.document.getElementById('toast').textContent), w14.document.getElementById('toast').textContent);
  srv.st.failProfile = false;
});
test('Xatosiz ishladi', () => eq(w14.__errors.length, 0, w14.__errors.join(' | ')));

/* ---------- 15. XP: qayta qilganda XP yig'ib bo'lmaydi ---------- */
console.log('\n15) XP qoidasi: takrorlashda XP kamayadi');
const w15 = boot({ name: 'Ali', onboarded: true, ts: 1, xp: 0, goal: 50 });
w15.eval("bootStep('splash'); bootStep('data');");
function passLesson(w, id) {
  w.eval("startNodeTest('" + id + "')");
  for (let i = 0; i < 40 && !w.eval('QZ.done'); i++) {
    const idx = w.eval('QZ.qs[QZ.i].options.indexOf(QZ.qs[QZ.i].answer)');
    w.eval('quizPick({dataset:{p:' + idx + '}}); quizNext();');
  }
}
test('Birinchi marta: har to\'g\'ri javob 10 XP + bosqich bonusi', () => {
  w15.eval("state.path.abc=90;");
  const x0 = w15.eval('state.xp'); passLesson(w15, 'salom');
  eq(w15.eval('state.xp') - x0, 8 * 10 + 30);
});
test('Shu kuni qayta: o\'sha savollar uchun XP yo\'q, bonus ham yo\'q', () => {
  const x0 = w15.eval('state.xp'); passLesson(w15, 'salom');
  assert(w15.eval('state.xp') - x0 <= 8 * 2, 'juda ko\'p XP berildi: ' + (w15.eval('state.xp') - x0));
  assert(/takrorlash|XP olgansiz/.test(w15.document.getElementById('main').textContent), 'izoh chiqmadi');
});
test('Ertasi kuni tugatilgan bosqichni takrorlash: har javob 2 XP', () => {
  w15.eval("state.xpd = {d:'2000-01-01', q:{}, g:{}};");
  const x0 = w15.eval('state.xp'); passLesson(w15, 'salom');
  eq(w15.eval('state.xp') - x0, 8 * 2);
});
test('O\'yinlar: 1-marta to\'liq, 2-marta yarmi, keyin 0', () => {
  eq(w15.eval("gameXp('speed', 60)"), 60); eq(w15.eval("gameXp('speed', 60)"), 30); eq(w15.eval("gameXp('speed', 60)"), 0);
});
test('Har bir til uchun alohida hisoblanadi', () => {
  w15.eval("setCourse('en')"); eq(w15.eval("gameXp('speed', 60)"), 60); w15.eval("setCourse('de')");
});

console.log('\n────────────────────────────────────────');
console.log('Natija: ' + passed + ' ta o\'tdi, ' + failed + ' ta xato');
if (failed) { console.log('Xato testlar:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('🎉 Hammasi joyida — APK yig\'ish mumkin!\n');
process.exit(0);
