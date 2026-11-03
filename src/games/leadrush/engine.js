// Lead Rush – Endless Runner im 2D-Canvas: Kundentour durch Ludlein.
// Ursprünglich als eigenständige Web-App gebaut; hier als Modul der Spielewelt.
// Alles läuft im Shadow DOM des Host-Elements, damit sich die Styles von Spiel und Spielewelt nicht mischen.
import css from './leadrush.css?inline';
import { markup } from './markup.js';

/**
 * @param {{onExit?:Function,isMuted?:Function,setMuted?:Function,playerName?:Function,logoUrl:string,wordmarkUrl:string}} hooks
 */
export function createLeadRush(hooks) {
const host=document.createElement('div');host.className='leadrush-host';
const root=host.attachShadow({mode:'open'});
root.innerHTML='<style>'+css+'</style>'+markup(hooks.wordmarkUrl);

const $=s=>root.querySelector(s), $$=s=>root.querySelectorAll(s);
const cv=$('#cv');let ctx=cv.getContext('2d',{desynchronized:true});
const rnd=(a,b)=>a+Math.random()*(b-a), ri=n=>Math.floor(Math.random()*n), pick=a=>a[ri(a.length)];
const fmt=n=>Math.round(n).toLocaleString('de-DE');

/* ================= DATEN ================= */
const CHARS=[
 {id:'stefan',name:'Stefan Eller',role:'Managing Director',perk:'Vertrauen',desc:'Startet mit 4 statt 3 Herzen.',cost:0,shirt:'#8DC63F',shirt2:'#6FA82A',hair:'#3b2b20',skin:'#f0c39c',pants:'#1c2b47',glasses:true},
 {id:'michael',name:'Michael Stump',role:'Managing Director',perk:'Begeisterung',desc:'Jeder gewonnene Deal bringt +50 % Umsatz.',cost:250,shirt:'#2f7de1',shirt2:'#1e5fb3',hair:'#80522c',skin:'#f3c9a5',pants:'#2b2f3a',glasses:false},
 {id:'holger',name:'Holger Kunzmann',role:'Managing Director',perk:'Gemeinsam stark',desc:'Alle Power-ups halten 40 % länger.',cost:500,shirt:'#f2f5fa',shirt2:'#c9d3e2',hair:'#8d939b',skin:'#eebf98',pants:'#203a5c',glasses:false}
];
const PU={
 sap:{n:'SAP-Sync',c:'#2f8cff',ic:'⇄',d:'Echtzeit-Magnet: zieht alle Leads an'},
 ki:{n:'KI-Turbo',c:'#a35cff',ic:'✦',d:'Unverwundbar & schneller – räumt Hindernisse weg'},
 fc:{n:'Forecast',c:'#ff9a2e',ic:'↗',d:'Doppelter Umsatz'},
 ol:{n:'officeXperience',c:'#28b4e8',ic:'@',d:'Schutzschild gegen einen Treffer'}
};
const FACTS={
 sap:['SAP-Sync','itmX crm ist voll in SAP ERP und S/4HANA integriert – ganz ohne zusätzliche Schnittstellen. Kunden, Angebote und Aufträge kommen in Echtzeit direkt aus SAP.'],
 ki:['KI-Turbo','Die KI in itmX priorisiert Leads, sagt Verkaufschancen voraus und erfasst Besuchsberichte einfach per Sprache.'],
 fc:['Forecast','Individuelle Dashboards und präzise KPIs sorgen für valide Forecasts – Zahlen, denen dein Vertrieb trauen kann.'],
 ol:['officeXperience','Das Outlook-Add-in bringt E-Mails samt Anhängen blitzschnell ins CRM. Folgeaktivitäten legst du direkt aus Outlook an.'],
 pipe:['Pipeline','Vom Lead über die Opportunity bis zum Auftrag: itmX sales bildet den kompletten Vertriebsprozess durchgängig ab.'],
 silo:['Datensilos','Excel-Listen und Insellösungen kosten Zeit und Daten. itmX verbindet SAP, CRM und Microsoft 365 ohne Medienbrüche.'],
 web:['webXperience','Kunden- und Vertriebsdaten dort, wo du sie brauchst: im Browser, auf dem Handy oder direkt in Microsoft Teams.'],
 mkt:['itmX marketing','Zielgerichtetes E-Mail-Marketing, automatisierte Nurture-Strecken und transparentes Lead-Management über alle Systeme.'],
 svc:['itmX service','Ticket- und Reklamationsmanagement, KI-optimierte Abläufe und ein Kundenserviceportal schaffen neue Umsatzpotenziale.'],
 com:['itmX commerce','B2B-Commerce mit komplexen Produktkatalogen und Lagerbeständen, die sich in Echtzeit synchronisieren.'],
 doc:['Document Intelligence','KI liest Dokumente automatisch aus und übersetzt CRM-Daten – weniger Tipparbeit, bessere Datenqualität.'],
 emo:['Emotionserkennung','Die KI erkennt die Stimmung in der Kundenkommunikation, damit du proaktiv reagieren kannst, bevor ein Kunde abspringt.'],
 mob:['Mobil','itmX crm ist geräteunabhängig: alle Kundendaten im Büro und unterwegs beim Kunden.'],
 pp:['Power Platform','Mit der Microsoft Power Platform werden Vertriebs-Workflows schneller, smarter und fehlerärmer.'],
 br:['Branchen','itmX ist spezialisiert auf den Mittelstand: Maschinen- und Anlagenbau, Bau und Bauzulieferer sowie Handel.'],
 exp:['Erfahrung','Über 20 Jahre Erfahrung in Marketing, Vertrieb und Service – als Tochter der NTT DATA Business Solutions.']
};
const QUIZ=[
 {q:'Wie ist itmX crm an SAP angebunden?',a:['Über nächtliche Excel-Exporte','Voll integriert – ohne zusätzliche Schnittstellen','Per Fax an die IT'],c:1,f:'sap'},
 {q:'Wo nutzt du Kundendaten mit webXperience?',a:['Nur am Desktop im Büro','Im Browser, mobil und in Microsoft Teams','Nur im Rechenzentrum'],c:1,f:'web'},
 {q:'Was macht officeXperience?',a:['Bringt E-Mails samt Anhängen aus Outlook ins CRM','Repariert den Drucker','Verschickt Excel-Listen'],c:0,f:'ol'},
 {q:'Wobei hilft die KI in itmX?',a:['Leads priorisieren und Chancen vorhersagen','Kaffee kochen','Kundendaten löschen'],c:0,f:'ki'},
 {q:'Was ist die richtige Reihenfolge im Vertrieb?',a:['Auftrag → Lead → Opportunity','Lead → Opportunity → Auftrag','Opportunity → Excel → Hoffnung'],c:1,f:'pipe'},
 {q:'Was bringt ein valider Forecast?',a:['Eine bessere Wettervorhersage','Verlässliche Planung auf Basis echter KPIs','Mehr Meetings'],c:1,f:'fc'},
 {q:'Was kostet dich ein Datensilo?',a:['Gar nichts','Zeit, Datenqualität und Umsatz','Nur etwas Speicherplatz'],c:1,f:'silo'},
 {q:'Auf welche Branchen ist itmX spezialisiert?',a:['Maschinenbau, Bau & Handel','Nur Gastronomie','Raumfahrt'],c:0,f:'br'},
 {q:'Was gehört zu itmX service?',a:['Parkuhr-Verwaltung','Ticket- und Reklamationsmanagement','Fax-Weiterleitung'],c:1,f:'svc'},
 {q:'Wie erkennt itmX unzufriedene Kunden früh?',a:['Gar nicht','KI erkennt Emotionen in der Kommunikation','Per Bauchgefühl'],c:1,f:'emo'},
 {q:'Was erledigt Document Intelligence?',a:['Liest Dokumente automatisch aus','Druckt Dokumente doppelt','Versteckt Dokumente'],c:0,f:'doc'},
 {q:'Was bietet itmX marketing?',a:['Plakate kleben','Automatisierte Nurture-Strecken & Lead-Management','Nur Visitenkarten'],c:1,f:'mkt'}
];
const MIS_T=[
 {k:'leads',t:'Sammle {n} Leads',ns:[30,60,100,160,240]},
 {k:'deals',t:'Gewinne {n} Deals',ns:[1,3,5,8,12]},
 {k:'dist',t:'Laufe {n} m',ns:[500,1000,1800,2800,4000]},
 {k:'opps',t:'Qualifiziere {n} Opportunities',ns:[2,4,7,10,15]},
 {k:'boss',t:'Stoppe den Excel-Laster {n}×',ns:[1,1,2,2,3]},
 {k:'pu',t:'Nutze {n} Power-ups',ns:[2,4,6,9,12]},
 {k:'bust',t:'Räume {n} Hindernisse mit KI-Turbo weg',ns:[1,3,5,8,12]}
];

const XIMG=new Image(),XR=828/766;XIMG.onload=()=>{try{if($('#team').classList.contains('on'))renderTeam();}catch(e){}};XIMG.src=hooks.logoUrl;

/* ================= SPEICHER ================= */
const KEY='itmx-leadrush-v1';
const HS_DEF=[{n:'Danny the Boss',v:1000000},{n:'Rüdi KI',v:500000},{n:'Hilti-Linke-Spur',v:333333}];
const DEF={hs:HS_DEF,name:'',coins:0,best:0,char:'stefan',owned:{stefan:1},up:{sap:0,ki:0,fc:0,ol:0},facts:{},mis:null,sound:1,runs:0,tut:0};
let S;
try{S=Object.assign(JSON.parse(JSON.stringify(DEF)),JSON.parse(localStorage.getItem(KEY))||{});}catch(e){S=JSON.parse(JSON.stringify(DEF));}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}};
function newMission(exclude){
  const lvl=Math.min(4,Math.floor((S.runs||0)/4));
  let t; do{t=pick(MIS_T);}while(exclude.includes(t.k));
  const n=t.ns[Math.min(4,lvl+ri(2))];
  return {k:t.k,n,t:t.t.replace('{n}',fmt(n)),r:40+lvl*30+ri(3)*10};
}
if(!S.mis||S.mis.length!==3){S.mis=[];for(let i=0;i<3;i++)S.mis.push(newMission(S.mis.map(m=>m.k)));save();}

/* ================= AUDIO ================= */
let AC=null,master,musicG,sfxG,noiseBuf,musicOn=false,seqT=0,seqStep=0,boss=false;
function initAudio(){
  if(AC){if(AC.state!=='running')AC.resume();return;}
  try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
  master=AC.createGain();master.gain.value=S.sound?0.6:0;master.connect(AC.destination);
  musicG=AC.createGain();musicG.gain.value=0.22;musicG.connect(master);
  sfxG=AC.createGain();sfxG.gain.value=0.6;sfxG.connect(master);
  noiseBuf=AC.createBuffer(1,AC.sampleRate*0.5,AC.sampleRate);
  const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const b=AC.createBuffer(1,1,22050),s=AC.createBufferSource();s.buffer=b;s.connect(AC.destination);s.start(0);
}
function tone(f,dur,type='square',vol=.3,f2=null,when=0,dest){
  if(!AC||!S.sound)return;const t=AC.currentTime+when;
  const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);
  if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g);g.connect(dest||sfxG);o.start(t);o.stop(t+dur+.02);
}
function noise(dur,vol=.3,when=0,hp=800,dest){
  if(!AC||!S.sound)return;const t=AC.currentTime+when;
  const s=AC.createBufferSource();s.buffer=noiseBuf;const f=AC.createBiquadFilter();f.type='highpass';f.frequency.value=hp;
  const g=AC.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  s.connect(f);f.connect(g);g.connect(dest||sfxG);s.start(t);s.stop(t+dur+.02);
}
const mf=m=>440*Math.pow(2,(m-69)/12);
const SFX={
  lead:c=>tone(mf(81+Math.min(c,14)),.07,'square',.12),
  jump:()=>tone(300,.18,'triangle',.3,700),
  slide:()=>noise(.18,.18,0,2500),
  hit:()=>{tone(220,.35,'sawtooth',.3,50);noise(.25,.35,0,300);},
  pu:()=>[72,76,79,84].forEach((n,i)=>tone(mf(n),.12,'square',.14,null,i*.06)),
  opp:()=>[67,71,74].forEach((n,i)=>tone(mf(n),.1,'triangle',.3,null,i*.05)),
  deal:()=>{[72,76,79,84,88].forEach((n,i)=>tone(mf(n),.16,'square',.13,null,i*.06));noise(.3,.2,.3,5000);},
  bust:()=>{tone(500,.25,'sawtooth',.2,90);noise(.15,.25,0,1500);},
  boss:()=>{for(let i=0;i<3;i++)tone(i%2?330:247,.28,'sawtooth',.18,null,i*.3);},
  win:()=>[60,64,67,72,76,79,84].forEach((n,i)=>tone(mf(n),.2,'square',.13,null,i*.07)),
  click:()=>tone(660,.05,'triangle',.2)
};
const BASS=[45,45,57,45,41,41,53,41,48,48,60,48,43,43,55,43];
const LEAD=[[69,72,76,72],[65,69,72,69],[67,72,76,72],[67,71,74,71]];
function musicTick(){
  if(!AC||!musicOn||!S.sound)return;
  const step=60/(boss?168:148)/2;
  if(seqT<AC.currentTime)seqT=AC.currentTime+.05;
  while(seqT<AC.currentTime+.25){
    const i=seqStep%16,w=seqT-AC.currentTime,bar=Math.floor(seqStep/16)%4;
    tone(mf(BASS[(i>>2)*4+(i%4)]-(boss?1:0)),step*.9,'triangle',.5,null,w,musicG);
    if(i%2===0)tone(55,.12,'sine',.7,40,w,musicG);
    noise(.04,i%2?.12:.06,w,7000,musicG);
    if(i%4===2)noise(.1,.18,w,1800,musicG);
    const ch=LEAD[(i>>2)%4];
    if(bar%2===1||boss){ if(i%2===0)tone(mf(ch[(i/2)%4]+12-(boss?1:0)),step*.8,'square',.09,null,w,musicG);}
    else if(i%4===0)tone(mf(ch[0]+12),step*1.6,'square',.07,null,w,musicG);
    seqT+=step;seqStep++;
  }
}

