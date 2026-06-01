const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highEl = document.getElementById('high');
const waveEl = document.getElementById('wave');
const heartsEl = document.getElementById('hearts');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const messageEl = document.getElementById('message');
const bossBar = document.getElementById('bossBar');
const bossMeter = document.getElementById('bossMeter');
const bossText = document.getElementById('bossText');

const storage = {
  get(key, fallback = '0') {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (error) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Keep playing if browser privacy settings block saved scores.
    }
  }
};

const W = canvas.width;
const H = canvas.height;
const keys = { up:false, down:false, left:false, right:false, fire:false, dash:false };
const touchMove = { active: false, x: 0, y: 0 };
let last = 0;
let running = false;
let score = 0;
let high = Number(storage.get('crownQuestHigh'));
let wave = 1;
let hearts = 3;
let spawnTimer = 0;
let gemTimer = 0;
let fireTimer = 0;
let dashTimer = 0;
let invuln = 0;
let messageTimer = 0;
let boss = null;
let bossWave = 0;

const hero = { x: 140, y: H / 2, vx: 0, vy: 0, r: 18, speed: 205, facing: 0, dash: 0 };
const shots = [];
const enemies = [];
const gems = [];
const sparks = [];

highEl.textContent = high;

function reset() {
  score = 0; wave = 1; hearts = 3; spawnTimer = 0; gemTimer = 1; fireTimer = 0; dashTimer = 0; invuln = 0; boss = null; bossWave = 0;
  hero.x = 140; hero.y = H / 2; hero.vx = 0; hero.vy = 0; hero.facing = 0; hero.dash = 0;
  shots.length = enemies.length = gems.length = sparks.length = 0;
  running = true;
  overlay.classList.add('hidden');
  showMessage('Collect gems and blast shadows. Boss waves arrive every 3 waves.');
  updateHud();
}

function showMessage(text, time = 2.2) { messageEl.textContent = text; messageTimer = time; messageEl.style.display = 'block'; }
function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function addSparks(x, y, color, count = 12) { for (let i = 0; i < count; i++) sparks.push({ x, y, vx: rand(-170, 170), vy: rand(-170, 170), life: rand(.25, .65), color }); }

function updateHud() {
  scoreEl.textContent = score;
  highEl.textContent = high;
  waveEl.textContent = wave;
  heartsEl.textContent = '♥'.repeat(Math.max(0, hearts));
  if (boss) {
    const pct = Math.max(0, boss.hp / boss.maxHp * 100);
    bossBar.style.display = 'block';
    bossMeter.style.width = pct + '%';
    bossText.textContent = Math.round(pct) + '%';
  } else {
    bossBar.style.display = 'none';
  }
}

function spawnEnemy() {
  const type = wave > 4 && Math.random() < .36 ? 'brute' : 'shadow';
  enemies.push({ type, x: W + 40, y: rand(76, H - 80), r: type === 'brute' ? 26 : 18, hp: type === 'brute' ? 3 : 1, speed: rand(95, 150) + wave * 8, wobble: rand(0, Math.PI * 2) });
}
function spawnGem() { gems.push({ x: W + 28, y: rand(72, H - 70), r: 13, speed: rand(105, 155), pulse: rand(0, 10) }); }
function spawnBoss() {
  bossWave = wave;
  boss = { x: W + 120, y: H / 2, r: 54, hp: 18 + wave * 5, maxHp: 18 + wave * 5, speed: 70 + wave * 4, wobble: rand(0, 7), summon: 1.4 };
  showMessage('Gate Guardian incoming!', 2.4);
}

function fire() {
  if (fireTimer > 0) return;
  shots.push({ x: hero.x + 24, y: hero.y, vx: 560, r: 6, life: 1.2 });
  fireTimer = .18;
}
function startDash() {
  if (dashTimer > 0) return;
  hero.dash = .16;
  dashTimer = 1.1;
  invuln = Math.max(invuln, .22);
  addSparks(hero.x, hero.y, '#66e8ff', 10);
}

function damageHero(amount) {
  if (invuln > 0) return;
  hearts -= amount;
  invuln = 1.1;
  addSparks(hero.x, hero.y, '#ff5d73', 26);
  showMessage(hearts > 0 ? 'Ouch! Keep moving.' : 'Quest over — try again!', 1.6);
  if (hearts <= 0) endGame();
}
function damageBoss(amount) {
  if (!boss) return;
  boss.hp -= amount;
  addSparks(boss.x, boss.y, '#ffd166', 7);
  if (boss.hp <= 0) {
    score += 500 + wave * 40;
    addSparks(boss.x, boss.y, '#ffd166', 64);
    showMessage('Guardian defeated! Bonus points + repair heart.', 2.8);
    hearts = Math.min(5, hearts + 1);
    boss = null;
  }
}
function endGame() {
  running = false;
  const newRecord = score > high;
  if (newRecord) { high = score; storage.set('crownQuestHigh', String(high)); }
  overlay.classList.remove('hidden');
  overlay.querySelector('.start-card').innerHTML = `<p class="kicker">Crown Quest</p><h1>${newRecord ? 'New Record!' : 'Quest Over'}</h1><p>You scored <b>${score}</b> and reached wave <b>${wave}</b>. High score: <b>${high}</b>.</p><button id="restartBtn" type="button">Play Again</button><p class="hint">Tip: Dash makes you briefly safe.</p>`;
  document.getElementById('restartBtn').addEventListener('click', reset);
  updateHud();
}

