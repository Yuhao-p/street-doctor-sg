/* ============================================================
 * build-roads-sg.mjs — full Singapore road network generator
 *
 * Splits Singapore into a 0.05° grid (~5.5 km cells), queries each
 * via Overpass, deduplicates ways/nodes across cell boundaries, then
 * runs the same graph-degree junction model as build-roads.mjs.
 *
 * Highway classes: vehicle roads + cycleway (footways/steps excluded
 * to keep the output manageable; add them back once PMTiles is set up).
 *
 * Usage:
 *   node scripts/build-roads-sg.mjs              # → data/sg-roads.geojson
 *   node scripts/build-roads-sg.mjs out.geojson  # custom output path
 *
 * Resumes automatically from a .cache.json file if interrupted.
 * ============================================================ */

import { writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Drive + cycle (no footway/path/steps — too numerous for full-island GeoJSON)
const INCLUDE = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
  "residential", "living_street", "road",
  "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
  "cycleway",
]);

// Full Singapore bounding box
const SG = { S: 1.1443, W: 103.6050, N: 1.4784, E: 104.0858 };
const CELL = 0.05; // ~5.5 km per side

const OUT   = process.argv[2] || "data/sg-roads.geojson";
const CACHE = OUT + ".cache.json";

/* ---- grid ---- */
function makeCells() {
  const cells = [];
  for (let lat = SG.S; lat < SG.N - 1e-9; lat += CELL) {
    for (let lng = SG.W; lng < SG.E - 1e-9; lng += CELL) {
      cells.push([
        +lat.toFixed(6),
        +lng.toFixed(6),
        +Math.min(lat + CELL, SG.N).toFixed(6),
        +Math.min(lng + CELL, SG.E).toFixed(6),
      ]);
    }
  }
  return cells;
}

/* ---- Overpass fetch with mirror fallback ---- */
async function fetchWithMirrors(query) {
  let lastErr;
  for (const url of OVERPASS) {
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90_000);
      const res   = await fetch(url, {
        method: "POST",
        body:   "data=" + encodeURIComponent(query),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) return res.json();
      lastErr = new Error(`HTTP ${res.status} @ ${url}`);
      console.error(`    ${res.status} from ${url}`);
    } catch (e) {
      lastErr = e;
      console.error(`    mirror error (${url}): ${e.message}`);
    }
  }
  throw lastErr;
}

/* ---- shared state (dedup across cells) ---- */
const allNodes = {};   // osm node id → [lon, lat]
const allWays  = {};   // osm way  id → way element

