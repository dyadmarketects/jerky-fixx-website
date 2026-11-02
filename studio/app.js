/* Fixx Studio: plain English site updates for jerkyfixx.com.
   Everything goes to a studio/* branch and a pull request. Nothing goes live until Vince approves it here or on GitHub. */
"use strict";
const CFG = {
  repo: "dyadmarketects/jerky-fixx-website",
  authUrl: "https://studio-auth.jerkyfixx.com", // Cloudflare Worker that signs people in with GitHub (tools/studio-auth-worker.js)
  admins: ["dyadmarketects"],
  cfProject: "jerky-fixx",
  site: "https://jerkyfixx.com"
};
const API = "https://api.github.com";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugify = s => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "change";
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };
let TOKEN = store.get("fixx_token", null), ME = null, IS_ADMIN = false;

/* ---------- little UI helpers ---------- */
function toast(msg, err) { const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), err ? 7000 : 3500); }
function busy(on, msg, pct) { $("#busy").hidden = !on; if (msg) $("#busyMsg").textContent = msg; $("#busyBar").style.width = (pct ?? 0) + "%"; }
const ago = d => { const s = (Date.now() - new Date(d)) / 1000; if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m ago"; if (s < 86400) return Math.floor(s / 3600) + "h ago"; return Math.floor(s / 86400) + "d ago"; };
const previewUrl = ref => "https://" + ref.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 28).replace(/-+$/, "") + "." + CFG.cfProject + ".pages.dev";
function md(s) { // tiny, safe markdown for comments
  let h = esc(s);
  h = h.replace(/```[\s\S]*?```/g, m => "<pre class='diff'>" + m.slice(3, -3) + "</pre>")
    .replace(/^#{1,6} (.*)$/gm, "<b>$1</b>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
    .replace(/^[-*] (.*)$/gm, "<li>$1</li>");
  return h.split(/\n{2,}/).map(p => /^<li>/.test(p) ? "<ul>" + p + "</ul>" : "<p>" + p.replace(/\n/g, "<br>") + "</p>").join("");
}

/* ---------- GitHub ---------- */
async function gh(path, opts = {}) {
  const r = await fetch(path.startsWith("http") ? path : API + path, {
    ...opts, headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + TOKEN, "X-GitHub-Api-Version": "2022-11-28", ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) }
  });
  if (r.status === 401) { signOut(); throw new Error("Your sign in expired. Sign in again."); }
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).message || m; } catch {} throw new Error(m + " (" + r.status + ")"); }
  return r.status === 204 ? null : r.json();
}
const R = () => "/repos/" + CFG.repo;
const b64text = s => btoa(unescape(encodeURIComponent(s)));
const textFromB64 = s => decodeURIComponent(escape(atob(s.replace(/\s/g, ""))));
const fileToB64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(f); });
async function readFile(path, ref = "main") { const j = await gh(`${R()}/contents/${path}?ref=${encodeURIComponent(ref)}`); return textFromB64(j.content); }

/* One commit with any number of files. files: [{path, b64}|{path, text}|{path, del:true}] */
async function commitFiles({ branch, files, message, create = true, base = "main", onProgress }) {
  const from = (await gh(`${R()}/git/ref/heads/${create ? base : branch}`)).object.sha;
  const baseTree = (await gh(`${R()}/git/commits/${from}`)).tree.sha;
  const tree = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress && onProgress(i, files.length, f.path);
    if (f.del) { tree.push({ path: f.path, mode: "100644", type: "blob", sha: null }); continue; }
    const blob = await gh(`${R()}/git/blobs`, { method: "POST", body: JSON.stringify({ content: f.b64 ?? b64text(f.text), encoding: "base64" }) });
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const t = await gh(`${R()}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree }) });
  const c = await gh(`${R()}/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: t.sha, parents: [from] }) });
  if (create) await gh(`${R()}/git/refs`, { method: "POST", body: JSON.stringify({ ref: "refs/heads/" + branch, sha: c.sha }) });
  else await gh(`${R()}/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: c.sha }) });
  return c.sha;
}
const openPR = (branch, title, body) => gh(`${R()}/pulls`, { method: "POST", body: JSON.stringify({ title, head: branch, base: "main", body }) });
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };

/* Resize photos in the browser so uploads stay quick on phones (JPEG, the build turns them into webp). */
function loadImage(file) { return new Promise((ok, no) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("Couldn't read " + file.name)); im.src = u; }); }
async function shrinkPhoto(file, max = 2400) {
  if (!/^image\/(jpeg|png|webp|heic|heif)/i.test(file.type) || file.type === "image/gif" || file.type === "image/svg+xml") return { b64: await fileToB64(file), ext: (file.name.split(".").pop() || "png").toLowerCase() };
  const im = await loadImage(file), k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
  const keepAlpha = file.type === "image/png";
  return { b64: c.toDataURL(keepAlpha ? "image/png" : "image/jpeg", .9).split(",")[1], ext: keepAlpha ? "png" : "jpg" };
}
const safeName = n => n.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file";

/* Send a plain English request: a request file + uploads on a new branch, then a pull request. The workflow hands it to Claude. */
async function sendRequest({ title, kind, where, text, attachments = [], extra = "" }) {
  const id = stamp() + "-" + slugify(title).slice(0, 24), branch = "studio/" + id, files = [], lines = [];
  busy(true, "Packing up your files…", 5);
  for (const a of attachments) {
    if (a.path) { lines.push(`- Existing file \`${a.path}\`${a.note ? ": " + a.note : ""}`); continue; }
    const isImg = a.file.type.startsWith("image/"), base = safeName(a.file.name);
    const out = isImg ? await shrinkPhoto(a.file) : { b64: await fileToB64(a.file), ext: (a.file.name.split(".").pop() || "mp4").toLowerCase() };
    const p = `uploads/${id}/${base}.${out.ext}`;
    files.push({ path: p, b64: out.b64 }); lines.push(`- \`${p}\` (${isImg ? "photo" : "video"})${a.note ? ": " + a.note : ""}`);
  }
  const body = `# ${title}\n\nFrom: ${ME.login} via Fixx Studio\nKind: ${kind}\nWhere: ${where || "anywhere it fits"}\n\n## Request\n\n${text.trim()}\n${extra ? "\n" + extra.trim() + "\n" : ""}\n## Attachments\n\n${lines.join("\n") || "None"}\n`;
  files.unshift({ path: `studio-requests/${id}.md`, text: body });
  await commitFiles({ branch, files, message: "studio request: " + title, onProgress: (i, n, p) => busy(true, "Uploading " + p.split("/").pop() + "…", 10 + 80 * i / n) });
  busy(true, "Handing it to Claude…", 95);
  const pr = await openPR(branch, "✨ " + title, `${text.trim()}\n\n_Sent from Fixx Studio by @${ME.login}. Claude builds it on this branch, then Vince reviews it._`);
  busy(false);
  return pr;
}
/* A direct edit (no AI): files on a new branch + pull request. The workflow rebuilds and posts the preview. */
async function sendEdit({ title, files, body, alsoAsk }) {
  const id = stamp() + "-" + slugify(title).slice(0, 24), branch = "studio/" + id;
  if (alsoAsk) files = [{ path: `studio-requests/${id}.md`, text: `# ${title}\n\nFrom: ${ME.login} via Fixx Studio\nKind: edit\n\n## Request\n\n${alsoAsk}\n\n## Attachments\n\nNone\n` }, ...files];
  await commitFiles({ branch, files, message: (alsoAsk ? "studio request: " : "studio edit: ") + title, onProgress: (i, n, p) => busy(true, "Saving " + p.split("/").pop() + "…", 10 + 80 * i / n) });
  busy(true, "Sending for review…", 95);
  const pr = await openPR(branch, "🛠 " + title, body + `\n\n_Sent from Fixx Studio by @${ME.login}._`);
  busy(false); return pr;
}
function sentScreen(pr, what) {
  view(`<div class="card done"><p class="eyebrow">Sent</p><h1 class="big">It's <em>cooking</em></h1>
    <p class="muted">${esc(what)} Vince gets an email to review it. You'll see the preview link in My requests in a few minutes.</p>
    <div class="row" style="justify-content:center;margin-top:18px"><a class="btn btn-pink" href="#requests/${pr.number}">Track it</a><a class="btn btn-ghost" href="#home">Back home</a></div></div>`);
}

