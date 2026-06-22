/* ============================================================
 * Street Doctor SG — prototype data layer
 * Constants, seed data, and a tiny localStorage-backed "database".
 * No backend required. See README.md for how this maps to the spec.
 * ============================================================ */

/* ---------- Problem categories (defaults; editable by super admin) ---------- */
const DEFAULT_CATEGORIES = [
  { slug: "missing-sidewalk",     label: "Missing / incomplete sidewalk", color: "#e4572e", icon: "🚶", is_active: true },
  { slug: "unsafe-crossing",      label: "Unsafe street crossing",        color: "#d7263d", icon: "⚠️", is_active: true },
  { slug: "accessibility-barrier",label: "Accessibility barrier",         color: "#8e44ad", icon: "♿", is_active: true },
  { slug: "dangerous-junction",   label: "Dangerous junction",            color: "#c0392b", icon: "🚦", is_active: true },
  { slug: "poor-lighting",        label: "Poor street lighting",          color: "#2c6e91", icon: "💡", is_active: true },
  { slug: "lack-of-cycling",      label: "Lack of cycling infrastructure",color: "#1e824c", icon: "🚲", is_active: true },
  { slug: "footpath-obstruction", label: "Footpath obstruction",          color: "#d79b00", icon: "🚧", is_active: true },
  { slug: "transit-stop-access",  label: "Transit stop access / condition",color: "#0984e3", icon: "🚉", is_active: true },
];

/* ---------- Editable site content (managed in /admin/settings) ---------- */
const DEFAULT_SETTINGS = {
  site_name: "Street Doctor SG",
  hero_title: "Map the street design problems Singapore lives with every day.",
  hero_subtitle: "Report missing footpaths, unsafe crossings and accessibility barriers. We structure the evidence and hand it to STC to advocate with LTA and the authorities.",
  hero_image: "",           // optional data URL / URL; empty = gradient only
  stat_total_label: "Published cases",
  stat_improved_label: "Improved",
  stat_supporters_label: "Resident supports",
  footer_blurb: "A civic street-audit platform by an NTU–NUS student team in collaboration with the Singapore Transport Collective (STC). Not an official government service.",
};

/* ---------- Case statuses (from issues.status check constraint, §7) ---------- */
const STATUSES = {
  pending_moderation:           { label: "Pending moderation",        color: "#9aa0a6", public: false },
  published:                    { label: "Published",                 color: "#1e824c", public: true  },
  duplicate:                    { label: "Duplicate",                 color: "#9aa0a6", public: true  },
  more_info_needed:             { label: "More info needed",          color: "#d79b00", public: false },
  under_stc_review:             { label: "Under STC review",          color: "#2c6e91", public: true  },
  referred_to_official_channel: { label: "Referred to official channel", color: "#6c5ce7", public: true },
  response_received:            { label: "Response received",         color: "#0984e3", public: true  },
  improvement_in_progress:      { label: "Improvement in progress",   color: "#00897b", public: true  },
  improved:                     { label: "Improved",                  color: "#2e7d32", public: true  },
  archived:                     { label: "Archived",                  color: "#757575", public: true  },
  removed:                      { label: "Removed",                   color: "#b00020", public: false }, // taken down after an upheld community flag
};

// Statuses an admin can move a published case through (the tracking lifecycle).
const TRACKING_STATUSES = [
  "under_stc_review", "referred_to_official_channel", "response_received",
  "improvement_in_progress", "improved", "archived",
];

/* ---------- Affected user groups (§4.3 step 5) ---------- */
const AFFECTED_USERS = [
  { id: "pedestrians",      label: "Pedestrians" },
  { id: "wheelchair_users", label: "Wheelchair users" },
  { id: "elderly",          label: "Elderly" },
  { id: "cyclists",         label: "Cyclists" },
  { id: "prams",            label: "Prams / strollers" },
  { id: "visually_impaired",label: "Visually impaired" },
];

/* ---------- Flag reasons (community moderation) ----------
 * Used by the "⚑ Report" flow. These are about content being WRONG or not
 * belonging — not about disagreeing with a case. The UI makes that explicit. */
