/* Runs the DFM engine off the main thread. Holds prepared parts between calls. */
importScripts('./engine.js');
let parts = [];
function summary(p) {
  const st = p.features.stacks.map(s => ({ kind: s.kind, d: s.main.d, depth: s.main.depth, through: s.through, thread: s.thread ? s.thread.n : null, pitch: s.thread ? s.thread.p : null, threadKind: s.threadKind, steps: s.steps.map(x => x.d), csk: s.cones.length ? 2 * s.cones[0].halfAngle : null, mid: s.main.mid, tris: s.tris }));
  const tt = new Uint8Array(p.nT); p.faces.forEach(f => { const v = f.type === 'plane' ? 0 : f.type === 'cyl' ? (f.concave ? 1 : 2) : f.type === 'cone' ? 3 : 4; f.tris.forEach(t => tt[t] = v); });
  return { triType: tt, name: p.name, size: p.size, vol: p.vol, area: p.area, nT: p.nT, openEdges: p.openEdges, bmin: p.bmin, bmax: p.bmax, diag: p.diag, voids: p.shells.filter(s => s.vol < 0).length,
    faces: p.faces.length, faceTypes: p.faces.reduce((a, f) => (a[f.type] = (a[f.type] || 0) + 1, a), {}), stacks: st,
    radii: p.features.radii.map(g => ({ r: g.r, depth: g.depth })), bosses: p.features.bosses.map(g => ({ d: g.d, depth: g.depth })), thinAxis: DFM.thinAxis(p) };
}
self.onmessage = (e) => {
  const { id, cmd } = e.data; const t0 = performance.now();
  try {
    let res;
    if (cmd === 'load') { parts = e.data.meshes.map(m => DFM.preparePart(m)); res = parts.map(p => Object.assign(summary(p), { topo: DFM.topology(p) })); }
    else if (cmd === 'match') res = DFM.drawingMatch(parts, e.data.items, e.data.text, e.data.drawingName);
    else if (cmd === 'analyze') { const p = parts[e.data.part]; const f = DFM.analyze(p, e.data.process, e.data.opt); const th = DFM.thicknessMap(p); res = { findings: f, thickness: th }; }
    else if (cmd === 'itp') res = DFM.inspectionPlan(e.data.text, e.data.items, Object.assign({}, e.data.ctx, { part: parts[e.data.part] || null }));
    else if (cmd === 'views') { const p = parts[e.data.part]; res = p ? DFM.viewOutlines(p) : []; }
    else if (cmd === 'dfa') { const d = DFM.dfa(parts, e.data.answers, { noInterf: true }); res = { groups: d.groups.map(g => ({ key: g.key, name: g.name, count: g.parts.length, vol: g.vol, size: g.size, fastener: g.fastener, idx: g.parts.map(q => parts.indexOf(q)) })) }; }
    else if (cmd === 'quality') { const p = parts[e.data.part]; res = p ? DFM.modelQuality(p, e.data.prof) : []; }
    else if (cmd === 'read') res = DFM.drawingRead(e.data.items, e.data.text, e.data.ctx || {});
    else if (cmd === 'drawing') { const p = parts[e.data.part]; res = DFM.drawingChecks(e.data.text, e.data.items, Object.assign({}, e.data.ctx, { cad: p ? p.features : null, part: p || null })); }
    self.postMessage({ id, ok: true, res, ms: performance.now() - t0 });
  } catch (err) { self.postMessage({ id, ok: false, error: String(err && err.stack || err) }); }
};

