/* ============================================================
 * Street Doctor SG — prototype app
 * Hash router + views. Public site and a demo admin console.
 * Depends on js/data.js (loaded first) and MapLibre GL (CDN).
 * ============================================================ */

/* ---------- tiny DOM + util helpers ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const app = () => document.getElementById("app");

function toast(msg) {
  let t = $(".toast");
  if (!t) { t = el(`<div class="toast"></div>`); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove("show"), 2600);
}

const SG_CENTER = [103.8198, 1.3521];

// Basemap — CARTO raster tiles (no API key, English labels, retina @2x).
// "voyager"  = clean but informative (roads, parks, transit) — the default
// "positron" = most minimal / data-first (very light grey)
// "darkmatter"= dark theme
// To switch the look, change BASEMAP to one of the keys below.
const BASEMAP = "voyager";
const BASEMAP_PATHS = { voyager: "rastertiles/voyager", positron: "light_all", darkmatter: "dark_all" };
const MAP_STYLE = {
  version: 8,
  glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
  sources: {
    base: {
      type: "raster",
      tiles: ["a", "b", "c", "d"].map(
        (s) => `https://${s}.basemaps.cartocdn.com/${BASEMAP_PATHS[BASEMAP]}/{z}/{x}/{y}@2x.png`
      ),
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: "base", type: "raster", source: "base" }],
};

function statusBadge(status) {
  const s = STATUSES[status] || { label: status, color: "#888" };
  return `<span class="badge" style="background:${s.color}">${esc(s.label)}</span>`;
}
function categoryTag(slug) {
  const c = catBySlug(slug);
  if (!c) return "";
  return `<span class="tag"><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c.color}"></span>${esc(c.label)}</span>`;
}

/* ============================================================
 * Router
 * ============================================================ */
const routes = [];
const route = (re, view) => routes.push({ re, view });

function navigate(hash) { window.location.hash = hash; }

function render() {
  const path = (window.location.hash || "#/").replace(/^#/, "");
  // admin guard
  if (path.startsWith("/admin") && path !== "/admin/login" && !DB.isAdmin()) {
    return navigate("/admin/login");
  }
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      window.scrollTo(0, 0);
      app().innerHTML = "";
      app().appendChild(r.view(...m.slice(1)));
      highlightNav(path);
      return;
    }
  }
  app().innerHTML = `<div class="wrap section"><h1>Not found</h1><p><a href="#/">Back home</a></p></div>`;
}
window.addEventListener("hashchange", render);

function highlightNav(path) {
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const href = a.getAttribute("href").replace(/^#/, "");
    a.classList.toggle("active", href === path || (href !== "/" && path.startsWith(href)));
  });
}

/* ============================================================
 * Chrome: nav + footer (rendered once)
 * ============================================================ */
function mountChrome() {
  const isAdmin = (window.location.hash || "").startsWith("#/admin");
  // header is re-rendered per route group below; here we just ensure footer exists
}

function publicNav() {
  const nav = el(`
    <header class="nav">
      <div class="wrap nav-inner">
        <a class="brand" href="#/"><span class="logo">🩺</span> ${esc(DB.settings().site_name)}</a>
        <button class="nav-toggle" aria-label="Menu">☰</button>
        <nav class="nav-links">
          <a href="#/map">Map</a>
          <a href="#/map?report=1">Report an issue</a>
          <a href="#/about">About</a>
          <a href="#/faq">FAQ</a>
          <a href="#/emergency">Emergency</a>
          <a href="#/admin/dashboard">Admin</a>
        </nav>
      </div>
    </header>`);
  nav.querySelector(".nav-toggle").onclick = () => nav.querySelector(".nav-links").classList.toggle("open");
  nav.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => nav.querySelector(".nav-links").classList.remove("open")));
  return nav;
}

function footer() {
  const st = DB.settings();
  return el(`
    <footer class="footer">
      <div class="wrap cols">
        <div class="grow" style="min-width:220px">
          <div class="brand" style="font-size:16px"><span class="logo">🩺</span> ${esc(st.site_name)}</div>
          <p class="muted" style="font-size:13px;max-width:42ch;margin-top:10px">
            ${esc(st.footer_blurb)}
          </p>
        </div>
        <div><h5>Site</h5>
          <a href="#/map">Map</a><a href="#/report">Report an issue</a><a href="#/about">About</a><a href="#/faq">FAQ</a>
        </div>
        <div><h5>Legal</h5>
          <a href="#/privacy">Privacy policy</a><a href="#/terms">Terms of use</a><a href="#/emergency">Emergency guidance</a>
        </div>
        <div><h5>Urgent?</h5>
          <a href="https://www.oneservice.gov.sg" target="_blank" rel="noopener">OneService (municipal)</a>
          <a href="tel:999">Police — 999</a><a href="tel:995">Ambulance / Fire — 995</a>
        </div>
      </div>
      <div class="wrap" style="margin-top:18px;border-top:1px solid var(--line);padding-top:14px;font-size:12px;color:var(--ink-soft)">
        Prototype build • data is stored only in your browser • <a href="#/" id="reset-link">reset demo data</a>
      </div>
    </footer>`);
}

function pageShell(...children) {
  const frag = document.createDocumentFragment();
  frag.appendChild(publicNav());
  const main = el(`<main></main>`);
  children.forEach((c) => main.appendChild(c));
  frag.appendChild(main);
  const f = footer();
  f.querySelector("#reset-link").onclick = (e) => {
    e.preventDefault();
    if (confirm("Reset all demo data back to the seed cases?")) { DB.reset(); toast("Demo data reset"); render(); }
  };
  frag.appendChild(f);
  const div = document.createElement("div");
  div.appendChild(frag);
  return div;
}

/* ============================================================
 * Reusable disclaimer
 * ============================================================ */
function disclaimerBanner() {
  return el(`
    <div class="disclaimer">
      <span class="ic">⚠️</span>
      <div>
        <strong>This is not an official government platform.</strong>
        It does not replace OneService and is not for emergencies or urgent repairs (potholes, fallen signage, etc.).
        For immediate danger call <a href="tel:999">999</a>; for municipal issues use
        <a href="https://www.oneservice.gov.sg" target="_blank" rel="noopener">OneService</a>.
      </div>
    </div>`);
}

/* ============================================================
 * HOME  /
 * ============================================================ */
route(/^\/$/, function home() {
  const s = DB.stats();
  const st = DB.settings();
  const heroBg = st.hero_image
    ? `background:linear-gradient(160deg, rgba(233,243,239,.85) 0%, rgba(245,246,248,.7) 60%), url('${st.hero_image}') center/cover`
    : "";
  const view = pageShell(
    el(`
      <section class="hero" style="${heroBg}">
        <div class="wrap">
          <h1>${esc(st.hero_title)}</h1>
          <p class="lead">${esc(st.hero_subtitle)}</p>
          <div class="cta row">
            <a class="btn btn-accent" href="#/map">＋ Report an issue</a>
            <a class="btn btn-ghost" href="#/map">View the map</a>
          </div>
        </div>
      </section>`),
    el(`<div class="wrap section" style="padding-top:24px"><div id="home-disclaimer"></div></div>`),
    el(`
      <section class="wrap section" style="padding-top:0">
        <div class="grid grid-4">
          <div class="card stat"><div class="n">${s.total}</div><div class="l">${esc(st.stat_total_label)}</div></div>
          <div class="card stat"><div class="n">${s.improved}</div><div class="l">${esc(st.stat_improved_label)}</div></div>
          <div class="card stat"><div class="n">${s.supporters}</div><div class="l">${esc(st.stat_supporters_label)}</div></div>
          <div class="card stat"><div class="n">${DB.activeCategories().length}</div><div class="l">Problem types tracked</div></div>
        </div>
      </section>`),
    el(`
      <section class="wrap section" style="padding-top:0">
        <div class="row" style="align-items:stretch">
          <div class="card grow" style="min-width:280px;flex:2;padding:0;overflow:hidden">
            <div id="mini-map" style="height:340px"></div>
          </div>
          <div class="card grow" style="min-width:260px;flex:1">
            <h3>How it works</h3>
            <ol style="padding-left:18px;color:var(--ink-soft)">
              <li>Drop a pin where the problem is.</li>
              <li>Pick a type, describe it, add up to 3 photos.</li>
              <li>STC reviews and publishes it on the map.</li>
              <li>Residents support cases; STC tracks progress with authorities.</li>
            </ol>
            <a class="btn btn-primary btn-block" href="#/map?report=1" style="margin-top:12px">Start a report</a>
          </div>
        </div>
      </section>`),
    el(`
      <section class="wrap section" style="padding-top:0">
        <div class="card">
          <h3>About this collaboration</h3>
          <p class="muted" style="max-width:70ch">
            Street Doctor SG is built by a student team in partnership with the <strong>Singapore Transport Collective (STC)</strong>
            and its Vision Zero Taskforce (VZT). Unlike one-off repair reporting, we focus on
            <em>systemic, design-level</em> problems — the kind that need policy change, not a maintenance crew.
            <a href="#/about">Read more →</a>
          </p>
        </div>
      </section>`)
  );
  view.querySelector("#home-disclaimer").appendChild(disclaimerBanner());

  setTimeout(() => {
    const map = new maplibregl.Map({ container: "mini-map", style: MAP_STYLE, center: SG_CENTER, zoom: 10.6, attributionControl: false });
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    map.on("load", () => DB.publicIssues().forEach((i) => addMarker(map, i, false)));
    map.scrollZoom.disable();
  }, 0);
  return view;
});

/* ============================================================
 * Marker helper (shared by map + mini map)
 * ============================================================ */
function addMarker(map, issue, interactive = true) {
  const c = catBySlug(issue.category) || { color: "#888", icon: "•" };
  const faded = !STATUSES[issue.status]?.public ? 0.5 : 1;
  const node = el(`<div class="marker" style="background:${c.color};opacity:${faded}"><span>${c.icon}</span></div>`);
  const marker = new maplibregl.Marker({ element: node, anchor: "bottom" }).setLngLat([issue.lng, issue.lat]).addTo(map);
  if (interactive) {
    const popup = new maplibregl.Popup({ offset: 24, closeButton: false }).setHTML(`
      <div class="mini-card">
        <h4>${esc(issue.title)}</h4>
        <div class="meta">${statusBadge(issue.status)} <span class="tag">${esc(c.label || issue.category)}</span></div>
        <div class="meta muted" style="font-size:13px">👍 ${issue.support_count} supports</div>
        <a class="btn btn-sm btn-primary" href="#/issues/${issue.id}">View details</a>
      </div>`);
    node.addEventListener("click", () => marker.setPopup(popup).togglePopup());
  }
  return marker;
}

/* ============================================================
 * Overpass road-segment lookup (junction-to-junction)
 *
 * A "junction" is defined by the road graph, not by raw OSM nodes:
 * a node is a junction only where 3+ real road edges meet (a T or
 * cross). Driveways, footpath taps, pedestrian crossings and tag-change
 * splits are degree-2 (or excluded) and therefore do NOT fragment a
 * segment. We query a corridor around the clicked road (not just a tiny
 * radius) so every real cross-street along it is visible.
 * ============================================================ */
// mirror endpoints tried in order (public instances rate-limit / time out)
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
// real vehicular road classes that define junctions (excludes service/driveways, footway, path, cycleway…)
const ROAD_CLASSES = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
  "residential", "living_street", "road",
  "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
]);

