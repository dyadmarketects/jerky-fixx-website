/* Jerky Fixx shared shop code: flavors, cart, forms and cookie consent.
   Loaded by index.html and cart.html. */

/* ======== config ======== */
/* Paste the Google Apps Script web app URL here (see backend/SETUP.md). Until then forms fall back to an email draft. */
const FORM_ENDPOINT = "";
const GA_ID = ""; /* optional Google Analytics 4 ID, only loads after cookie consent */
const RECIPIENTS = "jerkyfixx@gmail.com,dyadmarketects@gmail.com";

/* ======== flavors ======== */
const slug=s=>s.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const FLAVORS=[
 ["X-Hot Green",5,"Our hottest green chile jerky. Green chile heat stacked on more green chile for the fiends who like it loud.",1],
 ["Green",3,"Classic New Mexico green chile carne seca. Earthy, bright and just the right burn."],
 ["Red",3,"Red chile beef jerky with deep, smoky New Mexico red chile flavor."],
 ["X-Mas",3,"Can't choose? Red and green chile together, Christmas style, the way New Mexico does it."],
 ["Lemon Pepper Green",3,"Zesty lemon pepper meets green chile heat. Bright, peppery and hard to put down."],
 ["Garlic Parm Green",3,"Savory garlic and parmesan with a green chile kick."],
 ["Green Chili Ranch",2,"Cool ranch seasoning with a mellow green chile warmth."],
 ["Honey Teriyaki Green",2,"Sweet honey teriyaki with a little green chile bite on the finish."],
 ["Mango Habanero",4,"Sweet mango up front, slow habanero burn on the way out.",1],
 ["Asian Zing",2,"Savory, tangy and a little sweet with an Asian inspired zing."],
 ["Takis",4,"Rolled chile lime crunch flavor on thin cut carne seca. Sour, spicy and gone way too fast.",1],
 ["Hot Cheetos",4,"Red hot cheeto dust packed into every strip. Your fingers will be red and you won't care.",1],
 ["Hot Mamma",4,"A hot one for the heat chasers. Bold red chile spice with a serious kick."],
 ["Hot Mamma Cheeto",5,"Hot Mamma heat plus hot cheeto dust. Double trouble for spice fiends."],
 ["Hot Cheeto Pickle",3,"Dill pickle tang meets hot cheeto heat. It sounds wild. It sells out anyway.",1],
 ["Salt",0,"Simple, beefy and clean. Just meat and salt for the purists."],
 ["Salt x Pepper",1,"The classic pair. Salt and cracked black pepper on thin cut beef."],
 ["X-Hot Green Chili Lime Salt",5,"X-Hot green chile with lime and a hit of salt. Tangy, salty, very hot."],
 ["Lemon Pepper",1,"Bright lemon and cracked black pepper. A classic that never gets old.",1],
 ["Garlic",0,"Garlic lovers only. Big savory garlic flavor with zero heat."],
 ["Garlic Parm",0,"Roasted garlic and nutty parmesan. Mellow on the heat, loud on the flavor.",1],
 ["Teriyaki",0,"Savory teriyaki glaze on tender, thin cut beef."],
 ["Honey Teriyaki",0,"Sweet, sticky and savory. The gateway flavor for the kids and the grandmas.",1],
 ["Pickle",1,"Tangy dill pickle jerky. Sour, salty and weirdly addictive."],
 ["Tajin Limon",2,"Chile lime Tajin style seasoning with a bright limon finish."]
].map(([n,h,d,top],i)=>({n,h,d,top:!!top,i,s:slug(n),img:"img/flavors/"+slug(n)+".webp"}));
const BYSLUG=Object.fromEntries(FLAVORS.map(f=>[f.s,f]));
const PRICE={Small:7,Large:20};
const TOPN=["X-Hot Green","Hot Cheetos","Garlic Parm","Takis","Honey Teriyaki","Mango Habanero","Hot Cheeto Pickle","Lemon Pepper"];
const TOPM={"X-Hot Green":["chile","lime","chile","chile","lime","chile","lime","chile"],"Hot Cheetos":["cheeto","cheeto","cheeto","cheeto","cheeto","cheeto","cheeto","cheeto"],"Garlic Parm":["garlic","parmesan","garlic","parmesan","garlic","parmesan","garlic"],"Takis":["taki","taki","lime","taki","taki","taki","lime","taki"],"Honey Teriyaki":["teriyaki","teriyaki","teriyaki","teriyaki","teriyaki"],"Mango Habanero":["mango","chile","mango","chile","mango","chile","mango","chile"],"Hot Cheeto Pickle":["cheeto","pickles","cheeto","cheeto","pickles","cheeto","cheeto","pickles"],"Lemon Pepper":["lemonpepper","lemon","lemon","lemonpepper","lemon","lemon","lemonpepper"]};
const TOP=TOPN.map(n=>{const f=FLAVORS.find(x=>x.n===n);return {n,heat:f.h,d:f.d,s:f.s,img:f.img,m:TOPM[n]};});
const podHTML=h=>Array.from({length:5},(_,i)=>`<span class="pod${i<h?" on":""}"></span>`).join("");
const bucket=h=>h<=1?"mild":h<=3?"med":h===4?"hot":"xhot";
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

