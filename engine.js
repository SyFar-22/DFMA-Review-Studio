/* DFM Review Studio analysis engine. Pure JS, runs in browser and Node. Units: mm, degrees. */
(function (root) {
'use strict';

// ---------------- reference data ----------------
const ISO2768 = {
  // ISO 2768-1 Table 1, linear dimensions
  linRanges: [[0.5, 3], [3, 6], [6, 30], [30, 120], [120, 400], [400, 1000], [1000, 2000], [2000, 4000]],
  lin: { f: [0.05, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, null], m: [0.1, 0.1, 0.2, 0.3, 0.5, 0.8, 1.2, 2.0], c: [0.2, 0.3, 0.5, 0.8, 1.2, 2.0, 3.0, 4.0], v: [null, 0.5, 1.0, 1.5, 2.5, 4.0, 6.0, 8.0] },
  // Table 2, external radii and chamfer heights
  radRanges: [[0.5, 3], [3, 6], [6, Infinity]],
  rad: { f: [0.2, 0.5, 1], m: [0.2, 0.5, 1], c: [0.4, 1, 2], v: [0.4, 1, 2] },
  // Table 3, angular, by length of shorter leg (minutes of arc)
  angRanges: [[0, 10], [10, 50], [50, 120], [120, 400], [400, Infinity]],
  ang: { f: [60, 30, 20, 10, 5], m: [60, 30, 20, 10, 5], c: [90, 60, 30, 15, 10], v: [180, 120, 60, 30, 20] },
  // ISO 2768-2 Table 1 straightness and flatness
  geoRanges: [[0, 10], [10, 30], [30, 100], [100, 300], [300, 1000], [1000, 3000]],
  flat: { H: [0.02, 0.05, 0.1, 0.2, 0.3, 0.4], K: [0.05, 0.1, 0.2, 0.4, 0.6, 0.8], L: [0.1, 0.2, 0.4, 0.8, 1.2, 1.6] },
  // Table 2 perpendicularity, ranges <=100, 100-300, 300-1000, 1000-3000
  perpRanges: [[0, 100], [100, 300], [300, 1000], [1000, 3000]],
  perp: { H: [0.2, 0.3, 0.4, 0.5], K: [0.4, 0.6, 0.8, 1.0], L: [0.6, 1.0, 1.5, 2.0] },
  // Table 3 symmetry
  sym: { H: [0.5, 0.5, 0.5, 0.5], K: [0.6, 0.6, 0.8, 1.0], L: [0.6, 1.0, 1.5, 2.0] },
  // Table 4 circular run-out
  runout: { H: 0.1, K: 0.2, L: 0.5 },
  linFor(cls, L) { const i = this.linRanges.findIndex(r => L > r[0] - 1e-9 && L <= r[1]); return i < 0 ? (L < 0.5 ? null : null) : this.lin[cls][i]; },
  radFor(cls, L) { const i = this.radRanges.findIndex(r => L >= r[0] && L <= r[1]); return i < 0 ? null : this.rad[cls][i]; },
  angFor(cls, L) { const i = this.angRanges.findIndex(r => L > r[0] - 1e-9 && L <= r[1]); return this.ang[cls][Math.max(0, i)]; },
  flatFor(cls, L) { const i = this.geoRanges.findIndex(r => L > r[0] - 1e-9 && L <= r[1]); return this.flat[cls][Math.max(0, i)]; },
  perpFor(cls, L) { const i = this.perpRanges.findIndex(r => L > r[0] - 1e-9 && L <= r[1]); return this.perp[cls][Math.max(0, i)]; }
};


// ---------------- ISO 286 limits and fits (sizes up to 500 mm, deviations in µm) ----------------
const ISO286 = (() => {
  const MAIN = [3, 6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500];
  const SUB = [3, 6, 10, 14, 18, 24, 30, 40, 50, 65, 80, 100, 120, 140, 160, 180, 200, 225, 250, 280, 315, 355, 400, 450, 500];
  const IT = {
    1: [0.8, 1, 1, 1.2, 1.5, 1.5, 2, 2.5, 3.5, 4.5, 6, 7, 8], 2: [1.2, 1.5, 1.5, 2, 2.5, 2.5, 3, 4, 5, 7, 8, 9, 10],
    3: [2, 2.5, 2.5, 3, 4, 4, 5, 6, 8, 10, 12, 13, 15], 4: [3, 4, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20],
    5: [4, 5, 6, 8, 9, 11, 13, 15, 18, 20, 23, 25, 27], 6: [6, 8, 9, 11, 13, 16, 19, 22, 25, 29, 32, 36, 40],
    7: [10, 12, 15, 18, 21, 25, 30, 35, 40, 46, 52, 57, 63], 8: [14, 18, 22, 27, 33, 39, 46, 54, 63, 72, 81, 89, 97],
    9: [25, 30, 36, 43, 52, 62, 74, 87, 100, 115, 130, 140, 155], 10: [40, 48, 58, 70, 84, 100, 120, 140, 160, 185, 210, 230, 250],
    11: [60, 75, 90, 110, 130, 160, 190, 220, 250, 290, 320, 360, 400], 12: [100, 120, 150, 180, 210, 250, 300, 350, 400, 460, 520, 570, 630],
    13: [140, 180, 220, 270, 330, 390, 460, 540, 630, 720, 810, 890, 970], 14: [250, 300, 360, 430, 520, 620, 740, 870, 1000, 1150, 1300, 1400, 1550],
    15: [400, 480, 580, 700, 840, 1000, 1200, 1400, 1600, 1850, 2100, 2300, 2500], 16: [600, 750, 900, 1100, 1300, 1600, 1900, 2200, 2500, 2900, 3200, 3600, 4000]
  };
  // shaft upper deviation es (a..h)
  const ES = {
    c: { sub: [-60, -70, -80, -95, -95, -110, -110, -120, -130, -140, -150, -170, -180, -200, -210, -230, -240, -260, -280, -300, -330, -360, -400, -440, -480] },
    d: { main: [-20, -30, -40, -50, -65, -80, -100, -120, -145, -170, -190, -210, -230] },
    e: { main: [-14, -20, -25, -32, -40, -50, -60, -72, -85, -100, -110, -125, -135] },
    f: { main: [-6, -10, -13, -16, -20, -25, -30, -36, -43, -50, -56, -62, -68] },
    g: { main: [-2, -4, -5, -6, -7, -9, -10, -12, -14, -15, -17, -18, -20] },
    h: { main: new Array(13).fill(0) }
  };
  // shaft lower deviation ei (k..u)
  const EI = {
    k: { main: [0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5] },
    m: { main: [2, 4, 6, 7, 8, 9, 11, 13, 15, 17, 20, 21, 23] },
    n: { main: [4, 8, 10, 12, 15, 17, 20, 23, 27, 31, 34, 37, 40] },
    p: { main: [6, 12, 15, 18, 22, 26, 32, 37, 43, 50, 56, 62, 68] },
    r: { sub: [10, 15, 19, 23, 23, 28, 28, 34, 34, 41, 43, 51, 54, 63, 65, 68, 77, 80, 84, 94, 98, 108, 114, 126, 132] },
    s: { sub: [14, 19, 23, 28, 28, 35, 35, 43, 43, 53, 59, 71, 79, 92, 100, 108, 122, 130, 140, 158, 170, 190, 208, 232, 252] },
    t: { sub: [null, null, null, null, null, null, 41, 48, 54, 66, 75, 91, 104, 122, 134, 146, 166, 180, 196, 218, 240, 268, 294, 330, 360] },
    u: { sub: [18, 23, 28, 33, 33, 41, 48, 60, 70, 87, 102, 124, 144, 170, 190, 210, 236, 258, 284, 315, 350, 390, 435, 490, 540] }
  };
  // delta for holes K..ZC, columns IT3..IT8
  const DELTA = [[0, 0, 0, 0, 0, 0], [1, 1.5, 1, 3, 4, 6], [1, 1.5, 2, 3, 6, 7], [1, 2, 3, 3, 7, 9], [1.5, 2, 3, 4, 8, 12], [1.5, 3, 4, 5, 9, 14], [2, 3, 5, 6, 11, 16], [2, 4, 5, 7, 13, 19], [3, 4, 6, 7, 15, 23], [3, 4, 6, 9, 17, 26], [4, 4, 7, 9, 20, 29], [4, 5, 7, 11, 21, 32], [5, 5, 7, 13, 23, 34]];
  const mi = D => MAIN.findIndex(u => D <= u), si = D => SUB.findIndex(u => D <= u);
  const val = (t, D) => t.main ? t.main[mi(D)] : t.sub[si(D)];
  function it(grade, D) { if (!(D > 0) || D > 500) return null; return IT[grade] ? IT[grade][mi(D)] : null; }
  function shaft(letter, grade, D) {
    const T = it(grade, D); if (T == null) return null; letter = letter.toLowerCase();
    if (letter === 'js') return { upper: T / 2, lower: -T / 2 };
    if (ES[letter]) { const es = val(ES[letter], D); return es == null ? null : { upper: es, lower: es - T }; }
    if (letter === 'k') { const ei = grade >= 4 && grade <= 7 ? val(EI.k, D) : 0; return { upper: ei + T, lower: ei }; }
    if (EI[letter]) { const ei = val(EI[letter], D); return ei == null ? null : { upper: ei + T, lower: ei }; }
    return null;
  }
  function hole(letter, grade, D) {
    const T = it(grade, D); if (T == null) return null; const L = letter.toUpperCase(), l = letter.toLowerCase();
    const d = (grade >= 3 && grade <= 8) ? DELTA[mi(D)][grade - 3] : 0;
    if (L === 'JS') return { upper: T / 2, lower: -T / 2 };
    if (ES[l]) { const EIh = -val(ES[l], D); return { upper: EIh + T, lower: EIh }; }
    let ESh;
    if (L === 'K') ESh = grade <= 8 ? -val(EI.k, D) + d : 0;
    else if (L === 'M') ESh = grade <= 8 ? -val(EI.m, D) + d : -val(EI.m, D);
    else if (L === 'N') ESh = grade <= 8 ? -val(EI.n, D) + d : (D <= 3 ? -4 : 0);
    else if (EI[l]) { const ei = val(EI[l], D); if (ei == null) return null; ESh = grade <= 7 ? -ei + d : -ei; }
    else return null;
    return { upper: ESh, lower: ESh - T };
  }
  function fit(D, h, s) { // h = {l, g}, s = {l, g}
    const H = hole(h.l, h.g, D), S = shaft(s.l, s.g, D); if (!H || !S) return null;
    const maxC = H.upper - S.lower, minC = H.lower - S.upper;
    return { hole: H, shaft: S, maxC, minC, type: minC >= 0 ? 'clearance' : maxC <= 0 ? 'interference' : 'transition' };
  }
  const PREFERRED = [
    ['H11', 'c11', 'Loose running', 'Wide commercial tolerances, or allowances on external members such as hinges and agricultural linkages.'],
    ['H9', 'd9', 'Free running', 'Not for accuracy. Good for large temperature variations, high running speeds or heavy journal pressures.'],
    ['H8', 'f7', 'Close running', 'Running on accurate machines and accurate location at moderate speeds and journal pressures, e.g. spindle bearings.'],
    ['H7', 'g6', 'Sliding', 'Not meant to run freely, but parts move and turn freely and locate accurately, e.g. guide pins and pistons.'],
    ['H7', 'h6', 'Locational clearance', 'Snug fit for locating stationary parts that can still be assembled and taken apart freely.'],
    ['H7', 'k6', 'Locational transition', 'Accurate location, a compromise between clearance and interference. Light press or tap to assemble.'],
    ['H7', 'n6', 'Locational transition', 'More accurate location where greater interference is allowed. Light press to assemble.'],
    ['H7', 'p6', 'Locational interference', 'Rigid, aligned location without special bore pressure. Press fit, can be taken apart.'],
    ['H7', 's6', 'Medium drive', 'Ordinary steel parts or shrink fits on light sections. Tightest fit usable with cast iron.'],
    ['H7', 'u6', 'Force', 'Highly stressed parts, or shrink fits where heavy pressing forces are impractical.']
  ];
  const PROCESS_IT = [[5, 6, 'Grinding, honing, lapping'], [7, 7, 'Reaming, precision boring, fine turning'], [8, 9, 'Turning, milling, boring'], [10, 11, 'Drilling, rough milling, punching'], [12, 16, 'Casting, forging, flame cutting']];
  return { MAIN, IT, it, shaft, hole, fit, PREFERRED, PROCESS_IT, SHAFT_LETTERS: ['c', 'd', 'e', 'f', 'g', 'h', 'js', 'k', 'm', 'n', 'p', 'r', 's', 't', 'u'], HOLE_LETTERS: ['C', 'D', 'E', 'F', 'G', 'H', 'JS', 'K', 'M', 'N', 'P', 'R', 'S', 'T', 'U'] };
})();

// ISO 261 / ISO 2306 coarse thread tap drills and ISO 273 clearance holes (medium)
const THREADS = [
  ['M1.6', 1.6, 0.35, 1.25, 1.8], ['M2', 2, 0.4, 1.6, 2.4], ['M2.5', 2.5, 0.45, 2.05, 2.9], ['M3', 3, 0.5, 2.5, 3.4],
  ['M3.5', 3.5, 0.6, 2.9, 3.9], ['M4', 4, 0.7, 3.3, 4.5], ['M5', 5, 0.8, 4.2, 5.5], ['M6', 6, 1.0, 5.0, 6.6],
  ['M8', 8, 1.25, 6.8, 9.0], ['M10', 10, 1.5, 8.5, 11], ['M12', 12, 1.75, 10.2, 13.5], ['M14', 14, 2.0, 12, 15.5],
  ['M16', 16, 2.0, 14, 17.5], ['M20', 20, 2.5, 17.5, 22], ['M24', 24, 3.0, 21, 26]
].map(([n, d, p, tap, clr]) => ({ n, d, p, tap, clr }));

// metals carry their EN 10027-2 material number (Werkstoffnummer); mach = machining time relative to aluminium 6061
const MATERIALS = {
  // Group 3: light metals
  al6061: { n: 'Aluminium 6061-T6', wnr: '3.3211', en: 'EN AW-6061 (AlMg1SiCu)', grp: '3', rho: 2.70, metal: true, mach: 1 },
  al6082: { n: 'Aluminium 6082-T6', wnr: '3.2315', en: 'EN AW-6082 (AlSi1MgMn)', grp: '3', rho: 2.70, metal: true, mach: 1 },
  al5083: { n: 'Aluminium 5083-H111', wnr: '3.3547', en: 'EN AW-5083 (AlMg4.5Mn0.7)', grp: '3', rho: 2.66, metal: true, mach: 1 },
  al2024: { n: 'Aluminium 2024-T351', wnr: '3.1355', en: 'EN AW-2024 (AlCu4Mg1)', grp: '3', rho: 2.78, metal: true, mach: 1.1 },
  al2007: { n: 'Aluminium 2007 free-cutting', wnr: '3.1645', en: 'EN AW-2007 (AlCuMgPb)', grp: '3', rho: 2.85, metal: true, mach: 0.9 },
  al7075: { n: 'Aluminium 7075-T6', wnr: '3.4365', en: 'EN AW-7075 (AlZn5.5MgCu)', grp: '3', rho: 2.81, metal: true, mach: 1.1 },
  al1050: { n: 'Aluminium 1050A pure', wnr: '3.0255', en: 'EN AW-1050A (Al99.5)', grp: '3', rho: 2.70, metal: true, mach: 1.2 },
  az31: { n: 'Magnesium AZ31', wnr: '3.5312', en: 'MgAl3Zn1', grp: '3', rho: 1.78, metal: true, mach: 0.8 },
  tigr2: { n: 'Titanium Grade 2', wnr: '3.7035', en: 'Ti99.5 (CP Grade 2)', grp: '3', rho: 4.51, metal: true, mach: 3.5 },
  ti64: { n: 'Titanium Ti-6Al-4V (Grade 5)', wnr: '3.7165', en: 'TiAl6V4', grp: '3', rho: 4.43, metal: true, mach: 4 },
  // Group 1: steels
  s235: { n: 'Structural steel S235JR', wnr: '1.0038', en: 'S235JR', grp: '1', rho: 7.85, metal: true, mach: 1.6 },
  s355: { n: 'Structural steel S355J2', wnr: '1.0577', en: 'S355J2', grp: '1', rho: 7.85, metal: true, mach: 1.7 },
  s1045: { n: 'Carbon steel C45 (AISI 1045)', wnr: '1.0503', en: 'C45', grp: '1', rho: 7.85, metal: true, mach: 1.8 },
  s12l14: { n: 'Free-cutting steel 11SMnPb30 (12L14)', wnr: '1.0718', en: '11SMnPb30', grp: '1', rho: 7.85, metal: true, mach: 1.2 },
  s4140: { n: 'Alloy steel 42CrMo4 (AISI 4140)', wnr: '1.7225', en: '42CrMo4', grp: '1', rho: 7.85, metal: true, mach: 2.2 },
  s16mncr5: { n: 'Case-hardening steel 16MnCr5', wnr: '1.7131', en: '16MnCr5', grp: '1', rho: 7.85, metal: true, mach: 2.0 },
  s4340: { n: 'Alloy steel 34CrNiMo6 (AISI 4340)', wnr: '1.6582', en: '34CrNiMo6', grp: '1', rho: 7.85, metal: true, mach: 2.4 },
  s100cr6: { n: 'Bearing steel 100Cr6 (AISI 52100)', wnr: '1.3505', en: '100Cr6', grp: '1', rho: 7.83, metal: true, mach: 2.5 },
  d2: { n: 'Tool steel X153CrMoV12 (D2)', wnr: '1.2379', en: 'X153CrMoV12', grp: '1', rho: 7.70, metal: true, mach: 3.0 },
  p20: { n: 'Mould steel 40CrMnMoS8-6 (P20+S)', wnr: '1.2312', en: '40CrMnMoS8-6', grp: '1', rho: 7.85, metal: true, mach: 2.0 },
  o2: { n: 'Tool steel 90MnCrV8 (O2)', wnr: '1.2842', en: '90MnCrV8', grp: '1', rho: 7.85, metal: true, mach: 2.2 },
  m2: { n: 'High-speed steel HS6-5-2 (M2)', wnr: '1.3343', en: 'HS6-5-2', grp: '1', rho: 8.10, metal: true, mach: 3.5 },
  ss303: { n: 'Stainless 303', wnr: '1.4305', en: 'X8CrNiS18-9', grp: '1', rho: 7.90, metal: true, mach: 1.6 },
  ss304: { n: 'Stainless 304', wnr: '1.4301', en: 'X5CrNi18-10', grp: '1', rho: 7.90, metal: true, mach: 2.2 },
  ss316: { n: 'Stainless 316L', wnr: '1.4404', en: 'X2CrNiMo17-12-2', grp: '1', rho: 8.00, metal: true, mach: 2.4 },
  ss431: { n: 'Stainless 431', wnr: '1.4057', en: 'X17CrNi16-2', grp: '1', rho: 7.70, metal: true, mach: 2.3 },
  ss174: { n: 'Stainless 17-4 PH', wnr: '1.4542', en: 'X5CrNiCuNb16-4', grp: '1', rho: 7.80, metal: true, mach: 2.6 },
  ss2205: { n: 'Duplex stainless 2205', wnr: '1.4462', en: 'X2CrNiMoN22-5-3', grp: '1', rho: 7.80, metal: true, mach: 3.0 },
  ss314: { n: 'Heat-resisting steel 314', wnr: '1.4841', en: 'X15CrNiSi25-21', grp: '1', rho: 7.90, metal: true, mach: 3.0 },
  // Group 0: cast irons (machined from cast bar)
  gjl250: { n: 'Grey cast iron EN-GJL-250', wnr: '0.6025', en: 'EN-GJL-250 (GG25)', grp: '0', rho: 7.20, metal: true, mach: 1.3 },
  gjs400: { n: 'Ductile iron EN-GJS-400-15', wnr: '0.7040', en: 'EN-GJS-400-15 (GGG40)', grp: '0', rho: 7.10, metal: true, mach: 1.5 },
  // Group 2: heavy non-ferrous metals
  brass: { n: 'Brass CW614N', wnr: '2.0401', en: 'CuZn39Pb3', grp: '2', rho: 8.47, metal: true, mach: 0.8 },
  cuetp: { n: 'Copper Cu-ETP', wnr: '2.0060', en: 'Cu-ETP (CW004A)', grp: '2', rho: 8.94, metal: true, mach: 1.8 },
  cusn8: { n: 'Phosphor bronze CuSn8', wnr: '2.1030', en: 'CuSn8 (CW453K)', grp: '2', rho: 8.80, metal: true, mach: 1.4 },
  albronze: { n: 'Aluminium bronze CuAl10Ni5Fe4', wnr: '2.0966', en: 'CuAl10Ni5Fe4 (CW307G)', grp: '2', rho: 7.60, metal: true, mach: 2.0 },
  monel: { n: 'Monel 400', wnr: '2.4360', en: 'NiCu30Fe', grp: '2', rho: 8.80, metal: true, mach: 4 },
  in600: { n: 'Inconel 600', wnr: '2.4816', en: 'NiCr15Fe', grp: '2', rho: 8.47, metal: true, mach: 5 },
  in718: { n: 'Inconel 718', wnr: '2.4668', en: 'NiCr19Fe19Nb5Mo3', grp: '2', rho: 8.19, metal: true, mach: 6 },
  // Plastics (no material number)
  pom: { n: 'POM-C (Delrin, acetal)', grp: 'P', rho: 1.41, metal: false, mach: 0.9 },
  pa6: { n: 'Nylon PA6', grp: 'P', rho: 1.14, metal: false, mach: 1 },
  pa66: { n: 'Nylon PA66', grp: 'P', rho: 1.14, metal: false, mach: 1 },
  peek: { n: 'PEEK', grp: 'P', rho: 1.31, metal: false, mach: 1.5 },
  pei: { n: 'PEI (Ultem)', grp: 'P', rho: 1.27, metal: false, mach: 1.4 },
  ptfe: { n: 'PTFE (Teflon)', grp: 'P', rho: 2.17, metal: false, mach: 1.2 },
  uhmw: { n: 'PE-UHMW', grp: 'P', rho: 0.93, metal: false, mach: 1.1 },
  pc: { n: 'Polycarbonate PC', grp: 'P', rho: 1.20, metal: false, mach: 1 },
  pmma: { n: 'Acrylic PMMA', grp: 'P', rho: 1.19, metal: false, mach: 1 },
  abs: { n: 'ABS', grp: 'P', rho: 1.04, metal: false, mach: 0.9 },
  pp: { n: 'Polypropylene PP', grp: 'P', rho: 0.91, metal: false, mach: 1.1 },
  pvc: { n: 'PVC rigid', grp: 'P', rho: 1.40, metal: false, mach: 1 }
};

const AM = {
  fdm: { n: 'FDM / FFF', fam: 'Material extrusion', env: [250, 210, 210], wall: [0.8, 1.2], hole: [2, 3], ovh: 45, tol: [0.5, 0.005], rho: 1.24, iso: 'v', drain: false, rate: 15 },
  sla: { n: 'SLA resin', fam: 'Vat photopolymerisation', env: [200, 125, 210], wall: [0.5, 1.0], hole: [0.5, 1], ovh: 60, tol: [0.15, 0.0015], rho: 1.18, iso: 'm', drain: true, rate: 12 },
  dlp: { n: 'DLP resin', fam: 'Vat photopolymerisation', env: [144, 81, 200], wall: [0.5, 1.0], hole: [0.5, 1], ovh: 60, tol: [0.1, 0.002], rho: 1.18, iso: 'm', drain: true, rate: 20 },
  lcd: { n: 'MSLA / LCD resin', fam: 'Vat photopolymerisation', env: [218, 123, 250], wall: [0.5, 1.0], hole: [0.5, 1], ovh: 60, tol: [0.1, 0.002], rho: 1.18, iso: 'm', drain: true, rate: 20 },
  dls: { n: 'Carbon DLS / CLIP', fam: 'Vat photopolymerisation', env: [189, 118, 326], wall: [0.5, 1.0], hole: [0.5, 1], ovh: 60, tol: [0.1, 0.002], rho: 1.1, iso: 'm', drain: true, rate: 60 },
  sls: { n: 'SLS nylon', fam: 'Powder bed fusion (polymer)', env: [340, 340, 600], wall: [0.7, 1.0], hole: [1.5, 2], ovh: null, tol: [0.3, 0.003], rho: 1.01, iso: 'c', drain: true, rate: 40 },
  mjf: { n: 'HP Multi Jet Fusion', fam: 'Powder bed fusion (polymer)', env: [380, 284, 380], wall: [0.5, 1.0], hole: [1, 1.5], ovh: null, tol: [0.3, 0.003], rho: 1.01, iso: 'c', drain: true, rate: 80 },
  pj: { n: 'PolyJet / material jetting', fam: 'Material jetting', env: [490, 390, 200], wall: [0.6, 1.0], hole: [0.5, 1], ovh: null, tol: [0.1, 0.002], rho: 1.17, iso: 'm', drain: true, rate: 15 },
  dmls: { n: 'DMLS / SLM metal (laser powder bed)', fam: 'Powder bed fusion (metal)', env: [250, 250, 325], wall: [0.4, 1.0], hole: [1, 1.5], ovh: 45, tol: [0.1, 0.002], rho: 2.67, iso: 'm', drain: true, rate: 8 },
  ebm: { n: 'EBM metal (electron beam)', fam: 'Powder bed fusion (metal)', env: [200, 200, 380], wall: [0.8, 1.5], hole: [1.5, 2], ovh: 45, tol: [0.3, 0.003], rho: 4.43, iso: 'c', drain: true, rate: 30 },
  bjm: { n: 'Metal binder jetting', fam: 'Binder jetting', env: [400, 250, 250], wall: [1.0, 2.0], hole: [1, 1.5], ovh: 45, tol: [0.2, 0.01], rho: 7.9, iso: 'c', drain: true, rate: 150 },
  mfff: { n: 'Metal FFF (bound metal)', fam: 'Material extrusion (metal)', env: [300, 200, 200], wall: [1.0, 2.0], hole: [1.5, 2], ovh: 45, tol: [0.3, 0.015], rho: 7.7, iso: 'c', drain: false, rate: 10 },
  ded: { n: 'DED / WAAM metal deposition', fam: 'Directed energy deposition', env: [1000, 1000, 1000], wall: [2, 4], hole: [5, 8], ovh: 30, tol: [1.0, 0.005], rho: 7.9, iso: 'v', drain: false, rate: 400 },
  ceram: { n: 'Ceramic (LCM / SLA)', fam: 'Vat photopolymerisation (ceramic)', env: [76, 43, 150], wall: [0.3, 0.6], hole: [0.5, 1], ovh: 60, tol: [0.05, 0.002], rho: 3.9, iso: 'm', drain: true, rate: 5 }
};
const AM_MATS_EXTRA = {
  fdm: [['pa', 'Nylon PA', 1.14, 'Tough and wear resistant. Absorbs moisture, so dry the filament.'], ['pacf', 'Nylon carbon fibre (PA-CF)', 1.2, 'Stiff, light and dimensionally stable. Good for jigs and fixtures.'], ['pc', 'Polycarbonate PC', 1.2, 'Strong and heat resistant to about 110 °C. Needs a hot enclosed printer.'], ['tpu', 'TPU 95A flexible', 1.21, 'Rubber-like, for seals, grips and bumpers. Print slowly.'], ['pp', 'Polypropylene PP', 0.9, 'Chemical resistant and good for living hinges. Hard to stick to the bed.'], ['pei', 'ULTEM 9085 (PEI)', 1.34, 'Flame retardant, aerospace grade. Industrial printers only.'], ['peek', 'PEEK', 1.31, 'High strength to about 250 °C. Industrial printers only.']],
  dlp: [['std', 'Standard resin', 1.18, 'Fine detail, brittle. Form and fit models.'], ['tough', 'Tough resin', 1.17, 'Snap fits and moderate loads.'], ['cast', 'Castable resin', 1.15, 'Burns out cleanly for investment casting patterns.'], ['bio', 'Biocompatible resin', 1.2, 'Dental and medical guides. Check the certification.']],
  lcd: [['std', 'Standard resin', 1.18, 'Fine detail, brittle. Form and fit models.'], ['tough', 'ABS-like tough resin', 1.17, 'Takes snap fits and moderate loads.'], ['flex', 'Flexible resin', 1.15, 'Rubber-like parts and grips.'], ['water', 'Water-washable resin', 1.15, 'Easy cleaning, slightly lower strength.']],
  dls: [['rpu', 'RPU 70 rigid polyurethane', 1.06, 'Tough and stiff, like ABS.'], ['epu', 'EPU 40 elastomer', 1.02, 'Soft, for cushions, seals and lattices.'], ['epx', 'EPX 82 epoxy', 1.21, 'Strong and heat resistant, like glass-filled nylon.'], ['ce', 'CE 221 cyanate ester', 1.3, 'Very high heat resistance, about 230 °C.']],
  pj: [['vero', 'Vero rigid (opaque or clear)', 1.17, 'Full colour and clear prototypes. Brittle.'], ['agilus', 'Agilus30 rubber-like', 1.15, 'Soft-touch overmould prototypes.'], ['dabs', 'Digital ABS', 1.17, 'Tougher, ABS-like prototypes.']],
  ebm: [['ti64', 'Titanium Ti-6Al-4V', 4.43, 'Implants and aerospace. Rougher surface than laser powder bed.'], ['tigr2', 'Titanium Grade 2', 4.51, 'Pure titanium, very corrosion resistant.'], ['cocr', 'Cobalt chrome', 8.3, 'Wear resistant, medical implants.']],
  bjm: [['316l', 'Stainless 316L', 7.95, 'Sintered after printing; shrinks about 20 %, which the file is scaled for.'], ['174ph', 'Stainless 17-4 PH', 7.75, 'Heat treatable for strength.'], ['304l', 'Stainless 304L', 7.9, 'General corrosion resistant parts.'], ['cu', 'Copper', 8.9, 'Heat sinks and electrical parts.'], ['4140', 'Low-alloy steel 4140', 7.85, 'Heat treatable for tools and wear parts.']],
  mfff: [['174ph', 'Stainless 17-4 PH', 7.6, 'Printed, washed and sintered. Slight porosity.'], ['316l', 'Stainless 316L', 7.9, 'Corrosion resistant fixtures.'], ['h13', 'Tool steel H13', 7.7, 'Hot-work tools and inserts.'], ['cu', 'Copper', 8.9, 'Thermal and electrical parts.']],
  ded: [['ti64', 'Titanium Ti-6Al-4V', 4.43, 'Large aerospace near-net shapes, then machined.'], ['in625', 'Inconel 625', 8.44, 'Repair and cladding, high-temperature parts.'], ['316l', 'Stainless 316L', 7.99, 'Large corrosion resistant parts.'], ['h13', 'Tool steel H13', 7.8, 'Die repair and tooling.'], ['er70', 'Mild steel ER70S-6 (WAAM)', 7.85, 'Large structural parts by wire arc.']],
  ceram: [['al2o3', 'Alumina Al2O3', 3.9, 'Hard, electrically insulating, wear resistant.'], ['zro2', 'Zirconia ZrO2', 6.0, 'Tough ceramic for wear and medical parts.'], ['si3n4', 'Silicon nitride', 3.2, 'Thermal shock resistant.']]
};
const AM_MATS = {
  fdm: [['pla', 'PLA', 1.24, 'Stiff and easy to print. Softens at about 55 to 60 °C, so not for warm or loaded parts.'], ['petg', 'PETG', 1.27, 'Tougher than PLA, good chemical resistance, works to about 75 °C.'], ['abs', 'ABS', 1.04, 'Impact resistant to about 95 °C. Warps on large flat parts; needs an enclosed printer.'], ['asa', 'ASA', 1.07, 'Like ABS but UV stable. Good for outdoor parts.'], ['pc', 'Polycarbonate', 1.2, 'Strong and heat resistant. Needs a hot enclosed printer; warps easily.'], ['pacf', 'Nylon PA12 carbon fibre', 1.15, 'Stiff and light for brackets and jigs. Anisotropic: weaker between layers.'], ['tpu', 'TPU 95A (flexible)', 1.21, 'Rubber-like. Use thicker walls and larger holes; fine details print poorly.', 1.5]],
  sla: [['std', 'Standard resin', 1.18, 'Fine detail and smooth surface, but brittle. For form and fit models.'], ['tough', 'Tough resin (ABS-like)', 1.17, 'Takes snap fits and moderate loads.'], ['rigid', 'Rigid glass-filled resin', 1.65, 'Very stiff and dimensionally stable, but brittle in impact.'], ['ht', 'High temperature resin', 1.25, 'For hot air, fluid and moulding inserts. Brittle.'], ['flex', 'Flexible 80A resin', 1.1, 'Soft and rubber-like. Walls need to be thicker.', 1.5], ['clear', 'Clear resin', 1.18, 'Transparent after polishing. Same limits as standard resin.']],
  sls: [['pa12', 'PA12 nylon', 1.01, 'All-round engineering plastic. Good for functional parts and snap fits.'], ['pa11', 'PA11 nylon', 1.04, 'More ductile and impact resistant than PA12.'], ['pa12gf', 'PA12 glass-filled', 1.22, 'Stiffer and more heat resistant, less ductile.'], ['tpu', 'TPU 88A', 1.1, 'Flexible, for seals and grips. Thicker walls needed.', 1.5]],
  mjf: [['pa12', 'PA12 nylon', 1.01, 'All-round engineering plastic with good isotropy.'], ['pa11', 'PA11 nylon', 1.05, 'More ductile, good for living hinges and clips.'], ['pa12gb', 'PA12 glass beads', 1.3, 'Stiff and dimensionally stable.'], ['pp', 'Polypropylene', 0.89, 'Chemical resistant and watertight. Lower stiffness.'], ['tpu', 'TPU 01', 1.1, 'Flexible. Thicker walls needed.', 1.5]],
  dmls: [['alsi10mg', 'AlSi10Mg aluminium', 2.67, 'Light, good thermal conductivity. Stress relief after printing.'], ['316l', 'Stainless 316L', 7.99, 'Corrosion resistant, ductile.'], ['174ph', 'Stainless 17-4 PH', 7.8, 'Can be heat treated for high strength.'], ['ti64', 'Titanium Ti-6Al-4V', 4.43, 'High strength to weight, biocompatible. Expensive.'], ['in718', 'Inconel 718', 8.19, 'High temperature strength. Slow and costly to machine after printing.'], ['ms1', 'Maraging steel MS1', 8.0, 'Tooling and inserts; very high strength after ageing.']]
};Object.assign(AM_MATS, Object.fromEntries(Object.entries(AM_MATS_EXTRA).filter(([k]) => !AM_MATS[k])));
AM_MATS.fdm = AM_MATS.fdm.concat(AM_MATS_EXTRA.fdm);
AM_MATS.dmls = AM_MATS.dmls.concat([['ms1', 'Maraging steel 1.2709', 8.1, 'Very hard after ageing. Moulds and tooling inserts.'], ['cocr', 'Cobalt chrome', 8.3, 'Wear resistant, dental and medical.'], ['in625', 'Inconel 625', 8.44, 'Corrosion and heat resistant.'], ['cucrzr', 'Copper CuCrZr', 8.9, 'Heat exchangers and induction coils.']]);
AM_MATS.sls = AM_MATS.sls.concat([['pa12cf', 'PA12 carbon-filled', 1.05, 'Stiff and light.'], ['pp', 'Polypropylene', 0.9, 'Chemical resistant, watertight.']]);

const CAST_ALLOYS = {
  sand: [['a356', 'Aluminium A356-T6', 2.68, 4], ['grey', 'Grey iron EN-GJL-250', 7.15, 3], ['ductile', 'Ductile iron EN-GJS-500-7', 7.1, 3.5], ['steel', 'Cast carbon steel', 7.85, 5], ['bronze', 'Tin bronze', 8.8, 4]],
  inv: [['a356', 'Aluminium A356', 2.68, 2], ['174ph', 'Stainless 17-4 PH', 7.8, 1.5], ['316', 'Stainless 316', 8.0, 1.5], ['steel', 'Carbon steel', 7.85, 2], ['bronze', 'Bronze', 8.8, 2]],
  die: [['a380', 'Aluminium A380', 2.71, 1.5], ['adc12', 'Aluminium ADC12', 2.7, 1.5], ['az91', 'Magnesium AZ91D', 1.81, 1.0], ['zamak3', 'Zinc Zamak 3', 6.6, 0.8]]
};
const CAST = {
  sand: { n: 'Sand casting', env: [1500, 1000, 800], wall: 4, draft: [0.5, 1.0], core: 6, iso: 'v', capL: L => 0.5 + 0.01 * L },
  inv: { n: 'Investment casting', env: [750, 500, 500], wall: 2, draft: [0, 0.5], core: 2, iso: 'c', capL: L => 0.1 + 0.003 * L },
  die: { n: 'High pressure die casting', env: [600, 500, 300], wall: 1.5, draft: [0.5, 1.0], core: 2.5, iso: 'm', capL: L => 0.08 + 0.002 * L }
};
const CNC = {
  cnc3: { n: 'CNC 3-axis VMC', env: [1000, 600, 500], ld: [4, 6], iso: 'f' },
  cnc4: { n: 'CNC multi-axis (3+2)', env: [800, 500, 500], ld: [5, 8], iso: 'f' },
  cnc5: { n: 'CNC 5-axis', env: [650, 650, 500], ld: [6, 10], iso: 'f' }
};

// ---------------- vector helpers ----------------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const DEG = Math.PI / 180;

// ---------------- BVH ----------------
function buildBVH(TP, nT) {
  const idx = new Uint32Array(nT); for (let i = 0; i < nT; i++) idx[i] = i;
  const cen = new Float32Array(nT * 3), mn = new Float32Array(nT * 3), mx = new Float32Array(nT * 3);
  for (let i = 0; i < nT; i++) for (let d = 0; d < 3; d++) {
    const a = TP[i * 9 + d], b = TP[i * 9 + 3 + d], c = TP[i * 9 + 6 + d];
    mn[i * 3 + d] = Math.min(a, b, c); mx[i * 3 + d] = Math.max(a, b, c); cen[i * 3 + d] = (a + b + c) / 3;
  }
  const nodes = []; // {bmin,bmax,left,right,start,count}
  function build(s, e) {
    const bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
    const cmin = [Infinity, Infinity, Infinity], cmax = [-Infinity, -Infinity, -Infinity];
    for (let k = s; k < e; k++) { const t = idx[k]; for (let d = 0; d < 3; d++) { bmin[d] = Math.min(bmin[d], mn[t * 3 + d]); bmax[d] = Math.max(bmax[d], mx[t * 3 + d]); cmin[d] = Math.min(cmin[d], cen[t * 3 + d]); cmax[d] = Math.max(cmax[d], cen[t * 3 + d]); } }
    const node = { bmin, bmax, left: -1, right: -1, start: s, count: e - s }; const id = nodes.length; nodes.push(node);
    if (e - s <= 4) return id;
    let ax = 0; for (let d = 1; d < 3; d++) if (cmax[d] - cmin[d] > cmax[ax] - cmin[ax]) ax = d;
    if (cmax[ax] - cmin[ax] < 1e-12) return id;
    const sub = Array.from(idx.subarray(s, e)).sort((a, b) => cen[a * 3 + ax] - cen[b * 3 + ax]);
    idx.set(sub, s); const m = (s + e) >> 1;
    node.left = build(s, m); node.right = build(m, e); node.count = 0; return id;
  }
  build(0, nT);
  // flatten
  const N = nodes.length, B = new Float32Array(N * 6), L = new Int32Array(N), R = new Int32Array(N), S = new Int32Array(N), C = new Int32Array(N);
  nodes.forEach((n, i) => { B.set([...n.bmin, ...n.bmax], i * 6); L[i] = n.left; R[i] = n.right; S[i] = n.start; C[i] = n.count; });
  return { B, L, R, S, C, idx, TP };
}
// returns {t, tri} of nearest hit, or null. skip: triangle index to ignore
function rayCast(bvh, o, d, tmax, any, skip) {
  const { B, L, R, S, C, idx, TP } = bvh; const inv = [1 / d[0], 1 / d[1], 1 / d[2]];
  const stack = [0]; let best = tmax, bestTri = -1;
  while (stack.length) {
    const n = stack.pop(); const b = n * 6;
    let t0 = 0, t1 = best;
    for (let a = 0; a < 3; a++) {
      let ta = (B[b + a] - o[a]) * inv[a], tb = (B[b + 3 + a] - o[a]) * inv[a];
      if (ta > tb) { const x = ta; ta = tb; tb = x; }
      if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) break;
    }
    if (t0 > t1) continue;
    if (C[n] > 0) {
      for (let k = S[n]; k < S[n] + C[n]; k++) {
        const t = idx[k]; if (t === skip) continue; const p = t * 9;
        const e1x = TP[p + 3] - TP[p], e1y = TP[p + 4] - TP[p + 1], e1z = TP[p + 5] - TP[p + 2];
        const e2x = TP[p + 6] - TP[p], e2y = TP[p + 7] - TP[p + 1], e2z = TP[p + 8] - TP[p + 2];
        const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
        const det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-14) continue;
        const id = 1 / det, tx = o[0] - TP[p], ty = o[1] - TP[p + 1], tz = o[2] - TP[p + 2];
        const u = (tx * px + ty * py + tz * pz) * id; if (u < -1e-7 || u > 1 + 1e-7) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const v = (d[0] * qx + d[1] * qy + d[2] * qz) * id; if (v < -1e-7 || u + v > 1 + 1e-7) continue;
        const tt = (e2x * qx + e2y * qy + e2z * qz) * id;
        if (tt > 1e-9 && tt < best) { best = tt; bestTri = t; if (any) return { t: tt, tri: t }; }
      }
    } else { stack.push(L[n], R[n]); }
  }
  return bestTri < 0 ? null : { t: best, tri: bestTri };
}

