/**
 * Battle Engine — Extinct Survival Tactical Battle System
 * Diadaptasi dari referensi extinct_battle.html (v0.0.9).
 * Grid tactical turn-based: unit HP/Armor/AP, gerak berbasis BFS,
 * jangkauan serang, AI musuh otomatis, animasi damage float.
 *
 * Hook integrasi tambahan (di luar file asli, utk nyambung ke game):
 *  - config.onWeaponUse(weapon): dipanggil tiap kali player berhasil
 *    menyerang (dipakai utk kurangi durability senjata asli)
 *  - onEnd sekarang menerima objek summary { result, player, enemies }
 *    (bukan cuma string result) supaya reward/loot bisa dihitung dari
 *    field custom yang dititipkan di config.enemies (id, expReward, dst)
 *
 * API: window.ExtinctBattle.start({ player, enemies, cols, rows, onEnd, onWeaponUse })
 */

/* =====================================================================
   EXTINCT SURVIVAL — BATTLE SYSTEM
   Grid tactical turn-based battle (replika mekanik dari video referensi):
   - Unit punya HP, Armor, Action Point (AP)
   - Aksi "Pindah" (move) memakai 1 AP per petak, dibatasi rintangan
   - Slot senjata (melee/ranged) dgn AP cost, damage range, amunisi
   - Highlight petak bisa-jalan (hijau) & jangkauan serang (oranye)
   - Giliran musuh otomatis: AI mendekat lalu menyerang
   - Panel musuh (strip atas) menampilkan HP tiap musuh, mirip panel
     kanan pada video referensi, dipadatkan utk layout potret/compact
   - Bisa "Kabur" lewat petak pintu keluar (exit)

   INTEGRASI KE GAME KAMU:
   window.ExtinctBattle.start({
     player: { name:"Vyoker", hp:100, maxHp:100, armor:20, maxAp:6,
               weapons:[ {name:"Pisau", icon:"🔪", apCost:1, dmgMin:6, dmgMax:12, range:1, ammo:null},
                         {name:"Pistol", icon:"🔫", apCost:2, dmgMin:10, dmgMax:18, range:4, ammo:12, maxAmmo:12},
                         {name:"Senapan", icon:"🎯", apCost:3, dmgMin:18, dmgMax:30, range:6, ammo:20, maxAmmo:20} ] },
     enemies: [ {name:"Ular", icon:"🐍", hp:30, maxHp:30, armor:0, dmgMin:8, dmgMax:10, moveRange:2},
                {name:"Serigala", icon:"🐺", hp:61, maxHp:61, armor:0, dmgMin:12, dmgMax:18, moveRange:3} ],
     cols:7, rows:8,
     onEnd: function(result){ /* result = 'win' | 'lose' | 'flee' *\/ }
   });
   ===================================================================== */

const COLS = 7, ROWS = 8;
const TILE = { EMPTY:'empty', TREE:'tree', ROCK:'rock', BUSH:'bush', STUMP:'stump', HAZARD:'hazard', EXIT:'exit' };
const BLOCKING = [TILE.TREE, TILE.ROCK, TILE.STUMP];
const TILE_ICON = { tree:'🌲', rock:'🪨', bush:'🌿', stump:'🪵', hazard:'', exit:'🚪', empty:'' };

let state = null; // main battle state

function key(x,y){ return x+','+y; }

function buildBoard(cols, rows){
  const tiles = [];
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      let t = TILE.EMPTY;
      const r = Math.random();
      if(x===Math.floor(cols/2) && y===2 && false){} // reserved
      if(r<0.07) t = TILE.TREE;
      else if(r<0.12) t = TILE.ROCK;
      else if(r<0.20) t = TILE.BUSH;
      else if(r<0.24) t = TILE.STUMP;
      else if(r<0.30) t = TILE.HAZARD;
      tiles.push({x,y,type:t});
    }
  }
  // exit di tepi kanan tengah
  const exitTile = tiles.find(t=>t.x===cols-1 && t.y===Math.floor(rows/2));
  if(exitTile) exitTile.type = TILE.EXIT;
  return tiles;
}