/* ================= LAYOUT ================= */
let W,H,DPR,U,HOR,GY,CX,QDPR=2,LOWFX=false,FOG=null,VIG=null;
const CAMD=4,LANES=[-1.25,0,1.25],ROADW=1.9,WALLX=2.6,SPAWNZ=72;
const sky=document.createElement('canvas'),sctx=sky.getContext('2d');
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,QDPR);
  W=window.innerWidth;H=window.innerHeight;
  cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
  cv.style.width=W+'px';cv.style.height=H+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  CX=W/2;HOR=H*0.35;GY=H*0.84;U=Math.min(W,H*0.55)*0.255;
  buildSky();
  FOG=ctx.createLinearGradient(0,HOR-2,0,HOR+(GY-HOR)*.13);FOG.addColorStop(0,'rgba(255,227,176,1)');FOG.addColorStop(1,'rgba(255,227,176,0)');
  VIG=ctx.createRadialGradient(CX,H/2,H*.3,CX,H/2,H*.75);VIG.addColorStop(0,'rgba(20,90,40,0)');VIG.addColorStop(1,'rgba(20,90,40,1)');
}
function buildSky(){
  sky.width=Math.round(W*DPR);sky.height=Math.round((HOR+4)*DPR);
  const c=sctx;c.setTransform(DPR,0,0,DPR,0,0);
  const g=c.createLinearGradient(0,0,0,HOR);g.addColorStop(0,'#3d7bd6');g.addColorStop(.6,'#8ec3f2');g.addColorStop(1,'#ffe3b0');
  c.fillStyle=g;c.fillRect(0,0,W,HOR+4);
  c.fillStyle='rgba(255,240,200,.9)';c.beginPath();c.arc(W*.78,HOR*.5,22,0,7);c.fill();
  c.fillStyle='rgba(255,255,255,.85)';
  [[.15,.28,1],[.55,.18,.8],[.85,.33,.7],[.35,.42,.6]].forEach(([x,y,s])=>{for(let i=0;i<4;i++){c.beginPath();c.arc(W*x+i*14*s,HOR*y+(i%2?-5:0)*s,13*s+(i%2)*5*s,0,7);c.fill();}});
  c.fillStyle='#7aa86a';c.beginPath();c.moveTo(0,HOR);
  for(let x=0;x<=W;x+=8)c.lineTo(x,HOR-18-Math.sin(x*.012)*12-Math.sin(x*.031)*6);c.lineTo(W,HOR);c.fill();
  c.fillStyle='#5e8f57';c.beginPath();c.moveTo(0,HOR);
  for(let x=0;x<=W;x+=8)c.lineTo(x,HOR-8-Math.sin(x*.02+1)*7);c.lineTo(W,HOR);c.fill();
  // Windräder
  c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=2;
  [[.08,58],[.18,46],[.9,52]].forEach(([x,h])=>{const X=W*x,Y=HOR-h;c.beginPath();c.moveTo(X,HOR-14);c.lineTo(X,Y);c.stroke();
    for(let i=0;i<3;i++){const a=i*2.094+.3;c.beginPath();c.moveTo(X,Y);c.lineTo(X+Math.cos(a)*18,Y+Math.sin(a)*18);c.stroke();}});
  // kleine Kirche von Ludlein
  const tx=W*.27;c.fillStyle='#e8dcc8';c.fillRect(tx-5,HOR-46,10,40);
  c.fillStyle='#55697d';c.beginPath();c.moveTo(tx-7,HOR-46);c.lineTo(tx,HOR-66);c.lineTo(tx+7,HOR-46);c.fill();
  // Industrie-Skyline
  const blk=[[.33,22,30,'#b9c2cc'],[.42,30,22,'#a9b4c0'],[.55,18,40,'#c3cbd3'],[.66,26,26,'#aeb8c3'],[.76,20,34,'#bcc4cd']];
  blk.forEach(([x,h,w,col])=>{const X=W*x;c.fillStyle=col;c.fillRect(X,HOR-h-6,w,h);
    c.fillStyle='rgba(0,0,0,.12)';for(let i=0;i<w-6;i+=8){c.beginPath();c.moveTo(X+i,HOR-h-6);c.lineTo(X+i+2,HOR-h-11);c.lineTo(X+i+8,HOR-h-6);c.fill();}});
  [[.46,52],[.6,44],[.71,58]].forEach(([x,h])=>{const X=W*x;c.fillStyle='#a6512f';c.fillRect(X-3,HOR-h,6,h-6);c.fillStyle='#fff';c.fillRect(X-3,HOR-h+4,6,3);
    c.fillStyle='rgba(240,240,240,.7)';for(let i=0;i<4;i++){c.beginPath();c.arc(X+i*5,HOR-h-4-i*6,3+i*2,0,7);c.fill();}});
  // Wasserturm
  const wx=W*.86;c.fillStyle='#9aa4ae';c.fillRect(wx-2,HOR-40,4,34);c.fillStyle='#8DC63F';c.beginPath();c.ellipse(wx,HOR-44,12,8,0,0,7);c.fill();
  c.fillStyle='#fff';c.font='900 5px sans-serif';c.textAlign='center';c.fillText('LUDLEIN',wx,HOR-42);
}
const PRING=[];for(let i=0;i<32;i++)PRING.push([0,0,0]);let PRI=0;
function proj(x,z,y=0){const s=CAMD/(z+CAMD),a=PRING[PRI=(PRI+1)&31];a[0]=CX+x*U*s;a[1]=HOR+(GY-HOR)*s-y*U*s;a[2]=s;return a;}

/* ================= WELT ================= */
const FIRMS=[['Ludleiner Maschinenbau','Maschinenbau'],['Hallmeier Anlagenbau','Anlagenbau'],['Kraft Baustoffe','Bauzulieferer'],['Ziegelwerk Ludlein','Bauzulieferer'],['Süd-Handel KG','Handel'],['Großhandel Ludlein','Handel'],['Brenner Pumpentechnik','Maschinenbau'],['Wagner Fördertechnik','Maschinenbau'],['Holzbau Ritter','Bau'],['Steiner Armaturen','Handel'],['Ludlein Logistik','Logistik'],['Elektro Ostertag','Elektrotechnik'],['Fischer Antriebe','Maschinenbau'],['Bau-Center Ludlein','Handel']];
const STAT=[['Lead','#2f8cff'],['Opportunity','#ff9a2e'],['Angebot','#a35cff'],['Kunde','#5fae22']];
const TERM=['Mo 09:00','Di 14:30','Mi 10:15','Do 11:00','Fr 08:30','heute 16:00'];
let state='menu',G=null,P=null,objs=[],blds=[],deco=[],parts=[],floats=[],wd=0,lastEnd=[0,0],decoZ=0,time=0;
function resetWorld(){objs=[];blds=[];deco=[];parts=[];floats=[];lastEnd=[-3,-3];decoZ=0;fillBuildings();}
function newSite(side,z0){
  const t=Math.random()<.17?'lot':pick(['hall','hall','office','shop','depot']);
  const L={hall:[7,10],office:[4.5,6],shop:[5.5,7.5],depot:[8,11],lot:[5,7]}[t];
  const Hh={hall:[3,3.5],office:[4.2,5.2],shop:[2.4,2.8],depot:[2.7,3.1],lot:[0,0]}[t];
  const f=pick(FIRMS);
  const b={side,z0,len:rnd(L[0],L[1]),h:rnd(Hh[0],Hh[1]),t,firm:f[0],br:f[1],st:pick(STAT),val:(ri(18)+2)*25,term:pick(TERM),
    acc:pick(['#2f8cff','#e0452e','#5fae22','#f0a020','#6a5acd','#0f9d9a']),wall:pick(['#cfd6de','#d9dde2','#c4ccd6','#e1e4e8','#d6d2c8'])};
  if(t==='lot'){b.cars=[];const n=2+ri(2);for(let i=0;i<n;i++)b.cars.push({dz:(i+.5)*b.len/n,col:pick(['#e9edf2','#2b3440','#7a8794','#1f4f8a','#a7b1bb','#5a6b3a']),hilti:Math.random()<.2});}
  return b;
}
function fillBuildings(){for(const si of [0,1]){const side=si?1:-1;while(lastEnd[si]<SPAWNZ+12){const b=newSite(side,lastEnd[si]+rnd(.4,1.4));blds.push(b);lastEnd[si]=b.z0+b.len;}}}
function moveWorld(dz){
  wd+=dz;for(const b of blds)b.z0-=dz;lastEnd[0]-=dz;lastEnd[1]-=dz;
  keep(blds,b=>b.z0+b.len>-3);fillBuildings();
  decoZ-=dz;
  while(decoZ<SPAWNZ){decoZ+=9;deco.push({t:'lamp',x:-2.2,z:decoZ},{t:'lamp',x:2.2,z:decoZ+4.5});
    if(Math.random()<.45)deco.push({t:pick(['tree','tree','hydrant','ped','pallet','bollard']),x:pick([-2.32,2.32]),z:decoZ+2.2,v:ri(4)});
    if(Math.random()<.07)deco.push({t:'ortsschild',x:pick([-2.3,2.3]),z:decoZ+6.5});}
  for(const d of deco)d.z-=dz;keep(deco,d=>d.z>-2.6);
}

/* ================= SPIEL ================= */
function charObj(){return CHARS.find(c=>c.id===S.char)||CHARS[0];}
function puDur(k){return (6+S.up[k]*1.6)*(S.char==='holger'?1.4:1);}
const LOSS={excel:'Excel-Chaos',banner:'Medienbruch',silo:'Datensilo',fork:'Gabelstapler',van:'Lieferverkehr',passat:'Hilti-Passat'};
function startGame(demo){
  demo=demo===true;const ch=charObj();
  G={dist:0,v:13,rev:0,leads:0,bucket:0,opps:0,oppsTot:0,deals:0,lives:ch.id==='stefan'?4:3,maxL:ch.id==='stefan'?4:3,
     pu:{sap:0,ki:0,fc:0,ol:0},puN:0,bust:0,stolen:0,boss:null,bossN:0,nextBoss:1300,untilRow:26,gap:17,shown:{},t:0,dead:0,shake:0,flash:0,
     combo:0,comboT:0,misDone:{},hitN:0,eggs:0,demo,dsi:0,apT:0,demoEndAt:0,demoEnd:0};
  if(demo)G.nextBoss=640;
  $('#demoTag').hidden=!demo;
  P={lane:1,x:0,y:0,vy:0,slide:0,run:0,inv:0};
  resetWorld();
  state='play';boss=false;
  showScr(null);$('#hud').classList.add('on');
  hudCache={};updHud(true);
  musicOn=true;
  if(demo)toast('🎬 DEMO','So läuft eine Kundentour in Ludlein');else toast('Kundentour Ludlein!','Sammle Leads – schließ Deals ab!');
}
function pickObs(d){
  const w=[['excel',3],['banner',2.4],['silo',2],['fork',d>.06?2.4:0],['van',d>.28?1.4:0]];
  let t=w.reduce((a,b)=>a+b[1],0)*Math.random();for(const [k,v] of w){if((t-=v)<0)return k;}return 'excel';
}
function addObs(type,lane,z){
  const o={type,lane,x:LANES[lane],z,y:0,vz:0,ph:Math.random()*6};
  if(type==='fork')o.vz=1.5;if(type==='van')o.vz=6.5;if(type==='passat')o.vz=7;
  objs.push(o);return o;
}
function addLeads(lane,z,n,mode,oz){
  for(let i=0;i<n;i++){
    const zz=z+(i-(n-1)/2)*1.7;let y=.5;
    if(mode==='arc'){const k=(zz-oz)/((n-1)/2*1.7+.01);y=.5+1.15*Math.max(0,1-k*k);}
    if(mode==='low')y=.32;
    objs.push({type:'lead',lane,x:LANES[lane],z:zz,y,ph:i*.6});
  }
}
function spawnRow(){
  const z=SPAWNZ,d=Math.min(1,G.dist/3500);
  if(G.boss){if(Math.random()<.6){let l;do{l=ri(3);}while(l===G.boss.lane);addLeads(l,z,4);}return;}
  const free=ri(3),obs=[null,null,null];
  let sc=null;if(G.demo){const it=DEMO_SCRIPT[G.dsi];if(it&&G.dist>=it.d){sc=it;G.dsi++;}}
  for(let l=0;l<3;l++)if(l!==free&&Math.random()<(G.demo?.32+.3*d:.42+.42*d))obs[l]=pickObs(d);
  if(Math.random()<.22+.25*d)obs[free]=Math.random()<.5?'excel':'banner';
  if(obs.every(o=>!o)&&G.dist>60)obs[(free+1)%3]=pickObs(d);
  if(!G.demo&&G.dist>250&&Math.random()<.045){obs[pick([0,1,2].filter(l=>l!==free))]='passat';}
  if(sc&&sc.t==='passat'){const l=pick([0,1,2].filter(l=>l!==free));obs[l]='passat';}
  if(sc&&sc.t==='hit'){obs[free]='silo';}
  if(sc&&sc.msg)toast(sc.msg,sc.sub||'');
  obs.forEach((t,l)=>{if(t){const o=addObs(t,l,z);if(sc&&sc.t==='hit'&&l===free)o.demoHit=1;}});
  if(obs[free]==='excel')addLeads(free,z,5,'arc',z);
  else if(obs[free]==='banner')addLeads(free,z,4,'low');
  else addLeads(free,z+(Math.random()<.5?0:3),5);
  if(Math.random()<.35){const l2=[0,1,2].find(l=>l!==free&&obs[l]==='excel');if(l2!==undefined)addLeads(l2,z,5,'arc',z);}
  const empty=[0,1,2].filter(l=>!obs[l]&&l!==free);
  const pz=z+G.gap*.5;
  if(sc&&sc.t==='pu'){objs.push({type:'pu',k:sc.k,lane:free,x:LANES[free],z:pz,y:.75,ph:0});}
  else if(G.demo&&G.opps>0&&!objs.some(o=>o.type==='offer')){objs.push({type:'offer',lane:free,x:LANES[free],z:pz,y:.7,ph:0});}
  else if(G.demo){}
  else if(Math.random()<.085){const l=pick([free,...empty]);objs.push({type:'pu',k:pick(Object.keys(PU)),lane:l,x:LANES[l],z:pz,y:.75,ph:0});}
  else if(Math.random()<(G.opps>0?.3:.06)){const l=pick([free,...empty]);objs.push({type:'offer',lane:l,x:LANES[l],z:pz,y:.7,ph:0});}
}
function startBoss(){
  G.boss={t:0,lane:1,x:0,z:70,xs:0,drop:2.2,nx:2.6,lt:2,out:0};boss=true;
  toast('⚠ DER EXCEL-LASTER!','Sammle 3 itmX-X für die Integration');SFX.boss();
}
function bossUpdate(dt){
  const b=G.boss;b.t+=dt;
  if(b.out){b.out+=dt;b.z+=dt*(b.esc?18:30);b.spin=(b.spin||0)+dt*(b.esc?0:6);if(b.out>2.2){G.boss=null;boss=false;}return;}
  b.z+=(15-b.z)*Math.min(1,dt*1.5);
  b.lt-=dt;if(b.lt<=0){let l;do{l=ri(3);}while(l===b.lane);b.lane=l;b.lt=rnd(1.3,2.4);}
  b.x+=(LANES[b.lane]-b.x)*Math.min(1,dt*4);
  if(b.z<19){
    b.drop-=dt;if(b.drop<=0){const o=addObs(Math.random()<.7?'excel':'silo',b.lane,b.z-1);o.x=b.x;b.drop=Math.max(.75,1.5-b.t*.02);}
    b.nx-=dt;if(b.nx<=0){let l;do{l=ri(3);}while(l===b.lane);objs.push({type:'xtok',lane:l,x:LANES[l],z:b.z-2,y:.7,ph:0});b.nx=2.4;}
  }
  if(b.t>30){b.out=.01;b.esc=1;toast('Der Excel-Laster ist weg…','Beim nächsten Mal!');if(G.demo)G.demoEndAt=G.dist+110;}
}
function bustBoss(){
  const b=G.boss;b.out=.01;G.bossN++;const v=50000*(G.pu.fc>0?2:1);G.rev+=v;
  toast('EXCEL-LASTER GESTOPPT!','+'+fmt(v)+' € · Integration statt Excel');SFX.win();
  for(let i=0;i<60;i++)burst(CX,H*.4,pick(['#8DC63F','#F5C542','#fff','#2f8cff']),1);
  showFact('silo');G.nextBoss=G.dist+1700;checkMis();if(G.demo)G.demoEndAt=G.dist+110;
}
function eggFound(){
  G.eggs++;if(!G.demo){S.eggs=(S.eggs||0)+1;save();}const v=2000*(G.pu.fc>0?2:1);G.rev+=v;
  toast('🥚 EASTER EGG!','Roter Hilti-Passat · +'+fmt(v)+' €');SFX.win();
  for(let i=0;i<30;i++)burst(CX,H*.5,pick(['#d0101b','#fff','#F5C542']),.8);
}
function onHit(o){
  o.hitP=1;
  if(P.inv>0)return;
  if(G.pu.ki>0){bust(o);return;}
  if(G.pu.ol>0){G.pu.ol=0;o.dead=1;toast('Abgefangen!','officeXperience-Schild');SFX.bust();burstAt(o,'#28b4e8');P.inv=.6;return;}
  G.lives-=(G.demo&&G.lives<=1)?0:1;G.hitN++;P.inv=1.7;G.shake=.35;G.flash=.4;SFX.hit();
  const name=LOSS[o.type]||'Hindernis';
  const st=G.bucket;G.stolen+=st;G.bucket=0;let lostOpp=0;
  if(G.opps>0&&o.type!=='excel'){G.opps--;lostOpp=1;}
  if(G.lives<=0){G.dead=1;toast('Deal geplatzt!','');musicOn=false;return;}
  const lost=[st?st+' Leads':'',lostOpp?'1 Opportunity':''].filter(Boolean).join(' + ');
  toast(lost?name+': '+lost+' weg!':'Autsch! '+name,G.hitN===1?'Ohne CRM gehen Kundendaten verloren':'');
}
function bust(o){
  o.fly={vx:(o.x<P.x?-1:1)*rnd(4,8)+rnd(-2,2),vy:rnd(6,9),r:0};G.bust++;
  const v=1500*(G.pu.fc>0?2:1);G.rev+=v;floatTxt(o,'WEGGERÄUMT +'+fmt(v),'#c99bff');SFX.bust();burstAt(o,'#F5C542');checkMis();
}
function collect(o){
  o.dead=1;const fc=G.pu.fc>0?2:1;
  if(o.type==='lead'){
    G.leads++;G.bucket++;G.rev+=100*fc;G.combo=G.comboT>0?G.combo+1:0;G.comboT=.5;SFX.lead(G.combo);
    burstAt(o,'#5fb0ff',5);
    if(G.bucket>=10){G.bucket-=10;G.opps++;G.oppsTot++;SFX.opp();pulse('#stOpps');floatTxt(o,'Opportunity!','#8DC63F',1);
      if(!G.shown.pipe&&G.oppsTot===1)showFact('pipe');}
  }else if(o.type==='offer'){
    if(G.opps>0){G.opps--;G.deals++;let v=(20000+2500*G.deals)*fc*(S.char==='michael'?1.5:1);G.rev+=v;SFX.deal();pulse('#stDeals');
      toast('DEAL GEWONNEN!','+'+fmt(v)+' €');for(let i=0;i<30;i++)burst(CX,H*.55,pick(['#8DC63F','#F5C542','#fff']),.8);
      if(G.deals===1)setTimeout(()=>state==='play'&&showFact(pick(['fc','web','mob'])),1600);}
    else{G.rev+=250*fc;floatTxt(o,'Erst Leads qualifizieren!','#ffd27a');SFX.click();}
  }else if(o.type==='pu'){
    G.pu[o.k]=puDur(o.k);G.puN++;SFX.pu();burstAt(o,PU[o.k].c,14);floatTxt(o,PU[o.k].n,PU[o.k].c,1);
    if(!G.shown[o.k])showFact(o.k);
  }else if(o.type==='xtok'){
    G.boss&&G.boss.xs++;SFX.pu();burstAt(o,'#8DC63F',16);
    if(G.boss){floatTxt(o,'Integration '+G.boss.xs+'/3','#8DC63F',1);if(G.boss.xs>=3)bustBoss();}
  }
  checkMis();
}
function step(dt){
  const ki=G.pu.ki>0;
  if(!G.dead)G.v=Math.min(22,9+G.dist/170)*(ki?1.35:1);
  const dz=G.dead?0:G.v*dt;
  G.dist+=dz;moveWorld(dz);
  P.x+=(LANES[P.lane]-P.x)*Math.min(1,dt*15);
  P.vy-=26*dt;P.y+=P.vy*dt;if(P.y<=0){P.y=0;P.vy=0;}
  if(P.slide>0)P.slide-=dt;if(P.inv>0)P.inv-=dt;
  P.run+=dt*(5+G.v*.35);
  for(const k in G.pu)if(G.pu[k]>0)G.pu[k]=Math.max(0,G.pu[k]-dt);
  if(G.comboT>0)G.comboT-=dt;
  G.gap=Math.max(8.5,14-G.dist/450);
  G.untilRow-=dz;if(G.untilRow<=0){spawnRow();G.untilRow=G.gap;}
  if(!G.boss&&G.dist>=G.nextBoss)startBoss();
  if(G.boss)bossUpdate(dt);
  const mag=G.pu.sap>0;
  for(const o of objs){
    if(o.fly){o.x+=o.fly.vx*dt;o.y+=o.fly.vy*dt;o.fly.vy-=20*dt;o.fly.r+=dt*8;o.z-=dz;continue;}
    o.z-=dz+(o.vz||0)*dt;o.ph+=dt*4;
    if(mag&&(o.type==='lead'||o.type==='offer'||o.type==='xtok')&&o.z<15&&o.z>-.5){
      o.x+=(P.x-o.x)*Math.min(1,dt*9);o.y+=(P.y+.6-o.y)*Math.min(1,dt*9);o.z-=dt*10;}
    if(o.type==='passat'&&!o.egg&&!o.hitP&&o.z<-1&&!G.dead){o.egg=1;eggFound();}
    if(o.dead||G.dead)continue;
    const dx=Math.abs(o.x-P.x);
    if(o.type==='lead'||o.type==='offer'||o.type==='pu'||o.type==='xtok'){
      if(Math.abs(o.z)<.75&&dx<.72&&Math.abs(o.y-(P.y+.55))<(P.slide>0?.7:1))collect(o);continue;
    }
    const half=(o.type==='van'||o.type==='passat')?1.0:o.type==='silo'?.55:o.type==='fork'?.6:.42;
    if(o.z<half&&o.z>-half&&dx<.78){
      let hit=true;
      if(o.type==='excel'&&P.y>.62)hit=false;
      if(o.type==='banner'&&P.slide>0)hit=false;
      if(hit&&(ki||P.inv<=0))onHit(o);
    }
  }
  keep(objs,o=>!o.dead&&o.z>-3&&o.y>-4);
}

