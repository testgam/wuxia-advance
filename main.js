// Wuxia Advance - gần giống game kiếm hiệp (HTML5, mobile-friendly)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha:false });

let DPR = Math.max(1, Math.min(2, window.devicePixelRatio||1));
let W=0,H=0;
function resize(){
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = (W*DPR)|0; canvas.height=(H*DPR)|0;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize', resize, {passive:true}); resize();

// ---------- utils ----------
const keys={};
addEventListener('keydown', e=>{ keys[e.key.toLowerCase()]=true; if([' '].includes(e.key)) e.preventDefault(); });
addEventListener('keyup',   e=>{ keys[e.key.toLowerCase()]=false; });
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function aabb(a,b){ return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }
function rnd(a,b){ return a + Math.random()*(b-a); }

// ---------- world ----------
const TILE=48;
const world = { walls:[], npcs:[], drops:[] };

function buildMap(){
  for(let i=0;i<22;i++){
    world.walls.push({x:TILE*i,y:TILE,w:TILE,h:12});
    world.walls.push({x:TILE*i,y:H-TILE-12,w:TILE,h:12});
  }
  for(let j=0;j<12;j++){
    world.walls.push({x:TILE,y:TILE*j,w:12,h:TILE});
    world.walls.push({x:W-TILE-12,y:TILE*j,w:12,h:TILE});
  }
  world.walls.push({x:520,y:320,w:TILE*2,h:12});
  world.walls.push({x:300,y:180,w:12,h:TILE*2});
}
function drawGround(){
  for(let y=0;y<H;y+=TILE){
    for(let x=0;x<W;x+=TILE){
      ctx.fillStyle=((x/TILE+y/TILE)%2===0)?'#13212e':'#0f1827';
      ctx.fillRect(x,y,TILE,TILE);
    }
  }
  ctx.strokeStyle='#27334a'; ctx.lineWidth=4;
  ctx.strokeRect(TILE-8,TILE-8,W-2*(TILE-8),H-2*(TILE-8));
  ctx.fillStyle='#223146';
  for(const w of world.walls) ctx.fillRect(w.x,w.y,w.w,w.h);
}

// ---------- entities ----------
class Entity{
  constructor(x,y,w,h,color){
    this.x=x; this.y=y; this.w=w; this.h=h;
    this.color=color||'#6cf';
    this.vx=0; this.vy=0; this.maxHP=100; this.hp=this.maxHP; this.dead=false;
  }
  get rect(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; }
  draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,this.w,this.h); }
  hit(d){ this.hp=Math.max(0,this.hp-d); if(this.hp<=0){ this.dead=true; onDeath(this); } }
}
function collides(r){ for(const w of world.walls){ if(aabb(r,w)) return true; } return false; }

class Player extends Entity{
  constructor(x,y){
    super(x,y,28,36,'#4bc');
    this.speed=2.4; this.facing={x:1,y:0};
    this.iframes=0; this.attackCD=0; this.dashing=0;
    this.gold=0; this.exp=0; this.level=1;
  }
  update(input){
    if(this.iframes>0) this.iframes--; if(this.attackCD>0) this.attackCD--;
    let mx=input.x, my=input.y;
    if(mx||my){ const len=Math.hypot(mx,my)||1; mx/=len; my/=len; this.facing={x:mx,y:my}; }
    const speed=this.dashing>0?this.speed*2.6:this.speed;
    this.vx=mx*speed; this.vy=my*speed;
    let nx=this.x+this.vx, ny=this.y+this.vy;
    nx=clamp(nx, TILE, W-TILE-this.w); ny=clamp(ny, TILE, H-TILE-this.h);
    if(!collides({x:nx,y:this.y,w:this.w,h:this.h})) this.x=nx;
    if(!collides({x:this.x,y:ny,w:this.w,h:this.h})) this.y=ny;
    // pickup
    for(const it of world.drops){
      if(!it.dead && aabb(this.rect, it.rect)){
        it.dead=true;
        if(it.type==='coin') this.gold+=it.value;
        if(it.type==='exp') this.gainExp(it.value);
      }
    }
  }
  attack(){
    if(this.attackCD>0) return;
    const r=28;
    const ax=this.x+this.w/2 + this.facing.x*28 - r/2;
    const ay=this.y+this.h/2 + this.facing.y*28 - r/2;
    attackVFX.push({x:ax,y:ay,t:10});
    for(const m of mobs){
      if(!m.dead && aabb({x:ax,y:ay,w:r,h:r}, m.rect)){
        m.hit(25 + (this.level-1)*5);
      }
    }
    this.attackCD=18;
  }
  dash(){ if(this.dashing===0){ this.dashing=14; this.iframes=14; } }
  skillQi(){
    if(this.attackCD>6) return;
    const s=new Projectile(this.x+this.w/2, this.y+this.h/2, this.facing.x, this.facing.y);
    projectiles.push(s); this.attackCD=14;
  }
  gainExp(v){
    this.exp+=v; const need=50+(this.level-1)*30;
    if(this.exp>=need){ this.exp-=need; this.level++; this.maxHP+=10; this.hp=this.maxHP; }
  }
}