// ---------------- part preparation ----------------
// mesh: {name, position Float32Array, normal Float32Array|null, index Uint32Array|null, faces:[{first,last}]|null}
function preparePart(mesh) {
  const P = mesh.position, I = mesh.index || (() => { const a = new Uint32Array(P.length / 3); for (let i = 0; i < a.length; i++) a[i] = i; return a; })();
  const nT = I.length / 3, TP = new Float32Array(nT * 9), TN = new Float32Array(nT * 3), TA = new Float32Array(nT), TC = new Float32Array(nT * 3), CN = new Float32Array(nT * 9);
  const bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
  let vol = 0, area = 0;
  for (let t = 0; t < nT; t++) {
    for (let k = 0; k < 3; k++) { const v = I[t * 3 + k]; for (let d = 0; d < 3; d++) { const x = P[v * 3 + d]; TP[t * 9 + k * 3 + d] = x; if (x < bmin[d]) bmin[d] = x; if (x > bmax[d]) bmax[d] = x; if (mesh.normal) CN[t * 9 + k * 3 + d] = mesh.normal[v * 3 + d]; } }
    const a = [TP[t * 9], TP[t * 9 + 1], TP[t * 9 + 2]], b = [TP[t * 9 + 3], TP[t * 9 + 4], TP[t * 9 + 5]], c = [TP[t * 9 + 6], TP[t * 9 + 7], TP[t * 9 + 8]];
    const n = cross(sub(b, a), sub(c, a)), l = len(n);
    TA[t] = l / 2; area += l / 2; vol += dot(a, cross(b, c)) / 6;
    const nn = l > 0 ? mul(n, 1 / l) : [0, 0, 1]; TN.set(nn, t * 3); TC.set([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3], t * 3);
  }
  const flip = vol < 0;
  if (flip) { for (let i = 0; i < TN.length; i++) TN[i] = -TN[i]; for (let i = 0; i < CN.length; i++) CN[i] = -CN[i]; }
  const diag = Math.hypot(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2]) || 1;

  // weld vertices for topology
  const q = diag * 1e-6, vmap = new Map(); const TV = new Int32Array(nT * 3); let nv = 0;
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) {
    const o = t * 9 + k * 3; const key = Math.round(TP[o] / q) + ',' + Math.round(TP[o + 1] / q) + ',' + Math.round(TP[o + 2] / q);
    let id = vmap.get(key); if (id === undefined) { id = nv++; vmap.set(key, id); } TV[t * 3 + k] = id;
  }
  const edges = new Map();
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) {
    const a = TV[t * 3 + k], b = TV[t * 3 + (k + 1) % 3]; if (a === b) continue;
    const key = a < b ? a * 4194304 + b : b * 4194304 + a; let e = edges.get(key); if (!e) { e = { a: Math.min(a, b), b: Math.max(a, b), k: [t * 3 + k], tris: [] }; edges.set(key, e); } e.tris.push(t);
  }
  let openEdges = 0, nonManifold = 0; edges.forEach(e => { if (e.tris.length === 1) openEdges++; else if (e.tris.length > 2) nonManifold++; });

  // faces
  const faceOf = new Int32Array(nT).fill(-1); let faces = [];
  if (mesh.faces && mesh.faces.length) { mesh.faces.forEach((f, i) => { for (let t = f.first; t <= f.last; t++) faceOf[t] = i; faces.push({ id: i, tris: [] }); }); }
  else {
    // segment STL by smooth regions (dihedral < 20 deg)
    const adj = new Map(); edges.forEach(e => { if (e.tris.length === 2) { const [x, y] = e.tris; (adj.get(x) || adj.set(x, []).get(x)).push(y); (adj.get(y) || adj.set(y, []).get(y)).push(x); } });
    let fid = 0;
    for (let t = 0; t < nT; t++) { if (faceOf[t] >= 0) continue; const st = [t]; faceOf[t] = fid;
      while (st.length) { const u = st.pop(); for (const w of adj.get(u) || []) { if (faceOf[w] >= 0) continue; const c = TN[u * 3] * TN[w * 3] + TN[u * 3 + 1] * TN[w * 3 + 1] + TN[u * 3 + 2] * TN[w * 3 + 2]; if (c > Math.cos(20 * DEG)) { faceOf[w] = fid; st.push(w); } } }
      faces.push({ id: fid, tris: [] }); fid++; }
    // corner normals: area-weighted within face over welded vertex
    const acc = new Map();
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const key = faceOf[t] + ':' + TV[t * 3 + k]; const a = acc.get(key) || [0, 0, 0]; for (let d = 0; d < 3; d++) a[d] += TN[t * 3 + d] * TA[t]; acc.set(key, a); }
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const a = norm(acc.get(faceOf[t] + ':' + TV[t * 3 + k])); CN.set(a, t * 9 + k * 3); }
  }
  if (!mesh.normal && mesh.faces && mesh.faces.length) for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) CN.set([TN[t * 3], TN[t * 3 + 1], TN[t * 3 + 2]], t * 9 + k * 3);
  for (let t = 0; t < nT; t++) faces[faceOf[t]].tris.push(t);
  faces = faces.map(f => classifyFace(f, TP, TN, TA, CN));

  const part = { name: mesh.name || 'Part', nT, TP, TN, TA, TC, CN, TV, faceOf, faces, edges, bmin, bmax, diag, vol: Math.abs(vol), area, openEdges, nonManifold, flipped: flip };
  part.bvh = buildBVH(TP, nT);
  part.size = [bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2]];
  part.shells = shells(part);
  part.features = features(part);
  // tessellation cuts across round outlines, so take overall size from full outer cylinders where they set it
  part.features.bosses.forEach(g => { for (let i = 0; i < 3; i++) if (Math.abs(g.axis[i]) < 1e-3 && g.d > part.size[i] && g.d - part.size[i] < 0.01 * g.d) part.size[i] = g.d; });
  return part;
}

function classifyFace(f, TP, TN, TA, CN) {
  const pts = [], nrm = []; let area = 0; const na = [0, 0, 0];
  const seen = new Set();
  for (const t of f.tris) { area += TA[t]; for (let d = 0; d < 3; d++) na[d] += TN[t * 3 + d] * TA[t];
    for (let k = 0; k < 3; k++) { const o = t * 9 + k * 3; const key = TP[o].toFixed(5) + ',' + TP[o + 1].toFixed(5) + ',' + TP[o + 2].toFixed(5); if (seen.has(key)) continue; seen.add(key); pts.push([TP[o], TP[o + 1], TP[o + 2]]); nrm.push(norm([CN[o], CN[o + 1], CN[o + 2]])); } }
  const n0 = norm(na); const out = { id: f.id, tris: f.tris, area, type: 'other', n: n0 };
  let planar = true; for (const t of f.tris) if (TN[t * 3] * n0[0] + TN[t * 3 + 1] * n0[1] + TN[t * 3 + 2] * n0[2] < Math.cos(1.5 * DEG)) { planar = false; break; }
  if (planar) { out.type = 'plane'; out.d = dot(n0, pts[0] || [0, 0, 0]); return out; }
  // sample points
  const step = Math.max(1, Math.floor(pts.length / 80)); const P = [], N = [];
  for (let i = 0; i < pts.length; i += step) { P.push(pts[i]); N.push(nrm[i]); }
  // axis candidates: cylinder axis is perpendicular to all normals; cone axis has constant dot
  let best = null, bestc = 0;
  for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j += Math.max(1, Math.floor(N.length / 20))) { const c = cross(N[i], N[j]); const l = len(c); if (l > bestc) { bestc = l; best = mul(c, 1 / l); } }
  if (!best || bestc < 0.05) { out.type = 'other'; return out; }
  best = snap(best);
  let maxDot = 0; for (const n of N) maxDot = Math.max(maxDot, Math.abs(dot(n, best)));
  let axis = best, kind = null;
  if (maxDot < 0.03) kind = 'cyl';
  else {
    // try cone: a = (n1-n2) x (n1-n3)
    let ca = null, cb = 0, acc = [0, 0, 0];
    for (let s = 0; s < 60 && N.length >= 3; s++) { const i = (s * 7) % N.length, j = (s * 13 + 5) % N.length, k = (s * 17 + 11) % N.length; const c = cross(sub(N[i], N[j]), sub(N[i], N[k])); const l = len(c); if (l < 1e-4) continue; let cc = mul(c, 1 / l); if (ca && dot(cc, ca) < 0) cc = mul(cc, -1); if (!ca) ca = cc; acc = add(acc, mul(cc, l)); cb = Math.max(cb, l); }
    if (ca) ca = snap(norm(acc));
    if (ca && cb > 1e-3) { const ds = N.map(n => dot(n, ca)); const m = ds.reduce((a, b) => a + b, 0) / ds.length; const dev = Math.max(...ds.map(x => Math.abs(x - m))); if (dev < 0.03 && Math.abs(m) < 0.97) { kind = 'cone'; axis = ca; out.halfAngle = Math.asin(Math.min(1, Math.abs(m))) / DEG; out.coneDot = m; } }
  }
  if (!kind) { out.type = 'other'; return out; }
  // 2D frame perpendicular to axis
  const u = norm(Math.abs(axis[0]) < 0.9 ? cross(axis, [1, 0, 0]) : cross(axis, [0, 1, 0])), v = cross(axis, u);
  const p2 = P.map(p => [dot(p, u), dot(p, v)]), n2 = N.map(n => { const a = [dot(n, u), dot(n, v)]; const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; });
  // least-squares circle fit (Kasa) of points projected on the plane normal to the axis
  const fit = kind === "cone" ? (lineFit(p2, n2) || kasa(p2)) : (kasa(p2) || lineFit(p2, n2)); if (!fit) { out.type = 'other'; return out; }
  const cx = fit[0], cy = fit[1];
  let sc = 0; p2.forEach((p, i) => { sc += n2[i][0] * (cx - p[0]) + n2[i][1] * (cy - p[1]); });
  const concave = sc > 0;
  const radii = p2.map(p => Math.hypot(p[0] - cx, p[1] - cy));
  const r = radii.reduce((a, b) => a + b, 0) / radii.length;
  const bins = new Array(36).fill(0); p2.forEach(p => { const a = Math.atan2(p[1] - cy, p[0] - cx); bins[Math.min(35, Math.floor((a + Math.PI) / (2 * Math.PI) * 36))] = 1; });
  const hs = P.map(p => dot(p, axis));
  const center = add(add(mul(u, cx), mul(v, cy)), mul(axis, 0));
  Object.assign(out, { type: kind, axis, u, v, c2: [cx, cy], center, r, rmin: Math.min(...radii), rmax: Math.max(...radii), concave, bins, h0: Math.min(...hs), h1: Math.max(...hs) });
  return out;
}

