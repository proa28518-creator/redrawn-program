// The video encoder of every render page. host.js, rhost.js, chost.js and dhost.js import this first, so it runs before
// any engine code and before their own wrappers (which then wrap what this leaves in globalThis).
//
// 1. window.__czEnc (render mode): how many frames went to the browser's video encoder, how many came back, and when the
//    first and the last went in. render.ts reads it while an export runs: an encoder that took frames and handed none back
//    while the page waits on it is found in about 20 s, instead of after the 2-minute stall watchdog, so the app's retries
//    (software encoder, then the app's own encoder below) also fit in the update check's 100-second demo export.
//    (A Windows computer with an AMD Radeon RX 9060 XT plus the processor's own graphics, 2026-11-09: every export, and the
//    update check's demo, stopped at frame 0; the page drew its frames, no encoder ever handed one back.)
// 2. ?cpuenc=1 (render mode): the app's last try when no video encoder of the browser hands a frame back (the graphics
//    card's and the software one: both are set up through the browser's graphics process). VideoEncoder and VideoFrame are
//    replaced by stand-ins: each frame's pixels are read on the processor (a 2D canvas) and sent to the app
//    (POST <base>/cpuenc/<session>), where ffmpeg's x264 encodes them on the processor (src/main/cpuenc.ts) and answers
//    with the H.264 bytes it has made so far. The engines' own code (configure, encode, the queue, flush, their /append
//    writes) runs unchanged, old engines too. Slower, the same picture.
// 3. ?testcpuhang=1 (only the app's test exportencstuck): with globalThis.CZ_HANG_CPUENC set by the test scene, the app's
//    own encoder never takes a frame either (its queue never drains)
const q = new URLSearchParams(location.search);
const RENDER = (q.get('mode') || 'preview') === 'render';
const BASE = location.pathname.replace(/\/[^/]*$/, '');          // /p/<project>/__suite

