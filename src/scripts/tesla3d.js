// 3D-модель Tesla Model 3 у першому екрані (замість плоскої гравюри).
// Рендер перенесено з TESLA/Переглядач.html: власний WebGL 2 без бібліотек, матеріали «гравюра»,
// контури деталей у пост-обробці. Модель: «2024 Tesla Model 3», автор RBLXSupercars, CC BY 4.0,
// адаптована для сервісу (51 окрема деталь, ID у node.name).
// Вузол із блоку (data-part) → які деталі підсвітити, з якого ракурсу дивитися і де поставити номер.
// Файл моделі стиснуто (EXT_meshopt_compression + KHR_mesh_quantization, без салону, який за склом не видно);
// оригінал — TESLA/Tesla Model 3.glb. Новий part тут потрібно додати й у PARTS у Hero.astro.
// pose: [yaw, pitch] — yaw<0 погляд спереду, cos(yaw)>0 лівий борт; pitch<0 — знизу.
// zoom/focus (необов'язково) — наблизити камеру до дрібної деталі.

const RIMS = ['rim_front_L', 'rim_front_R', 'rim_rear_L', 'rim_rear_R'];
const TIRES = ['tire_front_L', 'tire_front_R', 'tire_rear_L', 'tire_rear_R'];
const ZONES = {
  battery: { ids: ['undertray', 'rocker_L', 'rocker_R'], pose: [-0.42, -0.34], at: [-0.2, 0.18, 0.55] },
  chassis: { ids: RIMS, pose: [-0.55, 0.12], at: [-1.48, 0.34, 0.92] },
  electronics: { ids: ['side_camera_L', 'side_camera_R', 'mirror_L', 'mirror_R', 'headlight_L', 'headlight_R', 'taillight_L', 'taillight_R'], pose: [-0.82, 0.2], at: [-1.09, 0.7, 0.9] },
  glass: { ids: ['windshield', 'roof_glass', 'rear_glass', 'glass_front_L', 'glass_rear_L', 'quarter_glass_L', 'glass_front_R', 'glass_rear_R', 'quarter_glass_R'], pose: [-0.95, 0.52], at: [-0.74, 1.08, 0] },
  charge: { ids: ['charge_port_door'], pose: [0.82, 0.24], at: [1.93, 0.86, 0.76] },
  climate: { ids: ['hood'], pose: [-1.12, 0.36], at: [-1.62, 0.72, 0] },
  cooling: { ids: ['bumper_front'], pose: [-1.3, 0.16], at: [-2.2, 0.38, 0.35] },
  // під капотом (frunk) — рідини, салонний фільтр під жабо, склоочисники
  maintenance: { ids: ['hood', 'wipers', 'bumper_front'], pose: [-1.05, 0.42], zoom: 1.7, focus: [-1.45, 0.66, 0], at: [-1.55, 0.76, 0.1] },
  brakes: { ids: ['rim_front_L'], pose: [-0.3, 0.1], zoom: 2.7, focus: [-1.48, 0.38, 0.9], at: [-1.48, 0.34, 0.96] },
  aircon: { ids: ['wipers', 'windshield'], pose: [-1.25, 0.48], zoom: 2.2, focus: [-1.2, 0.86, 0], at: [-1.23, 0.9, 0.3] },
  tyres: { ids: TIRES, pose: [0.6, 0.1], at: [1.39, 0.35, 0.86] },
  alignment: { ids: ['tire_front_L', 'rim_front_L', 'tire_front_R', 'rim_front_R'], pose: [-1.0, 0.14], at: [-1.48, 0.34, 0.92] },
};
import { MeshoptDecoder } from 'meshoptimizer/decoder';

const MODEL_URL = '/models/tesla-model-3.glb';
const CENTER_Y = 0.69;

