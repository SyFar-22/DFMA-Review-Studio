/* Reads CAD files off the main thread. STEP, IGES and BREP go through OpenCascade (occt-import-js); STL is parsed here. */
importScripts('./vendor/occt-import-js.js');
let occtP = null;
function occt() { if (!occtP) occtP = occtimportjs({ locateFile: f => './vendor/' + f }); return occtP; }
function parseSTL(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength >= 84) { const n = dv.getUint32(80, true); if (84 + n * 50 === buf.byteLength) { const P = new Float32Array(n * 9); for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12; for (let j = 0; j < 9; j++) P[i * 9 + j] = dv.getFloat32(o + j * 4, true); } return P; } }
  const txt = new TextDecoder().decode(buf), re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g, out = []; let m;
  while ((m = re.exec(txt))) out.push(+m[1], +m[2], +m[3]);
  if (out.length < 9) throw new Error('No triangles found in the STL file');
  return new Float32Array(out);
}
function names(node, map, path, inst, ctr) { const nm = node.name || path; const id = ctr.n++; (node.meshes || []).forEach(i => { map[i] = nm; inst[i] = id; }); (node.children || []).forEach((c, k) => names(c, map, c.name || nm + '-' + (k + 1), inst, ctr)); }
self.onmessage = async (e) => {
  const { id, name, buffer } = e.data; const ext = (name.split('.').pop() || '').toLowerCase();
  try {
    if (ext === 'stl') { const P = parseSTL(buffer); self.postMessage({ id, ok: true, meshes: [{ name: name.replace(/\.[^.]+$/, ''), position: P, normal: null, index: null, faces: null }] }, [P.buffer]); return; }
    const o = await occt(); const data = new Uint8Array(buffer);
    const params = { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.0008, angularDeflection: 0.35 };
    let r;
    if (ext === 'step' || ext === 'stp') r = o.ReadStepFile(data, params);
    else if (ext === 'iges' || ext === 'igs') r = o.ReadIgesFile(data, params);
    else if (ext === 'brep' || ext === 'brp') r = o.ReadBrepFile(data, params);
    else throw new Error('Unsupported format .' + ext);
    if (!r || !r.success || !r.meshes.length) throw new Error('The file could not be read as a solid model. Re-export it as STEP AP214 or AP242.');
    const map = {}, inst = {}; names(r.root, map, name.replace(/\.[^.]+$/, ''), inst, { n: 0 });
    const meshes = r.meshes.map((m, i) => ({ name: m.name || map[i] || 'Part ' + (i + 1), position: new Float32Array(m.attributes.position.array), normal: m.attributes.normal ? new Float32Array(m.attributes.normal.array) : null, index: m.index ? new Uint32Array(m.index.array) : null, faces: m.brep_faces || null, color: m.color || null, inst: inst[i] != null ? inst[i] : -1 - i }));
    const tr = []; meshes.forEach(m => { tr.push(m.position.buffer); if (m.normal) tr.push(m.normal.buffer); if (m.index) tr.push(m.index.buffer); });
    self.postMessage({ id, ok: true, meshes }, tr);
  } catch (err) { self.postMessage({ id, ok: false, error: String(err && err.message || err) }); }
};