const FLAG_REASONS = [
  { id: "not_real",          label: "This problem isn't real or doesn't exist" },
  { id: "wrong_location",    label: "Wrong or inaccurate location" },
  { id: "duplicate",         label: "Duplicate of another case" },
  { id: "offensive_or_spam", label: "Offensive, abusive, or spam" },
  { id: "personal_data",     label: "Contains personal data (faces, plates)" },
  { id: "other",             label: "Something else (please explain)" },
];
const flagReasonLabel = (id) => FLAG_REASONS.find((r) => r.id === id)?.label || id;

/* ---------- Seed cases (a few realistic Singapore locations) ---------- */
const SEED_ISSUES = [
  {
    id: "sd-1001",
    category: "missing-sidewalk",
    title: "No footpath along Jalan Kayu before MRT",
    description:
      "A 200m stretch on Jalan Kayu has no continuous footpath, forcing pedestrians onto the road shoulder during peak hours. Especially dangerous near the bus stop.",
    affected_users: ["pedestrians", "elderly", "prams"],
    lng: 103.8721, lat: 1.3935,
    address_text: "Jalan Kayu, near Fernvale",
    asset_type: "street",
    geometry: [[[103.8709, 1.3927], [103.8715, 1.3931], [103.8721, 1.3935], [103.8727, 1.3940], [103.8733, 1.3945]]],
    status: "under_stc_review",
    support_count: 47,
    photos: [],
    created_at: "2026-05-02T09:12:00Z",
    updated_at: "2026-05-20T10:00:00Z",
    email: "resident@example.com",
    status_history: [
      { new_status: "published",        note: "Case published after review.", is_public: true, created_at: "2026-05-03T08:00:00Z" },
      { new_status: "under_stc_review", note: "STC is compiling this into the North-East walkability brief.", is_public: true, created_at: "2026-05-20T10:00:00Z" },
    ],
  },
  {
    id: "sd-1002",
    category: "unsafe-crossing",
    title: "Long wait, no refuge island at Serangoon junction",
    description:
      "The signalised crossing gives only 12 seconds of green for a 4-lane road and has no central refuge. Elderly residents regularly get stranded mid-crossing.",
    affected_users: ["pedestrians", "elderly", "wheelchair_users"],
    lng: 103.8736, lat: 1.3496,
    address_text: "Serangoon Central",
    status: "referred_to_official_channel",
    support_count: 88,
    photos: [],
    created_at: "2026-04-18T14:30:00Z",
    updated_at: "2026-06-01T09:00:00Z",
    email: null,
    status_history: [
      { new_status: "published",                    note: "Published.", is_public: true, created_at: "2026-04-19T08:00:00Z" },
      { new_status: "referred_to_official_channel", note: "Raised with LTA via STC's quarterly submission (ref Q2-2026).", is_public: true, created_at: "2026-06-01T09:00:00Z" },
    ],
  },
  {
    id: "sd-1003",
    category: "accessibility-barrier",
    title: "Kerb ramp missing at Tiong Bahru market",
    description:
      "The north entrance has a 12cm kerb with no ramp, making it impossible for wheelchair users and difficult for trolleys.",
    affected_users: ["wheelchair_users", "elderly", "prams"],
    lng: 103.8316, lat: 1.2853,
    address_text: "Tiong Bahru Market",
    status: "improved",
    support_count: 31,
    photos: [],
    created_at: "2026-02-10T11:00:00Z",
    updated_at: "2026-05-28T16:00:00Z",
    email: null,
    status_history: [
      { new_status: "published",               note: "Published.", is_public: true, created_at: "2026-02-11T08:00:00Z" },
      { new_status: "improvement_in_progress", note: "Town council scheduled kerb works.", is_public: true, created_at: "2026-04-02T08:00:00Z" },
      { new_status: "improved",                note: "Ramp installed and verified on site. Thanks to everyone who supported.", is_public: true, created_at: "2026-05-28T16:00:00Z" },
    ],
  },
  {
    id: "sd-1004",
    category: "dangerous-junction",
    title: "Blind left-turn slip road at Clementi",
    description:
      "Vehicles taking the slip road don't slow down and sightlines are blocked by the railing and planting. Several near-misses with pedestrians crossing to the MRT.",
    affected_users: ["pedestrians", "cyclists"],
    lng: 103.7651, lat: 1.3151,
    address_text: "Clementi Ave 3 / Commonwealth Ave West",
    status: "published",
    support_count: 19,
    photos: [],
    created_at: "2026-06-05T08:00:00Z",
    updated_at: "2026-06-06T08:00:00Z",
    email: null,
    status_history: [
      { new_status: "published", note: "Published.", is_public: true, created_at: "2026-06-06T08:00:00Z" },
    ],
  },
  {
    id: "sd-1005",
    category: "footpath-obstruction",
    title: "Bin centre blocks footpath at Toa Payoh",
    description:
      "An overflowing bin centre routinely spills onto the only footpath, narrowing it to under 0.5m. Wheelchair users have to go onto the carriageway.",
    affected_users: ["pedestrians", "wheelchair_users", "visually_impaired"],
    lng: 103.8470, lat: 1.3329,
    address_text: "Toa Payoh Lorong 4",
    status: "published",
    support_count: 8,
    photos: [],
    created_at: "2026-06-11T19:00:00Z",
    updated_at: "2026-06-12T08:00:00Z",
    email: "watcher@example.com",
    status_history: [
      { new_status: "published", note: "Published.", is_public: true, created_at: "2026-06-12T08:00:00Z" },
    ],
  },
  {
    id: "sd-1008",
    category: "transit-stop-access",
    title: "No sheltered, step-free route from Clementi MRT to bus stop",
    description:
      "Transferring from Clementi MRT to the feeder bus stop means an unsheltered detour with a flight of steps — hard for wheelchair users and miserable in the rain.",
    affected_users: ["pedestrians", "wheelchair_users", "elderly", "prams"],
    lng: 103.7652, lat: 1.3151,
    address_text: "Clementi MRT (EW23)",
    asset_type: "transit",
    transit_ref: "Clementi",
    status: "published",
    support_count: 25,
    photos: [],
    created_at: "2026-06-09T08:00:00Z",
    updated_at: "2026-06-10T08:00:00Z",
    email: null,
    status_history: [
      { new_status: "published", note: "Published.", is_public: true, created_at: "2026-06-10T08:00:00Z" },
    ],
  },
  {
    id: "sd-1006",
    category: "poor-lighting",
    title: "Dark connector path behind Bedok stadium",
    description:
      "The park connector between the stadium and the HDB blocks has several non-functioning lamps, making it unsafe to walk after dusk.",
    affected_users: ["pedestrians", "cyclists"],
    lng: 103.9305, lat: 1.3266,
    address_text: "Bedok Park Connector",
    status: "published",
    support_count: 4,
    photos: [],
    created_at: "2026-06-17T21:30:00Z",
    updated_at: "2026-06-17T21:30:00Z",
    email: "night.walker@example.com",
    status_history: [
      { new_status: "published", note: "Auto-published on submission.", is_public: true, created_at: "2026-06-17T21:30:00Z" },
    ],
  },
  {
    id: "sd-1007",
    category: "lack-of-cycling",
    title: "Cycling lane ends abruptly at Jurong East",
    description:
      "The painted cycling lane simply stops 80m before the junction, dumping cyclists into fast traffic with no transition.",
    affected_users: ["cyclists"],
    lng: 103.7420, lat: 1.3331,
    address_text: "Jurong East Central",
    status: "published",
    support_count: 2,
    photos: [],
    created_at: "2026-06-18T07:10:00Z",
    updated_at: "2026-06-18T07:10:00Z",
    email: null,
    status_history: [
      { new_status: "published", note: "Auto-published on submission.", is_public: true, created_at: "2026-06-18T07:10:00Z" },
    ],
  },
];