if (RENDER && q.get('cpuenc') === '1') {
  let scratch = null;
  const canvasFor = (w, h) => {
    if (!scratch) { const c = document.createElement('canvas'); scratch = { c, x: c.getContext('2d', { willReadFrequently: true, alpha: true }) }; }
    if (scratch.c.width !== w || scratch.c.height !== h) { scratch.c.width = w; scratch.c.height = h; }
    return scratch.x;
  };
  class CpuFrame {
    constructor(src, init = {}) {
      let w, h, px;
      if (src instanceof CpuFrame) { w = src.codedWidth; h = src.codedHeight; px = src._px; }
      else if (src instanceof ArrayBuffer || ArrayBuffer.isView(src)) {
        w = init.codedWidth | 0; h = init.codedHeight | 0; const f = String(init.format || '');
        if (!/^(RGBA|RGBX|BGRA|BGRX)$/.test(f) || !(w > 0 && h > 0)) throw new Error(`The app's own video encoder cannot read a ${f || 'raw'} frame.`);
        const bytes = src instanceof ArrayBuffer ? new Uint8Array(src) : new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
        px = new Uint8ClampedArray(bytes.subarray(0, w * h * 4));
        if (f[0] === 'B') for (let i = 0; i < px.length; i += 4) { const t = px[i]; px[i] = px[i + 2]; px[i + 2] = t; }
      } else {
        w = src.codedWidth || src.videoWidth || src.naturalWidth || src.width; h = src.codedHeight || src.videoHeight || src.naturalHeight || src.height;
        if (!(w > 0 && h > 0)) throw new Error('The app\'s own video encoder got a frame without a size.');
        const x = canvasFor(w, h); x.clearRect(0, 0, w, h); x.drawImage(src, 0, 0, w, h);
        px = x.getImageData(0, 0, w, h).data;
      }
      this.codedWidth = this.displayWidth = w; this.codedHeight = this.displayHeight = h; this.format = 'RGBA';
      this.timestamp = init.timestamp ?? src?.timestamp ?? 0; this.duration = init.duration ?? null; this._px = px;
    }
    clone() { return new CpuFrame(this, { timestamp: this.timestamp, duration: this.duration }); }
    close() { this._px = null; }
  }
  const sid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).replace(/[^\w-]/g, '');
  const hang = () => q.get('testcpuhang') === '1' && globalThis.CZ_HANG_CPUENC === true;
  class CpuEncoder {
    static async isConfigSupported(config) { return { supported: true, config }; }
    constructor(init) { this._init = init; this._q = []; this._busy = false; this._idle = []; this._state = 'unconfigured'; this._dead = null; this._first = true; this._sid = ''; this._cfg = null; this._ended = false; }
    get state() { return this._state; }
    get encodeQueueSize() { return hang() ? 99 : this._q.length + (this._busy ? 1 : 0); }
    configure(cfg) { this._cfg = cfg || {}; this._sid = sid(); this._state = 'configured'; this._first = true; }
    encode(frame) {
      if (this._dead) throw this._dead;
      if (this._state !== 'configured') throw new DOMException('The video encoder is not configured.', 'InvalidStateError');
      if (!frame?._px) throw new TypeError('The frame was closed before it was encoded.');
      this._q.push({ px: frame._px, w: frame.codedWidth, h: frame.codedHeight, ts: frame.timestamp });
      if (!hang()) this._pump();
    }
    async _post(args, body) {
      const r = await fetch(`${BASE}/cpuenc/${this._sid}?${args}`, { method: 'POST', body: body ?? new Uint8Array(0) });
      if (!r.ok) throw new Error(`The app's own video encoder (ffmpeg, on the processor) stopped: ${(await r.text().catch(() => '')) || `error ${r.status}`}`);
      return new Uint8Array(await r.arrayBuffer());
    }
    _emit(b, ts) {
      if (!b.length) return;
      const key = this._first; this._first = false;   // (the stream starts with a key frame; resume points need no more)
      this._init.output({ type: key ? 'key' : 'delta', timestamp: key ? 0 : ts, duration: null, byteLength: b.length,
        copyTo: d => (d instanceof ArrayBuffer ? new Uint8Array(d) : new Uint8Array(d.buffer, d.byteOffset, d.byteLength)).set(b) });
    }
    async _pump() {
      if (this._busy || this._dead) return;
      this._busy = true;
      try {
        const fps = +this._cfg.framerate || 30, br = +this._cfg.bitrate || 16e6;
        while (this._q.length) { const it = this._q.shift(); this._emit(await this._post(`w=${it.w}&h=${it.h}&fps=${fps}&bitrate=${Math.round(br)}`, it.px), it.ts); }
      } catch (e) { this._dead = e instanceof Error ? e : new Error(String(e)); this._q.length = 0; this._state = 'closed'; try { this._init.error?.(this._dead); } catch { /* the engine's own handler */ } }
      finally { this._busy = false; for (const f of this._idle.splice(0)) f(); }
    }
    async flush() {
      while ((this._busy || this._q.length) && !this._dead) await new Promise(r => this._idle.push(r));
      if (this._dead) throw this._dead;
      if (this._state !== 'configured') return;
      this._emit(await this._post('end=1'), 0); this._ended = true;
    }
    reset() { this._q.length = 0; this._abort(); this._state = 'unconfigured'; }
    close() { this._q.length = 0; this._abort(); this._state = 'closed'; }
    _abort() { if (this._sid && !this._ended) { this._ended = true; fetch(`${BASE}/cpuenc/${this._sid}?abort=1`, { method: 'POST', body: new Uint8Array(0) }).catch(() => {}); } }
  }
  globalThis.VideoFrame = CpuFrame;
  globalThis.VideoEncoder = CpuEncoder;
}

