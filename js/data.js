/* ============================================================
 * Street Doctor SG — data layer
 * Constants + a DB facade backed by Supabase (see js/supabase.js).
 * Issues / comments / votes / flags live in Supabase and are cached
 * in memory; categories & site settings stay client-side for now.
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
  { slug: "pedestrian-comfort",   label: "Uncomfortable walking environment", color: "#16a085", icon: "🌳", is_active: true },
  { slug: "other",                label: "Other issue",                       color: "#607d8b", icon: "❓", is_active: true },
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

/* ============================================================
 * DB: in-memory cache backed by Supabase.
 *  - issues / comments / votes / flags  -> Supabase (shared by everyone)
 *  - categories / site settings         -> localStorage (client-side, not shared yet)
 * Reads are synchronous from the cache. Writes update the cache immediately
 * (optimistic) and persist to Supabase in the background, rolling back on error.
 * Call `await DB.load()` once at startup (and on auth change) before rendering.
 * ============================================================ */
const DB = (() => {
  const cache = { issues: [], comments: [], votes: new Set(), flagged: new Set(), flags: [] };

  // ----- client-side config: categories + site settings (not shared yet) -----
  const CFG_KEY = "streetdoctor_cfg_v1";
  function loadCfg() {
    try {
      const s = JSON.parse(localStorage.getItem(CFG_KEY)) || {};
      const categories = s.categories || structuredClone(DEFAULT_CATEGORIES);
      // append any newly-added default categories the saved config doesn't have yet
      DEFAULT_CATEGORIES.forEach((d) => { if (!categories.some((c) => c.slug === d.slug)) categories.push(structuredClone(d)); });
      return {
        categories,
        settings: Object.assign(structuredClone(DEFAULT_SETTINGS), s.settings || {}),
      };
    } catch (e) {
      return { categories: structuredClone(DEFAULT_CATEGORIES), settings: structuredClone(DEFAULT_SETTINGS) };
    }
  }
  let cfg = loadCfg();
  const saveCfg = () => localStorage.setItem(CFG_KEY, JSON.stringify(cfg));

  // ----- background persistence: run a Supabase write, roll back the cache on failure -----
  function persist(promise, rollback) {
    Promise.resolve(promise).then(({ error }) => {
      if (error) {
        console.error("Supabase write failed:", error);
        if (typeof toast === "function") toast("Couldn't save: " + (error.message || "network error"));
        if (rollback) rollback();
        if (typeof render === "function") render();
      }
    });
  }

  return {
    /* ----- load everything into the cache (startup + on auth change) ----- */
    async load() {
      const uid = (typeof Session !== "undefined" && Session.user) ? Session.user.id : null;
      const [issuesRes, historyRes, commentsRes] = await Promise.all([
        SB.from("issues").select("*").order("created_at", { ascending: false }),
        SB.from("status_history").select("*").order("created_at", { ascending: true }),
        SB.from("comments").select("*").order("created_at", { ascending: true }),
      ]);
      const issues = (issuesRes.data || []).map((i) => ({ ...i, status_history: [] }));
      const byId = Object.fromEntries(issues.map((i) => [i.id, i]));
      (historyRes.data || []).forEach((h) => { const it = byId[h.issue_id]; if (it) it.status_history.push(h); });
      cache.issues = issues;
      cache.comments = (commentsRes.data || []).map((c) => ({ ...c, name: c.author_name || "Anonymous" }));

      cache.votes = new Set();
      cache.flagged = new Set();
      cache.flags = [];
      if (uid) {
        const [v, mf] = await Promise.all([
          SB.from("votes").select("issue_id").eq("user_id", uid),
          SB.from("flags").select("issue_id").eq("user_id", uid),
        ]);
        cache.votes = new Set((v.data || []).map((x) => x.issue_id));
        cache.flagged = new Set((mf.data || []).map((x) => x.issue_id));
      }
      if (typeof Session !== "undefined" && Session.profile && Session.profile.role === "moderator") {
        const f = await SB.from("flags").select("*").eq("status", "open");
        cache.flags = f.data || [];
      }
    },
    reload() { return this.load(); },

    /* ----- issues ----- */
    allIssues() { return cache.issues; },
    publicIssues() { return cache.issues.filter((i) => STATUSES[i.status]?.public); },
    getIssue(id) { return cache.issues.find((i) => i.id === id) || null; },

    addIssue(issue) {
      if (!Session.user) { toast("Please log in to report an issue."); return null; }
      const now = new Date().toISOString();
      const row = {
        id: crypto.randomUUID(),
        user_id: Session.user.id,
        category: issue.category, title: issue.title, description: issue.description,
        affected_users: issue.affected_users || [],
        lng: issue.lng, lat: issue.lat, address_text: issue.address_text || null,
        asset_type: issue.asset_type || "street", transit_ref: issue.transit_ref || null,
        geometry: issue.geometry || null, photos: issue.photos || [],
        status: "published", support_count: 0, created_at: now, updated_at: now,
        status_history: [{ new_status: "published", note: "Auto-published on submission.", is_public: true, created_at: now }],
      };
      cache.issues.unshift(row);
      const { status_history, ...dbRow } = row;
      // The initial "published" history row is created server-side by the
      // issues_initial_history trigger (a normal user can't write history via RLS).
      persist(SB.from("issues").insert(dbRow), () => { cache.issues = cache.issues.filter((i) => i.id !== row.id); });
      return row;
    },

    updateIssue(id, patch) {
      const it = this.getIssue(id);
      if (!it) return null;
      Object.assign(it, patch, { updated_at: new Date().toISOString() });
      const { status_history, ...dbPatch } = patch;
      persist(SB.from("issues").update({ ...dbPatch, updated_at: it.updated_at }).eq("id", id));
      return it;
    },

    pushStatus(id, newStatus, note, isPublic) {
      const it = this.getIssue(id);
      if (!it) return null;
      const old = it.status;
      it.status = newStatus;
      it.updated_at = new Date().toISOString();
      const h = { old_status: old, new_status: newStatus, note: note || "", is_public: isPublic !== false, created_at: it.updated_at };
      it.status_history.push(h);
      persist(SB.from("issues").update({ status: newStatus, updated_at: it.updated_at }).eq("id", id));
      persist(SB.from("status_history").insert({ issue_id: id, old_status: old, new_status: newStatus, note: h.note, is_public: h.is_public }));
      return it;
    },

    /* ----- votes (support) ----- */
    hasVoted(id) { return cache.votes.has(id); },
    vote(id) {
      if (!Session.user) { toast("Please log in to support a case."); return false; }
      if (cache.votes.has(id)) return false;
      const it = this.getIssue(id);
      if (!it || !STATUSES[it.status]?.public) return false;
      cache.votes.add(id);
      it.support_count = (it.support_count || 0) + 1;
      persist(
        SB.from("votes").insert({ issue_id: id, user_id: Session.user.id }),
        () => { cache.votes.delete(id); it.support_count = Math.max((it.support_count || 1) - 1, 0); }
      );
      return true;
    },

    /* ----- flags (community moderation: any logged-in user can report a bad case) ----- */
    hasFlagged(id) { return cache.flagged.has(id); },
    flagIssue(id, reason, detail) {
      if (!Session.user) { toast("Please log in to report a problem."); return null; }
      if (cache.flagged.has(id)) return null;
      const it = this.getIssue(id);
      if (!it || !STATUSES[it.status]?.public) return null;
      const flag = {
        id: crypto.randomUUID(), issue_id: id, user_id: Session.user.id,
        reason: reason || "other", detail: (detail || "").trim(), status: "open",
        created_at: new Date().toISOString(),
      };
      cache.flagged.add(id);
      if (DB.isAdmin()) cache.flags.push(flag);
      persist(
        SB.from("flags").insert({ id: flag.id, issue_id: id, user_id: Session.user.id, reason: flag.reason, detail: flag.detail }),
        () => { cache.flagged.delete(id); cache.flags = cache.flags.filter((f) => f.id !== flag.id); }
      );
      return flag;
    },
    openFlags() { return cache.flags.filter((f) => f.status === "open"); },
    flagsForIssue(id) { return cache.flags.filter((f) => f.issue_id === id && f.status === "open"); },
    flaggedIssues() {
      const ids = [...new Set(this.openFlags().map((f) => f.issue_id))];
      return ids.map((id) => this.getIssue(id)).filter(Boolean);
    },
    // Resolve every open flag on a case. status: "dismissed" (keep case) | "upheld" (case removed).
    clearFlags(issueId, status) {
      let n = 0;
      const now = new Date().toISOString();
      cache.flags.forEach((f) => { if (f.issue_id === issueId && f.status === "open") { f.status = status; f.resolved_at = now; n++; } });
      if (n) persist(SB.from("flags").update({ status, resolved_at: now }).eq("issue_id", issueId).eq("status", "open"));
      return n;
    },

    /* ----- comments (public discussion on a case) ----- */
    commentsForIssue(id) {
      return cache.comments
        .filter((c) => c.issue_id === id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));   // oldest first
    },
    addComment(id, name, body) {
      if (!Session.user) { toast("Please log in to comment."); return null; }
      const text = (body || "").trim();
      if (!text) return null;
      const it = this.getIssue(id);
      if (!it || !STATUSES[it.status]?.public) return null;
      const authorName = Auth.displayName();
      const c = {
        id: crypto.randomUUID(), issue_id: id, user_id: Session.user.id,
        author_name: authorName, name: authorName, body: text.slice(0, 1000),
        created_at: new Date().toISOString(),
      };
      cache.comments.push(c);
      persist(
        SB.from("comments").insert({ id: c.id, issue_id: id, user_id: Session.user.id, author_name: authorName, body: c.body }),
        () => { cache.comments = cache.comments.filter((x) => x.id !== c.id); }
      );
      return c;
    },
    deleteComment(commentId) {
      const i = cache.comments.findIndex((c) => c.id === commentId);
      if (i < 0) return false;
      const removed = cache.comments[i];
      cache.comments.splice(i, 1);
      persist(SB.from("comments").delete().eq("id", commentId), () => { cache.comments.splice(i, 0, removed); });
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
      persist(SB.from("issues").update({ support_count: target.support_count, updated_at: target.updated_at }).eq("id", targetId));
      persist(SB.from("issues").update({ support_count: 0 }).eq("id", dupId));
      return { moved, targetTitle: target.title };
    },

    /* ----- categories (client-side config) ----- */
    categories() { return cfg.categories; },
    activeCategories() { return cfg.categories.filter((c) => c.is_active); },
    addCategory(cat) {
      cat.slug = cat.slug || (cat.label || "category").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (cfg.categories.some((c) => c.slug === cat.slug)) cat.slug += "-" + Date.now().toString(36);
      cfg.categories.push(Object.assign({ color: "#666", icon: "📍", is_active: true }, cat));
      saveCfg();
      return cat;
    },
    updateCategory(slug, patch) {
      const c = cfg.categories.find((x) => x.slug === slug);
      if (c) { Object.assign(c, patch); saveCfg(); }
      return c;
    },

    /* ----- site settings (client-side config) ----- */
    settings() { return cfg.settings; },
    saveSettings(patch) { Object.assign(cfg.settings, patch); saveCfg(); return cfg.settings; },

    /* ----- auth (delegates to Supabase Auth via js/supabase.js) ----- */
    isAdmin() { return typeof Session !== "undefined" && Session.profile && Session.profile.role === "moderator"; },
    currentUser() { return typeof Session !== "undefined" ? Session.user : null; },
    logout() { Auth.signOut(); },

    /* ----- stats ----- */
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