/* ---------- auth ---------- */
function signOut() { store.del("fixx_token"); TOKEN = null; location.hash = ""; location.reload(); }
function showGate(msg) { $("#app").hidden = true; $("#gate").hidden = false; $("#gateMsg").textContent = msg || ""; }
$("#ghLogin").addEventListener("click", () => {
  const w = window.open(CFG.authUrl + "/auth", "fixxauth", "width=620,height=760");
  if (!w) toast("Allow pop ups for this page, then try again.", true);
});
window.addEventListener("message", e => {
  if (e.origin !== new URL(CFG.authUrl).origin || !e.data || e.data.type !== "fixx-auth") return;
  if (e.data.error) return showGate("GitHub said: " + e.data.error);
  TOKEN = e.data.token; store.set("fixx_token", TOKEN); boot();
});
$("#tokenForm").addEventListener("submit", e => { e.preventDefault(); const t = $("#tokenIn").value.trim(); if (t) { TOKEN = t; store.set("fixx_token", t); boot(); } });
document.addEventListener("click", e => { if (e.target.closest(".signout")) signOut(); });

async function boot() {
  if (!TOKEN) return showGate();
  try {
    ME = await gh("/user");
    const repo = await gh(R());
    if (!repo.permissions || !repo.permissions.push) { store.del("fixx_token"); return showGate(`Hey ${ME.login}, you're signed in but don't have access to the site yet. Ask Vince to add you.`); }
  } catch (err) { store.del("fixx_token"); TOKEN = null; return showGate(err.message); }
  IS_ADMIN = CFG.admins.includes(ME.login.toLowerCase()) || CFG.admins.includes(ME.login);
  document.body.classList.toggle("is-admin", IS_ADMIN);
  $("#gate").hidden = true; $("#app").hidden = false;
  $("#me").innerHTML = `<img src="${esc(ME.avatar_url)}" alt=""><div><b>${esc(ME.name || ME.login)}</b><button class="signout" type="button">Sign out</button></div>`;
  route(); refreshReviewCount();
}
async function refreshReviewCount() {
  if (!IS_ADMIN) return;
  try { const n = (await studioPRs("open")).length; const b = $("#revCount"); b.textContent = n; b.hidden = !n; } catch {}
}

/* ---------- router ---------- */
const VIEWS = {};
function view(html) { const v = $("#view"); v.innerHTML = html; v.focus({ preventScroll: true }); window.scrollTo(0, 0); }
function route() {
  const [name, arg] = (location.hash.slice(1) || "home").split("/");
  $$("[data-v]").forEach(a => a.classList.toggle("on", a.dataset.v === name));
  $("#sheet").hidden = true;
  (VIEWS[name] || VIEWS.home)(arg);
}
window.addEventListener("hashchange", () => { if (ME) route(); });
$("#moreBtn").addEventListener("click", () => ($("#sheet").hidden = !$("#sheet").hidden));
$("#sheet").addEventListener("click", e => { if (e.target.id === "sheet") $("#sheet").hidden = true; });

/* ---------- pull request data ---------- */
async function studioPRs(state = "all") {
  const list = await gh(`${R()}/pulls?state=${state}&per_page=50&sort=created&direction=desc`);
  return list.filter(p => p.head.ref.startsWith("studio/"));
}
async function prStatus(p) {
  if (p.merged_at) return ["live", "Live"];
  if (p.state === "closed") return ["closed", "Not used"];
  const cs = await gh(`${R()}/issues/${p.number}/comments?per_page=100`);
  const bots = cs.filter(c => c.user.type === "Bot" || /Ready for review|Claude is working/.test(c.body));
  const last = bots[bots.length - 1];
  if (last && /Ready for review/.test(last.body)) return ["ready", "Ready for review"];
  if (last && /Claude is working/.test(last.body)) return ["cooking", "Cooking"];
  return ["waiting", "Getting set up"];
}