async function fetchCell([S, W, N, E], label) {
  const q = `[out:json][timeout:60];way(${S},${W},${N},${E})[highway];(._;>;);out;`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const data = await fetchWithMirrors(q);
      let nw = 0, nn = 0;
      for (const el of data.elements) {
        if (el.type === "node" && !allNodes[el.id]) {
          allNodes[el.id] = [el.lon, el.lat];
          nn++;
        }
        if (el.type === "way" && el.nodes && el.tags &&
            INCLUDE.has(el.tags.highway) && !allWays[el.id]) {
          allWays[el.id] = el;
          nw++;
        }
      }
      const totWays = Object.keys(allWays).length;
      console.error(`  ${label} → +${nw} ways / +${nn} nodes  (total ${totWays} ways)`);
      return true;
    } catch (e) {
      console.error(`  ${label} attempt ${attempt} failed: ${e.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 6_000 * attempt));
    }
  }
  console.error(`  ${label} FAILED after 3 attempts — cell skipped`);
  return false;
}

/* ---- graph + segment builder ---- */
const edgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const round6  = (n)     => Math.round(n * 1e6) / 1e6;

function buildSegments() {
  const ways = Object.values(allWays);
  console.error(`\nBuilding graph: ${ways.length} ways, ${Object.keys(allNodes).length} nodes …`);

  const adj = {};
  for (const w of ways) {
    for (let i = 0; i < w.nodes.length - 1; i++) {
      const a = w.nodes[i], b = w.nodes[i + 1];
      if (!allNodes[a] || !allNodes[b]) continue;
      (adj[a] = adj[a] || []).push({ to: b, wayId: w.id });
      (adj[b] = adj[b] || []).push({ to: a, wayId: w.id });
    }
  }

  const degree  = (n) => (adj[n] ? adj[n].length : 0);
  const visited = new Set();
  const chains  = [];

  function walkFrom(a) {
    for (const e0 of adj[a] || []) {
      const k0 = edgeKey(a, e0.to);
      if (visited.has(k0)) continue;
      visited.add(k0);
      const seq = [a, e0.to], wid = e0.wayId;
      let prev = a, cur = e0.to;
      while (degree(cur) === 2) {
        const nx = (adj[cur] || []).find(
          (x) => x.to !== prev && !visited.has(edgeKey(cur, x.to))
        );
        if (!nx) break;
        visited.add(edgeKey(cur, nx.to));
        seq.push(nx.to);
        prev = cur; cur = nx.to;
      }
      chains.push({ seq, wid });
    }
  }

  // 1) start from every junction / dead-end
  for (const n in adj) if (degree(n) !== 2) walkFrom(n);
  // 2) mop up pure degree-2 loops
  for (const n in adj) {
    if (adj[n].some((e) => !visited.has(edgeKey(n, e.to)))) walkFrom(n);
  }

  const wayById = {};
  for (const w of ways) wayById[w.id] = w;

  const features = chains
    .map(({ seq, wid }, idx) => {
      const coords = seq
        .map((n) => allNodes[n])
        .filter(Boolean)
        .map(([x, y]) => [round6(x), round6(y)]);
      if (coords.length < 2) return null;
      const t = (wayById[wid] && wayById[wid].tags) || {};
      return {
        type: "Feature",
        properties: {
          segment_id: idx,
          u:          String(seq[0]),
          v:          String(seq[seq.length - 1]),
          name:       t.name || t.ref || null,
          klass:      t.highway || null,
        },
        geometry: { type: "LineString", coordinates: coords },
      };
    })
    .filter(Boolean);

  return features;
}

/* ---- main ---- */
async function main() {
  const cells = makeCells();
  const rows  = Math.ceil((SG.N - SG.S) / CELL);
  const cols  = Math.ceil((SG.E - SG.W) / CELL);
  console.error(`=== Street Doctor SG — full island road network ===`);
  console.error(`Grid  : ${rows} rows × ${cols} cols = ${cells.length} cells (${CELL}° ≈ 5.5 km/side)`);
  console.error(`Output: ${OUT}`);
  console.error(`Classes: ${[...INCLUDE].join(", ")}\n`);

  // Resume from cache if available
  let startIdx = 0;
  if (existsSync(CACHE)) {
    try {
      const c = JSON.parse(readFileSync(CACHE, "utf8"));
      Object.assign(allNodes, c.nodes);
      Object.assign(allWays,  c.ways);
      startIdx = c.completedCells || 0;
      console.error(`Resuming from cell ${startIdx} / ${cells.length}  (cache: ${Object.keys(allWays).length} ways)\n`);
    } catch (e) {
      console.error(`Cache read failed (${e.message}), starting fresh\n`);
    }
  }

  for (let i = startIdx; i < cells.length; i++) {
    const [S, W, N, E] = cells[i];
    const label = `[${String(i + 1).padStart(2)}/${cells.length}] (${S},${W})→(${N},${E})`;
    console.error(label);
    await fetchCell(cells[i], label);

    // Save progress every 5 cells
    if ((i + 1) % 5 === 0 || i === cells.length - 1) {
      writeFileSync(CACHE, JSON.stringify({ nodes: allNodes, ways: allWays, completedCells: i + 1 }));
      console.error(`  [progress saved — cell ${i + 1}/${cells.length}]`);
    }
  }

  const features = buildSegments();
  console.error(`Segments: ${features.length}`);

  const fc  = { type: "FeatureCollection", features };
  const str = JSON.stringify(fc);
  writeFileSync(OUT, str);
  const mb  = (Buffer.byteLength(str) / 1024 / 1024).toFixed(1);
  console.error(`\n✓  Wrote ${features.length} segments → ${OUT}  (${mb} MB)`);
  console.error(`   Next step: install tippecanoe and run:`);
  console.error(`     tippecanoe -o data/sg-roads.pmtiles -z14 -Z10 --drop-densest-as-needed -l roads ${OUT}`);

  // Clean up cache
  try { unlinkSync(CACHE); } catch {}
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