async function overpass(query) {
  let lastErr;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query) });
      if (res.ok) return res.json();
      lastErr = new Error("Overpass " + res.status);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Overpass unreachable");
}

function pointToSegDist(p, a, b) {
  const sx = Math.cos((p[1] * Math.PI) / 180);
  const ax = a[0] * sx, ay = a[1], bx = b[0] * sx, by = b[1], px = p[0] * sx, py = p[1];
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Returns { coords:[[lng,lat]...], name } for the road stretch between the two
// real junctions surrounding the click, or null. Throws on network failure.
async function fetchRoadSegment(lng, lat) {
  const click = [lng, lat];

  // One bounded query: all highways within ~180m of the click. Bounding by the
  // click (not the whole road's bbox) keeps the query light and fast, and still
  // reveals every cross-street near where the user tapped.
  const data = await overpass(`[out:json][timeout:25];way(around:180,${lat},${lng})[highway];(._;>;);out;`);
  const nodes = {}, ways = [];
  for (const e of data.elements) {
    if (e.type === "node") nodes[e.id] = [e.lon, e.lat];
    else if (e.type === "way" && e.nodes) ways.push(e);
  }
  if (!ways.length) return null;

  // nearest way to the click, preferring a real road within ~25m over footways/aisles
  let wAny = null, wAnyD = Infinity, wAnySeg = 0, wRoad = null, wRoadD = Infinity, wRoadSeg = 0;
  for (const w of ways) {
    const isRoad = w.tags && ROAD_CLASSES.has(w.tags.highway);
    for (let i = 0; i < w.nodes.length - 1; i++) {
      const a = nodes[w.nodes[i]], b = nodes[w.nodes[i + 1]];
      if (!a || !b) continue;
      const d = pointToSegDist(click, a, b);
      if (d < wAnyD) { wAnyD = d; wAny = w; wAnySeg = i; }
      if (isRoad && d < wRoadD) { wRoadD = d; wRoad = w; wRoadSeg = i; }
    }
  }
  const useRoad = wRoad && wRoadD < 25 / 111320;   // pointToSegDist is in degree-units; 25m ≈ 0.000225°
  const clicked = useRoad ? wRoad : wAny;
  const segIdx = useRoad ? wRoadSeg : wAnySeg;
  if (!clicked) return null;
  const clickedName = (clicked.tags && (clicked.tags.name || clicked.tags.ref)) || null;

  // Build the road graph from real road classes + the clicked way itself.
  const graphWays = ways.filter((w) => (w.tags && ROAD_CLASSES.has(w.tags.highway)) || w.id === clicked.id);
  const adj = {}; // node -> [{ to, wayId }]   (one entry per incident road edge-end)
  for (const w of graphWays) {
    for (let i = 0; i < w.nodes.length - 1; i++) {
      const a = w.nodes[i], b = w.nodes[i + 1];
      (adj[a] = adj[a] || []).push({ to: b, wayId: w.id });
      (adj[b] = adj[b] || []).push({ to: a, wayId: w.id });
    }
  }
  const degree = (n) => (adj[n] ? adj[n].length : 0);
  const stop = (n) => degree(n) !== 2;  // junction (3+) or dead-end (1) terminates the stretch
  const seq = clicked.nodes;
  const wayName = (id) => { const w = ways.find((x) => x.id === id); return (w && w.tags && (w.tags.name || w.tags.ref)) || null; };

  // walk outward from a node until a junction/dead-end; merges split ways (degree-2
  // nodes) and caps each direction at ~300m so a long way with an out-of-range
  // junction doesn't produce a runaway segment (use the chain feature for longer stretches)
  const MAX_WALK_M = 300;
  function walk(from, cameFrom) {
    const path = [from], seen = new Set([cameFrom, from]);
    let prev = cameFrom, cur = from, dist = 0;
    while (!stop(cur)) {
      const opts = (adj[cur] || []).filter((e) => e.to !== prev && !seen.has(e.to));
      if (!opts.length) break;
      let next = opts[0];
      if (opts.length > 1) next = opts.find((e) => wayName(e.wayId) === clickedName) || opts[0];
      const a = nodes[cur], b = nodes[next.to];
      if (a && b) dist += haversine(a[1], a[0], b[1], b[0]);
      if (dist > MAX_WALK_M) break;
      path.push(next.to); seen.add(next.to); prev = cur; cur = next.to;
    }
    return path;
  }
  const back = walk(seq[segIdx], seq[segIdx + 1]);   // [startA … farBack]
  const fwd  = walk(seq[segIdx + 1], seq[segIdx]);    // [startB … farFwd]
  const ordered = back.slice().reverse().concat(fwd);
  const coords = ordered.map((n) => nodes[n]).filter(Boolean);
  if (coords.length < 2) return { coords: seq.map((n) => nodes[n]).filter(Boolean), name: clickedName };
  return { coords, name: clickedName };
}

/* ============================================================
 * MAP  /map   (filters + transit layer + inline report drawer)
 * ============================================================ */
route(/^\/map(?:\?.*)?$/, function mapPage() {
  const params = new URLSearchParams((window.location.hash.split("?")[1] || ""));
  const active = { cats: new Set(), statuses: new Set() };
  let showTransit = false;

  const filters = el(`
    <div class="map-filters">
      <h4>Problem type</h4>
      <div class="filter-list" id="f-cats">
        ${DB.activeCategories().map((c) => `<span class="chip" data-cat="${c.slug}"><span class="dot" style="background:${c.color}"></span>${esc(c.label)}</span>`).join("")}
      </div>
      <h4>Status</h4>
      <div class="filter-list" id="f-status">
        ${["published","under_stc_review","referred_to_official_channel","response_received","improvement_in_progress","improved","duplicate","archived"]
          .map((s) => `<span class="chip" data-status="${s}"><span class="dot" style="background:${STATUSES[s].color}"></span>${esc(STATUSES[s].label)}</span>`).join("")}
      </div>
      <h4>Layers</h4>
      <div class="filter-list">
        <span class="chip" id="toggle-transit"><span class="dot" style="background:#0984e3"></span>🚉 Transit stations</span>
      </div>
      <button class="btn btn-ghost btn-sm btn-block" id="clear-filters" style="margin-top:12px">Clear filters</button>
    </div>`);

  const wrapEl = el(`
    <div class="map-page">
      <div id="map"></div>
      <button class="btn btn-accent fab" id="open-report">＋ Report</button>
      <aside class="report-drawer" id="report-drawer">
        <header><h3>Report an issue</h3><button class="drawer-close" id="drawer-close" aria-label="Close">✕</button></header>
        <div class="drawer-body" id="drawer-body"></div>
      </aside>
    </div>`);
  wrapEl.prepend(filters);

  const view = pageShell(wrapEl);

  setTimeout(() => {
    const map = new maplibregl.Map({ container: "map", style: MAP_STYLE, center: SG_CENTER, zoom: 11.2 });
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), "bottom-right");

    let issueMarkers = [];
    const drawer = wrapEl.querySelector("#report-drawer");
    let panel = null;            // report panel api when open
    let mode = "point";          // "point" | "segment"
    let pinMarker = null;
    let hoveredSeg = null;       // road-network feature id currently hovered
    let roadnetLoaded = false;

    // Lazily load the pre-generated junction-to-junction road network.
    // Tries the full-island file first (sg-roads.geojson), falls back to the
    // Toa Payoh pilot file. Overpass live-fetch remains the fallback for areas
    // not covered by either file.
    function loadRoadnet() {
      if (roadnetLoaded) return;
      roadnetLoaded = true;
      const tryLoad = (url) =>
        fetch(url).then((r) => {
          if (!r.ok) throw new Error(r.status);
          return r.json();
        });
      tryLoad("data/sg-roads.geojson")
        .catch(() => tryLoad("data/pilot-roads.geojson"))
        .then((gj) => { const s = map.getSource("roadnet"); if (s) s.setData(gj); })
        .catch(() => { roadnetLoaded = false; });
    }
    // show the interactive road layer only while picking segments and zoomed in enough
    function updateRoadnetVis() {
      const on = mode === "segment" && drawer.classList.contains("open") && map.getZoom() >= 15;
      const v = on ? "visible" : "none";
      ["roadnet-line", "roadnet-hit"].forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", v));
    }

    function draw() {
      issueMarkers.forEach((m) => m.remove());
      issueMarkers = [];
      const rows = DB.publicIssues()
        .filter((i) => active.cats.size === 0 || active.cats.has(i.category))
        .filter((i) => active.statuses.size === 0 || active.statuses.has(i.status));
      rows.forEach((i) => issueMarkers.push(addMarker(map, i, true)));
      // existing issue segments as a highlight layer
      const src = map.getSource("issue-segs");
      if (src) {
        const segFeatures = rows
          .map((i) => ({ i, segs: normalizeGeom(i.geometry) }))
          .filter(({ segs }) => segs.length)
          .map(({ i, segs }) => ({ type: "Feature", geometry: { type: "MultiLineString", coordinates: segs }, properties: { color: (catBySlug(i.category) || {}).color || "#e4572e" } }));
        src.setData({ type: "FeatureCollection", features: segFeatures });
      }
    }

    map.on("load", () => {
      // issue + report segment line layers
      map.addSource("issue-segs", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "issue-segs", type: "line", source: "issue-segs",
        paint: { "line-color": ["get", "color"], "line-width": 5, "line-opacity": 0.55 } });
      map.addSource("report-seg", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // road-network layer for hover-preview (grey) + selectable hit area.
      // promoteId makes feature.id === segment_id for feature-state.
      map.addSource("roadnet", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "segment_id" });
      map.addLayer({ id: "roadnet-line", type: "line", source: "roadnet",
        layout: { visibility: "none", "line-cap": "round" },
        paint: {
          "line-color": ["case", ["boolean", ["feature-state", "hover"], false], "#6b7280", "#aab2bb"],
          "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 6, 3],
          "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.95, 0.35],
        } });
      map.addLayer({ id: "roadnet-hit", type: "line", source: "roadnet",
        layout: { visibility: "none" },
        paint: { "line-color": "#000", "line-opacity": 0.01, "line-width": 18 } });

      // the selected chain (red) is drawn on top via report-seg
      map.addLayer({ id: "report-seg", type: "line", source: "report-seg",
        paint: { "line-color": "#e4572e", "line-width": 6, "line-opacity": 0.9 } });

      map.on("mousemove", "roadnet-hit", (e) => {
        if (mode !== "segment" || !e.features.length) return;
        if (hoveredSeg !== null) map.setFeatureState({ source: "roadnet", id: hoveredSeg }, { hover: false });
        hoveredSeg = e.features[0].id;
        map.setFeatureState({ source: "roadnet", id: hoveredSeg }, { hover: true });
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "roadnet-hit", () => {
        if (hoveredSeg !== null) map.setFeatureState({ source: "roadnet", id: hoveredSeg }, { hover: false });
        hoveredSeg = null;
        if (mode === "segment") map.getCanvas().style.cursor = "crosshair";
      });
      map.on("click", "roadnet-hit", (e) => {
        if (mode !== "segment" || !drawer.classList.contains("open") || !e.features.length) return;
        e.originalEvent._handledRoadnet = true;   // stop the generic Overpass click below
        const f = e.features[0];
        panel && panel.handleSegmentClick({ coords: f.geometry.coordinates, name: f.properties.name || null });
      });
      map.on("zoomend", updateRoadnetVis);

      // transit stations layer (hidden until toggled)
      map.addSource("transit", { type: "geojson", data: {
        type: "FeatureCollection",
        features: TRANSIT_STATIONS.map((t) => ({ type: "Feature",
          geometry: { type: "Point", coordinates: [t.lng, t.lat] },
          properties: { id: t.id, name: t.name, color: t.color, type: t.type, lines: t.lines.join(", ") } })),
      }});
      map.addLayer({ id: "transit-stations", type: "circle", source: "transit",
        layout: { visibility: "none" },
        paint: { "circle-radius": 6, "circle-color": ["get", "color"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
      map.addLayer({ id: "transit-labels", type: "symbol", source: "transit",
        layout: { visibility: "none", "text-field": ["get", "name"], "text-font": ["Open Sans Regular"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top" },
        paint: { "text-halo-color": "#fff", "text-halo-width": 1.5, "text-color": "#333" } });

      map.on("mouseenter", "transit-stations", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "transit-stations", () => (map.getCanvas().style.cursor = ""));
      map.on("click", "transit-stations", (e) => {
        const f = e.features[0];
        const st = transitById(f.properties.id);
        e.originalEvent._handledTransit = true;
        if (st) { openDrawer(); panel && panel.prefillStation(st); }
      });

      draw();
      if (params.get("report") === "1") openDrawer();
    });

    // map click → set point or fetch segment (only while drawer open)
    map.on("click", async (e) => {
      if (!drawer.classList.contains("open")) return;
      if (e.originalEvent && (e.originalEvent._handledTransit || e.originalEvent._handledRoadnet)) return;
      if (mode === "segment") {
        // not on a pre-loaded road segment → fall back to live Overpass lookup
        panel && panel.segmentLoading();
        try {
          const seg = await fetchRoadSegment(e.lngLat.lng, e.lngLat.lat);
          if (seg) { panel && panel.handleSegmentClick(seg); }
          else { panel && panel.segmentFailed("No road found there — try clicking directly on a road."); }
        } catch (err) {
          panel && panel.segmentFailed("Couldn't reach OpenStreetMap. Place a pin instead.");
        }
      } else {
        placePin(e.lngLat.lng, e.lngLat.lat);
        panel && panel.setLocation(e.lngLat.lng, e.lngLat.lat);
      }
    });

    function placePin(lng, lat) {
      if (!pinMarker) {
        pinMarker = new maplibregl.Marker({ color: "#e4572e", draggable: true }).setLngLat([lng, lat]).addTo(map);
        pinMarker.on("dragend", () => { const p = pinMarker.getLngLat(); panel && panel.setLocation(p.lng, p.lat); });
      } else pinMarker.setLngLat([lng, lat]);
    }
    function clearReportGeo() {
      if (pinMarker) { pinMarker.remove(); pinMarker = null; }
      map.getSource("report-seg") && map.getSource("report-seg").setData({ type: "FeatureCollection", features: [] });
    }
    function setMode(m) {
      mode = m;
      map.getCanvas().style.cursor = m === "segment" ? "crosshair" : "";
      if (m === "segment") loadRoadnet();
      updateRoadnetVis();
      panel && panel.reflectMode(m);
    }

    function renderSegments(segs) {
      const src = map.getSource("report-seg");
      if (src) src.setData({ type: "FeatureCollection", features: (segs || []).map((c) => ({ type: "Feature", geometry: { type: "LineString", coordinates: c }, properties: {} })) });
    }

    function openDrawer() {
      drawer.classList.add("open");
      const rep = { lng: null, lat: null, address_text: "", category: DB.activeCategories()[0]?.slug || "",
        title: "", description: "", affected_users: [], photos: [], email: "", consent: false, turnstile: false,
        geometry: [], asset_type: "street", transit_ref: null };
      panel = mountReportPanel(wrapEl.querySelector("#drawer-body"), rep, {
        requestMode: setMode, clearGeo: () => { clearReportGeo(); }, placePin, renderSegments, map,
        onSubmitted: () => { clearReportGeo(); setMode("point"); draw(); },
      });
    }
    function closeDrawer() { drawer.classList.remove("open"); clearReportGeo(); setMode("point"); panel = null; }

    wrapEl.querySelector("#open-report").onclick = openDrawer;
    wrapEl.querySelector("#drawer-close").onclick = closeDrawer;

    // filters
    filters.querySelectorAll("[data-cat]").forEach((chip) =>
      chip.addEventListener("click", () => {
        const k = chip.dataset.cat; active.cats.has(k) ? active.cats.delete(k) : active.cats.add(k);
        chip.classList.toggle("on"); draw();
      }));
    filters.querySelectorAll("[data-status]").forEach((chip) =>
      chip.addEventListener("click", () => {
        const k = chip.dataset.status; active.statuses.has(k) ? active.statuses.delete(k) : active.statuses.add(k);
        chip.classList.toggle("on"); draw();
      }));
    const transitChip = filters.querySelector("#toggle-transit");
    transitChip.onclick = () => {
      showTransit = !showTransit;
      transitChip.classList.toggle("on", showTransit);
      const v = showTransit ? "visible" : "none";
      map.setLayoutProperty("transit-stations", "visibility", v);
      map.setLayoutProperty("transit-labels", "visibility", v);
    };
    filters.querySelector("#clear-filters").onclick = () => {
      active.cats.clear(); active.statuses.clear();
      filters.querySelectorAll(".chip:not(#toggle-transit)").forEach((c) => c.classList.remove("on")); draw();
    };
  }, 0);

  return view;
});

/* ============================================================
 * Inline report panel (used inside the map drawer)
 * Renders a condensed single-scroll form; the map feeds it
 * location / segment / station selections via the returned api.
 * ============================================================ */
function mountReportPanel(container, rep, hooks) {
  let segMode = false;

  container.innerHTML = "";
  const body = el(`<div></div>`);

  const locBlock = el(`
    <div>
      <div class="loc-hint" id="loc-hint">📍 Click the map to set the location (or drag the pin).</div>
      <div class="loc-status muted" id="loc-status">No location selected yet.</div>
      <div class="row" style="gap:8px;align-items:center">
        <button class="btn btn-ghost btn-sm seg-toggle" id="seg-toggle">🛣️ Select road segment(s)</button>
      </div>
      <div class="seg-tools hidden" id="seg-tools" style="margin-top:8px">
        <div class="loc-hint" id="seg-hint">Zoom in and hover a road — it previews in grey. Click to select (turns red); click connected roads to extend, or a red one to remove. Drag the pin to fine-tune.</div>
        <div class="row" style="gap:8px;align-items:center;margin-top:8px">
          <button class="btn btn-ghost btn-sm" id="seg-undo">↶ Undo last</button>
          <button class="btn btn-ghost btn-sm" id="seg-clear">Clear</button>
          <button class="btn btn-primary btn-sm" id="seg-done">Done</button>
        </div>
      </div>
      <div class="loc-status muted" id="seg-status"></div>
      <div id="transit-row"></div>
    </div>`);
  body.appendChild(locBlock);

  const form = el(`
    <div style="margin-top:14px">
      <label class="field">Problem type
        <select id="r-cat">${DB.activeCategories().map((c) => `<option value="${c.slug}">${esc(c.label)}</option>`).join("")}</select></label>
      <label class="field">Title
        <input type="text" id="r-title" maxlength="120" placeholder="Short summary"></label>
      <label class="field">Description
        <textarea id="r-desc" placeholder="What is the problem, when is it worst, who does it affect?"></textarea></label>
      <div class="field">Who is affected
        <div class="row" id="r-affected" style="margin-top:8px">
          ${AFFECTED_USERS.map((u) => `<button type="button" class="chip" data-u="${u.id}">${esc(u.label)}</button>`).join("")}
        </div>
      </div>
      <div class="field">Photos <span class="muted" style="font-weight:400">(max 3)</span>
        <div class="photo-grid" id="r-photos"></div>
      </div>
      <label class="field">Email <span class="muted" style="font-weight:400">(optional)</span>
        <input type="email" id="r-email" placeholder="you@example.com"></label>
      <label class="checkbox"><input type="checkbox" id="r-consent"> <span>I agree to the <a href="#/privacy" target="_blank">privacy policy</a> &amp; <a href="#/terms" target="_blank">terms</a>.</span></label>
      <label class="checkbox"><input type="checkbox" id="r-turnstile"> <span>I'm human (simulated Turnstile).</span></label>
      <button class="btn btn-accent btn-block" id="r-submit" style="margin-top:8px">Submit report</button>
      <p class="help" style="text-align:center;margin-top:8px">Your report stays private until an STC moderator publishes it.</p>
    </div>`);
  body.appendChild(form);
  container.appendChild(body);

  // ----- field bindings -----
  const $$ = (s) => body.querySelector(s);
  $$("#r-cat").value = rep.category;
  $$("#r-cat").onchange = (e) => { rep.category = e.target.value; };
  $$("#r-title").oninput = (e) => { rep.title = e.target.value; };
  $$("#r-desc").oninput = (e) => { rep.description = e.target.value; };
  $$("#r-email").oninput = (e) => { rep.email = e.target.value; };
  $$("#r-consent").onchange = (e) => { rep.consent = e.target.checked; };
  $$("#r-turnstile").onchange = (e) => { rep.turnstile = e.target.checked; };
  body.querySelectorAll("#r-affected .chip").forEach((chip) => chip.onclick = () => {
    const id = chip.dataset.u, i = rep.affected_users.indexOf(id);
    i >= 0 ? rep.affected_users.splice(i, 1) : rep.affected_users.push(id);
    chip.classList.toggle("on");
  });

  // photos
  function paintPhotos() {
    const grid = $$("#r-photos"); grid.innerHTML = "";
    rep.photos.forEach((p, idx) => {
      const t = el(`<div class="photo-thumb"><img src="${p}"><button title="Remove">✕</button></div>`);
      t.querySelector("button").onclick = () => { rep.photos.splice(idx, 1); paintPhotos(); };
      grid.appendChild(t);
    });
    if (rep.photos.length < 3) {
      const add = el(`<label class="photo-thumb" style="display:grid;place-items:center;cursor:pointer;color:var(--ink-soft)"><span style="font-size:26px">＋</span><input type="file" accept="image/png,image/jpeg,image/webp" class="hidden"></label>`);
      add.querySelector("input").onchange = (e) => handlePhoto(e, rep, paintPhotos);
      grid.appendChild(add);
    }
  }
  paintPhotos();

  // ---- road-segment chain selection ----
  const segNames = [];                                  // unique road names, selection order
  const segEnds = (c) => [c[0], c[c.length - 1]];
  const near = (a, b) => haversine(a[1], a[0], b[1], b[0]) < 15;   // ~15m endpoint tolerance
  const segKey = (c) => { const [a, b] = segEnds(c).map((p) => p.map((n) => n.toFixed(5)).join(",")); return [a, b].sort().join("|"); };
  const connects = (coords) => {
    if (!rep.geometry.length) return true;
    const ne = segEnds(coords);
    return rep.geometry.some((s) => { const e = segEnds(s); return ne.some((p) => e.some((q) => near(p, q))); });
  };
  function reposPin() {
    const all = [].concat(...rep.geometry);
    if (!all.length) return;
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    let best = all[0], bd = Infinity;
    for (const p of all) { const d = haversine(cy, cx, p[1], p[0]); if (d < bd) { bd = d; best = p; } }
    rep.lng = best[0]; rep.lat = best[1]; hooks.placePin(best[0], best[1]); updateLocStatus();
  }
  function renderSegStatus() {
    const n = rep.geometry.length;
    $$("#seg-status").textContent = n ? `🛣️ ${n} segment${n > 1 ? "s" : ""} selected${segNames.length ? " — " + segNames.join(", ") : ""}` : (segMode ? "Click a road on the map…" : "");
  }
  function applySegUI(on) {                 // UI only — no mode request (avoids recursion)
    segMode = on;
    $$("#seg-toggle").classList.toggle("on", on);
    $$("#seg-tools").classList.toggle("hidden", !on);
    renderSegStatus();
  }
  function setSegMode(on) { applySegUI(on); hooks.requestMode(on ? "segment" : "point"); }
  $$("#seg-toggle").onclick = () => setSegMode(!segMode);
  $$("#seg-done").onclick = () => setSegMode(false);
  $$("#seg-undo").onclick = () => {
    if (!rep.geometry.length) return;
    rep.geometry.pop(); segNames.pop();
    hooks.renderSegments(rep.geometry);
    rep.geometry.length ? reposPin() : (function () { rep.lng = rep.lat = null; hooks.clearGeo(); updateLocStatus(); })();
    renderSegStatus();
  };
  $$("#seg-clear").onclick = () => {
    rep.geometry = []; segNames.length = 0;
    hooks.clearGeo();
    rep.lng = rep.lat = null; updateLocStatus();
    renderSegStatus();
  };

  $$("#r-submit").onclick = () => {
    if (rep.lng == null || rep.lat == null) return toast("Set a location on the map first.");
    if (!rep.category) return toast("Pick a problem type.");
    if (!rep.title.trim()) return toast("A title is required.");
    if (!rep.description.trim()) return toast("A description is required.");
    if (!rep.consent) return toast("Please accept the privacy & terms.");
    if (!rep.turnstile) return toast("Please complete the human check.");
    const issue = DB.addIssue({
      category: rep.category, title: rep.title.trim(), description: rep.description.trim(),
      affected_users: rep.affected_users, lng: rep.lng, lat: rep.lat, address_text: rep.address_text,
      photos: rep.photos, email: rep.email || null, geometry: rep.geometry.length ? rep.geometry : null,
      asset_type: rep.asset_type, transit_ref: rep.transit_ref,
    });
    hooks.onSubmitted(issue);
    showSuccess();
  };

  function updateLocStatus() {
    const s = $$("#loc-status");
    s.textContent = rep.lat != null ? `📍 ${rep.lat.toFixed(5)}, ${rep.lng.toFixed(5)}${rep.address_text ? " · " + rep.address_text : ""}` : "No location selected yet.";
    s.classList.toggle("muted", rep.lat == null);
  }

  function showSuccess() {
    container.innerHTML = "";
    container.appendChild(el(`
      <div class="center" style="padding:20px 4px">
        <div style="font-size:40px">✅</div>
        <h3>Report submitted</h3>
        <p class="muted">It's now pending moderation and will appear on the map once STC publishes it.</p>
        <button class="btn btn-primary btn-block" id="again">Report another</button>
      </div>`));
    container.querySelector("#again").onclick = () => mountReportPanel(container, {
      lng: null, lat: null, address_text: "", category: DB.activeCategories()[0]?.slug || "",
      title: "", description: "", affected_users: [], photos: [], email: "", consent: false,
      turnstile: false, geometry: [], asset_type: "street", transit_ref: null }, hooks);
  }

  // ----- api exposed to the map -----
  return {
    setLocation(lng, lat) { rep.lng = lng; rep.lat = lat; updateLocStatus(); },
    handleSegmentClick(seg) {
      const key = segKey(seg.coords);
      const idx = rep.geometry.findIndex((c) => segKey(c) === key);
      if (idx >= 0) {                                   // toggle off an already-selected segment
        rep.geometry.splice(idx, 1); segNames.splice(idx, 1);
      } else if (!connects(seg.coords)) {
        return toast("Pick a segment connected to your selection");
      } else {                                          // add to the chain
        rep.geometry.push(seg.coords);
        segNames.push(seg.name || "unnamed road");
      }
      // keep names unique-ish but order-preserving for the status line
      hooks.renderSegments(rep.geometry);
      if (rep.geometry.length) { reposPin(); if (!rep.address_text) rep.address_text = [...new Set(segNames)].join(", "); }
      else { rep.lng = rep.lat = null; hooks.clearGeo(); updateLocStatus(); }
      renderSegStatus();
    },
    segmentLoading() { if (segMode && !rep.geometry.length) $$("#seg-status").textContent = "Looking up the road segment…"; },
    segmentFailed(msg) { $$("#seg-status").textContent = msg; },
    reflectMode(m) { applySegUI(m === "segment"); },
    prefillStation(st) {
      rep.asset_type = "transit"; rep.transit_ref = st.name;
      rep.lng = st.lng; rep.lat = st.lat; rep.address_text = st.name + " (" + st.lines.join("/") + ")";
      const tc = DB.activeCategories().find((c) => c.slug === "transit-stop-access");
      if (tc) { rep.category = tc.slug; $$("#r-cat").value = tc.slug; }
      hooks.placePin(st.lng, st.lat);
      $$("#transit-row").innerHTML = `<div style="margin-top:8px"><span class="transit-pill">🚉 ${esc(st.name)} · ${esc(st.type)}</span></div>`;
      updateLocStatus();
      toast("Reporting about " + st.name);
    },
  };
}

/* ============================================================
 * REPORT  /report  (multi-step form)
 * ============================================================ */
const DRAFT_KEY = "streetdoctor_draft_v1";

route(/^\/report$/, function reportPage() {
  const draft = loadDraft() || {
    lng: null, lat: null, address_text: "", category: "", title: "", description: "",
    affected_users: [], photos: [], email: "", consent: false, turnstile: false,
  };
  let step = 1;
  const TOTAL = 8;

  const container = el(`<div class="wrap section" style="max-width:680px"></div>`);
  const view = pageShell(
    el(`<div class="wrap section" style="max-width:680px;padding-bottom:0"><div id="rep-disc"></div></div>`),
    container
  );
  view.querySelector("#rep-disc").appendChild(disclaimerBanner());

  function saveAndRerender() { saveDraft(draft); paint(); }

  function paint() {
    container.innerHTML = "";
    const card = el(`<div class="card"></div>`);

    const seg = Array.from({ length: TOTAL }, (_, i) => `<div class="seg ${i < step ? "done" : ""}"></div>`).join("");
    card.appendChild(el(`<div class="stepper">${seg}</div>`));

    card.appendChild(renderStep(step, draft, saveAndRerender, {
      next: () => { if (validateStep(step, draft)) { step = Math.min(TOTAL, step + 1); paint(); } },
      back: () => { step = Math.max(1, step - 1); paint(); },
      submit: () => {
        if (!validateStep(step, draft)) return;
        const issue = DB.addIssue({
          category: draft.category, title: draft.title.trim(), description: draft.description.trim(),
          affected_users: draft.affected_users, lng: draft.lng, lat: draft.lat,
          address_text: draft.address_text, photos: draft.photos, email: draft.email || null,
        });
        clearDraft();
        navigate(`/report/success`);
      },
    }));

    container.appendChild(card);
  }

  paint();
  // map needs the DOM present; renderStep mounts it via setTimeout
  return view;
});

route(/^\/report\/success$/, function reportSuccess() {
  return pageShell(el(`
    <div class="wrap section center" style="max-width:560px">
      <div class="card">
        <div style="font-size:48px">✅</div>
        <h1>Report submitted</h1>
        <p class="muted">Thank you. Your report is now <strong>pending moderation</strong> and won't appear on the public map until an STC moderator reviews and publishes it.</p>
        <p class="muted">If you left an email, STC may contact you about status changes. There is no account to log into — keep an eye on the public map.</p>
        <div class="row center" style="justify-content:center;margin-top:14px">
          <a class="btn btn-primary" href="#/map">Back to map</a>
          <a class="btn btn-ghost" href="#/report">Report another</a>
        </div>
      </div>
    </div>`));
});

/* ----- step rendering ----- */
const STEP_TITLES = {
  1: "Pick the location", 2: "Confirm the address", 3: "Problem type", 4: "Title & description",
  5: "Who is affected", 6: "Photos", 7: "Contact (optional)", 8: "Consent & verify",
};

function renderStep(step, d, onChange, nav) {
  const body = el(`<div>
    <div class="step-head"><h3 style="margin:0">${STEP_TITLES[step]}</h3><span class="count">Step ${step} of 8</span></div>
  </div>`);

  if (step === 1) {
    body.appendChild(el(`<p class="muted">Tap the map to drop a pin, or drag the marker, where the problem is.</p>`));
    body.appendChild(el(`<div id="report-map" style="height:320px;border:1px solid var(--line)"></div>`));
    const coords = el(`<p class="help" id="coord-label">${d.lat ? `📍 ${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}` : "No location selected yet."}</p>`);
    body.appendChild(coords);
    setTimeout(() => {
      const map = new maplibregl.Map({ container: "report-map", style: MAP_STYLE, center: d.lng ? [d.lng, d.lat] : SG_CENTER, zoom: d.lng ? 16 : 11 });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      let marker = null;
      function place(lng, lat) {
        d.lng = lng; d.lat = lat;
        if (!marker) {
          marker = new maplibregl.Marker({ color: "#e4572e", draggable: true }).setLngLat([lng, lat]).addTo(map);
          marker.on("dragend", () => { const p = marker.getLngLat(); d.lng = p.lng; d.lat = p.lat; coords.textContent = `📍 ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`; onChangeQuiet(); });
        } else marker.setLngLat([lng, lat]);
        coords.textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        onChangeQuiet();
      }
      if (d.lng) place(d.lng, d.lat);
      map.on("click", (e) => place(e.lngLat.lng, e.lngLat.lat));
    }, 0);
  }

  if (step === 2) {
    body.appendChild(el(`<label class="field">Address or landmark
      <input type="text" id="addr" placeholder="e.g. Toa Payoh Lorong 4, near Blk 70" value="${esc(d.address_text)}">
      <div class="help">In the production build this uses OneMap Search &amp; reverse-geocoding. Here, type a description or use your current location.</div>
    </label>`));
    const geoBtn = el(`<button class="btn btn-ghost btn-sm">📍 Use my current location</button>`);
    geoBtn.onclick = () => {
      if (!navigator.geolocation) return toast("Geolocation not available");
      geoBtn.textContent = "Locating…";
      navigator.geolocation.getCurrentPosition(
        (pos) => { d.lat = pos.coords.latitude; d.lng = pos.coords.longitude; toast("Location captured"); geoBtn.textContent = "📍 Location captured"; },
        () => { toast("Couldn't get location"); geoBtn.textContent = "📍 Use my current location"; }
      );
    };
    body.appendChild(geoBtn);
    body.querySelector("#addr").addEventListener("input", (e) => { d.address_text = e.target.value; });
  }

  if (step === 3) {
    const grid = el(`<div class="grid grid-2" style="margin-top:6px"></div>`);
    DB.activeCategories().forEach((c) => {
      const chip = el(`<button class="chip ${d.category === c.slug ? "on" : ""}" style="justify-content:flex-start;padding:14px"><span class="dot" style="background:${c.color}"></span>${c.icon} ${esc(c.label)}</button>`);
      chip.onclick = () => { d.category = c.slug; onChange(); };
      grid.appendChild(chip);
    });
    body.appendChild(grid);
  }

  if (step === 4) {
    body.appendChild(el(`<label class="field">Title <span class="req">*</span>
      <input type="text" id="title" maxlength="120" placeholder="Short summary, e.g. 'No footpath along Jalan Kayu'" value="${esc(d.title)}"></label>`));
    body.appendChild(el(`<label class="field">Description <span class="req">*</span>
      <textarea id="desc" placeholder="What is the problem, when is it worst, who does it affect?">${esc(d.description)}</textarea>
      <div class="help">A bit of detail helps STC. Aim for at least ~40 characters (not enforced).</div></label>`));
    body.querySelector("#title").addEventListener("input", (e) => { d.title = e.target.value; });
    body.querySelector("#desc").addEventListener("input", (e) => { d.description = e.target.value; });
  }

  if (step === 5) {
    body.appendChild(el(`<p class="muted">Select everyone affected (you can pick several).</p>`));
    const list = el(`<div class="row"></div>`);
    AFFECTED_USERS.forEach((u) => {
      const on = d.affected_users.includes(u.id);
      const chip = el(`<button class="chip ${on ? "on" : ""}">${esc(u.label)}</button>`);
      chip.onclick = () => {
        const i = d.affected_users.indexOf(u.id);
        i >= 0 ? d.affected_users.splice(i, 1) : d.affected_users.push(u.id);
        onChange();
      };
      list.appendChild(chip);
    });
    body.appendChild(list);
  }

  if (step === 6) {
    body.appendChild(el(`<p class="muted">Up to 3 photos. Please avoid capturing identifiable faces or licence plates.</p>`));
    const grid = el(`<div class="photo-grid"></div>`);
    function paintPhotos() {
      grid.innerHTML = "";
      d.photos.forEach((p, idx) => {
        const thumb = el(`<div class="photo-thumb"><img src="${p}" alt=""><button title="Remove">✕</button></div>`);
        thumb.querySelector("button").onclick = () => { d.photos.splice(idx, 1); onChangeQuiet(); paintPhotos(); };
        grid.appendChild(thumb);
      });
      if (d.photos.length < 3) {
        const add = el(`<label class="photo-thumb" style="display:grid;place-items:center;cursor:pointer;color:var(--ink-soft)"><span style="font-size:26px">＋</span><input type="file" accept="image/png,image/jpeg,image/webp" class="hidden"></label>`);
        add.querySelector("input").onchange = (e) => handlePhoto(e, d, paintPhotos);
        grid.appendChild(add);
      }
    }
    paintPhotos();
    body.appendChild(grid);
    body.appendChild(el(`<div class="help">Allowed: JPG / PNG / WebP, ≤ 5MB each. Images are compressed in the browser for this prototype.</div>`));
  }

  if (step === 7) {
    body.appendChild(el(`<label class="field">Email <span class="muted">(optional)</span>
      <input type="email" id="email" placeholder="you@example.com" value="${esc(d.email)}">
      <div class="help">Only used so STC can update you on status changes. Stored separately from the public case (see <a href="#/privacy">privacy policy</a>).</div></label>`));
    body.querySelector("#email").addEventListener("input", (e) => { d.email = e.target.value; });
  }

  if (step === 8) {
    body.appendChild(el(`<label class="checkbox"><input type="checkbox" id="consent" ${d.consent ? "checked" : ""}>
      <span>I agree to the <a href="#/privacy">privacy policy</a> and <a href="#/terms">terms of use</a>, including the photo licence terms.</span></label>`));
    body.appendChild(el(`<div class="card" style="background:#f3f7f9;border-style:dashed;margin:10px 0">
      <label class="checkbox" style="margin:0"><input type="checkbox" id="turnstile" ${d.turnstile ? "checked" : ""}>
      <span><strong>Cloudflare Turnstile</strong> — simulated here. In production this is an invisible/low-friction challenge. Tick to confirm you're human.</span></label></div>`));
    body.querySelector("#consent").onchange = (e) => { d.consent = e.target.checked; };
    body.querySelector("#turnstile").onchange = (e) => { d.turnstile = e.target.checked; };

    // review summary
    const cat = catBySlug(d.category);
    body.appendChild(el(`<div class="card" style="margin-top:10px">
      <h4 style="margin-top:0">Review</h4>
      <p style="margin:4px 0"><strong>${esc(d.title || "—")}</strong></p>
      <div class="row" style="gap:6px">${cat ? categoryTag(d.category) : ""} ${d.lat ? `<span class="tag">📍 ${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}</span>` : ""} ${d.photos.length ? `<span class="tag">🖼️ ${d.photos.length} photo(s)</span>` : ""}</div>
      <p class="muted" style="font-size:13px;margin:8px 0 0">${esc(d.description || "")}</p>
    </div>`));
  }

  // ---- nav buttons ----
  const actions = el(`<div class="step-actions"></div>`);
  const back = el(`<button class="btn btn-ghost" ${step === 1 ? "disabled" : ""}>← Back</button>`);
  back.onclick = nav.back;
  actions.appendChild(back);
  if (step < 8) {
    const next = el(`<button class="btn btn-primary">Continue →</button>`);
    next.onclick = nav.next;
    actions.appendChild(next);
  } else {
    const submit = el(`<button class="btn btn-accent">Submit report</button>`);
    submit.onclick = nav.submit;
    actions.appendChild(submit);
  }
  body.appendChild(actions);

  function onChangeQuiet() { saveDraft(d); }
  return body;
}

function validateStep(step, d) {
  if (step === 1 && (d.lng == null || d.lat == null)) { toast("Please drop a pin on the map first."); return false; }
  if (step === 3 && !d.category) { toast("Please choose a problem type."); return false; }
  if (step === 4) {
    if (!d.title.trim()) { toast("A title is required."); return false; }
    if (!d.description.trim()) { toast("A description is required."); return false; }
  }
  if (step === 8) {
    if (!d.consent) { toast("Please accept the privacy & terms to continue."); return false; }
    if (!d.turnstile) { toast("Please complete the human-verification check."); return false; }
  }
  return true;
}

function handlePhoto(e, d, done) {
  const file = e.target.files[0];
  if (!file) return;
  if (!/image\/(png|jpe?g|webp)/.test(file.type)) return toast("Only JPG / PNG / WebP allowed.");
  if (file.size > 5 * 1024 * 1024) return toast("Max 5MB per photo.");
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      // simple client-side compression -> dataURL
      const max = 1024; let { width, height } = img;
      if (width > max || height > max) { const r = Math.min(max / width, max / height); width = Math.round(width * r); height = Math.round(height * r); }
      const cv = document.createElement("canvas"); cv.width = width; cv.height = height;
      cv.getContext("2d").drawImage(img, 0, 0, width, height);
      d.photos.push(cv.toDataURL("image/jpeg", 0.8));
      saveDraft(d); done();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* draft persistence (localStorage, §4.3 "中途離開以 localStorage 暫存") */
function saveDraft(d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {} }
function loadDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) { return null; } }
function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

/* ============================================================
 * ISSUE DETAIL  /issues/:id
 * ============================================================ */
route(/^\/issues\/([\w-]+)$/, function issueDetail(id) {
  const issue = DB.getIssue(id);
  if (!issue || (!STATUSES[issue.status]?.public && !DB.isAdmin())) {
    return pageShell(el(`<div class="wrap section"><h1>Case not available</h1><p class="muted">This case may be pending moderation or doesn't exist.</p><a class="btn btn-ghost" href="#/map">Back to map</a></div>`));
  }
  const cat = catBySlug(issue.category);
  const voted = DB.hasVoted(issue.id);
  const affected = (issue.affected_users || []).map((u) => AFFECTED_USERS.find((a) => a.id === u)?.label || u);
  const publicHistory = (issue.status_history || []).filter((h) => h.is_public);

  const view = pageShell(el(`
    <div class="wrap section">
      <a href="#/map" class="muted" style="font-size:14px">← Back to map</a>
      <div class="detail-head" style="margin-top:10px">
        ${statusBadge(issue.status)} ${categoryTag(issue.category)}
        ${issue.asset_type === "transit" && issue.transit_ref ? `<span class="transit-pill">🚉 ${esc(issue.transit_ref)}</span>` : ""}
        ${normalizeGeom(issue.geometry).length ? `<span class="tag">🛣️ Road segment${normalizeGeom(issue.geometry).length > 1 ? "s (" + normalizeGeom(issue.geometry).length + ")" : ""}</span>` : ""}
      </div>
      <h1 style="margin-bottom:6px">${esc(issue.title)}</h1>
      <p class="muted" style="margin-top:0">📍 ${esc(issue.address_text || "Location on map")} · Reported ${fmtDate(issue.created_at)} · Updated ${fmtDate(issue.updated_at)}</p>

      <div class="row" style="align-items:flex-start;margin-top:12px">
        <div class="grow" style="flex:2;min-width:280px">
          ${issue.photos && issue.photos.length ? `<div class="carousel">${issue.photos.map((p) => `<img src="${p}" alt="">`).join("")}</div>` : ""}
          <div class="card" style="margin-top:14px">
            <h3>Description</h3>
            <p>${esc(issue.description)}</p>
            ${affected.length ? `<h3 style="margin-top:16px">Who is affected</h3><div class="row">${affected.map((a) => `<span class="tag">${esc(a)}</span>`).join("")}</div>` : ""}
          </div>

          <div class="card" style="margin-top:14px">
            <h3>STC updates</h3>
            ${publicHistory.length
              ? `<ul class="timeline">${publicHistory.slice().reverse().map((h) => `
                  <li><div class="t-time">${fmtDateTime(h.created_at)}</div>
                  <div>${statusBadge(h.new_status)}</div>
                  ${h.note ? `<div class="t-note">${esc(h.note)}</div>` : ""}</li>`).join("")}</ul>`
              : `<p class="muted">No public updates yet.</p>`}
          </div>
        </div>

        <div class="grow" style="flex:1;min-width:240px">
          <div class="card">
            <div id="detail-map" style="height:200px;border:1px solid var(--line)"></div>
            <div class="center" style="margin-top:14px">
              <div class="stat"><div class="n">${issue.support_count}</div><div class="l">supports</div></div>
              <button class="btn ${voted ? "btn-ghost" : "btn-primary"} btn-block" id="support-btn" ${voted ? "disabled" : ""} style="margin-top:10px">
                ${voted ? "✓ You supported this" : "👍 Support this issue"}
              </button>
              <button class="btn btn-ghost btn-block btn-sm" id="share-btn" style="margin-top:8px">🔗 Copy link</button>
            </div>
          </div>
          <div class="disclaimer" style="margin-top:14px">
            <span class="ic">ℹ️</span>
            <div style="font-size:13px">For emergencies or routine repairs, use official channels — <a href="https://www.oneservice.gov.sg" target="_blank" rel="noopener">OneService</a> or <a href="tel:999">999</a>.</div>
          </div>
        </div>
      </div>
    </div>`));

  view.querySelector("#support-btn").onclick = (e) => {
    if (DB.vote(issue.id)) { toast("Thanks for your support!"); render(); }
    else toast("You've already supported this case.");
  };
  view.querySelector("#share-btn").onclick = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(() => toast("Link copied")).catch(() => toast(url));
  };

  setTimeout(() => {
    const map = new maplibregl.Map({ container: "detail-map", style: MAP_STYLE, center: [issue.lng, issue.lat], zoom: 15, interactive: true, attributionControl: false });
    new maplibregl.Marker({ color: cat?.color || "#e4572e" }).setLngLat([issue.lng, issue.lat]).addTo(map);
    const segs = normalizeGeom(issue.geometry);
    if (segs.length) {
      map.on("load", () => {
        map.addSource("seg", { type: "geojson", data: { type: "Feature", geometry: { type: "MultiLineString", coordinates: segs }, properties: {} } });
        map.addLayer({ id: "seg", type: "line", source: "seg", paint: { "line-color": cat?.color || "#e4572e", "line-width": 6, "line-opacity": 0.85 } });
        const flat = [].concat(...segs);
        const b = flat.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(flat[0], flat[0]));
        map.fitBounds(b, { padding: 40, maxZoom: 16, duration: 0 });
      });
    }
    map.scrollZoom.disable();
  }, 0);

  return view;
});

/* ============================================================
 * Simple prose pages
 * ============================================================ */
function prosePage(title, html) {
  return () => pageShell(el(`<div class="wrap section prose"><h1>${esc(title)}</h1>${html}</div>`));
}

route(/^\/about$/, prosePage("About Street Doctor SG", `
  <p>Street Doctor SG is a <strong>civic street-audit platform</strong> that lets residents report long-term, systemic street-design problems — missing footpaths, dangerous junctions, accessibility barriers — and turns them into structured evidence for the <strong>Singapore Transport Collective (STC)</strong> to advocate with LTA and other agencies.</p>
  <h2>Why "design-level", not repairs?</h2>
  <p>Potholes and fallen signage are handled well by OneService. What often goes unaddressed are <em>design</em> problems that need policy change. That's the gap we focus on.</p>
  <h2>STC &amp; the Vision Zero Taskforce</h2>
  <p>STC is a civic-tech transport advocacy group. Its Vision Zero Taskforce (VZT) works toward eliminating serious road injuries. Reports here feed STC's research and advocacy submissions.</p>
  <h2>What we are not</h2>
  <p>We are not a government service, we don't promise official response times, and we are not for emergencies. See the <a href="#/emergency">emergency guidance</a>.</p>`));

route(/^\/faq$/, prosePage("Frequently asked questions", `
  <h2>Is this an official government platform?</h2>
  <p>No. Street Doctor SG is run by a student team with STC. It does not replace <a href="https://www.oneservice.gov.sg" target="_blank" rel="noopener">OneService</a> and makes no promise of official action.</p>
  <h2>Do I need an account?</h2>
  <p>No. You can report and support cases without signing up. Email is optional and only used for status updates.</p>
  <h2>What happens after I report?</h2>
  <p>Your case is <strong>pending moderation</strong> and hidden from the public map until an STC moderator reviews and publishes it.</p>
  <h2>What should I not report here?</h2>
  <p>Emergencies, crimes, or routine maintenance (potholes, fallen signs). Use 999 or OneService for those.</p>
  <h2>How reliable is the "support" count?</h2>
  <p>It's an indicative signal, not a rigorous poll. We use lightweight anti-abuse checks, but it can be approximate.</p>`));

route(/^\/privacy$/, prosePage("Privacy policy", `
  <p class="muted">Prototype text — replace with reviewed wording before launch.</p>
  <h2>What we collect</h2>
  <ul>
    <li>The content of your report: location, category, title, description, affected groups, and any photos.</li>
    <li>An optional email, stored <strong>separately</strong> from the public case record to reduce exposure.</li>
    <li>A hashed IP and an anonymous browser identifier, used only for abuse detection. We do not store raw IPs.</li>
  </ul>
  <h2>How we use it</h2>
  <p>Reports are used by STC for research and advocacy with public agencies and may be shared in aggregate with authorities or media. We will be specific about third-party sharing before launch.</p>
  <h2>Photos</h2>
  <p>Please don't capture identifiable faces or licence plates. Moderators may remove photos containing personal data.</p>
  <h2>Retention</h2>
  <p>Case data is retained for the lifetime of the advocacy programme. Email contacts can be deleted on request.</p>`));

route(/^\/terms$/, prosePage("Terms of use", `
  <p class="muted">Prototype text — replace with reviewed wording before launch.</p>
  <h2>Acceptable use</h2>
  <p>Report genuine street-design issues. Do not submit spam, false reports, or content that infringes others' rights.</p>
  <h2>Photo licence</h2>
  <p>By uploading photos you grant STC a non-exclusive licence to use them for moderation, research, and advocacy related to this platform.</p>
  <h2>No guarantee</h2>
  <p>We don't guarantee that any report will lead to action by any authority. This is an advocacy tool, not an official service.</p>`));

route(/^\/emergency$/, () => pageShell(el(`
  <div class="wrap section" style="max-width:640px">
    <h1>Emergency &amp; urgent issues</h1>
    <div class="disclaimer" style="margin-bottom:18px"><span class="ic">🚨</span>
      <div><strong>Street Doctor SG is not for emergencies.</strong> If someone is in danger right now, call emergency services immediately.</div></div>
    <div class="grid grid-2">
      <a class="card center" href="tel:999" style="text-decoration:none;color:inherit"><div style="font-size:34px">🚓</div><h3>999</h3><p class="muted">Police</p></a>
      <a class="card center" href="tel:995" style="text-decoration:none;color:inherit"><div style="font-size:34px">🚑</div><h3>995</h3><p class="muted">Ambulance / Fire (SCDF)</p></a>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Routine municipal issues</h3>
      <p class="muted">Potholes, fallen signage, faulty lamps, illegal parking and similar maintenance issues are best reported to the Government's municipal app.</p>
      <a class="btn btn-primary" href="https://www.oneservice.gov.sg" target="_blank" rel="noopener">Open OneService ↗</a>
    </div>
  </div>`)));

/* ============================================================
 * ADMIN
 * ============================================================ */
function adminShell(activePath, ...children) {
  const frag = document.createElement("div");
  const nav = el(`
    <header class="nav admin-bar">
      <div class="wrap nav-inner">
        <a class="brand" href="#/admin/dashboard"><span class="logo">🩺</span> STC Console</a>
        <nav class="nav-links" style="display:flex">
          <a href="#/admin/dashboard">Dashboard</a>
          <a href="#/admin/issues">Cases</a>
          <a href="#/admin/duplicates">Duplicates</a>
          <a href="#/admin/export">Export</a>
          <a href="#/admin/categories">Categories</a>
          <a href="#/admin/settings">Content</a>
          <a href="#/" >View site ↗</a>
          <a href="#/admin/logout" id="logout">Log out</a>
        </nav>
      </div>
    </header>`);
  nav.querySelectorAll(".nav-links a").forEach((a) => {
    if (a.getAttribute("href") === "#" + activePath) a.classList.add("active");
  });
  nav.querySelector("#logout").onclick = (e) => { e.preventDefault(); DB.logout(); toast("Logged out"); navigate("/admin/login"); };
  frag.appendChild(nav);
  const main = el(`<main></main>`);
  children.forEach((c) => main.appendChild(c));
  frag.appendChild(main);
  return frag;
}

route(/^\/admin\/login$/, function adminLogin() {
  if (DB.isAdmin()) { navigate("/admin/dashboard"); return document.createElement("div"); }
  const wrap = document.createElement("div");
  wrap.appendChild(publicNav());
  const card = el(`
    <div class="wrap section" style="max-width:420px">
      <div class="card">
        <h1 style="margin-bottom:4px">STC admin login</h1>
        <p class="muted" style="margin-top:0">Demo console. In production this is Supabase Auth.</p>
        <label class="field">Email <input type="email" value="moderator@stc.sg"></label>
        <label class="field">Password <input type="text" id="pw" placeholder="stc-demo"></label>
        <button class="btn btn-primary btn-block" id="login-btn">Log in</button>
        <p class="help" style="margin-top:12px">Demo password: <code>stc-demo</code></p>
      </div>
    </div>`);
  card.querySelector("#login-btn").onclick = () => {
    if (DB.login(card.querySelector("#pw").value.trim())) { toast("Welcome back"); navigate("/admin/dashboard"); }
    else toast("Wrong password (try stc-demo)");
  };
  card.querySelector("#pw").addEventListener("keydown", (e) => { if (e.key === "Enter") card.querySelector("#login-btn").click(); });
  wrap.appendChild(card);
  return wrap;
});

route(/^\/admin\/logout$/, () => { DB.logout(); navigate("/admin/login"); return document.createElement("div"); });

route(/^\/admin\/?$/, () => { navigate("/admin/dashboard"); return document.createElement("div"); });

route(/^\/admin\/dashboard$/, function adminDashboard() {
  const all = DB.allIssues();
  const counts = {};
  all.forEach((i) => (counts[i.status] = (counts[i.status] || 0) + 1));
  const pending = counts.pending_moderation || 0;
  const recent = all.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 6);

  const view = el(`<div></div>`);
  view.appendChild(adminShell("/admin/dashboard",
    el(`<div class="wrap section">
      <h1>Dashboard</h1>
      <div class="grid grid-4">
        <div class="card stat" style="border-color:${pending ? "#f3d9a8" : "var(--line)"};${pending ? "background:#fff6e8" : ""}">
          <div class="n" style="color:${pending ? "#d79b00" : "var(--brand)"}">${pending}</div><div class="l">Pending moderation</div></div>
        <div class="card stat"><div class="n">${counts.published || 0}</div><div class="l">Published</div></div>
        <div class="card stat"><div class="n">${(counts.improved || 0)}</div><div class="l">Improved</div></div>
        <div class="card stat"><div class="n">${all.length}</div><div class="l">Total cases</div></div>
      </div>

      <div class="row" style="margin-top:18px;align-items:flex-start">
        <div class="card grow" style="flex:1;min-width:260px">
          <h3>Status breakdown</h3>
          ${Object.keys(STATUSES).filter((s) => counts[s]).map((s) => `
            <div class="row" style="justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding:8px 0">
              <span>${statusBadge(s)}</span><strong>${counts[s]}</strong></div>`).join("") || "<p class='muted'>No cases.</p>"}
        </div>
        <div class="card grow" style="flex:2;min-width:280px">
          <h3>Recent activity</h3>
          <div class="table-scroll"><table class="table">
            <thead><tr><th>Case</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>${recent.map((i) => `<tr>
              <td><a href="#/admin/issues/${i.id}">${esc(i.title)}</a></td>
              <td>${statusBadge(i.status)}</td>
              <td class="muted">${fmtDate(i.updated_at)}</td></tr>`).join("")}</tbody>
          </table></div>
        </div>
      </div>
      ${pending ? `<a class="btn btn-accent" style="margin-top:18px" href="#/admin/issues?filter=pending">Review ${pending} pending case(s) →</a>` : ""}
    </div>`)
  ));
  return view;
});

route(/^\/admin\/issues(?:\?.*)?$/, function adminIssues() {
  const params = new URLSearchParams((window.location.hash.split("?")[1] || ""));
  const preFilter = params.get("filter") === "pending" ? "pending_moderation" : "";
  let fStatus = preFilter, fCat = "", sortKey = "updated_at", sortDir = -1;

  const view = el(`<div></div>`);
  const main = el(`<div class="wrap section"><h1>Cases</h1></div>`);

  const controls = el(`
    <div class="card" style="margin-bottom:16px">
      <div class="row">
        <label class="field grow" style="margin:0">Status
          <select id="f-status"><option value="">All statuses</option>
            ${Object.keys(STATUSES).map((s) => `<option value="${s}" ${s === fStatus ? "selected" : ""}>${STATUSES[s].label}</option>`).join("")}
          </select></label>
        <label class="field grow" style="margin:0">Type
          <select id="f-cat"><option value="">All types</option>
            ${DB.activeCategories().map((c) => `<option value="${c.slug}">${esc(c.label)}</option>`).join("")}
          </select></label>
        <label class="field grow" style="margin:0">Sort by
          <select id="f-sort">
            <option value="updated_at">Last updated</option>
            <option value="created_at">Newest</option>
            <option value="support_count">Most supported</option>
          </select></label>
      </div>
    </div>`);
  main.appendChild(controls);

  const tableWrap = el(`<div class="card" style="padding:0"><div class="table-scroll"><table class="table" id="issues-table"></table></div></div>`);
  main.appendChild(tableWrap);

  function draw() {
    let rows = DB.allIssues()
      .filter((i) => !fStatus || i.status === fStatus)
      .filter((i) => !fCat || i.category === fCat)
      .sort((a, b) => {
        const va = sortKey === "support_count" ? a.support_count : new Date(a[sortKey]);
        const vb = sortKey === "support_count" ? b.support_count : new Date(b[sortKey]);
        return (va > vb ? 1 : va < vb ? -1 : 0) * sortDir;
      });

    const pendingRows = rows.filter((i) => i.status === "pending_moderation");

    tableWrap.querySelector("table").innerHTML = `
      <thead><tr>
        <th>Title</th><th>Type</th><th>Status</th><th>Supports</th><th>Updated</th><th>Actions</th>
      </tr></thead>
      <tbody>${rows.map((i) => `
        <tr>
          <td><a href="#/admin/issues/${i.id}">${esc(i.title)}</a><div class="muted" style="font-size:12px">${esc(i.address_text || "")}</div></td>
          <td>${categoryTag(i.category)}</td>
          <td>${statusBadge(i.status)}</td>
          <td>${i.support_count}</td>
          <td class="muted">${fmtDate(i.updated_at)}</td>
          <td><div class="actions">
            ${i.status === "pending_moderation"
              ? `<button class="btn btn-sm btn-primary" data-approve="${i.id}">Approve</button>
                 <button class="btn btn-sm btn-danger" data-reject="${i.id}">Reject</button>`
              : `<a class="btn btn-sm btn-ghost" href="#/admin/issues/${i.id}">Open</a>`}
          </div></td>
        </tr>`).join("") || `<tr><td colspan="6" class="muted" style="padding:24px;text-align:center">No matching cases.</td></tr>`}
      </tbody>`;

    tableWrap.querySelectorAll("[data-approve]").forEach((b) => b.onclick = () => {
      DB.pushStatus(b.dataset.approve, "published", "Case published after review.", true);
      toast("Case published"); draw();
    });
    tableWrap.querySelectorAll("[data-reject]").forEach((b) => b.onclick = () => {
      const reason = prompt("Reason for rejection (internal, not shown publicly):", "Out of scope / not a design issue");
      if (reason === null) return;
      DB.updateIssue(b.dataset.reject, { rejected_reason: reason });
      DB.pushStatus(b.dataset.reject, "archived", "", false);
      toast("Case rejected"); draw();
    });
  }

  controls.querySelector("#f-status").value = fStatus;
  controls.querySelector("#f-status").onchange = (e) => { fStatus = e.target.value; draw(); };
  controls.querySelector("#f-cat").onchange = (e) => { fCat = e.target.value; draw(); };
  controls.querySelector("#f-sort").onchange = (e) => { sortKey = e.target.value; draw(); };
  draw();

  view.appendChild(adminShell("/admin/issues", main));
  return view;
});

route(/^\/admin\/issues\/([\w-]+)$/, function adminIssueEdit(id) {
  const issue = DB.getIssue(id);
  if (!issue) { const v = el("<div></div>"); v.appendChild(adminShell("/admin/issues", el(`<div class="wrap section"><h1>Not found</h1></div>`))); return v; }

  const main = el(`<div class="wrap section" style="max-width:860px"></div>`);
  main.appendChild(el(`<a href="#/admin/issues" class="muted" style="font-size:14px">← All cases</a>`));
  main.appendChild(el(`<div class="detail-head" style="margin-top:8px">${statusBadge(issue.status)} ${categoryTag(issue.category)}</div>`));

  // editable fields
  const form = el(`<div class="card">
    <h3>Edit content</h3>
    <label class="field">Title <input type="text" id="e-title" value="${esc(issue.title)}"></label>
    <label class="field">Description <textarea id="e-desc">${esc(issue.description)}</textarea></label>
    <label class="field">Category
      <select id="e-cat">${DB.categories().map((c) => `<option value="${c.slug}" ${c.slug === issue.category ? "selected" : ""}>${esc(c.label)}${c.is_active ? "" : " (inactive)"}</option>`).join("")}</select></label>
    <label class="field">Address text <input type="text" id="e-addr" value="${esc(issue.address_text || "")}"></label>
    <div class="row">
      <label class="field grow">Latitude <input type="text" id="e-lat" value="${issue.lat}"></label>
      <label class="field grow">Longitude <input type="text" id="e-lng" value="${issue.lng}"></label>
    </div>
    <div class="help">Tip: drag the marker below to correct the location.</div>
    <div id="edit-map" style="height:220px;border:1px solid var(--line);border-radius:10px;margin-top:8px"></div>
    <button class="btn btn-primary" id="save-content" style="margin-top:14px">Save changes</button>
  </div>`);
  main.appendChild(form);

  // photos
  if (issue.photos && issue.photos.length) {
    const pcard = el(`<div class="card" style="margin-top:16px"><h3>Photos</h3><div class="photo-grid" id="adm-photos"></div></div>`);
    const grid = pcard.querySelector("#adm-photos");
    issue.photos.forEach((p, idx) => {
      const t = el(`<div class="photo-thumb"><img src="${p}"><button title="Remove">✕</button></div>`);
      t.querySelector("button").onclick = () => {
        if (!confirm("Remove this photo? (kept in audit log, hidden from public)")) return;
        issue.photos.splice(idx, 1); DB.updateIssue(issue.id, { photos: issue.photos }); toast("Photo removed"); render();
      };
      grid.appendChild(t);
    });
    main.appendChild(pcard);
  }

  // status update
  const statusCard = el(`<div class="card" style="margin-top:16px">
    <h3>Update status &amp; add a public note</h3>
    <label class="field">New status
      <select id="new-status">${Object.keys(STATUSES).map((s) => `<option value="${s}" ${s === issue.status ? "selected" : ""}>${STATUSES[s].label}</option>`).join("")}</select></label>
    <label class="field">Public note <textarea id="status-note" placeholder="Shown on the public timeline"></textarea></label>
    <label class="checkbox"><input type="checkbox" id="is-public" checked> Show this update publicly</label>
    <button class="btn btn-accent" id="apply-status">Apply status change</button>
  </div>`);
  main.appendChild(statusCard);

  // merge / duplicate
  const others = DB.allIssues().filter((i) => i.id !== issue.id && i.status !== "pending_moderation" && i.status !== "duplicate");
  const mergeCard = el(`<div class="card" style="margin-top:16px">
    <h3>Mark as duplicate</h3>
    <p class="muted">Point this case at the primary case it duplicates. Nothing is hard-deleted.</p>
    <div class="row">
      <select id="merge-target" class="grow">
        <option value="">Select primary case…</option>
        ${others.map((o) => `<option value="${o.id}">${esc(o.title)}</option>`).join("")}
      </select>
      <button class="btn btn-ghost" id="merge-btn">Merge</button>
    </div>
  </div>`);
  main.appendChild(mergeCard);

  // history
  main.appendChild(el(`<div class="card" style="margin-top:16px">
    <h3>Status history (full)</h3>
    ${(issue.status_history || []).length
      ? `<ul class="timeline">${issue.status_history.slice().reverse().map((h) => `
        <li><div class="t-time">${fmtDateTime(h.created_at)} ${h.is_public ? "" : "· <em>internal</em>"}</div>
        <div>${statusBadge(h.new_status)}</div>${h.note ? `<div class="t-note">${esc(h.note)}</div>` : ""}</li>`).join("")}</ul>`
      : "<p class='muted'>No history yet.</p>"}
    ${issue.email ? `<p class="muted" style="margin-top:10px">📧 Reporter contact: <strong>${esc(issue.email)}</strong> <span class="tag">private</span></p>` : `<p class="muted" style="margin-top:10px">No reporter email provided.</p>`}
  </div>`));

  // wire up
  form.querySelector("#save-content").onclick = () => {
    DB.updateIssue(issue.id, {
      title: form.querySelector("#e-title").value.trim(),
      description: form.querySelector("#e-desc").value.trim(),
      category: form.querySelector("#e-cat").value,
      address_text: form.querySelector("#e-addr").value.trim(),
      lat: parseFloat(form.querySelector("#e-lat").value),
      lng: parseFloat(form.querySelector("#e-lng").value),
    });
    toast("Changes saved"); render();
  };
  statusCard.querySelector("#apply-status").onclick = () => {
    const ns = statusCard.querySelector("#new-status").value;
    const note = statusCard.querySelector("#status-note").value.trim();
    const pub = statusCard.querySelector("#is-public").checked;
    DB.pushStatus(issue.id, ns, note, pub);
    toast("Status updated"); render();
  };
  mergeCard.querySelector("#merge-btn").onclick = () => {
    const target = mergeCard.querySelector("#merge-target").value;
    if (!target) return toast("Pick a primary case first");
    const res = DB.mergeIssue(issue.id, target);
    if (!res) return toast("Couldn't merge those cases");
    DB.pushStatus(issue.id, "duplicate", `Merged into "${res.targetTitle}". ${res.moved} support(s) transferred.`, true);
    toast(`Merged — ${res.moved} support(s) moved`); render();
  };

  setTimeout(() => {
    const map = new maplibregl.Map({ container: "edit-map", style: MAP_STYLE, center: [issue.lng, issue.lat], zoom: 15 });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    const marker = new maplibregl.Marker({ color: "#e4572e", draggable: true }).setLngLat([issue.lng, issue.lat]).addTo(map);
    marker.on("dragend", () => { const p = marker.getLngLat(); form.querySelector("#e-lat").value = p.lat.toFixed(6); form.querySelector("#e-lng").value = p.lng.toFixed(6); });
    map.on("click", (e) => { marker.setLngLat(e.lngLat); form.querySelector("#e-lat").value = e.lngLat.lat.toFixed(6); form.querySelector("#e-lng").value = e.lngLat.lng.toFixed(6); });
  }, 0);

  const view = el("<div></div>");
  view.appendChild(adminShell("/admin/issues", main));
  return view;
});

/* duplicates suggestions (simple geo distance + same category) */
route(/^\/admin\/duplicates$/, function adminDuplicates() {
  const issues = DB.allIssues().filter((i) => i.status !== "pending_moderation");
  const pairs = [];
  for (let a = 0; a < issues.length; a++) {
    for (let b = a + 1; b < issues.length; b++) {
      const A = issues[a], B = issues[b];
      if (A.category !== B.category) continue;
      const dist = haversine(A.lat, A.lng, B.lat, B.lng);
      if (dist < 400) pairs.push({ A, B, dist });
    }
  }
  pairs.sort((x, y) => x.dist - y.dist);

  const main = el(`<div class="wrap section">
    <h1>Possible duplicates</h1>
    <p class="muted">Simple rule: same problem type within 400m. Confirm manually before merging.</p>
    ${pairs.length ? `<div class="card" style="padding:0"><div class="table-scroll"><table class="table">
      <thead><tr><th>Case A</th><th>Case B</th><th>Distance</th><th>Type</th><th></th></tr></thead>
      <tbody>${pairs.map((p) => `<tr>
        <td><a href="#/admin/issues/${p.A.id}">${esc(p.A.title)}</a></td>
        <td><a href="#/admin/issues/${p.B.id}">${esc(p.B.title)}</a></td>
        <td>${Math.round(p.dist)} m</td>
        <td>${categoryTag(p.A.category)}</td>
        <td><a class="btn btn-sm btn-ghost" href="#/admin/issues/${p.B.id}">Review →</a></td>
      </tr>`).join("")}</tbody></table></div></div>`
      : `<div class="card"><p class="muted">No likely duplicates found.</p></div>`}
  </div>`);

  const view = el("<div></div>");
  view.appendChild(adminShell("/admin/duplicates", main));
  return view;
});

route(/^\/admin\/export$/, function adminExport() {
  const main = el(`<div class="wrap section" style="max-width:640px">
    <h1>Export data</h1>
    <p class="muted">Download structured case data for STC research and advocacy.</p>
    <div class="card">
      <label class="field">Status filter
        <select id="exp-status"><option value="">All public statuses</option>
          ${Object.keys(STATUSES).filter((s) => STATUSES[s].public).map((s) => `<option value="${s}">${STATUSES[s].label}</option>`).join("")}
        </select></label>
      <label class="field">Type filter
        <select id="exp-cat"><option value="">All types</option>
          ${DB.activeCategories().map((c) => `<option value="${c.slug}">${esc(c.label)}</option>`).join("")}</select></label>
      <div class="row" style="margin-top:8px">
        <button class="btn btn-primary" id="exp-csv">⬇ Export CSV</button>
        <button class="btn btn-ghost" id="exp-geo">⬇ Export GeoJSON</button>
      </div>
      <p class="help" style="margin-top:12px">Reporter emails are never included in exports.</p>
    </div>
  </div>`);

  function filtered() {
    const s = main.querySelector("#exp-status").value;
    const c = main.querySelector("#exp-cat").value;
    return DB.publicIssues().filter((i) => (!s || i.status === s) && (!c || i.category === c));
  }

  main.querySelector("#exp-csv").onclick = () => {
    const rows = filtered();
    const cols = ["id", "title", "category", "status", "support_count", "lat", "lng", "address_text", "affected_users", "created_at", "updated_at"];
    const csv = [cols.join(",")].concat(rows.map((r) =>
      cols.map((c) => {
        let v = c === "affected_users" ? (r.affected_users || []).join("|") : r[c];
        v = v == null ? "" : String(v);
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(",")
    )).join("\n");
    download("street-doctor-export.csv", "text/csv", csv);
  };
  main.querySelector("#exp-geo").onclick = () => {
    const rows = filtered();
    const geo = {
      type: "FeatureCollection",
      features: rows.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lng, r.lat] },
        properties: { id: r.id, title: r.title, category: r.category, status: r.status, support_count: r.support_count, address_text: r.address_text, affected_users: r.affected_users, created_at: r.created_at, updated_at: r.updated_at },
      })),
    };
    download("street-doctor-export.geojson", "application/geo+json", JSON.stringify(geo, null, 2));
  };

  const view = el("<div></div>");
  view.appendChild(adminShell("/admin/export", main));
  return view;
});

