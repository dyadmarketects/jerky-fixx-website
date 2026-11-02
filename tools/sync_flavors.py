#!/usr/bin/env python3
"""data/flavors.json -> the FLAVORS and PRICE blocks in js/shop.js (the menu, cart and order form all read those).
Run before tools/build_pages.py. Safe to run any number of times."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(ROOT, "data", "flavors.json"), encoding="utf-8"))
fl, prices = data["flavors"], data["prices"]
assert prices.get("Small") and prices.get("Large"), "prices need Small and Large"
def js(s): return json.dumps(s, ensure_ascii=False)
rows = []
for f in fl:
    assert f["name"].strip() and 0 <= int(f["heat"]) <= 5, f
    row = [js(f["name"].strip()), str(int(f["heat"])), js(f["description"].strip())]
    if f.get("top_seller") or f.get("photo"):
        row.append("1" if f.get("top_seller") else "0")
    if f.get("photo"):
        row.append(js(f["photo"]))
    rows.append(" [" + ",".join(rows_ := row) + "]")
p = os.path.join(ROOT, "js", "shop.js")
src = open(p, encoding="utf-8").read()
start, end = src.index("const FLAVORS=["), src.index("].map(")
src = src[:start] + "const FLAVORS=[\n" + ",\n".join(rows) + "\n" + src[end:]
src = re.sub(r"\]\.map\(\(\[n,h,d,top(?:,ph)?\],i\)=>\(\{n,h,d,top:!!top,i,s:slug\(n\),img:[^}]*\}\)\)",
             '].map(([n,h,d,top,ph],i)=>({n,h,d,top:!!top,i,s:slug(n),img:ph||"/img/flavors/"+slug(n)+".webp"}))', src, count=1)
src = re.sub(r"const PRICE=\{[^}]*\};", "const PRICE={Small:%s,Large:%s};" % (prices["Small"], prices["Large"]), src, count=1)
open(p, "w", encoding="utf-8").write(src)
print("synced %d flavors, Small $%s, Large $%s" % (len(fl), prices["Small"], prices["Large"]))