function snap(a) { for (let i = 0; i < 3; i++) if (Math.abs(a[i]) > Math.cos(0.5 * DEG)) { const r = [0, 0, 0]; r[i] = Math.sign(a[i]); return r; } return a; }
function lineFit(p, n) { // least-squares intersection of 2D normal lines
  let a = 0, b = 0, c = 0, bx = 0, by = 0;
  p.forEach((q, i) => { const [nx, ny] = n[i]; const m00 = 1 - nx * nx, m01 = -nx * ny, m11 = 1 - ny * ny; a += m00; b += m01; c += m11; bx += m00 * q[0] + m01 * q[1]; by += m01 * q[0] + m11 * q[1]; });
  const det = a * c - b * b; if (det < 1e-6 * (a + c) * (a + c)) return null;
  return [(c * bx - b * by) / det, (a * by - b * bx) / det];
}
function kasa(p) {
  if (p.length < 3) return null; let mx = 0, my = 0; p.forEach(q => { mx += q[0]; my += q[1]; }); mx /= p.length; my /= p.length;
  let Suu = 0, Svv = 0, Suv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
  p.forEach(q => { const u = q[0] - mx, v = q[1] - my; Suu += u * u; Svv += v * v; Suv += u * v; Suuu += u * u * u; Svvv += v * v * v; Suvv += u * v * v; Svuu += v * u * u; });
  const det = Suu * Svv - Suv * Suv; if (Math.abs(det) < 1e-18) return null;
  const a = 0.5 * (Suuu + Suvv), b = 0.5 * (Svvv + Svuu);
  return [mx + (a * Svv - b * Suv) / det, my + (b * Suu - a * Suv) / det];
}
function shells(part) {
  const { nT, TV, TP } = part; const parent = new Int32Array(nT); for (let i = 0; i < nT; i++) parent[i] = i;
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  part.edges.forEach(e => { for (let i = 1; i < e.tris.length; i++) { const a = find(e.tris[0]), b = find(e.tris[i]); if (a !== b) parent[a] = b; } });
  const groups = new Map(); for (let t = 0; t < nT; t++) { const r = find(t); (groups.get(r) || groups.set(r, []).get(r)).push(t); }
  const out = []; groups.forEach(tris => { let v = 0; for (const t of tris) { const o = t * 9; const a = [TP[o], TP[o + 1], TP[o + 2]], b = [TP[o + 3], TP[o + 4], TP[o + 5]], c = [TP[o + 6], TP[o + 7], TP[o + 8]]; v += dot(a, cross(b, c)) / 6; } if (part.flipped) v = -v; out.push({ tris, vol: v }); });
  return out;
}

// ---------------- features: holes, bosses, internal radii ----------------
function features(part) {
  const curved = part.faces.filter(f => f.type === 'cyl' || f.type === 'cone');
  const groups = [];
  for (const f of curved) {
    let g = groups.find(g => g.type === f.type && Math.abs(Math.abs(dot(g.axis, f.axis)) - 1) < 1e-3 && Math.abs(g.r - f.r) < Math.max(0.02, 0.01 * g.r) && g.concave === f.concave && lineDist(g, f) < Math.max(0.08, 0.02 * g.r) && spanGap(g, f) < Math.max(0.05, 0.02 * g.r));
    if (!g) { g = { type: f.type, axis: f.axis, u: f.u, v: f.v, faceRef: f, r: f.r, concave: f.concave, faces: [], bins: new Array(36).fill(0), h0: Infinity, h1: -Infinity, halfAngle: f.halfAngle }; groups.push(g); }
    g.faces.push(f.id);
    // align heights to group axis sign
    const s = Math.sign(dot(g.axis, f.axis)) || 1; const a = s > 0 ? [f.h0, f.h1] : [-f.h1, -f.h0];
    g.h0 = Math.min(g.h0, a[0]); g.h1 = Math.max(g.h1, a[1]);
    // recompute bins in group frame
    const c0 = axisPoint(g);
    for (const t of f.tris) { const an = [0, 1, 2].map(k => { const o = t * 9 + k * 3; const d = sub([part.TP[o], part.TP[o + 1], part.TP[o + 2]], c0); return Math.atan2(dot(d, g.v), dot(d, g.u)); });
      for (let k = 0; k < 3; k++) { let a = an[k], b = an[(k + 1) % 3]; let dlt = b - a; if (dlt > Math.PI) dlt -= 2 * Math.PI; if (dlt < -Math.PI) dlt += 2 * Math.PI; const steps = Math.max(1, Math.ceil(Math.abs(dlt) / (Math.PI / 72)));
        for (let i = 0; i <= steps; i++) { const ang = a + dlt * i / steps; let bi = Math.floor((ang + Math.PI) / (2 * Math.PI) * 36); bi = ((bi % 36) + 36) % 36; g.bins[bi] = 1; } } }
  }
  groups.forEach(g => { g.coverage = g.bins.reduce((a, b) => a + b, 0) / 36; g.depth = g.h1 - g.h0; g.d = 2 * g.r; g.tris = [].concat(...g.faces.map(i => part.faces[i].tris)); g.mid = add(axisPoint(g), mul(g.axis, (g.h0 + g.h1) / 2)); });
  const holes = groups.filter(g => g.type === 'cyl' && g.concave && g.coverage >= 0.7);
  const bosses = groups.filter(g => g.type === 'cyl' && !g.concave && g.coverage >= 0.7);
  const radii = groups.filter(g => g.type === 'cyl' && g.concave && g.coverage < 0.7 && g.r < part.diag / 4);
  const cones = groups.filter(g => g.type === 'cone');
  // stack coaxial holes: smallest diameter is the main hole
  const stacks = [];
  for (const h of holes.slice().sort((a, b) => a.r - b.r)) {
    let s = stacks.find(s => Math.abs(Math.abs(dot(s.main.axis, h.axis)) - 1) < 1e-3 && lineDist(s.main, h) < 0.05 && [s.main, ...s.steps].some(x => spanGap(x, h) < Math.max(0.2, 0.05 * h.r)));
    if (!s) { s = { main: h, steps: [], cones: [] }; stacks.push(s); } else s.steps.push(h);
  }
  for (const c of cones) { const s = stacks.find(s => Math.abs(Math.abs(dot(s.main.axis, c.axis)) - 1) < 1e-3 && lineDist(s.main, c) < 0.1); if (s) s.cones.push(c); }
  // through test along axis from the middle of the main hole
  for (const s of stacks) {
    const m = s.main; const o = m.mid; const off = part.diag * 2;
    const h1 = rayCast(part.bvh, o, m.axis, off, true), h2 = rayCast(part.bvh, o, mul(m.axis, -1), off, true);
    s.through = !h1 && !h2;
    s.totalDepth = Math.max(m.h1, ...s.steps.map(x => x.h1), ...s.cones.map(x => x.h1)) - Math.min(m.h0, ...s.steps.map(x => x.h0), ...s.cones.map(x => x.h0));
    s.tris = [].concat(m.tris, ...s.steps.map(x => x.tris), ...s.cones.map(x => x.tris));
    const d = m.d; let th = null, kind = null;
    for (const T of THREADS) { if (Math.abs(d - T.tap) <= Math.max(0.06, T.tap * 0.02)) { th = T; kind = 'tap'; break; } }
    if (!th) for (const T of THREADS) if (Math.abs(d - T.d) <= 0.03) { th = T; kind = 'nominal'; break; }
    if (!th) for (const T of THREADS) if (d >= T.clr - 0.15 && d <= T.clr + 0.3) { th = T; kind = 'clearance'; break; }
    s.thread = th; s.threadKind = kind;
    s.kind = s.steps.length ? 'counterbored' : s.cones.length ? 'countersunk' : 'plain';
  }
  return { groups, holes, bosses, radii, cones, stacks };
}
// gap along the axis between a group's height range and a face (faces at opposite ends of a shaft are separate holes)
function spanGap(g, f) { const s = Math.sign(dot(g.axis, f.axis)) || 1; const a0 = (s > 0 ? f.h0 : -f.h1), a1 = (s > 0 ? f.h1 : -f.h0); return Math.max(0, a0 - g.h1, g.h0 - a1); }
function axisPoint(g) { const f = g.faceRef || g; return add(mul(f.u, f.c2[0]), mul(f.v, f.c2[1])); }
function lineDist(g, f) {
  const a = axisPoint(g), b = axisPoint(f); const d = sub(b, a); const ax = g.axis; const perp = sub(d, mul(ax, dot(d, ax))); return len(perp);
}

// ---------------- maps ----------------
function thicknessMap(part) {
  if (part._thick) return part._thick;
  const { nT, TC, TN, bvh, diag } = part; const th = new Float32Array(nT).fill(NaN); const eps = diag * 1e-5;
  for (let t = 0; t < nT; t++) {
    const n = [TN[t * 3], TN[t * 3 + 1], TN[t * 3 + 2]], d = [-n[0], -n[1], -n[2]];
    const o = [TC[t * 3] + d[0] * eps, TC[t * 3 + 1] + d[1] * eps, TC[t * 3 + 2] + d[2] * eps];
    const h = rayCast(bvh, o, d, diag * 2, false, t); if (!h) continue;
    const hn = [TN[h.tri * 3], TN[h.tri * 3 + 1], TN[h.tri * 3 + 2]]; if (dot(hn, d) > 0.5) th[t] = h.t + eps;
  }
  return (part._thick = th);
}
function dirsFor(kind) {
  const A = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
  if (kind === '6') return A;
  const S = []; for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) S.push(norm([x, y, z]));
  if (kind === '26') return S;
  const F = S.slice(); const n = 120, g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i; F.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
  return F;
}
// returns Int16Array: index of first direction (in dirs) that reaches the triangle, -1 none, -2 = own normal (5-axis)
function accessMap(part, dirs, useNormal) {
  const { nT, TC, TN, bvh, diag } = part; const acc = new Int16Array(nT).fill(-1); const off = diag * 2e-4;
  const reach = dirs.map(() => new Uint8Array(nT));
  for (let t = 0; t < nT; t++) {
    const n = [TN[t * 3], TN[t * 3 + 1], TN[t * 3 + 2]]; const o = [TC[t * 3] + n[0] * off, TC[t * 3 + 1] + n[1] * off, TC[t * 3 + 2] + n[2] * off];
    if (useNormal && !rayCast(bvh, o, n, diag * 3, true, t)) { acc[t] = -2; continue; }
    const order = dirs.map((d, i) => [dot(d, n), i]).filter(x => x[0] >= -0.02).sort((a, b) => b[0] - a[0]);
    for (const [, i] of order) { if (!rayCast(bvh, o, dirs[i], diag * 3, true, t)) { acc[t] = i; if (!part._fullReach) break; reach[i][t] = 1; } }
  }
  return { acc, reach };
}
function fullReach(part, dirs) { // every direction tested (for setup counting)
  const { nT, TC, TN, bvh, diag } = part; const off = diag * 2e-4; const reach = dirs.map(() => new Uint8Array(nT));
  for (let t = 0; t < nT; t++) { const n = [TN[t * 3], TN[t * 3 + 1], TN[t * 3 + 2]]; const o = [TC[t * 3] + n[0] * off, TC[t * 3 + 1] + n[1] * off, TC[t * 3 + 2] + n[2] * off];
    dirs.forEach((d, i) => { if (dot(d, n) >= -0.02 && !rayCast(bvh, o, d, diag * 3, true, t)) reach[i][t] = 1; }); }
  return reach;
}
// concave sharp edges
function sharpEdges(part) {
  if (part._sharp) return part._sharp;
  const { TN, TC, TP, TV, faceOf, edges, diag } = part; const out = [];
  // triangles made by a drill, reamer, tap or countersink, and the curved feature each triangle belongs to.
  // Edges inside these (tessellation seams of a hole, the drill point cone, cross holes) are not cutter corners.
  const drilled = new Set(), grp = new Map(); const F = part.features;
  if (F) { (F.stacks || []).forEach(s => (s.tris || []).forEach(t => drilled.add(t))); (F.groups || []).forEach((g, gi) => (g.tris || []).forEach(t => grp.set(t, gi))); }
  edges.forEach(e => {
    if (e.tris.length !== 2) return; const [A, B] = e.tris; if (faceOf[A] === faceOf[B]) return;
    if (drilled.has(A) || drilled.has(B)) return; if (grp.has(A) && grp.get(A) === grp.get(B)) return;
    { const fa = part.faces[faceOf[A]], fb = part.faces[faceOf[B]]; // seam between two halves of one hole wall or cone
      if (fa && fb && (fa.type === 'cyl' || fa.type === 'cone') && fa.type === fb.type && fa.concave && fb.concave && fa.axis && fb.axis && Math.abs(dot(fa.axis, fb.axis)) > 0.99 && Math.abs(fa.r - fb.r) < Math.max(0.05, 0.1 * fa.r)) return; }
    const nA = [TN[A * 3], TN[A * 3 + 1], TN[A * 3 + 2]], nB = [TN[B * 3], TN[B * 3 + 1], TN[B * 3 + 2]];
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(nA, nB)))) / DEG; if (ang < 20) return;
    const pa = vpos(part, e.a), pb = vpos(part, e.b); const mid = mul(add(pa, pb), 0.5);
    const cB = [TC[B * 3], TC[B * 3 + 1], TC[B * 3 + 2]]; if (dot(nA, sub(cB, mid)) <= diag * 1e-6) return; // convex
    out.push({ A, B, nA, nB, pa, pb, mid, len: len(sub(pb, pa)), dir: norm(sub(pb, pa)), angle: 180 - ang });
  });
  return (part._sharp = out);
}
function vpos(part, vid) { if (!part._vp) { part._vp = new Map(); const { TV, TP, nT } = part; for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const id = TV[t * 3 + k]; if (!part._vp.has(id)) part._vp.set(id, [TP[t * 9 + k * 3], TP[t * 9 + k * 3 + 1], TP[t * 9 + k * 3 + 2]]); } } return part._vp.get(vid); }

// ---------------- model quality (product data quality, in the spirit of VDA 4955 / SASIG PDQ checkers) ----------------
function modelQuality(part, P) {
  P = Object.assign({ minFaceArea: 0.01, minFaceWidth: 0.02, minEdge: 0.01, g1Min: 0.05, g1Max: 3, maxOffset: 5000, multiSolid: 'fail', minSize: 0.5, maxSize: 5000 }, P || {});
  const out = [], Q = (status, cat, title, value, why, fix, tris, extra) => out.push(F(status, cat, title, value, why, fix, tris, Object.assign({ steps: [] }, extra || {})));
  const { nT, faceOf, faces, edges, TA, CN, TV } = part; const fA = new Float64Array(faces.length), fP = new Float64Array(faces.length);
  for (let t = 0; t < nT; t++) fA[faceOf[t]] += TA[t];
  const open = [], nm = [], bnd = [];
  edges.forEach(e => { const L = len(sub(vpos(part, e.b), vpos(part, e.a)));
    const live = e.tris.filter(t => TA[t] > 1e-9); if (!live.length) return;
    if (live.length === 1) { if (e.tris.length === 1) open.push(e); fP[faceOf[live[0]]] += L; return; } if (live.length > 2) { nm.push(e); return; }
    const [A, B] = live; if (faceOf[A] !== faceOf[B]) { fP[faceOf[A]] += L; fP[faceOf[B]] += L; bnd.push({ e, A, B, L, fa: Math.min(faceOf[A], faceOf[B]), fb: Math.max(faceOf[A], faceOf[B]) }); } });
  const trisOf = list => [...new Set(list.flatMap(x => (x.e || x).tris))];
  // 1 closed solid
  if (open.length) Q('fail', 'Topology', 'Solid is not closed', `${open.length} open edges (gaps in the skin)`, 'A part must be one closed volume. Gaps break meshing, CAM, 3D printing and volume or mass results, and often come from failed fillets or a bad translation.', 'Heal or sew the surfaces in CAD, check the export settings, then export again as a solid.', trisOf(open), { steps: ['Run the import or geometry diagnostics in your CAD system.', 'Sew or knit the surfaces into one solid, or rebuild the failing feature.', 'Export STEP as a solid body, not as surfaces.'] });
  else Q('pass', 'Topology', 'Closed solid', 'No open edges', '', '');
  if (nm.length) Q('fail', 'Topology', 'Non-manifold edges', `${nm.length} edges shared by more than two faces`, 'Bodies that touch along an edge or point are not a valid solid for most downstream systems.', 'Separate the bodies, or merge them with a proper union so no edge is shared by three or more faces.', trisOf(nm));
  // 2 one solid per part
  const sh = part.shells.filter(s => s.vol > 0), voids = part.shells.filter(s => s.vol < 0);
  if (sh.length > 1) Q(P.multiSolid, 'Topology', 'More than one solid in the part', `${sh.length} separate bodies`, 'Most standards ask for one solid per part. Extra bodies are often leftovers of construction or tool bodies.', 'Delete construction bodies, or split the file into one part per body.', [], {});
  else Q('pass', 'Topology', 'One solid', sh.length ? '1 body' : '–', '', '');
  if (voids.length) Q('info', 'Topology', 'Internal void', `${voids.length} closed cavity inside the solid`, 'A fully enclosed cavity cannot be machined or cleaned and is often a modelling mistake.', 'Check that the cavity is intended.');
  if (part.flipped) Q('warn', 'Topology', 'Face normals point inwards', 'Volume came out negative', 'Inverted normals confuse rendering, slicing and CAM.', 'Reverse the normals or re-export the solid.');
  // 3 small and sliver faces
  const small = [], sliver = [];
  faces.forEach((f, i) => { const A = fA[i]; if (!f.tris.length) return; if (A < P.minFaceArea) small.push(i); else { const w = fP[i] > 0 ? 2 * A / fP[i] : Infinity; if (w < P.minFaceWidth) sliver.push(i); } });
  const ftr = ids => ids.flatMap(i => faces[i].tris);
  if (small.length) Q('warn', 'Faces', 'Very small faces', `${small.length} faces under ${P.minFaceArea} mm²`, 'Tiny faces come from failed blends, split edges or translation, and cause meshing and toolpath problems.', 'Remove the small faces by rebuilding the fillet or chamfer, or merge them into their neighbours.', ftr(small), { focus: centroidOf(part, ftr(small.slice(0, 1))), steps: ['Select the highlighted face in CAD.', 'Delete it with a delete-face or heal command, or rebuild the feature that made it.', 'Check again.'] });
  else Q('pass', 'Faces', 'No very small faces', `All faces over ${P.minFaceArea} mm²`, '', '');
  if (sliver.length) Q('warn', 'Faces', 'Sliver faces', `${sliver.length} faces narrower than ${P.minFaceWidth} mm`, 'Long, very narrow faces are hard to mesh and machine, and usually show a small mismatch between two features.', 'Extend or trim the neighbouring features so the sliver disappears.', ftr(sliver), { focus: centroidOf(part, ftr(sliver.slice(0, 1))) });
  else Q('pass', 'Faces', 'No sliver faces', `No face narrower than ${P.minFaceWidth} mm`, '', '');
  // 4 short edges and tangency kinks, per boundary between two faces
  const groups = new Map(); bnd.forEach(b => { const k = b.fa + ':' + b.fb; (groups.get(k) || groups.set(k, []).get(k)).push(b); });
  const cn = (t, v) => { for (let k = 0; k < 3; k++) if (TV[t * 3 + k] === v) return [CN[t * 9 + k * 3], CN[t * 9 + k * 3 + 1], CN[t * 9 + k * 3 + 2]]; return [part.TN[t * 3], part.TN[t * 3 + 1], part.TN[t * 3 + 2]]; };
  const shortE = [], kinks = [];
  groups.forEach(list => {
    // split one face pair into connected chains
    const par = list.map((_, i) => i), find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; }; const at = new Map();
    list.forEach((b, i) => [b.e.a, b.e.b].forEach(v => { if (at.has(v)) { const r1 = find(at.get(v)), r2 = find(i); if (r1 !== r2) par[r1] = r2; } else at.set(v, i); }));
    const ch = new Map(); list.forEach((b, i) => { const r = find(i); (ch.get(r) || ch.set(r, []).get(r)).push(b); });
    ch.forEach(c => { const L = c.reduce((a, b) => a + b.L, 0); if (L < P.minEdge) shortE.push({ c, L });
      let mx = 0; c.forEach(b => [b.e.a, b.e.b].forEach(v => { const a = cn(b.A, v), bb = cn(b.B, v); const ang = Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(bb))))) / DEG; if (ang > mx) mx = ang; }));
      if (mx > P.g1Min && mx < P.g1Max) kinks.push({ c, L, ang: mx }); });
  });
  if (shortE.length) Q('warn', 'Edges', 'Very short edges', `${shortE.length} edges under ${P.minEdge} mm`, 'Tiny edges cause meshing failures and unstable features downstream.', 'Rebuild the features that meet at this point so the edge disappears, or heal the model.', [...new Set(shortE.flatMap(x => x.c.flatMap(b => [b.A, b.B])))]);
  else Q('pass', 'Edges', 'No very short edges', `None under ${P.minEdge} mm`, '', '');
  if (kinks.length) { const tr = [...new Set(kinks.flatMap(x => x.c.flatMap(b => [b.A, b.B])))]; const worst = Math.max(...kinks.map(k => k.ang));
    Q('warn', 'Continuity', 'Faces almost tangent (G1 gap)', `${kinks.length} edges with a kink of ${fmt(P.g1Min, 2)}° to ${fmt(P.g1Max, 1)}°, worst ${fmt(worst, 2)}°`, 'Two faces that are meant to blend smoothly meet with a small angle. It shows as a visible line on cosmetic surfaces and can make fillets and offsets fail.', 'Make the blend tangent (G1) or curvature continuous (G2), or make the corner a clear sharp edge.', tr, { focus: centroidOf(part, tr.slice(0, 2)) }); }
  else Q('pass', 'Continuity', 'Tangent blends', `No kinks between ${fmt(P.g1Min, 2)}° and ${fmt(P.g1Max, 1)}°`, '', '');
  // 5 tessellation and size sanity
  let deg = 0; for (let t = 0; t < nT; t++) if (TA[t] < 1e-9) deg++; if (deg) Q('info', 'Faces', 'Degenerate triangles', `${deg} zero-area triangles in the display mesh`, 'Usually harmless, from very small or collapsed faces.', '');
  const L = Math.max(...part.size); if (L < P.minSize || L > P.maxSize) Q('warn', 'Units and position', 'Unusual part size', `${fmt(L, 3)} mm largest size`, 'A part this small or large often means the units were wrong when exporting (inch instead of mm, or metres).', 'Check the export units and scale.');
  else Q('pass', 'Units and position', 'Part size is plausible', `${fmt(L, 1)} mm largest size`, '', '');
  const c = mul(add(part.bmin, part.bmax), 0.5), off = len(c);
  if (off > P.maxOffset) Q('info', 'Units and position', 'Part is far from the origin', `${fmt(off, 0)} mm from 0,0,0`, 'Parts placed far from the origin lose precision in some systems and are awkward for CAM.', 'Model the part near the origin and position it in the assembly instead.');
  const ft = faces.reduce((a, f) => (a[f.type] = (a[f.type] || 0) + 1, a), {}); Q('info', 'Faces', 'Face types', `${faces.length} faces: ${Object.entries(ft).map(([k, v]) => `${v} ${k === 'other' ? 'freeform' : k}`).join(', ')}`, 'Freeform faces need 3D toolpaths and are slower to machine and inspect.', '');
  return out;
}