function tileAt(x,y){ return state.tiles.find(t=>t.x===x && t.y===y); }
function isBlocked(x,y){
  if(x<0||y<0||x>=state.cols||y>=state.rows) return true;
  const t = tileAt(x,y);
  if(!t) return true;
  if(BLOCKING.includes(t.type)) return true;
  if(unitAt(x,y)) return true;
  return false;
}
function unitAt(x,y,excludeId){
  return state.units.find(u=>u.alive && u.x===x && u.y===y && u.id!==excludeId);
}
function dist(a,b){ return Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y)); }

function bfsReachable(unit, maxSteps){
  const start = {x:unit.x, y:unit.y};
  const visited = new Map();
  visited.set(key(start.x,start.y), 0);
  const queue = [start];
  const result = [];
  while(queue.length){
    const cur = queue.shift();
    const curCost = visited.get(key(cur.x,cur.y));
    if(curCost>0) result.push({x:cur.x,y:cur.y,cost:curCost});
    if(curCost>=maxSteps) continue;
    const neigh = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for(const [dx,dy] of neigh){
      const nx=cur.x+dx, ny=cur.y+dy;
      if(nx<0||ny<0||nx>=state.cols||ny>=state.rows) continue;
      const t = tileAt(nx,ny);
      if(!t || BLOCKING.includes(t.type)) continue;
      if(unitAt(nx,ny,unit.id)) continue;
      const nk = key(nx,ny);
      const nc = curCost+1;
      if(!visited.has(nk) || visited.get(nk)>nc){
        visited.set(nk,nc);
        queue.push({x:nx,y:ny});
      }
    }
  }
  return result;
}

function hasLineOfSight(a,b){
  // simple bresenham check for blocking tiles between a and b
  let x0=a.x,y0=a.y,x1=b.x,y1=b.y;
  const dx=Math.abs(x1-x0), dy=Math.abs(y1-y0);
  const sx = x0<x1?1:-1, sy = y0<y1?1:-1;
  let err = dx-dy;
  while(!(x0===x1 && y0===y1)){
    const e2 = 2*err;
    if(e2>-dy){ err-=dy; x0+=sx; }
    if(e2<dx){ err+=dx; y0+=sy; }
    if(x0===x1 && y0===y1) break;
    const t = tileAt(x0,y0);
    if(t && BLOCKING.includes(t.type)) return false;
  }
  return true;
}

/* ---------------- UI RENDER ---------------- */

function render(){
  renderTop();
  renderEnemyStrip();
  renderBoard();
  renderActions();
  const et = document.getElementById('endTurnBtn');
  const flee = document.getElementById('fleeBtn');
  et.style.opacity = state.turn==='player' ? '1' : '.35';
  const p = state.units[0];
  const nearExit = p.alive && tileAt(p.x,p.y) && tileAt(p.x,p.y).type===TILE.EXIT;
  flee.classList.toggle('disabled', !(nearExit && state.turn==='player'));
}

function renderTop(){
  const p = state.units[0];
  document.getElementById('hpFill').style.width = Math.max(0,(p.hp/p.maxHp*100))+'%';
  document.getElementById('hpVal').textContent = Math.max(0,p.hp)+'/'+p.maxHp;
  document.getElementById('armFill').style.width = (p.maxArmor? p.armor/p.maxArmor*100 : 0)+'%';
  document.getElementById('armVal').textContent = p.armor;
  document.getElementById('pName').textContent = p.name.toUpperCase();

  const pipsEl = document.getElementById('apPips');
  pipsEl.innerHTML='';
  for(let i=0;i<p.maxAp;i++){
    const d = document.createElement('div');
    d.className = 'pip'+(i<p.ap?' filled':'');
    pipsEl.appendChild(d);
  }
  const tag = document.getElementById('turnTag');
  tag.textContent = state.turn==='player' ? 'Giliranmu' : 'Giliran Musuh';
  tag.classList.toggle('enemyTurn', state.turn!=='player');
}

function renderEnemyStrip(){
  const strip = document.getElementById('enemyStrip');
  strip.innerHTML='';
  state.units.slice(1).forEach(u=>{
    const card = document.createElement('div');
    card.className = 'eCard'+(!u.alive?' dead':'')+(state.pendingAction && u.alive && inAttackRange(u) ? ' targetable':'')+(state.actingUnitId===u.id?' acting':'');
    card.innerHTML = `
      <div class="eIcon">${u.icon}</div>
      <div class="eName">${u.name}</div>
      <div class="eHpTrack"><div class="eHpFill" style="width:${Math.max(0,u.hp/u.maxHp*100)}%"></div></div>
      <div class="eHpVal">${Math.max(0,u.hp)}/${u.maxHp}</div>
      <div class="eDmg">⚔ ${u.dmgMin}-${u.dmgMax}</div>
    `;
    if(u.alive){
      card.onclick = ()=> tryAttackUnit(u);
    }
    strip.appendChild(card);
  });
}

