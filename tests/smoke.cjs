// Vérification automatique de l'application avant publication.
// Lancer : node tests/smoke.cjs   (il faut le paquet « playwright » et son navigateur Chromium)
// Le test ouvre l'application sans réseau (Firebase bloqué), avec deux profils d'exemple, et vérifie
// qu'aucun écran ne provoque d'erreur et que les fonctions principales répondent comme prévu.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.gif': 'image/gif', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].replace(/\/$/, '/index.html')));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

const fails = []; let n = 0;
const check = (name, ok, detail) => { n++; if (ok) console.log('  ok  ' + name); else { fails.push(name); console.log('  ÉCHEC  ' + name + (detail ? ' → ' + detail : '')); } };

(async () => {
  await new Promise(r => server.listen(0, r)); const url = `http://localhost:${server.address().port}/index.html`;
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const open = async news => { const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/gstatic|googleapis|docteur-fitness/, r => r.abort()); await p.addInitScript(v => { if (v) localStorage.setItem('mp_news', '9999'); else localStorage.removeItem('mp_news'); }, !news);
    await p.goto(url); await p.waitForTimeout(1500); await p.evaluate(() => cacherConnexion()); return { p, errs }; };
  // données d'exemple : deux profils, un menu généré, un peu d'historique
  const seed = p => p.evaluate(() => { const d = n => { const x = new Date(); x.setDate(x.getDate() - n); return ymd(x); };
    nut = { sexe: 'H', age: 50, taille: 180, poids: 88, act: 1.5, obj: 'perte' }; body = [{ d: d(20), p: 89 }, { d: d(10), p: 88.4 }, { d: d(1), p: 88 }];
    hist = [0, 2, 4, 7, 9, 11, 14, 16].flatMap(n => [{ d: d(n), k: 'day0', n: 'Développé couché', m: 'Pectoraux', t: 'f', s: 3, r: '10', w: 50 + (16 - n), sl: [{ w: 50 + (16 - n), r: '10' }, { w: 50 + (16 - n), r: '10' }, { w: 50 + (16 - n), r: '8' }] },
      { d: d(n), k: 'day0', n: 'Rameur', m: 'Cardio', t: 'c', s: 1, r: '12', w: 2.4, kcal: 130 }, { d: d(n), k: 'day0', n: 'Gainage', m: 'Abdos', t: 's', s: 3, r: '45', w: null, sl: [{ r: '45' }, { r: '50' }] }]);
    data['day' + todayIdx()] = [exFromLib('Développé couché', { s: 3, r: '10' }), exFromLib('Tractions', { s: 4, r: '6-8' }), exFromLib('Squat sauté', { s: 3, r: '8' })];
    other = { p: PROFILES[1], d: { nut: { sexe: 'F', age: 48, taille: 165, poids: 62, act: 1.4, obj: 'maintien' }, data: {}, body: [], hist: [{ d: d(0), n: 'Elliptique', t: 'c', r: '15', m: 'Cardio' }], coach: {} } };
    loadOther = async () => {}; foyer.plans[curWk()] = genPlan(curWk()); foyer.stock = {}; foyer.have = {}; foyer.checked = {}; render(); });

  console.log('1. Démarrage et cohérence');
  const { p, errs } = await open(false); await seed(p);
  const ver = await p.evaluate(() => APP_VERSION), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/mon-programme-v(\d+)/);
  check('version identique dans index.html et sw.js', sw && +sw[1] === ver, `index ${ver}, sw ${sw && sw[1]}`);
  check('la dernière version figure dans « Quoi de neuf »', await p.evaluate(() => NEWS[0][0] <= APP_VERSION && NEWS.every((x, i) => !i || NEWS[i - 1][0] > x[0])));

  console.log('2. Données');
  const rec = await p.evaluate(() => { const ids = RECIPES.map(r => r.id), bad = [];
    RECIPES.forEach(r => { r.ing.forEach(([f, g]) => { if (!FOODS[f]) bad.push(r.id + ' : aliment inconnu ' + f); if (!(g > 0)) bad.push(r.id + ' : quantité ' + g); });
      const k = r.ing.reduce((a, [f, g]) => a + (FOODS[f] ? FOODS[f].k * g / 100 : 0), 0); if (k < 120 || k > 1100) bad.push(r.id + ' : ' + Math.round(k) + ' kcal'); if (!['pdj', 'col', 'plat'].includes(r.type)) bad.push(r.id + ' : type ' + r.type); if (!r.steps || !r.e) bad.push(r.id + ' : préparation ou emoji manquant'); });
    return { n: ids.length, dup: ids.filter((x, i) => ids.indexOf(x) !== i), bad }; });
  check(`recettes : ${rec.n}, identifiants uniques`, !rec.dup.length, rec.dup.join(', '));
  check('recettes : aliments connus, quantités et calories plausibles', !rec.bad.length, rec.bad.join(' ; '));
  check('remplacements : tous les aliments existent', await p.evaluate(() => Object.entries(SUBS).every(([a, L]) => FOODS[a] && L.every(b => FOODS[b]))));
  check('bibliothèque : noms uniques', await p.evaluate(() => new Set(LIB.map(x => x.n)).size === LIB.length));
  check('équivalences : listes triées', await p.evaluate(() => [EQ_KG, EQ_KC].every(L => L.every((x, i) => !i || L[i - 1][0] <= x[0]))));
  check('HIIT : exercices connus, durées plausibles aux 3 niveaux', await p.evaluate(() => HIIT_S.every(H => [0, 1, 2].every(l => { const S = hiitSeq(H, l), t = S.reduce((a, x) => a + x.s, 0); return t >= 480 && t <= 2100 && S.filter(x => x.k === 'work').every(x => !x.nm || LIB_BY[x.nm]) && S.every(x => x.s > 0); })) && new Set(HIIT_S.map(H => H.id)).size === HIIT_S.length));
  check('progressions « plus facile / plus dur » : exercices connus', await p.evaluate(() => PROG.flat().every(n => LIB_BY[n])));

  console.log('3. Tous les écrans');
  for (const v of ['seance', 'semaine', 'nutrition', 'progres', 'chrono']) await p.evaluate(v => go(v), v);
  for (const t of ['jour', 'semaine', 'courses', 'profil']) await p.evaluate(t => { nutTab = t; go('nutrition'); }, t);
  for (const t of ['synth', 'bilan', 'perf', 'recs', 'seances', 'corps', 'badges']) await p.evaluate(t => { progTab = t; go('progres'); }, t);
  for (const t of ['repos', 'it', 'run']) await p.evaluate(t => { chronoTab = t; go('chrono'); }, t);
  for (let d = 0; d < 7; d++) await p.evaluate(d => { currentDay = d; go('seance'); }, d);
  await p.waitForTimeout(600); check('aucune erreur en parcourant les écrans', !errs.length, errs.join(' | ')); errs.length = 0;

  console.log('4. Fenêtres');
  await p.evaluate(() => { currentDay = todayIdx(); go('seance'); });
  for (const f of ['sheetHome()', 'sheetNews(0, true)', 'sheetAisles()', 'sheetGoal()', 'sheetLib()', 'sheetProfiles()', 'sheetDetail(0)', 'sheetShort()', 'sheetMyWod("new")', 'sheetDay(today())', 'storyYear(String(new Date().getFullYear())); clearTimeout(STORY.t); STORY = null; closeFull()'])
    await p.evaluate(f => { new Function(f)(); closeSheet(); }, f).catch(e => errs.push(f + ' : ' + e.message.split('\n')[0]));
  for (const m of ['pdj', 'dej', 'col', 'din']) await p.evaluate(m => { nutDay = todayIdx(); sheetRecette(m); closeSheet(); }, m).catch(e => errs.push('recette ' + m + ' : ' + e.message.split('\n')[0]));
  check('aucune erreur en ouvrant les fenêtres', !errs.length, errs.join(' | ')); errs.length = 0;

  console.log('5. Fonctions');
  check('bibliothèque rangée par ordre alphabétique', await p.evaluate(() => { libM = 'Tous'; libE = 'Tout'; libQ = ''; sheetLib(); const L = [...document.querySelectorAll('#lres .libit b')].map(b => b.textContent); closeSheet(); return L.length > 50 && L.every((x, i) => !i || L[i - 1].localeCompare(x, 'fr', { sensitivity: 'base' }) <= 0); }));
  check('accueil : masquer une carte', await p.evaluate(() => { go('seance'); const a = !!document.querySelector('.wkhero'); homeCfg().hide.week = 1; render(); const b = !!document.querySelector('.wkhero'); settings.home = { hide: {}, low: false }; render(); return a && !b && !!document.querySelector('.wkhero'); }));
  check('accueil : « Séance d’abord » place les cartes après les exercices', await p.evaluate(() => { const pos = () => { const l = document.querySelector('#app .list'), c = document.querySelector('#app .cheer, #app .duo'); return c ? !!(l.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) : null; }; const a = pos(); homeCfg().low = true; render(); const b = pos(); settings.home = { hide: {}, low: false }; render(); return a === false && b === true; }));
  check('plus facile : Tractions → Tractions négatives, puis retour', await p.evaluate(() => { const k = 'day' + currentDay; swapLevel(k, 1, -1); const a = data[k][1].n; swapLevel(k, 1, 1); return a === 'Tractions négatives' && data[k][1].n === 'Tractions'; }));
  check('HIIT guidé : carte, lancement, jour validé et score', await p.evaluate(async () => { const di = todayIdx(), k = 'day' + di; titles[k] = HIIT_T[0]; done[k] = []; currentDay = di; go('seance');
    if (!document.querySelector('.hiitc [data-x="fullrun"]')) return 'carte absente'; const H = hiitOfDay(di), key = hiitKey(H, settings.hiitLvl ?? 1); hiitRun();
    if (!IT || !IT.c.seq || IT.S.length < 8) return 'minuteur'; IT.i = IT.S.length - 1; itFinish(); await new Promise(r => setTimeout(r, 700));
    const ok = (done[k] || []).length === data[k].length && done[k].every(Boolean) && (coach.wods[key] || []).length === 1 && hist.some(h => h.d === today() && h.k === 'it');
    const f = document.querySelector('#hsV'); if (f){ f.value = '180'; document.querySelector('#hsF button').click(); await new Promise(r => setTimeout(r, 200)); if (wodBest(key) !== '180 cal') return 'score ' + wodBest(key); }
    closeSheet(); closeFull(); delete titles[k]; done[k] = []; return ok || 'validation'; }) === true);
  check('abdos en fin de séance : générateur et ajout unique pour Béa', await p.evaluate(() => { const B = buildProgram({ days: [0, 2, 4], niv: 'deb', mat: 'halt', obj: 'maintien', dur: 45, mob: true, abs: true });
    const ok1 = [0, 2, 4].every(d => { const L = B.data['day' + d], a = L.filter(e => e.abs); return a.length === 2 && a.every(e => LIB_BY[e.n] && e.m === 'Abdos') && L.findIndex(e => e.abs) > L.findIndex(e => e.cmp); });
    const sv = { profile, coach, data: clone(data), titles: clone(titles), save }; save = () => {}; profile = PROFILES[1]; coach = {}; data = clone(B.data); data.day0 = data.day0.filter(e => !e.abs); absOnce(); const ok2 = data.day0.filter(e => e.abs).length === 2; absOnce(); const ok3 = data.day0.filter(e => e.abs).length === 2;
    profile = sv.profile; coach = sv.coach; data = sv.data; titles = sv.titles; save = sv.save; return ok1 && ok2 && ok3; }));
  check('nutrition : mobilité non comptée, calories des séances selon le poids', await p.evaluate(() => { const c = { pid: 'x', nut: { sexe: 'F', age: 40, taille: 165, poids: 60 }, body: [], titles: {}, data: { day0: [exFromLib('Marche rapide', { r: '40 min' })], day1: [exFromLib('Posture de l’enfant', { ph: 'mob' })] } }, k = sessionKcal(c, 0); return k > 120 && k < 220 && sessionKcal(c, 1) === 0 && !targets(c, 1).train; }));
  check('menus : petit-déjeuner riche en protéines en perte de poids', await p.evaluate(() => { const L = RECIPES.filter(r => r.type === 'pdj' && recMac(r).p >= 22); return L.length >= 6; }));
  check('WOD collé : AMRAP 20 min reconnu', await p.evaluate(() => { const r = wodParse('AMRAP 20 min\n10 burpees\n15 squats'); return r.mode === 'amrap' && r.cfg.aDur === 20 && r.ex.split('\n').length === 2; }));
  check('équivalence : 12,8 t donne un résultat', await p.evaluate(() => !!eqOf(EQ_KG, 12800, 'test') && eqLine(12800, 1200, 'test').includes('équivalent')));
  check('muscles du jour calculés', await p.evaluate(() => Object.keys(dayMuscles(data['day' + currentDay]).S).length >= 3));
  check('courses : rayons dans l’ordre du magasin', await p.evaluate(() => { delete foyer.rayOrder; const G = byAisle(coursesList().groups).map(x => x[0]), O = rayOrder(); return G.length > 2 && G.every((g, i) => !i || O.indexOf(G[i - 1]) < O.indexOf(g)); }));
  check('courses : PDF valide', await p.evaluate(async () => { const r = await coursesPDF(), t = new TextDecoder('latin1').decode(new Uint8Array(await r.blob.arrayBuffer())); return t.startsWith('%PDF-1.4') && t.trimEnd().endsWith('%%EOF') && r.pages >= 1; }));
  check('recette en commun : tableau des deux portions', await p.evaluate(() => { nutTab = 'jour'; nutDay = todayIdx(); go('nutrition'); const a = [...document.querySelectorAll('article.meal')].find(a => a.querySelector('.dtab')); if (!a) return true; sheetRecette(a.querySelector('[data-act="recette"]').dataset.meal); const ok = !!document.querySelector('#sheet .dtab'); closeSheet(); return ok; }));
  check('objectif : ajout et progression', await p.evaluate(() => { coach = Object.assign({}, coach, { goals: { 'Développé couché': 90 } }); progTab = 'synth'; go('progres'); return /Développé couché/.test(document.querySelector('.goals').textContent); }));
  check('supprimer « pas aujourd’hui » : l’exercice reste au programme et revient', await p.evaluate(async () => { const sv = save, k = 'day' + todayIdx(), L0 = data[k]; save = () => {}; currentDay = todayIdx(); data[k] = [exFromLib('Crunch', {}), exFromLib('Gainage', {})]; go('seance'); sheetDetail(0); document.querySelector('#sheet [data-act="del"]').click(); document.querySelector('#dSkip').click(); const e = data[k][0], ok1 = data[k].length === 2 && !!isSkip(e) && !!document.querySelector('[data-act="unskip"]'); e.skipD = '2000-01-01'; restoreTemp(); const ok2 = !e.skipD && !isSkip(e); data[k] = L0; save = sv; go('seance'); return ok1 && ok2; }));
  check('calories manuelles sous le métabolisme de base : alerte affichée', await p.evaluate(() => { const sv = clone(nut); nut = Object.assign({}, nut, { sexe: 'F', age: 49, taille: 165, poids: 62, kcalMan: 1160 }); const ok = /métabolisme de base/.test(nutCoachCard()); nut = Object.assign({}, nut, { kcalMan: 0 }); const ok2 = !/métabolisme de base/.test(nutCoachCard()); nut = sv; return ok && ok2; }));
  check('animations : tout ce qui est proposé a son animation docteur-fitness', await p.evaluate(() => { const N = new Set(); for (const days of [[0,2,4],[0,1,3,4],[0,1,2,3,4]]) for (const niv of ['deb','inter','conf']) for (const plyo of [0,1]) { const o = buildProgram({ days, obj:'perte', niv, dur:75, plyo, abs:1, mat:'caserne' }); Object.values(o.data || o).forEach(L => Array.isArray(L) && L.forEach(e => N.add(e.n))); }
    ABS_FIN.forEach(n => N.add(n)); Object.values(MOB).flat().forEach(n => N.add(n)); HIIT_S.forEach(H => H.B.forEach(B => B.ex.forEach(x => N.add(hiitEx(x))))); PROG.flat().forEach(n => N.add(n)); const bad = [...N].filter(n => !DF_GIF[n]); return bad.length ? bad.join(', ') : true; }) === true);
  check('animations : anciens exercices remplacés une fois dans le programme', await p.evaluate(() => { const sv = { data: clone(data), coach, save }; save = () => {}; coach = {}; data.day6 = [exFromLib('Fentes sautées', { s: 4, r: '8' }), exFromLib('Squat sauté', {})]; animOnce(); const L = data.day6, ok = L[0].n === 'Sauts latéraux (skater)' && L[0].s === 4 && coach.animSwap; data.day6 = [exFromLib('Fentes sautées', {})]; animOnce(); const ok2 = data.day6[0].n === 'Fentes sautées'; data = sv.data; coach = sv.coach; save = sv.save; return ok && ok2; }));
  check('pas de zoom au double appui', await p.evaluate(() => getComputedStyle(document.querySelector('button')).touchAction === 'manipulation' && /maximum-scale=1/.test(document.querySelector('meta[name=viewport]').content)));
  check('chaque lundi : exercices secondaires changés, exercice principal gardé, tout faisable', await p.evaluate(() => { const sv = { data: clone(data), coach, save, gear }; save = () => {}; gear = clone(GEAR_CASERNE); coach = {};
    data = { day0: ['Développé couché', 'Développé incliné haltères', 'Kickback haltère', 'Élévations latérales', 'Crunch'].map(n => exFromLib(n, { s: 3 })), day1: [], day2: [], day3: [], day4: [], day5: [], day6: [] }; data.day0[0].cmp = 1;
    rotateWeek(false, '2026-W47'); const L = data.day0, ok = L[0].n === 'Développé couché' && L[1].n === 'Développé incliné haltères' && coach.rot.ch.length >= 2 && L.every(e => canDo(e.n) && DF_GIF[e.n]);
    const n1 = L.map(e => e.n).join(); rotateWeek(false, '2026-W47'); const same = L.map(e => e.n).join() === n1; data = sv.data; coach = sv.coach; save = sv.save; gear = sv.gear; return ok && same; }));
  check('aperçu de la semaine prochaine = ce qui change le lundi', await p.evaluate(() => { const sv = { data: clone(data), coach, save, gear }; save = () => {}; gear = clone(GEAR_CASERNE); coach = {};
    data = { day0: ['Développé couché', 'Écartés haltères', 'Kickback haltère', 'Élévations latérales', 'Crunch'].map(n => exFromLib(n, { s: 3 })), day1: [], day2: [], day3: [], day4: [], day5: [], day6: [] }; data.day0[0].cmp = 1;
    data.day0[2].skipD = today(); const P = nextWeekPlan(), a = P.ch.map(x => x[1]).join(); delete data.day0[2].skipD; rotateWeek(false, P.wk); const b = coach.rot.ch.map(x => x[1]).join();
    sheetNextWeek(); const shown = /semaine prochaine/.test(document.querySelector('#sheet').textContent); closeSheet(); data = sv.data; coach = sv.coach; save = sv.save; gear = sv.gear; return a.length > 0 && a === b && shown; }));
  check('programme vidé : le bouton le restaure avec les jours HIIT', await p.evaluate(() => { const sv = { data: clone(data), titles: clone(titles), coach, save }; save = () => {};
    const full = { day0: ['Développé couché', 'Écartés haltères', 'Dips'].map(n => exFromLib(n, {})), day1: ['Rowing barre', 'Curl barre'].map(n => exFromLib(n, {})), day2: [], day3: [], day4: [], day5: [], day6: [] };
    coach = { prevHiit: { data: full, titles: { day0: 'Poitrine', day1: 'Dos', day2: 'Repos', day3: 'Repos', day4: 'Repos', day5: 'Repos', day6: 'Repos' } } };
    data = { day0: [exFromLib('Rameur', {})], day1: [], day2: [], day3: [], day4: [], day5: [], day6: [] }; titles = { day0: 'Poitrine', day3: '⚡ HIIT machines' };
    const before = canRepair(); repairProg(); const ok = before && !canRepair() && data.day0.length >= 3 && isHiitDay(3); data = sv.data; titles = sv.titles; coach = sv.coach; save = sv.save; return ok; }));
  check('Béa : abdos sur chaque séance, HIIT compris, et ils reviennent', await p.evaluate(() => { const sv = { profile, data: clone(data), titles: clone(titles), coach, prog, save }; save = () => {}; profile = PROFILES[1]; coach = {}; prog = null;
    data = { day0: ['Développé couché', 'Rowing barre'].map(n => exFromLib(n, {})), day1: hiitList(0), day2: [], day3: [], day4: [], day5: [], day6: [] }; titles = { day0: 'Haut', day1: HIIT_T[0] };
    absOnce(); const ok1 = data.day0.some(e => e.abs) && data.day1.filter(e => e.abs).length === 2 && data.day1[data.day1.length - 1].ph === 'cool'; const n = data.day0.length; absOnce(); const ok2 = data.day0.length === n;
    data.day0 = data.day0.filter(e => !e.abs); absOnce(); const ok3 = data.day0.some(e => e.abs);
    Object.assign(window, {}); profile = sv.profile; data = sv.data; titles = sv.titles; coach = sv.coach; prog = sv.prog; save = sv.save; return ok1 && ok2 && ok3; }));
  check('Béa : que du fitness (3 Tabata variés + 2 HIIT, abdos), plus de musculation, une seule fois', await p.evaluate(() => { const sv = { profile, data: clone(data), titles: clone(titles), coach, prog, save }; save = () => {}; profile = PROFILES[1]; coach = {};
    prog = { obj: 'perte', days: [0, 2, 4], mat: 'caserne', dur: 60, niv: 'inter', plyo: true, mob: true, abs: true, start: curWk(), lastWk: curWk() };
    data = buildProgram(prog).data; beaFitOnce();
    const tab = [0, 2, 4].every(d => { const T = data['day' + d].filter(e => e.tab); return T.length === 6 && new Set(T.map(e => e.n)).size === 6 && data['day' + d].some(e => e.abs); });
    const noMuscu = !Object.values(data).flat().some(e => e && ['Développé couché', 'Squat', 'Rowing barre', 'Tirage vertical (Lat Pulldown)', 'Soulevé de terre'].includes(e.n));
    const ok1 = tab && noMuscu && isHiitDay(1) && isHiitDay(3) && !canRepair(); const j = JSON.stringify(data); beaFitOnce(); const ok2 = JSON.stringify(data) === j && !!coach.prevMuscu;
    profile = sv.profile; data = sv.data; titles = sv.titles; coach = sv.coach; prog = sv.prog; save = sv.save; return ok1 && ok2; }));
  check('Béa : 1 260 kcal strictes chaque jour, une seule fois', await p.evaluate(() => { const sv = { profile, nut: clone(nut), save }; save = () => {}; profile = PROFILES[1]; nut = { sexe: 'F', age: 49, taille: 165, poids: 62, obj: 'perte', act: 1.35 };
    beaKcalOnce(); const K = [0, 1, 2, 3, 4, 5, 6].map(d => targets(ctxOf(profile.id), d).kcal), ok = K.every(k => k === 1260); nut.kcalMan = 1400; beaKcalOnce(); const ok2 = nut.kcalMan === 1400;
    profile = sv.profile; nut = sv.nut; save = sv.save; return ok && ok2; }));
  check('séance complète guidée : échauffement, Tabata, abdos, étirements, tout coché à la fin', await p.evaluate(() => { const sv = { data: clone(data), titles: clone(titles), done: clone(done), save }; save = () => {}; const d = todayIdx(), k = 'day' + d;
    data[k] = [exFromLib('Jumping jacks', { ph: 'warm', s: 1 }), ...tabataSession('jambes', 'x', null, 3), exFromLib('Crunch', { abs: 1, s: 3 }), exFromLib('Étirement du psoas', { ph: 'cool', s: 1 })]; titles[k] = 'Tabata';
    const P = fullPlan(d), L = P.S.map(x => x.l).join('|'), ok = /^Échauffement/.test(P.S[0].l) && /Tabata 3\/3/.test(L) && /Abdos · Crunch/.test(L) && /Étirement · Étirement du psoas$/.test(P.S[P.S.length - 1].l);
    currentDay = d; go('seance'); const btn = !!document.querySelector('[data-x="fullrun"]'); fullRun(); IT.c.then(); clearInterval(IT && IT.iv); const all = data[k].every((e, i) => done[k][i]);
    data = sv.data; titles = sv.titles; done = sv.done; save = sv.save; closeFull && closeFull(); go('seance'); return ok && btn && all; }));
  check('faire défiler les cartes d’exercices ne change pas de jour', await p.evaluate(() => { currentDay = todayIdx(); go('seance'); const el = document.querySelector('.exstory button'); if (!el) return true; const d = currentDay;
    const T = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: 100 }); el.dispatchEvent(new TouchEvent('touchstart', { touches: [T(300)], changedTouches: [T(300)], bubbles: true })); el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [T(80)], bubbles: true }));
    return currentDay === d; }));
  check('Tabata mixé : chaque bloc alterne 4 exercices, combinaisons toutes différentes', await p.evaluate(() => { const N = ['A', 'B', 'C', 'D', 'E', 'F'], B = tabBlocks(N); const S = []; tabSeq(N, S, 'T');
    const W = S.filter(x => x.k === 'work'), blocs = []; for (let i = 0; i < W.length; i += 8) blocs.push(W.slice(i, i + 8).map(x => x.nm));
    return B.length === 6 && B.every(Q => Q.length === 4) && new Set(B.map(Q => Q.slice().sort().join())).size === 6 && blocs.every(b => new Set(b).size === 4 && b[0] !== b[1]); }));
  check('programme fitness : pas de conseils de musculation, carte coach fitness', await p.evaluate(() => { const sv = { profile, data: clone(data), titles: clone(titles), coach, prog, save }; save = () => {}; profile = PROFILES[1]; coach = {};
    prog = { obj: 'perte', days: [0, 2, 4], mat: 'caserne', dur: 60, niv: 'inter', plyo: true, mob: true, abs: true, start: curWk(), lastWk: curWk() }; data = buildProgram(prog).data; beaFitOnce();
    const ok = isFitProg() && !balanceIssues(planSets()).length && balanceCard() === '' && hiitCard() === '' && /Programme fitness/.test(coachCard()) && coachWeekly({}).length === 0;
    profile = sv.profile; data = sv.data; titles = sv.titles; coach = sv.coach; prog = sv.prog; save = sv.save; return ok; }));
  check('fenêtre du coach : rien ne dépasse sur le côté', await p.evaluate(() => { sheetCoach(); const sh = document.querySelector('#sheet'), ok = sh.scrollWidth <= sh.clientWidth + 2; closeSheet(); return ok; }));
  check('plus de bouton « Annuler l’adaptation à la caserne »', await p.evaluate(() => { const sv = coach; coach = Object.assign({}, coach, { prevData: { day0: [] } }); go('semaine'); const ok = !document.querySelector('[data-x="adaptundo"]'); coach = sv; go('seance'); return ok; }));
  check('HIIT varié pour le programme fitness seulement (4 formats, sans doublon, change chaque semaine)', await p.evaluate(() => { const sv = { prog, titles: clone(titles) }; titles.day1 = HIIT_T[0];
    prog = Object.assign({}, prog || {}, { split: 'Fitness : 3 Tabata + 2 HIIT' }); const H = hiitOfDay(1, '2026-W48'), H2 = hiitOfDay(1, '2026-W49'), ex = H.B.flatMap(b => b.ex.map(hiitEx));
    const okFit = H.id === 'mix' && H.B.length === 4 && new Set(H.B.map(b => b.t)).size === 4 && new Set(ex).size === ex.length && ex.every(n => LIB_BY[n] && canDo(n)) && JSON.stringify(H.B) !== JSON.stringify(H2.B);
    prog = null; const okChris = HIIT_S.includes(hiitOfDay(1, '2026-W48')); prog = sv.prog; titles = sv.titles; return okFit && okChris; }));
  check('Béa : plus aucune pompe (même sur les genoux)', await p.evaluate(() => { const sv = { profile, data: clone(data), coach, save }; save = () => {}; profile = PROFILES[1]; coach = {};
    data = { day0: [tabEx('Pompes sur les genoux', 'haut', 0), tabEx('Burpees', 'haut', 1)], day1: [exFromLib('Pompes diamant', { s: 3 })], day2: [], day3: [], day4: [], day5: [], day6: [] }; beaPompesOnce();
    const all = Object.values(data).flat(), ok = !all.some(e => POMPES.has(e.n)) && data.day0.length === 2 && data.day0[0].tab && !data.day1.length && ![...TAB_POOL.haut.L, ...TAB_POOL.jambes.L, ...TAB_POOL.cardio.L, ...HIIT_POOL.force, ...HIIT_POOL.cardio].some(n => POMPES.has(n));
    profile = sv.profile; data = sv.data; coach = sv.coach; save = sv.save; return ok; }));
  check('menus : seulement des produits de saison (novembre sans tomates fraîches ni courgettes)', await p.evaluate(() => { const R0 = Object.fromEntries(RECIPES.map(r => [r.id, r])), sv = foyer.plans; foyer.plans = {};
    const wk = '2026-W47', P = genPlan(wk), ids = P.days.flatMap(day => Object.values(day).flatMap(v => typeof v === 'string' ? [v] : Object.values(v || {}))).filter(Boolean);
    const ok = monthOfWk(wk) === 11 && ids.every(id => seasonOk(R0[id], 11)) && !ids.some(id => R0[id].ing.some(([f]) => f === 'tomate' || f === 'courgette')) && P.season === 1;
    const juillet = RECIPES.filter(r => r.type === 'plat' && seasonOk(r, 7)).length > RECIPES.filter(r => r.type === 'plat' && seasonOk(r, 1)).length;
    foyer.plans = sv; return ok && juillet; }));
  check('mode magasin : liste par rayon, cases cochées partagées, masquer, fermer', await p.evaluate(() => { const wk = curWk(), sv = clone(foyer.checked || {}); foyer.checked[wk] = {};
    nutTab = 'courses'; go('nutrition'); if (!document.querySelector('[data-x="shopgo"]')) return 'bouton absent'; shopOpen(); const n = document.querySelectorAll('.shopi').length;
    document.querySelector('.shopi').click(); const ok1 = n > 5 && document.querySelectorAll('.shopi.got').length === 1 && Object.keys(foyer.checked[wk]).length === 1;
    document.querySelector('[data-x="shophide"]').click(); const ok2 = document.querySelectorAll('.shopi').length === n - 1;
    document.querySelector('[data-x="shopclose"]').click(); const ok3 = !SHOP && !document.querySelector('#full').classList.contains('show');
    foyer.checked = sv; go('seance'); return ok1 && ok2 && ok3; }) === true);
  check('Béa : programme 12 semaines (3 séances, HIIT machines, marche, phases, bilan, 100 g de protéines)', await p.evaluate(() => { const sv = { profile, data: clone(data), titles: clone(titles), coach, prog, nut: clone(nut), save, gear }; save = () => {}; profile = PROFILES[1]; coach = { beaFit: '1' }; gear = clone(GEAR_CASERNE);
    prog = { obj: 'perte', days: [0, 2, 4], split: 'Fitness : 3 Tabata + 2 HIIT' }; nut = Object.assign({}, nut, { kcalMan: 1260, kcalSeance: false }); beaP12Once();
    const ok1 = isP12() && !isFitProg() && isHiitDay(1) && isHiitDay(5) && [0, 1, 2, 3, 4, 5, 6].every(d => data['day' + d].some(e => e.walk)) && data.day0.some(e => e.n === 'Squat goblet') && data.day4.some(e => e.n === 'Hip thrust') && Object.values(data).flat().every(e => canDo(e.n));
    const ex = hiitOfDay(1).B.flatMap(b => b.ex), ok2 = ex.every(n => HM.includes(n));
    const ok3 = !nut.kcalMan && targets(ctxOf('bea'), 0).p === 100 && rotPlan(clone(data), wkShift(curWk(), 1), true).length === 0 && !canRepair() && !brokenDays().length && /12 semaines/.test(coachCard()) && /bilan médical/.test(p12MedCard()) && (prog.p12.med = { mt: today(), vasc: today() }, p12MedCard() === '');
    const st = prog.p12.start; prog.p12.start = wkShift(curWk(), -3); applyCycle(); const ok4 = data.day0.find(e => e.n === 'Squat goblet').s === 3; prog.p12.start = st;
    profile = sv.profile; data = sv.data; titles = sv.titles; coach = sv.coach; prog = sv.prog; nut = sv.nut; save = sv.save; gear = sv.gear; return ok1 && ok2 && ok3 && ok4; }));
  check('Béa : sédentaire, recomposition, 1 500 kcal fixes et 115 g de protéines', await p.evaluate(() => { const sv = { profile, nut: clone(nut), save }; save = () => {}; profile = PROFILES[1]; nut = { sexe: 'F', age: 49, taille: 153, poids: 62, obj: 'perte', act: 1.5, kcalMan: 1260 };
    beaNut1500Once(); const K = [0, 1, 2, 3, 4, 5, 6].map(d => targets(ctxOf(profile.id), d)), ok = nut.act === 1.2 && nut.obj === 'recompo' && K.every(t => t.kcal === 1500 && t.p === 115);
    profile = sv.profile; nut = sv.nut; save = sv.save; return ok; }));
  check('nutrition : sources, alerte de rythme avec calories à la main, plats riches en protéines', await p.evaluate(() => { sheetSources(); const ok1 = /Mifflin/.test(document.querySelector('#sheet').textContent); closeSheet();
    const L = RECIPES.filter(r => r.type === 'plat'), H = protDense(L, 5), ok2 = H.length < L.length && H.every(r => recMac(r).p * 100 / recMac(r).k >= 7);
    const sv = { nut: clone(nut), body: clone(body) }; nut = Object.assign({}, nut, { sexe: 'F', age: 49, taille: 153, poids: 62, obj: 'recompo', act: 1.2, kcalMan: 1500 });
    const d = k => { const x = new Date(); x.setDate(x.getDate() - k); return ymd(x); }; body = [[21, 64], [14, 63], [7, 62], [0, 61]].map(([k, p]) => ({ d: d(k), p }));
    const ok3 = /perds vite/.test(nutCoachCard()); nut = sv.nut; body = sv.body; return ok1 && ok2 && ok3; }));
  check('plats mélangés : poids de l’assiette cuite (pain et salade à part)', await p.evaluate(() => { const por = { r: REC_BY['chili'], ing: [['boeuf', 100], ['riz', 50], ['concassee', 100], ['oignon', 50]], side: null };
    const g = plateG(por), sol = { r: REC_BY['minestrone'], ing: [['pates', 50], ['pain', 60]], side: null };
    return isMix(por) && g === Math.round((75 + 130 + 100 + 40) / 10) * 10 && plateG(sol) === 110 && /pain/.test(plateSide(sol)) && !isMix({ r: REC_BY['poulet-riz'], ing: [] }); }));
  check('code oublié : supprime le code et ouvre le profil', await p.evaluate(async () => { await setPin('bea', '1234'); switchProfile('bea'); await new Promise(r => setTimeout(r, 200)); document.querySelector('#lock [data-lk="forgot"]').click(); document.querySelector('#lock [data-lk="reset"]').click(); await new Promise(r => setTimeout(r, 600)); const ok = !lockOf('bea') && !document.getElementById('lock') && profile.id === 'bea'; await switchProfile(PROFILES[0].id, true); return ok; }));
  await p.waitForTimeout(400); check('aucune erreur pendant ces vérifications', !errs.length, errs.join(' | ')); await p.close();

  console.log('6. Quoi de neuf après une mise à jour');
  // sans réseau, le démarrage attend l'écran de connexion : on lance la vérification à la main
  const b2 = await open(true); await b2.p.evaluate(() => newsCheck()); await b2.p.waitForTimeout(2800);
  check('la fenêtre s’ouvre après une mise à jour', await b2.p.evaluate(() => /Quoi de neuf/.test(document.querySelector('#sheet').textContent) && document.querySelector('#sheet').classList.contains('show') && safeGet('mp_news', 0) === APP_VERSION));
  check('elle ne se rouvre pas ensuite', await b2.p.evaluate(async () => { closeSheet(); newsCheck(); await new Promise(r => setTimeout(r, 2600)); return !document.querySelector('#sheet').classList.contains('show'); }));
  check('aucune erreur', !b2.errs.length, b2.errs.join(' | '));

  console.log('7. Mode écran (tablette)');
  const e3 = await open(false); await e3.p.route(/open-meteo/, r => r.abort()); await seed(e3.p);
  check('le code reste lisible par Safari 15 (vieux iPad) : pas de « lookbehind »', !/\(\?<[=!]/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));
  check('l’écran s’affiche avec les deux profils et le repas à préparer', await e3.p.evaluate(() => { ecStart(); EC.wakeUntil = Date.now() + 60000; ecRender(); const t = $('#ecran').textContent;
    return document.body.classList.contains('ecran-on') && document.querySelectorAll('#ecran .ec-grid > .ec-col').length === 3 && /En cuisine/.test(t) && wantAwake(); }));
  check('recette en grand : ingrédients et étapes', await e3.p.evaluate(() => { const b = $('#ecran [data-ec="rec"]'); if (!b) return false; b.click(); const r = $('#ecRec'); return r.classList.contains('on') && r.querySelectorAll('tbody tr').length > 0 && r.querySelectorAll('.ec-steps li').length > 0; }));
  check('aller dans l’appli puis revenir à l’écran', await e3.p.evaluate(() => { ecCloseRec(); ecLeave('nutrition'); const away = document.body.classList.contains('ecran-away') && view === 'nutrition'; ecShow(); return away && document.body.classList.contains('ecran-on'); }));
  check('horloge de nuit', await e3.p.evaluate(() => { EC.wakeUntil = 0; const d0 = Date; const fake = new d0(); fake.setHours(23, 30); window.Date = class extends d0 { constructor(...a){ super(...(a.length ? a : [fake.getTime()])); } static now(){ return fake.getTime(); } };
    try{ ecRender(); return $('#ecran').classList.contains('nuit'); } finally { window.Date = d0; } }));
  check('minuteur en pause caché sur l’écran, visible s’il tourne', await e3.p.evaluate(() => { T.total = 90; T.left = 60; T.run = false; paintTimer(); const hid = !$('#mini').classList.contains('show'); T.run = true; paintTimer(); const vis = $('#mini').classList.contains('show'); T.run = false; T.left = T.total; paintTimer(); return hid && vis; }));
  check('minuteur rangé invisible sur l’écran (pas de « 01:30 » qui dépasse en bas)', await e3.p.evaluate(() => { ecShow(); T.run = false; T.left = T.total; paintTimer(); return getComputedStyle($('#mini')).visibility === 'hidden'; }));
  check('déco de Noël en décembre seulement', await e3.p.evaluate(() => { const ok = /Plus que 13 jours/.test(ecFete(new Date(2026, 11, 12))) && /Joyeux Noël/.test(ecFete(new Date(2026, 11, 25))) && /Bonne année/.test(ecFete(new Date(2027, 0, 1))) && !ecFete(new Date(2026, 10, 19)) && !ecFete(new Date(2027, 0, 2));
    ecDeco(); return ok && document.querySelectorAll('#ecDeco .ec-guirl i').length === 26 && document.querySelectorAll('#ecDeco .ec-snow span').length === 22; }));
  check('séance faite : entrée d’historique correcte, et refus propre sans connexion', await e3.p.evaluate(async () => { const k = 'day' + todayIdx(), h = ecHistOf({ data, logs: {}, sl: {} }, k, 0);
    const ok = h.n === data[k][0].n && h.d === today() && h.k === k; const r = await ecTick('bea', [0], true); return ok && r === false; }));
  check('boutons « séance faite » et exercices à cocher', await e3.p.evaluate(() => { ecRender(); return !!$('#ecran [data-ec="tickall"]') && document.querySelectorAll('#ecran [data-ec="tick"]').length >= 3; }));
  check('liste de courses : articles, cocher, ajouter', await e3.p.evaluate(async () => { loadFoyer = async () => {}; saveFoyer = () => {}; const S = ecShopData(); if (!S.n) return false;
    ecOpenShop(); const b = $('#ecRec [data-ec="shopck"]'); b.click(); await new Promise(r => setTimeout(r, 50)); const wk = curWk(), ck = (foyer.checked[wk] || {})[b.dataset.id];
    $('#ecAddIn').value = 'Café'; $('#ecAdd').dispatchEvent(new Event('submit', { cancelable: true })); await new Promise(r => setTimeout(r, 50)); const ok = ck && (foyer.extra[wk] || []).includes('Café') && /Café/.test($('#ecRec').textContent); ecCloseRec(); return ok; }));
  check('minuteurs : plusieurs à la fois, sonnerie, suppression', await e3.p.evaluate(() => { EC.timers = []; ecTimerAdd(10, '🍝 Pâtes'); ecTimerAdd(5, '🐟 Poisson'); const two = document.querySelectorAll('#ecTimers .ec-tm').length === 2;
    EC.timers[1].end = Date.now() - 1000; ecTimersTick(); const ring = !!$('#ecTimers .ec-tm.ring') && EC.timers[1].rang; EC.timers.slice().forEach(t => ecTimerDel(t.id)); return two && ring && !$('#ecTimers').classList.contains('on'); }));
  check('décongélation : poisson surgelé repéré', await e3.p.evaluate(() => { const H = Date.prototype.getHours; Date.prototype.getHours = () => 19; const saved = ecMealOf;
    ecMealOf = () => [{ p: PROFILES[0], por: { ing: [['saumon', 130], ['riz', 80]] } }, { p: PROFILES[1], por: { ing: [['saumon', 100]] } }];
    try{ const L = ecThaw(); return todayIdx() === 6 ? L.length === 0 : L.some(x => x.f === 'saumon' && x.g === 230) && !L.some(x => x.f === 'riz') && /congélateur/.test(ecThawHtml()); } finally { Date.prototype.getHours = H; ecMealOf = saved; } }));
  check('agenda : rendez-vous du jour affichés', await e3.p.evaluate(() => { foyer.agenda = 'https://script.google.com/macros/s/abc/exec'; const d = new Date(); d.setHours(23, 0, 0, 0);
    EC.agenda = [{ t: 'Dentiste', s: d.getTime(), e: d.getTime() + 3600000, j: false }]; const h = ecAgendaHtml(); delete foyer.agenda; EC.agenda = null; return /Dentiste/.test(h) && /23:00/.test(h); }));
  check('défis à deux et bilan : aucun plantage', await e3.p.evaluate(() => { ecDuoCol(); ecBilanCol(); return true; }));
  check('réglage agenda : fenêtre et script', await e3.p.evaluate(() => { sheetAgenda(); const ok = /script\.google\.com/.test($('#sheet').textContent) && /doGet/.test(EC_AGENDA_SCRIPT); closeSheet(); return ok; }));
  check('quitter le mode écran', await e3.p.evaluate(() => { ecStop(); render(); return !document.body.classList.contains('ecran-on') && !EC.on; }));
  check('aucune erreur', !e3.errs.length, e3.errs.join(' | '));

  await browser.close(); server.close();
  console.log(fails.length ? `\n${fails.length} échec(s) sur ${n} vérifications : ${fails.join(' ; ')}` : `\n${n} vérifications réussies.`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('Le test s’est arrêté :', e); process.exit(1); });