class Mob extends Entity{
  constructor(x,y,tier=1){
    super(x,y,28,34, tier===1?'#c95':'#b35');
    this.tier=tier; this.speed=1.4 + tier*0.2;
    this.name=tier===1?'Sơn Tặc':'Sơn Tặc Đầu Lĩnh';
  }
  update(){
    if(this.dead) return;
    const dx=player.x-this.x, dy=player.y-this.y, len=Math.hypot(dx,dy)||1;
    this.vx=dx/len*this.speed; this.vy=dy/len*this.speed;
    const nx=this.x+this.vx, ny=this.y+this.vy;
    if(!collides({x:nx,y:this.y,w:this.w,h:this.h})) this.x=nx;
    if(!collides({x:this.x,y:ny,w:this.w,h:this.h})) this.y=ny;
    if(aabb(this.rect, player.rect) && player.iframes===0){
      player.hit(8+this.tier*4); player.iframes=20;
    }
  }
}

class Projectile{
  constructor(x,y,dx,dy){
    const len=Math.hypot(dx,dy)||1; this.dx=dx/len; this.dy=dy/len;
    this.x=x; this.y=y; this.w=10; this.h=10; this.life=50; this.speed=5; this.dead=false;
  }
  get rect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
  update(){
    if(this.dead) return;
    this.x+=this.dx*this.speed; this.y+=this.dy*this.speed; this.life--;
    if(this.life<=0) this.dead=true;
    for(const m of mobs){
      if(!m.dead && aabb(this.rect, m.rect)){
        m.hit(30 + (player.level-1)*6);
        this.dead=true; break;
      }
    }
  }
  draw(){ ctx.strokeStyle='#9be'; ctx.strokeRect(this.x-5,this.y-5,10,10); }
}

// ---------- NPC & quest ----------
class NPC{
  constructor(x,y,name,lines){ this.x=x; this.y=y; this.w=28; this.h=36; this.name=name; this.lines=lines; this.step=0; this.color='#8ad'; }
  get rect(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; }
  draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,this.w,this.h); ctx.fillStyle='#ddd'; ctx.font='12px sans-serif'; ctx.fillText(this.name, this.x-6, this.y-6); }
  talk(){ const line=this.lines[this.step]||this.lines[this.lines.length-1]; showBubble(this,line); if(this.step<this.lines.length-1) this.step++; }
}

let quest={stage:0,target:3};
const elder = new NPC(440,220,'Trưởng Lão',[
  'Thiếu hiệp đến đúng lúc!',
  'Bọn sơn tặc lảng vảng, hãy đánh bại 3 tên.',
  'Tốt lắm! Đây là chút lễ vật.'
]);

function interact(){
  if(aabb(player.rect, elder.rect)){
    elder.talk();
    if(quest.stage===0) quest.stage=1;
    if(quest.stage===2){ quest.stage=3; player.gold+=30; }
  }
}
function updateQuest(){
  if(quest.stage===1){
    if(aliveKilled>=3) quest.stage=2;
  }
}

