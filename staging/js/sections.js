/* Jerky Fixx page sections: flavor menu + detail, top seller rail, order/contact form, VIP and dealer alert forms,
   Jerky Fest calendar file, videos, lab chapters and the family photo carousel.
   Shared by the home page and the interior pages (/jerky/, /contact/, /dealer-locator/ ...). Every block checks that its
   markup exists, so a page only needs the sections it shows. Load after js/shop.js. */
const REDUCE=matchMedia("(prefers-reduced-motion: reduce)").matches;
const $id=id=>document.getElementById(id);

/* ======== menu: icon grid + big detail ======== */
let curSel=FLAVORS[0].s,curSize="Small",curQty=1;
function renderMenu(f){
  const g=$id("flavGrid");if(!g)return;
  g.innerHTML=FLAVORS.filter(x=>f==="all"||bucket(x.h)===f).map(x=>`<button class="ficon" type="button" data-s="${x.s}" aria-pressed="${x.s===curSel}" aria-controls="flavDetail">${x.top?'<span class="top" title="Top seller"></span>':""}<img src="${x.img}" alt="" width="360" height="360" loading="lazy"><span class="nm">${esc(x.n)}</span><span class="pods" role="img" aria-label="Heat ${x.h} of 5">${podHTML(x.h)}</span><span class="sr-only">${x.top?"Top seller. ":""}${esc(x.d)}</span></button>`).join("");
}
function renderDetail(){
  const d=$id("flavDetail");if(!d)return;const f=BYSLUG[curSel];
  d.innerHTML=`<button class="x fd-close" type="button" aria-label="Close flavor details" onclick="closeDetail()">✕</button>${f.top?'<span class="fd-tag">Top seller</span>':'<span class="fd-tag" style="background:#ff66c4">Flavor '+String(f.i+1).padStart(2,"0")+'</span>'}<div class="fd-head"><img class="fd-img" src="${f.img}" alt="${esc(f.n)} jerky by Jerky Fixx" width="360" height="360"><div><h3>${esc(f.n)}</h3><div class="fd-row"><span class="readout">Heat</span><span class="pods" aria-hidden="true">${podHTML(f.h)}</span><span class="readout"><b>${f.h}/5</b></span></div></div></div><p>${esc(f.d)}</p><div class="fd-row"><div class="seg" role="radiogroup" aria-label="Bag size"><button type="button" role="radio" data-sz="Small" aria-checked="${curSize==="Small"}">Small $7</button><button type="button" role="radio" data-sz="Large" aria-checked="${curSize==="Large"}">Large $20</button></div><div class="qty" role="group" aria-label="Quantity"><button type="button" data-dq="-1" aria-label="Fewer bags">−</button><output id="fdQty" aria-live="polite">${curQty}</output><button type="button" data-dq="1" aria-label="More bags">+</button></div></div><div class="fd-row"><button class="pill pill-lime" type="button" id="fdAdd">Add to cart · $${PRICE[curSize]*curQty}</button><a class="pill pill-light" href="/staging/cart.html">View cart</a></div>`;
}
let fdOpener=null;
function closeDetail(){const d=$id("flavDetail");if(!d||!d.classList.contains("open"))return;d.classList.remove("open");if(fdOpener&&innerWidth<=1000&&document.contains(fdOpener))fdOpener.focus();}
addEventListener("keydown",e=>{if(e.key==="Escape")closeDetail();});
function showFlavor(s){curSel=s;curQty=1;const c=document.querySelector('.chip[aria-pressed="true"]');renderMenu(c?c.dataset.f:"all");renderDetail();}
(function(){
  const g=$id("flavGrid"),d=$id("flavDetail");if(!g||!d)return;
  g.addEventListener("click",e=>{const b=e.target.closest(".ficon");if(!b)return;curSel=b.dataset.s;curQty=1;fdOpener=b;document.querySelectorAll(".ficon").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));renderDetail();d.classList.add("open");
    /* phones: the detail opens as a bottom sheet, so put focus in it */
    if(innerWidth<=1000){const a=$id("fdAdd");if(a)setTimeout(()=>a.focus({preventScroll:true}),60);}});
  d.addEventListener("click",e=>{const sz=e.target.closest("[data-sz]"),dq=e.target.closest("[data-dq]");
    if(sz){curSize=sz.dataset.sz;renderDetail();const n=d.querySelector('[data-sz="'+curSize+'"]');if(n)n.focus();}
    if(dq){curQty=Math.min(50,Math.max(1,curQty+(+dq.dataset.dq)));renderDetail();const n=d.querySelector('[data-dq="'+dq.dataset.dq+'"]');if(n)n.focus();}
    if(e.target.closest("#fdAdd")){Cart.add(curSel,curSize,curQty);}});
  renderMenu("all");renderDetail();
  document.querySelectorAll(".chip").forEach(c=>c.addEventListener("click",()=>{document.querySelectorAll(".chip").forEach(o=>o.setAttribute("aria-pressed",String(o===c)));renderMenu(c.dataset.f);}));
})();

