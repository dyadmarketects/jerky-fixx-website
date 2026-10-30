#!/usr/bin/env python3
"""Build a private preview of the `staging` branch at <main repo>/staging/ (served as jerkyfixx.com/staging/).

- Every HTML page from staging is copied and rewritten so links stay inside /staging/.
- CSS/JS/assets that differ from main (or are new) are copied too; unchanged heavy assets (3D models,
  videos, photos) are loaded from the live root so the preview stays small.
- Pages get <meta name="robots" content="noindex, nofollow"> and a STAGING ribbon; robots.txt on main
  should disallow /staging/.
Usage: stage_preview.py STAGING_DIR MAIN_DIR
"""
import os, re, sys, shutil, filecmp, posixpath

ST, MAIN = sys.argv[1], sys.argv[2]
OUT = os.path.join(MAIN, "staging")
SKIP_DIRS = {".git", ".github", "staging", "tools", "node_modules", "backend"}
SKIP_EXT = {".md", ".py", ".gs"}

files = []
for root, dirs, fs in os.walk(ST):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
    for f in fs:
        rel = os.path.relpath(os.path.join(root, f), ST).replace(os.sep, "/")
        if os.path.splitext(f)[1].lower() in SKIP_EXT or f in ("CNAME", ".git", ".gitignore", ".nojekyll") or f.startswith("."):
            continue
        files.append(rel)

def changed(rel):
    m = os.path.join(MAIN, rel)
    return not os.path.exists(m) or not filecmp.cmp(os.path.join(ST, rel), m, shallow=False)

copyset = {r for r in files if r.endswith(".html") or changed(r)}
pages = {r for r in files if r.endswith(".html")}

def is_page(t):
    t = t.split("#")[0].split("?")[0]
    if t == "" or t.endswith("/"):
        return True
    return t.endswith(".html")

def map_target(t):
    """t: site-root-relative path (no leading slash), may include #/?"""
    path = t.split("#")[0].split("?")[0]
    tail = t[len(path):]
    if is_page(t):
        cand = path if path.endswith(".html") or path == "" else path + "index.html"
        if path == "" or cand in pages or path.rstrip("/") + "/index.html" in pages:
            return "/staging/" + path + tail
        return "/" + path + tail
    if path in copyset:
        return "/staging/" + path + tail
    return "/" + path + tail

SKIP_REF = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//|#|data:|mailto:|tel:|sms:|javascript:|\{|\$)", re.I)

def resolve(ref, cur):
    if SKIP_REF.match(ref) or ref == "":
        return None
    if ref.startswith("/"):
        return ref[1:]
    base = posixpath.dirname(cur)
    return posixpath.normpath(posixpath.join(base, ref)).lstrip("./") if ref not in (".", "./") else base + "/"

def fix_ref(ref, cur):
    t = resolve(ref, cur)
    if t is None:
        return ref
    if ref.endswith("/") and t and not t.endswith("/"):
        t += "/"
    return map_target(t)

ATTR = re.compile(r'''(\s(?:href|src|poster|action|content)=)(["'])([^"']*)\2''', re.I)
SRCSET = re.compile(r'''(\ssrcset=)(["'])([^"']*)\2''', re.I)
CSSURL = re.compile(r'''url\((["']?)([^)"']+)\1\)''')
RIBBON = ('<div style="position:fixed;z-index:2147483000;left:50%;top:0;transform:translateX(-50%);background:#ffe500;color:#0d0410;'
          'font:700 11px/1 Oswald,Arial,sans-serif;letter-spacing:.18em;padding:6px 14px;border-radius:0 0 10px 10px;'
          'box-shadow:0 4px 12px rgba(0,0,0,.3);pointer-events:none">STAGING PREVIEW</div>')

def rewrite_html(s, cur):
    def a(m):
        name = m.group(1).strip().lower()
        if name.startswith("content="):
            return m.group(0)  # meta content (og:url etc) stays production
        return m.group(1) + m.group(2) + fix_ref(m.group(3), cur) + m.group(2)
    s = ATTR.sub(a, s)
    s = SRCSET.sub(lambda m: m.group(1) + m.group(2) + ", ".join(
        " ".join([fix_ref(p.strip().split(" ")[0], cur)] + p.strip().split(" ")[1:]) for p in m.group(3).split(",") if p.strip()) + m.group(2), s)
    s = CSSURL.sub(lambda m: "url(" + m.group(1) + fix_ref(m.group(2), cur) + m.group(1) + ")", s)
    s = re.sub(r'<meta name="robots"[^>]*>', "", s)
    s = s.replace("<head>", '<head>\n<base href="/">\n<meta name="robots" content="noindex, nofollow">', 1)
    s = re.sub(r"(<body[^>]*>)", r"\1" + RIBBON, s, count=1)
    return js_strings(s)

def js_strings(s):
    # page links built in scripts
    s = re.sub(r'''(["'`])(?:/)?cart\.html''', r"\1/staging/cart.html", s)
    s = re.sub(r'''(["'`])/#''', r"\1/staging/#", s)
    for route in ("blog/", "jerky/", "our-story/", "the-lab/", "dealer-locator/", "vip-club/", "contact/", "faq/"):
        s = re.sub(r'''(["'`])/''' + re.escape(route), r"\1/staging/" + route, s)
    return s

if os.path.exists(OUT):
    shutil.rmtree(OUT)
for rel in sorted(copyset):
    src, dst = os.path.join(ST, rel), os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    ext = os.path.splitext(rel)[1].lower()
    if ext == ".html":
        open(dst, "w", encoding="utf-8").write(rewrite_html(open(src, encoding="utf-8").read(), rel))
    elif ext == ".css":
        s = open(src, encoding="utf-8").read()
        open(dst, "w", encoding="utf-8").write(CSSURL.sub(lambda m: "url(" + m.group(1) + fix_ref(m.group(2), rel) + m.group(1) + ")", s))
    elif ext == ".js":
        open(dst, "w", encoding="utf-8").write(js_strings(open(src, encoding="utf-8").read()))
    elif ext in (".xml", ".txt") and rel in ("sitemap.xml", "robots.txt") or rel.endswith("feed.xml"):
        continue
    else:
        shutil.copy2(src, dst)
open(os.path.join(OUT, "robots.txt"), "w").write("User-agent: *\nDisallow: /\n")
print(f"preview: {len(pages)} pages, {len(copyset - pages)} changed/new assets -> {OUT}")