/* ================= DEMO-MODUS ================= */
const DEMO_SCRIPT=[
 {d:70,msg:'Leads sammeln',sub:'Jeder blaue Kontakt ist ein potenzieller Kunde'},
 {d:150,t:'pu',k:'sap'},
 {d:290,t:'hit',msg:'Achtung: Datensilo!',sub:'Was passiert ohne CRM?'},
 {d:370,t:'passat'},
 {d:430,t:'pu',k:'ki'},
 {d:520,t:'pu',k:'fc'},
 {d:590,t:'pu',k:'ol'}
];
function autopilot(dt){
  if(G.dead||G.demoEnd)return;
  const v=G.v,look=Math.max(13,v*1.4),ki=G.pu.ki>0;
  const L=[0,1,2].map(l=>({l,t:99,val:0,act:null,tAct:99}));
  for(const o of objs){
    if(o.dead||o.fly||o.z<-.6||o.z>look||o.lane==null)continue;
    const A=L[o.lane],t=Math.max(0,o.z)/Math.max(1,v+(o.vz||0)),w=1/(1+t*1.5);
    if(o.type==='lead')A.val+=1.2*w;
    else if(o.type==='offer')A.val+=(G.opps>0?7:.4)*w;
    else if(o.type==='pu')A.val+=6*w;
    else if(o.type==='xtok')A.val+=12*w;
    else if(o.demoHit)A.val+=4*w;
    else if(ki)A.val+=1.5*w;
    else if(o.type==='excel'||o.type==='banner'){if(t<A.tAct){A.tAct=t;A.act=o.type;}A.val-=.15;}
    else if(t<A.t)A.t=t;
  }
  const cur=P.lane,ok=(l,need)=>ki||(L[l].t>need&&(l===cur||L[l].tAct>.42));
  const path=(a,b)=>{const d=b>a?1:-1;for(let l=a+d;;l+=d){if(!ok(l,l===b?.95:.5))return false;if(l===b)return true;}};
  G.apT-=dt;
  if(G.apT<=0||(!ki&&L[cur].t<.75)){
    let best=cur,bs=-1e9;
    for(const A of L){if(A.l!==cur&&!path(cur,A.l))continue;
      const sc=A.val+Math.min(ki?3:A.t,3)*1.6-Math.abs(A.l-cur)*.35+(A.l===cur?.25:0);
      if(sc>bs){bs=sc;best=A.l;}}
    if(!ki&&L[best].t<.75){let bt=-1;for(const A of L)if(Math.abs(A.l-cur)===1&&A.t>bt){bt=A.t;best=A.l;}}
    if(best!==cur){act(best>cur?'r':'l',true);G.apT=.22;}else G.apT=.12;
  }
  const C=L[P.lane];
  if(C.act==='excel'&&C.tAct<.34&&C.tAct>.1&&P.y<=.02)act('u',true);
  else if(C.act==='banner'&&C.tAct<.3&&P.slide<=0)act('d',true);
}
function demoTick(){
  if(G.demoEndAt&&!G.demoEnd&&G.dist>=G.demoEndAt||(!G.demoEnd&&G.t>140)){
    G.demoEnd=G.t;toast('🎬 Demo beendet','Jetzt bist du dran!');SFX.win();
  }
  if(G.demoEnd&&G.t-G.demoEnd>2.4)gameOver();
}
function update(dt){
  time+=dt;
  if(state==='play'){
    G.t+=dt;
    if(G.demo){autopilot(dt);demoTick();if(state!=='play')return;}
    const n=Math.max(1,Math.ceil(G.v*dt/.3));for(let i=0;i<n;i++)step(dt/n);
    if(G.dead){G.dead+=dt;if(G.dead>1.3)gameOver();}
    if(G.shake>0)G.shake-=dt;if(G.flash>0)G.flash-=dt;
    updHud();
  }else if(state==='menu'||state==='over'){
    moveWorld(dt*6);P=P||{lane:1,x:0,y:0,vy:0,slide:0,run:0,inv:0};P.run+=dt*5;P.x+=(0-P.x)*dt*4;
  }
  for(const p of parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=600*dt;p.l-=dt;}
  keep(parts,p=>p.l>0);if(parts.length>160)parts.splice(0,parts.length-160);
  for(const f of floats){f.y-=40*dt;f.l-=dt;}keep(floats,f=>f.l>0);
  musicTick();
}