const root = document.getElementById('tesla');
const stage = root?.querySelector('.tesla-stage');
const canvas = stage?.querySelector('canvas');
if (root && stage && canvas) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = () => run().catch((err) => { console.warn('Tesla 3D недоступна, лишається гравюра', err); });
  // модель важка — тягнемо її після завантаження сторінки, щоб не гальмувати перший екран
  if (document.readyState === 'complete') setTimeout(start, 50); else addEventListener('load', () => setTimeout(start, 50), { once: true });

  async function run() {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) throw Error('WebGL 2');
    const [res] = await Promise.all([fetch(MODEL_URL), MeshoptDecoder.ready]);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const dv = new DataView(bytes.buffer), jlen = dv.getUint32(12, true);
    const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jlen)));
    const bin = 28 + jlen;
    // дані bufferView: стиснені meshopt розпаковуємо, решту беремо як є з BIN-чанка
    const views = new Map();
    function viewBytes(i) {
      if (views.has(i)) return views.get(i);
      const bv = gltf.bufferViews[i], ext = bv.extensions?.EXT_meshopt_compression;
      let out;
      if (ext) {
        out = new Uint8Array(ext.count * ext.byteStride);
        MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, bytes.subarray(bin + (ext.byteOffset || 0), bin + (ext.byteOffset || 0) + ext.byteLength), ext.mode, ext.filter);
      } else out = bytes.subarray(bin + (bv.byteOffset || 0), bin + (bv.byteOffset || 0) + bv.byteLength);
      views.set(i, out);
      return out;
    }
    // світові матриці вузлів (квантування переносить масштаб і зсув у вузли)
    const mul = (a, b) => { const r = new Float32Array(16); for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) r[c * 4 + rr] = a[rr] * b[c * 4] + a[4 + rr] * b[c * 4 + 1] + a[8 + rr] * b[c * 4 + 2] + a[12 + rr] * b[c * 4 + 3]; return r; };
    function local(n) {
      if (n.matrix) return Float32Array.from(n.matrix);
      const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
      return Float32Array.from([
        (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
        2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
        2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
        tx, ty, tz, 1]);
    }
    const world = new Map();
    const walk = (i, parent) => { const m = mul(parent, local(gltf.nodes[i])); world.set(gltf.nodes[i], m); (gltf.nodes[i].children || []).forEach((c) => walk(c, m)); };
    (gltf.scenes?.[gltf.scene ?? 0]?.nodes || [0]).forEach((i) => walk(i, Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])));
    const renderNodes = gltf.nodes.filter((n) => n.mesh != null && world.has(n));
    const pickable = renderNodes.filter((n) => n.extras?.selectable !== false);
    const pickId = new Map(pickable.map((n, i) => [n.name, i + 1]));
    const zoneOf = new Map();
    for (const [p, z] of Object.entries(ZONES)) for (const id of z.ids) zoneOf.set(id, p);

    // ---------- шейдери (з переглядача; фон прозорий — його малює сам блок) ----------
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; };
    const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p)); return p; };
    const vert = `#version 300 es
layout(location=0) in vec3 pos;layout(location=1) in vec3 norm;layout(location=2) in vec2 uv;
uniform vec3 rightV,upV,eyeV;uniform vec2 halfSize,pan;uniform float perspective;uniform mat4 model;uniform vec3 ctr;
out vec3 N;out vec3 P;out vec2 UV;
void main(){vec3 wp=(model*vec4(pos,1)).xyz;vec3 p=wp-ctr;float z=dot(p,eyeV);float w=1.-perspective*z;gl_Position=vec4(vec2(dot(p,rightV),dot(p,upV))/halfSize+pan*w,-z/6.,w);N=normalize(mat3(model)*norm);P=wp;UV=uv;}`;
    const flat = `#version 300 es
precision highp float;
uniform sampler2D tex;uniform vec3 base,eyeV,ctr;uniform float useTex,sel,part,picking,kind;
in vec2 UV;in vec3 P;in vec3 N;layout(location=0) out vec4 color;layout(location=1) out vec4 info;
void main(){if(picking>.5){color=vec4(part/255.,0,0,1);info=vec4(0);return;}
vec3 n=normalize(N);vec3 c=mix(base,texture(tex,UV).rgb,useTex);
float facing=clamp(abs(dot(n,eyeV)),0.,1.);
vec3 V=normalize(eyeV*9.-(P-ctr));vec3 r=reflect(-V,n);
float sky=smoothstep(-.18,.70,r.y);
float strip=exp(-pow((r.y-.16-.13*r.x)/.12,2.));
float broad=exp(-pow((r.y-.69+.10*r.x)/.27,2.));
float low=exp(-pow((r.y+.48)/.08,2.));
float fres=pow(1.-facing,3.3);float diffuse=.50+.34*max(n.y,0.)+.20*max(dot(n,normalize(vec3(-.65,.45,.5))),0.);
float spec=(.19*broad+.19*strip+.065*low+.055*sky+.1*fres);
vec3 cool=vec3(.88,.98,1.);
if(kind<.5){c=c*(.68+diffuse*.42)+cool*spec*.70;}
else if(kind<1.5){c=c*(.48+.48*diffuse)+cool*(.06*sky+.11*broad+.12*strip+.11*fres);}
else if(kind<2.5){c=c*(.59+.52*diffuse)+cool*(.11*broad+.05*strip+.035*fres);}
else if(kind<3.5){c=c*(.56+.5*diffuse)+cool*(.042*sky+.04*fres);}
else if(kind<4.5){c=c*(.4+.65*diffuse)+cool*(spec*1.25);}
else if(kind<5.5){c=c*(.46+.44*diffuse)+cool*(.1*broad+.12*strip+.08*fres);}
else if(kind<6.5){c=c*(.82+.18*diffuse);}
else if(kind<7.5){c=vec3(.67,.70,.67);}
else if(kind>8.5){c=c*(.80+.32*diffuse)+cool*(.08*broad+.10*strip+.04*fres);}
else{c=c*(.64+.38*diffuse)+cool*(.065*sky+.08*strip);}
if(sel>0.){float v=dot(c,vec3(.28,.53,.19));vec3 hot=mix(vec3(.62,.19,.03),vec3(1.,.66,.36),clamp((v-.06)*1.73,0.,1.));c=mix(c,hot,sel);}
color=vec4(c,1);info=vec4(n*.5+.5,gl_FragCoord.z);}`;
    const quad = `#version 300 es
out vec2 tc;void main(){vec2 q=vec2((gl_VertexID<<1)&2,gl_VertexID&2);tc=q;gl_Position=vec4(q*2.-1.,0,1);}`;
    const post = `#version 300 es
precision highp float;uniform sampler2D src,geom;uniform vec2 px,halfSize,pan;uniform float device;uniform vec3 upV,rightV,eyeV,ctr;in vec2 tc;out vec4 frag;
float shade(){vec2 p=tc*2.-1.;
 vec3 origin=ctr+rightV*((p.x-pan.x)*halfSize.x)+upV*((p.y-pan.y)*halfSize.y);
 if(eyeV.y<=.04)return 0.;vec3 ground=origin-eyeV*(origin.y/eyeV.y);
 float s=exp(-pow(abs(ground.x)/2.35,4.)-pow(abs(ground.z)/.93,4.));
 float wheel=0.;for(int i=0;i<4;i++){vec2 wc=vec2(i<2?-1.48:1.39,(i%2==0?.81:-.81));wheel=max(wheel,exp(-dot((ground.xz-wc)/vec2(.30,.18),(ground.xz-wc)/vec2(.30,.18))));}
 return (.42*s+.3*wheel)*smoothstep(.005,.1,eyeV.y);}
void main(){vec4 col=texture(src,tc);vec3 result=col.rgb;
 vec4 n=texture(geom,tc);float edge=0.;float silhouette=0.;
 vec2 stepPx=px*max(1.,device*1.08);
 for(int i=0;i<4;i++){vec2 d=(i==0?vec2(1,0):i==1?vec2(-1,0):i==2?vec2(0,1):vec2(0,-1))*stepPx;
  vec4 a=texture(geom,tc+d);vec4 other=texture(src,tc+d);silhouette=max(silhouette,1.-other.a);
  edge=max(edge,other.a*smoothstep(.016,.040,abs(n.a-a.a)));edge=max(edge,other.a*.49*smoothstep(.28,.6,length(n.rgb-a.rgb)));}
 vec3 lineCol=col.r>col.b*1.4?vec3(1.,.79,.55):vec3(.77,.84,.79);
 result=mix(result,lineCol,max(silhouette*.81,edge*.54));
 float a=col.a;float s=(1.-a)*shade();
 frag=vec4(result*a,a+s);}`;
    const surf = prog(vert, flat), compose = prog(quad, post);
    const locs = (p, names) => Object.fromEntries(names.split(' ').map((n) => [n, gl.getUniformLocation(p, n)]));
    const u = locs(surf, 'rightV upV eyeV halfSize pan ctr perspective model tex base useTex sel part picking kind');
    const v = locs(compose, 'px device src geom eyeV upV rightV halfSize pan ctr');

    // ---------- геометрія й текстури ----------
    const gpu = new Map();
    function upload(access, which, attr) {
      const a = gltf.accessors[access], b = gltf.bufferViews[a.bufferView];
      if (!gpu.has(a.bufferView)) { const buf = gl.createBuffer(); gl.bindBuffer(which, buf); gl.bufferData(which, viewBytes(a.bufferView), gl.STATIC_DRAW); gpu.set(a.bufferView, buf); }
      gl.bindBuffer(which, gpu.get(a.bufferView));
      if (attr != null) { gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr, { VEC2: 2, VEC3: 3 }[a.type], a.componentType, !!a.normalized, b.byteStride || 0, a.byteOffset || 0); }
      return a;
    }
    const models = renderNodes.map((node) => gltf.meshes[node.mesh].primitives.map((p) => {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      Object.entries({ POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }).forEach(([k, idx]) => { if (p.attributes[k] != null) upload(p.attributes[k], gl.ARRAY_BUFFER, idx); });
      return { vao, acc: upload(p.indices, gl.ELEMENT_ARRAY_BUFFER), mat: p.material };
    }));
    gl.bindVertexArray(null);
    const textures = await Promise.all((gltf.images || []).map(async (image) => {
      const bmp = await createImageBitmap(new Blob([viewBytes(image.bufferView)], { type: image.mimeType || 'image/png' }));
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, bmp); bmp.close();
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.generateMipmap(gl.TEXTURE_2D);
      return t;
    }));
    const linToSrgb = (x) => (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
    const KIND = { body: 0, glass: 1, sideglass: 1, trim: 2, core: 2, rubber: 3, alloy: 4, blade: 4, wheelshade: 9, lens: 5, white: 6, taillamp: 7 };
    const materials = gltf.materials.map((m) => {
      const p = m.pbrMetallicRoughness || {};
      return { tex: textures[p.baseColorTexture?.index ?? 0], has: !!p.baseColorTexture, base: (p.baseColorFactor || [1, 1, 1]).slice(0, 3).map(linToSrgb), kind: KIND[m.name] ?? 8 };
    });

    // ---------- камера ----------
    let part = root.dataset.part in ZONES ? root.dataset.part : 'battery';
    // стан камери: [yaw, pitch, наближення, центр x, y, z]; наближені вузли дивляться на свою точку focus
    const camOf = (z) => [...z.pose, z.zoom || 1, ...(z.focus || [0, CENTER_Y, 0])];
    let [yaw, pitch, zm, ...ctr] = camOf(ZONES[part]);
    let from = camOf(ZONES[part]), to = from, t0 = 0, dur = 1;
    let glow = 1, glowT0 = 0, dragging = false;
    let device = 1, cam = {}, target = null, pickTarget = null, scheduled = false;
    const lit = new Set(ZONES[part].ids);

    function fb(two) {
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); const att = [];
      for (let i = 0; i < (two ? 2 : 1); i++) {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        for (const [k, val] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, val);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0); att.push(t);
      }
      const depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, canvas.width, canvas.height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      gl.drawBuffers(two ? [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1] : [gl.COLOR_ATTACHMENT0]);
      return { f, att, depth };
    }
    function size() {
      device = Math.min(2, Math.max(1.5, devicePixelRatio || 1));
      const w = Math.max(1, Math.round(canvas.clientWidth * device)), h = Math.max(1, Math.round(canvas.clientHeight * device));
      if (w !== canvas.width || h !== canvas.height || !target) {
        for (const t of [target, pickTarget]) if (t) { t.att.forEach((x) => gl.deleteTexture(x)); gl.deleteRenderbuffer(t.depth); gl.deleteFramebuffer(t.f); }
        canvas.width = w; canvas.height = h; target = fb(true); pickTarget = fb(false);
      }
      gl.viewport(0, 0, w, h);
      const si = Math.sin(yaw), co = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
      // авто вміщається в рамку за будь-якого ракурсу: довжина 4.75 м, ширина 1.95 м, висота 1.45 м
      const projW = 4.75 * Math.abs(co) + 1.95 * Math.abs(si);
      const projH = 1.45 * Math.abs(cp) + Math.abs(sp) * (4.75 * Math.abs(si) + 1.95 * Math.abs(co));
      const half = Math.max(projH * 0.55, (projW * 0.53 * h) / w) / zm;
      cam = { rightV: [co, 0, -si], upV: [-si * sp, cp, -co * sp], eyeV: [si * cp, sp, co * cp], halfSize: [(half * w) / h, half], pan: [0, 0], ctr };
    }
    function setCam(un) { for (const n of ['rightV', 'upV', 'eyeV', 'ctr']) gl.uniform3fv(un[n], cam[n]); gl.uniform2fv(un.halfSize, cam.halfSize); gl.uniform2fv(un.pan, cam.pan); }
    function scene(isPick) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, (isPick ? pickTarget : target).f);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.useProgram(surf); setCam(u); gl.uniform1f(u.perspective, 0.108); gl.uniform1f(u.picking, isPick ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(u.tex, 0);
      for (let i = 0; i < models.length; i++) {
        const name = renderNodes[i].name;
        gl.uniform1f(u.part, pickId.get(name) || 0); gl.uniform1f(u.sel, lit.has(name) ? glow : 0);
        gl.uniformMatrix4fv(u.model, false, world.get(renderNodes[i]));
        for (const p of models[i]) {
          const m = materials[p.mat]; gl.bindTexture(gl.TEXTURE_2D, m.tex);
          if (!isPick) { gl.uniform3fv(u.base, m.base); gl.uniform1f(u.useTex, m.has ? 1 : 0); gl.uniform1f(u.kind, m.kind); }
          gl.bindVertexArray(p.vao); gl.drawElements(gl.TRIANGLES, p.acc.count, p.acc.componentType, p.acc.byteOffset || 0);
        }
      }
    }
    // точка в 3D → відсотки в рамці (для номера вузла)
    function project([x, y, z]) {
      const p = [x - ctr[0], y - ctr[1], z - ctr[2]], d = (a) => a[0] * p[0] + a[1] * p[1] + a[2] * p[2];
      const w = 1 - 0.108 * d(cam.eyeV);
      const nx = d(cam.rightV) / cam.halfSize[0] / w, ny = d(cam.upV) / cam.halfSize[1] / w;
      return [(nx * 0.5 + 0.5) * 100, (0.5 - ny * 0.5) * 100];
    }
    const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    function draw(now) {
      scheduled = false;
      let more = false;
      if (!dragging && t0) {
        const k = Math.min(1, (now - t0) / dur), e = ease(k);
        [yaw, pitch, zm, ...ctr] = from.map((f, i) => f + (to[i] - f) * e);
        if (k < 1) more = true; else t0 = 0;
      }
      if (glowT0) { glow = Math.min(1, (now - glowT0) / 450); if (glow < 1) more = true; else glowT0 = 0; }
      size(); scene(false);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.disable(gl.DEPTH_TEST);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(compose); gl.bindVertexArray(null); setCam(v);
      gl.uniform2f(v.px, 1 / canvas.width, 1 / canvas.height); gl.uniform1f(v.device, device);
      target.att.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(i ? v.geom : v.src, i); });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const m = stage.querySelector(`.hot[data-part="${part}"]`);
      if (m) { const [l, t] = project(ZONES[part].at); m.style.left = l + '%'; m.style.top = t + '%'; }
      if (more) request();
    }
    function request() { if (!scheduled) { scheduled = true; requestAnimationFrame(draw); } }

    function show(next) {
      if (!(next in ZONES)) return;
      const changed = next !== part;
      part = next; lit.clear(); ZONES[part].ids.forEach((id) => lit.add(id));
      // найкоротший поворот до потрібного ракурсу
      const goal = camOf(ZONES[part]), [ty, tp] = goal;
      const dy = Math.atan2(Math.sin(ty - yaw), Math.cos(ty - yaw));
      from = [yaw, pitch, zm, ...ctr]; to = [yaw + dy, ...goal.slice(1)];
      if (reduce) { [yaw, pitch, zm, ...ctr] = to; t0 = 0; } else { t0 = performance.now(); dur = 750 + 450 * Math.min(1, Math.hypot(dy, tp - pitch, Math.log(goal[2] / zm)) / 2); }
      if (changed && !reduce) { glow = 0; glowT0 = performance.now(); }
      request();
    }
    // вузол перемикає основний скрипт блоку (кнопки, автоперемикання) — стежимо за data-part
    new MutationObserver(() => show(root.dataset.part)).observe(root, { attributes: true, attributeFilter: ['data-part'] });

    // ---------- обертання мишею / пальцем, клік по деталі ----------
    let startXY = null, prev = null, moved = false;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      startXY = prev = [e.clientX, e.clientY]; moved = false;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!prev) return;
      if (!moved && Math.hypot(e.clientX - startXY[0], e.clientY - startXY[1]) > 4) {
        moved = true; dragging = true; t0 = 0;
        root.dispatchEvent(new CustomEvent('tesla:interact')); // зупиняє автоперемикання
      }
      if (moved) {
        yaw -= (e.clientX - prev[0]) * 0.009;
        if (e.pointerType === 'mouse') pitch = Math.min(1.2, Math.max(-0.6, pitch + (e.clientY - prev[1]) * 0.007));
        request();
      }
      prev = [e.clientX, e.clientY];
    });
    const end = (e) => {
      if (!prev) return;
      const wasClick = !moved && e.type === 'pointerup';
      prev = null; dragging = false;
      if (!wasClick) return;
      size(); scene(true);
      const r = canvas.getBoundingClientRect(), px = new Uint8Array(4);
      gl.readPixels(Math.min(canvas.width - 1, Math.max(0, Math.floor((e.clientX - r.left) * device))), Math.min(canvas.height - 1, Math.max(0, Math.floor((r.bottom - e.clientY) * device))), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const hit = px[0] ? pickable[px[0] - 1]?.name : null, z = hit && zoneOf.get(hit);
      const chip = z && root.querySelector(`.tesla-chips button[data-part="${z}"]`);
      if (chip) chip.click();
      request();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    new ResizeObserver(request).observe(canvas);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stage.classList.remove('is-3d'); });
    draw(performance.now());
    stage.classList.add('is-3d');
  }
}