// ---------------- analysis per process ----------------
function F(status, cat, title, value, why, fix, tris, extra) { return Object.assign({ status, cat, title, value, why, fix: fix || '', tris: tris || [] }, extra || {}); }
const fmt = (n, d = 2) => Number.isFinite(n) ? (+(+n).toFixed(d)).toString() : '–';
function envelopeCheck(part, env, name) {
  const d = part.size.slice().sort((a, b) => b - a), m = env.slice().sort((a, b) => b - a), ok = d.every((x, i) => x <= m[i]);
  return F(ok ? 'pass' : 'fail', 'Size', 'Fits the working envelope', `${fmt(part.size[0], 1)} × ${fmt(part.size[1], 1)} × ${fmt(part.size[2], 1)} mm`, `Typical ${name} envelope is ${env.join(' × ')} mm.`, ok ? '' : 'Split the part or find a supplier with a larger machine.');
}
function cluster(part, tris) { // group triangle list into connected regions
  const set = new Set(tris), seen = new Set(), out = []; const adj = new Map();
  part.edges.forEach(e => { if (e.tris.length < 2) return; for (const a of e.tris) if (set.has(a)) for (const b of e.tris) if (a !== b && set.has(b)) (adj.get(a) || adj.set(a, []).get(a)).push(b); });
  for (const t of tris) { if (seen.has(t)) continue; const st = [t], g = []; seen.add(t); while (st.length) { const u = st.pop(); g.push(u); for (const w of adj.get(u) || []) if (!seen.has(w)) { seen.add(w); st.push(w); } } out.push(g); }
  return out.sort((a, b) => b.length - a.length);
}
function edgeChains(part, edges) { // connect edges sharing a vertex and running in the same direction
  const key = p => p.map(x => Math.round(x / (part.diag * 1e-6))).join(',');
  const parent = edges.map((_, i) => i); const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const at = new Map(); edges.forEach((e, i) => { for (const p of [e.pa, e.pb]) { const k = key(p); (at.get(k) || at.set(k, []).get(k)).push(i); } });
  at.forEach(list => { for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) if (Math.abs(dot(edges[list[a]].dir, edges[list[b]].dir)) > 0.95) { const x = find(list[a]), y = find(list[b]); if (x !== y) parent[x] = y; } });
  const g = new Map(); edges.forEach((e, i) => { const r = find(i); (g.get(r) || g.set(r, []).get(r)).push(e); });
  return [...g.values()].sort((a, b) => b.reduce((s, e) => s + e.len, 0) - a.reduce((s, e) => s + e.len, 0));
}
function holeGroups(part) { const g = new Map(); for (const s of part.features.stacks) { const q = x => Math.round(x * 20) / 20; const k = [s.kind, q(s.main.d), q(s.main.depth), s.through, s.steps.map(x => q(x.d)).join(), s.cones.length].join('|'); (g.get(k) || g.set(k, []).get(k)).push(s); } return [...g.values()]; }
function areaOf(part, tris) { let a = 0; for (const t of tris) a += part.TA[t]; return a; }
function centroidOf(part, tris) { const c = [0, 0, 0]; let w = 0; for (const t of tris) { const a = part.TA[t]; for (let d = 0; d < 3; d++) c[d] += part.TC[t * 3 + d] * a; w += a; } return w ? mul(c, 1 / w) : c; }

function isoClassFinding(processIso, cls, part, processName) {
  const order = ['f', 'm', 'c', 'v']; const L = Math.max(...part.size); const lin = cls[0];
  const tolSel = ISO2768.linFor(lin, L), tolCap = ISO2768.linFor(processIso, L);
  const ok = order.indexOf(lin) >= order.indexOf(processIso);
  return F(ok ? 'pass' : 'warn', 'Tolerance', `General tolerance ISO 2768-${cls}`, `±${fmt(tolSel, 2)} mm at ${fmt(L, 0)} mm`, `${processName} holds about ISO 2768-${processIso} as made (±${fmt(tolCap, 2)} mm at this size).`, ok ? '' : `Relax the general class to ${processIso} or plan secondary machining for this part.`);
}


// how-to-fix steps, written for any CAD system
const TOOLS = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20];
function cornerRadius(depth, ld) { const dmin = depth / ld; const d = TOOLS.find(x => x >= dmin) || 20; return { d, r: Math.ceil((d / 2 + 0.1) * 10) / 10, ideal: Math.max(Math.ceil((d / 2 + 0.1) * 10) / 10, Math.ceil(depth / 3 * 2) / 2) }; }
const STEPS = {
  access: k => ['Turn on the highlighted area in the viewer and find which wall or lip hides it from the cutter.', 'Open the area so a tool can see it in a straight line, for example extend the pocket through or remove the overhanging lip.', 'If the shape is needed, split the part into two machined pieces located with dowels and joined with screws.', k === 'cnc5' ? 'For truly internal shapes, consider wire EDM, sinker EDM or metal 3D printing.' : `Or re-run the review for ${k === 'cnc3' ? 'CNC multi-axis or 5-axis' : 'CNC 5-axis'} to see if a tilted tool reaches it.`],
  corner: (R, L) => [`Select the highlighted internal edge (${fmt(L, 1)} mm long) in your CAD model.`, `Add a Fillet of R${fmt(R.r, 1)}. This lets a standard Ø${R.d} end mill cut the full depth.`, `For faster machining use R${fmt(R.ideal, 1)} (about one third of the depth).`, 'If a square-cornered part has to fit inside, cut a dog-bone or T-bone relief at the corner instead of a fillet.', 'Re-run the review to confirm the corner clears.'],
  radius: (R, g) => [`Edit the fillet of R${fmt(g.r, 2)}.`, `Change it to R${fmt(R.r, 1)} or more so a Ø${R.d} cutter can reach ${fmt(g.depth, 1)} mm deep.`, 'Keep all internal radii in one pocket the same size so one tool finishes them.'],
  thin: (t, m) => [`Measure the wall with the Measure tool (pick the two opposite faces). It is about ${fmt(m, 2)} mm.`, `Thicken it to at least ${fmt(t, 2)} mm, or reduce its height so height is under 10× thickness.`, 'If it must stay thin, add a supporting rib or gusset behind it.'],
  deepHole: (h, s) => [`Hole Ø${fmt(h.d, 2)} is ${fmt(h.depth, 1)} mm deep (${fmt(h.depth / h.d, 1)}×D).`, `Reduce the depth to ${fmt(4 * h.d, 1)} mm, or enlarge the hole.`, s.through ? 'For a through hole, the shop can drill from both sides; say so on the drawing if position allows.' : 'For a blind hole, add a 118° drill point at the bottom and give drill depth and thread depth separately.'],
  thread: T => [`Make the ${T.n} thread engagement at least ${fmt(1.5 * T.d, 1)} mm (1.5×D).`, 'If the material is too thin, use a helical insert (HeliCoil) or a through bolt with a nut.'],
  setups: () => ['Count which faces carry features in the setup list.', 'Move small features (tapped holes, chamfers) onto faces already machined in setup 1 or 2.', 'Or add a clamping tab cut off in the last operation, or quote CNC multi-axis for one clamping.'],
  draft: (C, p) => [`Use your CAD Draft feature with the pull direction ${axisName(p)} and the neutral plane at the parting line.`, `Apply ${C.draft[1]}° to outside walls and ${C.draft[1] * 2}° to inside walls and cored holes.`, 'Holes smaller than the cored-hole minimum can be left straight and drilled after casting.'],
  undercut: c => ['Change the feature so it opens towards the pull direction.', c === 'die' ? 'If it must stay, plan a side action (slide) in the die and confirm the cost with the supplier.' : 'If it must stay, form it with a sand or ceramic core.', 'Or leave it solid and machine it after casting.'],
  uniform: t => [`The thinnest common wall is about ${fmt(t, 1)} mm. Aim to keep all sections within 2× that.`, 'Shell or core out thick bosses and pads.', 'Replace solid mass with ribs of 0.6 to 0.8× wall thickness.', 'Blend thickness changes with a taper of about 1:3.'],
  castFillet: w => [`Select the sharp internal edges (highlighted).`, `Fillet them with about R${fmt(Math.max(0.5, w / 2), 1)} (half the wall).`],
  overhang: a => ['Rotate the part so the largest down-facing faces point up or sideways.', `Change ledges to slope at ${a}° or steeper from vertical, or add a 45° chamfer underneath.`, 'Make horizontal holes teardrop or diamond shaped so they print without support.'],
  amHole: (s, T) => s.threadKind === 'tap' ? [`Model the hole at Ø${fmt(s.d || s.main.d, 2)} and tap after printing, or`, 'Use heat-set threaded inserts for plastics (model the insert pilot hole).'] : [`Print the hole slightly undersize, then drill or ream to size.`, `Or enlarge it to Ø${fmt(T.hole[1], 1)} mm or more.`],
  void: () => ['Add at least two escape holes, Ø3.5 to 5 mm, at opposite ends of the cavity.', 'Place them where powder or resin can drain with the part tilted.', 'Plug them afterwards if the part must be sealed.']
};
function axisName(v) { return v[0] ? (v[0] > 0 ? '+X' : '−X') : v[1] ? (v[1] > 0 ? '+Y' : '−Y') : (v[2] > 0 ? '+Z' : '−Z'); }

// merge findings with the same check (one entry per check, with every place listed)
function mergeFindings(list) {
  const out = [], map = new Map();
  for (const f of list) {
    if (!f.tris || !f.tris.length || f.status === 'pass') { out.push(f); continue; }
    const base = f.title.replace(/\s+\d+$/, '');
    const key = f.status + '|' + f.cat + '|' + base;
    let g = map.get(key);
    if (!g) { g = Object.assign({}, f, { title: base, instances: [], _t: new Set() }); map.set(key, g); out.push(g); }
    g.instances.push({ tris: f.tris, focus: f.focus, value: f.value });
    f.tris.forEach(t => g._t.add(t));
  }
  for (const g of out) {
    if (!g._t) continue; g.tris = [...g._t]; delete g._t; const n = g.instances.length;
    if (n > 1) { const vals = [...new Set(g.instances.map(i => i.value))]; g.title = `${g.title} (${n} places)`; g.value = vals.length === 1 ? vals[0] : vals.slice(0, 3).join(' · ') + (vals.length > 3 ? ` and ${vals.length - 3} more` : ''); }
    else delete g.instances;
  }
  return out;
}

function analyzeCNC(part, kind, opt) {
  const P = CNC[kind], M = MATERIALS[opt.material] || MATERIALS.al6061, out = [];
  out.push(envelopeCheck(part, P.env, P.n));
  // access
  const dirs = dirsFor(kind === 'cnc3' ? '6' : kind === 'cnc4' ? '26' : 'sphere');
  const { acc } = accessMap(part, dirs, kind === 'cnc5');
  const bad = []; for (let t = 0; t < part.nT; t++) if (acc[t] === -1) bad.push(t);
  const badArea = areaOf(part, bad);
  if (bad.length) {
    const cl = cluster(part, bad).filter(g => areaOf(part, g) > Math.max(part.area * 2e-4, 0.5));
    cl.forEach((g, i) => out.push(F('fail', 'Tool access', `Material left behind ${i + 1}`, `${fmt(areaOf(part, g), 1)} mm² unreachable`, `No ${kind === 'cnc3' ? 'axis-aligned setup' : kind === 'cnc4' ? 'indexed 3+2 tool angle' : 'tool orientation'} has a straight line of sight to this surface, so the cutter cannot reach it. Stock stays here or the shape changes.`, kind === 'cnc5' ? 'Open the area up, split the part, or use EDM or additive manufacturing for this feature.' : `Try ${kind === 'cnc3' ? 'multi-axis or 5-axis' : '5-axis'}, open the area so a tool can reach it, or split the part.`, g, { focus: centroidOf(part, g), steps: STEPS.access(kind) })));
  } else out.push(F('pass', 'Tool access', 'All surfaces reachable', kind === 'cnc5' ? 'Every face is visible from some tool angle' : `${dirs.length} tool directions checked`, 'Every surface has a straight line of sight from at least one allowed tool direction.', ''));
  if (kind === 'cnc3') {
    const reach = fullReach(part, dirs); const left = new Set(); for (let t = 0; t < part.nT; t++) if (acc[t] !== -1) left.add(t);
    const used = []; while (left.size) { let bi = -1, ba = 0; reach.forEach((r, i) => { let a = 0; left.forEach(t => { if (r[t]) a += part.TA[t] * Math.max(0.3, dot(dirs[i], [part.TN[t * 3], part.TN[t * 3 + 1], part.TN[t * 3 + 2]])); }); if (a > ba) { ba = a; bi = i; } }); if (bi < 0) break; used.push(bi); left.forEach(t => { if (reach[bi][t]) left.delete(t); }); }
    const names = ['+Z', '−Z', '+X', '−X', '+Y', '−Y'];
    out.push(F(used.length <= 2 ? 'pass' : 'warn', 'Setups', 'Setups needed', `${used.length} (${used.map(i => names[i]).join(', ')})`, 'Each extra setup means another clamping, fixture time and 0.02 to 0.05 mm of datum shift between features cut in different setups.', used.length > 2 ? 'Move features onto fewer faces, or consider 3+2 indexing for one clamping.' : '', [], { steps: used.length > 2 ? STEPS.setups() : [] }));
  }
  // sharp internal edges
  const se = sharpEdges(part); const badEdges = [];
  for (const e of se) {
    let ok = false;
    for (const [nx, ny, X] of [[e.nA, e.nB, e.A], [e.nB, e.nA, e.B]]) {
      const allowed = kind === 'cnc5' ? true : dirs.some(d => dot(d, nx) > Math.cos(2 * DEG)); if (!allowed) continue;
      if (dot(ny, nx) < -0.02) continue;
      const o = add(add(e.mid, mul(sub([part.TC[X * 3], part.TC[X * 3 + 1], part.TC[X * 3 + 2]], e.mid), 0.15)), mul(nx, part.diag * 2e-4));
      if (!rayCast(part.bvh, o, nx, part.diag * 3, true, X)) { ok = true; break; }
    }
    if (!ok) badEdges.push(e);
  }
  const badSet = new Set(bad); let hidden = 0;
  if (badEdges.length) {
    const chains = edgeChains(part, badEdges).filter(c => { const tr = c.flatMap(e => [e.A, e.B]); const inside = tr.filter(t => badSet.has(t)).length / tr.length; if (inside >= 0.8) { hidden++; return false; } return true; });
    chains.forEach((c, i) => { const tris = [...new Set(c.flatMap(e => [e.A, e.B]))]; const L = c.reduce((a, e) => a + e.len, 0); const R = cornerRadius(L, P.ld[0]);
      out.push(F('fail', 'Internal corners', `Sharp internal corner ${i + 1}`, `R0 along ${fmt(L, 1)} mm`, 'A rotating cutter always leaves its own radius in an internal corner that runs along the tool axis. This sharp corner cannot be cut as modelled; it comes out with the tool radius or needs EDM.', `Add R${fmt(R.r, 1)} (fits a Ø${R.d} cutter reaching ${fmt(L, 1)} mm deep at ${P.ld[0]}×D). R${fmt(R.ideal, 1)} or more machines fastest.`, tris, { focus: mul(add(c[0].pa, c[c.length - 1].pb), 0.5), steps: STEPS.corner(R, L) })); });
    if (hidden) { const acc0 = out.find(f => f.cat === 'Tool access' && f.status === 'fail'); if (acc0) acc0.why += ` ${hidden} sharp internal corner${hidden > 1 ? 's' : ''} inside these areas are covered by this finding.`; }
    if (!chains.length) out.push(F('pass', 'Internal corners', 'Sharp internal corners', 'Only inside unreachable areas', '', ''));
  } else out.push(F('pass', 'Internal corners', 'Sharp internal corners', 'None that block machining', 'Every concave sharp edge can be formed by the flat end of a cutter.', ''));
  // internal radii (fillets / corner radii)
  for (const g of part.features.radii) {
    const ld = g.depth / (2 * g.r), s = g.r < 0.2 ? 'fail' : (g.r < 0.4 || ld > P.ld[1]) ? 'warn' : ld > P.ld[0] ? 'warn' : 'pass';
    if (s === 'pass') continue;
    out.push(F(s, 'Internal corners', `Internal radius R${fmt(g.r, 2)}`, `R${fmt(g.r, 2)} × ${fmt(g.depth, 1)} mm deep → L:D ${fmt(ld, 1)}`, `This radius limits the cutter to Ø${fmt(2 * g.r, 2)} mm. ${P.n} cuts up to about ${P.ld[0]}× diameter normally and ${P.ld[1]}× with long-reach tools.`, `Increase to R${fmt(cornerRadius(g.depth, P.ld[0]).r, 1)} or more.`, g.tris, { focus: g.mid, steps: STEPS.radius(cornerRadius(g.depth, P.ld[0]), g) }));
  }
  // holes and threads, identical holes grouped
  for (const grp of holeGroups(part)) {
    const s = grp[0], h = s.main, depth = h.depth, ratio = depth / h.d, n = grp.length, tris = grp.flatMap(x => x.tris);
    const st = h.d < 1 ? 'warn' : ratio > 10 ? 'fail' : ratio > 4 ? 'warn' : 'pass';
    const thr = s.thread ? (s.threadKind === 'tap' ? ` · tap drill for ${s.thread.n}` : s.threadKind === 'nominal' ? ` · modelled at ${s.thread.n} major Ø` : ` · ${s.thread.n} clearance`) : '';
    const desc = s.kind === 'plain' ? 'Hole' : s.kind === 'counterbored' ? `Counterbored hole (Ø${fmt(s.steps[0].d, 2)})` : `Countersunk hole (${fmt(2 * s.cones[0].halfAngle, 0)}°)`;
    out.push(F(st, 'Holes', `${n > 1 ? n + '× ' : ''}${desc} Ø${fmt(h.d, 2)}`, `${s.through ? 'Through' : 'Blind'}, ${fmt(depth, 2)} mm → ${fmt(ratio, 1)}×D${thr}`, 'Standard drills work to 4×D, peck drilling to 10×D, beyond that needs gun drilling.' + (h.d < 1 ? ' Drills under Ø1 mm break easily.' : ''), st === 'pass' ? '' : `Keep depth under ${fmt(4 * h.d, 1)} mm or enlarge the hole.`, tris, { focus: h.mid, hole: s, count: n, steps: st === 'pass' ? [] : STEPS.deepHole(h, s) }));
    if (s.threadKind === 'tap') {
      const T = s.thread, eng = depth / T.d, ts = !s.through && depth < 1.5 * T.d ? 'warn' : eng < 1 ? 'warn' : 'pass';
      out.push(F(ts, 'Threads', `${n > 1 ? n + '× ' : ''}Threadable feature ${T.n}×${T.p}`, `Ø${fmt(h.d, 2)} tap drill, ${fmt(depth, 2)} mm (${fmt(eng, 1)}×D engagement)`, `Diameter matches the ISO ${T.n} coarse tap drill (Ø${T.tap}). Engagement of 1.5×D to 2×D is typical; more than 3×D adds no strength.`, ts === 'pass' ? '' : 'Lengthen engagement to 1.5×D, use a helicoil insert, or use a through bolt and nut.', tris, { focus: h.mid, hole: s, count: n, steps: ts === 'pass' ? [] : STEPS.thread(T) }));
    } else if (s.threadKind === 'nominal') out.push(F('warn', 'Threads', `${n > 1 ? n + '× ' : ''}Hole at ${s.thread.n} major diameter`, `Ø${fmt(h.d, 2)}`, 'The hole is modelled at the thread major diameter, which usually means a cosmetic thread. The shop needs the tap drill size and thread callout on the drawing.', `Model the tap drill Ø${s.thread.tap} or confirm the ${s.thread.n} callout on the drawing.`, tris, { focus: h.mid, hole: s, count: n }));
  }
  // thin walls
  const th = thicknessMap(part); const lim = M.metal ? [0.5, 0.8] : [1.0, 1.5]; const thin = [];
  for (let t = 0; t < part.nT; t++) if (th[t] < lim[1]) thin.push(t);
  if (thin.length) cluster(part, thin).filter(g => areaOf(part, g) > part.area * 2e-4).forEach((g, i) => { let m = Infinity; g.forEach(t => m = Math.min(m, th[t])); out.push(F(m < lim[0] ? 'fail' : 'warn', 'Walls', `Thin wall ${i + 1}`, `${fmt(m, 2)} mm`, `${M.metal ? 'Metal' : 'Plastic'} walls under ${lim[1]} mm chatter and deflect when cut; under ${lim[0]} mm they often break.`, `Thicken to ${lim[1]} mm or more, or add stiffening ribs.`, g, { focus: centroidOf(part, g), steps: STEPS.thin(lim[1], m) })); });
  else out.push(F('pass', 'Walls', 'Wall thickness', `No walls under ${lim[1]} mm`, 'Measured by casting rays through the part from every surface.', ''));
  if (M.mach > 1.5) out.push(F('info', 'Material', M.n, `Machinability factor ${M.mach}× aluminium`, 'Harder or tougher material means slower feeds and more tool wear.', ''));
  out.push(isoClassFinding(P.iso, opt.iso || 'mK', part, P.n));
  return out;
}

function analyzeAM(part, opt) {
  const T0 = AM[opt.tech] || AM.fdm, out = []; const mats = AM_MATS[opt.tech] || AM_MATS.fdm; const mat = mats.find(m => m[0] === opt.amMat) || mats[0]; const k = mat[4] || 1;
  const T = Object.assign({}, T0, { wall: T0.wall.map(x => x * k), hole: T0.hole.map(x => x * k), n: T0.n + ', ' + mat[1] }); const b = norm(opt.build || thinAxis(part));
  out.push(envelopeCheck(part, T.env, T.n));
  const th = thicknessMap(part); const thin = [];
  for (let t = 0; t < part.nT; t++) if (th[t] < T.wall[1]) thin.push(t);
  if (thin.length) cluster(part, thin).filter(g => areaOf(part, g) > part.area * 2e-4).forEach((g, i) => { let m = Infinity; g.forEach(t => m = Math.min(m, th[t])); out.push(F(m < T.wall[0] ? 'fail' : 'warn', 'Walls', `Thin wall ${i + 1}`, `${fmt(m, 2)} mm`, `${T.n} prints walls from ${fmt(T.wall[0], 2)} mm; ${fmt(T.wall[1], 2)} mm is reliable.`, `Thicken to ${fmt(T.wall[1], 2)} mm.`, g, { focus: centroidOf(part, g), steps: STEPS.thin(T.wall[1], m) })); });
  else out.push(F('pass', 'Walls', 'Wall thickness', `No walls under ${T.wall[1]} mm`, 'Measured by ray casting through the part.', ''));
  for (const grp of holeGroups(part)) { const s = grp[0], d = s.main.d; if (d < T.hole[1]) out.push(F(d < T.hole[0] ? 'fail' : 'warn', 'Holes', `${grp.length > 1 ? grp.length + '× ' : ''}Small hole Ø${fmt(d, 2)}`, `${s.through ? 'Through' : 'Blind'}${s.thread && s.threadKind === 'tap' ? ', ' + s.thread.n + ' tap drill' : ''}`, `Holes under Ø${T.hole[0]} mm close up or print oval on ${T.n}.`, s.threadKind === 'tap' ? 'Print undersize and tap, or use heat-set inserts.' : 'Print undersize and drill to size, or enlarge.', grp.flatMap(x => x.tris), { focus: s.main.mid, steps: STEPS.amHole(s, T) })); }
  if (T.ovh != null) {
    const s = Math.sin(T.ovh * DEG), base = Math.min(...[0, 1, 2].map(i => 0)); const proj = t => dot([part.TC[t * 3], part.TC[t * 3 + 1], part.TC[t * 3 + 2]], b);
    let floor = Infinity; for (let t = 0; t < part.nT; t++) floor = Math.min(floor, proj(t));
    const ov = []; for (let t = 0; t < part.nT; t++) { const nz = dot([part.TN[t * 3], part.TN[t * 3 + 1], part.TN[t * 3 + 2]], b); if (nz < 0 && -nz > s && proj(t) > floor + part.diag * 0.002) ov.push(t); }
    const a = areaOf(part, ov); out.push(F(ov.length ? (a / part.area > 0.15 ? 'warn' : 'info') : 'pass', 'Supports', 'Overhangs needing support', `${fmt(a / part.area * 100, 1)} % of surface`, `${T.n} self-supports up to about ${T.ovh}° from vertical. Steeper down-facing surfaces need supports that leave marks.`, ov.length ? 'Reorient the part or add 45° chamfers under ledges.' : '', ov, ov.length ? { focus: centroidOf(part, ov), steps: STEPS.overhang(T.ovh) } : {}));
  } else out.push(F('pass', 'Supports', 'Overhangs', 'Self-supporting in powder', `${T.n} needs no support structures.`, ''));
  const voids = part.shells.filter(s => s.vol < 0);
  if (voids.length) out.push(F(T.drain ? 'fail' : 'info', 'Cavities', 'Enclosed internal void', `${voids.length} sealed cavity`, T.drain ? 'Sealed cavities trap resin or unfused powder.' : 'FDM fills sealed cavities with infill, which is fine.', T.drain ? 'Add two escape holes of Ø3.5 to 5 mm.' : '', voids.flatMap(v => v.tris), { steps: T.drain ? STEPS.void() : [] }));
  out.push(F('info', 'Material', mat[1], `about ${fmt(part.vol / 1000 * mat[2], 1)} g`, mat[3] + (k > 1 ? ' Wall and hole limits are raised by 50 % for this flexible material.' : ''), ''));
  out.push(isoClassFinding(T.iso, opt.iso || 'mK', part, T.n));
  return out;
}