/* ================= ZEICHNEN ================= */
const FONT='ui-rounded,-apple-system,BlinkMacSystemFont,sans-serif';
function keep(a,f){let j=0;for(let i=0;i<a.length;i++){const v=a[i];if(f(v))a[j++]=v;}a.length=j;}
function rr(c,x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function quad(a,b,c2,d,fill){ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c2[0],c2[1]);ctx.lineTo(d[0],d[1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function line3(x1,z1,y1,x2,z2,y2){const a=proj(x1,z1,y1),b=proj(x2,z2,y2);ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}
function txt(t,x,y,size,col,weight=800,align='center',maxW){if(size<4)return;size=Math.round(size);ctx.font=weight+' '+size+'px '+FONT;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=col;maxW?ctx.fillText(t,x,y,maxW):ctx.fillText(t,x,y);}
function shade(c,p){const n=parseInt(c.slice(1),16);const f=v=>Math.max(0,Math.min(255,Math.round(v+p*2.55)));return 'rgb('+f(n>>16)+','+f((n>>8)&255)+','+f(n&255)+')';}
function star(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr2=i%2?r*.35:r;ctx.lineTo(x+Math.cos(a)*rr2,y+Math.sin(a)*rr2);}ctx.closePath();ctx.fill();}
function shadow(x,y,w,a=.3){ctx.fillStyle='rgba(0,0,0,'+a+')';ctx.beginPath();ctx.ellipse(x,y,w,w*.28,0,0,7);ctx.fill();}

/* ================= SPRITES (einmal zeichnen, dann nur noch kopieren) ================= */
const SPR=2.2,sprCache=new Map();
function mkSprite(wU,hU,ax,ay,fn){const c=document.createElement('canvas');c.width=Math.ceil(wU*100*SPR);c.height=Math.ceil(hU*100*SPR);
  const cx=c.getContext('2d');cx.setTransform(SPR,0,0,SPR,0,0);const old=ctx;ctx=cx;try{fn(ax*100,ay*100,100/U);}finally{ctx=old;}return {c,wU,hU,ax,ay};}
function sprite(key,wU,hU,ax,ay,fn){let e=sprCache.get(key);if(!e){e=mkSprite(wU,hU,ax,ay,fn);sprCache.set(key,e);}return e;}
function blit(e,x,y,s){const u=U*s;ctx.drawImage(e.c,x-e.ax*u,y-e.ay*u,e.wU*u,e.hU*u);}
const glowCache={};
function glow(col,x,y,R,a=1){let g=glowCache[col];if(!g){g=document.createElement('canvas');g.width=g.height=128;const c=g.getContext('2d'),gr=c.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,col);gr.addColorStop(.45,col.length===7?col+'88':col);gr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gr;c.fillRect(0,0,128,128);glowCache[col]=g;}
  if(a!==1)ctx.globalAlpha*=a;ctx.drawImage(g,x-R,y-R,2*R,2*R);if(a!==1)ctx.globalAlpha/=a;}
function drawGround(){
  ctx.fillStyle='#7aa25e';ctx.fillRect(0,HOR,W,H-HOR);
  const zf=90,zn=-2.85;
  quad(proj(-WALLX,zn),proj(-WALLX,zf),proj(WALLX,zf),proj(WALLX,zn),'#cdd1d4');
  ctx.strokeStyle='rgba(110,115,120,.35)';ctx.lineWidth=1;ctx.beginPath();
  for(let k=0;k<45;k++){const z=k*1.2-(wd%1.2)-2;if(z<zn)continue;for(const sd of [-1,1])line3(sd*ROADW,z,0,sd*WALLX,z,0);}ctx.stroke();
  quad(proj(-ROADW,zn),proj(-ROADW,zf),proj(ROADW,zf),proj(ROADW,zn),'#474c57');
  for(const sd of [-1,1])quad(proj(sd*ROADW,zn),proj(sd*ROADW,zf),proj(sd*(ROADW+.12),zf),proj(sd*(ROADW+.12),zn),'#eceae4');
  // Asphaltflicken und Kanaldeckel
  for(const [off,lx,per] of [[40,-.95,55],[12,.9,47]]){const mz=off-(wd%per);if(mz>-2&&mz<70){const [x,y,s]=proj(lx,mz);ctx.fillStyle='#3a3e47';ctx.beginPath();ctx.ellipse(x,y,.22*U*s,.065*U*s,0,0,7);ctx.fill();ctx.strokeStyle='#2c3038';ctx.lineWidth=Math.max(1,s*2);ctx.stroke();}}
  for(let k=0;k<20;k++){const z=k*5-(wd%5)-2.8;if(z>zf)break;
    for(const lx of [-.625,.625]){if(z+2.2<zn)continue;const z2=Math.max(z,zn);quad(proj(lx-.05,z2),proj(lx-.05,z+2.2),proj(lx+.05,z+2.2),proj(lx+.05,z2),'rgba(255,255,255,.75)');}}
  const cz=60-(wd%120);if(cz>-2&&cz<85)for(let i=-6;i<6;i++){const x=i*.32+.08;quad(proj(x,cz),proj(x,cz+1.2),proj(x+.16,cz+1.2),proj(x+.16,cz),'rgba(255,255,255,.8)');}
}
function drawSite(b){
  const xw=b.side*WALLX,zn=Math.max(b.z0,-2.8),zf=b.z0+b.len;if(zf<=zn)return;
  const s0=proj(xw,zn)[2],lw=Math.max(1,1.6*s0);
  const Q=(z1,z2,y1,y2,c)=>{if(z2<-2.8)return;z1=Math.max(z1,-2.8);quad(proj(xw,z1,y1),proj(xw,z2,y1),proj(xw,z2,y2),proj(xw,z1,y2),c);};
  if(b.t==='lot'){
    const xo=b.side*(WALLX+3.4);
    quad(proj(xw,zn),proj(xw,zf),proj(xo,zf),proj(xo,zn),'#5d636c');
    ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=lw;ctx.beginPath();
    const n=b.cars.length;for(let i=0;i<=n;i++){const z=b.z0+i*b.len/n;if(z<-2.8)continue;line3(b.side*(WALLX+.5),z,0,b.side*(WALLX+2.8),z,0);}ctx.stroke();
    for(let i=n-1;i>=0;i--){const c=b.cars[i],z=b.z0+c.dz;if(z<-1.2)continue;const [x,y,s]=proj(b.side*(WALLX+1.65),z);
      if(c.hilti)drawPassat(x,y,s*.85);else drawCarFront(x,y,s*.8,{col:c.col});}
    ctx.strokeStyle='#8a939c';ctx.lineWidth=lw;ctx.beginPath();line3(xw,zn,.55,xw,zf,.55);line3(xw,zn,.15,xw,zf,.15);
    for(let z=Math.ceil(b.z0);z<zf;z+=1){if(z<-2.8)continue;line3(xw,z,0,xw,z,.6);}ctx.stroke();
    const sz=b.z0+.4;if(sz>-.5){const [x,y,s]=proj(b.side*(WALLX-.1),sz);const u=U*s;if(s>.08){ctx.fillStyle='#3a4450';ctx.fillRect(x-.03*u,y-1.3*u,.06*u,1.3*u);
      blit(sprite('psign',.6,.72,.3,1.78,(x,y)=>{const u=100;ctx.fillStyle='#1f5fbf';rr(ctx,x-.25*u,y-1.75*u,.5*u,.5*u,.06*u);ctx.fill();txt('P',x,y-1.5*u,.36*u,'#fff',900);txt('Besucher',x,y-1.18*u,.09*u,'#1b2533',800);}),x,y,s);}}
    return;
  }
  const h=b.h;
  quad(proj(xw,zn),proj(xw,zf),proj(xw,zf,h),proj(xw,zn,h),b.wall);
  Q(b.z0,zf,0,.3,'rgba(0,0,0,.12)');
  if(b.t==='hall'){
    ctx.strokeStyle='rgba(0,0,0,.09)';ctx.lineWidth=lw;ctx.beginPath();
    const stp=s0>.25?.36:s0>.12?.6:1.2;for(let z=b.z0;z<zf;z+=stp){if(z<-2.8)continue;line3(xw,z,.3,xw,z,h-.42);}ctx.stroke();
    Q(b.z0,zf,h-.42,h-.12,b.acc);
    Q(b.z0,zf,h-1.05,h-.6,'#86abd0');
    ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=lw;ctx.beginPath();for(let z=b.z0;z<zf;z+=.8){if(z<-2.8)continue;line3(xw,z,h-1.05,xw,z,h-.6);}ctx.stroke();
    const dz=b.z0+b.len*.3;
    Q(dz-.08,dz+2.28,0,2.38,'#4a5562');Q(dz,dz+2.2,0,2.3,'#a3acb6');
    ctx.strokeStyle='rgba(0,0,0,.22)';ctx.lineWidth=lw;ctx.beginPath();for(let y=.3;y<2.3;y+=.3){if(dz+2.2<-2.8)break;line3(xw,Math.max(dz,-2.8),y,xw,dz+2.2,y);}ctx.stroke();
    Q(dz+.2,dz+2,1.5,1.75,'rgba(40,60,90,.55)');
    Q(dz+3,dz+3.7,0,1.75,'#56626f');Q(dz+3.05,dz+3.65,1.1,1.6,'#86abd0');
    Q(dz+.9,dz+1.3,2.45,2.6,'#ffcc00');
    for(let z=b.z0;z<zf-1.6;z+=1.9){if(z<-2.8)continue;const p1=proj(xw,z,h),p2=proj(xw,z+.35,h+.9),p3=proj(xw,z+1.9,h),p4=proj(xw,z+.35,h);
      ctx.fillStyle='#8d99a6';ctx.beginPath();ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.lineTo(p3[0],p3[1]);ctx.closePath();ctx.fill();
      ctx.fillStyle='#bcd6ee';ctx.beginPath();ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.lineTo(p4[0],p4[1]);ctx.closePath();ctx.fill();}
    if(b.len>8){const cz=b.z0+b.len*.8;if(cz>-1){const [x,y,s]=proj(b.side*(WALLX+.9),cz,h);const u=U*s;
      ctx.fillStyle='#a6512f';ctx.fillRect(x-.12*u,y-1.6*u,.24*u,1.6*u);ctx.fillStyle='#fff';ctx.fillRect(x-.12*u,y-1.45*u,.24*u,.1*u);ctx.fillRect(x-.12*u,y-1.2*u,.24*u,.1*u);
      if(!LOWFX){ctx.fillStyle='rgba(235,235,235,.6)';for(let i=0;i<3;i++){const t=(time*.4+i/3)%1;ctx.beginPath();ctx.arc(x+t*.5*u,y-(1.7+t*1.2)*u,(.12+t*.25)*u,0,7);ctx.fill();}}}}
  }else if(b.t==='office'){
    Q(b.z0,zf,.35,h-.25,'#4f7aa6');
    for(let z=b.z0+.4;z<zf-.6;z+=2.3)Q(z,z+.5,.6,h-.6,'rgba(255,255,255,.18)');
    for(let z=b.z0+.2;z<zf-.5;z+=1.5){if(((z*7)|0)%3===0)Q(z,z+.5,1.3,2.1,'rgba(255,225,150,.55)');}
    ctx.strokeStyle='#e9eef3';ctx.lineWidth=lw;ctx.beginPath();
    for(let z=b.z0;z<=zf+.01;z+=.75){if(z<-2.8)continue;line3(xw,z,.35,xw,z,h-.25);}
    for(let y=.35;y<h-.2;y+=.9)line3(xw,zn,y,xw,zf,y);ctx.stroke();
    Q(b.z0,zf,h-.25,h,b.acc);
    const ez=b.z0+b.len*.5-.5;Q(ez,ez+1,0,1.3,'#2b3f57');Q(ez+.48,ez+.52,0,1.3,'#9fb3c9');Q(ez-.2,ez+1.2,1.3,1.42,'#e9eef3');
  }else if(b.t==='shop'){
    Q(b.z0,zf,0,h*.55,b.acc);Q(b.z0,zf,h*.55,h*.6,'rgba(0,0,0,.15)');
    Q(b.z0,zf,h-.3,h,'#3b3f45');
    const oz=b.z0+.6;Q(oz,oz+b.len*.45,0,1.5,'#2e2a26');
    for(let i=0;i<4;i++){const z1=oz+.1+i*b.len*.11,z2=z1+b.len*.08;Q(z1,z2,.1,.6,'#b0703a');Q(z1,z2,.7,1.2,'#c9a26b');Q(z1,z2,.65,.7,'#7a5230');}
    Q(oz+b.len*.55,oz+b.len*.85,.6,1.6,'#a9c7e2');Q(oz+b.len*.55,oz+b.len*.85,1.55,1.65,'#3b3f45');
  }else{
    Q(b.z0,zf,h-.35,h,b.acc);
    for(let z=b.z0+.4;z<zf-1.2;z+=1.6){
      Q(z-.05,z+1.2,.2,2.15,'#59636e');Q(z,z+1.15,.25,2.1,'#36414d');Q(z,z+1.15,.25,.4,'#f0c419');
      ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=lw;ctx.beginPath();for(let y=.6;y<2.1;y+=.3){if(z+1.15<-2.8)continue;line3(xw,Math.max(z,-2.8),y,xw,z+1.15,y);}ctx.stroke();
      Q(z+.45,z+.7,2.2,2.32,'#ffe08a');Q(z+.1,z+.3,.25,.4,'#222');Q(z+.85,z+1.05,.25,.4,'#222');}
  }
  Q(b.z0,zf,h,h+.08,'rgba(0,0,0,.3)');
  const pz=b.z0+.5;if(pz>-.5){const [x,y,s]=proj(b.side*(WALLX-.12),pz);const u=U*s;if(s>.07){
    ctx.fillStyle='#3a4450';ctx.fillRect(x-.04*u,y-1.4*u,.08*u,1.4*u);
    if(!b.signSpr)b.signSpr=mkSprite(1.29,.76,.645,2.1,(x,y,s)=>{const u=100,bw=1.25*u,bh=.72*u;ctx.fillStyle='#fff';rr(ctx,x-bw/2,y-2.08*u,bw,bh,.06*u);ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.15)';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=b.acc;ctx.fillRect(x-bw/2,y-2.08*u,bw,.13*u);
      const w=b.firm.split(' ');txt(w[0],x,y-1.78*u,.22*u,'#1b2533',900,'center',bw*.92);if(w.length>1)txt(w.slice(1).join(' '),x,y-1.54*u,.16*u,'#5a6675',800,'center',bw*.92);});
    blit(b.signSpr,x,y,s);}}
}
function cardSprite(b){return mkSprite(2.56,1.46,1.28,.73,(x,y)=>{const u=100,w=2.3*u,h=1.2*u;
  ctx.save();ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=10;ctx.shadowOffsetY=3;ctx.fillStyle='rgba(255,255,255,.97)';rr(ctx,x-w/2,y-h/2,w,h,.12*u);ctx.fill();ctx.restore();
  ctx.fillStyle=b.st[1];rr(ctx,x-w/2,y-h/2,.1*u,h,.05*u);ctx.fill();
  const L=x-w/2+.22*u,T=y-h/2;
  if(XIMG.complete)ctx.drawImage(XIMG,L,T+.12*u,.21*u,.21*u*XR);
  txt(b.firm,L+.3*u,T+.24*u,.17*u,'#1b2533',900,'left',w-.62*u);
  txt(b.br+' · Ludlein',L,T+.53*u,.12*u,'#6b7787',700,'left',w*.55);
  ctx.font='900 12px '+FONT;const pw=ctx.measureText(b.st[0]).width+.22*u;
  ctx.fillStyle=b.st[1];rr(ctx,x+w/2-pw-.13*u,T+.43*u,pw,.2*u,.1*u);ctx.fill();txt(b.st[0],x+w/2-pw/2-.13*u,T+.535*u,.12*u,'#fff',900);
  ctx.fillStyle='#e3e8ee';ctx.fillRect(L,T+.71*u,w-.35*u,1.2);
  txt('Umsatz '+b.val+' T€',L,T+.93*u,.13*u,'#1b2533',800,'left');
  txt('📅 '+b.term,x+w/2-.13*u,T+.93*u,.13*u,'#1b2533',800,'right');});}
function drawCard(b){
  if(b.t==='lot')return;const z=b.z0+b.len*.5;if(z<1.2||z>46)return;
  const cx=b.side*(WALLX-.2),P0=proj(cx,z,b.h+1),x=P0[0],y=P0[1],s=P0[2];const u=U*s,w=2.3*u,h=1.2*u;if(w<58)return;
  const al=Math.max(0,Math.min(1,(w-58)/30,(z-1.2)/1.5,(y-h/2-H*.16)/50));if(al<=0)return;
  if(!b.cardSpr)b.cardSpr=cardSprite(b);
  ctx.globalAlpha=al;
  const yr=proj(cx,z,b.h)[1],dot=Math.max(1.5,2*s);ctx.fillStyle='rgba(255,255,255,.85)';
  for(let yy=y+h/2+3;yy<yr-2;yy+=dot*3.5)ctx.fillRect(x-dot/2,yy,dot,dot*1.6);
  ctx.beginPath();ctx.arc(x,yr,Math.max(1.5,.05*u),0,7);ctx.fill();
  blit(b.cardSpr,x,y,s);
  ctx.globalAlpha=1;
}
function drawDeco(d){
  const [x,y,s]=proj(d.x,d.z);const u=U*s;const dir=d.x<0?1:-1;if(s<.04)return;
  if(d.t==='lamp'){ctx.fillStyle='#3a434e';ctx.fillRect(x-.04*u,y-2.6*u,.08*u,2.6*u);ctx.fillRect(x-.07*u,y-.18*u,.14*u,.18*u);
    ctx.strokeStyle='#3a434e';ctx.lineWidth=.06*u;ctx.beginPath();ctx.moveTo(x,y-2.55*u);ctx.quadraticCurveTo(x,y-2.82*u,x+dir*.45*u,y-2.8*u);ctx.stroke();
    ctx.fillStyle='#2b323a';rr(ctx,x+dir*.45*u-.17*u,y-2.86*u,.34*u,.1*u,.04*u);ctx.fill();ctx.fillStyle='#fff2c2';ctx.fillRect(x+dir*.45*u-.13*u,y-2.77*u,.26*u,.03*u);}
  else if(d.t==='tree'){ctx.fillStyle='#6b4a2e';ctx.fillRect(x-.06*u,y-1.1*u,.12*u,1.1*u);
    ctx.fillStyle='#3f7a33';ctx.beginPath();ctx.arc(x,y-1.45*u,.55*u,0,7);ctx.fill();
    ctx.fillStyle='#4f8f3c';ctx.beginPath();ctx.arc(x-.18*u,y-1.55*u,.36*u,0,7);ctx.arc(x+.2*u,y-1.4*u,.32*u,0,7);ctx.fill();
    ctx.fillStyle='#6cb24f';ctx.beginPath();ctx.arc(x-.22*u,y-1.7*u,.16*u,0,7);ctx.fill();
    ctx.fillStyle='#8a939c';ctx.fillRect(x-.25*u,y-.05*u,.5*u,.05*u);}
  else if(d.t==='hydrant'){ctx.fillStyle='#c9302c';rr(ctx,x-.1*u,y-.55*u,.2*u,.55*u,.05*u);ctx.fill();ctx.beginPath();ctx.arc(x,y-.55*u,.1*u,Math.PI,0);ctx.fill();
    ctx.fillRect(x-.17*u,y-.38*u,.34*u,.08*u);ctx.fillStyle='#e8e8e8';ctx.fillRect(x-.1*u,y-.2*u,.2*u,.04*u);}
  else if(d.t==='ped'){const cs=['#2f5d8a','#3a3f4a','#6a4a8a','#2f7a5a'][d.v],wv=Math.sin(time*7)*.5;
    ctx.fillStyle='#2b2f36';ctx.fillRect(x-.1*u,y-.62*u,.08*u,.62*u);ctx.fillRect(x+.02*u,y-.62*u,.08*u,.62*u);
    ctx.fillStyle=cs;rr(ctx,x-.18*u,y-1.2*u,.36*u,.62*u,.09*u);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(x-.06*u,y-1.2*u);ctx.lineTo(x,y-1.08*u);ctx.lineTo(x+.06*u,y-1.2*u);ctx.fill();
    ctx.save();ctx.translate(x+dir*.18*u,y-1.12*u);ctx.rotate(dir*(-2.4+wv));ctx.fillStyle=cs;ctx.fillRect(-.04*u,0,.08*u,.42*u);ctx.fillStyle='#f0c39c';ctx.beginPath();ctx.arc(0,.45*u,.05*u,0,7);ctx.fill();ctx.restore();
    ctx.fillStyle='#222';rr(ctx,x-dir*.28*u,y-.98*u,.16*u,.22*u,.02*u);ctx.fill();ctx.fillStyle='#7fb2e6';ctx.fillRect(x-dir*.28*u+.02*u,y-.96*u,.12*u,.18*u);
    ctx.fillStyle='#f0c39c';ctx.beginPath();ctx.arc(x,y-1.33*u,.13*u,0,7);ctx.fill();
    if(d.v%2===0){ctx.fillStyle='#f5f5f5';ctx.beginPath();ctx.arc(x,y-1.37*u,.15*u,Math.PI,0);ctx.fill();ctx.fillRect(x-.18*u,y-1.38*u,.36*u,.04*u);}
    else{ctx.fillStyle='#5a3b26';ctx.beginPath();ctx.arc(x,y-1.37*u,.13*u,Math.PI,0);ctx.fill();}}
  else if(d.t==='pallet'){ctx.fillStyle='#a8743f';ctx.fillRect(x-.35*u,y-.14*u,.7*u,.14*u);ctx.fillStyle='#7a5230';for(const k of [-.3,-.05,.2])ctx.fillRect(x+k*u,y-.1*u,.1*u,.1*u);
    for(let r=0;r<3;r++)for(let i=0;i<4;i++){ctx.fillStyle=(r+i)%2?'#b5492f':'#c95a3a';ctx.fillRect(x-.33*u+i*.165*u,y-.14*u-(r+1)*.16*u,.16*u,.15*u);}
    ctx.fillStyle='rgba(220,235,255,.3)';ctx.fillRect(x-.34*u,y-.64*u,.68*u,.5*u);}
  else if(d.t==='bollard'){ctx.fillStyle='#6d757e';rr(ctx,x-.06*u,y-.6*u,.12*u,.6*u,.05*u);ctx.fill();ctx.fillStyle='#e8e8e8';ctx.fillRect(x-.06*u,y-.5*u,.12*u,.06*u);ctx.fillStyle='#ff4d2e';ctx.fillRect(x-.06*u,y-.42*u,.12*u,.04*u);}
  else if(d.t==='ortsschild'){ctx.fillStyle='#7a828b';ctx.fillRect(x-.42*u,y-1.5*u,.05*u,1.5*u);ctx.fillRect(x+.37*u,y-1.5*u,.05*u,1.5*u);
    blit(sprite('ortsschild',1.14,.64,.57,2.07,(x,y)=>{const u=100;ctx.fillStyle='#f6c300';rr(ctx,x-.55*u,y-2.05*u,1.1*u,.6*u,.05*u);ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=2.5;rr(ctx,x-.5*u,y-2*u,1*u,.5*u,.04*u);ctx.stroke();
    txt('Ludlein',x,y-1.83*u,.2*u,'#111',900);txt('Gewerbegebiet Süd',x,y-1.63*u,.09*u,'#111',800);}),x,y,s);}
}
function drawLead(o,x,y,s){
  const u=U*s,r=.27*u;shadow(x,proj(o.x,o.z)[1],r*.8,.18);
  y+=Math.sin(o.ph)*.06*u;const c=Math.cos(time*3+o.ph),sx=.28+.72*Math.abs(c);
  ctx.fillStyle='rgba(95,176,255,.22)';ctx.beginPath();ctx.arc(x,y,r*1.4,0,7);ctx.fill();
  ctx.fillStyle='#0d4a9e';ctx.beginPath();ctx.ellipse(x+r*.08*sx*Math.sign(c),y,r*sx,r,0,0,7);ctx.fill();
  const F=sprite('leadface',.56,.56,.28,.28,(X,Y)=>{const r=27;
    const g=ctx.createRadialGradient(X-r*.35,Y-r*.35,r*.1,X,Y,r);g.addColorStop(0,'#a9dcff');g.addColorStop(.6,'#2f8cff');g.addColorStop(1,'#1a62c9');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(X,Y,r*.92,0,7);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=r*.1;ctx.beginPath();ctx.arc(X,Y,r*.76,0,7);ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(X,Y-r*.2,r*.2,0,7);ctx.fill();ctx.beginPath();ctx.ellipse(X,Y+r*.38,r*.36,r*.26,0,Math.PI,0);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.ellipse(X-r*.35,Y-r*.45,r*.25,r*.12,-.6,0,7);ctx.fill();});
  ctx.drawImage(F.c,x-.28*u*sx,y-.28*u,.56*u*sx,.56*u);
  if(sx>.55&&u>16){const bx=x+r*.62*sx,by=y-r*.62;ctx.fillStyle='#5fae22';ctx.beginPath();ctx.arc(bx,by,r*.3,0,7);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=r*.09;ctx.beginPath();ctx.moveTo(bx-r*.13,by);ctx.lineTo(bx-r*.03,by+r*.1);ctx.lineTo(bx+r*.14,by-r*.1);ctx.stroke();}
  if(!LOWFX){const a=time*2+o.ph;star(x+Math.cos(a)*r*1.25,y+Math.sin(a)*r*1.25,r*.22*(.6+.4*Math.sin(time*6+o.ph)),'#fff');}
}
function drawExcel(x,y,s){blit(sprite('excel',1.3,1.38,.65,1.18,excelStatic),x,y,s);if(!LOWFX)excelAnim(x,y,s);}
function excelAnim(x,y,s){const u=U*s,w=1.0*u,h=.72*u;
  for(let i=0;i<2;i++){const t=(time*.8+i*.5)%1;ctx.save();ctx.translate(x+(i?.3:-.3)*w+Math.sin(time*4+i)*w*.06,y-h*1.4-t*h*.8);ctx.rotate(time*4+i*2);ctx.globalAlpha=1-t;ctx.fillStyle='#fff';ctx.fillRect(-w*.05,-w*.065,w*.1,w*.13);
    ctx.fillStyle='#2a9a50';ctx.fillRect(-w*.04,-w*.045,w*.08,w*.015);ctx.restore();}ctx.globalAlpha=1;}