/* ---------- HOME ---------- */
VIEWS.home = async () => {
  const first = (ME.name || ME.login).split(" ")[0];
  view(`<section class="hero"><p class="eyebrow" style="color:#fff">Fixx Studio</p><h1 class="big">What are we<br>cooking, ${esc(first)}?</h1>
    <p>Tell the site what to do in plain English. Swap photos, drop a new flavor, build a whole page. You see a private preview first, then Vince gives it the green light.</p>
    <a class="btn btn-pink btn-xl" href="#ask" style="box-shadow:5px 5px 0 var(--ink)">✦ Ask for a change</a></section>
    <div class="tiles">
      <a class="tile" href="#flavors"><i>🌶</i><b>Flavors &amp; prices</b><span>Names, heat, descriptions, bag prices</span></a>
      <a class="tile" href="#photos"><i>▣</i><b>Catalog photos</b><span>Swap any flavor photo</span></a>
      <a class="tile" href="#media"><i>⬆</i><b>Media library</b><span>Upload photos and videos</span></a>
      <a class="tile" href="#page"><i>✎</i><b>Design a page</b><span>Build a new page block by block</span></a>
      <a class="tile" href="#blog"><i>✍</i><b>Blog post</b><span>Write it, we polish it</span></a>
      <a class="tile" href="#brand"><i>★</i><b>Brand kit</b><span>Logos, colors and fonts</span></a>
    </div>
    <div class="card" style="margin-top:20px"><div class="row" style="justify-content:space-between"><h2 class="h2">Latest <em>requests</em></h2><a href="#requests" class="small">See all</a></div><div class="reqs" id="homeReqs" style="margin-top:12px"><p class="muted">Loading…</p></div></div>`);
  try { $("#homeReqs").innerHTML = await reqRows((await studioPRs()).slice(0, 4)) || `<div class="empty">Nothing yet. Your first change is one sentence away.</div>`; }
  catch (e) { $("#homeReqs").innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
};
async function reqRows(prs) {
  const st = await Promise.all(prs.map(prStatus));
  return prs.map((p, i) => `<a class="req" href="#${IS_ADMIN && st[i][0] !== "live" && st[i][0] !== "closed" ? "review" : "requests"}/${p.number}"><b>${esc(p.title.replace(/^[✨🛠]\s*/u, ""))}</b><span class="status st-${st[i][0]}">${st[i][1]}</span><small>${esc(p.user.login)} · ${ago(p.created_at)}</small></a>`).join("");
}

/* ---------- ASK ---------- */
const IDEAS = [
  ["Swap a photo", "Swap the photo in the ___ section for the one I attached."],
  ["Add an event", "Add our next event: ___ at ___ on ___. Put it on the dealer locator and the home page."],
  ["Change some text", "On the ___ page, change the part that says \"___\" to say \"___\"."],
  ["New flavor", "We have a new flavor called ___. Heat level ___ out of 5. It tastes like ___. Add it to the menu and use the attached photo."],
  ["Post a video", "Add the attached video to the ___ section with the caption \"___\"."],
  ["Announcement", "Put a bold announcement at the top of the home page that says \"___\" for the next ___ days."]
];
const PAGES = ["Home page", "Jerky menu", "Our story", "The lab", "Dealer locator", "VIP club", "Contact", "FAQ", "Blog", "Footer or menu", "Everywhere", "A new page"];
let askFiles = [];
VIEWS.ask = () => {
  view(`<div class="vhead"><p class="eyebrow">Plain English</p><h1 class="h1">Ask for a <em>change</em></h1><p>Say it like you'd text it. Be as specific or as loose as you want. Attach photos or videos and say where they go.</p></div>
  <div class="card">
    <label class="lbl" for="askText">What do you want?</label>
    <div class="ideas">${IDEAS.map((x, i) => `<button class="chip" type="button" data-idea="${i}">${x[0]}</button>`).join("")}</div>
    <textarea id="askText" rows="6" placeholder="Make the Hot Mamma Cheeto card glow red on the menu, and swap the family photo on Our Story for the one I attached."></textarea>
    <div class="grid2"><div><label class="lbl" for="askWhere">Where on the site?</label><select id="askWhere"><option value="">Wherever it fits</option>${PAGES.map(p => `<option>${p}</option>`).join("")}</select></div>
    <div><label class="lbl" for="askTitle">Short name (optional)</label><input id="askTitle" placeholder="New photo on Our Story"></div></div>
    <div class="drop" id="drop" tabindex="0" role="button"><b>Drop photos or videos</b><span class="muted small">or tap to pick. Add a note on each one so we know where it goes.</span><input type="file" id="askPick" accept="image/*,video/*" multiple hidden></div>
    <div class="files" id="askList"></div>
  </div>
  <div class="sendbar"><span class="muted small" id="askHint">Nothing goes live until it's approved.</span><button class="btn btn-pink" id="askSend" type="button">Cook it 🔥</button></div>`);
  const ta = $("#askText"); ta.value = store.get("fixx_draft", ""); ta.addEventListener("input", () => store.set("fixx_draft", ta.value));
  $$("[data-idea]").forEach(b => b.addEventListener("click", () => { ta.value = IDEAS[b.dataset.idea][1]; ta.focus(); const i = ta.value.indexOf("___"); ta.setSelectionRange(i, i + 3); }));
  wireDrop($("#drop"), $("#askPick"), fs => { askFiles.push(...fs.map(file => ({ file, note: "" }))); drawFiles(); });
  drawFiles();
  $("#askSend").addEventListener("click", async () => {
    const text = ta.value.trim(); if (text.length < 6) return toast("Tell us what you want first.", true);
    const title = $("#askTitle").value.trim() || text.split(/[.!?\n]/)[0].slice(0, 60);
    $$(".file input", $("#askList")).forEach((inp, i) => askFiles[i].note = inp.value.trim());
    try { const pr = await sendRequest({ title, kind: "ask", where: $("#askWhere").value, text, attachments: askFiles }); askFiles = []; store.del("fixx_draft"); sentScreen(pr, "Claude is building your change on a private copy of the site."); }
    catch (e) { busy(false); toast(e.message, true); }
  });
};
function drawFiles() {
  const box = $("#askList"); if (!box) return;
  box.innerHTML = askFiles.map((a, i) => {
    const media = a.path ? (/\.(mp4|webm|mov)$/i.test(a.path) ? `<video src="${CFG.site}/${esc(a.path)}" muted></video>` : `<img src="${CFG.site}/${esc(a.path)}" alt="">`)
      : a.file.type.startsWith("video/") ? `<video src="${URL.createObjectURL(a.file)}" muted playsinline></video>` : `<img src="${URL.createObjectURL(a.file)}" alt="">`;
    return `<div class="file">${media}<span class="tag">${a.path ? "library" : a.file.type.startsWith("video/") ? "video" : "photo"}</span><button class="x" type="button" data-x="${i}" aria-label="Remove">✕</button><input value="${esc(a.note)}" placeholder="Where does this go?"></div>`;
  }).join("");
  $$("[data-x]", box).forEach(b => b.addEventListener("click", () => { askFiles.splice(+b.dataset.x, 1); drawFiles(); }));
  $$("input", box).forEach((inp, i) => inp.addEventListener("input", () => (askFiles[i].note = inp.value)));
}
function wireDrop(zone, input, onFiles) {
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  input.addEventListener("change", () => { onFiles(checkSizes([...input.files])); input.value = ""; });
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", e => { e.preventDefault(); zone.classList.remove("over"); onFiles(checkSizes([...e.dataTransfer.files].filter(f => /^(image|video)\//.test(f.type)))); });
}
function checkSizes(fs) {
  return fs.filter(f => { if (f.size > 95e6) { toast(f.name + " is over 95 MB. Trim it or send a shorter clip.", true); return false; } if (f.size > 40e6) toast(f.name + " is big, so it may take a minute to upload."); return true; });
}

/* ---------- FLAVORS & PRICES ---------- */
let FL = null, FL0 = null;
VIEWS.flavors = async () => {
  view(`<div class="vhead"><p class="eyebrow">The menu</p><h1 class="h1">Flavors <em>&amp; prices</em></h1><p>Edit names, heat, descriptions and bag prices. Add or retire flavors. The menu, cart, order form and Google listing all update together.</p></div><div id="flBox"><p class="muted">Loading the menu…</p></div>`);
  try { const j = JSON.parse(await readFile("data/flavors.json")); FL0 = JSON.stringify(j); FL = j; drawFlavors(); }
  catch (e) { $("#flBox").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
};
const HEAT = ["No heat", "Mild", "Warm", "Medium", "Hot", "X-Hot"];
function drawFlavors() {
  const orig = JSON.parse(FL0), byName = Object.fromEntries(orig.flavors.map(f => [f.name, JSON.stringify(f)]));
  $("#flBox").innerHTML = `<div class="card"><h2 class="h2">Bag <em>prices</em></h2><div class="prices" style="margin-top:12px">
      <div><label class="lbl" for="pS">Small bag</label><div class="money"><span>$</span><input id="pS" type="number" min="1" step="0.5" inputmode="decimal" value="${FL.prices.Small}"></div></div>
      <div><label class="lbl" for="pL">Large bag</label><div class="money"><span>$</span><input id="pL" type="number" min="1" step="0.5" inputmode="decimal" value="${FL.prices.Large}"></div></div></div></div>
    <div class="row" style="justify-content:space-between;margin:22px 0 10px"><h2 class="h2">${FL.flavors.length} <em>flavors</em></h2><button class="btn btn-purple btn-sm" id="flAdd" type="button">+ Add a flavor</button></div>
    <div class="fl">${FL.flavors.map((f, i) => {
      const st = !byName[f.name] ? "new" : byName[f.name] !== JSON.stringify(f) ? "changed" : "";
      const img = f.photo || `/img/flavors/${slugify(f.name)}.webp`;
      return `<div class="fl-item ${st}" data-i="${i}"><img src="${CFG.site}${esc(img)}" alt="" onerror="this.style.visibility='hidden'">
        <div><input data-k="name" value="${esc(f.name)}" aria-label="Flavor name">
          <div class="heat" role="group" aria-label="Heat">${[0, 1, 2, 3, 4, 5].map(h => `<button type="button" data-h="${h}" class="${h <= f.heat && (h > 0 || f.heat === 0) ? "on" : ""}" title="${HEAT[h]}">${h ? "🌶" : "○"}</button>`).join("")}<small>${HEAT[f.heat]}</small></div>
          <textarea data-k="description" aria-label="Description">${esc(f.description)}</textarea>
          <label class="toggle"><input type="checkbox" data-k="top_seller" ${f.top_seller ? "checked" : ""}> Top seller tag</label></div>
        <div class="fl-tools"><button type="button" data-m="-1" aria-label="Move up">↑</button><button type="button" data-m="1" aria-label="Move down">↓</button><button type="button" data-del aria-label="Remove flavor">🗑</button></div></div>`;
    }).join("")}</div>
    <div class="sendbar"><span class="muted small" id="flSum"></span><button class="btn btn-pink" id="flSend" type="button">Send for review</button></div>`;
  $("#pS").addEventListener("input", e => { FL.prices.Small = +e.target.value; sumFlavors(); });
  $("#pL").addEventListener("input", e => { FL.prices.Large = +e.target.value; sumFlavors(); });
  $("#flAdd").addEventListener("click", () => { FL.flavors.unshift({ name: "New Flavor", heat: 2, description: "Tell people what it tastes like.", top_seller: false, photo: "" }); drawFlavors(); $(".fl-item input").select(); });
  $$(".fl-item").forEach(el => {
    const f = FL.flavors[+el.dataset.i];
    $$("[data-k]", el).forEach(inp => inp.addEventListener("input", () => { f[inp.dataset.k] = inp.type === "checkbox" ? inp.checked : inp.value; el.classList.add("changed"); sumFlavors(); }));
    $$("[data-h]", el).forEach(b => b.addEventListener("click", () => { f.heat = +b.dataset.h; drawFlavors(); }));
    $$("[data-m]", el).forEach(b => b.addEventListener("click", () => { const i = +el.dataset.i, j = i + +b.dataset.m; if (j < 0 || j >= FL.flavors.length) return; [FL.flavors[i], FL.flavors[j]] = [FL.flavors[j], FL.flavors[i]]; drawFlavors(); }));
    $("[data-del]", el).addEventListener("click", () => { if (confirm(`Remove ${f.name} from the menu?`)) { FL.flavors.splice(+el.dataset.i, 1); drawFlavors(); } });
  });
  sumFlavors();
  $("#flSend").addEventListener("click", sendFlavors);
}
function flavorChanges() {
  const a = JSON.parse(FL0), out = [], an = a.flavors.map(f => f.name), bn = FL.flavors.map(f => f.name);
  bn.filter(n => !an.includes(n)).forEach(n => out.push("added " + n));
  an.filter(n => !bn.includes(n)).forEach(n => out.push("removed " + n));
  FL.flavors.forEach(f => { const o = a.flavors.find(x => x.name === f.name); if (o && JSON.stringify(o) !== JSON.stringify(f)) out.push("updated " + f.name); });
  if (a.prices.Small !== FL.prices.Small) out.push(`small bag $${a.prices.Small} → $${FL.prices.Small}`);
  if (a.prices.Large !== FL.prices.Large) out.push(`large bag $${a.prices.Large} → $${FL.prices.Large}`);
  if (!out.length && an.join() !== bn.join()) out.push("new menu order");
  return out;
}
function sumFlavors() { const c = flavorChanges(); $("#flSum").textContent = c.length ? c.length + " change" + (c.length > 1 ? "s" : "") + ": " + c.slice(0, 3).join(", ") + (c.length > 3 ? "…" : "") : "No changes yet"; $("#flSend").disabled = !c.length; }
async function sendFlavors() {
  const c = flavorChanges(), a = JSON.parse(FL0);
  if (FL.flavors.some(f => !f.name.trim())) return toast("Every flavor needs a name.", true);
  const countOrPrice = a.flavors.length !== FL.flavors.length || a.prices.Small !== FL.prices.Small || a.prices.Large !== FL.prices.Large || c.some(x => x.startsWith("added"));
  const ask = countOrPrice ? "data/flavors.json was just updated (" + c.join("; ") + "). Update any page text, FAQ answers, blog index copy, llms.txt and meta descriptions that mention the number of flavors or the bag prices so they match. For any newly added flavor with no photo in img/flavors, leave it (the menu shows a placeholder)." : "";
  try { busy(true, "Saving the menu…", 10); const pr = await sendEdit({ title: "Menu: " + c.slice(0, 3).join(", ").slice(0, 70), files: [{ path: "data/flavors.json", text: JSON.stringify(FL, null, 2) + "\n" }], body: "Menu changes:\n" + c.map(x => "- " + x).join("\n"), alsoAsk: ask }); sentScreen(pr, countOrPrice ? "The menu is updated, and Claude is fixing any text that mentions the flavor count or prices." : "The menu change is on a private preview."); }
  catch (e) { busy(false); toast(e.message, true); }
}

/* ---------- CATALOG PHOTOS ---------- */
let STAGED = {};
VIEWS.photos = async () => {
  view(`<div class="vhead"><p class="eyebrow">The jerky catalog</p><h1 class="h1">Catalog <em>photos</em></h1><p>Tap a flavor to swap its photo. Drag and zoom to frame it. These are the round flavor photos on the menu (the 3D top sellers stay as they are).</p></div><div id="phBox"><p class="muted">Loading…</p></div>`);
  try { if (!FL) { const j = JSON.parse(await readFile("data/flavors.json")); FL0 = JSON.stringify(j); FL = j; } drawPhotos(); } catch (e) { $("#phBox").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
};
function drawPhotos() {
  const n = Object.keys(STAGED).length;
  $("#phBox").innerHTML = `<div class="pgrid">${JSON.parse(FL0).flavors.map(f => { const s = slugify(f.name), st = STAGED[s]; return `<button class="pcell ${st ? "staged" : ""}" type="button" data-s="${s}" data-n="${esc(f.name)}">${st ? '<span class="tag">NEW</span>' : ""}<img src="${st ? st.url : CFG.site + esc(f.photo || "/img/flavors/" + s + ".webp")}" alt=""><b>${esc(f.name)}</b></button>`; }).join("")}</div>
    <div class="sendbar"><span class="muted small">${n ? n + " new photo" + (n > 1 ? "s" : "") + " ready" : "Pick a flavor to start"}</span><div class="row">${n ? '<button class="btn btn-ghost btn-sm" id="phClear" type="button">Undo all</button>' : ""}<button class="btn btn-pink" id="phSend" type="button" ${n ? "" : "disabled"}>Send for review</button></div></div>`;
  $$(".pcell").forEach(b => b.addEventListener("click", () => pickFlavorPhoto(b.dataset.s, b.dataset.n)));
  $("#phClear") && $("#phClear").addEventListener("click", () => { STAGED = {}; drawPhotos(); });
  $("#phSend").addEventListener("click", async () => {
    const names = Object.values(STAGED).map(x => x.name);
    try { busy(true, "Uploading photos…", 5); const pr = await sendEdit({ title: "New catalog photos: " + names.join(", ").slice(0, 60), files: Object.entries(STAGED).map(([s, x]) => ({ path: `img/flavors/${s}.jpg`, b64: x.b64 })), body: "New flavor photos for: " + names.join(", ") }); STAGED = {}; sentScreen(pr, "Your new photos are on a private preview."); }
    catch (e) { busy(false); toast(e.message, true); }
  });
}
function pickFlavorPhoto(slug, name) {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { cropper(await loadImage(f), name, (b64, url) => { STAGED[slug] = { b64, url, name }; drawPhotos(); }); } catch (e) { toast(e.message, true); } };
  inp.click();
}
function cropper(im, name, done) {
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = `<div class="modal-in"><p class="eyebrow">${esc(name)}</p><h2 class="h2">Frame <em>it</em></h2><p class="muted small">Drag to move. Slide to zoom.</p><div class="cropper"><canvas width="600" height="600"></canvas><input type="range" min="1" max="3" step="0.01" value="1" aria-label="Zoom"></div><div class="actions" style="justify-content:flex-end"><button class="btn btn-ghost" data-c type="button">Cancel</button><button class="btn btn-pink" data-ok type="button">Use photo</button></div></div>`;
  document.body.appendChild(m);
  const cv = $("canvas", m), cx = cv.getContext("2d"), zoom = $("input", m);
  const base = 600 / Math.min(im.naturalWidth, im.naturalHeight); let z = 1, ox = 0, oy = 0, drag = null;
  function draw() { const s = base * z, w = im.naturalWidth * s, h = im.naturalHeight * s; ox = Math.min(0, Math.max(600 - w, ox)); oy = Math.min(0, Math.max(600 - h, oy)); cx.fillStyle = "#111"; cx.fillRect(0, 0, 600, 600); cx.drawImage(im, ox, oy, w, h); }
  ox = (600 - im.naturalWidth * base) / 2; oy = (600 - im.naturalHeight * base) / 2; draw();
  zoom.addEventListener("input", () => { const c = 300, k = +zoom.value / z; ox = c - (c - ox) * k; oy = c - (c - oy) * k; z = +zoom.value; draw(); });
  cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, ox, oy]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => { if (!drag) return; const k = 600 / cv.getBoundingClientRect().width; ox = drag[2] + (e.clientX - drag[0]) * k; oy = drag[3] + (e.clientY - drag[1]) * k; draw(); });
  cv.addEventListener("pointerup", () => (drag = null));
  $("[data-c]", m).onclick = () => m.remove();
  $("[data-ok]", m).onclick = () => { const url = cv.toDataURL("image/jpeg", .9); done(url.split(",")[1], url); m.remove(); };
}