function draftName(part, g, i) {
  const cnt = {}; g.forEach(t => { const f = part.faces[part.faceOf[t]]; const k = f.type === 'cyl' ? (f.concave ? 'hole' : 'outer') + '|' + fmt(2 * f.r, 2) : f.type; cnt[k] = (cnt[k] || 0) + part.TA[t]; });
  const k = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]; const [ty, d] = k.split('|');
  return ty === 'hole' ? `Hole Ø${d} has no draft` : ty === 'outer' ? `Outer wall Ø${d} has no draft` : ty === 'plane' ? 'Flat wall has no draft' : 'Curved wall has no draft';
}
function analyzeCast(part, opt) {
  const C0 = CAST[opt.cast] || CAST.die, out = []; const al = (CAST_ALLOYS[opt.cast] || CAST_ALLOYS.die).find(a => a[0] === opt.alloy) || (CAST_ALLOYS[opt.cast] || CAST_ALLOYS.die)[0];
  const C = Object.assign({}, C0, { wall: al[3], n: C0.n }); const p = norm(opt.pull || thinAxis(part));
  out.push(envelopeCheck(part, C.env, C.n));
  const drilled = new Set(part.features.stacks.filter(s => s.main.d < C.core - 0.01).flatMap(s => s.tris));
  // draft
  if (C.draft[1] > 0) {
    const low = []; const sn = Math.sin(C.draft[1] * DEG);
    for (let t = 0; t < part.nT; t++) { if (drilled.has(t)) continue; const c = Math.abs(dot([part.TN[t * 3], part.TN[t * 3 + 1], part.TN[t * 3 + 2]], p)); if (c < sn) low.push(t); }
    const groups = cluster(part, low).filter(g => areaOf(part, g) > part.area * 1e-3);
    groups.forEach((g, i) => { let m = 90; g.forEach(t => m = Math.min(m, Math.asin(Math.abs(dot([part.TN[t * 3], part.TN[t * 3 + 1], part.TN[t * 3 + 2]], p))) / DEG)); out.push(F(m < C.draft[0] ? 'fail' : 'warn', 'Draft', draftName(part, g, i), `${fmt(m, 1)}° on ${fmt(areaOf(part, g), 0)} mm²`, `${C.n} needs about ${C.draft[1]}° draft on walls parallel to the pull direction so the casting releases.`, `Add ${C.draft[1]}° on outside walls and ${C.draft[1] * 2}° on inside walls and cores.`, g, { focus: centroidOf(part, g), steps: STEPS.draft(C, p) })); });
    if (!groups.length) out.push(F('pass', 'Draft', 'Draft angles', `All walls ≥ ${C.draft[1]}°`, '', ''));
  } else out.push(F('pass', 'Draft', 'Draft', 'Not required', 'The wax pattern is melted out, so zero draft is acceptable.', ''));
  // undercuts relative to pull
  const { acc } = accessMap(part, [p, mul(p, -1)], false); const uc = []; for (let t = 0; t < part.nT; t++) if (acc[t] === -1 && !drilled.has(t)) uc.push(t);
  if (uc.length) cluster(part, uc).filter(g => areaOf(part, g) > part.area * 5e-4).forEach((g, i) => out.push(F(opt.cast === 'die' ? 'warn' : 'info', 'Undercuts', `Undercut ${i + 1}`, `${fmt(areaOf(part, g), 0)} mm²`, 'This surface is hidden from both halves of the mould along the pull direction.', opt.cast === 'die' ? 'Each undercut needs a side action, adding tooling cost. Redesign to pull straight where possible.' : 'Form it with a core, or machine it afterwards.', g, { focus: centroidOf(part, g), steps: STEPS.undercut(opt.cast) })));
  // walls
  const th = thicknessMap(part); const vals = []; for (let t = 0; t < part.nT; t++) if (th[t] > 0) vals.push(th[t]); vals.sort((a, b) => a - b);
  const pct = q => vals.length ? vals[Math.min(vals.length - 1, Math.floor(q * vals.length))] : NaN; const med = pct(0.5);
  const thin = []; for (let t = 0; t < part.nT; t++) if (th[t] < C.wall) thin.push(t);
  cluster(part, thin).filter(g => areaOf(part, g) > part.area * 2e-4).forEach((g, i) => { let m = Infinity; g.forEach(t => m = Math.min(m, th[t])); out.push(F(m < C.wall * 0.75 ? 'fail' : 'warn', 'Walls', `Thin section ${i + 1}`, `${fmt(m, 2)} mm`, `${C.n} fills reliably from about ${C.wall} mm. Thinner sections freeze early and misrun.`, `Thicken to ${C.wall} mm.`, g, { focus: centroidOf(part, g), steps: STEPS.thin(C.wall, m) })); });
  const thick = []; for (let t = 0; t < part.nT; t++) if (th[t] > 2.5 * med) thick.push(t);
  const ratio = pct(0.95) / pct(0.1);
  out.push(F(ratio <= 2 ? 'pass' : ratio <= 3 ? 'warn' : 'fail', 'Walls', 'Wall uniformity', `95th / 10th percentile = ${fmt(ratio, 1)}`, 'Thick sections cool last and pull metal from thin ones, leaving shrinkage porosity.', ratio > 2 ? 'Core out thick bosses and blend thickness changes.' : '', thick, thick.length ? { focus: centroidOf(part, thick), steps: STEPS.uniform(pct(0.1)) } : {}));
  const se = sharpEdges(part); if (se.length) { const tris = [...new Set(se.flatMap(e => [e.A, e.B]))]; out.push(F('warn', 'Fillets', 'Sharp internal corners', `${se.length} concave edges`, 'Sharp internal corners are hot spots that crack and erode tooling.', `Fillet internal corners with R ≈ half the wall, about R${fmt(Math.max(0.5, med / 2), 1)} here.`, tris, { focus: centroidOf(part, tris), steps: STEPS.castFillet(med) })); }
  for (const grp of holeGroups(part)) { const s = grp[0]; if (s.main.d < C.core - 0.01) out.push(F('info', 'Holes', `${grp.length > 1 ? grp.length + '× ' : ''}Hole Ø${fmt(s.main.d, 2)}`, 'Below cored-hole minimum, drill after casting', `${C.n} cores holes from about Ø${C.core} mm; smaller holes are cast solid and drilled. They are left out of the draft and undercut checks.`, '', grp.flatMap(x => x.tris), { focus: s.main.mid })); }
  out.push(F('info', 'Material', al[1], `about ${fmt(part.vol / 1000 * al[2], 0)} g`, `Minimum castable wall for this alloy in ${C.n.toLowerCase()} is about ${al[3]} mm.`, ''));
  out.push(isoClassFinding(C.iso, opt.iso || 'mK', part, C.n));
  return out;
}

function thinAxis(part) { const i = part.size.indexOf(Math.min(...part.size)); const a = [0, 0, 0]; a[i] = 1; return a; }
function analyze(part, process, opt) {
  opt = opt || {};
  let f;
  if (process === 'am') f = analyzeAM(part, opt); else if (process === 'cast') f = analyzeCast(part, opt); else f = analyzeCNC(part, process, opt);
  if (part.openEdges) f.unshift(F('warn', 'Model', 'Model is not watertight', `${part.openEdges} open edges`, 'Gaps in the surface make thickness and access results less reliable.', 'Export as a closed solid (STEP) from CAD.'));
  f = mergeFindings(f);
  f.forEach((x, i) => x.id = 'f' + i);
  return f;
}



// ---------------- ISO standards checklist ----------------
function standardsChecks(text, ctx) {
  const T = String(text || '').replace(/\s+/g, ' ').toUpperCase(); const out = []; const S = (std, title, status, note) => out.push({ std, title, status, note });
  const has = re => re.test(T); const pdf = !!T.trim(); const dims = ctx.dims || 0;
  S('ISO 128', 'Presentation, line types and views', ctx.aiDone ? 'pass' : 'manual', ctx.aiDone ? 'Checked by the AI drawing review' : 'Line types and view layout need a visual check. Run the AI drawing review.');
  S('ISO 129-1', 'Dimensioning', !pdf ? 'manual' : dims >= 3 ? 'pass' : 'fail', !pdf ? 'No text layer to read' : dims >= 3 ? `${dims} dimensions found` : 'No dimensions on the views');
  const sh = T.match(/\bA([0-4])\b/); S('ISO 216', 'Sheet size, A series', !pdf ? 'manual' : sh ? 'pass' : 'warn', sh ? `A${sh[1]}` : 'Sheet size not stated');
  const sc = T.match(/SCALE\s*:?\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/); const ok = ['1:1', '2:1', '5:1', '10:1', '20:1', '50:1', '1:2', '1:5', '1:10', '1:20', '1:50', '1:100', '1:200', '1:500', '1:1000']; const scs = sc ? `${+sc[1]}:${+sc[2]}` : '';
  S('ISO 5455', 'Scale', !pdf ? 'manual' : !sc ? 'warn' : ok.includes(scs) ? 'pass' : 'warn', sc ? `${scs}${ok.includes(scs) ? ' is a recommended scale' : ' is not a recommended scale'}` : 'No scale found');
  const proj = has(/FIRST\s*ANGLE/) ? 'first' : has(/THIRD\s*ANGLE/) ? 'third' : null;
  S('ISO 5456-2', 'Projection method and symbol', !pdf ? 'manual' : !proj ? 'fail' : (ctx.projection && proj !== ctx.projection) ? 'fail' : 'pass', proj ? `${proj} angle${ctx.projection && proj !== ctx.projection ? `, but you use ${ctx.projection} angle` : ''}` : 'Not stated');
  S('ISO 1101', 'Geometrical tolerancing', ctx.fcfIssues ? 'fail' : ctx.fcf ? 'pass' : 'manual', ctx.fcf ? `${ctx.fcf} frames checked${ctx.fcfIssues ? `, ${ctx.fcfIssues} rule problems` : ''}` : 'No frames in the text layer. GD&T drawn as graphics needs the AI review.');
  S('ISO 5459', 'Datums and datum systems', ctx.fcf ? (has(/DATUM/) || ctx.datums ? 'pass' : 'warn') : 'na', ctx.fcf ? 'Every referenced datum letter needs a datum feature symbol on the drawing' : 'No geometric tolerances');
  const g = T.match(/ISO\s*2768\s*[-–]?\s*\(?\s*([FMCV])\s*([HKL])?/); S('ISO 2768', 'General tolerances', !pdf ? 'manual' : g ? (g[2] ? 'pass' : 'warn') : 'fail', g ? `ISO 2768-${g[1].toLowerCase()}${g[2] || ''}${g[2] ? '' : ', geometric class missing'}` : 'No general tolerance note');
  S('ISO 7083', 'Symbol proportions', 'manual', 'Check that GD&T symbols and frames follow standard proportions.');
  const f7200 = [['title', /TITLE/], ['identification number', /DWG\.?\s*NO|DRAWING\s*(NO|NUMBER)|PART\s*(NO|NUMBER)|DOC(UMENT)?\s*(NO|NUMBER|ID)/], ['legal owner', /©|COPYRIGHT|PROPERTY OF|ALL RIGHTS RESERVED/], ['date of issue', /\bDATE\b|\d{2}[\/.-]\d{2}[\/.-]\d{2,4}/], ['creator', /DRAWN|CREATED/], ['approval person', /APPROVED/], ['document type', /DETAIL DRAWING|ASSEMBLY DRAWING|PART DRAWING|DOCUMENT TYPE|DRAWING TYPE/], ['revision', /\bREV(ISION)?\b/], ['sheet number', /SHEET\s*\d+\s*(OF|\/)\s*\d+/]];
  const miss = f7200.filter(([, re]) => !has(re)).map(x => x[0]); S('ISO 7200', 'Title block data fields', !pdf ? 'manual' : !miss.length ? 'pass' : miss.length <= 2 ? 'warn' : 'fail', miss.length ? `Missing: ${miss.join(', ')}` : 'All required fields present');
  S('ISO 13567', 'CAD layer naming', 'na', 'Applies to native CAD files, not to PDF or STEP.');
  S('ISO 10303 (STEP)', 'Model exchange format', ctx.stepSchema ? 'pass' : ctx.hasModel ? 'warn' : 'na', ctx.stepSchema ? `${ctx.stepSchema}${ctx.stepSystem ? ', exported from ' + ctx.stepSystem : ''}` : ctx.hasModel ? 'Model is not STEP, so feature precision is lower' : 'No model loaded');
  S('ISO 965 / ISO 6410', 'Thread designation and representation', ctx.threads ? (has(/-\s*6[HG]\b/) ? 'pass' : 'warn') : 'na', ctx.threads ? 'State tolerance class (6H) and thread depth, e.g. M3-6H THRU' : 'No threads called out');
  S('ISO 286', 'Limits and fits', ctx.fits ? 'pass' : 'na', ctx.fits ? `${ctx.fits} fit classes read and converted to limits` : 'No fit classes such as H7 or g6 on the drawing');
  S('ISO 21920 / ISO 1302', 'Surface texture', has(/\bRA\b|SURFACE\s*(FINISH|TEXTURE|ROUGHNESS)|ISO\s*(1302|21920)/) ? 'pass' : 'warn', has(/\bRA\b/) ? 'Ra specified' : 'No surface texture requirement');
  S('ISO 13715', 'Edges of undefined shape', has(/13715/) ? 'pass' : 'warn', has(/13715/) ? 'Edge symbol used' : has(/DEBURR|SHARP EDGE|BREAK/) ? 'Text note only. Give the edge limits with the ISO 13715 symbol, e.g. −0.1 to −0.3' : 'No edge condition stated');
  S('ISO 9001', 'Document control', has(/\bREV(ISION)?\b/) && ctx.approved ? 'pass' : 'fail', has(/\bREV(ISION)?\b/) ? (ctx.approved ? 'Revision and approval present' : 'Revision present, approval blank') : 'No revision control on the drawing');
  S('ISO 10204', 'Material certificate', has(/10204|3\.1\s*CERT|MILL\s*CERT/) ? 'pass' : 'warn', has(/10204/) ? 'Certificate type stated' : 'State the certificate type, e.g. "Material certificate EN 10204 3.1"');
  const weld = has(/WELD|ISO\s*2553|ISO\s*13920/);
  S('ISO 13920', 'Welding general tolerances', weld ? (has(/13920/) ? 'pass' : 'warn') : 'na', weld ? 'Welded part: state the class, e.g. ISO 13920-BF' : 'No welding on this drawing');
  S('ISO 15614', 'Welding procedure (WPS and PQR)', weld ? (has(/WPS|15614/) ? 'pass' : 'warn') : 'na', weld ? 'Reference the qualified welding procedure' : 'No welding on this drawing');
  const thermal = has(/LASER|PLASMA|FLAME CUT|THERMAL CUT|9013/);
  S('ISO 9013', 'Thermal cutting quality', thermal ? (has(/9013/) ? 'pass' : 'warn') : 'na', thermal ? 'State the cut quality, e.g. ISO 9013-342' : 'No thermally cut edges noted');
  const paint = has(/PAINT|PRIMER|POWDER COAT/);
  S('ISO 8501-1', 'Surface preparation before painting', paint ? (has(/SA\s*2|8501/) ? 'pass' : 'warn') : 'na', paint ? 'State the blast grade, e.g. Sa 2½' : 'No paint on this drawing');
  return out;
}

// ---------------- inspection plan (balloons + ITP) ----------------
function gaugeFor(kind, tol, internal) {
  if (kind === 'thread') return 'Thread plug gauge GO / NO-GO';
  if (kind === 'gdt') return 'CMM';
  if (kind === 'ang') return tol < 0.25 ? 'CMM' : 'Protractor or CMM';
  if (kind === 'rad') return 'Radius gauge or optical comparator';
  if (tol < 0.01) return 'CMM in a temperature controlled room';
  if (tol < 0.025) return internal ? 'Bore gauge or CMM' : 'Micrometer or CMM';
  if (tol < 0.1) return internal ? 'Pin gauge or bore gauge' : 'Micrometer';
  return 'Vernier caliper';
}
function inspectionPlan(text, items, ctx) {
  const rows = []; const iso = (ctx.iso || 'mK')[0]; const add = (r) => { r.n = rows.length + 1; rows.push(r); };
  const dims = parseDrawingDims(items);
  dims.forEach(d => { let tol = d.tol; let src = 'Stated';
    if (!tol) { if (d.kind === 'ang') { tol = ISO2768.angFor(iso, 20) / 60; src = `ISO 2768-${iso}`; } else { tol = d.kind === 'rad' ? (ISO2768.radFor(iso, d.v) || 0.2) : (ISO2768.linFor(iso, d.v) || 0.1); src = `ISO 2768-${iso}`; } }
    const unit = d.kind === 'ang' ? '°' : 'mm'; const nm = (d.kind === 'dia' ? 'Ø' : d.kind === 'rad' ? 'R' : '') + fmt(d.v, 3) + (d.kind === 'ang' ? '°' : '');
    const sg = x => (x >= 0 ? '+' : '') + fmt(x, 3); const dev = d.up != null && d.up !== -d.lo;
    add({ char: `${d.qty > 1 ? d.qty + '× ' : ''}${d.kind === 'dia' ? 'Diameter' : d.kind === 'rad' ? 'Radius' : d.kind === 'ang' ? 'Angle' : 'Length'} ${nm}${d.cls ? ' ' + d.cls : ''}`, nominal: d.v, unit, tol: dev ? `${sg(d.up)} / ${sg(d.lo)}` : `±${fmt(tol, 3)}`, lsl: fmt(d.v + (dev ? d.lo : -tol), 4), usl: fmt(d.v + (dev ? d.up : tol), 4), src: d.up != null ? 'Stated' : src, method: gaugeFor(d.kind, tol, d.kind === 'dia'), freq: 'First article 100 %, then per sampling plan', type: tol < 0.025 ? 'Hold' : 'Review', box: [d.it.x, d.it.y, d.it.w, d.it.h] }); });
  const T = String(text).toUpperCase(); const tre = /(\d+)\s*[X×]\s*(M\d+(?:\.\d+)?)(?:\s*[X×]\s*(\d+(?:\.\d+)?))?(?:\s*-\s*(\d[GHgh]))?\s*(THRU(?:\s*ALL)?|\d+(?:\.\d+)?\s*DEEP)?/g; let m;
  while ((m = tre.exec(T))) { const it = items.find(i => i.str.toUpperCase().includes(m[2])); add({ char: `${m[1]}× thread ${m[2]}${m[3] ? '×' + m[3] : ''}-${m[4] || '6H'} ${m[5] || ''}`.trim(), nominal: m[2], unit: '', tol: m[4] || '6H', lsl: '', usl: '', src: m[4] ? 'Stated' : 'ISO 965 default', method: gaugeFor('thread'), freq: 'Every part (100 %)', type: 'Witness', box: it ? [it.x, it.y, it.w, it.h] : null }); }
  fcfGroups(items).groups.forEach(f => { const b = f.cells[0]; add({ char: `${f.type[0].toUpperCase() + f.type.slice(1)} ${f.dia ? 'Ø' : ''}${f.val || ''}${f.datums.length ? ' to ' + f.datums.join('-') : ''}`, nominal: 0, unit: 'mm', tol: f.val ? (f.dia ? 'Ø' : '') + f.val : '', lsl: '', usl: f.val || '', src: 'Stated', method: gaugeFor('gdt'), freq: 'First article 100 %, then per sampling plan', type: 'Hold', box: [b.x, b.y, b.w, b.h] }); });
  items.forEach(i => { const m = i.str.trim().match(/^\(?N(1[0-2]|[1-9])\)?$/); if (m && !i.border) add({ char: `Surface finish N${m[1]} (Ra ${FINISH_RA['N' + m[1]]} µm)`, nominal: FINISH_RA['N' + m[1]], unit: 'µm Ra', tol: 'max', lsl: '', usl: FINISH_RA['N' + m[1]], src: 'Stated', method: 'Roughness tester (ISO 21920)', freq: 'First article, then per batch', type: 'Review', box: [i.x, i.y, i.w, i.h] }); });
  const note = (re, char, method, type) => { const it = items.find(i => re.test(i.str.toUpperCase())); if (it || re.test(T)) add({ char, nominal: '', unit: '', tol: '', lsl: '', usl: '', src: 'Note', method, freq: 'Every batch', type, box: it ? [it.x, it.y, it.w, it.h] : null }); };
  note(/ALUMIN|STEEL|STAINLESS|BRASS|TITAN|NYLON|POM|PEEK/, `Material${(T.match(/MATERIAL\s+([A-Z0-9 \-]+?)\s{2}/) || [])[1] ? '' : ''} as specified`, 'Material certificate (ISO 10204 3.1)', 'Review');
  note(/DEBURR|SHARP EDGE|BREAK/, 'Edges deburred, no sharp edges', 'Visual and touch', 'Review');
  note(/\bRA\b|SURFACE FINISH/, 'Surface texture', 'Roughness tester', 'Review');
  note(/ANODI|PLAT|COAT|PAINT|PHOSPHAT|BLACK OXIDE|ZINC/, 'Finish or coating', 'Visual and coating thickness gauge', 'Review');
  note(/HRC|\bHV\s?\d|HARDNESS|HARDEN/, 'Hardness after heat treatment', 'Hardness tester (Rockwell or Vickers) on a test piece or the part', 'Witness');
  if (ctx.part) { const kd = keyDims(ctx.part).filter(k => k.main); const used = matchDims(dims, kd).used;
    kd.filter(k => !used.has(k)).forEach(k => { const tol = k.kind === 'rad' ? (ISO2768.radFor(iso, k.v) || 0.2) : (ISO2768.linFor(iso, k.v) || 0.1); add({ char: k.label, nominal: k.v, unit: 'mm', tol: `±${fmt(tol, 3)}`, lsl: fmt(k.v - tol, 3), usl: fmt(k.v + tol, 3), src: `From 3D model, missing on drawing (ISO 2768-${iso})`, method: gaugeFor(k.kind, tol, k.kind === 'dia'), freq: 'First article 100 %', type: 'Review', box: null, fromModel: true }); }); }
  return rows;
}


// ---------------- view outlines for drawing comparison ----------------
// For 6 viewing directions: visible silhouette and B-rep feature edges, sampled and projected to 2D (model mm)
function viewOutlines(part, maxPts) {
  maxPts = maxPts || 5000;
  const segs = [];
  part.edges.forEach(e => { if (e.tris.length !== 2) return; const [A, B] = e.tris; segs.push({ a: vpos(part, e.a), b: vpos(part, e.b), A, B, brep: part.faceOf[A] !== part.faceOf[B] }); });
  const N = t => [part.TN[t * 3], part.TN[t * 3 + 1], part.TN[t * 3 + 2]];
  const step = Math.max(0.15, part.diag / 400), eps = part.diag * 3e-4;
  const DIRS = [[0, 1, 0, 'front, looking along +Y'], [0, -1, 0, 'rear, looking along −Y'], [-1, 0, 0, 'right, looking along −X'], [1, 0, 0, 'left, looking along +X'], [0, 0, -1, 'top, looking down −Z'], [0, 0, 1, 'bottom, looking up +Z']];
  return DIRS.map(([x, y, z, name]) => {
    const d = [x, y, z], up = Math.abs(z) > 0.5 ? [0, 1, 0] : [0, 0, 1], right = cross(d, up);
    const pts = [];
    for (const s of segs) {
      const dA = dot(N(s.A), d), dB = dot(N(s.B), d);
      const sil = (dA < -1e-4) !== (dB < -1e-4);
      let feat = false; if (!sil && s.brep && (dA < -1e-4 || dB < -1e-4)) { const c = dot(N(s.A), N(s.B)); feat = c < Math.cos(12 * DEG); }
      if (!sil && !feat) continue;
      const v = sub(s.b, s.a), L = len(v); const along = Math.abs(dot(v, d)) / (L || 1); if (along > 0.98) continue;
      const n = Math.max(1, Math.ceil(L / step));
      for (let i = 0; i <= n; i++) { const p = add(s.a, mul(v, i / n)); const o = sub(p, mul(d, eps)); if (rayCast(part.bvh, o, mul(d, -1), part.diag * 3, true, -1)) continue; pts.push(dot(p, right), dot(p, up)); }
    }
    // thin out evenly
    let P = pts; const cnt = P.length / 2; if (cnt > maxPts) { const k = cnt / maxPts; const Q = []; for (let i = 0; i < maxPts; i++) { const j = Math.floor(i * k); Q.push(P[j * 2], P[j * 2 + 1]); } P = Q; }
    return { d, up, right, name, pts: new Float32Array(P) };
  });
}

// match drawing ink against projected model views.
// ink: Uint8Array grid (1 = ink), gw, gh, cell (mm per cell); regions found here; tScale = title block scale or null
function matchViews(ink, gw, gh, cell, outlines, opt) {
  opt = opt || {}; const tScale = opt.scale || null, mask = opt.mask || null;
  // distance transform (chamfer 3-4), in cells
  const INF = 1e9, dt = new Float32Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) dt[i] = ink[i] ? 0 : INF;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const i = y * gw + x; let v = dt[i]; if (x > 0) v = Math.min(v, dt[i - 1] + 3); if (y > 0) { v = Math.min(v, dt[i - gw] + 3); if (x > 0) v = Math.min(v, dt[i - gw - 1] + 4); if (x < gw - 1) v = Math.min(v, dt[i - gw + 1] + 4); } dt[i] = v; }
  for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) { const i = y * gw + x; let v = dt[i]; if (x < gw - 1) v = Math.min(v, dt[i + 1] + 3); if (y < gh - 1) { v = Math.min(v, dt[i + gw] + 3); if (x < gw - 1) v = Math.min(v, dt[i + gw + 1] + 4); if (x > 0) v = Math.min(v, dt[i + gw - 1] + 4); } dt[i] = v; }
  for (let i = 0; i < dt.length; i++) dt[i] /= 3;
  // regions: dilate ink, connected components
  const R = Math.max(2, Math.round(2 / cell)); const dil = new Uint8Array(gw * gh);
  for (let i = 0; i < dt.length; i++) if (dt[i] <= R && !(mask && mask[i])) dil[i] = 1;
  const lab = new Int32Array(gw * gh).fill(-1), regs = [];
  for (let i = 0; i < dil.length; i++) { if (!dil[i] || lab[i] >= 0) continue; const st = [i]; lab[i] = regs.length; let x0 = gw, y0 = gh, x1 = 0, y1 = 0, cnt = 0, ink0 = 0;
    while (st.length) { const j = st.pop(); const x = j % gw, y = (j / gw) | 0; cnt++; if (ink[j]) ink0++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const k of [j - 1, j + 1, j - gw, j + gw]) if (k >= 0 && k < dil.length && dil[k] && lab[k] < 0 && Math.abs((k % gw) - x) <= 1) { lab[k] = regs.length; st.push(k); } }
    regs.push({ id: regs.length, x0, y0, x1, y1, cnt, ink: ink0 }); }
  let views = regs.filter(r => (r.x1 - r.x0) * cell >= 10 && (r.y1 - r.y0) * cell >= 10).map(r => { const area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1); let mk = 0; if (mask) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (mask[y * gw + x]) mk++; return Object.assign(r, { w: (r.x1 - r.x0) * cell, h: (r.y1 - r.y0) * cell, density: r.ink / area, masked: mk / area }); });
  views = views.filter(v => !views.some(o => o !== v && o.cnt > v.cnt && v.x0 >= o.x0 && v.x1 <= o.x1 && v.y0 >= o.y0 && v.y1 <= o.y1));
  // templates: 6 directions x 4 rotations, centred
  const T = []; outlines.forEach((o, di) => { if (o.pts.length < 20) return; for (let rot = 0; rot < 4; rot++) { const P = new Float32Array(o.pts.length); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < o.pts.length; i += 2) { let x = o.pts[i], y = o.pts[i + 1]; for (let r = 0; r < rot; r++) { const t = x; x = -y; y = t; } P[i] = x; P[i + 1] = -y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (-y < y0) y0 = -y; if (-y > y1) y1 = -y; }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; for (let i = 0; i < P.length; i += 2) { P[i] -= cx; P[i + 1] -= cy; } T.push({ di, rot, P, w: x1 - x0, h: y1 - y0 }); } });
  const cover = (P, s, ox, oy, stride, tol) => { let hit = 0, n = 0; for (let i = 0; i < P.length; i += 2 * stride) { const x = Math.round(ox + P[i] * s / cell), y = Math.round(oy + P[i + 1] * s / cell); n++; if (x < 0 || y < 0 || x >= gw || y >= gh) continue; if (dt[y * gw + x] <= tol) hit++; } return n ? hit / n : 0; };
  views.forEach(v => {
    v.kind = v.masked > 0.3 ? 'text' : Math.max(v.w, v.h) / Math.max(1, Math.min(v.w, v.h)) > 8 ? 'line' : v.density > 0.15 ? 'pictorial' : 'ortho'; if (v.kind !== 'ortho') return;
    const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2; let cands = [];
    for (const t of T) {
      if (t.w < 1e-6 && t.h < 1e-6) continue;
      const sMax = Math.min(t.w > 0.5 ? v.w / t.w : Infinity, t.h > 0.5 ? v.h / t.h : Infinity) * 1.04; if (!isFinite(sMax)) continue;
      const sc = []; for (let s = sMax; s >= sMax * 0.55; s /= 1.04) sc.push(s); if (tScale && tScale <= sMax && tScale >= sMax * 0.4) sc.push(tScale);
      const stride = Math.max(1, Math.floor(t.P.length / 2 / 160)), rr = Math.max(3, Math.round(Math.max(v.w, v.h) * 0.08 / cell));
      for (const s of sc) for (let dy = -rr; dy <= rr; dy += 2) for (let dx = -rr; dx <= rr; dx += 2) { const c = cover(t.P, s, cx + dx, cy + dy, stride, 1.6); if (c > 0.35) cands.push({ t, s, ox: cx + dx, oy: cy + dy, c }); }
    }
    cands.sort((a, b) => b.c - a.c); const seen = new Set(); cands = cands.filter(c => { const k = c.t.di + ':' + c.t.rot + ':' + Math.round(Math.log(c.s) * 20); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 14);
    // how much of the view's ink the template explains
    const inkCells = []; for (let y = v.y0; y <= v.y1; y++) for (let x = v.x0; x <= v.x1; x++) { const i = y * gw + x; if (ink[i] && lab[i] === v.id) inkCells.push(i); }
    const near = new Uint8Array(gw * gh); let stamp = 0; const marks = new Int32Array(gw * gh);
    const prec = (P, s, ox, oy) => { stamp++; for (let i = 0; i < P.length; i += 2) { const x = Math.round(ox + P[i] * s / cell), y = Math.round(oy + P[i + 1] * s / cell); for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) marks[yy * gw + xx] = stamp; } let h = 0; for (const i of inkCells) if (marks[i] === stamp) h++; return inkCells.length ? h / inkCells.length : 0; };
    let best = null;
    for (const c0 of cands) { let b = c0; const stride = Math.max(1, Math.floor(c0.t.P.length / 2 / 900));
      for (let k = 0.96; k <= 1.041; k += 0.01) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const s = c0.s * k, c = cover(c0.t.P, s, c0.ox + dx, c0.oy + dy, stride, 1.6); if (c > b.c) b = { t: c0.t, s, ox: c0.ox + dx, oy: c0.oy + dy, c }; }
      b.c = cover(b.t.P, b.s, b.ox, b.oy, 1, 1.6); b.p = prec(b.t.P, b.s, b.ox, b.oy); b.score = b.c * Math.sqrt(b.p); if (!best || b.score > best.score) best = b; }
    if (!best) { v.match = null; return; }
    const miss = []; const P = best.t.P; for (let i = 0; i < P.length; i += 2) { const x = Math.round(best.ox + P[i] * best.s / cell), y = Math.round(best.oy + P[i + 1] * best.s / cell); if (x < 0 || y < 0 || x >= gw || y >= gh || dt[y * gw + x] > 4 / cell) miss.push(x, y); }
    v.match = { dir: best.t.di, rot: best.t.rot, scale: best.s, ox: best.ox, oy: best.oy, cover: best.c, prec: best.p, score: best.score, name: outlines[best.t.di].name, P, miss: new Float32Array(miss) };
  });
  return views;
}