// (?testhang=2, only the app's test exportencstuck: the browser's encoder takes frames and never hands one back, hardware or
// software: its queue never drains and nothing comes out)
const stuck = RENDER && q.get('testhang') === '2' && q.get('cpuenc') !== '1';
// (?testencerr=<seconds>[all], only the app's test exportencerr: the browser's graphics card encoder fails with an
// EncodingError once that much video went in, as a Mac's did at 0:24 on every try; "all" = the software one too. Never
// the app's own encoder)
const encErrAt = RENDER && q.get('cpuenc') !== '1' && (q.get('swenc') !== '1' || /all$/.test(q.get('testencerr') || '')) ? parseFloat(q.get('testencerr') || '') || 0 : 0;
const encErrFrom = +q.get('testencfrom') || 0;                     // (where this page's part of the video starts)
if (RENDER && globalThis.VideoEncoder) {
  const Base = globalThis.VideoEncoder, n = window.__czEnc = { in: 0, out: 0, first: 0, last: 0, cpu: q.get('cpuenc') === '1', err: null };
  globalThis.VideoEncoder = class extends Base {
    static isConfigSupported(c) { return Base.isConfigSupported(c); }
    constructor(init) {
      // the encoder's own error (a DOMException: EncodingError, OperationError ...) is kept: the engines stop on it, and
      // without it the app only saw "[object Object]" (David's Mac: every pixel art export stopped at 0:24 with that)
      const fail = (e) => { if (!n.err) n.err = e; return init.error?.(e); };
      super({ ...init, output: (c, meta) => { if (stuck) return; n.out++; return init.output(c, meta); }, error: fail });
      this._fail = fail;
    }
    get encodeQueueSize() { return stuck ? 99 : super.encodeQueueSize; }
    encode(frame, opts) {
      if (encErrAt && this._failed) throw new DOMException("Cannot call 'encode' on a closed codec.", 'InvalidStateError');
      if (encErrAt && encErrFrom + frame.timestamp / 1e6 >= encErrAt - 1e-6) { this._failed = true; const e = new DOMException('Encoding error (test).', 'EncodingError'); setTimeout(() => this._fail(e), 0); return; }
      const t = Date.now(); if (!n.in) n.first = t; n.in++; n.last = t; return super.encode(frame, opts);
    }
  };
}
// Every render page's export error as words (render.ts wraps window.suite.exportVideo with it): a DOMException or any
// object that isn't an Error reached the app as "[object Object]" (Electron's executeJavaScript keeps only real Errors).
// An error of the video encoder is said as one (the app then tries the software encoder, then its own); a picture from
// another website that the browser refuses to record (a "tainted" frame) says what fixes it.
const ENC_FAILED = 'The video encoder stopped with an error';
const words = (e) => {
  if (e == null) return 'no reason given';
  if (typeof e !== 'object') return String(e);
  const name = e.name && e.name !== 'Error' ? String(e.name) : '', msg = e.message ? String(e.message) : '';
  if (msg) return name && !msg.startsWith(name) ? `${name}: ${msg}` : msg;
  if (name || e.type) return name || `${e.type} event`;
  try { const j = JSON.stringify(e); if (j && j !== '{}') return j.slice(0, 300); } catch { /* not JSON */ }
  return Object.prototype.toString.call(e).replace(/^\[object (\w+)\]$/, '$1') + ' (no reason given)';
};
if (RENDER) window.__czErrText = (e) => {
  const enc = window.__czEnc?.err;
  if (enc) return `${ENC_FAILED} (${words(enc)}).`;
  // (its error callback can come a moment after an engine's next encode() on the closed encoder threw this; render.ts
  // waits 50 ms before asking, so the real reason is usually there)
  if (e?.name === 'EncodingError' || (e?.name === 'InvalidStateError' && /closed codec/i.test(e.message || ''))) return `${ENC_FAILED} (${words(e)}).`;
  if (e?.name === 'SecurityError') return `A picture in the video comes from another website and the browser won't let the export record it (${words(e)}). Ask Claude to download the pictures the scenes load from the internet into the project's assets folder and use them from there, then export again.`;
  return words(e);
};
