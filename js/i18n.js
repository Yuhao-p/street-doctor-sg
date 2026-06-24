/* ============================================================
 * Street Doctor SG — lightweight bilingual layer (EN / 简体中文)
 * Loaded before app.js. After each render, app.js calls I18N.apply()
 * which walks the rendered public-site DOM and swaps English UI text
 * for Simplified Chinese. The /admin console and user-written content
 * (report titles/descriptions, comments, addresses) are left as-is.
 * English is the source language, so zh is the only translation table.
 * ============================================================ */
const I18N = (() => {
  const LANG_KEY = "streetdoctor_lang";
  function detect() {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "zh" || saved === "en") return saved;
    return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
  }
  let lang = detect();

  // Exact full-text-node (trimmed) translations: English -> Simplified Chinese
  const EXACT = {
    // nav + footer + chrome
    "Map": "地图",
    "Report an issue": "举报问题",
    "About": "关于",
    "FAQ": "常见问题",
    "Emergency": "紧急情况",
    "Admin": "管理",
    "Log in": "登录",
    "Site": "网站",
    "Legal": "法律",
    "Urgent?": "紧急？",
    "Privacy policy": "隐私政策",
    "Terms of use": "使用条款",
    "Emergency guidance": "紧急情况指引",
    "OneService (municipal)": "OneService（市政）",
    "Police — 999": "警察 — 999",
    "Ambulance / Fire — 995": "救护 / 消防 — 995",
    "Prototype build • shared data via Supabase": "原型版本 • 数据由 Supabase 共享",
    "Menu": "菜单",
    "Close": "关闭",

    // disclaimer banner
    "This is not an official government platform.": "这不是官方政府平台。",
    "It does not replace OneService and is not for emergencies or urgent repairs (potholes, fallen signage, etc.). For immediate danger call":
      "本平台不取代 OneService，也不用于紧急情况或紧急维修（坑洞、倒塌的标志牌等）。如遇即时危险请拨打",
    "; for municipal issues use": "；市政问题请使用",

    // home
    "Map the street design problems Singapore lives with every day.": "标记新加坡日常生活中的街道设计问题。",
    "Report missing footpaths, unsafe crossings and accessibility barriers. We structure the evidence and hand it to STC to advocate with LTA and the authorities.":
      "举报缺失的人行道、不安全的路口和无障碍障碍。我们整理这些证据，交给 STC 向陆路交通管理局（LTA）及相关部门倡议。",
    "＋ Report an issue": "＋ 举报问题",
    "View the map": "查看地图",
    "Published cases": "已发布案件",
    "Improved": "已改善",
    "Resident supports": "居民支持数",
    "Problem types tracked": "追踪的问题类型",
    "How it works": "运作方式",
    "Drop a pin where the problem is.": "在问题所在处标记位置。",
    "Pick a type, describe it, add up to 3 photos.": "选择类型、描述问题，最多加 3 张照片。",
    "It's published on the map straight away — no waiting.": "立即发布到地图上 — 无需等待。",
    "Residents support cases and flag any that are wrong; STC tracks progress with authorities.":
      "居民支持案件并检举有误的内容；STC 与相关部门追踪进度。",
    "Start a report": "开始举报",
    "About this collaboration": "关于这项合作",
    "Read more →": "了解更多 →",

    // map filters + drawer
    "Problem type": "问题类型",
    "Status": "状态",
    "Layers": "图层",
    "🚉 Transit stations": "🚉 公共交通站点",
    "Clear filters": "清除筛选",
    "⚲ Filters": "⚲ 筛选",
    "⌖ Locate me": "⌖ 定位到我",
    "＋ Report": "＋ 举报",
    "Couldn't get your location — check the location permission in your browser.": "无法取得你的位置 — 请检查浏览器的定位权限。",
    "Location isn't available on this device.": "此装置无法使用定位功能。",

    // report panel / form
    "📍 Click the map to set the location (or drag the pin).": "📍 点击地图设定位置（或拖动图钉）。",
    "No location selected yet.": "尚未选择位置。",
    "🛣️ Select road segment(s)": "🛣️ 选择路段",
    "Zoom in and hover a road — it previews in grey. Click to select (turns red); click connected roads to extend, or a red one to remove. Drag the pin to fine-tune.":
      "放大并将鼠标移到道路上 — 会以灰色预览。点击选取（变红色）；点击相连的道路可延伸，点红色路段可移除。拖动图钉可微调。",
    "↶ Undo last": "↶ 撤销上一步",
    "Clear": "清除",
    "Done": "完成",
    "Title": "标题",
    "Short summary": "简短摘要",
    "Description": "描述",
    "What is the problem, when is it worst, who does it affect?": "问题是什么？什么时候最严重？影响了谁？",
    "Who is affected": "受影响的群体",
    "Photos": "照片",
    "(max 3)": "（最多 3 张）",
    "Email": "电邮",
    "(optional)": "（选填）",
    "Submit report": "提交举报",
    "Your report goes live on the public map straight away. Anyone can flag it if something's wrong.":
      "你的举报会立即出现在公开地图上。如有问题，任何人都可以检举。",

    // affected user groups
    "Pedestrians": "行人",
    "Wheelchair users": "轮椅使用者",
    "Elderly": "年长者",
    "Cyclists": "骑行者",
    "Prams / strollers": "婴儿车",
    "Visually impaired": "视障人士",

    // categories (default set)
    "Missing / incomplete sidewalk": "缺失 / 不完整的人行道",
    "Unsafe street crossing": "不安全的过街路口",
    "Accessibility barrier": "无障碍障碍",
    "Dangerous junction": "危险路口",
    "Poor street lighting": "街道照明不足",
    "Lack of cycling infrastructure": "缺乏骑行设施",
    "Footpath obstruction": "人行道阻塞",
    "Transit stop access / condition": "交通站点通达 / 状况",
    "Uncomfortable walking environment": "行人环境不舒适",
    "Other issue": "其他问题",

    // statuses
    "Pending moderation": "待审核",
    "Published": "已发布",
    "Duplicate": "重复",
    "More info needed": "需要更多信息",
    "Under STC review": "STC 审阅中",
    "Referred to official channel": "已转交官方渠道",
    "Response received": "已收到回复",
    "Improvement in progress": "改善进行中",
    "Archived": "已归档",
    "Removed": "已移除",

    // case detail
    "← Back to map": "← 返回地图",
    "Location on map": "地图上的位置",
    "STC updates": "STC 进度更新",
    "No public updates yet.": "暂无公开进度更新。",
    "supports": "个支持",
    "✓ You supported this": "✓ 你已支持",
    "👍 Support this issue": "👍 支持这个问题",
    "🔗 Copy link": "🔗 复制链接",
    "⚑ Report a problem with this case": "⚑ 检举此案件的问题",
    "✓ Reported for review": "✓ 已检举待审",
    "For emergencies or routine repairs, use official channels —": "紧急情况或日常维修请使用官方渠道 —",

    // comments
    "No comments yet. Be the first to add context.": "还没有评论。来第一个补充信息吧。",
    "Add a comment…": "添加评论…",
    "Post comment": "发表评论",

    // flag dialog
    "⚑ Report a problem with this case ": "⚑ 检举此案件的问题",
    "What's wrong?": "哪里有问题？",
    "This problem isn't real or doesn't exist": "这个问题不真实或不存在",
    "Wrong or inaccurate location": "位置错误或不准确",
    "Duplicate of another case": "与另一案件重复",
    "Offensive, abusive, or spam": "冒犯、辱骂或垃圾内容",
    "Contains personal data (faces, plates)": "包含个人资料（人脸、车牌）",
    "Something else (please explain)": "其他（请说明）",
    "Details (optional)": "详情（选填）",
    "Anything that helps a moderator check this.": "任何有助于审核员查证的信息。",
    "Cancel": "取消",

    // report success
    "Report published": "举报已发布",
    "Report another": "再举报一笔",

    // account / login
    "Welcome back.": "欢迎回来。",
    "Create an account": "创建账户",
    "You need an account to report, comment, support or flag.": "你需要账户才能举报、评论、支持或检举。",
    "Name": "姓名",
    "How you'll appear on comments": "你在评论中显示的名称",
    "Password": "密码",
    "At least 6 characters": "至少 6 个字符",
    "Sign up": "注册",
    "Forgot password?": "忘记密码？",
    "Reset your password": "重设密码",
    "We'll email you a link to set a new password.": "我们会寄一封含重设链接的电邮给你。",
    "Send reset link": "发送重设链接",
    "← Back to log in": "← 返回登录",
    "If that email has an account, a reset link is on its way — check your inbox.": "如果该电邮已注册，重设链接即将寄出 — 请查收。",
    "Enter your email.": "请输入电邮。",
    "Set a new password": "设定新密码",
    "Choose a new password for your account.": "为你的账户设定一个新密码。",
    "New password": "新密码",
    "Confirm password": "确认密码",
    "Re-enter password": "再次输入密码",
    "Update password": "更新密码",
    "Password updated": "密码已更新",
    "Updating…": "更新中…",
    "Password must be at least 6 characters.": "密码至少需 6 个字符。",
    "The two passwords don't match.": "两次输入的密码不一致。",
    "Log in to report": "登录后才能举报",
    "You need an account to submit a report. It's quick and free.": "提交举报需要账户，注册快速又免费。",
    "Log in / Sign up": "登录 / 注册",
    "Your account": "你的账户",
    ". STC can reach you through your account if there's an update — no separate email needed.": "。如有进度更新，STC 可通过你的账户与你联系，无需另外提供电邮。",

    // emergency page
    "Emergency & urgent issues": "紧急与急迫情况",

    // inline report-drawer success
    "Thanks! Your report is now": "谢谢！你的举报现已",
    "live on the public map": "实时显示在公开地图上",
    "for everyone to see and support.": "供所有人查看和支持。",
    "View your report": "查看你的举报",

    // duplicate-suggestion panel
    "⚠️ Already reported here?": "⚠️ 这里已经有人举报了吗？",
    "These cases are on the same spot. Adding your support to one carries more weight than a duplicate.":
      "这些案件位于同一地点。支持现有案件比重复举报更有分量。",
    "View details ↗": "查看详情 ↗",
    "👍 Support": "👍 支持",
    "✓ Supported": "✓ 已支持",

    // comments block
    "Discussion": "讨论",
    "Add context or confirm what you've seen here. Be respectful — comments are public.":
      "补充背景，或确认你在现场看到的情况。请保持尊重 — 评论是公开的。",
    "to join the discussion.": "参与讨论。",

    // flag dialog explainer (split around inline <strong>)
    "Use this only for content that is": "仅用于举报",
    "wrong or doesn't belong": "错误或不该出现的内容",
    "— the problem isn't real, the location is wrong, it's a duplicate, or it's offensive / spam. Please":
      "— 问题不真实、位置错误、内容重复，或属冒犯 / 垃圾内容。请",
    "don't": "不要",
    "report a case just because you disagree with it or don't think it's important — use":
      "仅因为你不认同或觉得不重要就检举案件 — 请改用",
    "to show what matters to you instead.": "来表达你在意的事。",

    // toasts
    "Thanks for your support!": "感谢你的支持！",
    "You've already supported this case.": "你已经支持过这个案件了。",
    "Link copied": "链接已复制",
    "Comment posted": "评论已发表",
    "Comment deleted": "评论已删除",
    "Write something first.": "请先输入内容。",
    "Please log in to report an issue.": "请先登录再举报问题。",
    "Please log in to support a case.": "请先登录再支持案件。",
    "Please log in to report a problem.": "请先登录再检举问题。",
    "Please log in to comment.": "请先登录再评论。",
    "Thanks — sent to moderators for review.": "谢谢 — 已送交审核员审阅。",
    "You've already reported this case.": "你已经检举过这个案件了。",
    "Supported — thanks for joining!": "已支持 — 感谢你的参与！",
    "Logged out": "已登出",
    "Welcome back": "欢迎回来",
    "Account created": "账户已创建",
    "Set a location on the map first.": "请先在地图上设定位置。",
    "Pick a problem type.": "请选择问题类型。",
    "A title is required.": "标题为必填。",
    "A description is required.": "描述为必填。",
    "Please accept the privacy & terms.": "请先同意隐私政策与条款。",
    "Please complete the human check.": "请完成人机验证。",
    "Pick a segment connected to your selection": "请选择与你已选路段相连的路段",
    "Enter your email and password.": "请输入电邮和密码。",
    "Working…": "处理中…",
    "Something went wrong. Please try again.": "出了点问题，请再试一次。",
    "Account created — check your email to confirm, then log in.": "账户已创建 — 请查收电邮完成确认后登录。",
  };

  // Substring replacements for text that mixes labels with dynamic/user values.
  const PARTIAL = [
    [/^Step (\d+) of (\d+)$/, "第 $1 步 / 共 $2 步"],
    [/ · Reported /g, " · 举报于 "],
    [/ · Updated /g, " · 更新于 "],
    [/^Log out \((.*)\)$/, "登出（$1）"],
    [/^Posting as $/, "发表身份："],
    [/^You're reporting as $/, "你的举报身份："],
    [/^Step (\d+) of /, "第 $1 步 / 共 "],
  ];

  function translateText(s) {
    // Normalize internal whitespace (HTML often wraps text across lines) so a
    // single-spaced dictionary key matches. A full match replaces the whole node.
    const norm = s.trim().replace(/\s+/g, " ");
    if (EXACT[norm] != null) return EXACT[norm];
    let out = s;
    for (const [re, rep] of PARTIAL) out = out.replace(re, rep);
    return out;
  }

  const ATTRS = ["placeholder", "title", "aria-label"];
  function walk(node) {
    if (node.nodeType === 3) {                                    // text node
      const t = node.nodeValue;
      if (t && t.trim()) { const n = translateText(t); if (n !== t) node.nodeValue = n; }
      return;
    }
    if (node.nodeType !== 1) return;                              // not an element
    if (node.dataset && node.dataset.noi18n !== undefined) return; // user content — skip subtree
    const tag = node.tagName;
    if (tag === "SCRIPT" || tag === "STYLE") return;
    ATTRS.forEach((a) => {
      if (node.hasAttribute(a)) { const v = node.getAttribute(a).trim(); if (EXACT[v] != null) node.setAttribute(a, EXACT[v]); }
    });
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function syncHtmlLang() { document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en"; }

  // Auto-translate dynamically-added DOM (map popups, the report drawer, the
  // flag modal, comment re-renders, toasts) — anything rendered after the
  // initial route render. Our edits change nodeValue (characterData), which
  // doesn't fire childList mutations, so there's no observer loop.
  function startObserver() {
    new MutationObserver((muts) => {
      if (lang !== "zh") return;
      if ((location.hash || "").replace(/^#/, "").startsWith("/admin")) return;
      for (const m of muts) {
        m.addedNodes && m.addedNodes.forEach((n) => {
          if (n.nodeType === 1 || n.nodeType === 3) walk(n);
        });
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver);

  return {
    get lang() { return lang; },
    other() { return lang === "zh" ? "en" : "zh"; },
    set(l) { lang = (l === "zh" ? "zh" : "en"); localStorage.setItem(LANG_KEY, lang); syncHtmlLang(); if (typeof render === "function") render(); },
    // Translate a standalone string (used for toasts, which live outside #app).
    text(s) { return lang === "zh" ? translateText(String(s)) : String(s); },
    // Walk the rendered public-site DOM and translate it in place.
    apply(root) {
      syncHtmlLang();
      if (lang !== "zh") return;                                  // English is the source
      const path = (location.hash || "").replace(/^#/, "");
      if (path.startsWith("/admin")) return;                     // admin console stays English
      walk(root || document.getElementById("app"));
    },
  };
})();