// ---------------- DFA ----------------
function dfa(parts, answers, opt) {
  const fastRe = /screw|bolt|nut|washer|rivet|pin|dowel|shcs|bhcs|iso\s?4762|din\s?912|insert|helicoil|circlip|spring/i;
  const groups = [];
  for (const p of parts) {
    const key = [p.vol, p.area].map(x => x.toPrecision(4)).join('|');
    let g = groups.find(g => g.key === key); if (!g) { g = { key, name: p.name.replace(/[-_ ]?\d+$|<\d+>$/, ''), parts: [], vol: p.vol, size: p.size }; groups.push(g); } g.parts.push(p);
  }
  groups.forEach(g => { const sz = g.size.slice().sort((a, b) => b - a); g.fastener = fastRe.test(g.name) || (g.vol < 2000 && sz[0] / Math.max(sz[1], 1e-6) > 2 && g.parts[0].features.bosses.length > 0); const a = (answers || {})[g.key]; g.answers = a || { moves: false, material: false, access: !g.fastener ? true : false }; g.essential = g.answers.moves || g.answers.material || g.answers.access; g.tHandle = g.fastener ? 1.8 : Math.max(...g.size) > 150 ? 2.5 : 1.5; g.tInsert = g.fastener ? 8 : 2.5; });
  const N = parts.length, Nmin = groups.reduce((a, g) => a + (g.essential ? g.parts.length : 0), 0) || 1;
  const T = groups.reduce((a, g) => a + g.parts.length * (g.tHandle + g.tInsert), 0);
  const index = (3 * Nmin) / T;
  const fasteners = groups.filter(g => g.fastener).reduce((a, g) => a + g.parts.length, 0);
  // interference: sample vertices of each part inside others (parity test)
  const hits = [];
  if (!(opt && opt.noInterf)) for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const A = parts[i], B = parts[j];
    if ([0, 1, 2].some(d => A.bmax[d] < B.bmin[d] || B.bmax[d] < A.bmin[d])) continue;
    const ins = inside(A, B).concat(inside(B, A).map(x => ({ part: 'B', t: x.t })));
    if (ins.length) hits.push({ a: i, b: j, count: ins.length });
  }
  return { groups, N, Nmin, unique: groups.length, fasteners, T, index, interference: hits };
}
function inside(A, B) { // triangles of A whose centroid lies inside B
  const out = []; const step = Math.max(1, Math.floor(A.nT / 600)); const d = norm([0.5773, 0.5774, 0.5775]);
  for (let t = 0; t < A.nT; t += step) { const o = [A.TC[t * 3], A.TC[t * 3 + 1], A.TC[t * 3 + 2]]; if ([0, 1, 2].some(k => o[k] < B.bmin[k] - 1e-6 || o[k] > B.bmax[k] + 1e-6)) continue;
    let n = 0, oo = o.slice(), lim = 50; while (lim--) { const h = rayCast(B.bvh, oo, d, B.diag * 3, false); if (!h) break; n++; oo = add(oo, mul(d, h.t + B.diag * 1e-6)); }
    if (n % 2 === 1) { // confirm depth (ignore touching)
      const h = rayCast(B.bvh, o, d, B.diag * 3, false); if (h && h.t > B.diag * 1e-4) out.push({ t }); } }
  return out;
}


// ---------------- topology for measuring (faces + B-rep edges) ----------------
function topology(part) {
  const faces = part.faces.map(f => ({ type: f.type, n: f.n, d: f.d, axis: f.axis || null, center: (f.type === 'cyl' || f.type === 'cone') ? axisPoint(f) : null, r: f.r || null, concave: !!f.concave, halfAngle: f.halfAngle || null, area: f.area }));
  const groups = new Map();
  part.edges.forEach(e => { if (e.tris.length !== 2) return; const fa = part.faceOf[e.tris[0]], fb = part.faceOf[e.tris[1]]; if (fa === fb) return; const k = Math.min(fa, fb) * 100000 + Math.max(fa, fb); let g = groups.get(k); if (!g) { g = { faces: [Math.min(fa, fb), Math.max(fa, fb)], segs: [] }; groups.set(k, g); } g.segs.push([e.a, e.b]); });
  const edges = []; const tol = part.diag * 1e-4 + 1e-4;
  groups.forEach(g => {
    // split into connected chains
    const adj = new Map(); g.segs.forEach((sg, i) => sg.forEach(v => (adj.get(v) || adj.set(v, []).get(v)).push(i)));
    const seen = new Uint8Array(g.segs.length);
    for (let s0 = 0; s0 < g.segs.length; s0++) { if (seen[s0]) continue; const st = [s0], ch = []; seen[s0] = 1;
      while (st.length) { const i = st.pop(); ch.push(g.segs[i]); for (const v of g.segs[i]) for (const j of adj.get(v)) if (!seen[j]) { seen[j] = 1; st.push(j); } }
      const pts = new Float32Array(ch.length * 6); let L = 0; const vs = new Map();
      ch.forEach((sg, i) => { const a = vpos(part, sg[0]), b = vpos(part, sg[1]); pts.set(a, i * 6); pts.set(b, i * 6 + 3); L += len(sub(b, a)); vs.set(sg[0], a); vs.set(sg[1], b); });
      const P = [...vs.values()]; const e = { faces: g.faces, pts, len: L, kind: 'curve' };
      // line?
      let far = [P[0], P[0]], fd = 0; for (const q of P) { const d = len(sub(q, P[0])); if (d > fd) { fd = d; far = [P[0], q]; } } for (const q of P) { const d = len(sub(q, far[1])); if (d > fd) { fd = d; far = [far[1], q]; } }
      const dir = norm(sub(far[1], far[0]));
      if (P.every(q => { const w = sub(q, far[0]); return len(sub(w, mul(dir, dot(w, dir)))) < tol * 5; })) Object.assign(e, { kind: 'line', p0: far[0], p1: far[1], dir });
      else if (P.length >= 3) {
        let best = null, bd = 0; for (const q of P) { const w = sub(q, far[0]); const c = len(cross(dir, w)); if (c > bd) { bd = c; best = q; } }
        const n = norm(cross(dir, sub(best, far[0])));
        if (P.every(q => Math.abs(dot(sub(q, far[0]), n)) < tol * 5)) {
          const u = dir, v = cross(n, u); const p2 = P.map(q => { const w = sub(q, far[0]); return [dot(w, u), dot(w, v)]; }); const c2 = kasa(p2);
          if (c2) { const rr = p2.map(q => Math.hypot(q[0] - c2[0], q[1] - c2[1])); const r = rr.reduce((a, b) => a + b, 0) / rr.length; if (Math.max(...rr.map(x => Math.abs(x - r))) < Math.max(0.01 * r, tol * 5)) Object.assign(e, { kind: 'circle', r, n, c: add(far[0], add(mul(u, c2[0]), mul(v, c2[1]))) }); }
        }
      }
      edges.push(e); }
  });
  return { faces, faceOf: part.faceOf, edges };
}