function excelStatic(x,y,s){
  const u=U*s,w=1.0*u,h=.72*u;shadow(x,y,w*.55);
  const bc=['#1f7a3c','#2a9a50','#c0392b','#1d4f91','#f1c40f','#7d3c98'];
  for(let i=0;i<6;i++){const bh=h*(.45+((i*7)%3)*.08);ctx.save();ctx.translate(x-w*.38+i*w*.15,y-h*.85);ctx.rotate((i-2.5)*.06);
    ctx.fillStyle=bc[i];ctx.fillRect(-w*.065,-bh,w*.13,bh);ctx.fillStyle='#fff';ctx.fillRect(-w*.045,-bh*.82,w*.09,bh*.24);ctx.fillStyle='#ddd';ctx.beginPath();ctx.arc(0,-bh*.3,w*.025,0,7);ctx.fill();ctx.restore();}
  const g=ctx.createLinearGradient(0,y-h,0,y);g.addColorStop(0,'#c99a5b');g.addColorStop(1,'#9c6f39');
  ctx.fillStyle=g;rr(ctx,x-w/2,y-h*.85,w,h*.85,w*.04);ctx.fill();
  ctx.strokeStyle='rgba(80,50,20,.45)';ctx.lineWidth=Math.max(1,w*.012);ctx.beginPath();for(let i=1;i<3;i++){ctx.moveTo(x-w/2,y-h*.85+i*h*.28);ctx.lineTo(x+w/2,y-h*.85+i*h*.28);}ctx.stroke();
  ctx.fillStyle='#7a5230';ctx.fillRect(x-w/2,y-h*.85,w*.06,h*.85);ctx.fillRect(x+w*.44,y-h*.85,w*.06,h*.85);
  ctx.fillStyle='#1d7a3c';rr(ctx,x-w*.3,y-h*.68,w*.6,h*.42,w*.05);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=Math.max(1,w*.01);ctx.beginPath();for(let i=1;i<4;i++){ctx.moveTo(x-w*.3+i*w*.15,y-h*.68);ctx.lineTo(x-w*.3+i*w*.15,y-h*.26);}ctx.stroke();
  txt('XLS',x,y-h*.5,h*.24,'#fff',900);
  txt('v17_final_FINAL',x,y-h*.13,h*.09,'#3d2614',800);
}
function drawBanner(x,y,s){blit(sprite('banner',1.45,1.98,.725,1.92,bannerStatic),x,y,s);const u=U*s,w=1.2*u;
  for(const sx of [-1,1]){const px=x+sx*w/2-.04*u;ctx.fillStyle=Math.sin(time*8+sx)>0?'#ffb000':'#7a5200';ctx.beginPath();ctx.arc(px+.04*u,y-1.8*u,.06*u,0,7);ctx.fill();}}
function bannerStatic(x,y,s){
  const u=U*s,w=1.2*u;
  for(const sx of [-1,1]){const px=x+sx*w/2-.04*u;ctx.fillStyle='#fff';ctx.fillRect(px,y-1.75*u,.08*u,1.75*u);ctx.fillStyle='#d8323f';for(let i=0;i<5;i++)ctx.fillRect(px,y-1.75*u+i*.36*u,.08*u,.18*u);
    ctx.fillStyle='#555';ctx.fillRect(px-.04*u,y-.06*u,.16*u,.06*u);
  }
  const by=y-1.05*u;ctx.fillStyle='#fff';rr(ctx,x-w/2,by,w,.13*u,.03*u);ctx.fill();
  ctx.save();ctx.beginPath();ctx.rect(x-w/2,by,w,.13*u);ctx.clip();ctx.fillStyle='#d8323f';for(let i=-1;i<9;i++){ctx.beginPath();ctx.moveTo(x-w/2+i*w/8,by+.13*u);ctx.lineTo(x-w/2+i*w/8+w/16,by);ctx.lineTo(x-w/2+i*w/8+w/8,by);ctx.lineTo(x-w/2+i*w/8+w/16,by+.13*u);ctx.fill();}ctx.restore();
  ctx.fillStyle='#d8323f';rr(ctx,x-w*.42,y-1.62*u,w*.84,.45*u,.05*u);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(1,.02*u);rr(ctx,x-w*.4,y-1.6*u,w*.8,.41*u,.04*u);ctx.stroke();
  txt('MEDIENBRUCH',x,y-1.46*u,.13*u,'#fff',900,'center',w*.76);txt('System A ✕ System B',x,y-1.3*u,.075*u,'#ffd5d8',800);
}
function drawSilo(x,y,s){blit(sprite('silo',1.3,2.74,.65,2.52,siloStatic),x,y,s);}
function siloStatic(x,y,s){
  const u=U*s,w=.95*u,h=2.25*u;shadow(x,y,w*.6);
  ctx.fillStyle='#4b535c';ctx.fillRect(x-w*.42,y-h*.2,w*.07,h*.2);ctx.fillRect(x+w*.35,y-h*.2,w*.07,h*.2);ctx.fillRect(x-w*.04,y-h*.14,w*.08,h*.14);
  const g=ctx.createLinearGradient(x-w/2,0,x+w/2,0);g.addColorStop(0,'#6d7681');g.addColorStop(.35,'#d3dae2');g.addColorStop(1,'#59626d');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-w/2,y-h*.3);ctx.lineTo(x+w/2,y-h*.3);ctx.lineTo(x+w*.1,y-h*.14);ctx.lineTo(x-w*.1,y-h*.14);ctx.fill();
  ctx.fillRect(x-w/2,y-h*.95,w,h*.66);ctx.beginPath();ctx.ellipse(x,y-h*.95,w/2,w*.3,0,Math.PI,0);ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.2)';for(const k of [.4,.6,.8]){ctx.fillRect(x-w/2,y-h*k,w,.04*u);}
  ctx.fillStyle='rgba(255,255,255,.55)';for(const k of [.4,.6,.8])for(let i=0;i<7;i++)ctx.fillRect(x-w*.45+i*w*.15,y-h*k+.012*u,.02*u,.02*u);
  ctx.strokeStyle='#3d444c';ctx.lineWidth=Math.max(1,.025*u);ctx.beginPath();ctx.moveTo(x+w*.28,y-h*.3);ctx.lineTo(x+w*.28,y-h*1.02);ctx.moveTo(x+w*.4,y-h*.3);ctx.lineTo(x+w*.4,y-h*1.02);
  for(let k=.33;k<1;k+=.05){ctx.moveTo(x+w*.28,y-h*k);ctx.lineTo(x+w*.4,y-h*k);}ctx.stroke();
  ctx.beginPath();ctx.moveTo(x-w*.35,y-h*1.06);ctx.lineTo(x+w*.35,y-h*1.06);for(let i=-3;i<=3;i++){ctx.moveTo(x+i*w*.11,y-h*1.06);ctx.lineTo(x+i*w*.11,y-h*.99);}ctx.stroke();
  const ly=y-h*.56;ctx.fillStyle='#ffcc00';ctx.fillRect(x-w/2,ly,w,.26*u);
  ctx.save();ctx.beginPath();ctx.rect(x-w/2,ly,w,.04*u);ctx.rect(x-w/2,ly+.22*u,w,.04*u);ctx.clip();ctx.fillStyle='#111';for(let i=0;i<12;i++)ctx.fillRect(x-w/2+i*w/10,ly,w/20,.26*u);ctx.restore();
  txt('DATENSILO',x,ly+.13*u,.12*u,'#111',900,'center',w*.95);
  ctx.fillStyle='#c79a14';rr(ctx,x-.09*u,y-h*.75,.18*u,.14*u,.02*u);ctx.fill();ctx.strokeStyle='#c79a14';ctx.lineWidth=.03*u;ctx.beginPath();ctx.arc(x,y-h*.75,.06*u,Math.PI,0);ctx.stroke();
}
function drawFork(o,x,y,s){blit(sprite('fork',1.25,2.36,.625,2.14,forkStatic),x,y,s);const u=U*s,on=Math.sin(time*10)>0;
  ctx.fillStyle=on?'#ff8c00':'#a85a00';ctx.beginPath();ctx.arc(x,y-1.86*u,.07*u,0,7);ctx.fill();
  if(on){ctx.fillStyle='rgba(255,140,0,.25)';ctx.beginPath();ctx.arc(x,y-1.86*u,.2*u,0,7);ctx.fill();}}
function forkStatic(x,y,s){
  const u=U*s;shadow(x,y,.55*u,.35);
  ctx.fillStyle='#f2b705';rr(ctx,x-.5*u,y-.66*u,1*u,.52*u,.08*u);ctx.fill();ctx.fillStyle='#d99a00';ctx.fillRect(x-.5*u,y-.22*u,1*u,.06*u);
  ctx.fillStyle='#222';ctx.fillRect(x-.2*u,y-.5*u,.4*u,.12*u);
  ctx.fillStyle='#111';rr(ctx,x-.54*u,y-.28*u,.22*u,.28*u,.05*u);ctx.fill();rr(ctx,x+.32*u,y-.28*u,.22*u,.28*u,.05*u);ctx.fill();
  ctx.fillStyle='#777';ctx.beginPath();ctx.arc(x-.43*u,y-.14*u,.05*u,0,7);ctx.arc(x+.43*u,y-.14*u,.05*u,0,7);ctx.fill();
  ctx.strokeStyle='#2b3138';ctx.lineWidth=.05*u;ctx.beginPath();ctx.moveTo(x-.38*u,y-.64*u);ctx.lineTo(x-.38*u,y-1.78*u);ctx.lineTo(x+.38*u,y-1.78*u);ctx.lineTo(x+.38*u,y-.64*u);ctx.stroke();
  ctx.fillStyle='#ff7a00';rr(ctx,x-.17*u,y-1.2*u,.34*u,.5*u,.06*u);ctx.fill();ctx.fillStyle='#e8e8e8';ctx.fillRect(x-.17*u,y-1.02*u,.34*u,.04*u);
  ctx.fillStyle='#f0c39c';ctx.beginPath();ctx.arc(x,y-1.33*u,.12*u,0,7);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y-1.37*u,.14*u,Math.PI,0);ctx.fill();ctx.fillRect(x-.17*u,y-1.38*u,.34*u,.04*u);
  ctx.fillStyle='#222';ctx.beginPath();ctx.arc(x-.045*u,y-1.32*u,.018*u,0,7);ctx.arc(x+.045*u,y-1.32*u,.018*u,0,7);ctx.fill();
  ctx.fillStyle='#3c434b';ctx.fillRect(x-.3*u,y-2.05*u,.07*u,1.95*u);ctx.fillRect(x+.23*u,y-2.05*u,.07*u,1.95*u);ctx.fillRect(x-.3*u,y-2.05*u,.6*u,.06*u);
  ctx.fillStyle='#5a626b';ctx.fillRect(x-.04*u,y-1.95*u,.08*u,1.2*u);
  const fy=y-.62*u;ctx.fillStyle='#2b3138';ctx.fillRect(x-.25*u,fy+.08*u,.07*u,.06*u);ctx.fillRect(x+.18*u,fy+.08*u,.07*u,.06*u);
  ctx.fillStyle='#a8743f';ctx.fillRect(x-.46*u,fy-.02*u,.92*u,.1*u);
  const bc=['#c0392b','#1d4f91','#f1c40f','#1f7a3c','#8e44ad'];
  for(let r=0;r<2;r++)for(let i=0;i<5;i++){ctx.fillStyle=bc[(i+r*2)%5];ctx.fillRect(x-.45*u+i*.18*u,fy-(r+1)*.3*u,.17*u,.28*u);ctx.fillStyle='#fff';ctx.fillRect(x-.42*u+i*.18*u,fy-(r+1)*.3*u+.05*u,.11*u,.07*u);}
}
function drawCarFront(x,y,s,o){if(U*s<3)return;const W1=1.15*(o.w||1),H1=.85*(o.h||1);
  blit(sprite('car'+o.col+(o.text||'')+W1+H1,W1*1.22,H1*1.08+.28,W1*.61,H1*1.08,(X,Y,S)=>carStatic(X,Y,S,o)),x,y,s);}