/* ======== cart (one cart shared by the menu, the contact form and the cart page) ======== */
const Cart={items:store.get("jf_cart",[]).filter(x=>BYSLUG[x.s]&&PRICE[x.size]),subs:[],
  on(f){this.subs.push(f);},
  save(){store.set("jf_cart",this.items);this.subs.forEach(f=>f());},
  add(s,size,qty,quiet){qty=Math.max(1,qty|0);const it=this.items.find(x=>x.s===s&&x.size===size);if(it)it.qty=Math.min(99,it.qty+qty);else this.items.push({s,size,qty});this.save();
    const c=document.getElementById("cartCount");if(c){c.classList.remove("bump");void c.offsetWidth;c.classList.add("bump");}
    if(!quiet)toast(`${qty} × ${BYSLUG[s].n} (${size}) added`,true);},
  set(i,q){if(!this.items[i])return;if(q<=0)this.items.splice(i,1);else this.items[i].qty=Math.min(99,q);this.save();},
  setSize(i,size){const it=this.items[i];if(!it||it.size===size)return;const dup=this.items.findIndex((x,k)=>k!==i&&x.s===it.s&&x.size===size);if(dup>-1){this.items[dup].qty+=it.qty;this.items.splice(i,1);}else it.size=size;this.save();},
  clear(){this.items=[];this.save();},
  total(){return this.items.reduce((a,x)=>a+PRICE[x.size]*x.qty,0)},
  count(){return this.items.reduce((a,x)=>a+x.qty,0)},
  lines(){return this.items.map(x=>({name:BYSLUG[x.s].n,size:x.size,qty:x.qty,price:PRICE[x.size]*x.qty}))}};
function updateBadge(){const c=document.getElementById("cartCount");if(!c)return;const n=Cart.count();c.hidden=!n;c.textContent=n;}
Cart.on(updateBadge);
addEventListener("storage",e=>{if(e.key==="jf_cart"){Cart.items=store.get("jf_cart",[]);Cart.subs.forEach(f=>f());}});
let toastT;
function toast(msg,link){let t=document.getElementById("toast");if(!t){t=document.createElement("div");t.id="toast";t.className="toast";t.setAttribute("role","status");document.body.appendChild(t);}
  t.innerHTML=esc(msg)+(link?' <a href="cart.html">View cart</a>':"");t.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),link?3600:2400);}

/* ======== forms → Apps Script (emails both inboxes + Google Sheet) ======== */
const loadedAt=Date.now();
const addrOf=fd=>`${String(fd.street||"").trim()}${String(fd.apt||"").trim()?", "+String(fd.apt).trim():""}\n${String(fd.city||"").trim()}, ${String(fd.state||"NM").trim().toUpperCase()} ${String(fd.zip||"").trim()}`;
function itemsText(items){return items.map(x=>`${x.qty} × ${x.name} (${x.size}) $${x.price}`).join("\n");}
async function sendForm(data){
  data.page=location.href;data.t=String(Date.now()-loadedAt);
  if(!FORM_ENDPOINT){
    const subj={order:"New order",contact:"Question",vip:"VIP Club signup",events:"Event alerts signup"}[data.form]||"Website message";
    let body=`Name: ${data.name||""}\nEmail: ${data.email||""}\nPhone: ${data.phone||""}\n`;
    if(data.address)body+=`Deliver to:\n${data.address}\n`;
    if(data.items){body+=`\nItems:\n${itemsText(JSON.parse(data.items))}\nTotal: $${data.total}\n`;}
    if(data.message)body+=`\nMessage:\n${data.message}\n`;
    location.href=`mailto:${RECIPIENTS}?subject=${encodeURIComponent(subj+(data.name?": "+data.name:""))}&body=${encodeURIComponent(body)}`;
    return {ok:true,fallback:true};
  }
  const body=new URLSearchParams(data);
  try{const r=await fetch(FORM_ENDPOINT,{method:"POST",body});return await r.json().catch(()=>({ok:true}));}
  catch(e){try{await fetch(FORM_ENDPOINT,{method:"POST",mode:"no-cors",body});return {ok:true};}catch(_){return {ok:false};}}
}
/* build(fd) returns the payload, or {error:"..."} to show a message, or null to stop quietly */
function bindForm(id,build,done){
  const f=document.getElementById(id);if(!f)return;const msg=f.querySelector(".form-msg");
  f.addEventListener("submit",async e=>{e.preventDefault();msg.classList.remove("err");
    const fd=Object.fromEntries(new FormData(f).entries());
    const fail=t=>{msg.classList.add("err");msg.textContent=t;};
    if(fd.hp)return;
    if(f.querySelector('[name="name"][required]')&&!String(fd.name||"").trim())return fail("Add your name so we know who to holler at.");
    if(!/^\S+@\S+\.\S+$/.test(fd.email||""))return fail("Add a valid email so we can get back to you.");
    if(f.querySelector('[name="phone"][required]')&&String(fd.phone||"").replace(/\D/g,"").length<7)return fail("Add a phone number so we can text you to confirm.");
    const needAddr=f.querySelector('[name="street"]')&&!(f.dataset.kind==="question");
    if(needAddr){if(!String(fd.street||"").trim()||!String(fd.city||"").trim())return fail("Add your delivery address so the dealer knows where to drop your fixx.");if(!/^\d{5}(-\d{4})?$/.test(String(fd.zip||"").trim()))return fail("Add a 5 digit ZIP code for delivery.");}
    const data=build(fd);if(!data)return;if(data.error)return fail(data.error);
    if(fd.consent!=="yes")return fail("Tick “I'm not a robot” first.");
    const btn=f.querySelector('[type="submit"]');btn.disabled=true;msg.textContent="Sending…";
    const r=await sendForm(data);btn.disabled=false;
    if(r.ok){msg.textContent=r.fallback?"Your email app opened with everything filled in. Hit send and you're set.":(data.form==="order"?"Order sent! Check your email. The dealer will text you to confirm.":"Got it! Check your email, the dealer will reach out soon.");f.reset();done&&done(r);}
    else fail("That didn't go through. Text 505-922-5683 or email jerkyfixx@gmail.com and we'll sort it out.");
  });
}
function orderPayload(fd){
  if(!Cart.items.length)return {error:"Add at least one flavor to your order first."};
  if(String(fd.phone||"").replace(/\D/g,"").length<7)return {error:"Add a phone number so the dealer can text you to confirm."};
  return {form:"order",name:fd.name,email:fd.email,phone:fd.phone||"",address:addrOf(fd),message:fd.message||"",items:JSON.stringify(Cart.lines()),total:String(Cart.total()),consent:fd.consent,hp:""};
}