// ---------------- characteristic model dimensions (for drawing matching) ----------------
function keyDims(part) {
  const D = []; const put = (v, kind, label, main) => { if (!(v > 0.05)) return; if (D.some(x => x.kind === kind && Math.abs(x.v - v) < 0.005)) return; D.push({ v, kind, label, main: !!main }); };
  part.size.forEach((v, i) => put(v, 'lin', `Overall size ${'XYZ'[i]} ${fmt(v, 2)}`, true));
  const coneMax = (c, s) => { const A = s.main, o = axisPoint(A); let m = 0; c.tris.forEach(t => { for (let k = 0; k < 3; k++) { const q = [part.TP[t * 9 + k * 3], part.TP[t * 9 + k * 3 + 1], part.TP[t * 9 + k * 3 + 2]]; const w = sub(q, o); m = Math.max(m, len(sub(w, mul(A.axis, dot(w, A.axis))))); } }); return m; };
  for (const grp of holeGroups(part)) { const s = grp[0]; const tap = s.threadKind === 'tap';
    put(s.main.d, 'dia', `${grp.length}× hole Ø${fmt(s.main.d, 2)}${tap ? ' (' + s.thread.n + ' tap drill)' : ''}`, !tap);
    s.steps.forEach(x => { put(x.d, 'dia', `Counterbore Ø${fmt(x.d, 2)}`, true); put(x.depth, 'lin', `Counterbore depth ${fmt(x.depth, 2)}`, true); });
    s.cones.forEach(c => { const D2 = 2 * coneMax(c, s); put(D2, 'dia', `Countersink Ø${fmt(D2, 2)} × ${fmt(2 * c.halfAngle, 0)}°`, true); });
    if (!s.through) put(s.main.depth, 'lin', `Hole depth ${fmt(s.main.depth, 2)}`, true); }
  part.features.bosses.forEach(b => put(b.d, 'dia', `Diameter Ø${fmt(b.d, 2)}`, true));
  part.features.radii.forEach(r => put(r.r, 'rad', `Radius R${fmt(r.r, 2)}`, true));
  // planar offsets along each axis: thicknesses, steps, slot widths
  for (let i = 0; i < 3; i++) { const e = [0, 0, 0]; e[i] = 1; const offs = [];
    part.faces.forEach(f => { if (f.type === 'plane' && Math.abs(dot(f.n, e)) > 0.9999) { const o = f.d * Math.sign(dot(f.n, e)); if (!offs.some(x => Math.abs(x - o) < 0.005)) offs.push(o); } });
    offs.sort((a, b) => a - b); const lim = offs.slice(0, 40);
    for (let a = 0; a < lim.length; a++) for (let b = a + 1; b < lim.length; b++) put(lim[b] - lim[a], 'lin', `Distance between faces along ${'XYZ'[i]}: ${fmt(lim[b] - lim[a], 2)}`, b === a + 1 || (a === 0 && b === lim.length - 1)); }
  // hole positions: spacing and pitch circle
  const st = part.features.stacks.slice(0, 40);
  for (let a = 0; a < st.length; a++) for (let b = a + 1; b < st.length; b++) { const A = st[a].main, B = st[b].main; if (Math.abs(Math.abs(dot(A.axis, B.axis)) - 1) > 1e-3) continue; const d = sub(B.mid, A.mid); const perp = sub(d, mul(A.axis, dot(d, A.axis))); put(len(perp), 'lin', `Hole centre distance ${fmt(len(perp), 2)}`); [0, 1, 2].forEach(k => { if (Math.abs(A.axis[k]) < 0.5) put(Math.abs(perp[k]), 'lin', `Hole spacing along ${'XYZ'[k]} ${fmt(Math.abs(perp[k]), 2)}`); }); }
  const boss = part.features.bosses.sort((a, b) => b.r - a.r)[0];
  if (boss) { const c = axisPoint(boss); const rs = new Map(); st.forEach(s => { if (Math.abs(Math.abs(dot(s.main.axis, boss.axis)) - 1) > 1e-3) return; const d = sub(s.main.mid, c); const r = len(sub(d, mul(boss.axis, dot(d, boss.axis)))); const k = r.toFixed(2); rs.set(k, (rs.get(k) || 0) + 1); });
    rs.forEach((n, k) => { if (n >= 2) put(2 * +k, 'dia', `Pitch circle Ø${fmt(2 * +k, 2)} (${n} holes)`, true); }); }
  return D;
}
function parseDrawingDims(items) {
  const lab = items.filter(i => /^(TITLE|MATERIAL|SCALE|DRAWN|CHECKED|APPROVED|SHEET)/i.test(i.str.trim()));
  const tb = lab.length >= 2 ? { x: Math.min(...lab.map(i => i.x)) - 0.02, y: Math.min(...lab.map(i => i.y)) - 0.03 } : null;
  const out = []; const tr = readTolerances(items);
  for (const it of items) {
    const sx = it.str.toUpperCase().trim(); if (!sx || it.border || tr.children.has(it) || /^\(.*\)$/.test(sx) || fcfGroups(items).used.has(it) || /^\(?N\d{1,2}\)?$/.test(sx) || /\bRA\s*\d/.test(sx)) continue;
    if (it.x < 0.035 || it.x > 0.965 || it.y < 0.035 || it.y > 0.965) continue;
    if (tb && it.x >= tb.x && it.y >= tb.y) continue;
    if (/\bM\d/.test(sx) || /SHEET|SCALE|REV|DATE|©|\(\d{4}\)/.test(sx)) continue;
    const letters = sx.replace(/THRU|ALL|DEEP|TYP|PCD|EQ|SP|CSK|CBORE|X|R|SR|S/g, '').replace(/[^A-Z]/g, '').length; if (letters > 2) continue;
    const re = /(?:(\d+)\s*[X×]\s*)?(SØ|SR|Ø|⌀|R)?\s*(\d+(?:[.,]\d+)?)\s*(°)?(?:\s*(?:±|\+\/-)\s*(\d*[.,]?\d+))?(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?/g; let m;
    while ((m = re.exec(sx))) { if (!m[3]) { re.lastIndex++; continue; } let v = +m[3].replace(',', '.'); let tol = m[5] ? +m[5].replace(',', '.') : 0;
      if (m[6]) { const v2 = +m[6].replace(',', '.'); if (v2 > v && v2 - v < v * 0.2) { tol = (v2 - v) / 2; v = (v + v2) / 2; } }
      const kind = m[4] ? 'ang' : m[2] === 'R' || m[2] === 'SR' ? 'rad' : m[2] ? 'dia' : 'lin';
      if (v === 0 || (kind === 'lin' && /^[1-9]$/.test(m[3]) && sx.length <= 2 && (it.y < 0.06 || it.y > 0.94))) continue;
      const td = tr.byItem.get(it); out.push({ v, kind, tol: td ? (td.up - td.lo) / 2 : tol, up: td ? td.up : null, lo: td ? td.lo : null, cls: td ? td.cls : null, qty: m[1] ? +m[1] : 1, str: it.str, it }); if (td) break; if (re.lastIndex === m.index) re.lastIndex++; }
  }
  return out;
}
function matchDims(dims, kd, k) {
  k = k || 1; let hit = 0; const used = new Set(); const res = dims.map(d => { const v = d.v * k, t = Math.max(0.02, 0.003 * v, d.tol * k);
    let c = kd.filter(x => d.kind === 'dia' ? (x.kind === 'dia') : d.kind === 'rad' ? (x.kind === 'rad') : d.kind === 'ang' ? false : (x.kind === 'lin' || x.kind === 'dia'));
    let m = c.find(x => Math.abs(x.v - v) <= t) || (d.kind === 'dia' ? kd.find(x => x.kind === 'rad' && Math.abs(2 * x.v - v) <= t) : d.kind === 'rad' ? kd.find(x => x.kind === 'dia' && Math.abs(x.v / 2 - v) <= t) : null);
    if (d.kind === 'ang') m = [90, 82, 100, 120, 60, 45, 30].includes(Math.round(v)) ? { v, label: 'angle' } : null;
    if (m) { hit++; used.add(m); } return { d, m }; });
  return { res, hit, used };
}
function nameScore(a, b) {
  const n = s => String(s || '').toLowerCase().replace(/\.(step|stp|pdf|igs|iges|stl)$/, '').replace(/[^a-z0-9]+/g, ''); const A = n(a), B = n(b); if (!A || !B) return 0; if (A === B) return 1;
  const bg = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const x = bg(A), y = bg(B); let inter = 0; x.forEach((c, k) => inter += Math.min(c, y.get(k) || 0)); return (2 * inter) / Math.max(1, A.length + B.length - 2);
}
function drawingMatch(parts, items, text, drawingName) {
  const dims = parseDrawingDims(items); const T = text.toUpperCase();
  const thr = []; const tre = /(\d+)\s*[X×]\s*(M\d+(?:\.\d+)?)/g; let m; while ((m = tre.exec(T))) thr.push({ n: +m[1], size: m[2] });
  const words = items.map(i => i.str).filter(s => /[A-Za-z]{3}/.test(s) && s.length < 60);
  return parts.map((p, i) => {
    let ns = 0, nsrc = ''; for (const w of words.concat(drawingName ? [drawingName] : [])) { const sc = nameScore(p.name, w); if (sc > ns) { ns = sc; nsrc = w; } }
    const kd = keyDims(p); const md = matchDims(dims, kd); const mi = dims.length >= 3 ? matchDims(dims, kd, 25.4) : null;
    const ds = dims.length ? md.hit / dims.length : null;
    const ts = thr.length ? thr.reduce((a, t) => a + (p.features.stacks.filter(s => s.threadKind === 'tap' && s.thread.n === t.size).length === t.n ? 1 : 0), 0) / thr.length : null;
    const comp = [[ns, 0.4], [ds, 0.4], [ts, 0.2]].filter(x => x[0] != null); const score = comp.reduce((a, x) => a + x[0] * x[1], 0) / comp.reduce((a, x) => a + x[1], 0);
    return { part: i, name: p.name, score, nameScore: ns, nameSource: nsrc, dimScore: ds, dimHits: md.hit, dims: dims.length, threadScore: ts, inch: mi && ds < 0.5 && mi.hit / dims.length >= 0.7 };
  }).sort((a, b) => b.score - a.score);
}

// ---------------- drawing text checks ----------------
function drawingChecks(text, items, ctx) {
  // items: [{str, x, y, w, h}] normalized 0..1 page coords (top-left origin)
  const T = text.replace(/\s+/g, ' ').toUpperCase(); const out = [];
  const find = re => items.filter(i => re.test(i.str.toUpperCase()));
  const box = arr => arr.length ? arr.map(i => [i.x, i.y, i.w, i.h]) : [];
  const F2 = (status, cat, title, value, why, fix, boxes) => ({ status, cat, title, value, why, fix: fix || '', boxes: boxes || [] });
  // projection
  const proj = /FIRST\s*ANGLE/.test(T) ? 'first' : /THIRD\s*ANGLE/.test(T) ? 'third' : null;
  const pi = find(/FIRST|THIRD|PROJECTION/);
  if (!proj) out.push(F2('fail', 'Title block', 'Projection method', 'Not stated', 'Without a first or third angle note the views can be read mirrored.', 'Add the projection symbol and text to the title block.'));
  else if (ctx.projection && proj !== ctx.projection) out.push(F2('fail', 'Title block', 'Projection method', `Drawing says ${proj} angle, you selected ${ctx.projection} angle`, 'A mismatch means views will be interpreted on the wrong side.', 'Confirm which standard the drawing was made in and correct the note or the views.', box(pi)));
  else out.push(F2('pass', 'Title block', 'Projection method', `${proj === 'first' ? 'First angle (ISO E)' : 'Third angle (ASME A)'}`, ctx.projection ? 'Matches your selection.' : '', '', box(pi)));
  // general tolerance
  const m = T.match(/ISO\s*2768\s*[-–]?\s*\(?\s*([FMCV])\s*([HKL])?\s*\)?/);
  const ti = find(/2768/);
  if (!m) out.push(F2('warn', 'Tolerance', 'General tolerance note', 'Missing', 'Untoleranced dimensions have no defined acceptance limit.', `Add "GENERAL TOLERANCES ISO 2768-${ctx.iso || 'mK'}".`));
  else { const cls = m[1].toLowerCase() + (m[2] || ''); const sel = ctx.iso || 'mK'; out.push(F2(cls === sel ? 'pass' : 'warn', 'Tolerance', 'General tolerance note', `ISO 2768-${cls}`, cls === sel ? 'Matches your selected class.' : `You selected ISO 2768-${sel}.`, cls === sel ? '' : 'Align the drawing note with the class agreed with the supplier.', box(ti))); if (!m[2]) out.push(F2('warn', 'Tolerance', 'Geometric tolerance class', 'Only part 1 class given', 'ISO 2768-2 (H, K or L) controls flatness, straightness, perpendicularity, symmetry and run-out of untoleranced features.', 'Write the full designation, e.g. ISO 2768-mK.', box(ti))); }
  // units
  out.push(/DIMENSIONS ARE IN (MM|MILLIMET)|UNITS?\s*:?\s*MM|ALL DIMENSIONS IN MM/.test(T) ? F2('pass', 'Title block', 'Units', 'mm', '', '', box(find(/DIMENSIONS|UNITS/))) : F2('warn', 'Title block', 'Units', 'Not stated', '', 'State "ALL DIMENSIONS IN MM".'));
  // fields
  const fields = [['TITLE', /TITLE/], ['MATERIAL', /MATERIAL/], ['SCALE', /SCALE/], ['SHEET SIZE', /SHEET SIZE|\bA[0-4]\b/], ['DRAWING NUMBER', /DWG\.?\s*NO|DRAWING\s*(NO|NUMBER)|PART\s*(NO|NUMBER)|P\/N/], ['REVISION', /\bREV(ISION)?\b/], ['DATE', /\bDATE\b|\d{2}[\/.-]\d{2}[\/.-]\d{2,4}/]];
  for (const [n, re] of fields) { const ok = re.test(T); out.push(F2(ok ? 'pass' : (n === 'REVISION' || n === 'DRAWING NUMBER' ? 'fail' : 'warn'), 'Title block', n.charAt(0) + n.slice(1).toLowerCase(), ok ? 'Present' : 'Missing', n === 'REVISION' ? 'Without a revision the shop cannot confirm it is making the current design.' : n === 'DRAWING NUMBER' ? 'Parts and drawings need a unique number for traceability.' : '', ok ? '' : `Add ${n.toLowerCase()} to the title block.`, ok ? box(find(re)) : [])); }
  // signatures: DRAWN BY / CHECKED BY / APPROVED BY empty if only dashes near
  for (const lab of ['DRAWN', 'CHECKED', 'APPROVED']) {
    const L = find(new RegExp('^\\s*' + lab)); if (!L.length) { out.push(F2('warn', 'Approval', `${lab[0] + lab.slice(1).toLowerCase()} by`, 'Field missing', '', `Add a ${lab.toLowerCase()} by field with name and date.`)); continue; }
    const l = L[0]; const near = items.filter(i => i !== l && i.y > l.y - 0.004 && i.y < l.y + 0.03 && i.x > l.x - 0.005 && i.x < l.x + 0.13 && i !== l && /[A-Z]{2,}/i.test(i.str) && !/^[-_.\s]+$/.test(i.str) && !/(DRAWN|CHECKED|APPROVED|MATERIAL|\bBY\b|PROJECTION|ANGLE|SCALE|TITLE|SHEET|DATE|NAME|SIGN)/i.test(i.str));
    out.push(F2(near.length ? 'pass' : 'fail', 'Approval', `${lab[0] + lab.slice(1).toLowerCase()} by`, near.length ? near[0].str : 'Blank', near.length ? '' : 'An unsigned drawing has not been through review and should not be released for manufacture.', near.length ? '' : `Fill in the ${lab.toLowerCase()} by name and date before release.`, box([l])));
  }
  // dimensions
  const dimRe = /^(?:[ØR⌀]\s?)?\d+(?:[.,]\d+)?(?:\s*(?:±|\+|-|–)\s*\d+(?:[.,]\d+)?)?°?$/;
  const dims = items.filter(i => !i.border && dimRe.test(i.str.trim()) && i.y < 0.88 && i.y > 0.04 && i.x > 0.04 && i.x < 0.96 && !/^[1-8]$/.test(i.str.trim()) && !(i.x > 0.52 && i.y > 0.6));
  out.push(dims.length >= 3 ? F2('pass', 'Dimensions', 'Dimensions on views', `${dims.length} found`, '', '', box(dims.slice(0, 40))) : F2('fail', 'Dimensions', 'Dimensions on views', dims.length ? `Only ${dims.length}` : 'None found', 'The part cannot be made or inspected without sizes and locations. Overall size, hole positions, pocket and slot sizes all need dimensions.', 'Dimension every feature from datums; add overall size and thickness.'));
  // threads
  const thr = []; const tre = /(\d+)\s*[X×]\s*(M\d+(?:\.\d+)?)(?:\s*[X×]\s*(\d+(?:\.\d+)?))?(?:\s*-\s*(\d[GHgh]))?\s*(THRU(?:\s*ALL)?|[↧▾]?\s*\d+(?:\.\d+)?\s*(?:DEEP)?)?/g; let mm;
  while ((mm = tre.exec(T))) thr.push({ n: +mm[1], size: mm[2], pitch: mm[3], cls: mm[4], depth: mm[5] });
  thr.forEach(t => { const b = box(find(new RegExp(t.size.replace('.', '\\.') + '\\b')));
    out.push(F2(t.cls ? 'pass' : 'info', 'Threads', `${t.n}× ${t.size}${t.pitch ? '×' + t.pitch : ''}`, `${t.depth || 'depth not stated'}${t.cls ? ', class ' + t.cls : ''}`, t.cls ? '' : 'Metric coarse pitch and class 6H are assumed when not stated (ISO 965).', t.cls ? '' : `Write ${t.size}${t.pitch ? '×' + t.pitch : ''}-6H ${t.depth || 'THRU'} to remove doubt.`, b));
    if (!t.depth) out.push(F2('warn', 'Threads', `${t.size} thread depth`, 'Not stated', 'Blind thread depth must be given.', 'Add thread depth and drill depth.', b));
    if (ctx.cad) { const T0 = THREADS.find(x => x.n === t.size); const holes = ctx.cad.stacks.filter(s => s.threadKind === 'tap' && s.thread && s.thread.n === t.size);
      out.push(F2(holes.length === t.n ? 'pass' : 'fail', 'CAD match', `${t.size} count vs model`, `Drawing ${t.n}, model ${holes.length} tap-drill holes${T0 ? ' (Ø' + T0.tap + ')' : ''}`, holes.length === t.n ? 'Callout matches the 3D model.' : 'Drawing and model disagree.', holes.length === t.n ? '' : 'Correct the callout count or the model.', b)); } });
  if (ctx.cad) {
    const called = new Set(thr.map(t => t.size));
    const unc = ctx.cad.stacks.filter(s => !(s.threadKind === 'tap' && called.has(s.thread.n)));
    const byD = {}; unc.forEach(s => { const k = s.kind + ' Ø' + fmt(s.main.d, 2) + (s.steps.length ? ' / Ø' + fmt(s.steps[0].d, 2) : '') + (s.cones.length ? ' + csk' : ''); byD[k] = (byD[k] || 0) + 1; });
    Object.entries(byD).forEach(([k, n]) => { const hasD = items.some(i => i.str.includes(k.match(/Ø([\d.]+)/)[1])); out.push(F2(hasD ? 'pass' : 'warn', 'CAD match', `${n}× ${k} hole`, hasD ? 'Size found on drawing' : 'No callout found', hasD ? '' : 'The model has this hole but the drawing does not specify it.', hasD ? '' : 'Add a hole callout with diameter, depth and counterbore or countersink size.')); });
  }
  // full drawing-to-model comparison
  if (ctx.part) {
    const p = ctx.part, dims = parseDrawingDims(items), kd = keyDims(p), mt = matchDims(dims, kd);
    let ns = 0, src = null; items.forEach(i => { if (!/[A-Za-z]{3}/.test(i.str)) return; const sc = nameScore(p.name, i.str); if (sc > ns) { ns = sc; src = i; } }); const fn = ctx.drawingName ? nameScore(p.name, ctx.drawingName) : 0;
    const nm = Math.max(ns, fn);
    out.push(F2(nm >= 0.8 ? 'pass' : nm >= 0.5 ? 'warn' : 'fail', 'CAD match', 'Drawing title matches the model', nm >= 0.8 ? `"${src ? src.str : ctx.drawingName}" = ${p.name}` : `Best match "${src ? src.str : '–'}" for model "${p.name}" (${Math.round(nm * 100)} %)`, nm >= 0.8 ? '' : 'The title and file name do not match the model name, so this may be the wrong drawing or a different revision.', nm >= 0.8 ? '' : 'Check the part number and revision on both, and keep the CAD file name and drawing title the same.', src && nm >= 0.5 ? box([src]) : []));
    if (dims.length) {
      const pc = mt.hit / dims.length; const inch = matchDims(dims, kd, 25.4);
      if (pc < 0.5 && inch.hit / dims.length >= 0.7) out.push(F2('fail', 'CAD match', 'Drawing appears to be in inches', `${inch.hit} of ${dims.length} values match the model ×25.4`, 'The model is in millimetres but the drawing values only fit when converted from inches.', 'State the units on the drawing and make model and drawing use the same units.'));
      out.push(F2(pc >= 0.8 ? 'pass' : pc >= 0.5 ? 'warn' : 'fail', 'CAD match', 'Dimensions agree with the model', `${mt.hit} of ${dims.length} drawing values found on the model`, pc >= 0.8 ? '' : 'Several drawing values do not exist on the model. The drawing may be out of date, at a different scale, or for another part.', pc >= 0.8 ? '' : 'Update the drawing from the current model, then re-check.', []));
      mt.res.filter(r => !r.m).slice(0, 12).forEach(r => out.push(F2('warn', 'CAD match', `${r.d.kind === 'dia' ? 'Ø' : r.d.kind === 'rad' ? 'R' : ''}${fmt(r.d.v, 3)}${r.d.kind === 'ang' ? '°' : ''} not found on the model`, r.d.str, 'No feature, size or face distance on the 3D model has this value.', 'Check this dimension against the model; it may be a typo, an old revision or an overridden dimension.', box([r.d.it]))));
    }
    const missing = kd.filter(x => x.main && !mt.used.has(x));
    if (missing.length) out.push(F2(dims.length ? 'warn' : 'fail', 'CAD match', 'Model features not dimensioned on the drawing', `${missing.length} missing: ` + missing.slice(0, 6).map(x => x.label.replace(/^Distance between faces along /, 'Face distance ')).join(', ') + (missing.length > 6 ? ` and ${missing.length - 6} more` : ''), 'These sizes exist on the model but have no matching dimension or callout, so the shop has to measure the CAD or guess.', 'Add dimensions for: ' + missing.map(x => x.label).join('; ') + '.', []));
  }
  // notes
  out.push(/DEBURR|BREAK\s*(ALL\s*)?(SHARP\s*)?EDGES|REMOVE SHARP/.test(T) ? F2('pass', 'Notes', 'Edge break note', 'Present', '', '', box(find(/DEBURR|SHARP/))) : F2('warn', 'Notes', 'Edge break note', 'Missing', '', 'Add "REMOVE SHARP EDGES AND DEBURR 0.2–0.5 × 45°".'));
  out.push(/\bRA\b|SURFACE\s*(FINISH|ROUGHNESS)|ISO\s*1302|ISO\s*21920|N\d\b/.test(T) ? F2('pass', 'Notes', 'Surface finish', 'Specified', '', '') : F2('warn', 'Notes', 'Surface finish', 'Not specified', 'Without a finish requirement the shop leaves standard as-machined finish (about Ra 3.2 µm).', 'Add a general surface texture symbol, e.g. Ra 3.2 µm, and tighter values on functional faces.'));
  out.push(/ANODI|FINISH|COAT|PLAT|PAINT|PASSIVAT|BEAD\s*BLAST|AS\s*MACHINED/.test(T) ? F2('pass', 'Notes', 'Finish or treatment', 'Specified', '', '') : F2('info', 'Notes', 'Finish or treatment', 'Not stated', 'Aluminium parts are usually anodised or left as machined; say which.', 'Add finish, e.g. "CLEAR ANODISE TYPE II" or "AS MACHINED".'));
  if (/ALUMIN/.test(T) && !/\d{4}|6061|6082|7075|5083|2024/.test(T.replace(/2768|2026|\d{4}-\d/g, ''))) out.push(F2('warn', 'Title block', 'Material grade', 'Grade not given', '"Aluminium" alone allows any alloy; strength and machinability vary widely.', 'Specify alloy and temper, e.g. EN AW-6082-T6.', box(find(/ALUMIN/))));
  return out;
}

// ---------------- reading the drawing: zones, tolerances, finish, notes, spelling, FCF, over-dimensioning ----------------
// border zone labels: rows of single digits along the top or bottom edge, columns of single letters along the sides
function borderInfo(items) {
  const cand = items.filter(i => /^(\d{1,2}|[A-Z])$/.test(i.str.trim()));
  const cx = i => i.x + i.w / 2, cy = i => i.y + i.h / 2; const set = new Set(); let cols = [], rows = [];
  const grp = (arr, key, tol) => { const G = []; arr.forEach(i => { const g = G.find(g => Math.abs(key(g[0]) - key(i)) < tol); if (g) g.push(i); else G.push([i]); }); return G; };
  grp(cand.filter(i => /^\d+$/.test(i.str.trim()) && (cy(i) < 0.08 || cy(i) > 0.92)), cy, 0.012).forEach(g => { if (g.length >= 4) { g.forEach(i => set.add(i)); if (!cols.length) cols = g.map(i => ({ l: i.str.trim(), x: cx(i) })); } });
  grp(cand.filter(i => /^[A-Z]$/.test(i.str.trim()) && (cx(i) < 0.06 || cx(i) > 0.94)), cx, 0.012).forEach(g => { if (g.length >= 3) { g.forEach(i => set.add(i)); if (!rows.length) rows = g.map(i => ({ l: i.str.trim(), y: cy(i) })); } });
  return { set, cols, rows };
}
function zoneOf(bi, x, y) { if (!bi || !bi.cols.length || !bi.rows.length) return ''; const c = bi.cols.reduce((a, b) => Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a), r = bi.rows.reduce((a, b) => Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a); return r.l + c.l; }
const titleBlockOf = items => { const lab = items.filter(i => /^(TITLE|MATERIAL|SCALE|DRAWN|CHECKED|APPROVED|SHEET|DWG)/i.test(i.str.trim())); return lab.length >= 2 ? { x: Math.min(...lab.map(i => i.x)) - 0.02, y: Math.min(...lab.map(i => i.y)) - 0.03 } : null; };
const inTB = (tb, i) => tb && i.x >= tb.x && i.y >= tb.y;
// position of item b in the text frame of item a (mm): u along the text, v up from the baseline
const frame = (a, b) => { const d = [b.o[0] - a.o[0], b.o[1] - a.o[1]]; return { u: d[0] * a.dir[0] + d[1] * a.dir[1], v: d[0] * a.up[0] + d[1] * a.up[1] }; };
const sameDir = (a, b) => a.dir && b.dir && a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1] > 0.98;
const num = s => +String(s).replace(',', '.').replace(/[−–]/g, '-').replace(/\s/g, '');
const DIM_RE = /^(?:(\d+)\s*[X×]\s*)?(SØ|SR|Ø|⌀|R)?\s*(\d+(?:[.,]\d+)?)\s*(°)?\s*(?:(±|\+\/-)\s*(\d*[.,]?\d+)|([+\-−–]\s*\d*[.,]?\d+)\s*\/?\s*([+\-−–]\s*\d*[.,]?\d+|0)|([A-Za-z]{1,2}\d{1,2}))?\s*$/;
const _tolCache = new WeakMap(), _fcfCache = new WeakMap();
function fcfGroups(items) {
  if (_fcfCache.has(items)) return _fcfCache.get(items);
  const syms = items.filter(i => !i.border && i.o && Object.keys(GSYM).some(k => i.str.trim() === k || i.str.trim().startsWith(k))); const used = new Set();
  const groups = syms.map(s => { const cells = [s]; used.add(s); items.filter(c => c !== s && c.o && sameDir(s, c)).map(c => ({ c, f: frame(s, c) })).filter(x => x.f.u > 0 && x.f.u < 60 && Math.abs(x.f.v) < 0.6 * s.fh).sort((a, b) => a.f.u - b.f.u).forEach(x => { const last = cells[cells.length - 1]; if (x.f.u - (frame(s, last).u + last.len) < 12 && x.c.str.trim().length <= 12) { cells.push(x.c); used.add(x.c); } });
    const key = Object.keys(GSYM).find(k => s.str.trim().startsWith(k)); const rest = cells.slice(1).map(c => c.str.trim()).join(' ').concat(' ' + s.str.trim().slice(key.length));
    return { type: GSYM[key], str: cells.map(c => c.str.trim()).join(' | '), val: (rest.match(/(\d*[.,]\d+|\d+)/) || [])[1], dia: /[Ø⌀]/.test(rest), mods: rest.match(/Ⓜ|Ⓛ|Ⓟ|Ⓕ|Ⓣ|Ⓤ|\([MLPFTU]\)/g) || [], datums: cells.slice(1).map(c => c.str.trim()).filter(x => /^[A-Z](?:\s*[ⓂⓁ]|\s*\([ML]\))?$/.test(x)).map(x => x[0]), cells }; });
  const r = { groups, used }; _fcfCache.set(items, r); return r;
}
function readTolerances(items) {
  if (_tolCache.has(items)) return _tolCache.get(items);
  const tb = titleBlockOf(items); const children = new Set(), list = [];
  const devRe = /^([+\-−–]\s*\d*[.,]?\d+|0)$/;
  items.forEach(it => { if (it.border || inTB(tb, it)) return; const s = it.str.trim().replace(/⌀/g, 'Ø'); const m = s.match(DIM_RE); if (!m || /^\(/.test(s)) return;
    const nom = num(m[3]); if (!(nom > 0)) return; const kind = m[4] ? 'ang' : (m[2] === 'R' || m[2] === 'SR') ? 'rad' : m[2] ? 'dia' : 'lin';
    let up = null, lo = null, cls = null, src = '';
    if (m[5]) { up = num(m[6]); lo = -up; src = '±'; }
    else if (m[7]) { const a = num(m[7]), b = num(m[8]); up = Math.max(a, b); lo = Math.min(a, b); src = 'deviations'; }
    else if (m[9]) { cls = m[9]; src = 'class'; }
    else if (it.o) { // stacked deviations written after the size in a smaller font
      const near = items.filter(c => c !== it && c.o && devRe.test(c.str.trim()) && sameDir(it, c) && c.fh <= it.fh * 0.95).map(c => ({ c, f: frame(it, c) })).filter(x => x.f.u > it.len - 1 && x.f.u < it.len + 6 && x.f.v > -0.7 * it.fh && x.f.v < 1.2 * it.fh);
      if (near.length >= 2) { near.sort((a, b) => b.f.v - a.f.v); const a = num(near[0].c.str), b = num(near[1].c.str); up = a; lo = b; if (up < lo) { const t = up; up = lo; lo = t; } children.add(near[0].c); children.add(near[1].c); src = 'stacked'; }
      else { const cl = items.find(c => c !== it && c.o && /^[A-Za-z]{1,2}\d{1,2}$/.test(c.str.trim()) && sameDir(it, c) && (f => f.u > it.len - 1 && f.u < it.len + 5 && Math.abs(f.v) < 0.6 * it.fh)(frame(it, c))); if (cl) { cls = cl.str.trim(); children.add(cl); src = 'class'; } }
    }
    if (cls) { const g = cls.match(/^([A-Za-z]{1,2})(\d{1,2})$/); const d = g && (g[1] === g[1].toUpperCase() ? ISO286.hole(g[1], +g[2], nom) : ISO286.shaft(g[1], +g[2], nom)); if (d) { up = d.upper / 1000; lo = d.lower / 1000; } }
    if (up == null) return;
    list.push({ it, nom, kind, up, lo, cls, src, qty: m[1] ? +m[1] : 1, label: (kind === 'dia' ? 'Ø' : kind === 'rad' ? 'R' : '') + fmt(nom, 3) + (kind === 'ang' ? '°' : '') });
  });
  const r = { list, children, byItem: new Map(list.map(t => [t.it, t])) }; _tolCache.set(items, r); return r;
}
// match deviations to an ISO 286 class
function isoClassOf(nom, up, lo) {
  if (!(nom > 0) || nom > 500) return { exact: [], near: [] }; const U = up * 1000, L = lo * 1000; const all = [];
  [['hole', ISO286.HOLE_LETTERS], ['shaft', ISO286.SHAFT_LETTERS]].forEach(([role, letters]) => letters.forEach(l => { for (let g = 4; g <= 12; g++) { const d = role === 'hole' ? ISO286.hole(l, g, nom) : ISO286.shaft(l, g, nom); if (d) all.push({ cls: l + g, role, up: d.upper, lo: d.lower, err: Math.abs(d.upper - U) + Math.abs(d.lower - L) }); } }));
  all.sort((a, b) => a.err - b.err); const role = L >= 0 && U > 0 ? 'hole' : U <= 0 ? 'shaft' : null; const common = /^(H|G|F|E|D|JS|K|M|N|P|R|S|h|g|f|e|d|js|k|m|n|p|r|s)\d+$/;
  return { exact: all.filter(a => a.err <= 1.5), near: all.filter(a => a.err > 1.5 && common.test(a.cls) && (!role || a.role === role) && +a.cls.replace(/\D/g, '') >= 5 && +a.cls.replace(/\D/g, '') <= 12).slice(0, 3) };
}
function itGrade(nom, band) { let best = null; for (let g = 4; g <= 14; g++) { const t = ISO286.it(g, nom); if (t != null && (!best || Math.abs(t - band * 1000) < Math.abs(best.t - band * 1000))) best = { g, t }; } return best; }
// fit advice for a toleranced diameter: what the mating part needs for each fit type
function fitAdvice(t) {
  if (t.kind !== 'dia' || !(t.nom > 0) || t.nom > 500) return null; const iso = isoClassOf(t.nom, t.up, t.lo); const ex = iso.exact[0];
  const role = ex ? ex.role : t.lo >= 0 && t.up > 0 ? 'hole' : t.up <= 0 ? 'shaft' : 'hole';
  const ig = itGrade(t.nom, t.up - t.lo); const g = ig ? Math.min(11, Math.max(5, ig.g)) : 7; const sh = (l, gr) => ISO286.shaft(l, gr, t.nom), ho = (l, gr) => ISO286.hole(l, gr, t.nom);
  const opts = []; const fitOf = mn => mn;
  if (role === 'hole') { const sg = Math.max(5, Math.min(9, g <= 8 ? g - 1 : g));
    [['clearance', 'g', sg], ['transition', 'k', 6], ['interference', 'p', 6]].forEach(([type, l, gr]) => { const d = sh(l, gr); if (!d) return; const mn = t.lo - d.upper / 1000, mx = t.up - d.lower / 1000;
      const weak = (type === 'clearance' && mn < 0) || (type === 'interference' && mx > 0) || (type === 'transition' && (mn >= 0 || mx <= 0)) || (type !== 'clearance' && g > 8);
      opts.push({ type, mate: `shaft ${l}${gr}`, limits: `Ø${fmt(t.nom + d.lower / 1000, 4)} to Ø${fmt(t.nom + d.upper / 1000, 4)}`, range: [mn, mx], weak: weak ? `This hole tolerance is too wide for a ${type} fit. Make the hole H7 (${fmt(ISO286.hole('H', 7, t.nom).upper / 1000, 3)} / 0) first.` : '' }); }); }
  else { const own = [['clearance', 'g', Math.min(9, g)], ['transition', 'k', 6], ['interference', 'p', 6]];
    own.forEach(([type, l, gr]) => { const d = sh(l, gr), hg = gr <= 7 ? gr + 1 : gr, H = ho('H', hg); if (!d || !H) return; const mn = H.lower / 1000 - d.upper / 1000, mx = H.upper / 1000 - d.lower / 1000; opts.push({ type, mate: `hole H${hg}`, own: `${l}${gr}`, limits: `this diameter ${l}${gr}: Ø${fmt(t.nom + d.lower / 1000, 4)} to Ø${fmt(t.nom + d.upper / 1000, 4)}`, range: [mn, mx] }); });
    const H = ho('H', 7); if (H) { const mn = H.lower / 1000 - t.up, mx = H.upper / 1000 - t.lo; opts.unshift({ type: 'as drawn', mate: 'hole H7', limits: 'with this tolerance in an H7 hole', range: [mn, mx] }); } }
  return { role, exact: iso.exact.slice(0, 2).map(x => x.cls), near: iso.near.map(x => `${x.cls} (${x.up >= 0 ? '+' : ''}${fmt(x.up / 1000, 3)} / ${x.lo >= 0 ? '+' : ''}${fmt(x.lo / 1000, 3)})`), grade: ig ? ig.g : null, opts };
}
// text lines from items (same direction, same baseline, close together)
function textLines(items) {
  const L = []; items.filter(i => i.o && !i.border).slice().sort((a, b) => a.o[1] - b.o[1] || a.o[0] - b.o[0]).forEach(it => {
    const l = L.find(l => sameDir(l.items[0], it) && (f => Math.abs(f.v) < 0.5 * it.fh && f.u > -1 && f.u < l.end + 3 * it.fh)(frame(l.items[0], it)));
    if (l) { l.items.push(it); l.end = Math.max(l.end, frame(l.items[0], it).u + it.len); } else L.push({ items: [it], end: it.len }); });
  return L.map(l => { l.items.sort((a, b) => frame(l.items[0], a).u - frame(l.items[0], b).u); return { str: l.items.map(i => i.str.trim()).join(' '), items: l.items }; });
}
const VOCAB = new Set(('ALL AND THE ARE WITH FROM UNLESS OTHERWISE SPECIFIED STATED SHOWN NOTED NOTE NOTES SEE VIEW DETAIL SECTION SCALE SHEET SIZE TITLE DRAWING DRAWN CHECKED APPROVED APPROVAL DATE NAME SIGN SIGNATURE REVISION REV DESCRIPTION PART NUMBER QUANTITY ITEM MATERIAL MATERIALS FINISH FINISHED SURFACE SURFACES ROUGHNESS TEXTURE TOLERANCE TOLERANCES GENERAL LINEAR ANGULAR DIMENSION DIMENSIONS MILLIMETRES MILLIMETERS INCHES UNITS PROJECTION FIRST THIRD ANGLE REMOVE BREAK SHARP EDGE EDGES BURR BURRS DEBURR CORNERS CORNER CHAMFER CHAMFERS FILLET FILLETS RADIUS RADII TYPICAL PLACES HOLE HOLES THROUGH THRU DEEP DEPTH BLIND THREAD THREADS THREADED TAPPED COUNTERBORE COUNTERSINK SPOTFACE DRILL DRILLED REAM REAMED BORE BORED KEYWAY SLOT SLOTS GROOVE GROOVES POCKET POCKETS FACE FACES FLAT FLATS SHAFT HOUSING BEARING BEARINGS SLEEVE BUSH BUSHING ROLLER ROLLERS LOAD SPACER WASHER SCREW SCREWS BOLT BOLTS NUT NUTS INSERT INSERTS PIN PINS DOWEL SPRING BRACKET PLATE COVER BASE BLOCK FLANGE MOUNT HOLDER ASSEMBLY SUBASSEMBLY GEAR GEARS PULLEY WHEEL HUB CAP LID BODY FRAME HANDLE KNOB LEVER ARM CLAMP CLIP SUPPORT GUIDE RAIL TUBE PIPE RING SEAL GASKET COLLAR NOZZLE ADAPTER CONNECTOR HEAT TREAT TREATMENT HARDEN HARDENED HARDENING HARDNESS CASE CORE TEMPER TEMPERED TEMPERING ANNEAL ANNEALED ANNEALING NORMALIZE NORMALISE NORMALIZED QUENCH QUENCHED INDUCTION NITRIDE NITRIDED NITRIDING CARBURIZE CARBURISE CARBURIZED CARBURIZING STRESS RELIEVE RELIEVED RELIEF SOLUTION AGED AGEING AGING COAT COATED COATING COATINGS PAINT PAINTED POWDER PLATE PLATED PLATING ZINC NICKEL CHROME CHROMIUM ANODISE ANODIZE ANODISED ANODIZED ANODISING ANODIZING HARD BLACK CLEAR OXIDE PHOSPHATE PHOSPHATED PASSIVATE PASSIVATED GALVANISED GALVANIZED POLISH POLISHED GRIND GROUND GRINDING LAP LAPPED HONE HONED MACHINE MACHINED MACHINING TURN TURNED MILL MILLED CAST CASTING FORGE FORGED WELD WELDED WELDING WELDS BEND BENT SHEET METAL STEEL STAINLESS ALUMINIUM ALUMINUM BRASS BRONZE COPPER TITANIUM PLASTIC NYLON ACETAL DELRIN PEEK IRON GRADE ALLOY CONDITION PROPERTY PROPRIETARY CONFIDENTIAL COPYRIGHT RESERVED RIGHTS DOCUMENT INFORMATION CONTAINED WITHIN EXCLUSIVE CONSENT WRITTEN EXPRESS REPRODUCTION DISTRIBUTION THIRD PARTIES PARTY PROHIBITED WITHOUT INTELLECTUAL GRANTED PROVISION DISCLOSURE CONTENT CONTENTS SOLELY INTENDED PURPOSE STATEMENTS MADE BASED ASSUMPTIONS EXPRESSED GOOD FAITH CONSTITUTE OFFER SUPPORTING EVIDENCE PROVIDED THIS THESE THAT THEY THEIR THERE WHERE WHEN WHICH SHALL MUST SHOULD WILL NOT ONLY AFTER BEFORE BETWEEN EACH BOTH SAME OTHER ANY NONE MAXIMUM MINIMUM MAX MIN NOMINAL REFERENCE REF BASIC DATUM DATUMS POSITION FLATNESS STRAIGHTNESS CIRCULARITY ROUNDNESS CYLINDRICITY PERPENDICULARITY PARALLELISM ANGULARITY CONCENTRICITY COAXIALITY SYMMETRY RUNOUT TOTAL PROFILE LINE CONDITION LEAST FEATURE FEATURES CONTROL FRAME ZONE PROJECTED FREE STATE TANGENT PLANE INSPECT INSPECTION MEASURE MEASURED CRITICAL MARK MARKED MARKING LABEL ENGRAVE ENGRAVED LASER CLEAN CLEANED FREE OIL GREASE PACK PACKED PACKING PROTECT PROTECTED SPECIALIZED SPECIALISED CENTER CENTRE EYE CLINIC HOSPITAL ENGINEERING COMPANY LIMITED DEPARTMENT DESIGN DESIGNED DESIGNER ENGINEER CUSTOMER SUPPLIER PROJECT WEIGHT MASS VOLUME FORMAT DOUBLE SINGLE HALF FULL LEFT RIGHT HAND UPPER LOWER INNER OUTER FRONT REAR BACK SIDE TOP BOTTOM INSIDE OUTSIDE CENTRAL MIDDLE EQUALLY SPACED EQUAL PITCH CIRCLE DIAMETER LENGTH WIDTH HEIGHT THICKNESS THICK WALL STOCK ALLOWANCE BLANK RAW HELICOIL KNURL KNURLED SPLINE PRESS PRESSED INTERFERENCE CLEARANCE TRANSITION LOCATIONAL RUNNING SLIDING DRIVE FORCE FIT FITS FITTED ASSEMBLE ASSEMBLED ADJUST SHIM SHIMS TORQUE TIGHTEN LOCTITE THREADLOCKER APPLY APPLIED USE USED FOR TO OF ON IN AT BY OR AS BE IS IT'.split(' ')));
function damerau(a, b, max) { if (Math.abs(a.length - b.length) > max) return max + 1; const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; } for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) { let rowMin = Infinity; for (let j = 1; j <= b.length; j++) { const c = a[i - 1] === b[j - 1] ? 0 : 1; d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); rowMin = Math.min(rowMin, d[i][j]); } if (rowMin > max) return max + 1; } return d[a.length][b.length]; }
const knownWord = w => VOCAB.has(w) || [/S$/, /ES$/, /ED$/, /D$/, /ING$/, /LY$/].some(re => re.test(w) && VOCAB.has(w.replace(re, ''))) || (/IES$/.test(w) && VOCAB.has(w.replace(/IES$/, 'Y')));
function spellCheck(items) {
  const out = [], seen = new Set(); const V = [...VOCAB].filter(w => w.length >= 4);
  items.forEach(it => { if (it.border) return; (it.str.toUpperCase().match(/[A-Z]{4,}/g) || []).forEach(w => { if (seen.has(w) || knownWord(w)) return; seen.add(w); const max = w.length >= 8 ? 2 : 1;
    let best = null, bd = max + 1; for (const v of V) { if (Math.abs(v.length - w.length) > max || v[0] !== w[0] && v[1] !== w[1]) continue; const d = damerau(w, v, max); if (d < bd) { bd = d; best = v; if (d === 1) break; } }
    if (best && bd <= max) out.push({ word: w, fix: best, it }); }); });
  return out;
}
const FINISH_RA = { N1: 0.025, N2: 0.05, N3: 0.1, N4: 0.2, N5: 0.4, N6: 0.8, N7: 1.6, N8: 3.2, N9: 6.3, N10: 12.5, N11: 25, N12: 50 };
const finishProcess = ra => ra <= 0.1 ? 'lapping, superfinishing or polishing' : ra <= 0.4 ? 'grinding, honing or lapping' : ra <= 0.8 ? 'fine turning, fine boring or grinding' : ra <= 1.6 ? 'finish machining' : ra <= 3.2 ? 'standard machining' : 'rough machining, casting or as made';
const GSYM = { '⏥': 'flatness', '⏤': 'straightness', '○': 'circularity', '⌭': 'cylindricity', '⊥': 'perpendicularity', '∠': 'angularity', '∥': 'parallelism', '//': 'parallelism', '⌖': 'position', '⌓': 'profile of a surface', '⌒': 'profile of a line', '◎': 'concentricity', '⌯': 'symmetry', '↗': 'circular run-out', '⌰': 'total run-out' };
function drawingRead(items, text, ctx) {
  ctx = ctx || {}; const out = [], F = (status, cat, title, value, why, fix, its) => out.push({ status, cat, title, value, why, fix: fix || '', boxes: (its || []).filter(Boolean).map(i => [i.x, i.y, i.w, i.h]) });
  const tb = titleBlockOf(items); const T = String(text).toUpperCase(); const cap = ctx.processCap || 0.01;
  const tr = readTolerances(items); const tols = tr.list;
  // tolerances
  const tolRows = tols.map(t => { const adv = fitAdvice(t); const band = t.up - t.lo; const ig = t.nom > 0 && t.nom <= 500 ? itGrade(t.nom, band) : null;
    if (t.up < t.lo) F('fail', 'Tolerances', `${t.label}: upper below lower`, `${t.up} / ${t.lo}`, 'The upper deviation must be larger than the lower one.', 'Swap or correct the deviations.', [t.it]);
    else if (band <= 0) F('fail', 'Tolerances', `${t.label}: zero tolerance band`, `${fmt(t.up, 3)} / ${fmt(t.lo, 3)}`, 'No part can be made to an exact size.', 'Give a real tolerance band.', [t.it]);
    else if (band / 2 < cap) F('warn', 'Tolerances', `${t.label} is tighter than the process holds`, `band ${fmt(band, 3)} mm${ig ? ', about IT' + ig.g : ''}`, `The selected process holds about ±${fmt(cap, 3)} mm without extra operations.`, 'Check it is needed for function; otherwise relax it, or plan grinding or reaming.', [t.it]);
    if (t.kind === 'dia' && adv && !t.cls && !adv.exact.length && adv.near.length) F('info', 'Tolerances', `${t.label} ${t.up >= 0 ? '+' : ''}${fmt(t.up, 3)} / ${t.lo >= 0 ? '+' : ''}${fmt(t.lo, 3)} is not an ISO 286 class`, `Nearest ${adv.near.slice(0, 2).join(' or ')}`, 'A standard class lets the shop use standard reamers, plug gauges and ring gauges.', `Use a standard class, for example ${t.label} ${adv.near[0].split(' ')[0]}.`, [t.it]);
    return { label: t.label, kind: t.kind, nom: t.nom, up: t.up, lo: t.lo, cls: t.cls || (adv && adv.exact[0]) || '', src: t.src, it: ig ? 'IT' + ig.g : '', box: [t.it.x, t.it.y, t.it.w, t.it.h], adv }; });
  if (tols.length) F('pass', 'Tolerances', 'Toleranced sizes read', `${tols.length}: ` + tols.slice(0, 8).map(t => `${t.label} ${t.cls || ((t.up >= 0 ? '+' : '') + fmt(t.up, 3) + '/' + (t.lo >= 0 ? '+' : '') + fmt(t.lo, 3))}`).join(', '), '', '', tols.map(t => t.it));
  // reference dimensions and over-dimensioning
  const refs = items.filter(i => !i.border && !inTB(tb, i) && /^\((?:Ø|⌀|R)?\s*\d+(?:[.,]\d+)?°?\)$/.test(i.str.trim()));
  const lins = items.filter(i => i.o && !i.border && !inTB(tb, i) && !tr.children.has(i) && /^\(?\d+(?:[.,]\d+)?\)?$/.test(i.str.trim()) && !/^\(?0\)?$/.test(i.str.trim())).map(i => ({ i, v: num(i.str.replace(/[()]/g, '')), ref: /^\(/.test(i.str.trim()), hz: Math.abs(i.dir[0]) > 0.7 }));
  const over = [], closed = [];
  [true, false].forEach(hz => { const G = lins.filter(d => d.hz === hz); const lineOf = d => hz ? d.i.o[1] : d.i.o[0], along = d => hz ? d.i.o[0] : -d.i.o[1];
    const lines = []; G.forEach(d => { const l = lines.find(l => Math.abs(lineOf(l[0]) - lineOf(d)) < 2.5); if (l) l.push(d); else lines.push([d]); });
    lines.filter(l => l.length >= 2).forEach(l => { l.sort((a, b) => along(a) - along(b)); const a0 = along(l[0]), a1 = along(l[l.length - 1]);
      for (let s = 0; s < l.length; s++) for (let e = s + 1; e < l.length; e++) { const run = l.slice(s, e + 1), sum = run.reduce((x, d) => x + d.v, 0);
        const tot = G.find(d => !l.includes(d) && !d.ref && Math.abs(d.v - sum) < 0.011 && along(d) > a0 - 25 && along(d) < a1 + 25 && Math.abs(lineOf(d) - lineOf(l[0])) < 45);
        if (!tot) continue; (run.some(d => d.ref) ? closed : over).push({ run, tot }); } }); });
  over.slice(0, 5).forEach(o => F('warn', 'Dimensions', 'Over-dimensioned chain', `${o.run.map(d => d.i.str.trim()).join(' + ')} = ${o.tot.i.str.trim()}`, 'When every size in a chain and the overall size all carry a tolerance, the tolerances conflict and the part can be rejected while it works.', `Make one of them a reference dimension in brackets, for example (${o.run[o.run.length - 1].i.str.trim()}), or leave the least important one out.`, [o.tot.i, ...o.run.map(d => d.i)]));
  closed.slice(0, 3).forEach(o => F('pass', 'Dimensions', 'Closed chain uses a reference dimension', `${o.run.map(d => d.i.str.trim()).join(' + ')} = ${o.tot.i.str.trim()}`, '', '', [o.tot.i, ...o.run.filter(d => d.ref).map(d => d.i)]));
  if (refs.length) F('info', 'Dimensions', 'Reference dimensions', refs.map(i => i.str.trim()).join(', '), 'Sizes in brackets are for information only. They are not inspected and carry no tolerance.', '', refs);
  // surface finish
  const fin = []; items.forEach(i => { if (i.border || inTB(tb, i)) return; const s = i.str.toUpperCase(); let m; const re = /(?:^|[^A-Z0-9])\(?N(1[0-2]|[1-9])\)?(?![0-9.])/g; while ((m = re.exec(s))) { if (s.length > 8 && !/RA|FINISH/.test(s)) break; fin.push({ g: 'N' + m[1], ra: FINISH_RA['N' + m[1]], it: i, paren: /\(N/.test(s) }); }
    const r = s.match(/\bRA\s*[=:]?\s*(\d+(?:[.,]\d+)?)/); if (r) fin.push({ g: 'Ra ' + r[1], ra: num(r[1]), it: i }); });
  const nGrades = fin.filter(f => f.g[0] === 'N');
  if (nGrades.length) F('warn', 'Surface finish', 'Roughness grade numbers (N) used', [...new Set(nGrades.map(f => `${f.g} = Ra ${f.ra} µm`))].join(', '), 'N grade numbers came from the old ISO 1302:1992 and are no longer in ISO 1302:2002 or ISO 21920. Some suppliers will not accept them.', 'Write the Ra value in the symbol, for example ' + [...new Set(nGrades.map(f => `Ra ${f.ra}`))].join(', ') + '.', nGrades.map(f => f.it));
  fin.filter(f => f.ra <= 0.4).forEach(f => F('info', 'Surface finish', `${f.g} needs a finishing operation`, `Ra ${f.ra} µm`, `This finish usually needs ${finishProcess(f.ra)}, which adds cost and lead time.`, 'Keep it only on functional faces such as bearing seats and seals.', [f.it]));
  if (ctx.process === 'am' && fin.some(f => f.ra < 6.3)) F('warn', 'Surface finish', 'Finish finer than 3D printing gives', fin.filter(f => f.ra < 6.3).map(f => f.g).join(', '), 'Printed surfaces are about Ra 6 to 15 µm.', 'Add machining or polishing for these faces, or relax the finish.', fin.filter(f => f.ra < 6.3).map(f => f.it));
  const gen = nGrades.find(f => !f.paren) && nGrades.find(f => f.paren); if (gen) F('info', 'Surface finish', 'General finish with exceptions', `${nGrades.find(f => !f.paren).g} all over, ${gen.g} where shown`, 'The symbol with a value in brackets means the main finish applies everywhere except the faces marked with the bracketed value.', '', [gen.it]);
  // lines, notes, heat treatment and coatings
  const lines = textLines(items); const notes = lines.filter(l => !l.items.some(i => inTB(tb, i)) && (/^\d+[.)]\s|^NOTE/i.test(l.str) || (l.str.match(/[A-Za-z]{3,}/g) || []).length >= 3));
  const HT = /HARDEN|CASE|CARBURI[SZ]|NITRID|INDUCTION|QUENCH|TEMPER(?!ATURE)|ANNEAL|NORMALI[SZ]|STRESS\s*RELIEV|SOLUTION\s*TREAT|\bHRC\b|\bHV\s?\d|\bHB\s?\d|HARDNESS|\bT6\b|AGE(D|ING)/i, CO = /ANODI[SZ]|PLAT(E|ED|ING)\b|ZINC|NICKEL|CHROM|BLACK\s*OXIDE|PHOSPHAT|PASSIVAT|POWDER\s*COAT|PAINT|GALVANI|COAT(ED|ING)?\b/i;
  const isHT = s => HT.test(s.replace(/AFTER\s+(CASE\s+)?HARDEN\w*/gi, '')); const treat = lines.filter(l => HT.test(l.str) || CO.test(l.str)).map(l => ({ kind: isHT(l.str) ? 'Heat treatment' : 'Coating or finish', str: l.str, box: l.items }));
  treat.filter(t => t.kind === 'Heat treatment').forEach(t => { const S = t.str.toUpperCase();
    if (/HARDEN|CASE|CARBURI|NITRID|INDUCTION|QUENCH/.test(S) && !/HRC|HV\s?\d|HB\s?\d|HARDNESS\s*\d/.test(S)) F('warn', 'Heat treatment', 'Hardness value missing', t.str, 'A hardening note without a hardness value cannot be checked.', 'Add the hardness, for example 58-62 HRC.', t.box);
    if (/CASE|CARBURI|NITRID|INDUCTION/.test(S) && !/CHD|CASE\s*DEPTH|EHT|NHT|SHD|DEPTH\s*\d|\d\s*-\s*\d(\.\d)?\s*MM/.test(S)) F('warn', 'Heat treatment', 'Case depth missing', t.str, 'Case hardening needs a hardened depth, or the supplier picks one.', 'Add the case depth, for example CHD 0.6-0.9 mm (ISO 18203).', t.box);
    if (!treat._tight && tols.some(x => x.up - x.lo <= 0.04) && (treat._tight = 1)) F('info', 'Heat treatment', 'Tight sizes and heat treatment', t.str, 'Parts move during hardening, so sizes tighter than about 0.04 mm are usually ground after heat treatment.', 'Note "GRIND AFTER HARDENING" on the tight diameters, or leave grinding stock.', t.box); });
  if (/STEEL|16MNCR|42CRMO|C45|EN\s?1\.7|EN\s?1\.0/i.test(T) && !treat.some(t => t.kind === 'Coating or finish')) F('info', 'Heat treatment', 'No corrosion protection stated for steel', '', 'Bare steel rusts in storage.', 'State a finish, for example black oxide, zinc plating or "OIL AND PACK".');
  // spelling
  spellCheck(items).forEach(s => F('warn', 'Spelling', `"${s.word}" may be misspelled`, `Did you mean ${s.fix}?`, 'Spelling mistakes on a released drawing look careless and can change the meaning of a note.', `Correct it to ${s.fix}.`, [s.it]));
  // feature control frames
  const { groups: fcfs, used } = fcfGroups(items);
  const defined = new Set(items.filter(i => !used.has(i) && !i.border && !inTB(tb, i) && /^[A-Z]$/.test(i.str.trim())).map(i => i.str.trim()).concat((T.match(/DATUM\s+([A-Z])\b/g) || []).map(s => s.slice(-1))));
  const formT = ['flatness', 'straightness', 'circularity', 'cylindricity'], cyl = ['concentricity', 'position', 'circular run-out', 'total run-out', 'straightness'];
  fcfs.forEach(f => { const b = f.cells; let bad = false;
    if (formT.includes(f.type) && f.datums.length) { bad = true; F('fail', 'GD&T', `${f.type} references a datum`, f.str, 'Form tolerances control a feature on its own and must not reference datums (ISO 1101, ASME Y14.5).', 'Remove the datum, or use an orientation tolerance instead.', b); }
    if (!formT.includes(f.type) && !/profile/.test(f.type) && !f.datums.length) { bad = true; F('fail', 'GD&T', `${f.type} has no datum`, f.str, 'Orientation, location and run-out tolerances need a datum to be measured from.', 'Add the datum reference, for example | A |.', b); }
    f.datums.filter(d => !defined.has(d)).forEach(d => { bad = true; F('fail', 'GD&T', `Datum ${d} is not defined`, f.str, `The frame refers to datum ${d}, but no datum feature ${d} is shown on the drawing.`, `Add the datum feature symbol ${d} on the surface or axis it refers to.`, b); });
    if (new Set(f.datums).size < f.datums.length) { bad = true; F('fail', 'GD&T', 'Datum repeated in one frame', f.str, 'Each datum can appear only once in a frame.', 'Remove the repeated letter.', b); }
    if (!f.val) { bad = true; F('fail', 'GD&T', `${f.type} has no tolerance value`, f.str, '', 'Add the tolerance value.', b); }
    if (f.type === 'concentricity' && !f.dia) F('warn', 'GD&T', 'Concentricity zone without Ø', f.str, 'The zone of an axis is a cylinder, so Ø belongs before the value.', 'Write Ø before the value.', b);
    if (['flatness', 'parallelism', 'perpendicularity', 'angularity', 'profile of a surface'].includes(f.type) && f.dia) F('warn', 'GD&T', `Ø in a ${f.type} frame`, f.str, 'Ø makes the zone cylindrical, which only makes sense for an axis.', 'Remove Ø unless the tolerance controls an axis.', b);
    if (f.type === 'concentricity' || f.type === 'symmetry') F(ctx.standard === 'asme' ? 'warn' : 'info', 'GD&T', `${f.type} used`, f.str, ctx.standard === 'asme' ? 'Removed from ASME Y14.5-2018.' : 'Valid in ISO 1101 (for an axis it is called coaxiality), but slow to inspect because it needs the derived axis.', 'Total run-out or position to the same datum is quicker to inspect and usually controls the function as well.', b);
    if (!bad) F('pass', 'GD&T', `${f.type[0].toUpperCase() + f.type.slice(1)} frame`, f.str, f.datums.length ? `Datums ${f.datums.join(', ')} are defined.` : '', '', b); });
  if (!fcfs.length) F('info', 'GD&T', 'No feature control frames in the text', '', 'Frames drawn as graphics or in a CAD symbol font cannot be read as text. Run the AI drawing review to read them from the image.', '');
  const bi = ctx.border; const z = i => i ? zoneOf(bi, i.x + i.w / 2, i.y + i.h / 2) : '';
  return { findings: out, contents: {
    tolerances: tolRows.map(r => Object.assign(r, { zone: zoneOf(bi, r.box[0] + r.box[2] / 2, r.box[1] + r.box[3] / 2) })),
    finishes: fin.map(f => ({ g: f.g, ra: f.ra, process: finishProcess(f.ra), zone: z(f.it), box: [f.it.x, f.it.y, f.it.w, f.it.h] })),
    treatments: treat.map(t => ({ kind: t.kind, str: t.str, zone: z(t.box[0]) })),
    notes: notes.map(l => ({ str: l.str, zone: z(l.items[0]) })),
    refs: refs.map(i => ({ str: i.str.trim(), zone: z(i) })),
    fcfs: fcfs.map(f => ({ type: f.type, str: f.str, datums: f.datums, zone: z(f.cells[0]) })) } };
}

const api = { modelQuality, borderInfo, zoneOf, drawingRead, readTolerances, isoClassOf, fitAdvice, fcfGroups, viewOutlines, matchViews, standardsChecks, inspectionPlan, topology, keyDims, drawingMatch, parseDrawingDims, AM_MATS, CAST_ALLOYS, ISO286, thinAxis, ISO2768, THREADS, MATERIALS, AM, CAST, CNC, preparePart, analyze, thicknessMap, sharpEdges, dfa, drawingChecks, rayCast, fmt };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DFM = api;
})(typeof self !== 'undefined' ? self : this);