function carStatic(x,y,s,o){
  const u=U*s,w=1.15*u*(o.w||1),h=.85*u*(o.h||1);
  shadow(x,y,w*.55,.35);
  ctx.fillStyle='#16191e';rr(ctx,x-w*.47,y-h*.3,w*.18,h*.3,h*.05);ctx.fill();rr(ctx,x+w*.29,y-h*.3,w*.18,h*.3,h*.05);ctx.fill();
  const g=ctx.createLinearGradient(0,y-h,0,y);g.addColorStop(0,shade(o.col,22));g.addColorStop(.55,o.col);g.addColorStop(1,shade(o.col,-30));
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-w*.42,y-h*.56);ctx.lineTo(x-w*.32,y-h);ctx.lineTo(x+w*.32,y-h);ctx.lineTo(x+w*.42,y-h*.56);ctx.fill();
  rr(ctx,x-w/2,y-h*.62,w,h*.46,h*.09);ctx.fill();
  const sg=ctx.createLinearGradient(x-w*.3,y-h,x+w*.3,y-h*.6);sg.addColorStop(0,'#3b5a7c');sg.addColorStop(.5,'#a9c9e6');sg.addColorStop(1,'#2a4560');
  ctx.fillStyle=sg;ctx.beginPath();ctx.moveTo(x-w*.36,y-h*.62);ctx.lineTo(x-w*.28,y-h*.95);ctx.lineTo(x+w*.28,y-h*.95);ctx.lineTo(x+w*.36,y-h*.62);ctx.fill();
  if(o.text){ctx.fillStyle=o.band||o.col;ctx.beginPath();ctx.moveTo(x-w*.29,y-h*.88);ctx.lineTo(x-w*.28,y-h*.95);ctx.lineTo(x+w*.28,y-h*.95);ctx.lineTo(x+w*.29,y-h*.88);ctx.fill();
    ctx.fillRect(x-w*.29,y-h*.95,w*.58,h*.11);txt(o.text,x,y-h*.885,h*.09,o.textCol||'#fff',900,'center',w*.55);}
  ctx.fillStyle=o.col;rr(ctx,x-w*.57,y-h*.74,w*.11,h*.1,h*.03);ctx.fill();rr(ctx,x+w*.46,y-h*.74,w*.11,h*.1,h*.03);ctx.fill();
  if(o.rails){ctx.fillStyle='#c9ced4';ctx.fillRect(x-w*.31,y-h*1.04,w*.09,h*.05);ctx.fillRect(x+w*.22,y-h*1.04,w*.09,h*.05);}
  ctx.fillStyle='#fffbe6';rr(ctx,x-w*.47,y-h*.52,w*.21,h*.1,h*.04);ctx.fill();rr(ctx,x+w*.26,y-h*.52,w*.21,h*.1,h*.04);ctx.fill();
  ctx.fillStyle='#ffb000';ctx.fillRect(x-w*.47,y-h*.42,w*.06,h*.03);ctx.fillRect(x+w*.41,y-h*.42,w*.06,h*.03);
  ctx.fillStyle='#1d2127';rr(ctx,x-w*.23,y-h*.52,w*.46,h*.13,h*.03);ctx.fill();
  ctx.fillStyle='#b8bec6';ctx.fillRect(x-w*.22,y-h*.48,w*.44,h*.016);ctx.fillRect(x-w*.22,y-h*.44,w*.44,h*.016);
  ctx.fillStyle=shade(o.col,-45);rr(ctx,x-w*.49,y-h*.32,w*.98,h*.13,h*.04);ctx.fill();
  ctx.fillStyle='#fff';rr(ctx,x-w*.14,y-h*.3,w*.28,h*.085,h*.015);ctx.fill();ctx.fillStyle='#1f4fbf';ctx.fillRect(x-w*.14,y-h*.3,w*.03,h*.085);
  txt(o.plate||'LU-L 24',x+w*.015,y-h*.257,h*.055,'#111',900);
}
function drawPassat(x,y,s){drawCarFront(x,y,s,{col:'#c8101a',w:1.04,h:.92,rails:true,text:'Hilti',band:'#a30d15',plate:'LU-HI 1'});}
function drawVan(x,y,s){drawCarFront(x,y,s,{col:'#f2f4f7',w:1.1,h:1.45,text:'LUDLEIN LOGISTIK',band:'#2f8cff',plate:'LU-LG 7'});}
function drawTruck(x,y,s,rot=0){const u=U*s*1.35,w=1.55*u,h=1.85*u;
  ctx.save();if(rot){ctx.translate(x,y-h/2);ctx.rotate(rot);ctx.translate(-x,-(y-h/2));}
  blit(sprite('truck',2.6,3.65,1.3,3.22,truckStatic),x,y,s);
  for(let i=0;i<3;i++){const t=(time*.7+i*.33)%1;ctx.save();ctx.translate(x+(i-1)*w*.3+Math.sin(time*3+i)*w*.1,y-h*1.2-t*h*.6);ctx.rotate(time*3+i);ctx.globalAlpha=1-t;ctx.fillStyle='#fff';ctx.fillRect(-w*.04,-w*.05,w*.08,w*.1);ctx.fillStyle='#2a9a50';ctx.fillRect(-w*.03,-w*.035,w*.06,w*.012);ctx.restore();}
  ctx.globalAlpha=1;
  ctx.fillStyle='rgba(90,90,90,.35)';for(let i=0;i<3;i++){const t=(time*1.2+i/3)%1;ctx.beginPath();ctx.arc(x+w*.42+t*w*.2,y-h*.1-t*h*.3,(.05+t*.12)*u,0,7);ctx.fill();}
  ctx.restore();}
function truckStatic(x,y,s){
  const u=U*s*1.35,w=1.55*u,h=1.85*u;shadow(x,y,w*.58,.4);
  ctx.fillStyle='#111';for(const sx of [-.44,-.3,.3,.44]){rr(ctx,x+sx*w-w*.07,y-h*.17,w*.14,h*.17,h*.03);ctx.fill();}
  ctx.fillStyle='#2a2f36';ctx.fillRect(x-w*.48,y-h*.25,w*.96,h*.09);
  const g=ctx.createLinearGradient(x-w/2,0,x+w/2,0);g.addColorStop(0,'#16693a');g.addColorStop(.5,'#22924f');g.addColorStop(1,'#145f35');
  ctx.fillStyle=g;rr(ctx,x-w/2,y-h,w,h*.77,h*.03);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=1;ctx.beginPath();for(let i=1;i<6;i++){ctx.moveTo(x-w/2,y-h+i*h*.128);ctx.lineTo(x+w/2,y-h+i*h*.128);}for(let i=1;i<8;i++){ctx.moveTo(x-w/2+i*w/8,y-h);ctx.lineTo(x-w/2+i*w/8,y-h*.23);}ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-h*.98);ctx.lineTo(x,y-h*.24);ctx.stroke();
  ctx.fillStyle='#c5cbd2';ctx.fillRect(x-w*.05,y-h*.6,w*.025,h*.14);ctx.fillRect(x+w*.025,y-h*.6,w*.025,h*.14);
  for(const sx of [-.49,.47])for(const yy of [.9,.5])ctx.fillRect(x+sx*w,y-h*yy,w*.025,h*.07);
  ctx.fillStyle='rgba(255,255,255,.95)';rr(ctx,x-w*.4,y-h*.84,w*.8,h*.2,h*.03);ctx.fill();
  txt('EXCEL-LASTER',x,y-h*.765,h*.085,'#16693a',900,'center',w*.75);txt('Daten von gestern · Version 47',x,y-h*.68,h*.045,'#4b5a50',800,'center',w*.75);
  ctx.fillStyle='#ff2a2a';for(const sx of [-.47,.39]){rr(ctx,x+sx*w,y-h*.31,w*.08,h*.05,h*.01);ctx.fill();}
  ctx.fillStyle='#ffb000';ctx.fillRect(x-w*.47,y-h*.255,w*.06,h*.02);ctx.fillRect(x+w*.41,y-h*.255,w*.06,h*.02);
  ctx.fillStyle='#fff';rr(ctx,x-w*.12,y-h*.21,w*.24,h*.06,h*.01);ctx.fill();txt('LU-XL 365',x,y-h*.18,h*.04,'#111',900);
  ctx.fillStyle='#111';ctx.fillRect(x-w*.5,y-h*.15,w*.08,h*.13);ctx.fillRect(x+w*.42,y-h*.15,w*.08,h*.13);
  const cols=['#1d4f91','#c0392b','#f1c40f','#27ae60','#8e44ad','#e67e22','#2c3e50'];
  for(let i=0;i<9;i++){const bh=h*(.15+((i*37)%5)*.02);ctx.save();ctx.translate(x-w*.4+i*w*.1,y-h);ctx.rotate(((i*53)%7-3)*.05);
    ctx.fillStyle=cols[i%7];ctx.fillRect(-w*.045,-bh,w*.09,bh);ctx.fillStyle='#fff';ctx.fillRect(-w*.03,-bh*.78,w*.06,bh*.22);ctx.fillStyle='#ccc';ctx.beginPath();ctx.arc(0,-bh*.3,w*.017,0,7);ctx.fill();ctx.restore();}
  ctx.strokeStyle='#d8c39a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-w*.48,y-h);ctx.lineTo(x-w*.1,y-h*1.2);ctx.lineTo(x+w*.48,y-h);ctx.stroke();
}
function puIcon(k,x,y,r){
  ctx.strokeStyle='#fff';ctx.fillStyle='#fff';ctx.lineWidth=r*.15;ctx.lineCap='round';ctx.lineJoin='round';
  if(k==='sap'){const R=r*.5;ctx.beginPath();ctx.arc(x,y,R,-2.7,-.35);ctx.stroke();ctx.beginPath();ctx.arc(x,y,R,.45,2.8);ctx.stroke();
    const ah=(a,d)=>{const px=x+Math.cos(a)*R,py=y+Math.sin(a)*R;ctx.beginPath();ctx.moveTo(px+Math.cos(a+d*1.2)*r*.25,py+Math.sin(a+d*1.2)*r*.25);ctx.lineTo(px,py);ctx.lineTo(px+Math.cos(a-d*.4)*r*.25,py+Math.sin(a-d*.4)*r*.25);ctx.stroke();};
    ah(-.35,1);ah(2.8,1);txt('SAP',x,y,r*.32,'#fff',900);}
  else if(k==='ki'){star(x-r*.12,y+r*.08,r*.62,'#fff');star(x+r*.45,y-r*.45,r*.26,'#fff');star(x+r*.4,y+r*.45,r*.16,'#fff');}
  else if(k==='fc'){for(let i=0;i<3;i++){const bh=r*(.35+i*.25);ctx.fillRect(x-r*.55+i*r*.38,y+r*.5-bh,r*.26,bh);}
    ctx.beginPath();ctx.moveTo(x-r*.6,y+r*.05);ctx.lineTo(x-r*.1,y-r*.25);ctx.lineTo(x+r*.1,y-r*.1);ctx.lineTo(x+r*.6,y-r*.55);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+r*.3,y-r*.58);ctx.lineTo(x+r*.62,y-r*.58);ctx.lineTo(x+r*.62,y-r*.28);ctx.stroke();}
  else{ctx.lineWidth=r*.12;rr(ctx,x-r*.55,y-r*.38,r*1.1,r*.76,r*.1);ctx.stroke();ctx.beginPath();ctx.moveTo(x-r*.5,y-r*.32);ctx.lineTo(x,y+r*.08);ctx.lineTo(x+r*.5,y-r*.32);ctx.stroke();}
}
const DASH=[0,0];
function drawPU(o,x,y,s){
  const k=PU[o.k],u=U*s,r=.32*u;y+=Math.sin(time*4)*.05*u;
  shadow(x,proj(o.x,o.z)[1],r*.8,.2);
  ctx.save();ctx.translate(x,y);ctx.rotate(time*1.5);ctx.strokeStyle=k.c;ctx.globalAlpha=.6;ctx.lineWidth=Math.max(1,r*.07);DASH[0]=r*.3;DASH[1]=r*.2;ctx.setLineDash(DASH);ctx.beginPath();ctx.arc(0,0,r*1.45,0,7);ctx.stroke();ctx.setLineDash([]);ctx.restore();ctx.globalAlpha=1;
  blit(sprite('pu'+o.k,1.7,1.45,.85,.62,(X,Y)=>{const r=32;glow(k.c,X,Y,r*1.9,.8);
    const g=ctx.createLinearGradient(0,Y-r,0,Y+r);g.addColorStop(0,shade(k.c,25));g.addColorStop(1,shade(k.c,-20));ctx.fillStyle=g;rr(ctx,X-r,Y-r,2*r,2*r,r*.38);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.28)';rr(ctx,X-r*.85,Y-r*.9,r*1.7,r*.6,r*.3);ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=r*.1;rr(ctx,X-r,Y-r,2*r,2*r,r*.38);ctx.stroke();
    puIcon(o.k,X,Y,r);
    ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.5)';ctx.font='900 14px '+FONT;ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeText(k.n,X,Y+r*1.55);txt(k.n,X,Y+r*1.55,14,'#fff',900);}),x,y,s);
}
function offerBody(hot){return (X,Y)=>{const w=52,h=68;ctx.save();ctx.translate(X,Y);
  ctx.shadowColor='rgba(0,0,0,.3)';ctx.shadowBlur=6;ctx.fillStyle='#fff';
  ctx.beginPath();ctx.moveTo(-w/2,-h/2);ctx.lineTo(w*.3,-h/2);ctx.lineTo(w/2,-h*.34);ctx.lineTo(w/2,h/2);ctx.lineTo(-w/2,h/2);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.shadowColor='transparent';
  ctx.fillStyle='#dfe5ec';ctx.beginPath();ctx.moveTo(w*.3,-h/2);ctx.lineTo(w*.3,-h*.34);ctx.lineTo(w/2,-h*.34);ctx.fill();
  ctx.fillStyle='#5fae22';ctx.fillRect(-w/2,-h/2,w*.8,h*.17);txt('ANGEBOT',-w*.1,-h*.415,h*.1,'#fff',900);
  ctx.fillStyle='#c4cdd8';for(let i=0;i<3;i++){ctx.fillRect(-w*.38,-h*.2+i*h*.1,w*.5,h*.03);ctx.fillRect(w*.2,-h*.2+i*h*.1,w*.18,h*.03);}
  ctx.fillStyle='#1b2533';ctx.fillRect(-w*.38,h*.1,w*.76,1);
  txt('Σ 25.000 €',w*.1,h*.19,h*.085,'#1b2533',900);
  ctx.strokeStyle='#1d4f91';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-w*.38,h*.38);ctx.bezierCurveTo(-w*.25,h*.25,-w*.15,h*.45,-w*.05,h*.33);ctx.bezierCurveTo(0,h*.28,w*.05,h*.4,w*.12,h*.34);ctx.stroke();
  ctx.strokeStyle=hot?'#d8323f':'#9aa4ae';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(w*.3,h*.33,h*.1,0,7);ctx.stroke();
  txt(hot?'OK':'?',w*.3,h*.335,h*.08,hot?'#d8323f':'#9aa4ae',900);ctx.restore();};}