function update(dt) {
  if (!running) return;
  wave = 1 + Math.floor(score / 450);
  fireTimer = Math.max(0, fireTimer - dt);
  dashTimer = Math.max(0, dashTimer - dt);
  invuln = Math.max(0, invuln - dt);
  if (messageTimer > 0) { messageTimer -= dt; if (messageTimer <= 0) messageEl.style.display = 'none'; }

  const mx = touchMove.active ? touchMove.x : (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const my = touchMove.active ? touchMove.y : (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const len = Math.hypot(mx, my) || 1;
  const targetSpeed = hero.speed * (hero.dash > 0 ? 2.45 : 1);
  const tx = (mx / len) * targetSpeed;
  const ty = (my / len) * targetSpeed;
  const ease = 1 - Math.exp(-dt * (touchMove.active ? 8.5 : 11));
  hero.vx += (tx - hero.vx) * ease;
  hero.vy += (ty - hero.vy) * ease;
  if (mx || my) hero.facing = Math.atan2(my, mx);
  hero.dash = Math.max(0, hero.dash - dt);
  hero.x = clamp(hero.x + hero.vx * dt, 34, W - 40);
  hero.y = clamp(hero.y + hero.vy * dt, 58, H - 42);
  if (keys.fire) fire();
  if (keys.dash) startDash();

  spawnTimer -= dt;
  if (spawnTimer <= 0 && !boss) { spawnEnemy(); spawnTimer = Math.max(.38, 1.05 - wave * .06); }
  gemTimer -= dt;
  if (gemTimer <= 0) { spawnGem(); gemTimer = rand(1.4, 2.4); }
  if (!boss && wave >= 3 && wave % 3 === 0 && bossWave !== wave) spawnBoss();

  for (const s of shots) { s.x += s.vx * dt; s.life -= dt; }
  for (const e of enemies) { e.x -= e.speed * dt; e.y += Math.sin(performance.now() / 260 + e.wobble) * 35 * dt; }
  for (const g of gems) { g.x -= g.speed * dt; g.pulse += dt * 6; }
  if (boss) {
    boss.x = Math.max(W - 170, boss.x - boss.speed * dt);
    boss.y = H / 2 + Math.sin(performance.now() / 520 + boss.wobble) * 145;
    boss.summon -= dt;
    if (boss.summon <= 0) { enemies.push({ type: 'shadow', x: boss.x - 70, y: boss.y + rand(-60, 60), r: 16, hp: 1, speed: 190 + wave * 8, wobble: rand(0, 7) }); boss.summon = 2.2; }
  }
  for (const sp of sparks) { sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.life -= dt; }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.x < -40) { enemies.splice(i, 1); damageHero(1); continue; }
    if (distance(hero, e) < hero.r + e.r) { enemies.splice(i, 1); damageHero(1); continue; }
    for (let j = shots.length - 1; j >= 0; j--) {
      if (distance(e, shots[j]) < e.r + shots[j].r) {
        shots.splice(j, 1); e.hp -= 1; addSparks(e.x, e.y, '#66e8ff', 8);
        if (e.hp <= 0) { score += e.type === 'brute' ? 75 : 30; addSparks(e.x, e.y, '#66e8ff', 18); enemies.splice(i, 1); }
        break;
      }
    }
  }
  if (boss) {
    if (distance(hero, boss) < hero.r + boss.r) { damageHero(1); hero.x -= 40; }
    for (let j = shots.length - 1; j >= 0 && boss; j--) {
      if (distance(boss, shots[j]) < boss.r + shots[j].r) { shots.splice(j, 1); damageBoss(1); }
    }
  }
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    if (g.x < -30) gems.splice(i, 1);
    else if (distance(hero, g) < hero.r + g.r) { score += 20; addSparks(g.x, g.y, '#1ed760', 18); gems.splice(i, 1); }
  }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].x > W + 30 || shots[i].life <= 0) shots.splice(i, 1);
  for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
  if (score > high) { high = score; storage.set('crownQuestHigh', String(high)); }
  updateHud();
}

