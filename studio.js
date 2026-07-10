// ../../packages/protocol/dist/version.js
var PROVIDER_GLOBAL = "claude";

// ../../packages/sdk/dist/connect-chip.js
var STYLE = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
.chip, .btn { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; border: 0;
  font-size: 13px; font-weight: 600; line-height: 1; border-radius: 10px; }
/* The canonical connect lockup \u2014 the SAME mark + wordmark on every wrapp, so users recognize
   "Connect Switchboard" the way they knew the MetaMask button. Dark pill, lime glyph, locked in
   the shadow root so a host app can't restyle it away. */
.btn { padding: 9px 15px 9px 11px; background: #12151C; color: #E8EDF4; border: 1px solid #2C3444; }
.btn.connect:hover { background: #161B24; border-color: #3A4A18; }
.btn.get { color: #C3CAD6; border-color: #262C38; }
.btn.get:hover { color: #E8EDF4; border-color: #3A4353; }
.btn .arr { color: #6E7C90; font-weight: 500; margin-left: -2px; }
/* The Switchboard mark: lime rounded square with the top-right notch (matches the side-panel brand).
   Muted to slate when the sidekick isn't installed yet \u2014 the mark "lights up" once you can connect. */
.glyph { position: relative; width: 16px; height: 16px; border-radius: 5px; background: #C8F250;
  box-shadow: 0 0 12px rgba(200,242,80,.45); flex: none; }
.glyph::after { content: ""; position: absolute; top: 4px; right: 4px; width: 4px; height: 4px;
  border-radius: 50%; background: #0A0C10; }
.btn.get .glyph { background: #6E7C90; box-shadow: none; }
.wrap { position: relative; display: inline-block; }
.chip { background: #1A1F29; border: 1px solid #262C38; padding: 6px 10px 6px 7px; color: #E8EDF4; }
.chip:hover { border-color: #3A4353; }
.av { width: 26px; height: 26px; border-radius: 7px; background: #C8F250; color: #0A0C10; display: grid;
  place-items: center; font-weight: 700; font-size: 12px; overflow: hidden; flex: none; }
.av img { width: 100%; height: 100%; object-fit: cover; }
.who { display: flex; flex-direction: column; gap: 3px; min-width: 0; text-align: left; }
.who .hi { font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.who .proj { font-size: 10.5px; font-weight: 500; color: #99A3B7; white-space: nowrap; }
.caret { color: #6E7C90; font-size: 9px; margin-left: 2px; }
.menu { position: absolute; top: calc(100% + 6px); right: 0; z-index: 2147483000; width: 232px;
  background: #1A1F29; border: 1px solid #262C38; border-radius: 12px; padding: 7px;
  box-shadow: 0 18px 40px -20px rgba(0,0,0,.7); }
.menu .lbl { padding: 8px 10px 6px; font-size: 10px; font-weight: 600; letter-spacing: .06em;
  text-transform: uppercase; color: #6E7C90; }
.menu .proj-row { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 8px;
  background: #20262F; cursor: pointer; border: 0; width: 100%; color: #E8EDF4; font-size: 13px; font-weight: 600; }
.menu .proj-row:hover { background: #262d38; }
.menu .proj-row .go { margin-left: auto; color: #C8F250; font-size: 11px; font-weight: 600; }
.menu .sep { height: 1px; background: #262C38; margin: 6px 4px; }
.menu .item { display: block; width: 100%; text-align: left; padding: 8px 10px; border: 0; border-radius: 8px;
  background: transparent; color: #B4BECE; font-size: 13px; font-weight: 500; cursor: pointer; }
.menu .item:hover { background: #20262F; color: #E8EDF4; }
.menu .foot { padding: 8px 10px 4px; font-size: 11px; font-weight: 500; color: #6E7C90; line-height: 1.4; }
`;
function mountConnect(target, opts = {}) {
  const installUrl = opts.installUrl ?? "https://thelastprompt.ai/switchboard/";
  const host = document.createElement("div");
  host.style.display = "inline-block";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLE;
  root.append(style);
  const mount = document.createElement("div");
  root.append(mount);
  target.append(host);
  let state = { kind: "booting" };
  let menuOpen = false;
  let destroyed = false;
  let relay2 = null;
  let seq = 0;
  let wasConnected = false;
  let sessionDisconnected = false;
  const onDocClick = (e) => {
    if (menuOpen && !host.contains(e.target)) {
      menuOpen = false;
      render();
    }
  };
  document.addEventListener("click", onDocClick);
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls)
      n.className = cls;
    if (text != null)
      n.textContent = text;
    return n;
  }
  async function refresh() {
    const my = ++seq;
    const r = await whenRelayReady(2500, { installUrl });
    if (destroyed || my !== seq)
      return;
    if (!(r instanceof Relay)) {
      state = { kind: "not-installed", installUrl };
      return render();
    }
    relay2 = r;
    subscribe(r);
    const grant = sessionDisconnected ? null : await r.permissions().catch(() => null);
    if (destroyed || my !== seq)
      return;
    if (!grant) {
      state = { kind: "disconnected", relay: r };
      emitTransition(false);
      return render();
    }
    const [user, project] = await Promise.all([r.identity(), r.context.active().catch(() => null)]);
    if (destroyed || my !== seq)
      return;
    state = { kind: "connected", relay: r, user, project };
    emitTransition(true);
    render();
  }
  function emitTransition(connected) {
    if (connected === wasConnected)
      return;
    wasConnected = connected;
    if (connected && relay2)
      opts.onConnect?.(relay2);
    else if (!connected)
      opts.onDisconnect?.();
  }
  let subscribed = false;
  function subscribe(r) {
    if (subscribed)
      return;
    subscribed = true;
    r.on("permissionsChanged", () => {
      void refresh();
    });
    r.on("disconnect", () => {
      void refresh();
    });
  }
  async function doConnect() {
    if (!relay2)
      return;
    try {
      sessionDisconnected = false;
      await relay2.connect(opts.scope);
      await refresh();
    } catch {
    }
  }
  async function doPick() {
    if (!relay2)
      return;
    menuOpen = false;
    render();
    const project = await relay2.context.pick().catch(() => null);
    opts.onProjectChange?.(project);
    await refresh();
  }
  async function doDisconnect() {
    if (!relay2)
      return;
    menuOpen = false;
    sessionDisconnected = true;
    await relay2.disconnect().catch(() => {
    });
    await refresh();
  }
  function render() {
    if (destroyed)
      return;
    mount.textContent = "";
    if (state.kind === "booting")
      return;
    if (state.kind === "not-installed") {
      const b = el("button", "btn get");
      b.append(el("span", "glyph"), el("span", void 0, "Get Switchboard"), el("span", "arr", "\u2197"));
      b.onclick = () => window.open(state.kind === "not-installed" ? state.installUrl : installUrl, "_blank", "noopener");
      mount.append(b);
      return;
    }
    if (state.kind === "disconnected") {
      const b = el("button", "btn connect");
      b.append(el("span", "glyph"), el("span", void 0, "Connect Switchboard"));
      b.onclick = doConnect;
      mount.append(b);
      return;
    }
    const { user, project } = state;
    const rawName = user?.name?.trim();
    const collides = !!rawName && !!project?.name && rawName.toLowerCase() === project.name.toLowerCase();
    const name = !rawName || collides ? "there" : rawName;
    const wrap = el("div", "wrap");
    const chip = el("button", "chip");
    const av = el("div", "av");
    if (user?.avatar) {
      const img = el("img");
      img.src = user.avatar;
      img.alt = name;
      av.append(img);
    } else
      av.textContent = name.charAt(0).toUpperCase();
    const who = el("div", "who");
    who.append(el("div", "hi", `Hi ${name}`));
    who.append(el("div", "proj", project ? project.name : "No context lent"));
    chip.append(av, who, el("span", "caret", "\u25BE"));
    chip.onclick = (e) => {
      e.stopPropagation();
      menuOpen = !menuOpen;
      render();
    };
    wrap.append(chip);
    if (menuOpen) {
      const menu = el("div", "menu");
      menu.append(el("div", "lbl", "Working on"));
      const row = el("button", "proj-row");
      row.append(el("span", void 0, project ? project.name : "Choose a context"));
      row.append(el("span", "go", project ? "Switch \u25B8" : "Choose \u25B8"));
      row.onclick = doPick;
      menu.append(row, el("div", "sep"));
      const dc = el("button", "item", "Disconnect this app");
      dc.onclick = doDisconnect;
      menu.append(dc);
      menu.append(el("div", "foot", "Connectors, budgets & activity live in the Switchboard toolbar panel."));
      wrap.append(menu);
    }
    mount.append(wrap);
  }
  render();
  void refresh();
  return {
    refresh: () => void refresh(),
    destroy: () => {
      destroyed = true;
      document.removeEventListener("click", onDocClick);
      host.remove();
    }
  };
}

// ../../packages/sdk/dist/index.js
var Relay = class {
  provider;
  constructor(provider) {
    this.provider = provider;
  }
  get version() {
    return this.provider.version;
  }
  capabilities() {
    return this.provider.request({ method: "claude_capabilities" });
  }
  connect(scope) {
    return this.provider.request({ method: "claude_connect", params: scope });
  }
  /** Drop this app's connection for the current page session. The grant persists (a later connect()
   *  won't reprompt) — this is "disconnect from this tab", not "revoke". Full revoke lives in the panel. */
  disconnect() {
    return this.provider.request({ method: "claude_disconnect" });
  }
  permissions() {
    return this.provider.request({ method: "claude_permissions" });
  }
  /** The paired user's public identity (name/avatar), or null if unavailable. Convenience over
   *  capabilities().user — what the connect chip greets with ("Hi Sameep"). */
  identity() {
    return this.capabilities().then((c) => c.user ?? null).catch(() => null);
  }
  /** Synthesize speech ON-DEVICE via a local model/engine (no cloud, no connector, no credits).
   *  Returns audio as a playable data: URL, or null if no local TTS is available.
   *
   *    const clip = await relay.speak("hey, it's Maya");
   *    if (clip) new Audio(clip.audio).play();
   */
  speak(text, opts) {
    return this.provider.request({ method: "claude_speak", params: { text, voice: opts?.voice } }).catch(() => null);
  }
  listTools() {
    return this.provider.request({ method: "claude_listTools" }).then((r) => r.tools);
  }
  callTool(name, args) {
    const call = { name, arguments: args };
    return this.provider.request({ method: "claude_callTool", params: call });
  }
  complete(params) {
    return this.provider.request({ method: "claude_complete", params });
  }
  /** Streamed completion as an async iterator of deltas. Ends after a `done`/`error` delta. */
  async *stream(params) {
    const { streamId } = await this.provider.request({ method: "claude_stream", params });
    const queue = [];
    let notify = null;
    let ended = false;
    const handler = (payload) => {
      const p = payload;
      if (p.streamId !== streamId)
        return;
      queue.push(p);
      if (p.type === "done" || p.type === "error")
        ended = true;
      notify?.();
    };
    this.provider.on("delta", handler);
    try {
      while (true) {
        if (queue.length === 0) {
          if (ended)
            break;
          await new Promise((r) => notify = r);
          notify = null;
          continue;
        }
        yield queue.shift();
      }
    } finally {
      this.provider.removeListener("delta", handler);
    }
  }
  on(event, handler) {
    this.provider.on(event, handler);
  }
  /**
   * Per-origin local storage — a private on-disk key/value store for this app, plus `bind` to point
   * it at a real folder the user picks. Values are opaque strings (store JSON). Isolated per origin;
   * reads are free, writes need the site not to be read-only, and `bind` prompts for the exact path.
   *
   *   await relay.storage.set("workspace", JSON.stringify(data));
   *   const raw = await relay.storage.get("workspace");
   *   await relay.storage.bind("~/Documents/Projects/brandbrain/.data"); // existing files appear as records
   */
  get storage() {
    const req = (params) => this.provider.request({ method: "claude_storage", params });
    return {
      get: (key) => req({ op: "get", key }).then((r) => r.value ?? null),
      set: (key, value) => req({ op: "set", key, value }).then(() => void 0),
      delete: (key) => req({ op: "delete", key }).then((r) => r.ok),
      list: () => req({ op: "list" }).then((r) => r.keys ?? []),
      info: () => req({ op: "info" }).then((r) => r.info),
      /** Point this app's store at a real folder (triggers a path-consent click). */
      bind: (path) => req({ op: "bind", path }).then((r) => r.info)
    };
  }
  /**
   * Shared, cross-app context — your portable brand knowledge. Publish a whole context; read the one
   * the user selected for this app; or open the picker. Selection happens in the side panel, so an
   * app only ever receives the context the user chose to lend it — never the whole library.
   *
   *   await relay.context.publish({ name: "Aamras", kind: "brand", data: brand });
   *   const active = await relay.context.active();   // the brand the user loaded for this app, or null
   */
  get context() {
    const req = (params) => this.provider.request({ method: "claude_context", params });
    return {
      publish: (context) => req({ op: "publish", context }).then((r) => r.id),
      list: () => req({ op: "list" }).then((r) => r.contexts ?? []),
      active: () => req({ op: "active" }).then((r) => r.context ?? null),
      pick: () => req({ op: "pick" }).then((r) => r.context ?? null)
    };
  }
};
var DEFAULT_INSTALL_URL = "https://thelastprompt.ai/switchboard/";
function getRelay(opts) {
  const provider = globalThis[PROVIDER_GLOBAL];
  if (provider?.isRelay)
    return new Relay(provider);
  return { installed: false, installUrl: opts?.installUrl ?? DEFAULT_INSTALL_URL };
}
function whenRelayReady(timeoutMs = 3e3, opts) {
  const now = getRelay(opts);
  if (now instanceof Relay)
    return Promise.resolve(now);
  return new Promise((resolve) => {
    const onInit = () => {
      cleanup();
      resolve(getRelay(opts));
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve({ installed: false, installUrl: opts?.installUrl ?? DEFAULT_INSTALL_URL });
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener(`${PROVIDER_GLOBAL}#initialized`, onInit);
    }
    window.addEventListener(`${PROVIDER_GLOBAL}#initialized`, onInit);
  });
}

// src/studio.js
var $ = (id) => document.getElementById(id);
var INSTALL_URL = "https://thelastprompt.ai/switchboard/";
var SHEET_KEY = "studio:sheet";
var PRODUCT_KEY = "studio:product";
var SETUP_KEY = "studio:setup";
var relay = null;
var installed = null;
var shooting = false;
var stopFlag = false;
var brand = null;
var product = null;
var lastShot = null;
var photoZoneOpen = false;
var sceneChosen = false;
var SCENES = [
  {
    prompt: "on a marble counter, soft morning window light",
    cues: ["minimal", "clean", "premium", "luxur", "calm", "quiet", "serene", "spa", "refined"]
  },
  {
    prompt: "held in hand on a city street, shallow depth of field",
    cues: ["street", "urban", "everyday", "candid", "real", "gen z", "genz", "youth", "movement"]
  },
  {
    prompt: "floating on a seamless pastel gradient, hard shadow",
    cues: ["bold", "playful", "maximal", "vibrant", "pop", "fun", "loud", "color", "unapologetic"]
  },
  {
    prompt: "on a picnic table, golden hour, linen + fruit",
    cues: ["warm", "cozy", "home", "natural", "organic", "earth", "craft", "comfort", "desi"]
  },
  {
    prompt: "editorial flat-lay, magazine style, top-down",
    cues: ["editorial", "magazine", "fashion", "curated", "design", "sophisticat", "studio"]
  }
];
var ASPECTS = ["1:1", "4:5", "9:16", "16:9"];
var setup = { scene: 0, steer: "", aspect: "1:1", chosen: false };
var recScene = 0;
function deriveRecScene() {
  if (!brand) return 0;
  const hay = `${brand.voice} ${brand.positioning} ${brand.audience}`.toLowerCase();
  let best = 0, bestScore = 0;
  SCENES.forEach((s, i) => {
    const score = s.cues.reduce((n, c) => n + (hay.includes(c) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
var loadJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
var saveJson = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
  }
};
var loadSheet = () => loadJson(SHEET_KEY, []);
var saveSheet = (s) => saveJson(SHEET_KEY, s.slice(0, 48));
var saveSetup = () => saveJson(SETUP_KEY, setup);
var SAMPLE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='800' viewBox='0 0 640 800'><defs><linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#F6F1E7'/><stop offset='1' stop-color='#E9E0CE'/></linearGradient><linearGradient id='glass' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#8A4A10'/><stop offset='.2' stop-color='#C97F2C'/><stop offset='.46' stop-color='#EBAC50'/><stop offset='.64' stop-color='#C47A28'/><stop offset='1' stop-color='#7C3F0C'/></linearGradient><linearGradient id='cap' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#14100D'/><stop offset='.5' stop-color='#3D342C'/><stop offset='1' stop-color='#0D0A08'/></linearGradient></defs><rect width='640' height='800' fill='url(#bg)'/><ellipse cx='320' cy='722' rx='152' ry='24' fill='#D8CBB2'/><rect x='297' y='112' width='46' height='58' rx='22' fill='#1D1814'/><rect x='283' y='164' width='74' height='56' rx='7' fill='url(#cap)'/><rect x='299' y='220' width='42' height='20' fill='#9C5A18'/><rect x='230' y='238' width='180' height='472' rx='34' fill='url(#glass)'/><rect x='314' y='240' width='12' height='372' rx='6' fill='rgba(255,244,224,.28)'/><path d='M314 612 L326 612 L320 646 Z' fill='rgba(255,244,224,.3)'/><rect x='250' y='262' width='18' height='420' rx='9' fill='rgba(255,255,255,.32)'/><rect x='252' y='382' width='136' height='192' rx='10' fill='#FBF7EE' stroke='#E2D6BD' stroke-width='2'/><text x='320' y='424' font-family='Georgia, serif' font-size='16' letter-spacing='4' fill='#8A7F6C' text-anchor='middle'>No. 04</text><rect x='296' y='438' width='48' height='3' fill='#DE3D0A'/><text x='320' y='494' font-family='Georgia, serif' font-size='44' font-weight='bold' letter-spacing='7' fill='#26221B' text-anchor='middle'>GLOW</text><text x='320' y='530' font-family='Georgia, serif' font-style='italic' font-size='15' fill='#6F675A' text-anchor='middle'>facial oil</text><text x='320' y='556' font-family='Georgia, serif' font-size='13' letter-spacing='2' fill='#8A7F6C' text-anchor='middle'>30 ml</text></svg>`;
var SAMPLE_DATA_URL = "data:image/svg+xml;utf8," + encodeURIComponent(SAMPLE_SVG);
var resultText = (d) => (d.result?.content ?? []).map((c) => c.text ?? "").join("");
var URL_RE = /(https?:\/\/[^\s"')]+\.(?:png|jpe?g|webp))|"(?:rawUrl|url|minUrl)"\s*:\s*"([^"]+)"/i;
function extractUrl(t) {
  const m = (t || "").match(URL_RE);
  return m ? m[1] || m[2] || m[0] : null;
}
async function downscale(dataUrl, max = 1024) {
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}
mountConnect($("chip-dock"), {
  scope: {
    reason: "shoot product photos on your Higgsfield",
    // Whole-connector wildcard (the gate supports trailing-*): the shoot is a multi-tool dance —
    // media_upload → media_confirm → generate_image → poll — so a single-tool grant would deny
    // step 1 every time. Matches imagegen.js/persona.js. (relay put_blob is auto-approved daemon-side.)
    tools: ["mcp__claude_ai_Higgsfield__*"],
    models: ["sonnet"]
  },
  installUrl: INSTALL_URL,
  onConnect: (r) => {
    relay = r;
    reflect();
    loadBrand();
  },
  // The chip's own "Switch ▸" menu lends a different brand — re-derive everything from it,
  // or the chip and the app silently desync (chip shows the new brand, brief keeps the old one).
  onProjectChange: (p) => {
    if (p) applyBrand(p);
  },
  onDisconnect: () => {
    relay = null;
    brand = null;
    recScene = 0;
    photoZoneOpen = false;
    if (product?.kind === "brand") {
      product = { kind: "text", name: product.name };
      saveJson(PRODUCT_KEY, product);
      $("line").value = product.name;
    }
    renderProductViews();
    renderChips();
    updateBrief();
    reflect();
  }
});
(async () => {
  const r = await whenRelayReady(2e3, { installUrl: INSTALL_URL });
  installed = !!(r && "connect" in r);
  if (installed) {
    const grant = await r.permissions().catch(() => null);
    if (grant) {
      relay = r;
      await loadBrand();
    }
  }
  reflect();
})();
function normalizeBrand(ctx) {
  const d = ctx && ctx.data || {};
  const arr = (v) => Array.isArray(v) ? v.filter(Boolean).map(String) : [];
  const products = arr(d.products).length ? arr(d.products) : arr(d.range);
  return {
    name: String(ctx.name || d.name || "Brand"),
    voice: String(d.voice || d.vibe || d.positioning || "").trim(),
    positioning: String(d.positioning || "").trim(),
    audience: String(d.audience || "").trim(),
    palette: arr(d.palette),
    // FLAT color strings by contract
    products
  };
}
async function loadBrand() {
  if (!relay?.context?.active) {
    renderBrand();
    return;
  }
  try {
    const ctx = await relay.context.active();
    if (ctx) applyBrand(ctx);
    else renderBrand();
  } catch {
    renderBrand();
  }
}
async function pickBrand() {
  if (!relay?.context?.pick) {
    logLine("this Switchboard build has no context picker.", "bad");
    return;
  }
  try {
    const ctx = await relay.context.pick();
    if (ctx) {
      applyBrand(ctx);
      logLine(`brand lent \u2014 shooting for ${brand.name} now.`, "good");
    }
  } catch {
    logLine("brand pick didn't complete.", "bad");
  }
}
$("brand-switch").addEventListener("click", pickBrand);
$("brand-pick").addEventListener("click", pickBrand);
function applyBrand(ctx) {
  brand = normalizeBrand(ctx);
  recScene = deriveRecScene();
  if (product?.sample) setProduct(null);
  if (!sceneChosen) {
    setup.scene = recScene;
    saveSetup();
  }
  if (brand.products.length && (!product || product.kind !== "photo")) {
    const saved = loadJson(PRODUCT_KEY, null);
    const want = product?.kind === "brand" && product.name || saved?.kind === "brand" && saved.name || null;
    const name = want && brand.products.includes(want) ? want : brand.products[0];
    product = { kind: "brand", name };
    saveJson(PRODUCT_KEY, product);
  }
  photoZoneOpen = false;
  renderBrand();
  renderProductViews();
  renderChips();
  updateBrief();
  reflect();
}
function renderBrand() {
  const bar = $("brandbar");
  if (!relay) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  $("brand-on").hidden = !brand;
  $("brand-off").hidden = !!brand;
  if (!brand) return;
  $("brand-name").textContent = brand.name;
  const sw = $("brand-swatches");
  sw.textContent = "";
  for (const c of brand.palette.slice(0, 5)) {
    const s = document.createElement("span");
    s.className = "sw";
    s.style.background = c;
    sw.append(s);
  }
  $("brand-voice").textContent = brand.voice ? `\u201C${brand.voice}\u201D` : "";
}
function setProduct(p, { persist = true } = {}) {
  product = p;
  if (persist) {
    if (p) saveJson(PRODUCT_KEY, p);
    else {
      try {
        localStorage.removeItem(PRODUCT_KEY);
      } catch {
      }
    }
  }
  if (p?.kind === "photo") photoZoneOpen = false;
  renderProductViews();
  updateBrief();
  reflect();
}
var PROD_NOTE = "every chip shoots straight from the brand \u2014 no photo, no typing. voice + palette ride along in the prompt.";
function renderProductViews() {
  const isPhoto = product?.kind === "photo";
  const brandHasProducts = !!(brand && brand.products.length);
  $("brand-products").hidden = !brandHasProducts;
  $("free-product").hidden = brandHasProducts || isPhoto;
  $("photo-toggle").hidden = !brandHasProducts || isPhoto;
  $("photo-toggle").textContent = photoZoneOpen ? "never mind \u2014 shoot from the brand" : "shoot from a photo instead";
  $("drop").hidden = isPhoto || brandHasProducts && !photoZoneOpen || !brandHasProducts;
  $("prod-preview").hidden = !isPhoto;
  if (isPhoto) {
    $("prod-img").src = product.dataUrl;
    $("prod-name").textContent = product.name;
    $("sample-tag").hidden = !product.sample;
  }
  $("prod-note").textContent = brand && !brand.products.length ? "" : PROD_NOTE;
  renderProducts();
}
function renderProducts() {
  const mount = $("products");
  mount.textContent = "";
  if (!brand) return;
  brand.products.forEach((name) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pchip" + (product?.kind === "brand" && product.name === name ? " on" : "");
    b.textContent = name;
    b.title = `shoot ${name} straight from ${brand.name} \u2014 no photo needed`;
    b.addEventListener("click", () => {
      photoZoneOpen = false;
      setProduct({ kind: "brand", name });
    });
    mount.append(b);
  });
}
async function acceptFile(file) {
  if (!file || !/^image\//.test(file.type)) {
    logLine("that file isn't an image \u2014 PNG, JPG or WebP please.", "bad");
    return;
  }
  const raw = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  const dataUrl = await downscale(raw);
  setProduct({ kind: "photo", dataUrl, name: file.name.slice(0, 40) || "product.png", sample: false });
}
$("file").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (f) acceptFile(f);
  e.target.value = "";
});
$("drop").addEventListener("click", () => $("file").click());
$("drop").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    $("file").click();
  }
});
$("browse-btn").addEventListener("click", () => $("file").click());
$("photo-toggle").addEventListener("click", () => {
  photoZoneOpen = !photoZoneOpen;
  renderProductViews();
});
var panel = $("prod-panel");
panel.addEventListener("dragover", (e) => {
  e.preventDefault();
  panel.classList.add("over");
  $("drop").classList.add("over");
});
panel.addEventListener("dragleave", () => {
  panel.classList.remove("over");
  $("drop").classList.remove("over");
});
panel.addEventListener("drop", (e) => {
  e.preventDefault();
  panel.classList.remove("over");
  $("drop").classList.remove("over");
  const f = e.dataTransfer?.files?.[0];
  if (f) acceptFile(f);
});
$("prod-replace").addEventListener("click", () => $("file").click());
$("prod-remove").addEventListener("click", () => {
  if (brand?.products.length) setProduct({ kind: "brand", name: brand.products[0] });
  else {
    $("line").value = "";
    setProduct(null);
  }
});
$("sample-btn").addEventListener("click", async () => {
  const dataUrl = await downscale(SAMPLE_DATA_URL);
  setProduct({ kind: "photo", dataUrl, name: "glow \u2014 sample bottle", sample: true });
});
$("line").addEventListener("input", () => {
  const v = $("line").value.trim();
  setProduct(v ? { kind: "text", name: v.slice(0, 120) } : null);
});
$("line").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !$("shoot").disabled) $("shoot").click();
});
function renderChips() {
  const mount = $("chips");
  mount.textContent = "";
  SCENES.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "scn" + (i === setup.scene ? " on" : "");
    b.textContent = s.prompt;
    if (i === recScene) {
      const tag = document.createElement("span");
      tag.className = "pick";
      tag.textContent = "our pick";
      b.append(tag);
      if (brand) b.title = `picked for ${brand.name}'s voice`;
    }
    b.addEventListener("click", () => {
      setup.scene = setup.scene === i ? -1 : i;
      sceneChosen = true;
      setup.chosen = true;
      renderChips();
      saveSetup();
      updateBrief();
    });
    mount.append(b);
  });
  $("scene-note").textContent = brand ? `our pick reads ${brand.name}'s voice and positioning \u2014 the other scenes are one click away.` : "our pick is the safe default \u2014 lend a brand and it re-derives from the brand's voice.";
}
function renderAspects() {
  const mount = $("aspects");
  mount.textContent = "";
  ASPECTS.forEach((a) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = a;
    if (a === setup.aspect) b.classList.add("on");
    b.addEventListener("click", () => {
      setup.aspect = a;
      mount.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      saveSetup();
      updateBrief();
    });
    mount.append(b);
  });
}
function currentScene() {
  const parts = [];
  if (setup.scene >= 0 && SCENES[setup.scene]) parts.push(SCENES[setup.scene].prompt);
  const steer = $("steer").value.trim();
  if (steer) parts.push(steer);
  return parts.join(", ") || SCENES[recScene].prompt;
}
function updateBrief() {
  const b = $("brief");
  b.textContent = "";
  const scene = document.createElement("b");
  scene.textContent = currentScene();
  if (!product) {
    b.append("the brief \u2014 pick a product above, then shoot it in: ", scene, ` \xB7 ${setup.aspect}`);
  } else if (product.kind === "photo") {
    b.append("the brief \u2014 keep this exact product, unchanged label and shape, place it in: ", scene, ` \xB7 ${setup.aspect}`);
  } else {
    const pn = document.createElement("b");
    pn.textContent = product.name;
    b.append("the brief \u2014 shoot ", pn, brand && product.kind === "brand" ? ` (${brand.name})` : "", " in: ", scene, ` \xB7 ${setup.aspect}`);
  }
  if (brand) b.append(` \xB7 ${brand.name}'s voice + palette ride along`);
}
$("steer").addEventListener("input", () => {
  setup.steer = $("steer").value;
  saveSetup();
  updateBrief();
});
$("steer").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !$("shoot").disabled) $("shoot").click();
});
function reflect() {
  renderBrand();
  $("shoot").disabled = !relay || !product || shooting;
  const hint = $("conn-hint");
  if (shooting) hint.textContent = "shooting\u2026";
  else if (installed === false) hint.innerHTML = `needs the Switchboard extension \u2014 <a href="${INSTALL_URL}" target="_blank" rel="noopener">get it here</a>, it's your key that does the work`;
  else if (!relay) hint.innerHTML = "connect Switchboard (top right) \u2014 your lent brand sets up the shoot for you";
  else if (!product) hint.textContent = brand?.products.length ? "pick one of the brand's products above" : "type your product in one line, drop a photo, or load the sample";
  else hint.innerHTML = "ready \u2014 shoots on <b>your</b> Higgsfield, the operator pays nothing";
}
var lastLogText = "";
function logLine(text, cls) {
  $("shootbox").hidden = false;
  if (text === lastLogText) return;
  lastLogText = text;
  const d = document.createElement("div");
  d.className = "event" + (cls ? " " + cls : "");
  d.textContent = text;
  const ev = $("events");
  ev.append(d);
  while (ev.children.length > 40) ev.firstChild.remove();
  ev.scrollTop = ev.scrollHeight;
}
function setStatus(text) {
  $("shoot-line").textContent = text;
  logLine(text);
}
function brandDirection() {
  if (!brand) return "";
  const bits = [];
  if (brand.voice) bits.push(`brand voice: ${brand.voice}`);
  if (brand.audience) bits.push(`shot to appeal to: ${brand.audience}`);
  if (brand.palette.length) bits.push(`accent the set styling, props and backdrop with the brand palette (${brand.palette.join(", ")}) \u2014 never recolor the product itself`);
  return bits.join(". ");
}
function photoShootInstruction(scene, aspect) {
  const dir = brandDirection();
  return `Shoot ONE professional product photograph using Higgsfield. A reference image of the product is attached with handle "product".
Steps, in order:
1) media_upload({filename:"product.png", content_type:"image/png"}) \u2192 relay put_blob({handle:"product", url:<uploadUrl>}) \u2192 media_confirm \u21D2 media_id
2) Call the Higgsfield generate_image tool with model "nano_banana_pro", aspect_ratio "${aspect}", medias [{role:"image", value: media_id}], and this exact prompt:
"keep this exact product, unchanged label and shape, place it in: ${scene}${dir ? `. ${dir}` : ""}"
3) Poll until the generation is done, then reply with ONLY the final image URL on its own line.`;
}
function textShootInstruction(name, scene, aspect) {
  const dir = brandDirection();
  const subject = brand && product?.kind === "brand" ? `"${name}" by ${brand.name}` : `"${name}"`;
  return `Shoot ONE professional product photograph using the Higgsfield generate_image tool.
The product: ${subject}. Place it in: ${scene}.
` + (dir ? `Art direction: ${dir}.
` : "") + `Use aspect_ratio "${aspect}". Poll until the generation is done, then reply with ONLY the final image URL on its own line.`;
}
var shootRun = 0;
async function shoot(scene, aspect) {
  if (!relay || !product || shooting) return;
  const run = ++shootRun;
  lastShot = { scene, aspect };
  shooting = true;
  stopFlag = false;
  $("errbox").hidden = true;
  $("shootbox").hidden = false;
  $("shootbox").classList.remove("idle");
  lastLogText = "";
  setStatus(`shooting "${scene}" at ${aspect}\u2026`);
  reflect();
  let url = null, acc = "";
  try {
    const isPhoto = product.kind === "photo";
    const attachments = isPhoto ? [{ handle: "product", filename: "product.png", contentType: "image/png", dataUrl: product.dataUrl }] : void 0;
    const prompt = isPhoto ? photoShootInstruction(scene, aspect) : textShootInstruction(product.name, scene, aspect);
    for await (const d of relay.stream({ prompt, agentic: true, attachments })) {
      if (stopFlag || run !== shootRun) break;
      if (d.type === "tool_proposed") {
        const n = d.call?.name || "";
        if (n.includes("media_upload") || n.includes("put_blob") || n.includes("media_confirm")) setStatus("uploading reference\u2026");
        else if (n.includes("generate_image")) setStatus("generating\u2026 (your Switchboard asks consent now)");
        else setStatus(`running ${n}\u2026`);
      } else if (d.type === "tool_result") {
        if (d.result?.ok) {
          const u = extractUrl(resultText(d));
          if (u) {
            url = u;
            setStatus("developing the frame\u2026");
          }
        } else logLine(`blocked \u2014 ${d.result?.error?.message || d.call?.name || "tool failed"}`, "bad");
      } else if (d.type === "text") {
        acc += d.text;
      } else if (d.type === "error") {
        throw new Error(d.error?.message || "stream error");
      }
    }
    if (run !== shootRun) return;
    if (stopFlag) return;
    url = url || extractUrl(acc);
    if (!url) throw new Error("the shoot finished without an image URL \u2014 Reshoot usually lands it on the second frame");
    addShot({ id: "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), url, caption: scene, product: product.name, aspect, at: Date.now() });
    setStatus("frame developed \u2713");
    logLine("added to the contact sheet.", "good");
  } catch (err) {
    if (run !== shootRun || stopFlag) return;
    setStatus("the shoot failed.");
    showError(err);
  } finally {
    if (run === shootRun) {
      shooting = false;
      $("shootbox").classList.add("idle");
      reflect();
    }
  }
}
function showError(err) {
  const msg = String(err?.message || err).slice(0, 240);
  $("err-text").textContent = "The shoot didn't land: " + msg;
  $("errbox").hidden = false;
  logLine("error \u2014 " + msg, "bad");
}
$("shoot").addEventListener("click", () => shoot(currentScene(), setup.aspect));
$("stop").addEventListener("click", () => {
  if (!shooting) return;
  stopFlag = true;
  shooting = false;
  $("shootbox").classList.add("idle");
  setStatus("shoot stopped.");
  reflect();
});
$("retry").addEventListener("click", () => {
  $("errbox").hidden = true;
  if (!lastShot) {
    logLine("nothing to retry yet \u2014 set up a shot and hit Shoot.", "bad");
    return;
  }
  if (!relay) {
    logLine("connect Switchboard (top right) first.", "bad");
    return;
  }
  if (!product) {
    logLine("pick a product (a brand chip, a line, or a photo) first.", "bad");
    return;
  }
  shoot(lastShot.scene, lastShot.aspect);
});
function addShot(shot) {
  const sheet = loadSheet();
  sheet.unshift(shot);
  saveSheet(sheet);
  renderSheet();
}
function renderSheet() {
  const sheet = loadSheet();
  $("sheet-empty").hidden = sheet.length > 0;
  $("clear-sheet").hidden = sheet.length === 0;
  $("sheet-count").textContent = sheet.length ? `${sheet.length} frame${sheet.length === 1 ? "" : "s"}` : "";
  const mount = $("sheet");
  mount.textContent = "";
  sheet.forEach((s) => {
    const card = document.createElement("div");
    card.className = "shot";
    const img = document.createElement("img");
    img.src = s.url;
    img.alt = s.caption;
    img.loading = "lazy";
    const cap = document.createElement("div");
    cap.className = "cap";
    cap.textContent = s.product ? `${s.product} \u2014 ${s.caption}` : s.caption;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${s.aspect} \xB7 ${new Date(s.at).toLocaleDateString()}`;
    const btns = document.createElement("div");
    btns.className = "btns";
    const re = document.createElement("button");
    re.type = "button";
    re.className = "sbtn re";
    re.textContent = "\u21BA reshoot";
    re.addEventListener("click", () => {
      if (!relay) {
        logLine("connect Switchboard (top right) to reshoot.", "bad");
        return;
      }
      if (!product) {
        logLine("pick a product (a brand chip, a line, or a photo) to reshoot.", "bad");
        return;
      }
      if (shooting) {
        logLine("one frame at a time \u2014 the current shoot is still developing.", "bad");
        return;
      }
      shoot(s.caption, s.aspect);
      $("shootbox").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    const dl = document.createElement("a");
    dl.className = "sbtn";
    dl.textContent = "\u2B07 download";
    dl.href = s.url;
    dl.target = "_blank";
    dl.rel = "noopener";
    dl.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const resp = await fetch(s.url);
        if (!resp.ok) throw new Error("fetch failed");
        const blob = await resp.blob();
        const ext = (s.url.match(/\.(png|jpe?g|webp)(?:[?#]|$)/i)?.[1] || "png").toLowerCase();
        const obj = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = obj;
        a.download = "studio-" + s.id + "." + ext;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(obj), 4e3);
      } catch {
        window.open(s.url, "_blank", "noopener");
      }
    });
    const kill = document.createElement("button");
    kill.type = "button";
    kill.className = "kill";
    kill.textContent = "\u2715";
    kill.title = "remove this frame";
    kill.addEventListener("click", () => {
      saveSheet(loadSheet().filter((x) => x.id !== s.id));
      renderSheet();
    });
    btns.append(re, dl);
    card.append(kill, img, cap, meta, btns);
    mount.append(card);
  });
}
var clearArm = null;
$("clear-sheet").addEventListener("click", () => {
  const btn = $("clear-sheet");
  if (clearArm) {
    clearTimeout(clearArm);
    clearArm = null;
    btn.textContent = "clear sheet";
    btn.classList.remove("armed");
    saveSheet([]);
    renderSheet();
  } else {
    btn.textContent = "really clear all frames?";
    btn.classList.add("armed");
    clearArm = setTimeout(() => {
      clearArm = null;
      btn.textContent = "clear sheet";
      btn.classList.remove("armed");
    }, 2600);
  }
});
(function boot() {
  const savedSetup = loadJson(SETUP_KEY, null);
  if (savedSetup) {
    sceneChosen = setup.chosen = !!savedSetup.chosen;
    if (Number.isInteger(savedSetup.scene) && savedSetup.scene >= -1 && savedSetup.scene < SCENES.length) setup.scene = savedSetup.scene;
    if (typeof savedSetup.steer === "string") setup.steer = savedSetup.steer.slice(0, 200);
    if (ASPECTS.includes(savedSetup.aspect)) setup.aspect = savedSetup.aspect;
  }
  $("steer").value = setup.steer;
  renderChips();
  renderAspects();
  const saved = loadJson(PRODUCT_KEY, null);
  if (saved?.kind === "photo" && typeof saved.dataUrl === "string" && saved.dataUrl.startsWith("data:image/")) {
    setProduct({ kind: "photo", dataUrl: saved.dataUrl, name: saved.name || "product.png", sample: !!saved.sample }, { persist: false });
  } else if (saved?.kind === "text" && typeof saved.name === "string" && saved.name.trim()) {
    $("line").value = saved.name.slice(0, 120);
    setProduct({ kind: "text", name: saved.name.slice(0, 120) }, { persist: false });
  }
  renderProductViews();
  updateBrief();
  renderSheet();
  reflect();
})();
//# sourceMappingURL=studio.js.map
