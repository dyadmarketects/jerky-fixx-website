#!/usr/bin/env python3
"""Writes a page source tools/pages/flavor-<slug>.html for every flavor that has copy in data/flavor-pages.json
(the top sellers). tools/build_pages.py then builds them to /jerky/<slug>/ like any other page.
Run before tools/build_pages.py. Never edit tools/pages/flavor-*.html by hand; edit the JSON instead."""
import html, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES_DIR = os.path.join(ROOT, "tools", "pages")
FL = json.load(open(os.path.join(ROOT, "data", "flavors.json"), encoding="utf-8"))
COPY = json.load(open(os.path.join(ROOT, "data", "flavor-pages.json"), encoding="utf-8"))["pages"]
PRICES = FL["prices"]
BY = {f["name"]: f for f in FL["flavors"]}
HEAT = ["no heat", "mild", "mild", "medium", "hot", "X-Hot"]
esc = html.escape


def slug(n):
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", n.lower().replace("&", "and")))


def link_for(n):
    return "/jerky/%s/" % slug(n) if n in COPY else "/jerky/"


def money(v):
    return ("$%d" % v) if float(v).is_integer() else ("$%.2f" % v)


def page(name, c):
    f = BY[name]
    s, h = slug(name), int(f["heat"])
    title = "%s Jerky from Albuquerque | Jerky Fixx" % name
    if len(title) > 60:
        title = "%s Jerky | Jerky Fixx" % name
    desc = c["description"]
    assert 140 <= len(desc) <= 158, (name, len(desc))
    meta = {"path": "/jerky/%s/" % s, "nav": "/jerky/", "crumb": name, "parent": ["/jerky/", "Jerky menu"],
            "title": title, "description": desc,
            "hero": {"eyebrow": "Heat %d of 5 <b>/</b> Small %s <b>/</b> Large %s" % (h, money(PRICES["Small"]), money(PRICES["Large"])),
                     "plain": esc(name), "box": "Jerky", "meta": esc(f["description"]),
                     "icons": [["a", "icon-flame"], ["b", "icon-cross"], ["c", "icon-bacon"]]},
            "body_class": "lg-page pg-page pg-flavor", "changefreq": "monthly", "priority": 0.7, "cta": True,
            "og_image": c["photo"], "og_image_alt": "A bag of Jerky Fixx %s jerky" % name,
            "product": {"name": name, "description": f["description"], "image": c["photo"], "heat": h}}
    note = "" if c.get("photo_real") else '<figcaption>Representative photo. Every hand cut batch looks a little different.</figcaption>'
    about = "\n      ".join('<p class="pg-p">%s</p>' % esc(p) for p in c["about"])
    pairs = "\n      ".join('<li><a href="%s"><b>%s</b><span>Heat %d of 5. %s</span></a></li>'
                           % (link_for(p), esc(p), BY[p]["heat"], esc(BY[p]["description"])) for p in c["pairs"] if p in BY)
    reads = "\n      ".join('<li><a href="%s">%s</a></li>' % (u, esc(t)) for u, t in c["reads"])
    body = f'''<div class="lg-body pg-body">
<div class="wrap">
  <section class="pg-block pg-split pg-flv" aria-labelledby="about">
    <div>
      <p class="eyebrow ui">{esc(HEAT[h].capitalize())} <b>/</b> made in Albuquerque, NM</p>
      <h2 class="pg-h2" id="about">About <em>{esc(name)}</em></h2>
      {about}
      <ul class="pg-facts">
        <li><b>Heat</b> {h} of 5</li>
        <li><b>Small bag</b> {money(PRICES["Small"])}</li>
        <li><b>Large bag</b> {money(PRICES["Large"])}</li>
        <li><b>Delivery</b> Albuquerque and Rio Rancho</li>
      </ul>
      <div class="flv-buy" data-flavor="{s}">
        <button class="pill pill-lime" type="button" data-size="Small">Add small bag, {money(PRICES["Small"])}</button>
        <button class="pill pill-light" type="button" data-size="Large">Add large bag, {money(PRICES["Large"])}</button>
      </div>
      <p class="pg-p pg-small">No payment online. We text you to confirm and take Cash App, Venmo, Apple Pay or cash, then drop it at your door.</p>
    </div>
    <figure class="pg-fig"><img src="{c["photo"]}" alt="A bag of Jerky Fixx {esc(name)} jerky with the roadrunner sticker" width="600" height="800">{note}</figure>
  </section>
  <section class="pg-block" aria-labelledby="who">
    <p class="eyebrow ui">Is it for you?</p>
    <h2 class="pg-h2" id="who">Who it's <em>for</em></h2>
    <p class="pg-p">{esc(c["who"])}</p>
  </section>
  <section class="pg-block" aria-labelledby="pairs">
    <p class="eyebrow ui">Build a mixed bag</p>
    <h2 class="pg-h2" id="pairs">Try it <em>with</em></h2>
    <ul class="flv-pairs">
      {pairs}
    </ul>
    <p class="pg-p">See all {len(FL["flavors"])} flavors on the <a href="/jerky/">jerky menu</a>.</p>
  </section>
  <section class="pg-block" aria-labelledby="reads">
    <p class="eyebrow ui">Keep reading</p>
    <h2 class="pg-h2" id="reads">More about <em>this flavor</em></h2>
    <ul class="flv-reads">
      {reads}
    </ul>
  </section>
</div>
</div>
'''
    script = '''<script>
document.querySelectorAll(".flv-buy button").forEach(function(b){b.addEventListener("click",function(){
  var s=b.parentNode.getAttribute("data-flavor");if(typeof Cart!=="undefined"){Cart.add(s,b.getAttribute("data-size"),1);}else{location.href="/jerky/";}});});
</script>'''
    return "<!--page\n" + json.dumps(meta, ensure_ascii=False) + "\n-->\n" + body + "<!--scripts-->\n" + script + "\n"