/* ---------- Seed community flags (demo the moderation queue) ---------- */
const SEED_FLAGS = [
  {
    id: "fl-2001",
    issue_id: "sd-1005",
    reason: "wrong_location",
    detail: "I walk here daily — the bin centre is one block north, not at this pin.",
    status: "open",
    created_at: "2026-06-19T03:00:00Z",
  },
];

/* ---------- Seed comments (public discussion on a case) ---------- */
const SEED_COMMENTS = [
  { id: "cm-3001", issue_id: "sd-1002", name: "Mdm Tan", body: "My mother nearly got stranded here last week. The green light is far too short.", created_at: "2026-04-20T02:30:00Z" },
  { id: "cm-3002", issue_id: "sd-1002", name: "Daniel", body: "A central refuge island would make a huge difference. Supporting this.", created_at: "2026-04-22T09:05:00Z" },
];

/* ============================================================
 * DB: a thin wrapper over localStorage that mimics the tables.
 * ============================================================ */
const DB = (() => {
  const KEY = "streetdoctor_sg_v1";

  function _load() {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        // backfill fields added in later prototype versions
        if (!s.categories) s.categories = structuredClone(DEFAULT_CATEGORIES);
        if (!s.settings)   s.settings = structuredClone(DEFAULT_SETTINGS);
        else s.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), s.settings);
        if (!s.flags)    s.flags = [];     // community moderation reports
        if (!s.flagged)  s.flagged = {};   // issueId -> true (this browser flagged it)
        if (!s.comments) s.comments = [];  // public discussion threads
        // Moderation gate removed: anything that was awaiting moderation is now
        // auto-published, matching the new "publish first, flag if wrong" model.
        s.issues.forEach((i) => {
          if (i.status === "pending_moderation") {
            i.status = "published";
            (i.status_history = i.status_history || []).push({
              new_status: "published", note: "Auto-published (moderation step removed).",
              is_public: true, created_at: new Date().toISOString(),
            });
          }
        });
        localStorage.setItem(KEY, JSON.stringify(s));
        return s;
      } catch (e) { /* fall through to seed */ }
    }
    const fresh = {
      issues: structuredClone(SEED_ISSUES),
      votes: {},      // issueId -> true (this browser supported it)  ~ §5.2 fingerprint check
      flags: structuredClone(SEED_FLAGS),  // community moderation reports
      flagged: {},    // issueId -> true (this browser flagged it)   ~ dedupe like votes
      comments: structuredClone(SEED_COMMENTS),  // public discussion threads
      admin: false,   // logged-in flag
      categories: structuredClone(DEFAULT_CATEGORIES),
      settings: structuredClone(DEFAULT_SETTINGS),
    };
    localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  }

  let state = _load();
  function _save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  return {
    /* ----- issues ----- */
    allIssues() { return state.issues; },
    publicIssues() {
      return state.issues.filter((i) => STATUSES[i.status]?.public);
    },
    getIssue(id) { return state.issues.find((i) => i.id === id) || null; },

    addIssue(issue) {
      issue.id = "sd-" + Date.now();
      issue.status = "published";        // auto-publish: live on the map immediately
      issue.support_count = 0;
      issue.created_at = new Date().toISOString();
      issue.updated_at = issue.created_at;
      issue.status_history = [
        { new_status: "published", note: "Auto-published on submission.", is_public: true, created_at: issue.created_at },
      ];
      issue.geometry = issue.geometry || null;        // optional highlighted road segment (LineString coords)
      issue.asset_type = issue.asset_type || "street"; // "street" | "transit"
      issue.transit_ref = issue.transit_ref || null;   // station name when asset_type === "transit"
      state.issues.unshift(issue);
      _save();
      return issue;
    },

    updateIssue(id, patch) {
      const it = this.getIssue(id);
      if (!it) return null;
      Object.assign(it, patch, { updated_at: new Date().toISOString() });
      _save();
      return it;
    },

    pushStatus(id, newStatus, note, isPublic) {
      const it = this.getIssue(id);
      if (!it) return null;
      const old = it.status;
      it.status = newStatus;
      it.updated_at = new Date().toISOString();
      it.status_history.push({
        old_status: old, new_status: newStatus,
        note: note || "", is_public: isPublic !== false,
        created_at: it.updated_at,
      });
      _save();
      return it;
    },

    /* ----- votes (support) ----- */
    hasVoted(id) { return !!state.votes[id]; },
    vote(id) {
      if (state.votes[id]) return false;       // dedupe, mimics unique(issue_id, fingerprint)
      const it = this.getIssue(id);
      if (!it || it.status !== "published" && !STATUSES[it.status]?.public) return false;
      state.votes[id] = true;
      it.support_count = (it.support_count || 0) + 1;
      _save();
      return true;
    },

    /* ----- flags (community moderation: anyone can report a bad case) ----- */
    hasFlagged(id) { return !!state.flagged[id]; },
    flagIssue(id, reason, detail) {
      const it = this.getIssue(id);
      if (!it || !STATUSES[it.status]?.public) return null;   // can't flag a non-public case
      if (state.flagged[id]) return null;                     // one report per browser per case
      const flag = {
        id: "fl-" + Date.now(),
        issue_id: id,
        reason: reason || "other",
        detail: (detail || "").trim(),
        status: "open",                                       // open | dismissed | upheld
        created_at: new Date().toISOString(),
      };
      state.flags.push(flag);
      state.flagged[id] = true;
      _save();
      return flag;
    },
    openFlags() { return state.flags.filter((f) => f.status === "open"); },
    flagsForIssue(id) { return state.flags.filter((f) => f.issue_id === id && f.status === "open"); },
    flaggedIssues() {
      const ids = [...new Set(this.openFlags().map((f) => f.issue_id))];
      return ids.map((id) => this.getIssue(id)).filter(Boolean);
    },
    // Resolve every open flag on a case. status: "dismissed" (keep case) | "upheld" (case removed).
    clearFlags(issueId, status) {
      let n = 0;
      const now = new Date().toISOString();
      state.flags.forEach((f) => {
        if (f.issue_id === issueId && f.status === "open") { f.status = status; f.resolved_at = now; n++; }
      });
      if (n) _save();
      return n;
    },

    /* ----- comments (public discussion on a case) ----- */
    commentsForIssue(id) {
      return state.comments
        .filter((c) => c.issue_id === id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));   // oldest first
    },
    addComment(id, name, body) {
      const text = (body || "").trim();
      if (!text) return null;
      const it = this.getIssue(id);
      if (!it || !STATUSES[it.status]?.public) return null;   // only on public cases
      const comment = {
        id: "cm-" + Date.now(),
        issue_id: id,
        name: (name || "").trim().slice(0, 60) || "Anonymous",
        body: text.slice(0, 1000),
        created_at: new Date().toISOString(),
      };
      state.comments.push(comment);
      _save();
      return comment;
    },
    deleteComment(commentId) {
      const i = state.comments.findIndex((c) => c.id === commentId);
      if (i < 0) return false;
      state.comments.splice(i, 1);
      _save();
      return true;
    },

    /* ----- merge (transfer support to the primary case) ----- */
    mergeIssue(dupId, targetId) {
      const dup = this.getIssue(dupId), target = this.getIssue(targetId);
      if (!dup || !target || dupId === targetId) return null;
      const moved = dup.support_count || 0;
      target.support_count = (target.support_count || 0) + moved;
      target.updated_at = new Date().toISOString();
      dup.support_count = 0;
      dup.duplicate_of_issue_id = targetId;
      _save();
      return { moved, targetTitle: target.title };
    },

    /* ----- categories ----- */
    categories() { return state.categories; },
    activeCategories() { return state.categories.filter((c) => c.is_active); },
    addCategory(cat) {
      cat.slug = cat.slug || (cat.label || "category").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (state.categories.some((c) => c.slug === cat.slug)) cat.slug += "-" + Date.now().toString(36);
      state.categories.push(Object.assign({ color: "#666", icon: "📍", is_active: true }, cat));
      _save();
      return cat;
    },
    updateCategory(slug, patch) {
      const c = state.categories.find((x) => x.slug === slug);
      if (c) { Object.assign(c, patch); _save(); }
      return c;
    },

    /* ----- site settings ----- */
    settings() { return state.settings; },
    saveSettings(patch) { Object.assign(state.settings, patch); _save(); return state.settings; },

    /* ----- admin session ----- */
    isAdmin() { return !!state.admin; },
    login(pw) { if (pw === "stc-demo") { state.admin = true; _save(); return true; } return false; },
    logout() { state.admin = false; _save(); },

    /* ----- misc ----- */
    reset() { localStorage.removeItem(KEY); state = _load(); },
    stats() {
      const pub = this.publicIssues();
      return {
        total: pub.length,
        improved: pub.filter((i) => i.status === "improved").length,
        supporters: pub.reduce((s, i) => s + (i.support_count || 0), 0),
        flags: this.openFlags().length,
      };
    },
  };
})();

/* ---------- small lookup helpers ---------- */
const catBySlug = (slug) => DB.categories().find((c) => c.slug === slug);
const transitById = (id) => TRANSIT_STATIONS.find((t) => t.id === id);
// geometry is stored as MultiLineString coords (array of segments). Accept the
// legacy single-LineString shape ([[lng,lat],...]) and wrap it for compatibility.
const normalizeGeom = (g) => (!g || !g.length ? [] : (typeof g[0][0] === "number" ? [g] : g));
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric" });
const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" });