function drawOffer(o,x,y,s){
  const u=U*s,w=.52*u,h=.68*u;y+=Math.sin(time*3)*.05*u;shadow(x,proj(o.x,o.z)[1],w*.6,.2);
  const hot=G&&G.opps>0;
  if(hot){ctx.fillStyle='rgba(245,197,66,'+(.25+.15*Math.sin(time*6))+')';ctx.beginPath();ctx.arc(x,y,h*.85,0,7);ctx.fill();}
  const sp=hot?sprite('offerH',.72,.88,.36,.44,offerBody(true)):sprite('offerC',.72,.88,.36,.44,offerBody(false));
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(time*2)*.12);blit(sp,0,0,s);ctx.restore();
  if(hot&&u>20)star(x+w*.55,y-h*.55,h*.15*(.6+.4*Math.sin(time*7)),'#F5C542');
}
function drawX(o,x,y,s){
  const u=U*s,r=.36*u;y+=Math.sin(time*4)*.05*u;
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='rgba(141,198,63,.28)';ctx.beginPath();ctx.arc(0,0,r*1.55+Math.sin(time*6)*r*.1,0,7);ctx.fill();
  if(!LOWFX)for(let i=0;i<4;i++){const a=time*2+i*Math.PI/2;star(Math.cos(a)*r*1.5,Math.sin(a)*r*1.5,r*.18,'#d8f5b0');}
  glow('#8DC63F',0,0,r*1.6,.7);ctx.scale(Math.max(.15,Math.abs(Math.cos(time*2.5))),1);
  if(XIMG.complete)ctx.drawImage(XIMG,-r,-r*XR,2*r,2*r*XR);
  ctx.restore();
}
function drawPlayer(){
  const ch=charObj(),[x,gy,s]=proj(P.x,0,0),y=gy-P.y*U*s,u=U*s;
  if(P.inv>0&&Math.floor(P.inv*14)%2)return;
  shadow(x,gy,.34*u*(1-Math.min(.5,P.y*.25)));
  const sl=P.slide>0,air=P.y>.05,sw=Math.sin(P.run);
  ctx.save();ctx.translate(x,y);
  if(G&&G.dead)ctx.rotate(Math.min(1.4,G.dead*3));
  if(sl){ctx.translate(0,.15*u);ctx.scale(1.12,.62);}
  const legs=[[-.16,air?-.2:sw*.18],[.03,air?.1:-sw*.18]];
  for(const [lx,l] of legs){const top=-.72*u,ln=.66*u-Math.abs(l)*.5*u,off=Math.max(0,l)*u;
    const pg=ctx.createLinearGradient(lx*u,0,(lx+.13)*u,0);pg.addColorStop(0,shade(ch.pants,10));pg.addColorStop(1,shade(ch.pants,-15));
    ctx.fillStyle=pg;ctx.fillRect(lx*u,top+off,.13*u,ln);
    ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect((lx+.06)*u,top+off,.012*u,ln);
    const sy=top+off+ln-.04*u;ctx.fillStyle='#2a2522';rr(ctx,(lx-.01)*u,sy,.15*u,.09*u,.03*u);ctx.fill();ctx.fillStyle='#f2f2f2';ctx.fillRect((lx-.01)*u,sy+.07*u,.15*u,.025*u);}
  ctx.fillStyle='#2a2320';ctx.fillRect(-.27*u,-.75*u,.54*u,.07*u);
  for(const sd of [-1,1]){ctx.save();ctx.translate(sd*.27*u,-1.25*u);ctx.rotate(air?sd*2.4:-sd*sw*.7);
    ctx.fillStyle=ch.shirt2;rr(ctx,-.065*u,0,.13*u,.3*u,.05*u);ctx.fill();ctx.fillStyle=ch.skin;ctx.fillRect(-.05*u,.28*u,.1*u,.18*u);
    ctx.beginPath();ctx.arc(0,.48*u,.06*u,0,7);ctx.fill();if(sd>0){ctx.fillStyle='#d9d9d9';ctx.fillRect(-.05*u,.3*u,.1*u,.04*u);}ctx.restore();}
  const tg=ctx.createLinearGradient(-.3*u,0,.3*u,0);tg.addColorStop(0,ch.shirt2);tg.addColorStop(.5,ch.shirt);tg.addColorStop(1,ch.shirt2);
  ctx.fillStyle=tg;rr(ctx,-.3*u,-1.34*u,.6*u,.66*u,.13*u);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=Math.max(1,.012*u);ctx.beginPath();ctx.moveTo(-.18*u,-.72*u);ctx.quadraticCurveTo(-.1*u,-.9*u,-.2*u,-1.05*u);ctx.moveTo(.2*u,-.72*u);ctx.quadraticCurveTo(.12*u,-.88*u,.2*u,-1.02*u);ctx.stroke();
  ctx.fillStyle=ch.id==='holger'?'#c9d3e2':'#f5f7fa';rr(ctx,-.13*u,-1.38*u,.26*u,.08*u,.03*u);ctx.fill();
  const lw2=.3*u;if(XIMG.complete){ctx.fillStyle='#fff';rr(ctx,-lw2/2-.025*u,-1.255*u,lw2+.05*u,lw2*XR+.05*u,.04*u);ctx.fill();ctx.drawImage(XIMG,-lw2/2,-1.23*u,lw2,lw2*XR);}
  ctx.strokeStyle='#4a3424';ctx.lineWidth=.05*u;ctx.beginPath();ctx.moveTo(.2*u,-1.32*u);ctx.lineTo(-.26*u,-.84*u);ctx.stroke();
  ctx.fillStyle='#5a3e2b';rr(ctx,-.44*u,-.92*u,.24*u,.22*u,.04*u);ctx.fill();ctx.fillStyle='#6b4a33';rr(ctx,-.44*u,-.92*u,.24*u,.1*u,.04*u);ctx.fill();
  ctx.fillStyle='#c9a227';ctx.fillRect(-.34*u,-.84*u,.04*u,.04*u);
  ctx.fillStyle=ch.skin;ctx.fillRect(-.07*u,-1.44*u,.14*u,.1*u);
  ctx.beginPath();ctx.arc(0,-1.57*u,.2*u,0,7);ctx.fill();
  ctx.beginPath();ctx.arc(-.2*u,-1.55*u,.05*u,0,7);ctx.arc(.2*u,-1.55*u,.05*u,0,7);ctx.fill();
  ctx.fillStyle=ch.hair;ctx.beginPath();ctx.arc(0,-1.59*u,.205*u,Math.PI*.92,Math.PI*2.08);ctx.lineTo(.19*u,-1.49*u);ctx.quadraticCurveTo(0,-1.43*u,-.19*u,-1.49*u);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.15)';ctx.beginPath();ctx.ellipse(-.06*u,-1.7*u,.09*u,.04*u,-.4,0,7);ctx.fill();
  if(ch.glasses){ctx.strokeStyle='#222';ctx.lineWidth=.025*u;ctx.beginPath();ctx.moveTo(-.2*u,-1.58*u);ctx.lineTo(-.25*u,-1.59*u);ctx.moveTo(.2*u,-1.58*u);ctx.lineTo(.25*u,-1.59*u);ctx.stroke();}
  ctx.restore();
  if(G&&state==='play'){
    if(G.pu.ol>0){ctx.strokeStyle='rgba(40,180,232,'+(.5+.3*Math.sin(time*8))+')';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(x,y-.8*u,.55*u,.95*u,0,0,7);ctx.stroke();}
    if(G.pu.ki>0){ctx.fillStyle='rgba(163,92,255,.25)';ctx.beginPath();ctx.ellipse(x,y-.8*u,.6*u,1*u,0,0,7);ctx.fill();if(!LOWFX||Math.random()<.3)burst(x+rnd(-.3,.3)*u,y-rnd(.2,1.4)*u,'#c99bff',.15);}
    if(G.pu.sap>0){ctx.strokeStyle='rgba(47,140,255,.5)';ctx.lineWidth=2;const r=(time*2%1)*1.4*u;ctx.beginPath();ctx.ellipse(x,gy,r,r*.3,0,0,7);ctx.stroke();}
  }
}
function drawObj(o){
  if(o.z<-2.6)return;
  const [x,y,s]=proj(o.x,o.z,o.y||0);
  if(o.fly){ctx.save();ctx.translate(x,y);ctx.rotate(o.fly.r);ctx.translate(-x,-y);}
  switch(o.type){
    case 'lead':drawLead(o,x,y,s);break;
    case 'excel':drawExcel(x,y,s);break;
    case 'banner':drawBanner(x,y,s);break;
    case 'silo':drawSilo(x,y,s);break;
    case 'fork':drawFork(o,x,y,s);break;
    case 'van':drawVan(x,y,s);break;
    case 'passat':drawPassat(x,y,s);break;
    case 'pu':drawPU(o,x,y,s);break;
    case 'offer':drawOffer(o,x,y,s);break;
    case 'xtok':drawX(o,x,y,s);break;
  }
  if(o.fly)ctx.restore();
}
const RL=[],PSENT={z:0},BSENT={z:0},byZ=(a,b)=>b.z-a.z,bySite=(a,b)=>(b.z0+b.len)-(a.z0+a.len);
function render(){
  ctx.save();
  if(G&&G.shake>0&&state==='play')ctx.translate(rnd(-6,6)*G.shake*3,rnd(-6,6)*G.shake*3);
  ctx.drawImage(sky,0,0,W,HOR+4);
  drawGround();
  const bs=blds.sort(bySite);
  for(const b of bs)drawSite(b);
  ctx.fillStyle=FOG;ctx.fillRect(0,HOR-2,W,(GY-HOR)*.13+2);
  for(const b of bs)drawCard(b);
  RL.length=0;for(const d of deco)RL.push(d);for(const o of objs)RL.push(o);RL.push(PSENT);
  if(G&&G.boss&&state==='play'){BSENT.z=G.boss.z;RL.push(BSENT);}
  RL.sort(byZ);
  for(const it of RL){
    if(it===PSENT)drawPlayer();else if(it.type)drawObj(it);
    else if(it===BSENT){const b=G.boss,[x,y,s]=proj(b.x,b.z);drawTruck(x,y,s,b.spin||0);
      if(!b.out){ctx.font='900 16px '+FONT;ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.6)';const ty=y-2.85*U*s;ctx.strokeText('INTEGRATION '+b.xs+'/3',x,ty);ctx.fillStyle='#8DC63F';ctx.fillText('INTEGRATION '+b.xs+'/3',x,ty);}}
    else drawDeco(it);
  }
  if(G&&G.pu.ki>0&&state==='play'){ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=2;for(let i=0;i<(LOWFX?3:8);i++){const a=rnd(0,6.28),r1=rnd(60,120),r2=r1+rnd(80,160);
    ctx.beginPath();ctx.moveTo(CX+Math.cos(a)*r1,H*.45+Math.sin(a)*r1);ctx.lineTo(CX+Math.cos(a)*r2,H*.45+Math.sin(a)*r2);ctx.stroke();}}
  for(const p of parts){ctx.globalAlpha=Math.min(1,p.l*2);ctx.fillStyle=p.c;ctx.fillRect(p.x-p.s/2,p.y-p.s/2,p.s,p.s);}
  ctx.globalAlpha=1;
  for(const f of floats){ctx.globalAlpha=Math.min(1,f.l*1.5);ctx.font='900 '+(f.big?22:17)+'px '+FONT;ctx.textAlign='center';
    ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.55)';ctx.strokeText(f.t,f.x,f.y);ctx.fillStyle=f.c;ctx.fillText(f.t,f.x,f.y);}
  ctx.globalAlpha=1;
  ctx.restore();
  if(G&&state==='play'){
    if(G.flash>0){ctx.fillStyle='rgba(255,40,60,'+G.flash*.8+')';ctx.fillRect(0,0,W,H);}
    if(G.boss&&!G.boss.out){ctx.globalAlpha=.25+.1*Math.sin(time*5);ctx.fillStyle=VIG;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
  }
}
function burst(x,y,c,sp=1){parts.push({x,y,vx:rnd(-220,220)*sp,vy:rnd(-420,-80)*sp,l:rnd(.4,.9),c,s:rnd(3,7)});}
function burstAt(o,c,n=10){const [x,y]=proj(o.x,Math.max(o.z,0),o.y||.6);for(let i=0;i<n;i++)burst(x,y,c,.6);}
function floatTxt(o,t,c,big){const [x,y]=proj(o.x,Math.max(o.z,0),(o.y||.5)+.8);floats.push({x,y,t,c,l:1.1,big});}

/* ================= HUD & UI ================= */
let hudCache={};
function setT(id,v){if(hudCache[id]!==v){hudCache[id]=v;$(id).textContent=v;}}
let hudT=0;
function updHud(force){
  if(!force&&time-hudT<.1)return;hudT=time;
  setT('#hearts','❤️'.repeat(Math.min(6,Math.max(0,G.lives)))+'🖤'.repeat(Math.max(0,G.maxL-G.lives)));
  setT('#rev',fmt(G.rev)+' €');setT('#hLeads',G.bucket+'/10');setT('#hOpps',''+G.opps);setT('#hDeals',''+G.deals);
  setT('#dist',fmt(G.dist)+' m');
  const bw=G.bucket*10+'%';if(hudCache.bw!==bw){hudCache.bw=bw;$('#hBar').style.width=bw;}
  const pk=Object.keys(G.pu).filter(k=>G.pu[k]>0).map(k=>k+Math.ceil(G.pu[k])).join();
  if(hudCache.pk!==pk){hudCache.pk=pk;$('#pus').innerHTML=Object.keys(G.pu).filter(k=>G.pu[k]>0).map(k=>`<div class="pu" style="border-color:${PU[k].c}">${PU[k].ic} ${PU[k].n} ${Math.ceil(G.pu[k])}s</div>`).join('');}
}
function pulse(id){const e=$(id);e.classList.remove('pulse');void e.offsetWidth;e.classList.add('pulse');}
let toastT=0;
function toast(t,sub){const e=$('#toast');e.innerHTML=t+(sub?'<small>'+sub+'</small>':'');e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),1600);}
let factT=0;
function showFact(k){
  if(!FACTS[k])return;if(G){G.shown[k]=1;}
  const first=!S.facts[k];S.facts[k]=1;save();
  $('#factTxt').innerHTML='<b>'+(first?'📘 Neu: ':'💡 ')+FACTS[k][0]+'</b>'+FACTS[k][1];
  $('#factbox').classList.add('on');clearTimeout(factT);factT=setTimeout(()=>$('#factbox').classList.remove('on'),4200);
}
function misVal(k){return {leads:G.leads,deals:G.deals,dist:G.dist,opps:G.oppsTot,boss:G.bossN,pu:G.puN,bust:G.bust}[k]||0;}
function checkMis(){if(!G||G.demo)return;S.mis.forEach((m,i)=>{if(!G.misDone[i]&&misVal(m.k)>=m.n){G.misDone[i]=1;setTimeout(()=>toast('✅ Mission erfüllt!',m.t+' · +'+m.r+' 🪙'),900);}});}
function showScr(id){$$('.scr').forEach(s=>s.classList.toggle('on',s.id===id));}
function go(id){
  SFX.click();
  if(id==='menu')renderMenu();if(id==='team')renderTeam();if(id==='shop')renderShop();if(id==='codex')renderCodex();if(id==='ranks')renderRanks(-1);
  showScr(id);
}
function renderMenu(){
  $('#mBest').textContent=fmt(S.best)+' €';$('#mCoins').textContent=fmt(S.coins);
  $('#mMis').innerHTML=S.mis.map(m=>`<div class="mis"><span>${m.t} <small style="opacity:.6">(1 Lauf)</small></span><b>+${m.r} 🪙</b></div>`).join('');
  sndIcons();
}
function sndIcons(){$$('#sndBtn span,#sndBtn2 span').forEach(e=>e.textContent=S.sound?'🔊':'🔇');}
function drawPortrait(c,ch){
  const z=c.canvas.width,k=z/100;c.clearRect(0,0,z,z);
  c.fillStyle=ch.shirt;c.beginPath();c.ellipse(50*k,108*k,42*k,34*k,0,0,7);c.fill();
  c.fillStyle='#fff';c.beginPath();c.moveTo(40*k,76*k);c.lineTo(50*k,92*k);c.lineTo(60*k,76*k);c.fill();
  if(XIMG.complete)c.drawImage(XIMG,22*k,82*k,15*k,15*k*XR);
  c.fillStyle=ch.skin;c.fillRect(43*k,62*k,14*k,16*k);c.beginPath();c.ellipse(50*k,46*k,20*k,23*k,0,0,7);c.fill();
  c.beginPath();c.arc(30*k,48*k,4*k,0,7);c.arc(70*k,48*k,4*k,0,7);c.fill();
  c.fillStyle=ch.hair;c.beginPath();c.ellipse(50*k,32*k,21*k,13*k,0,Math.PI,0);c.fill();
  if(ch.id==='michael'){c.beginPath();c.ellipse(44*k,26*k,16*k,8*k,-.3,0,7);c.fill();}
  if(ch.id==='holger'){c.fillRect(29*k,30*k,4*k,14*k);c.fillRect(67*k,30*k,4*k,14*k);}
  else c.fillRect(29*k,30*k,5*k,10*k),c.fillRect(66*k,30*k,5*k,10*k);
  c.fillStyle='#222';c.beginPath();c.arc(42*k,47*k,2.4*k,0,7);c.arc(58*k,47*k,2.4*k,0,7);c.fill();
  c.strokeStyle='#222';c.lineWidth=2*k;c.beginPath();c.arc(50*k,55*k,8*k,.3,Math.PI-.3);c.stroke();
  if(ch.glasses){c.lineWidth=2.2*k;c.strokeStyle='#1e1e1e';c.strokeRect(35*k,42*k,13*k,10*k);c.strokeRect(52*k,42*k,13*k,10*k);c.beginPath();c.moveTo(48*k,46*k);c.lineTo(52*k,46*k);c.stroke();}
}
function renderTeam(){
  $$('.cv').forEach(e=>e.textContent=fmt(S.coins));
  const L=$('#teamList');L.innerHTML='';
  CHARS.forEach(ch=>{
    const own=S.owned[ch.id],sel=S.char===ch.id;
    const d=document.createElement('div');d.className='card ch'+(sel?' sel':'');
    d.innerHTML=`<canvas width="168" height="168"></canvas><div class="i"><div class="n">${ch.name}</div><div class="r">${ch.role} · itmX</div>
      <div class="p"><b>${ch.perk}:</b> ${ch.desc}</div>
      <button class="btn ${sel?'off':own?'':'gold'}">${sel?'✓ Ausgewählt':own?'Auswählen':'Freischalten · '+ch.cost+' 🪙'}</button></div>`;
    drawPortrait(d.querySelector('canvas').getContext('2d'),ch);
    d.querySelector('button').onclick=()=>{
      if(sel)return;
      if(own){S.char=ch.id;save();SFX.click();renderTeam();}
      else if(S.coins>=ch.cost){S.coins-=ch.cost;S.owned[ch.id]=1;S.char=ch.id;save();SFX.pu();renderTeam();}
      else{SFX.hit();toast('Zu wenig Provision','Noch '+fmt(ch.cost-S.coins)+' 🪙');}
    };
    L.appendChild(d);
  });
  const n=document.createElement('div');n.className='foot';n.textContent='Das itmX-Führungsteam als Comic-Helden. Echte Fotos kannst du später gegen die Zeichnungen tauschen.';L.appendChild(n);
}
function upCost(k){return Math.round(80*Math.pow(S.up[k]+1,1.55));}
function renderShop(){
  $$('.cv').forEach(e=>e.textContent=fmt(S.coins));
  const L=$('#shopList');L.innerHTML='';
  Object.keys(PU).forEach(k=>{
    const lv=S.up[k],max=lv>=5,d=document.createElement('div');d.className='card';
    d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:900;font-size:17px"><span style="color:${PU[k].c}">${PU[k].ic}</span> ${PU[k].n}</div><div style="font-weight:800;color:var(--muted);font-size:13px">${puDur(k).toFixed(1)} s</div></div>
    <div style="font-size:13px;margin-top:2px">${PU[k].d}</div><div class="lv">${[0,1,2,3,4].map(i=>`<i class="${i<lv?'f':''}"></i>`).join('')}</div>
    <button class="btn ${max?'off':'gold'}">${max?'Maximal':'Verbessern · '+upCost(k)+' 🪙'}</button>`;
    d.querySelector('button').onclick=()=>{if(max)return;const c=upCost(k);
      if(S.coins>=c){S.coins-=c;S.up[k]++;save();SFX.pu();renderShop();}else{SFX.hit();toast('Zu wenig Provision','Noch '+fmt(c-S.coins)+' 🪙');}};
    L.appendChild(d);
  });
}
function renderCodex(){
  const L=$('#codexList');L.innerHTML='';const ks=Object.keys(FACTS),n=ks.filter(k=>S.facts[k]).length;
  const h=document.createElement('div');h.className='card';h.innerHTML=`<h3>Wissenskarten ${n}/${ks.length}</h3><div class="lv">${ks.map(k=>`<i class="${S.facts[k]?'f':''}"></i>`).join('')}</div>`;L.appendChild(h);
  ks.forEach(k=>{const d=document.createElement('div');d.className='card fact'+(S.facts[k]?'':' lock');
    d.innerHTML=S.facts[k]?`<b>${FACTS[k][0]}</b>${FACTS[k][1]}`:`<b>??? ${FACTS[k][0]}</b>Noch nicht entdeckt.`;L.appendChild(d);});
}
function gameOver(){
  state='over';$('#hud').classList.remove('on');$('#toast').classList.remove('on');$('#factbox').classList.remove('on');boss=false;musicOn=false;
  const demo=G.demo;$('#demoTag').hidden=true;
  let earned=0,misTxt=[],rec=false;
  if(!demo){S.runs++;
  earned=Math.floor(G.rev/1000)+Math.floor(G.dist/100);
  S.mis.forEach((m,i)=>{if(G.misDone[i]){earned+=m.r;misTxt.push(m.t);}});
  S.mis=S.mis.map((m,i)=>G.misDone[i]?null:m);S.mis=S.mis.map(m=>m||newMission(S.mis.filter(Boolean).map(x=>x.k)));
  rec=G.rev>S.best;if(rec)S.best=G.rev;S.coins+=earned;save();}
  $('#againBtn').textContent=demo?'▶ SELBST SPIELEN':'↻ NOCHMAL';
  $('#newRec').innerHTML=rec?'<span class="badge">NEUER REKORD</span>':'';
  const wr=G.oppsTot?Math.round(G.deals/G.oppsTot*100):0;
  $('#kpis').innerHTML=`<div class="kpi w"><span>Umsatz</span><b>${fmt(G.rev)} €</b></div>
   <div class="kpi"><span>Leads</span><b>${fmt(G.leads)}</b></div><div class="kpi"><span>Opportunities</span><b>${G.oppsTot}</b></div>
   <div class="kpi"><span>Deals</span><b>${G.deals}</b></div><div class="kpi"><span>Win-Rate</span><b>${wr} %</b></div>
   <div class="kpi"><span>Distanz</span><b>${fmt(G.dist)} m</b></div><div class="kpi"><span>Verlorene Leads</span><b style="color:var(--red)">${G.stolen}</b></div>
   ${demo?'':`<div class="kpi w" style="background:rgba(245,197,66,.18)"><span>Provision verdient</span><b style="font-size:22px;color:var(--gold)">+${earned} 🪙</b>${misTxt.length?'<div style="font-size:12px;font-weight:700">✅ '+misTxt.join(' · ')+'</div>':''}</div>`}${G.eggs?'<div class="kpi w" style="background:rgba(200,16,26,.3)"><span>Easter Egg gefunden</span><b style="font-size:20px">🥚 '+G.eggs+'× roter Hilti-Passat</b></div>':''}`;
  $('#ctaTxt').innerHTML=G.stolen>0?`Du hast <b>${G.stolen} Leads</b> verloren. Im echten Vertrieb passiert das, wenn Daten in Excel-Listen und Silos verschwinden. <b>itmX crm</b> hält alles zusammen – voll integriert in SAP und Microsoft 365.`
    :`Starke Pipeline! Mit <b>itmX crm</b> behältst du Leads, Opportunities und Forecasts auch im echten Vertrieb in Echtzeit im Blick – voll integriert in SAP und Microsoft 365.`;
  if(demo){pendingHs=null;$('#hsEntry').innerHTML='<h3>🎬 Demo beendet</h3><div style="font-size:15px;font-weight:700;line-height:1.4">Das war eine komplette Kundentour: Leads sammeln, zu Opportunities qualifizieren, Angebote zu Deals machen und den Excel-Laster mit Integration stoppen. Jetzt bist du dran!</div>';}
  else renderHsEntry();
  renderQuiz();renderMenu();showScr('over');
}
function renderQuiz(){
  const q=pick(QUIZ),Q=$('#quiz');
  Q.innerHTML=`<h3>CRM-Quiz · +25 🪙</h3><div style="font-weight:800;font-size:16px">${q.q}</div>`+q.a.map((a,i)=>`<button class="qa" data-i="${i}">${a}</button>`).join('');
  Q.querySelectorAll('.qa').forEach(b=>b.onclick=()=>{
    if(Q.dataset.done==='1')return;Q.dataset.done='1';const i=+b.dataset.i;
    Q.querySelectorAll('.qa').forEach((x,j)=>{if(j===q.c)x.classList.add('ok');else if(j===i)x.classList.add('no');});
    if(i===q.c){S.coins+=25;SFX.deal();}else SFX.hit();
    S.facts[q.f]=1;save();
    const f=document.createElement('div');f.className='fact';f.style.marginTop='8px';f.innerHTML=`<b>${i===q.c?'Richtig! +25 🪙':'Fast!'}</b>${FACTS[q.f][1]}`;Q.appendChild(f);
  });
  Q.dataset.done='0';
}


/* ================= BESTENLISTE ================= */
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function hsList(){if(!Array.isArray(S.hs)||!S.hs.length)S.hs=HS_DEF.map(x=>Object.assign({},x));return S.hs;}
function hsRank(v){if(!(v>0))return -1;const l=hsList();let r=l.findIndex(e=>v>e.v);if(r<0)r=l.length;return r<10?r:-1;}
function hsAdd(n,v){const r=hsRank(v);if(r<0)return -1;const l=hsList();l.splice(r,0,{n,v,me:1});S.hs=l.slice(0,10);save();return r;}
function hsRows(hl,lim){return hsList().slice(0,lim||10).map((e,i)=>`<div class="hs${e.me?' me':''}${i===hl?' new':''}"><span class="rk">${['🥇','🥈','🥉'][i]||(i+1)+'.'}</span><span class="nm">${esc(e.n)}</span><b>${fmt(e.v)} €</b></div>`).join('');}
function renderRanks(hl){$('#rankList').innerHTML=hsRows(hl);}
let pendingHs=null;
function commitHs(name){if(!pendingHs)return -1;const v=pendingHs;pendingHs=null;const n=(name||'').trim().slice(0,18)||S.name||(hooks.playerName?.()||'').trim().slice(0,18)||'Du';S.name=n;save();return hsAdd(n,v);}
function flushHs(){if(pendingHs)commitHs(S.name||'Du');}
function renderHsEntry(){
  const E=$('#hsEntry'),v=G.rev,rk=hsRank(v);
  if(rk>=0){
    pendingHs=v;
    E.innerHTML=`<h3>🏆 Platz ${rk+1} in der Bestenliste!</h3><div style="font-size:14px;font-weight:700">Trag dich ein, damit alle sehen, wer hier verkauft.</div>
      <div class="hsform"><input id="hsName" maxlength="18" placeholder="Dein Name" autocomplete="nickname" enterkeyhint="done" value="${esc(S.name||hooks.playerName?.()||'')}"><button class="btn" id="hsSave">Eintragen</button></div>`;
    const done=()=>{const r=commitHs($('#hsName').value);E.innerHTML='<h3>🏆 Bestenliste</h3>'+hsRows(r,Math.max(5,r+1));SFX.win();};
    $('#hsSave').onclick=done;
    $('#hsName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();done();}});
  }else{
    pendingHs=null;const l=hsList(),t=l[Math.min(9,l.length-1)];
    const need=l.length>=10?t.v-v+1:0;
    E.innerHTML='<h3>🏆 Bestenliste</h3>'+hsRows(-1,3)+(need>0?`<div class="gap">Für die Top 10 fehlen dir noch ${fmt(need)} €.</div>`:'');
  }
}

/* ================= EINGABE ================= */
let tx=0,ty=0,tt=0,swiped=false;
function act(a,auto){
  if(state!=='play'||!G||G.dead)return;
  if(G.demo&&!auto)return;
  if(a==='l'&&P.lane>0){P.lane--;}
  else if(a==='r'&&P.lane<2){P.lane++;}
  else if(a==='u'){if(P.y<=.02){P.vy=8.6;P.slide=0;SFX.jump();}}
  else if(a==='d'){if(P.y>.05)P.vy=-16;P.slide=.68;SFX.slide();}
}
cv.addEventListener('touchstart',e=>{initAudio();const t=e.changedTouches[0];tx=t.clientX;ty=t.clientY;tt=performance.now();swiped=false;e.preventDefault();},{passive:false});
cv.addEventListener('touchmove',e=>{e.preventDefault();if(swiped)return;const t=e.changedTouches[0],dx=t.clientX-tx,dy=t.clientY-ty;
  if(Math.max(Math.abs(dx),Math.abs(dy))>22){swiped=true;act(Math.abs(dx)>Math.abs(dy)?(dx<0?'l':'r'):(dy<0?'u':'d'));}},{passive:false});
cv.addEventListener('touchend',e=>{e.preventDefault();if(!swiped&&performance.now()-tt<250){const x=e.changedTouches[0].clientX;
  // Tippen: linkes/rechtes Drittel = Spurwechsel, Mitte = Sprung
  if(x<W*.3)act('l');else if(x>W*.7)act('r');else act('u');}},{passive:false});
let mx=0,my=0,md=false;
cv.addEventListener('mousedown',e=>{initAudio();mx=e.clientX;my=e.clientY;md=true;});
cv.addEventListener('mouseup',e=>{if(!md)return;md=false;const dx=e.clientX-mx,dy=e.clientY-my;if(Math.max(Math.abs(dx),Math.abs(dy))>20)act(Math.abs(dx)>Math.abs(dy)?(dx<0?'l':'r'):(dy<0?'u':'d'));});
const onKey=e=>{const tg=e.composedPath?e.composedPath()[0]:e.target;if(tg&&tg.tagName==='INPUT')return;initAudio();const m={ArrowLeft:'l',ArrowRight:'r',ArrowUp:'u',ArrowDown:'d',a:'l',d:'r',w:'u',s:'d',' ':'u'}[e.key];if(m){act(m);e.preventDefault();}
  if(e.key==='Escape'&&state==='play')pauseGame();};
function pauseGame(){if(state!=='play')return;state='pause';musicOn=false;showScr('pause');sndIcons();}
function resume(){state='play';musicOn=true;showScr(null);last=performance.now();}
const onVis=()=>{if(document.hidden){pauseGame();if(AC)AC.suspend();}else if(AC&&mounted)AC.resume();};
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>{flushHs();go(b.dataset.go);}));
$('#playBtn').onclick=()=>{initAudio();SFX.click();if(!S.tut){showScr('tut');}else startGame();};
$('#tutBtn').onclick=()=>{S.tut=1;save();startGame();};
$('#againBtn').onclick=()=>{initAudio();flushHs();if(!S.tut)showScr('tut');else startGame();};
$('#demoBtn').onclick=()=>{initAudio();SFX.click();startGame(true);};
$('#demoPlay').onclick=()=>{initAudio();SFX.click();if(!S.tut){G=null;state='menu';$('#hud').classList.remove('on');musicOn=false;showScr('tut');}else startGame();};
$('#menuBtn').onclick=()=>{flushHs();state='menu';go('menu');};
$('#pauseBtn').onclick=()=>{initAudio();pauseGame();};
$('#resumeBtn').onclick=()=>{initAudio();resume();};
$('#quitBtn').onclick=()=>{state='menu';G=null;$('#hud').classList.remove('on');$('#demoTag').hidden=true;boss=false;musicOn=false;go('menu');};
const tog=()=>{initAudio();S.sound=S.sound?0:1;save();hooks.setMuted?.(!S.sound);if(master)master.gain.value=S.sound?.6:0;sndIcons();SFX.click();};
$('#sndBtn').onclick=tog;$('#sndBtn2').onclick=tog;
$('#hubBtn').onclick=()=>{SFX.click();hooks.onExit?.();};


/* ================= LOOP (angetrieben von der Spielewelt) ================= */
let last=performance.now(),mounted=false;
const FT=[];let ftI=0,qT=0;
function frame(raw){
  const dt=raw>.25?.016:Math.min(.034,raw);
  const t0=performance.now();update(dt);render();const work=performance.now()-t0;
  if(state==='play'&&raw<.25){FT[ftI++%120]=work;qT+=raw;
    if(qT>3&&FT.length>=120){qT=0;const m=FT.slice().sort((a,b)=>a-b)[60];
      if(m>11){if(QDPR>1.5){QDPR=1.5;resize();}else if(!LOWFX)LOWFX=true;else if(QDPR>1.2){QDPR=1.2;resize();}}}}
}
resize();resetWorld();renderMenu();
P={lane:1,x:0,y:0,vy:0,slide:0,run:0,inv:0};
const debug={spawnTest(){addObs('passat',0,30);addObs('fork',1,24);addObs('van',2,40);addObs('banner',1,45);objs.push({type:'pu',k:'fc',lane:2,x:LANES[2],z:14,y:.75,ph:0},{type:'offer',lane:1,x:0,z:12,y:.7,ph:0},{type:'xtok',lane:1,x:0,z:18,y:.7,ph:0});},get G(){return G},get state(){return state},startGame,act,get S(){return S}};
function mount(){
  mounted=true;
  const m=hooks.isMuted?.();if(m!=null){S.sound=m?0:1;save();if(master)master.gain.value=S.sound?.6:0;}
  addEventListener('keydown',onKey);document.addEventListener('visibilitychange',onVis);
  if(state==='play'||state==='pause'){G=null;state='menu';$('#hud').classList.remove('on');$('#demoTag').hidden=true;boss=false;}
  musicOn=false;state='menu';showScr('menu');renderMenu();resize();
  if(AC&&AC.state==='suspended')AC.resume();
  window.__leadrush=debug;
}
function unmount(){
  mounted=false;
  removeEventListener('keydown',onKey);document.removeEventListener('visibilitychange',onVis);
  flushHs();musicOn=false;boss=false;
  if(AC&&AC.state==='running')AC.suspend();
}
return {host,mount,unmount,frame,resize:()=>resize()};

}