// ---- bolt length check: grip and thread engagement from the holes along each screw axis ----
const STD_L = [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200];
const METRIC = [[1.6, 0.35], [2, 0.4], [2.5, 0.45], [3, 0.5], [4, 0.7], [5, 0.8], [6, 1], [8, 1.25], [10, 1.5], [12, 1.75], [14, 2], [16, 2], [20, 2.5], [24, 3]];
const v3 = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len: a => Math.hypot(a[0], a[1], a[2]) };
v3.cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; v3.norm = a => v3.mul(a, 1 / (v3.len(a) || 1));
function screwAxis(bodies) {
  const P = []; bodies.forEach(p => { const T = p.bvh.TP; const st = Math.max(1, Math.floor(T.length / 3 / 6000)); for (let i = 0; i < T.length / 3; i += st) P.push([T[i * 3], T[i * 3 + 1], T[i * 3 + 2]]); });
  if (P.length < 12) return null;
  const m = [0, 0, 0]; P.forEach(p => { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; }); m[0] /= P.length; m[1] /= P.length; m[2] /= P.length;
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; P.forEach(p => { const d = v3.sub(p, m); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; });
  let a = [0.577, 0.578, 0.579]; for (let k = 0; k < 60; k++) a = v3.norm([v3.dot(C[0], a), v3.dot(C[1], a), v3.dot(C[2], a)]);
  for (let i = 0; i < 3; i++) if (Math.abs(a[i]) > 0.9995) { a = [0, 0, 0]; a[i] = Math.sign(a[i] || 1) * 1; }
  return { P, m, a };
}
function analyzeScrew(bodies, others, k) {
  const ax = screwAxis(bodies); if (!ax) return { verdict: 'info', note: 'Too few points to read the screw.' };
  let { P, m, a } = ax;
  const prof = (a) => { let s0 = Infinity, s1 = -Infinity; const S = P.map(p => { const d = v3.sub(p, m); const s = v3.dot(d, a); const r = v3.len(v3.sub(d, v3.mul(a, s))); if (s < s0) s0 = s; if (s > s1) s1 = s; return [s, r]; }); return { S, s0, s1 }; };
  let pr = prof(a); const Lt = pr.s1 - pr.s0; if (!(Lt > 0)) return { verdict: 'info', note: 'Could not read the screw shape.' };
  const N = 120, bin = Lt / N;
  const rmax = s => { const R = new Float32Array(N).fill(0); const sr = q => { const d = v3.sub(q, m); const x = v3.dot(d, a); return [x, v3.len(v3.sub(d, v3.mul(a, x)))]; };
    bodies.forEach(p => { const T = p.bvh.TP; for (let t = 0; t < T.length / 9; t++) { const V = [0, 1, 2].map(k => sr([T[t * 9 + k * 3], T[t * 9 + k * 3 + 1], T[t * 9 + k * 3 + 2]]));
      for (let e = 0; e < 3; e++) { const [x0, r0] = V[e], [x1, r1] = V[(e + 1) % 3]; const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - s.s0) / bin)), i1 = Math.min(N - 1, Math.floor((Math.max(x0, x1) - s.s0) / bin));
        for (let i = i0; i <= i1; i++) { const xc = s.s0 + (i + 0.5) * bin; const f = Math.abs(x1 - x0) < 1e-9 ? 0.5 : Math.min(1, Math.max(0, (xc - x0) / (x1 - x0))); const r = r0 + (r1 - r0) * f; if (r > R[i]) R[i] = r; } } } });
    return R; };
  let R = rmax(pr); const endR = (lo, hi) => Math.max(...R.slice(lo, hi));
  if (endR(N - 18, N) > endR(0, 18)) { a = v3.mul(a, -1); pr = prof(a); R = rmax(pr); }
  const mid = Array.from(R.slice(Math.floor(N * 0.35), Math.floor(N * 0.92))).filter(x => x > 0).sort((x, y) => x - y); const rs = mid.length ? mid[Math.floor(mid.length / 2)] : 0; const rh = endR(0, 18);
  if (!(rs > 0) || rh < rs * 1.25) return { verdict: 'info', note: 'No head found, so this looks like a pin, stud or set screw. Not checked.' };
  let iU = 0; while (iU < N && R[iU] > (rs + rh) / 2) iU++; let iT = iU; while (iT < N && R[iT] > rs * 1.12) iT++; const csk = (iT - iU) * bin > rs * 0.5 || (iU === 0);
  let sH = pr.s0 + (csk ? 0 : iT * bin); const sTip = pr.s1; const d = 2 * rs;
  if (!csk) { let best = -Infinity; P.forEach(q => { const dq = v3.sub(q, m); const x = v3.dot(dq, a); const r = v3.len(v3.sub(dq, v3.mul(a, x))); if (r > (rs + rh) / 2 && x < sH + 2 * bin && x > best) best = x; }); if (best > -Infinity) sH = best; }
  const nom = METRIC.reduce((b, x) => Math.abs(x[0] - d) < Math.abs(b[0] - d) ? x : b, METRIC[0]); const D = nom[0], Pt = nom[1];
  const L = sTip - (csk ? pr.s0 : sH);
  // radial scan along the axis
  let e1 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; e1 = v3.norm(v3.cross(a, e1)); const e2 = v3.cross(a, e1);
  const dirs = []; for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; dirs.push(v3.add(v3.mul(e1, Math.cos(t)), v3.mul(e2, Math.sin(t)))); }
  const lo = v3.add(m, v3.mul(a, sH)), hi = v3.add(m, v3.mul(a, sTip + 3 * D)); const bb0 = [0, 1, 2].map(i => Math.min(lo[i], hi[i]) - 2 * D), bb1 = [0, 1, 2].map(i => Math.max(lo[i], hi[i]) + 2 * D);
  const cand = others.filter(o => o.parts.some(p => [0, 1, 2].every(i => p.bmax[i] >= bb0[i] && p.bmin[i] <= bb1[i])));
  const ds = Math.max(0.1, D / 25), steps = [];
  const classify = s => { const o = v3.add(m, v3.mul(a, s)); const votes = new Map();
    dirs.forEach(dv => { let best = null; cand.forEach((c, ci) => c.parts.forEach(p => { const h = DFM.rayCast(p.bvh, o, dv, 1.2 * D, false); if (h && (!best || h.t < best.t)) best = { t: h.t, ci }; })); if (best) { const v = votes.get(best.ci) || []; v.push(best.t); votes.set(best.ci, v); } });
    let top = null; votes.forEach((v, ci) => { if (v.length >= 5 && (!top || v.length > top.v.length)) top = { ci, v }; });
    if (!top) return { s, kind: null }; const r = top.v.sort((x, y) => x - y)[Math.floor(top.v.length / 2)];
    return { s, ci: top.ci, kind: r < 0.53 * D ? 'tap' : r <= 1.0 * D ? 'clear' : null }; };
  for (let s = sH + ds / 2; s <= sTip + 3 * D; s += ds) steps.push(classify(s));
  const same = (x, y) => x.kind === y.kind && x.ci === y.ci;
  const edge = (i) => { let lo = steps[i - 1] ? steps[i - 1].s : sH, hi = steps[i].s; const ref = steps[i]; for (let k = 0; k < 8; k++) { const mid = (lo + hi) / 2; if (same(classify(mid), ref)) hi = mid; else lo = mid; } return (lo + hi) / 2; };
  const fi = steps.findIndex(x => x.kind === 'tap'); const lastClear = (() => { let j = -1; steps.forEach((x, i) => { if (x.kind === 'clear' && x.s <= sTip && (fi < 0 || i < fi)) j = i; }); return j; })();
  const clamped = [...new Set(steps.filter((x, i) => x.kind === 'clear' && x.s <= sTip && (fi < 0 || i < fi)).map(x => cand[x.ci].name))];
  const res = { size: 'M' + D, d: D, pitch: Pt, L, csk, clamped };
  if (fi < 0) { if (lastClear < 0) return Object.assign(res, { verdict: 'warn', note: 'No hole found along the screw axis. Check that the screw sits in its holes.' });
    const grip = (steps[lastClear + 1] ? edge(lastClear + 1) : steps[lastClear].s + ds / 2) - (csk ? pr.s0 : sH); const nutH = 0.8 * D; const minL = grip + nutH + 2 * Pt;
    return Object.assign(res, { kind: 'through', grip, minL, maxL: null, rec: STD_L.find(x => x >= minL - 1e-6) || null, verdict: L >= minL - 0.05 ? 'pass' : 'warn', note: `Through hole with no thread or nut in the model. Length needed with an ISO 4032 nut (${nutH.toFixed(1)} mm) plus 2 threads out.` }); }
  const tap = steps[fi], tb = cand[tap.ci]; let j = fi; while (j + 1 < steps.length && steps[j + 1].kind === 'tap' && steps[j + 1].ci === tap.ci) j++;
  const tapStart = fi > 0 ? edge(fi) : sH, tapEnd = steps[j + 1] ? edge(j + 1) : steps[j].s + ds / 2, grip = tapStart - (csk ? pr.s0 : sH), eng = Math.max(0, Math.min(sTip, tapEnd) - tapStart);
  if (tb.fastener) { const nutH = tapEnd - tapStart; const minL = grip + nutH + 2 * Pt; return Object.assign(res, { kind: 'nut', grip, eng, tapped: tb.name, minL, maxL: null, rec: STD_L.find(x => x >= minL - 1e-6) || null, verdict: L >= minL - 0.05 ? 'pass' : 'fail', note: L >= minL - 0.05 ? `Goes through the nut ${tb.name} with at least 2 threads out.` : `Needs at least 2 threads past the nut ${tb.name}.` }); }
  // blind or through tapped hole: look ahead from the tip along the axis
  const tipO = v3.add(m, v3.mul(a, sTip - 0.02)); let bottom = null; tb.parts.forEach(p => { const h = DFM.rayCast(p.bvh, tipO, a, 5 * D, false); if (h && (!bottom || h.t < bottom)) bottom = h.t; });
  const blind = bottom != null && tapEnd < sTip + 3 * D - ds;
  const minL = grip + k * D, maxL = blind ? (Math.min(tapEnd, sTip + (bottom || 0)) - (csk ? pr.s0 : sH) - 0.5) : null;
  const rec = STD_L.find(x => x >= minL - 1e-6 && (maxL == null || x <= maxL + 1e-6)) || null;
  let verdict = 'pass', note = `Thread engagement ${eng.toFixed(1)} mm in ${tb.name}.`;
  if (L < minL - 0.05) { verdict = 'fail'; note = `Too short: ${eng.toFixed(1)} mm of thread in ${tb.name}, ${(k * D).toFixed(1)} mm (${k} × d) needed.`; }
  else if (maxL != null && L > maxL + 0.05) { verdict = 'fail'; note = `Too long: the tip would hit the bottom of the blind hole in ${tb.name}.`; }
  if (!rec) note += maxL != null ? ' No standard length fits: deepen the tapped hole.' : '';
  return Object.assign(res, { kind: blind ? 'blind' : 'tapped through', grip, eng, tapped: tb.name, minL, maxL, rec, verdict, note });
}
const _onmsg = self.onmessage;
self.onmessage = (e) => {
  if (e.data.cmd !== 'bolts') return _onmsg(e);
  const { id } = e.data; const t0 = performance.now();
  try {
    const inst = e.data.inst.map(x => ({ name: x.name, fastener: !!x.fastener, parts: x.idx.map(i => parts[i]).filter(Boolean) }));
    const res = e.data.check.map(i => { try { return analyzeScrew(inst[i].parts, inst.filter((o, j) => j !== i), e.data.k || 1.5); } catch (err) { return { verdict: 'info', note: 'Could not check: ' + err.message }; } });
    self.postMessage({ id, ok: true, res, ms: performance.now() - t0 });
  } catch (err) { self.postMessage({ id, ok: false, error: String(err && err.stack || err) }); }
};