def favs_into_chrome(names):
    """Writes the Fixx Favs links (top seller pages) into the nav dropdown, phone menu and footer in cart.html.
    build_pages.py then copies that chrome to every page."""
    p = os.path.join(ROOT, "cart.html")
    src = open(p, encoding="utf-8").read()
    links = "".join('<a href="/jerky/%s/">%s</a>' % (slug(n), esc(n)) for n in names)
    blocks = {"NAV": '<p class="dd-h">Fixx Favs</p>' + links + '<a class="dd-all" href="/green-chile-jerky/">Green chile jerky</a><a class="dd-all" href="/jerky/">All %d flavors</a>' % len(FL["flavors"]),
              "MNAV": links + '<a href="/jerky/">All %d flavors</a>' % len(FL["flavors"]),
              "FOOT": links}
    new = src
    for k, v in blocks.items():
        new = re.sub(r"<!-- FAVS:%s -->.*?<!-- /FAVS:%s -->" % (k, k), "<!-- FAVS:%s -->%s<!-- /FAVS:%s -->" % (k, v, k), new, flags=re.S)
    if new != src:
        open(p, "w", encoding="utf-8").write(new)


def main():
    keep = set()
    for name, c in COPY.items():
        if name not in BY:
            print("skipped %s (not on the menu anymore)" % name)
            continue
        fn = "flavor-%s.html" % slug(name)
        keep.add(fn)
        p = os.path.join(PAGES_DIR, fn)
        new = page(name, c)
        if not os.path.exists(p) or open(p, encoding="utf-8").read() != new:
            open(p, "w", encoding="utf-8").write(new)
    for fn in os.listdir(PAGES_DIR):
        if fn.startswith("flavor-") and fn.endswith(".html") and fn not in keep:
            os.remove(os.path.join(PAGES_DIR, fn))
            print("removed", fn)
    favs_into_chrome([n for n in COPY if n in BY])
    print("flavor pages: %d" % len(keep))


if __name__ == "__main__":
    main()