function inAttackRange(target){
  const p = state.units[0];
  const w = state.pendingAction;
  if(!w) return false;
  const d = dist(p,target);
  if(d>w.range) return false;
  if(w.range>1 && !hasLineOfSight(p,target)) return false;
  return true;
}

let boardBuilt = false;
function renderBoard(){
  const board = document.getElementById('board');
  if(!boardBuilt){
    board.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    boardBuilt = true;
  }
  board.innerHTML='';
  const wrap = document.getElementById('boardWrap');
  const availW = wrap.clientWidth - 20;
  const availH = wrap.clientHeight - 20;
  const size = Math.max(28, Math.min(availW/state.cols, availH/state.rows));
  board.style.width = (size*state.cols)+'px';

  const moveSet = new Set();
  if(state.pendingAction==='move' && state.turn==='player'){
    const p = state.units[0];
    bfsReachable(p, p.ap).forEach(c=>moveSet.add(key(c.x,c.y)));
  }

  state.tiles.forEach(t=>{
    const el = document.createElement('div');
    el.className = 'tile'+(BLOCKING.includes(t.type)?' blocked':'')+(t.type===TILE.HAZARD?' hazard':'')+(t.type===TILE.EXIT?' exit':'');
    if(moveSet.has(key(t.x,t.y))) el.classList.add('moveHint');
    if(state.pendingAction && state.pendingAction!=='move' && state.turn==='player'){
      const p = state.units[0];
      const d = Math.max(Math.abs(p.x-t.x), Math.abs(p.y-t.y));
      if(d<=state.pendingAction.range && !unitAt(t.x,t.y)) {
        if(state.pendingAction.range===1 || hasLineOfSight(p,t)) el.classList.add('atkHint');
      }
    }
    el.textContent = TILE_ICON[t.type] || '';
    el.style.position='relative';
    el.onclick = ()=> onTileClick(t);

    const u = unitAt(t.x,t.y);
    if(u){
      const tok = document.createElement('div');
      tok.className = 'unitTok '+(u.isPlayer?'playerTok':'enemyTok')+(state.selectedTargetId===u.id?' selectedTarget':'')+(state.actingUnitId===u.id?' actingUnit':'');
      tok.textContent = u.icon;
      const hp = document.createElement('div');
      hp.className='miniHp';
      hp.innerHTML = `<i style="width:${Math.max(0,u.hp/u.maxHp*100)}%"></i>`;
      tok.appendChild(hp);
      if(u.isPlayer){
        const s = document.createElement('div');
        s.className='statusIcon';
        s.textContent='🎯';
        tok.appendChild(s);
      }
      el.appendChild(tok);
    }
    board.appendChild(el);
  });
}

function renderActions(){
  const row = document.getElementById('actionRow');
  row.innerHTML='';
  const p = state.units[0];

  const moveBtn = document.createElement('div');
  moveBtn.className = 'actBtn'+(state.pendingAction==='move'?' active':'')+(p.ap<1||state.turn!=='player'?' disabled':'');
  moveBtn.innerHTML = `<div class="ic">🏃</div><div class="lbl">Pindah</div><div class="sub">1 AP/petak</div>`;
  moveBtn.onclick = ()=>{
    if(state.turn!=='player'||p.ap<1) return;
    state.pendingAction = state.pendingAction==='move' ? null : 'move';
    render();
  };
  row.appendChild(moveBtn);

  p.weapons.forEach((w,idx)=>{
    const noAmmo = w.ammo!==null && w.ammo<=0;
    const btn = document.createElement('div');
    const active = state.pendingAction===w;
    btn.className = 'actBtn'+(active?' active':'')+((p.ap<w.apCost||noAmmo||state.turn!=='player')?' disabled':'');
    btn.innerHTML = `
      <div class="apBadge">${w.apCost}AP</div>
      <div class="ic">${w.icon}</div>
      <div class="lbl">${w.name}</div>
      <div class="sub">${w.dmgMin}-${w.dmgMax}${w.ammo!==null ? ' · '+w.ammo+'/'+w.maxAmmo : ''}</div>
    `;
    btn.onclick = ()=>{
      if(state.turn!=='player'||p.ap<w.apCost||noAmmo) return;
      state.pendingAction = active ? null : w;
      render();
    };
    row.appendChild(btn);
  });
}