function drawHero() {
  ctx.save(); ctx.translate(hero.x, hero.y);
  if (invuln > 0 && Math.floor(performance.now() / 90) % 2) ctx.globalAlpha = .45;
  ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.beginPath(); ctx.ellipse(0, 21, 28, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1ed760'; round(-18, -20, 36, 40, 10); ctx.fill();
  ctx.fillStyle = '#ffd166'; round(-13, -41, 26, 22, 8); ctx.fill();
  ctx.fillStyle = '#7c4cff'; round(-16, -49, 32, 8, 4); ctx.fill();
  ctx.rotate(hero.facing);
  ctx.fillStyle = '#66e8ff'; round(10, -4, 30, 8, 4); ctx.fill();
  ctx.restore();
}
function round(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function drawEnemy(e) { ctx.save(); ctx.translate(e.x, e.y); ctx.fillStyle = e.type === 'brute' ? '#ff8a3d' : '#ff5d73'; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#23040b'; ctx.fillRect(-8, -5, 16, 10); ctx.restore(); }
function drawBoss() { if (!boss) return; ctx.save(); ctx.translate(boss.x, boss.y); ctx.fillStyle = '#31164d'; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 5; round(-62, -36, 124, 72, 22); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ff5d73'; ctx.fillRect(-32, -10, 24, 20); ctx.fillRect(10, -10, 24, 20); ctx.restore(); }

function render() {
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#183c6d'); bg.addColorStop(.48, '#28526b'); bg.addColorStop(.49, '#4c7a3b'); bg.addColorStop(1, '#203412'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 24; i++) { ctx.beginPath(); ctx.ellipse((i * 113 - performance.now() / 42) % (W + 80), 58 + (i * 37) % 155, 38, 10, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#77583b'; for (let x = -40; x < W; x += 120) { ctx.fillRect(x, H - 78, 78, 78); ctx.fillRect(x + 18, H - 130 - (x % 3) * 12, 40, 60); }
  for (const g of gems) { ctx.save(); ctx.translate(g.x, g.y + Math.sin(g.pulse) * 4); ctx.fillStyle = '#1ed760'; ctx.rotate(Math.PI / 4); ctx.fillRect(-10, -10, 20, 20); ctx.restore(); }
  for (const s of shots) { ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(s.x - 24, s.y - 2, 22, 4); }
  for (const e of enemies) drawEnemy(e);
  drawBoss();
  for (const sp of sparks) { ctx.globalAlpha = Math.max(0, sp.life * 2); ctx.fillStyle = sp.color; ctx.beginPath(); ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
  drawHero();
  requestAnimationFrame(render);
}
function loop(t) { const dt = Math.min(.033, (t - last) / 1000 || 0); last = t; update(dt); requestAnimationFrame(loop); }

const keyMap = { ArrowUp:'up', w:'up', W:'up', ArrowDown:'down', s:'down', S:'down', ArrowLeft:'left', a:'left', A:'left', ArrowRight:'right', d:'right', D:'right', ' ':'fire', Shift:'dash' };
addEventListener('keydown', e => { const k = keyMap[e.key]; if (k) { e.preventDefault(); keys[k] = true; } });
addEventListener('keyup', e => { const k = keyMap[e.key]; if (k) { e.preventDefault(); keys[k] = false; } });
function clearTouchMove() {
  touchMove.active = false;
  touchMove.x = 0;
  touchMove.y = 0;
}

const touchPad = document.querySelector('.touch-pad');
function updateTouchMove(event) {
  if (!touchPad) return;
  event.preventDefault();
  touchPad.setPointerCapture?.(event.pointerId);
  const rect = touchPad.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  const radius = Math.max(1, Math.min(rect.width, rect.height) * .38);
  const mag = Math.hypot(dx, dy);
  const deadzone = radius * .18;
  if (mag < deadzone) {
    clearTouchMove();
    return;
  }
  const strength = Math.min(1, (mag - deadzone) / (radius - deadzone));
  touchMove.active = true;
  touchMove.x = (dx / mag) * strength;
  touchMove.y = (dy / mag) * strength;
}
if (touchPad) {
  touchPad.addEventListener('pointerdown', updateTouchMove);
  touchPad.addEventListener('pointermove', updateTouchMove);
  touchPad.addEventListener('pointerup', event => { event.preventDefault(); clearTouchMove(); });
  touchPad.addEventListener('pointercancel', event => { event.preventDefault(); clearTouchMove(); });
  touchPad.addEventListener('lostpointercapture', clearTouchMove);
}

document.querySelectorAll('.touch-actions button[data-key]').forEach(button => {
  const key = button.dataset.key;
  const press = event => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); keys[key] = true; };
  const release = event => { event.preventDefault(); keys[key] = false; };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
});
startBtn.addEventListener('click', reset);
requestAnimationFrame(render);
requestAnimationFrame(loop);