// ---------- drops & death ----------
function onDeath(ent){
  if(ent instanceof Mob){
    aliveKilled++;
    world.drops.push(new Drop(ent.x+10, ent.y+10, 'coin', 5+Math.floor(Math.random()*6)));
    world.drops.push(new Drop(ent.x+5,  ent.y+5,  'exp',  12+Math.floor(Math.random()*8)));
  }
}
class Drop{
  constructor(x,y,type,value){ this.x=x; this.y=y; this.w=16; this.h=16; this.type=type; this.value=value; this.dead=false; }
  get rect(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; }
  draw(){ ctx.fillStyle=this.type==='coin'?'#e5c158':'#7cc8ff'; ctx.fillRect(this.x,this.y,this.w,this.h); }
}

// ---------- systems ----------
let player = new Player(200,300);
let mobs = [];
let projectiles=[];
let attackVFX=[];
let aliveKilled=0;

function spawnWave(n){
  for(let i=0;i<n;i++){
    const x=rnd(TILE*2, W-TILE*3), y=rnd(TILE*2, H-TILE*3);
    mobs.push(new Mob(x,y, Math.random()<0.2?2:1));
  }
}

// UI & dialogs
function drawUI(){
  const stats=document.getElementById('stats');
  stats.textContent=
    'Lv ' + player.level + ' | HP ' + player.hp + '/' + player.maxHP +
    ' - Vàng ' + player.gold + ' - EXP ' + player.exp;

  const q=document.getElementById('quest');
  q.textContent = quest.stage===0 ? 'Nhiệm vụ: Nói chuyện với Trưởng Lão (E)'
             : quest.stage===1 ? ('Nhiệm vụ: Hạ 3 sơn tặc (đã hạ ' + aliveKilled + ')')
             : quest.stage===2 ? 'Nhiệm vụ: Trở về báo cáo (E)'
             : 'Nhiệm vụ: Hoàn thành';
}
function showBubble(npc, text){
  const pad=8, maxw=280;
  ctx.save(); ctx.font='14px system-ui';
  const words=text.split(' '); let line='', lines=[];
  for(const w of words){
    const m=ctx.measureText(line+w+' ');
    if(m.width>maxw){ lines.push(line); line=w+' '; } else line+=w+' ';
  }
  lines.push(line);
  const bw=maxw+pad*2, bh=lines.length*18+pad*2;
  const bx=clamp(npc.x-20, TILE, W-bw-TILE), by=clamp(npc.y-60, TILE, H-bh-TILE);
  ctx.fillStyle='rgba(20,24,36,.85)'; ctx.fillRect(bx,by,bw,bh);
  ctx.strokeStyle='#4aa3'; ctx.strokeRect(bx,by,bw,bh);
  ctx.fillStyle='#ddd';
  for(let i=0;i<lines.length;i++){ ctx.fillText(lines[i], bx+pad, by+pad+16*i+2); }
  ctx.restore();
}

// ---------- save/load ----------
function saveGame(){
  const data={
    x:player.x,y:player.y,hp:player.hp,gold:player.gold,exp:player.exp,level:player.level,quest,aliveKilled,
    mobs:mobs.filter(m=>!m.dead).map(m=>({x:m.x,y:m.y,tier:m.tier})),
    drops:world.drops.filter(d=>!d.dead).map(d=>({x:d.x,y:d.y,type:d.type,value:d.value}))
  };
  localStorage.setItem('wuxia_adv', JSON.stringify(data));
}
function loadGame(){
  const s=localStorage.getItem('wuxia_adv'); if(!s) return;
  try{
    const d=JSON.parse(s);
    player=new Player(d.x,d.y); player.hp=d.hp; player.gold=d.gold; player.exp=d.exp; player.level=d.level;
    quest=d.quest; aliveKilled=d.aliveKilled;
    mobs = d.mobs.map(m=>new Mob(m.x,m.y,m.tier));
    world.drops = d.drops.map(t=>{ const dd=new Drop(t.x,t.y,t.type,t.value); return dd; });
  }catch(e){ console.warn(e); }
}

// ---------- input (mobile + keyboard) ----------
const joy=document.getElementById('joystick');
const joyKnob=document.getElementById('joy-knob');
let joyCenter={x:joy.offsetWidth/2,y:joy.offsetHeight/2};
let joyInput={x:0,y:0};
let joyActive=false;