/* ======== tapes + top seller rail ======== */
const TAPE="WARNING! FLAVORS MAY CAUSE ADDICTION";
document.querySelectorAll(".track").forEach(t=>{t.innerHTML=Array(10).fill(`<span>${TAPE}</span>`).join("")});
const rail=$id("luRail");
if(rail)rail.innerHTML=TOP.map((t,i)=>`<button type="button" data-i="${i}" aria-pressed="false" aria-label="${esc(t.n)}"><img src="${t.img}" alt="" width="30" height="30">${esc(t.n)}</button>`).join("");

/* ======== contact: order several flavors (shares the cart) or ask a question ======== */
(function(){
  const f=$id("contactForm");if(!f)return;const sel=$id("c-flavor"),list=$id("cItems");
  sel.innerHTML=FLAVORS.map(x=>`<option value="${x.s}">${esc(x.n)}</option>`).join("");
  function draw(){list.innerHTML=Cart.items.length?Cart.items.map((x,i)=>`<div class="ol"><span><b>${x.qty} ×</b> ${esc(BYSLUG[x.s].n)} <small>${x.size}</small></span><span class="ol-ctl"><button type="button" data-q="${i}" data-d="-1" aria-label="One fewer ${esc(BYSLUG[x.s].n)}">−</button><button type="button" data-q="${i}" data-d="1" aria-label="One more ${esc(BYSLUG[x.s].n)}">+</button></span><b class="ol-p">$${PRICE[x.size]*x.qty}</b></div>`).join("")+`<div class="ol ol-tot"><span>Total</span><a href="/staging/cart.html">Open cart</a><b>$${Cart.total()}</b></div>`:`<p class="ol-empty">Pick a flavor, size and qty, then hit Add. Add as many as you like.</p>`;}
  Cart.on(draw);draw();
  list.addEventListener("click",e=>{const q=e.target.closest("[data-q]");if(q){const i=+q.dataset.q;Cart.set(i,Cart.items[i].qty+(+q.dataset.d));}});
  $id("cAdd").addEventListener("click",()=>{const q=Math.max(1,Math.min(50,+$id("c-qty").value||1));Cart.add(sel.value,$id("c-size").value,q,true);$id("c-qty").value=1;});
  const setKind=()=>{const k=f.querySelector('input[name="kind"]:checked').value;f.dataset.kind=k;const o=k==="order";
    $id("orderFields").hidden=!o;$id("addrFields").hidden=!o;$id("cNote").hidden=!o;
    $id("cMsgLbl").textContent=o?"Drop-off notes (where to leave it, timing)":"Your question";
    $id("cSend").firstChild.textContent=o?"Send order ":"Send it ";};
  f.querySelectorAll('input[name="kind"]').forEach(r=>r.addEventListener("change",setKind));setKind();
  /* /contact/?kind=question opens straight to the question form */
  if(/[?&]kind=question\b/.test(location.search)){const r=f.querySelector('input[value="question"]');if(r){r.checked=true;setKind();}}
  bindForm("contactForm",fd=>{if(f.dataset.kind==="order")return orderPayload(fd);
    if(!String(fd.message||"").trim())return {error:"Type your question so we know how to help."};
    return {form:"contact",topic:"Question",name:fd.name,email:fd.email,phone:fd.phone||"",message:fd.message||"",consent:fd.consent,hp:""};},
    ()=>{if(f.dataset.kind==="order")Cart.clear();setKind();});
})();
bindForm("vipForm",fd=>({form:"vip",name:fd.name||"",email:fd.email,message:fd.message||"",topic:"FIXX Fiends VIP Club waitlist",consent:fd.consent,hp:""}));
bindForm("alertForm",fd=>({form:"events",email:fd.email,phone:fd.phone||"",topic:"Dealer alerts",consent:fd.consent,hp:""}));

