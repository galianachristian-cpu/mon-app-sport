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
    if (!document.querySelector('.hiitc [data-x="hiitrun"]')) return 'carte absente'; const H = hiitOfDay(di), key = hiitKey(H, settings.hiitLvl ?? 1); hiitRun();
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
  check('code oublié : supprime le code et ouvre le profil', await p.evaluate(async () => { await setPin('bea', '1234'); switchProfile('bea'); await new Promise(r => setTimeout(r, 200)); document.querySelector('#lock [data-lk="forgot"]').click(); document.querySelector('#lock [data-lk="reset"]').click(); await new Promise(r => setTimeout(r, 600)); const ok = !lockOf('bea') && !document.getElementById('lock') && profile.id === 'bea'; await switchProfile(PROFILES[0].id, true); return ok; }));
  await p.waitForTimeout(400); check('aucune erreur pendant ces vérifications', !errs.length, errs.join(' | ')); await p.close();

  console.log('6. Quoi de neuf après une mise à jour');
  // sans réseau, le démarrage attend l'écran de connexion : on lance la vérification à la main
  const b2 = await open(true); await b2.p.evaluate(() => newsCheck()); await b2.p.waitForTimeout(2800);
  check('la fenêtre s’ouvre après une mise à jour', await b2.p.evaluate(() => /Quoi de neuf/.test(document.querySelector('#sheet').textContent) && document.querySelector('#sheet').classList.contains('show') && safeGet('mp_news', 0) === APP_VERSION));
  check('elle ne se rouvre pas ensuite', await b2.p.evaluate(async () => { closeSheet(); newsCheck(); await new Promise(r => setTimeout(r, 2600)); return !document.querySelector('#sheet').classList.contains('show'); }));
  check('aucune erreur', !b2.errs.length, b2.errs.join(' | '));

  await browser.close(); server.close();
  console.log(fails.length ? `\n${fails.length} échec(s) sur ${n} vérifications : ${fails.join(' ; ')}` : `\n${n} vérifications réussies.`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('Le test s’est arrêté :', e); process.exit(1); });