function joyUpdate(px,py){
  const rect=joy.getBoundingClientRect();
  const x=px-rect.left, y=py-rect.top;
  const dx=x-joyCenter.x, dy=y-joyCenter.y;
  const r=60; const len=Math.hypot(dx,dy);
  const ux=len>0?dx/len:0, uy=len>0?dy/len:0;
  const mag=Math.min(1,len/r);
  joyInput.x=ux*mag; joyInput.y=uy*mag;
  joyKnob.style.left=(joyCenter.x+ux*r-15)+'px';
  joyKnob.style.top =(joyCenter.y+uy*r-15)+'px';
}
function joyEnd(){
  joyActive=false; joyInput.x=0; joyInput.y=0;
  joyKnob.style.left=(joyCenter.x-15)+'px';
  joyKnob.style.top =(joyCenter.y-15)+'px';
}
['touchstart','mousedown'].forEach(ev=>{
  joy.addEventListener(ev, e=>{
    joyActive=true; const p = ev==='mousedown'? e : e.touches[0];
    joyUpdate(p.clientX,p.clientY); if(e.cancelable) e.preventDefault();
  }, {passive:false});
});
['touchmove','mousemove'].forEach(ev=>{
  addEventListener(ev, e=>{
    if(!joyActive) return;
    const p = ev==='mousemove'? e : e.touches[0];
    joyUpdate(p.clientX,p.clientY); if(e.cancelable) e.preventDefault();
  }, {passive:false});
});
['touchend','mouseup','touchcancel','mouseleave'].forEach(ev=> addEventListener(ev, joyEnd));

document.getElementById('btn-attack').onclick=()=>player.attack();
document.getElementById('btn-dash').onclick=()=>player.dash();
document.getElementById('btn-talk').onclick=()=>interact();
document.getElementById('btn-skill').onclick=()=>player.skillQi();

addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  if(k==='j') player.attack();
  if(k==='k') player.dash();
  if(k==='e') interact();
  if(k==='q') player.skillQi();
  if(k==='p') saveGame();
  if(k==='o') loadGame();
  if(k==='m') togglePanel(true);
});

// ---------- panel (menu) ----------
const panel=document.getElementById('panel');
function togglePanel(show){ panel.classList.toggle('hidden', !show); renderPanel(); }
document.getElementById('btn-close').onclick=()=>togglePanel(false);
document.getElementById('btn-save').onclick=()=>saveGame();
document.getElementById('btn-load').onclick=()=>loadGame();
function renderPanel(){
  if(panel.classList.contains('hidden')) return;
  document.getElementById('char').textContent=
    'Cấp: ' + player.level + ' | HP: ' + player.hp + '/' + player.maxHP +
    ' | Vàng: ' + player.gold + ' | EXP: ' + player.exp;
  const bag=document.getElementById('bag'); bag.innerHTML='';
  for(let i=0;i<10;i++){ const s=document.createElement('div'); s.className='slot'; s.textContent='—'; bag.appendChild(s); }
}

// ---------- loop ----------
function loop(){
  const input={
    x:(keys['d']?1:0) - (keys['a']?1:0) + joyInput.x,
    y:(keys['s']?1:0) - (keys['w']?1:0) + joyInput.y
  };
  player.update(input);
  for(const m of mobs) m.update();
  for(const p of projectiles) p.update();
  projectiles=projectiles.filter(p=>!p.dead);
  updateQuest();

  ctx.clearRect(0,0,W,H);
  drawGround();
  for(const n of world.npcs) n.draw();
  for(const m of mobs){ if(!m.dead) m.draw(); }
  for(const d of world.drops){ if(!d.dead) d.draw(); }
  player.draw();
  for(const v of attackVFX){ ctx.strokeStyle='#9be'; ctx.strokeRect(v.x,v.y,28,28); v.t--; }
  attackVFX=attackVFX.filter(v=>v.t>0);
  for(const p of projectiles) p.draw();
  drawUI();

  requestAnimationFrame(loop);
}

// ---------- start ----------
let projectiles=[]; let attackVFX=[];
function spawnStart(){ for(let i=0;i<3;i++){ const x=rnd(TILE*2, W-TILE*3), y=rnd(TILE*2, H-TILE*3); mobs.push(new Mob(x,y, Math.random()<0.2?2:1)); } }
function init(){ buildMap(); world.npcs.push(elder); spawnStart(); loop(); }
init();

// prevent scroll on canvas
document.body.addEventListener('touchmove', e=>{ if(e.target===canvas) e.preventDefault(); }, {passive:false});