/* ======== cookie consent (essential always on; analytics opt-in) ======== */
(function(){window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("consent","default",{analytics_storage:"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",wait_for_update:500});})();
const JFConsent={el:document.getElementById("consent"),
  get(){return store.get("jf_consent",null)},
  save(analytics){store.set("jf_consent",{v:1,necessary:true,analytics:!!analytics,ts:new Date().toISOString()});if(this.el)this.el.hidden=true;this.apply();},
  open(){if(!this.el)return;this.el.hidden=false;document.getElementById("ccPrefs").hidden=false;const c=this.get();document.getElementById("ccAnalytics").checked=!!(c&&c.analytics);document.getElementById("ccAccept").focus();},
  apply(){const c=this.get();window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("consent","update",{analytics_storage:c&&c.analytics?"granted":"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"});
    if(GA_ID&&c&&c.analytics&&!window.__ga){window.__ga=1;const s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id="+GA_ID;document.head.appendChild(s);gtag("js",new Date());gtag("config",GA_ID,{anonymize_ip:true});}}};
window.JFConsent=JFConsent;
if(JFConsent.el){
  document.getElementById("ccAccept").addEventListener("click",()=>JFConsent.save(document.getElementById("ccPrefs").hidden?true:document.getElementById("ccAnalytics").checked));
  document.getElementById("ccReject").addEventListener("click",()=>JFConsent.save(false));
  document.getElementById("ccCustom").addEventListener("click",()=>{document.getElementById("ccPrefs").hidden=false;document.getElementById("ccAccept").textContent="Save choices";});
  const cp=document.getElementById("cookiePrefs");if(cp)cp.addEventListener("click",()=>JFConsent.open());
  if(JFConsent.get())JFConsent.apply();else setTimeout(()=>{JFConsent.el.hidden=false;},2600);
}

/* ======== header bits: mobile nav, copy buttons, order now ======== */
(function(){
  const mnav=document.getElementById("mnav"),burger=document.getElementById("burger");
  if(mnav&&burger){burger.addEventListener("click",()=>{mnav.hidden=false;burger.setAttribute("aria-expanded","true")});
    document.getElementById("mclose").addEventListener("click",()=>{mnav.hidden=true;burger.setAttribute("aria-expanded","false")});
    mnav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{mnav.hidden=true}));}
  document.querySelectorAll("button.copy").forEach(b=>b.addEventListener("click",()=>{const v=b.dataset.copy;try{navigator.clipboard.writeText(v).then(()=>{b.textContent="Copied";setTimeout(()=>b.textContent="Copy",1500)})}catch(_){}}));
  const on=document.getElementById("orderNow");if(on)on.addEventListener("click",e=>{if(Cart.count()){e.preventDefault();location.href="cart.html";}});
  updateBadge();
})();