/* ---------------- INTERACTION ---------------- */

function onTileClick(t){
  if(state.turn!=='player') return;
  const p = state.units[0];

  if(state.pendingAction==='move'){
    const reach = bfsReachable(p,p.ap).find(c=>c.x===t.x && c.y===t.y);
    if(!reach) return;
    p.ap -= reach.cost;
    p.x = t.x; p.y = t.y;
    state.pendingAction = null;
    checkHazard(p);
    render();
    return;
  }
  if(state.pendingAction && state.pendingAction!=='move'){
    const target = unitAt(t.x,t.y);
    if(target && !target.isPlayer) tryAttackUnit(target);
  }
}

function tryAttackUnit(target){
  const p = state.units[0];
  const w = state.pendingAction;
  if(!w || w==='move' || state.turn!=='player') return;
  if(!inAttackRange(target)) return;
  if(p.ap < w.apCost) return;
  if(w.ammo!==null && w.ammo<=0) return;

  p.ap -= w.apCost;
  if(w.ammo!==null) w.ammo--;
  if(typeof state.onWeaponUse === 'function') state.onWeaponUse(w);

  const distance = dist(p,target);
  const hitChance = clamp(92 - distance*4 - target.armor*0.4, 25, 97);
  const roll = Math.random()*100;
  const tileEl = findUnitTileEl(target.id);

  if(roll<=hitChance){
    let dmg = Math.round(rand(w.dmgMin,w.dmgMax));
    dmg = Math.max(1, Math.round(dmg - target.armor*0.3));
    target.hp -= dmg;
    spawnFloatText(tileEl, '-'+dmg, false);
    if(target.hp<=0){
      target.hp = 0;
      target.alive = false;
      showBanner((target.name)+' tumbang!');
    }
  } else {
    spawnFloatText(tileEl, 'Meleset', true);
  }

  state.pendingAction = null;
  render();
  checkBattleEnd();
}

function checkHazard(unit){
  const t = tileAt(unit.x,unit.y);
  if(t && t.type===TILE.HAZARD){
    const dmg = Math.round(rand(2,5));
    unit.hp -= dmg;
    const el = findUnitTileEl(unit.id);
    spawnFloatText(el, '-'+dmg+' ☣', false);
  }
}

function findUnitTileEl(unitId){
  const u = state.units.find(x=>x.id===unitId);
  if(!u) return null;
  const idx = u.y*state.cols+u.x;
  return document.getElementById('board').children[idx] || null;
}

function spawnFloatText(tileEl, text, isMiss){
  if(!tileEl) return;
  const d = document.createElement('div');
  d.className = 'dmgFloat'+(isMiss?' miss':'');
  d.textContent = text;
  d.style.left = '50%'; d.style.top='10%'; d.style.transform='translateX(-50%)';
  tileEl.appendChild(d);
  setTimeout(()=>d.remove(),800);
}