/* ---------- MEDIA LIBRARY ---------- */
let LIB = null, libFilter = "uploads";
VIEWS.media = async () => {
  view(`<div class="vhead"><p class="eyebrow">Your stuff</p><h1 class="h1">Media <em>library</em></h1><p>Upload photos and videos to use anywhere on the site, or browse everything that's already up there. Tap "Use" to attach something to a request.</p></div>
  <div class="card"><div class="drop" id="mDrop" tabindex="0" role="button"><b>Upload photos or videos</b><span class="muted small">Photos get optimized for the web automatically.</span><input type="file" id="mPick" accept="image/*,video/*" multiple hidden></div><div class="files" id="mList"></div>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn btn-pink" id="mSend" type="button" disabled>Upload to the site</button></div></div>
  <div class="filters">${["uploads", "photos", "flavors", "videos", "all"].map(f => `<button class="chip ${f === libFilter ? "on" : ""}" type="button" data-f="${f}">${f}</button>`).join("")}</div><div class="lib" id="lib"><p class="muted">Loading…</p></div>`);
  let mf = [];
  const draw = () => { $("#mList").innerHTML = mf.map((f, i) => `<div class="file">${f.type.startsWith("video/") ? `<video src="${URL.createObjectURL(f)}" muted></video>` : `<img src="${URL.createObjectURL(f)}" alt="">`}<button class="x" type="button" data-x="${i}">✕</button></div>`).join(""); $$("[data-x]", $("#mList")).forEach(b => b.onclick = () => { mf.splice(+b.dataset.x, 1); draw(); }); $("#mSend").disabled = !mf.length; };
  wireDrop($("#mDrop"), $("#mPick"), fs => { mf.push(...fs); draw(); });
  $("#mSend").addEventListener("click", async () => {
    try {
      busy(true, "Optimizing…", 5); const files = [];
      for (const f of mf) { if (f.type.startsWith("image/")) { const o = await shrinkPhoto(f); files.push({ path: `img/uploads/${safeName(f.name)}.${o.ext}`, b64: o.b64 }); } else files.push({ path: `vid/uploads/${safeName(f.name)}.${(f.name.split(".").pop() || "mp4").toLowerCase()}`, b64: await fileToB64(f) }); }
      const pr = await sendEdit({ title: `Upload ${files.length} file${files.length > 1 ? "s" : ""} to the media library`, files, body: files.map(f => "- " + f.path).join("\n") });
      sentScreen(pr, "Once Vince approves, your files are in the library and ready to use.");
    } catch (e) { busy(false); toast(e.message, true); }
  });
  $$("[data-f]").forEach(b => b.addEventListener("click", () => { libFilter = b.dataset.f; $$("[data-f]").forEach(x => x.classList.toggle("on", x === b)); drawLib(); }));
  try { if (!LIB) LIB = (await gh(`${R()}/git/trees/main?recursive=1`)).tree.filter(t => t.type === "blob" && /^(img|vid)\//.test(t.path) && /\.(webp|jpe?g|png|gif|svg|mp4|webm)$/i.test(t.path) && !/favicon/.test(t.path)); drawLib(); }
  catch (e) { $("#lib").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
};
function drawLib() {
  const f = { uploads: p => /\/uploads\//.test(p), photos: p => /^img\//.test(p) && !/^img\/(flavors|family)\//.test(p), flavors: p => /^img\/flavors\//.test(p), videos: p => /^vid\//.test(p), all: () => true }[libFilter];
  const items = LIB.filter(t => f(t.path));
  $("#lib").innerHTML = items.length ? items.map(t => { const u = CFG.site + "/" + t.path, v = /\.(mp4|webm)$/i.test(t.path); return `<figure>${v ? `<video src="${u}" muted preload="metadata"></video>` : `<img src="${u}" alt="" loading="lazy">`}<figcaption><span>${esc(t.path.split("/").pop())}</span><button type="button" data-use="${esc(t.path)}">Use</button></figcaption></figure>`; }).join("") : `<div class="empty">Nothing here yet.</div>`;
  $$("[data-use]").forEach(b => b.addEventListener("click", () => { askFiles.push({ path: b.dataset.use, note: "" }); toast("Added to your next request"); location.hash = "#ask"; }));
}

/* ---------- DESIGN A PAGE ---------- */
const BLOCKS = {
  text: { label: "Text", fields: [["eyebrow", "Small label"], ["heading", "Heading"], ["highlight", "Highlight word(s)"], ["body", "Text", "area"]] },
  split: { label: "Photo + text", fields: [["heading", "Heading"], ["highlight", "Highlight word(s)"], ["body", "Text", "area"], ["media", "Photo", "media"], ["side", "Photo side (left or right)"]] },
  gallery: { label: "Photo gallery", fields: [["heading", "Heading"], ["media", "Photos", "media+"]] },
  video: { label: "Video", fields: [["heading", "Heading"], ["media", "Video", "media"], ["caption", "Caption"]] },
  cards: { label: "3 cards", fields: [["heading", "Heading"], ["c1", "Card 1 (title: text)"], ["c2", "Card 2 (title: text)"], ["c3", "Card 3 (title: text)"]] },
  steps: { label: "Steps", fields: [["heading", "Heading"], ["body", "One step per line", "area"]] },
  cta: { label: "Button", fields: [["heading", "Heading"], ["button", "Button text"], ["link", "Where it goes (page or link)"]] },
  idea: { label: "Anything else", fields: [["body", "Describe it however you want", "area"], ["media", "Attach stuff", "media+"]] }
};
let PG = store.get("fixx_page", null);
const newPage = () => ({ mode: "new", name: "", eyebrow: "", plain: "", box: "", meta: "", existing: "Our story", blocks: [{ type: "text", heading: "", highlight: "", body: "", eyebrow: "" }] });
VIEWS.page = () => {
  PG = PG || newPage();
  view(`<div class="vhead"><p class="eyebrow">Page designer</p><h1 class="h1">Design a <em>page</em></h1><p>Stack blocks however you want. The preview is a sketch. Claude builds the real thing in the Jerky Fixx style, then you see it live on the preview link.</p></div>
  <div class="designer"><div>
    <div class="card"><div class="row"><button class="chip ${PG.mode === "new" ? "on" : ""}" data-mode="new" type="button">New page</button><button class="chip ${PG.mode === "edit" ? "on" : ""}" data-mode="edit" type="button">Redo an existing page</button></div>
      ${PG.mode === "edit" ? `<label class="lbl">Which page?</label><select data-pg="existing">${PAGES.slice(0, 8).map(p => `<option ${p === PG.existing ? "selected" : ""}>${p}</option>`).join("")}</select>` : `<label class="lbl">Page name</label><input data-pg="name" value="${esc(PG.name)}" placeholder="Events"><p class="muted small" style="margin:6px 0 0">Lives at jerkyfixx.com/<b id="slugOut">${esc(slugify(PG.name || "events"))}</b>/</p>`}
      <div class="grid2"><div><label class="lbl">Top label</label><input data-pg="eyebrow" value="${esc(PG.eyebrow)}" placeholder="Catch us live"></div><div><label class="lbl">One liner</label><input data-pg="meta" value="${esc(PG.meta)}" placeholder="Pop ups, ball games and fests"></div>
      <div><label class="lbl">Big word</label><input data-pg="plain" value="${esc(PG.plain)}" placeholder="Upcoming"></div><div><label class="lbl">Boxed word</label><input data-pg="box" value="${esc(PG.box)}" placeholder="Events"></div></div></div>
    <div class="blocks" id="blocks"></div>
    <div class="addbar">${Object.entries(BLOCKS).map(([k, b]) => `<button class="chip" type="button" data-add="${k}">+ ${b.label}</button>`).join("")}</div>
    <div class="sendbar"><button class="btn btn-ghost btn-sm" id="pgReset" type="button">Start over</button><button class="btn btn-pink" id="pgSend" type="button">Build it 🔥</button></div>
  </div><div class="preview"><iframe id="pgPrev" title="Page sketch"></iframe></div></div>`);
  $$("[data-mode]").forEach(b => b.onclick = () => { PG.mode = b.dataset.mode; savePg(); VIEWS.page(); });
  $$("[data-pg]").forEach(i => i.addEventListener("input", () => { PG[i.dataset.pg] = i.value; if ($("#slugOut")) $("#slugOut").textContent = slugify(PG.name || "events"); savePg(); sketch(); }));
  $$("[data-add]").forEach(b => b.onclick = () => { PG.blocks.push({ type: b.dataset.add }); savePg(); drawBlocks(); sketch(); });
  $("#pgReset").onclick = () => { if (confirm("Clear this page and start over?")) { PG = newPage(); PAGE_FILES = {}; savePg(); VIEWS.page(); } };
  $("#pgSend").onclick = sendPage;
  drawBlocks(); sketch();
};
let PAGE_FILES = {}; // blockIndex -> [File]
const savePg = () => store.set("fixx_page", PG);
function drawBlocks() {
  $("#blocks").innerHTML = PG.blocks.map((b, i) => { const d = BLOCKS[b.type]; return `<div class="block" data-i="${i}"><div class="block-h"><b>${i + 1}. ${d.label}</b><div><button type="button" data-mv="-1" aria-label="Up">↑</button><button type="button" data-mv="1" aria-label="Down">↓</button><button type="button" data-rm aria-label="Remove">✕</button></div></div>
    ${d.fields.map(([k, l, t]) => t === "area" ? `<label class="lbl">${l}</label><textarea data-k="${k}">${esc(b[k] || "")}</textarea>` : t && t.startsWith("media") ? `<label class="lbl">${l}</label><div class="row"><button class="btn btn-ghost btn-sm" type="button" data-pick="${t === "media+" ? "multi" : "one"}">${(PAGE_FILES[i] || []).length ? (PAGE_FILES[i].length + " picked, change") : "Pick from phone or computer"}</button></div>` : `<label class="lbl">${l}</label><input data-k="${k}" value="${esc(b[k] || "")}">`).join("")}</div>`; }).join("");
  $$(".block").forEach(el => {
    const i = +el.dataset.i, b = PG.blocks[i];
    $$("[data-k]", el).forEach(inp => inp.addEventListener("input", () => { b[inp.dataset.k] = inp.value; savePg(); sketch(); }));
    $$("[data-mv]", el).forEach(x => x.onclick = () => { const j = i + +x.dataset.mv; if (j < 0 || j >= PG.blocks.length) return; [PG.blocks[i], PG.blocks[j]] = [PG.blocks[j], PG.blocks[i]]; [PAGE_FILES[i], PAGE_FILES[j]] = [PAGE_FILES[j], PAGE_FILES[i]]; savePg(); drawBlocks(); sketch(); });
    $("[data-rm]", el).onclick = () => { PG.blocks.splice(i, 1); const nf = {}; Object.keys(PAGE_FILES).forEach(k => { k = +k; if (k < i) nf[k] = PAGE_FILES[k]; else if (k > i) nf[k - 1] = PAGE_FILES[k]; }); PAGE_FILES = nf; savePg(); drawBlocks(); sketch(); };
    const pick = $("[data-pick]", el); if (pick) pick.onclick = () => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = b.type === "video" ? "video/*" : b.type === "idea" ? "image/*,video/*" : "image/*"; inp.multiple = pick.dataset.pick === "multi"; inp.onchange = () => { PAGE_FILES[i] = checkSizes([...inp.files]); drawBlocks(); sketch(); }; inp.click(); };
  });
}
function sketch() {
  const fr = $("#pgPrev"); if (!fr) return;
  const img = (i, n = 0) => PAGE_FILES[i] && PAGE_FILES[i][n] ? URL.createObjectURL(PAGE_FILES[i][n]) : "";
  const hd = b => b.heading ? `<h2>${esc(b.heading).replace(esc(b.highlight || "\u0000"), `<em>${esc(b.highlight || "")}</em>`)}</h2>` : "";
  const body = PG.blocks.map((b, i) => {
    const p = esc(b.body || "").replace(/\n/g, "<br>");
    switch (b.type) {
      case "text": return `<section>${b.eyebrow ? `<p class="eb">${esc(b.eyebrow)}</p>` : ""}${hd(b)}<p>${p}</p></section>`;
      case "split": return `<section class="split ${/left/i.test(b.side || "") ? "l" : ""}"><div>${hd(b)}<p>${p}</p></div>${img(i) ? `<img src="${img(i)}">` : `<div class="ph">photo</div>`}</section>`;
      case "gallery": return `<section>${hd(b)}<div class="gal">${(PAGE_FILES[i] || [0, 0, 0]).map((f, n) => f ? `<img src="${img(i, n)}">` : `<div class="ph">photo</div>`).join("")}</div></section>`;
      case "video": return `<section>${hd(b)}${img(i) ? `<video src="${img(i)}" controls muted></video>` : `<div class="ph tall">video</div>`}<p class="cap">${esc(b.caption || "")}</p></section>`;
      case "cards": return `<section>${hd(b)}<div class="cards">${["c1", "c2", "c3"].map(k => { const [t, ...r] = String(b[k] || "Title: text").split(":"); return `<div><b>${esc(t)}</b><span>${esc(r.join(":"))}</span></div>`; }).join("")}</div></section>`;
      case "steps": return `<section>${hd(b)}<ol>${String(b.body || "Step one\nStep two").split("\n").filter(Boolean).map(s => `<li>${esc(s)}</li>`).join("")}</ol></section>`;
      case "cta": return `<section class="cta">${hd(b)}<a>${esc(b.button || "Order now")}</a></section>`;
      default: return `<section class="idea"><b>Your idea</b><p>${p || "Describe it and Claude makes it happen."}</p></section>`;
    }
  }).join("");
  fr.srcdoc = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  @font-face{font-family:Z;src:url(${CFG.site}/fonts/zuume.woff2)}body{margin:0;font:15px/1.6 Poppins,system-ui,sans-serif;color:#0d0410;background:#fff}
  .hero{background:#e21bd6 url(${CFG.site}/img/bg-gradient.webp) center/cover;color:#fff;padding:40px 22px 70px;position:relative;overflow:hidden}
  .hero .eb{font:600 12px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;margin:0 0 6px}.hero h1{margin:0;font:400 64px/.85 Z,Impact,sans-serif;text-transform:uppercase}
  .hero h1 em{font-style:normal;background:#580AA6;color:#FDEFFD;padding:0 .12em;display:inline-block;transform:rotate(-2deg)}.hero p{margin:10px 0 0;opacity:.9}
  .tape{position:absolute;left:-5%;right:-5%;bottom:12px;background:#ffe500;border-block:3px solid #111;font:400 18px Z,Impact;transform:rotate(-1.5deg);white-space:nowrap;overflow:hidden;color:#111}
  section{padding:28px 22px;border-bottom:1px solid #f1e3f3}h2{font:400 38px/.9 Z,Impact,sans-serif;text-transform:uppercase;margin:0 0 10px}h2 em{font-style:normal;color:#b5109f}
  .eb{font:600 11px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#b5109f;margin:0 0 4px}
  .split{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:center}.split.l img,.split.l .ph{order:-1}
  img,video{width:100%;border-radius:14px;display:block}.ph{background:repeating-linear-gradient(45deg,#f6e6f8 0 10px,#fdf3fe 0 20px);border-radius:14px;aspect-ratio:4/3;display:grid;place-items:center;color:#b5109f;font:600 12px Oswald;letter-spacing:.2em;text-transform:uppercase}.ph.tall{aspect-ratio:9/12}
  .gal{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.gal img,.gal .ph{aspect-ratio:1;object-fit:cover}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.cards div{border-top:4px solid #0d0410;padding-top:8px}.cards b{display:block;font:400 26px Z,Impact;text-transform:uppercase}.cards span{font-size:13px;color:#5a4660}
  ol{padding-left:20px}li{margin:6px 0}.cta{text-align:center;background:#580AA6;color:#FDEFFD}.cta h2 em{color:#F088F2}.cta a{display:inline-block;background:#E15CF2;color:#0d0410;padding:12px 24px;border-radius:999px;font:600 14px Oswald;letter-spacing:.14em;text-transform:uppercase;box-shadow:5px 5px 0 #0d0d0d}
  .idea{background:#fdf3fe;border:2px dashed #E15CF2;margin:16px;border-radius:14px}.cap{font-size:13px;color:#5a4660}
  @media(max-width:520px){.split,.cards{grid-template-columns:1fr}.hero h1{font-size:48px}}
  </style></head><body><div class="hero"><p class="eb">${esc(PG.eyebrow || "Top label")}</p><h1>${esc(PG.plain || (PG.mode === "edit" ? PG.existing : "Big"))} <em>${esc(PG.box || "Word")}</em></h1><p>${esc(PG.meta || "")}</p><div class="tape">WARNING! FLAVORS MAY CAUSE ADDICTION ⚠ WARNING! FLAVORS MAY CAUSE ADDICTION ⚠</div></div>${body}</body></html>`;
}
async function sendPage() {
  if (PG.mode === "new" && !PG.name.trim()) return toast("Give the page a name first.", true);
  const attachments = [], specs = [];
  PG.blocks.forEach((b, i) => {
    const d = BLOCKS[b.type], files = PAGE_FILES[i] || [];
    files.forEach((f, n) => attachments.push({ file: f, note: `block ${i + 1} (${d.label})${files.length > 1 ? " #" + (n + 1) : ""}` }));
    specs.push(`### Block ${i + 1}: ${d.label}\n` + d.fields.filter(([k, , t]) => !(t || "").startsWith("media") && b[k]).map(([k, l]) => `- ${l}: ${String(b[k]).replace(/\n/g, " / ")}`).join("\n") + (files.length ? `\n- Media: ${files.length} file(s), see attachments for block ${i + 1}` : ""));
  });
  const title = PG.mode === "new" ? `New page: ${PG.name}` : `Redesign: ${PG.existing}`;
  const text = PG.mode === "new"
    ? `Build a new page called "${PG.name}" at /${slugify(PG.name)}/ as tools/pages/${slugify(PG.name)}.html. Follow the blocks below in order, in the Jerky Fixx style, using the existing pg- blocks. Add it to the footer Explore links (in cart.html) and the sitemap. Polish the wording lightly but keep my words and ideas.`
    : `Redo the ${PG.existing} page using the blocks below, in this order. Keep anything I didn't mention that still makes sense. Keep my words and ideas.`;
  const extra = `## Page header\n- Top label: ${PG.eyebrow || "(your call)"}\n- Big word: ${PG.plain || "(your call)"}\n- Boxed word: ${PG.box || "(your call)"}\n- One liner: ${PG.meta || "(your call)"}\n\n## Blocks\n\n${specs.join("\n\n")}`;
  try { const pr = await sendRequest({ title, kind: "page", where: PG.mode === "new" ? "A new page" : PG.existing, text, attachments, extra }); PG = null; PAGE_FILES = {}; store.del("fixx_page"); sentScreen(pr, "Claude is building your page in the Jerky Fixx style."); }
  catch (e) { busy(false); toast(e.message, true); }
}

/* ---------- BLOG ---------- */
VIEWS.blog = () => {
  const d = store.get("fixx_blog", { title: "", body: "", keywords: "" }); let hero = null, inline = [];
  view(`<div class="vhead"><p class="eyebrow">The Fixx Blog</p><h1 class="h1">Write a <em>post</em></h1><p>Write it your way, rough is fine. Claude tightens it for Google (title, description, headings, links) and keeps your voice. It publishes under your name.</p></div>
  <div class="card"><label class="lbl" for="bT">Title idea</label><input id="bT" value="${esc(d.title)}" placeholder="Our first night market of the season">
    <label class="lbl">Main photo</label><div class="row"><button class="btn btn-ghost btn-sm" id="bHero" type="button">Pick a photo</button><span class="muted small" id="bHeroN">None yet</span></div>
    <label class="lbl" for="bB">Your post</label>
    <div class="row" style="margin-bottom:8px"><button class="chip" type="button" data-ins="## ">Heading</button><button class="chip" type="button" data-ins="**bold**">Bold</button><button class="chip" type="button" data-ins="- ">List</button><button class="chip" type="button" id="bImg">+ Photo</button><button class="chip" type="button" id="bVid">+ Video</button></div>
    <textarea id="bB" rows="14" placeholder="Tell the story. Who, what, where, what it tasted like, what's next.">${esc(d.body)}</textarea>
    <p class="muted small" id="bWc"></p>
    <label class="lbl" for="bK">Words people might search (optional)</label><input id="bK" value="${esc(d.keywords)}" placeholder="night market albuquerque, jerky near me"></div>
  <div class="sendbar"><span class="muted small">Posts go live after Vince approves.</span><button class="btn btn-pink" id="bSend" type="button">Polish &amp; publish</button></div>`);
  const ta = $("#bB"), save = () => store.set("fixx_blog", { title: $("#bT").value, body: ta.value, keywords: $("#bK").value });
  const wc = () => { const n = (ta.value.match(/\S+/g) || []).length; $("#bWc").textContent = n + " words" + (n < 400 ? ". Short is fine, Claude fills it out to a full post without making stuff up." : ""); };
  ["#bT", "#bK"].forEach(s => $(s).addEventListener("input", save)); ta.addEventListener("input", () => { save(); wc(); }); wc();
  $$("[data-ins]").forEach(b => b.onclick = () => { const s = ta.selectionStart; ta.setRangeText(b.dataset.ins, s, ta.selectionEnd, "end"); ta.focus(); save(); });
  const pickTo = (accept, cb) => { const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.onchange = () => i.files[0] && cb(checkSizes([i.files[0]])[0]); i.click(); };
  $("#bHero").onclick = () => pickTo("image/*", f => { if (f) { hero = f; $("#bHeroN").textContent = f.name; } });
  $("#bImg").onclick = () => pickTo("image/*", f => { if (!f) return; inline.push(f); ta.setRangeText(`\n[photo ${inline.length}: ${f.name}]\n`, ta.selectionStart, ta.selectionEnd, "end"); save(); });
  $("#bVid").onclick = () => pickTo("video/*", f => { if (!f) return; inline.push(f); ta.setRangeText(`\n[video ${inline.length}: ${f.name}]\n`, ta.selectionStart, ta.selectionEnd, "end"); save(); });
  $("#bSend").onclick = async () => {
    const title = $("#bT").value.trim(), body = ta.value.trim(); if (!title || body.length < 40) return toast("Add a title and a few lines first.", true);
    const atts = (hero ? [{ file: hero, note: "main photo (hero)" }] : []).concat(inline.map((f, i) => ({ file: f, note: `inline ${f.type.startsWith("video/") ? "video" : "photo"} ${i + 1}, goes where [${f.type.startsWith("video/") ? "video" : "photo"} ${i + 1}] is in the draft` })));
    const text = `Publish this as a Fixx Blog post by Aaliyah Penn, following blog/README.md (front matter, 700 to 1100 words, SEO title and description). Keep her voice and facts. If it's short, expand it naturally with things already true on the site, never invented details. Put inline media where the [photo N] / [video N] markers are, using the ![alt](path) | caption and @video(...) formats. Suggested keywords: ${$("#bK").value || "your call"}.`;
    try { const pr = await sendRequest({ title: "Blog: " + title, kind: "blog", where: "Blog", text, attachments: atts, extra: "## Her draft\n\n" + body }); store.del("fixx_blog"); sentScreen(pr, "Claude is polishing your post."); }
    catch (e) { busy(false); toast(e.message, true); }
  };
};

/* ---------- BRAND KIT ---------- */
const KIT = [["logomark", "Logomark"], ["logo", "Logo"], ["logo-lockup", "Logo lockup"], ["logo-long", "Long logo"], ["logo-stack", "Stacked logo"], ["logo-pink", "Pink logo"], ["logo-pink-lg", "Pink logo, large"], ["over20", "Over 20 Flavors badge"], ["jerky-fixx-neon-roadrunner", "Neon roadrunner"], ["roadrunner-head", "Roadrunner head"], ["icon-cross", "Cross icon"], ["icon-bacon", "Bacon icon"], ["icon-flame", "Flame icon"], ["lightning", "Lightning"], ["pattern", "Icon pattern"], ["bg-gradient", "Hero background"]];
const COLORS = [["#E15CF2", "Jerky Fixx pink"], ["#F088F2", "Light pink"], ["#9F22F2", "Bright purple"], ["#580AA6", "Deep purple"], ["#0D0D0D", "Ink"], ["#FDEFFD", "Blush"], ["#FFE500", "Tape yellow"]];
VIEWS.brand = () => {
  view(`<div class="vhead"><p class="eyebrow">Brand kit</p><h1 class="h1">All the <em>goods</em></h1><p>Every Jerky Fixx logo and graphic as a PNG, the brand colors and the fonts. Use them for flyers, socials, signs, whatever.</p></div>
  <div class="row" style="margin-bottom:16px"><a class="btn btn-pink" href="brand/jerky-fixx-brand-kit.zip" download>⬇ Download everything (.zip)</a></div>
  <div class="kit">${KIT.map(([f, n]) => `<figure><div class="pic"><img src="brand/${f}.png" alt="${esc(n)}" loading="lazy"></div><figcaption><b>${esc(n)}</b></figcaption><a class="btn btn-ghost btn-sm" href="brand/${f}.png" download="jerky-fixx-${f}.png">Download PNG</a></figure>`).join("")}</div>
  <h2 class="h2" style="margin:28px 0 12px">Brand <em>colors</em></h2><p class="muted small" style="margin-top:-6px">Tap to copy.</p>
  <div class="swatches">${COLORS.map(([c, n]) => `<button class="sw" type="button" data-c="${c}"><i style="background:${c}"></i><span>${c}<br><small class="muted">${n}</small></span></button>`).join("")}</div>
  <div class="card" style="margin-top:20px"><h2 class="h2">The <em>fonts</em></h2><p class="muted">Zuume Rough for the big CURE style words, Fibre for "THE", Macabro for "CRAVING", Oswald for labels and buttons, Poppins for paragraphs. The zip has the web font files.</p></div>`);
  $$("[data-c]").forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.c); toast("Copied " + b.dataset.c); } catch { toast(b.dataset.c); } });
};

/* ---------- MY REQUESTS ---------- */
VIEWS.requests = async n => {
  if (n) return detail(+n, false);
  view(`<div class="vhead"><p class="eyebrow">Tracking</p><h1 class="h1">My <em>requests</em></h1><p>Everything you've sent, where it's at, and the preview link once it's ready.</p></div><div class="reqs" id="rq"><p class="muted">Loading…</p></div>`);
  try { $("#rq").innerHTML = await reqRows(await studioPRs()) || `<div class="empty">Nothing yet. <a href="#ask">Ask for your first change</a>.</div>`; } catch (e) { $("#rq").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
};

/* ---------- REVIEW (Vince) ---------- */
VIEWS.review = async n => {
  if (!IS_ADMIN) return VIEWS.requests(n);
  if (n) return detail(+n, true);
  view(`<div class="vhead"><p class="eyebrow">For Vince</p><h1 class="h1">Ready for <em>review</em></h1><p>Approve everything, pick only the parts you want, edit the text yourself, or ask Claude for tweaks.</p></div><div class="reqs" id="rv"><p class="muted">Loading…</p></div>`);
  try { $("#rv").innerHTML = await reqRows(await studioPRs("open")) || `<div class="empty">All caught up. 🎉</div>`; } catch (e) { $("#rv").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
};

const GENERATED = /^(index\.html|cart\.html|sitemap\.xml|llms\.txt|404\.html|[a-z]+\.html|[a-z-]+\/index\.html|blog\/.+\/index\.html|blog\/index\.html|blog\/feed\.xml|js\/shop\.js)$/;
async function detail(num, admin) {
  view(`<p class="muted">Loading…</p>`);
  try {
    const [p, cs, files] = await Promise.all([gh(`${R()}/pulls/${num}`), gh(`${R()}/issues/${num}/comments?per_page=100`), gh(`${R()}/pulls/${num}/files?per_page=100`)]);
    const [sk, sl] = await prStatus(p), open = p.state === "open", pv = previewUrl(p.head.ref);
    const visible = files.filter(f => !/^studio-requests\//.test(f.filename));
    view(`<a href="#${admin ? "review" : "requests"}" class="small">← Back</a>
    <div class="vhead" style="margin-top:10px"><span class="status st-${sk}">${sl}</span><h1 class="h1" style="margin-top:10px">${esc(p.title.replace(/^[✨🛠]\s*/u, ""))}</h1><p>${esc(p.user.login)} · ${ago(p.created_at)} · ${visible.length} file${visible.length === 1 ? "" : "s"}</p></div>
    ${open || p.merged_at ? `<div class="pv"><b>👀 Preview</b><a class="btn btn-pink btn-sm" href="${p.merged_at ? CFG.site : pv}" target="_blank" rel="noopener">${p.merged_at ? "See it live" : "Open preview"}</a><span class="muted small">${p.merged_at ? "This is live on jerkyfixx.com." : "Private copy of the site with these changes. Takes a minute after each update."}</span></div>` : ""}
    <div class="card" style="margin-top:14px"><h2 class="h2">The <em>conversation</em></h2><div class="thread">
      <div class="msg"><header><img src="${esc(p.user.avatar_url)}" alt="">${esc(p.user.login)} asked</header>${md(p.body || "")}</div>
      ${cs.map(c => `<div class="msg ${c.user.type === "Bot" ? "bot" : ""}"><header><img src="${esc(c.user.avatar_url)}" alt="">${c.user.type === "Bot" ? "Fixx Studio" : esc(c.user.login)} · ${ago(c.created_at)}</header>${md(c.body)}</div>`).join("")}
    </div>${open ? `<label class="lbl" for="tweak">Want a tweak?</label><textarea id="tweak" rows="3" placeholder="Make the heading bigger and use the second photo instead."></textarea><div class="actions"><button class="btn btn-purple btn-sm" id="tweakGo" type="button">Ask Claude</button><button class="btn btn-ghost btn-sm" id="noteGo" type="button">Just leave a note</button></div>` : ""}</div>
    ${admin && open ? `<div class="card"><div class="row" style="justify-content:space-between"><h2 class="h2">What <em>changed</em></h2><div class="row"><button class="chip" type="button" id="selAll">All</button><button class="chip" type="button" id="selNone">None</button></div></div>
      <p class="muted small">Untick anything you don't want. Pages built from a source file come along with it automatically.</p>
      <div class="files-list">${visible.map((f, i) => `<div class="fcheck"><label><input type="checkbox" data-f="${i}" checked><span>${esc(f.filename)}</span><span class="kind ${f.status}">${f.status}</span></label>${f.patch ? `<details><summary>See the change</summary><pre class="diff">${esc(f.patch).split("\n").map(l => `<span class="${l[0] === "+" ? "a" : l[0] === "-" ? "d" : l.startsWith("@@") ? "h" : ""}">${l}</span>`).join("\n")}</pre></details>` : ""}<div class="row" style="padding:0 12px 10px 40px">${f.status !== "removed" && /\.(html|md|json|css|txt|js)$/.test(f.filename) ? `<button class="btn btn-ghost btn-sm" type="button" data-edit="${esc(f.filename)}">Edit text</button>` : ""}</div></div>`).join("")}</div>
      <div class="actions"><button class="btn btn-ok" id="goAll" type="button">✔ Approve all &amp; go live</button><button class="btn btn-purple" id="goSel" type="button">Go live with selected</button><button class="btn btn-bad" id="decline" type="button">Decline</button></div></div>` : ""}
    ${!admin && open && p.user.login === ME.login ? `<div class="actions"><button class="btn btn-bad btn-sm" id="cancel" type="button">Cancel this request</button></div>` : ""}`);
    const comment = body => gh(`${R()}/issues/${num}/comments`, { method: "POST", body: JSON.stringify({ body }) });
    if ($("#tweakGo")) {
      $("#tweakGo").onclick = async () => { const t = $("#tweak").value.trim(); if (!t) return; try { busy(true, "Sending to Claude…", 50); await comment("@claude " + t); busy(false); toast("Sent. Claude updates the preview in a few minutes."); detail(num, admin); } catch (e) { busy(false); toast(e.message, true); } };
      $("#noteGo").onclick = async () => { const t = $("#tweak").value.trim(); if (!t) return; try { await comment(t); detail(num, admin); } catch (e) { toast(e.message, true); } };
    }
    if ($("#cancel")) $("#cancel").onclick = async () => { if (!confirm("Cancel this request? Nothing from it goes live.")) return; await comment("Canceled from Fixx Studio."); await gh(`${R()}/pulls/${num}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) }); toast("Canceled"); location.hash = "#requests"; };
    if (!admin || !open) return;
    const boxes = $$("[data-f]");
    const closeOver = () => { // a source file brings its generated pages along
      const src = visible.filter((f, i) => boxes[i].checked && !GENERATED.test(f.filename));
      if (src.length) visible.forEach((f, i) => { if (GENERATED.test(f.filename)) boxes[i].checked = true; });
    };
    $("#selAll").onclick = () => boxes.forEach(b => (b.checked = true));
    $("#selNone").onclick = () => boxes.forEach(b => (b.checked = false));
    $$("[data-edit]").forEach(b => b.onclick = () => editFile(p, b.dataset.edit));
    $("#goAll").onclick = async () => {
      if (!confirm("Put all of this live on jerkyfixx.com?")) return;
      try { busy(true, "Going live…", 60); await gh(`${R()}/pulls/${num}/merge`, { method: "PUT", body: JSON.stringify({ merge_method: "squash", commit_title: p.title.replace(/^[✨🛠]\s*/u, "") + " (#" + num + ")" }) }); await gh(`${R()}/git/refs/heads/${p.head.ref}`, { method: "DELETE" }).catch(() => {}); busy(false); toast("Live! jerkyfixx.com updates in about a minute."); refreshReviewCount(); detail(num, admin); }
      catch (e) { busy(false); toast(e.message, true); }
    };
    $("#goSel").onclick = async () => {
      closeOver();
      const pick = visible.filter((f, i) => boxes[i].checked);
      if (!pick.length) return toast("Tick at least one file.", true);
      if (pick.length === visible.length) return $("#goAll").click();
      if (!confirm(`Put ${pick.length} of ${visible.length} changes live?`)) return;
      try {
        busy(true, "Going live with your picks…", 40);
        const main = (await gh(`${R()}/git/ref/heads/main`)).object.sha, mt = (await gh(`${R()}/git/commits/${main}`)).tree.sha, tree = [];
        pick.forEach(f => { if (f.status === "renamed" && f.previous_filename) tree.push({ path: f.previous_filename, mode: "100644", type: "blob", sha: null }); tree.push({ path: f.filename, mode: "100644", type: "blob", sha: f.status === "removed" ? null : f.sha }); });
        const t = await gh(`${R()}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: mt, tree }) });
        const c = await gh(`${R()}/git/commits`, { method: "POST", body: JSON.stringify({ message: `${p.title.replace(/^[✨🛠]\s*/u, "")} (part of #${num})`, tree: t.sha, parents: [main] }) });
        await gh(`${R()}/git/refs/heads/main`, { method: "PATCH", body: JSON.stringify({ sha: c.sha }) });
        await comment("✅ Went live with:\n" + pick.map(f => "- " + f.filename).join("\n") + "\n\nThe rest stays here. Close it when you're done.");
        busy(false); toast("Your picks are live."); detail(num, admin);
      } catch (e) { busy(false); toast(e.message, true); }
    };
    $("#decline").onclick = async () => { const why = prompt("Decline this one? Add a quick note for Aaliyah (optional):", ""); if (why === null) return; try { await comment("❌ Not this time." + (why ? " " + why : "")); await gh(`${R()}/pulls/${num}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) }); refreshReviewCount(); location.hash = "#review"; } catch (e) { toast(e.message, true); } };
  } catch (e) { view(`<div class="empty">${esc(e.message)}</div>`); }
}
async function editFile(p, path) {
  busy(true, "Opening " + path + "…", 30);
  let text; try { text = await readFile(path, p.head.ref); } catch (e) { busy(false); return toast(e.message, true); } busy(false);
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = `<div class="modal-in" style="width:min(900px,100%)"><p class="eyebrow">Edit text</p><h2 class="h2" style="word-break:break-all">${esc(path)}</h2><p class="muted small">Change words directly. Saving updates the preview.${/^(index\.html|[a-z-]+\/index\.html|blog\/.+\/index\.html)$/.test(path) ? " Heads up: this page is rebuilt from a source file, so edit the source when there is one." : ""}</p><textarea style="min-height:55svh;font:13px/1.5 ui-monospace,Menlo,monospace">${esc(text)}</textarea><div class="actions" style="justify-content:flex-end"><button class="btn btn-ghost" data-c type="button">Cancel</button><button class="btn btn-pink" data-ok type="button">Save to preview</button></div></div>`;
  document.body.appendChild(m);
  $("[data-c]", m).onclick = () => m.remove();
  $("[data-ok]", m).onclick = async () => { try { busy(true, "Saving…", 60); await commitFiles({ branch: p.head.ref, create: false, files: [{ path, text: $("textarea", m).value }], message: "studio edit: " + path }); busy(false); m.remove(); toast("Saved. The preview refreshes in a minute."); } catch (e) { busy(false); toast(e.message, true); } };
}

boot();