/* ======== calendar file for Jerky Fest ======== */
(function(){const b=$id("icsBtn");if(!b)return;b.addEventListener("click",()=>{const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Jerky Fixx//EN","BEGIN:VEVENT","UID:jerkyfest-2026@jerkyfixx.com","DTSTAMP:20261029T000000Z","DTSTART;VALUE=DATE:20261031","DTEND;VALUE=DATE:20261101","SUMMARY:New Mexico Jerky Fest (Jerky Fixx booth)","LOCATION:Isleta Resort & Casino, Albuquerque, NM","DESCRIPTION:Find the Jerky Fixx booth at New Mexico Jerky Fest, Halloween Edition. https://jerkyfixx.com","END:VEVENT","END:VCALENDAR"].join("\r\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([ics],{type:"text/calendar"}));a.download="jerky-fest-2026.ics";document.body.appendChild(a);a.click();a.remove();});})();

/* ======== promo sound, videos (muted loops play only while on screen, and never on their own with reduced motion) ======== */
(function(){
  const promo=$id("promoVid"),snd=$id("promoSound");
  if(promo&&snd)snd.addEventListener("click",()=>{promo.muted=!promo.muted;snd.textContent=promo.muted?"🔇":"🔊";snd.setAttribute("aria-label",promo.muted?"Turn sound on":"Turn sound off");promo.play().catch(()=>{});});
  const vids=["promoVid","labVid","batchVid"].map($id).filter(Boolean);
  if(!vids.length||!("IntersectionObserver" in window))return;
  if(REDUCE){vids.forEach(v=>{v.controls=true;v.removeAttribute("loop");});return;}
  const io=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;if(e.isIntersecting)v.play().catch(()=>{});else v.pause();}),{threshold:.25});
  vids.forEach(v=>io.observe(v));
})();
/* ======== lab chapters: tap a step to jump the video there ======== */
const STEPS=[[0,"Slice","Cut to 1/8 inch"],[2,"Lay out","Strips on the racks"],[8,"Season","Lemon pepper, heavy"],[11,"Chile","Green chile on top"],[13,"Dry","Into the dehydrator"],[15,"Low + slow","Held at 150°F"],[18.4,"Done","Carne seca"]];
(function(){const ol=$id("steps"),vid=$id("labVid"),temp=$id("labTemp");if(!ol||!vid)return;
 ol.innerHTML=STEPS.map((x,i)=>`<li><button class="step${i?"":" on"}" type="button" data-t="${x[0]}" aria-label="Jump the video to ${x[1]}: ${x[2]}"><span class="t">00:${String(Math.floor(x[0])).padStart(2,"0")}</span><b>${x[1]}</b><small>${x[2]}</small></button></li>`).join("");
 const els=[...ol.querySelectorAll(".step")];
 vid.addEventListener("timeupdate",()=>{const t=vid.currentTime;let k=0;STEPS.forEach((x,i)=>{if(t>=x[0])k=i});els.forEach((e,i)=>{e.classList.toggle("on",i===k);if(i===k)e.setAttribute("aria-current","step");else e.removeAttribute("aria-current");});if(temp)temp.textContent=t<13?"RAW":"150°F";});
 els.forEach(b=>b.addEventListener("click",()=>{vid.currentTime=+b.dataset.t;vid.play().catch(()=>{});}));})();
/* ======== family carousel: autoscroll (pausable, off with reduced motion), arrows, swipe, keys ======== */
(function(){const tr=$id("carTrack");if(!tr)return;const car=$id("carousel");const step=()=>tr.querySelector("figure").getBoundingClientRect().width+16;let hold=0,paused=REDUCE,inside=false;
 const go=d=>{hold=Date.now()+8000;const max=tr.scrollWidth-tr.clientWidth-4;if(d>0&&tr.scrollLeft>=max)tr.scrollLeft=0;else if(d<0&&tr.scrollLeft<=0)tr.scrollLeft=max;else tr.scrollBy({left:d*step()})};
 car.querySelector(".car-prev").addEventListener("click",()=>go(-1));car.querySelector(".car-next").addEventListener("click",()=>go(1));
 ["pointerdown","wheel","touchstart"].forEach(ev=>tr.addEventListener(ev,()=>hold=Date.now()+8000,{passive:true}));
 tr.addEventListener("keydown",e=>{if(e.key==="ArrowRight"){e.preventDefault();go(1);}if(e.key==="ArrowLeft"){e.preventDefault();go(-1);}});
 /* hovering or focusing the photos pauses the slideshow; the pause button stops it for good */
 car.addEventListener("pointerenter",()=>inside=true);car.addEventListener("pointerleave",()=>inside=false);
 car.addEventListener("focusin",()=>inside=true);car.addEventListener("focusout",e=>{if(!car.contains(e.relatedTarget))inside=false;});
 const pb=$id("carPause");
 const syncPb=()=>{if(!pb)return;pb.setAttribute("aria-pressed",String(paused));pb.querySelector("span.lbl").textContent=paused?"Play slideshow":"Pause slideshow";pb.dataset.state=paused?"paused":"playing";};
 if(pb){pb.addEventListener("click",()=>{paused=!paused;syncPb();});syncPb();}
 setInterval(()=>{if(paused||inside||Date.now()<hold||document.hidden)return;const r=tr.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;const max=tr.scrollWidth-tr.clientWidth-4;if(tr.scrollLeft>=max)tr.scrollTo({left:0});else tr.scrollBy({left:step()});},3200);})();
/* ======== over 20 flavors badge wobbles once it is on screen (the home page stamps it in with GSAP instead) ======== */
(function(){const o=$id("over20");if(!o||window.gsap||REDUCE)return;o.classList.add("live");})();