/* ============================================================
 * ADMIN — site content / settings
 * ============================================================ */
route(/^\/admin\/settings$/, function adminSettings() {
  const st = DB.settings();
  const main = el(`<div class="wrap section" style="max-width:720px">
    <h1>Site content</h1>
    <p class="muted">Edit the public-facing text and homepage image. Changes apply immediately across the site.</p>
    <div class="card">
      <label class="field">Site name <input type="text" id="s-name" value="${esc(st.site_name)}"></label>
      <label class="field">Hero heading <input type="text" id="s-htitle" value="${esc(st.hero_title)}"></label>
      <label class="field">Hero subtitle <textarea id="s-hsub">${esc(st.hero_subtitle)}</textarea></label>
      <div class="field">Hero background image
        <div class="row" style="align-items:center;margin-top:8px">
          <div id="hero-preview" style="width:120px;height:68px;border-radius:8px;border:1px solid var(--line);background:${st.hero_image ? `url('${st.hero_image}') center/cover` : "#e9f3ef"}"></div>
          <label class="btn btn-ghost btn-sm">Upload image<input type="file" id="s-himg" accept="image/png,image/jpeg,image/webp" class="hidden"></label>
          ${st.hero_image ? `<button class="btn btn-ghost btn-sm" id="s-himg-clear">Remove</button>` : ""}
        </div>
        <div class="help">Stored as a data URL in this prototype. Production would upload to Supabase Storage.</div>
      </div>
      <div class="row">
        <label class="field grow">Stat 1 label <input type="text" id="s-l1" value="${esc(st.stat_total_label)}"></label>
        <label class="field grow">Stat 2 label <input type="text" id="s-l2" value="${esc(st.stat_improved_label)}"></label>
        <label class="field grow">Stat 3 label <input type="text" id="s-l3" value="${esc(st.stat_supporters_label)}"></label>
      </div>
      <label class="field">Footer blurb <textarea id="s-foot">${esc(st.footer_blurb)}</textarea></label>
      <div class="row" style="margin-top:6px">
        <button class="btn btn-primary" id="s-save">Save content</button>
        <button class="btn btn-ghost" id="s-reset">Reset to defaults</button>
      </div>
    </div>
  </div>`);

  let heroImage = st.hero_image;
  main.querySelector("#s-himg").onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast("Max 5MB.");
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1600; let { width, height } = img;
        if (width > max) { height = Math.round(height * max / width); width = max; }
        const cv = document.createElement("canvas"); cv.width = width; cv.height = height;
        cv.getContext("2d").drawImage(img, 0, 0, width, height);
        heroImage = cv.toDataURL("image/jpeg", 0.82);
        main.querySelector("#hero-preview").style.background = `url('${heroImage}') center/cover`;
        toast("Image ready — remember to Save");
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  };
  const clearBtn = main.querySelector("#s-himg-clear");
  if (clearBtn) clearBtn.onclick = () => { heroImage = ""; main.querySelector("#hero-preview").style.background = "#e9f3ef"; toast("Image cleared — remember to Save"); };

  main.querySelector("#s-save").onclick = () => {
    DB.saveSettings({
      site_name: main.querySelector("#s-name").value.trim() || "Street Doctor SG",
      hero_title: main.querySelector("#s-htitle").value.trim(),
      hero_subtitle: main.querySelector("#s-hsub").value.trim(),
      hero_image: heroImage,
      stat_total_label: main.querySelector("#s-l1").value.trim(),
      stat_improved_label: main.querySelector("#s-l2").value.trim(),
      stat_supporters_label: main.querySelector("#s-l3").value.trim(),
      footer_blurb: main.querySelector("#s-foot").value.trim(),
    });
    toast("Content saved"); render();
  };
  main.querySelector("#s-reset").onclick = () => {
    if (!confirm("Reset all site content to defaults?")) return;
    DB.saveSettings(structuredClone(DEFAULT_SETTINGS)); toast("Reset to defaults"); render();
  };

  const view = el("<div></div>");
  view.appendChild(adminShell("/admin/settings", main));
  return view;
});