function showBanner(text){
  const b = document.getElementById('banner');
  b.textContent = text;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

function rand(a,b){ return a+Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

/* ---------------- END TURN / AI ---------------- */

document.getElementById('endTurnBtn').onclick = ()=>{
  if(state.turn!=='player') return;
  state.pendingAction = null;
  state.turn = 'enemy';
  render();
  setTimeout(runEnemyTurn, 400);
};

document.getElementById('fleeBtn').onclick = ()=>{
  const p = state.units[0];
  const t = tileAt(p.x,p.y);
  if(state.turn!=='player' || !t || t.type!==TILE.EXIT) return;
  endBattle('flee');
};

function runEnemyTurn(){
  const enemies = state.units.slice(1).filter(u=>u.alive);
  let i=0;
  function step(){
    if(i>=enemies.length){
      finishEnemyTurn();
      return;
    }
    const e = enemies[i];
    state.actingUnitId = e.id;
    render();
    setTimeout(()=>{
      enemyAct(e);
      render();
      setTimeout(()=>{
        i++;
        state.actingUnitId = null;
        step();
      }, 450);
    }, 350);
  }
  step();
}

function enemyAct(e){
  if(!e.alive) return;
  const p = state.units[0];
  if(!p.alive) return;
  const d = dist(e,p);
  if(d>1){
    const path = bfsReachable(e, e.moveRange);
    let best=null, bestD=d;
    path.forEach(c=>{
      const nd = Math.max(Math.abs(c.x-p.x), Math.abs(c.y-p.y));
      if(nd<bestD){ bestD=nd; best=c; }
    });
    if(best){ e.x=best.x; e.y=best.y; checkHazard(e); }
  }
  if(dist(e,p)<=1 && p.alive){
    const dmg = Math.round(rand(e.dmgMin,e.dmgMax));
    const realDmg = Math.max(1, Math.round(dmg - p.armor*0.3));
    p.hp -= realDmg;
    const el = findUnitTileEl(p.id);
    spawnFloatText(el, '-'+realDmg, false);
  }
}

function finishEnemyTurn(){
  const p = state.units[0];
  p.ap = p.maxAp;
  state.turn = 'player';
  render();
  checkBattleEnd();
}

function checkBattleEnd(){
  const p = state.units[0];
  if(!p.alive || p.hp<=0){
    p.hp=0; p.alive=false;
    endBattle('lose');
    return;
  }
  const enemiesLeft = state.units.slice(1).some(u=>u.alive);
  if(!enemiesLeft){
    endBattle('win');
  }
}

function endBattle(result){
  const modal = document.getElementById('modal');
  const title = document.getElementById('modalTitle');
  const desc = document.getElementById('modalDesc');
  if(result==='win'){
    title.textContent='Kemenangan'; title.className='win';
    desc.textContent='Semua musuh berhasil dikalahkan. Item hasil pertempuran dapat dijarah.';
  } else if(result==='lose'){
    title.textContent='Kalah'; title.className='lose';
    desc.textContent='Karaktermu tumbang dalam pertempuran ini.';
  } else {
    title.textContent='Kabur'; title.className='';
    desc.textContent='Kamu berhasil melarikan diri dari pertempuran.';
  }
  modal.classList.add('show');
  document.getElementById('modalBtn').onclick = ()=>{
    modal.classList.remove('show');
    if(typeof state.onEnd === 'function') {
      const p = state.units[0];
      const summary = {
        result: result,
        player: { hp: Math.max(0, p.hp), maxHp: p.maxHp, armor: p.armor, alive: p.alive },
        enemies: state.units.slice(1).map(u => Object.assign({}, u, { defeated: !u.alive }))
      };
      state.onEnd(summary);
    }
  };
}

/* ---------------- START / DEMO ---------------- */

function start(config){
  const cols = config.cols || COLS;
  const rows = config.rows || ROWS;
  const tiles = buildBoard(cols, rows);

  const player = Object.assign({
    id:'player', isPlayer:true, alive:true, x:1, y:rows-2
  }, config.player);
  player.maxArmor = player.armor;
  player.ap = player.maxAp;
  player.weapons.forEach(w=>{ if(w.ammo===undefined) w.ammo=null; if(w.maxAmmo===undefined) w.maxAmmo=w.ammo; w.range = w.range || (w.icon==='🔪'?1:5); });

  const spawnSpots = [];
  for(let x=1;x<cols-1;x++) spawnSpots.push({x,y:0});
  for(let x=1;x<cols-1;x++) spawnSpots.push({x,y:1});
  let s=0;
  const enemies = config.enemies.map((e,idx)=>{
    const spot = spawnSpots[s++ % spawnSpots.length];
    const t = tiles.find(tt=>tt.x===spot.x && tt.y===spot.y);
    if(t) t.type = TILE.EMPTY;
    return Object.assign({
      id:'e'+idx, isPlayer:false, alive:true, moveRange:3, armor:0,
      x:spot.x, y:spot.y
    }, e);
  });

  // clear player's own tile
  const pt = tiles.find(t=>t.x===player.x && t.y===player.y);
  if(pt) pt.type = TILE.EMPTY;

  state = {
    cols, rows, tiles,
    units:[player, ...enemies],
    turn:'player',
    pendingAction:null,
    selectedTargetId:null,
    actingUnitId:null,
    onEnd: config.onEnd,
    onWeaponUse: config.onWeaponUse
  };
  boardBuilt = false;
  render();
}

window.ExtinctBattle = { start };
window.addEventListener('resize', ()=>{ if(state) renderBoard(); });
