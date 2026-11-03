// Lead Rush – Bildschirme und HUD (wird in den Shadow DOM geschrieben)
export const markup = (wordmarkUrl) => `
<canvas id="cv"></canvas>

<div id="hud">
  <div class="top"><div id="hearts"></div><div id="rev">0 €</div><button id="pauseBtn" aria-label="Pause">❚❚</button></div>
  <div class="pipe">
    <div class="stage" id="stLeads"><span>Leads</span><b id="hLeads">0/10</b><i><em id="hBar"></em></i></div>
    <div class="stage" id="stOpps"><span>Opportunities</span><b id="hOpps">0</b></div>
    <div class="stage" id="stDeals"><span>Deals</span><b id="hDeals">0</b></div>
  </div>
  <div id="pus"></div>
  <div id="demoTag" hidden><span>🎬 DEMO</span><button id="demoPlay">Selbst spielen ▶</button></div>
  <div id="dist">0 m</div>
</div>
<div id="toast"></div>
<div id="factbox"><div class="card fact" id="factTxt"></div></div>

<!-- MENU -->
<div class="scr on" id="menu">
  <button class="hubback" id="hubBtn" aria-label="Zurück ins Büro">⟵ Büro</button>
  <div class="logo"><img src="${wordmarkUrl}" alt="itmX – NTT DATA Business Solutions"></div>
  <div class="title">LEAD<br>RUSH</div>
  <div class="sub">Deine Kundentour durch Ludlein</div>
  <div class="stats"><div>Rekord <span id="mBest">0 €</span></div><div>Provision <span id="mCoins">0</span> 🪙</div></div>
  <div style="flex:1;min-height:150px"></div>
  <button class="big" id="playBtn">▶ LOSRENNEN</button>
  <button class="ghost" id="demoBtn">🎬 Demo ansehen</button>
  <div class="row">
    <button class="sm" data-go="team"><span>👔</span>Team</button>
    <button class="sm" data-go="shop"><span>⚡</span>Upgrades</button>
    <button class="sm" data-go="ranks"><span>🏆</span>Rangliste</button>
    <button class="sm" data-go="codex"><span>📘</span>Wissen</button>
    <button class="sm" id="sndBtn"><span>🔊</span>Sound</button>
  </div>
  <div class="card"><h3>Missionen</h3><div id="mMis"></div></div>
  <div class="foot">Ein Spiel von itmX · das CRM für SAP-Kunden<br><a href="https://itmx.de/demo/" target="_blank" rel="noopener">Echte Demo vereinbaren →</a></div>
</div>

<!-- TEAM -->
<div class="scr dim" id="team">
  <div class="hd"><h2>Dein Team</h2><button class="back" data-go="menu">Zurück</button></div>
  <div class="coins" style="width:100%;max-width:340px">🪙 <span class="cv">0</span> Provision</div>
  <div id="teamList" style="width:100%;display:flex;flex-direction:column;align-items:center"></div>
</div>

<!-- SHOP -->
<div class="scr dim" id="shop">
  <div class="hd"><h2>Upgrades</h2><button class="back" data-go="menu">Zurück</button></div>
  <div class="coins" style="width:100%;max-width:340px">🪙 <span class="cv">0</span> Provision</div>
  <div id="shopList" style="width:100%;display:flex;flex-direction:column;align-items:center"></div>
</div>

<!-- CODEX -->
<div class="scr dim" id="codex">
  <div class="hd"><h2>CRM-Wissen</h2><button class="back" data-go="menu">Zurück</button></div>
  <div class="card"><h3>So spielst du</h3>
    <div class="leg">
      <div>🔵 <b>Lead</b> sammeln</div><div>📄 <b>Angebot</b> = Deal</div>
      <div>10 Leads = <b>Opportunity</b></div><div>Opp + Angebot = <b>€€€</b></div>
      <div>📊 <b>XLS</b>-Kiste: springen</div><div>🚧 <b>Medienbruch</b>: rutschen</div>
      <div>🛢 <b>Datensilo</b>: ausweichen</div><div>🚜 <b>Gabelstapler</b>: ausweichen</div>
      <div>🚚 <b>Excel-Laster</b>: 3× X sammeln</div><div>🥚 Es gibt ein <b>Easter Egg</b> …</div>
    </div>
  </div>
  <div id="codexList" style="width:100%;display:flex;flex-direction:column;align-items:center"></div>
  <div class="foot">Gesammelte Wissenskarten schaltest du über Power-ups und das Quiz frei.</div>
</div>

<!-- RANGLISTE -->
<div class="scr dim" id="ranks">
  <div class="hd"><h2>Bestenliste</h2><button class="back" data-go="menu">Zurück</button></div>
  <div class="card"><div id="rankList"></div></div>
  <div class="foot">Top 10 nach Umsatz. Die Liste wird auf diesem Gerät gespeichert.</div>
</div>

<!-- PAUSE -->
<div class="scr dim" id="pause" style="justify-content:center">
  <div class="title" style="font-size:44px">PAUSE</div>
  <button class="big" id="resumeBtn" style="margin-top:20px">▶ WEITER</button>
  <div class="row"><button class="sm" id="quitBtn"><span>🏠</span>Menü</button><button class="sm" id="sndBtn2"><span>🔊</span>Sound</button></div>
</div>

<!-- TUTORIAL -->
<div class="scr dim" id="tut" style="justify-content:center">
  <div class="title" style="font-size:40px">SO GEHT'S</div>
  <div class="g"><span>👈</span>Wischen: Spur wechseln 👉</div>
  <div class="g"><span>👆</span>Hoch wischen: Springen</div>
  <div class="g"><span>👇</span>Runter wischen: Rutschen</div>
  <div class="card fact"><b>Dein Ziel</b>Sammle Leads, qualifiziere sie zu Opportunities und schnapp dir Angebote, um Deals zu gewinnen. Aber Achtung: Excel-Chaos, Datensilos und Medienbrüche kosten dich Kundendaten!</div>
  <button class="big" id="tutBtn" style="margin-top:18px">LOS GEHT'S</button>
</div>

<!-- GAME OVER -->
<div class="scr dim" id="over">
  <div class="hd"><h2>Vertriebsbericht</h2><span id="newRec"></span></div>
  <div class="card" id="hsEntry" style="margin-top:0;margin-bottom:12px"></div>
  <div class="grid" id="kpis"></div>
  <div class="card" id="quiz"></div>
  <div class="card cta">
    <p id="ctaTxt"></p>
    <a href="https://itmx.de/demo/" target="_blank" rel="noopener">itmX crm live erleben – Demo vereinbaren</a>
  </div>
  <button class="big" id="againBtn" style="margin-top:14px">↻ NOCHMAL</button>
  <div class="row"><button class="sm" id="menuBtn"><span>🏠</span>Menü</button><button class="sm" data-go="team"><span>👔</span>Team</button><button class="sm" data-go="shop"><span>⚡</span>Upgrades</button></div>
</div>

<div id="rot">📱 Bitte dreh dein iPhone ins Hochformat</div>
`;