/* ============================================================
 * ADMIN — categories management
 * ============================================================ */
route(/^\/admin\/categories$/, function adminCategories() {
  const main = el(`<div class="wrap section" style="max-width:720px">
    <h1>Problem categories</h1>
    <p class="muted">Edit labels, toggle visibility, or add new categories. Inactive categories stay on existing cases but can't be picked for new reports.</p>
    <div class="card" style="padding:0"><div class="table-scroll"><table class="table" id="cat-table"></table></div></div>
    <div class="card" style="margin-top:16px">
      <h3>Add a category</h3>
      <div class="row">
        <label class="field grow" style="margin:0">Label <input type="text" id="nc-label" placeholder="e.g. Flooding-prone path"></label>
        <label class="field" style="margin:0;width:90px">Icon <input type="text" id="nc-icon" placeholder="🌊" maxlength="2"></label>
        <label class="field" style="margin:0;width:90px">Colour <input type="text" id="nc-color" value="#666"></label>
      </div>
      <button class="btn btn-primary" id="nc-add" style="margin-top:12px">Add category</button>
    </div>
  </div>`);

  function drawTable() {
    main.querySelector("#cat-table").innerHTML = `
      <thead><tr><th>Label</th><th>Slug</th><th>Active</th><th></th></tr></thead>
      <tbody>${DB.categories().map((c) => `
        <tr>
          <td><span class="dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color};margin-right:6px"></span>
            <input type="text" data-edit="${c.slug}" value="${esc(c.label)}" style="margin:0;width:auto;min-width:200px"></td>
          <td class="muted">${esc(c.slug)}</td>
          <td><button class="btn btn-sm ${c.is_active ? "btn-primary" : "btn-ghost"}" data-toggle="${c.slug}">${c.is_active ? "Active" : "Hidden"}</button></td>
          <td><button class="btn btn-sm btn-ghost" data-save="${c.slug}">Save</button></td>
        </tr>`).join("")}</tbody>`;
    main.querySelectorAll("[data-toggle]").forEach((b) => b.onclick = () => {
      const c = DB.categories().find((x) => x.slug === b.dataset.toggle);
      DB.updateCategory(b.dataset.toggle, { is_active: !c.is_active }); drawTable();
    });
    main.querySelectorAll("[data-save]").forEach((b) => b.onclick = () => {
      const input = main.querySelector(`[data-edit="${b.dataset.save}"]`);
      DB.updateCategory(b.dataset.save, { label: input.value.trim() }); toast("Saved");
    });
  }
  drawTable();

  main.querySelector("#nc-add").onclick = () => {
    const label = main.querySelector("#nc-label").value.trim();
    if (!label) return toast("Enter a label.");
    DB.addCategory({ label, icon: main.querySelector("#nc-icon").value.trim() || "📍", color: main.querySelector("#nc-color").value.trim() || "#666" });
    main.querySelector("#nc-label").value = ""; main.querySelector("#nc-icon").value = "";
    toast("Category added"); drawTable();
  };

  const view = el("<div></div>");
  view.appendChild(adminShell("/admin/categories", main));
  return view;
});

/* ============================================================
 * utils: geo + download
 * ============================================================ */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function download(name, mime, content) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Download started");
}

/* ============================================================
 * boot
 * ============================================================ */
if (!window.location.hash) window.location.hash = "#/";
render();
