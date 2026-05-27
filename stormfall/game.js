"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const menu = document.querySelector("#menu");
const help = document.querySelector("#help");
const startButton = document.querySelector("#startGame");
const helpButton = document.querySelector("#toggleHelp");

const W = canvas.width;
const H = canvas.height;
const WORLD_W = 2100;
const WORLD_H = 1280;
const keys = new Set();
const pressed = new Set();
let gameState = "menu";
let lastTime = performance.now();
let elapsed = 0;
let message = "Reach camp, gather supplies, and prepare for Robot Cat.";
const camera = { x: 0, y: 0 };

const colors = {
  grass: "#344736",
  grass2: "#263a2d",
  plains: "#5a4930",
  ash: "#2d2d2a",
  mud: "#4b3c2f",
  water: "#355d63",
  road: "#565046",
  camp: "#755b3a",
  wood: "#8d6841",
  scrap: "#9ba2a3",
  herb: "#79a96b",
  ember: "#c55d3d",
  spirit: "#b9e5da",
  boss: "#7c8794",
  danger: "#d96f58",
  ui: "#f2efe6",
};

const questTemplate = [
  { id: "gather", text: "Gather 5 wood, 4 scrap, and 2 med herbs", done: false },
  { id: "build", text: "Build a shelter and crafting bench at camp", done: false },
  { id: "craft", text: "Craft 2 storm spears for the team", done: false },
  { id: "spirits", text: "Defeat 4 tornado spirits", done: false },
  { id: "boss", text: "Destroy Robot Cat", done: false },
];

const burningQuestTemplate = [
  { id: "gather", text: "Recover 4 scrap, 2 herbs, and 2 storm cores", done: false },
  { id: "build", text: "Hold the highway camp and repair the forge", done: false },
  { id: "craft", text: "Craft 2 storm spears for the fire hunt", done: false },
  { id: "spirits", text: "Defeat 5 ember tornado spirits", done: false },
  { id: "boss", text: "Defeat the Flying Fire Shark", done: false },
];

const inputMaps = [
  {
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    action: "KeyE",
    attack: "KeyF",
    craft: "KeyC",
  },
  {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    action: "Slash",
    attack: "Period",
    craft: "Comma",
  },
];
const gameCodes = new Set(inputMaps.flatMap((map) => Object.values(map)).concat(["Space"]));

const state = {
  level: 1,
  levelName: "Scrapyard Forest",
  resources: { wood: 0, scrap: 0, herbs: 0, stormCores: 0 },
  camp: {
    x: 255,
    y: 990,
    r: 96,
    shelter: false,
    bench: false,
    med: false,
    wall: 0,
  },
  built: [],
  quests: questTemplate.map((q) => ({ ...q })),
  spiritsDefeated: 0,
  bossUnlocked: false,
  bossDefeated: false,
  finalUnlocked: false,
};

const players = [
  createPlayer(1, 225, 990, "#e6c26f", inputMaps[0], "Ranger"),
  createPlayer(2, 285, 1015, "#6db2e4", inputMaps[1], "Mechanic"),
];

const pickups = [
  ...scatter("wood", 24, 80, 1920, 120, 1160),
  ...scatter("scrap", 22, 430, 1980, 95, 1120),
  ...scatter("herbs", 16, 90, 1600, 170, 1110),
  { type: "vehiclePart", x: 1780, y: 1030, r: 14, taken: false },
];

const enemies = [
  createSpirit(720, 350),
  createSpirit(1040, 245),
  createSpirit(1390, 440),
  createSpirit(1240, 880),
  createSpirit(1690, 740),
  createSpirit(1840, 310),
];

const boss = {
  name: "Robot Cat",
  kind: "cat",
  x: 1780,
  y: 230,
  r: 40,
  hp: 360,
  maxHp: 360,
  active: false,
  alive: true,
  cooldown: 1.8,
  phase: 1,
};

const bullets = [];
const hazards = [];

function createPlayer(id, x, y, color, map, role) {
  return {
    id,
    x,
    y,
    r: 15,
    color,
    role,
    hp: 100,
    maxHp: 100,
    downed: false,
    bleed: 16,
    respawn: 0,
    weapon: "knife",
    spears: 0,
    inv: { wood: 0, scrap: 0, herbs: 0, stormCores: 0 },
    map,
    facingX: 1,
    facingY: 0,
    attackCd: 0,
    actionCd: 0,
    craftCd: 0,
    revived: 0,
    gearLost: 0,
  };
}

function createSpirit(x, y, type = "storm") {
  return {
    x,
    y,
    r: 18,
    hp: type === "ember" ? 84 : 70,
    maxHp: type === "ember" ? 84 : 70,
    speed: type === "ember" ? 52 : 46,
    type,
    alive: true,
    spin: Math.random() * Math.PI * 2,
    attackCd: 0,
    notice: 330,
  };
}

function scatter(type, count, minX, maxX, minY, maxY) {
  return Array.from({ length: count }, (_, i) => ({
    type,
    x: minX + ((maxX - minX) * ((i * 73) % 101)) / 101,
    y: minY + ((maxY - minY) * ((i * 47 + 13) % 97)) / 97,
    r: type === "scrap" ? 12 : 10,
    taken: false,
  }));
}

function startGame() {
  gameState = "play";
  menu.classList.add("hidden");
  message = "Quest started: stabilize camp in Scrapyard Forest.";
}

function enterBurningPlains() {
  state.level = 2;
  state.levelName = "Burning Plains";
  state.camp.x = 280;
  state.camp.y = 1035;
  state.camp.r = 104;
  state.camp.shelter = true;
  state.camp.bench = true;
  state.camp.med = true;
  state.camp.wall = 2;
  state.built = [
    { kind: "Shelter", x: 215, y: 990 },
    { kind: "Weapon Forge", x: 332, y: 990 },
    { kind: "Medical Station", x: 345, y: 1080 },
    { kind: "Wall", x: 225, y: 1140 },
    { kind: "Wall", x: 275, y: 1145 },
  ];
  state.quests = burningQuestTemplate.map((q) => ({ ...q }));
  state.spiritsDefeated = 0;
  state.bossUnlocked = false;
  state.bossDefeated = false;
  state.finalUnlocked = false;

  pickups.splice(
    0,
    pickups.length,
    ...scatter("scrap", 24, 420, 1980, 120, 1110),
    ...scatter("wood", 14, 110, 1750, 240, 1160),
    ...scatter("herbs", 10, 160, 1620, 260, 1120),
    { type: "vehiclePart", x: 1540, y: 960, r: 14, taken: false },
    { type: "vehiclePart", x: 1880, y: 455, r: 14, taken: false },
  );
  enemies.splice(
    0,
    enemies.length,
    createSpirit(660, 520, "ember"),
    createSpirit(920, 260, "ember"),
    createSpirit(1160, 760, "ember"),
    createSpirit(1390, 425, "ember"),
    createSpirit(1640, 725, "ember"),
    createSpirit(1860, 300, "ember"),
    createSpirit(1760, 960, "ember"),
  );

  boss.name = "Flying Fire Shark";
  boss.kind = "shark";
  boss.x = 1760;
  boss.y = 285;
  boss.r = 46;
  boss.maxHp = 430;
  boss.hp = boss.maxHp;
  boss.active = false;
  boss.alive = true;
  boss.cooldown = 1.4;
  boss.phase = 1;

  for (const p of players) {
    p.x = state.camp.x + (p.id === 1 ? -32 : 32);
    p.y = state.camp.y + (p.id === 1 ? -4 : 18);
    p.hp = p.maxHp;
  }
  bullets.length = 0;
  hazards.length = 0;
  message = "Burning Plains reached. Ember spirits guard the Flying Fire Shark.";
}

function resetAtCamp(player) {
  player.x = state.camp.x + (player.id === 1 ? -24 : 24);
  player.y = state.camp.y + (player.id === 1 ? 8 : -8);
  player.hp = Math.round(player.maxHp * 0.7);
  player.downed = false;
  player.bleed = 16;
  player.respawn = 0;
  player.spears = 0;
  player.weapon = "knife";
  player.gearLost += 1;
  message = `${player.role} respawned at camp and lost carried gear.`;
}

function update(dt) {
  elapsed += dt;
  updatePlayers(dt);
  updateEnemies(dt);
  updateBoss(dt);
  updateBullets(dt);
  updateHazards(dt);
  updateQuests();
}

function updatePlayers(dt) {
  for (const p of players) {
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.actionCd = Math.max(0, p.actionCd - dt);
    p.craftCd = Math.max(0, p.craftCd - dt);

    if (p.downed) {
      p.bleed -= dt;
      if (p.bleed <= 0) resetAtCamp(p);
      continue;
    }

    let dx = 0;
    let dy = 0;
    if (keys.has(p.map.up)) dy -= 1;
    if (keys.has(p.map.down)) dy += 1;
    if (keys.has(p.map.left)) dx -= 1;
    if (keys.has(p.map.right)) dx += 1;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    if (dx || dy) {
      p.facingX = dx;
      p.facingY = dy;
    }
    const campBonus = inCamp(p) && state.camp.shelter ? 1.08 : 1;
    p.x = clamp(p.x + dx * 170 * campBonus * dt, 26, WORLD_W - 26);
    p.y = clamp(p.y + dy * 170 * campBonus * dt, 42, WORLD_H - 30);

    if (pressed.has(p.map.attack)) attack(p);
    if (pressed.has(p.map.action)) interact(p);
    if (pressed.has(p.map.craft)) craft(p);

    if (inCamp(p) && state.camp.med && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + 5 * dt);
    }
  }
}

function attack(p) {
  if (p.attackCd > 0 || p.downed) return;
  p.attackCd = p.weapon === "storm spear" ? 0.45 : 0.62;
  const range = p.weapon === "storm spear" ? 74 : 46;
  const damage = p.weapon === "storm spear" ? 36 : 20;
  const hitX = p.x + p.facingX * range;
  const hitY = p.y + p.facingY * range;

  for (const e of enemies) {
    if (e.alive && dist(hitX, hitY, e.x, e.y) < range) {
      e.hp -= damage;
      const away = Math.atan2(e.y - p.y, e.x - p.x);
      e.x = clamp(e.x + Math.cos(away) * 34, 20, WORLD_W - 20);
      e.y = clamp(e.y + Math.sin(away) * 34, 44, WORLD_H - 20);
      if (e.hp <= 0) {
        e.alive = false;
        state.resources.stormCores += 1;
        state.spiritsDefeated += 1;
        message = "A tornado spirit collapsed into a storm core.";
      }
      return;
    }
  }

  if (boss.alive && boss.active && dist(hitX, hitY, boss.x, boss.y) < range + boss.r) {
    boss.hp -= damage;
    if (boss.hp < boss.maxHp * 0.45) boss.phase = 2;
    if (boss.hp <= 0) {
      boss.alive = false;
      state.bossDefeated = true;
      if (state.level === 1) {
        message = "Robot Cat destroyed. Press E at camp to travel to Burning Plains.";
      } else {
        state.finalUnlocked = true;
        message = "Flying Fire Shark defeated. Flooded Ruins route unlocked for the next build.";
      }
    }
  }
}

function interact(p) {
  if (p.actionCd > 0) return;
  p.actionCd = 0.35;

  const ally = players.find((other) => other !== p && other.downed && dist(p.x, p.y, other.x, other.y) < 42);
  if (ally && p.inv.herbs + state.resources.herbs > 0) {
    spendResource("herbs", 1);
    ally.downed = false;
    ally.hp = 45;
    ally.bleed = 16;
    p.revived += 1;
    message = `${p.role} revived ${ally.role}.`;
    return;
  }

  for (const item of pickups) {
    if (!item.taken && dist(p.x, p.y, item.x, item.y) < 34) {
      item.taken = true;
      if (item.type === "vehiclePart") {
        state.resources.scrap += 3;
        message =
          state.level === 1
            ? "Recovered vehicle parts. Garage repairs can come in a later build."
            : "Recovered armored car parts for the Burning Plains garage.";
      } else {
        state.resources[item.type] += 1;
        p.inv[item.type] += 1;
        message = `Gathered ${item.type}.`;
      }
      return;
    }
  }

  if (inCamp(p)) {
    if (state.level === 1 && state.bossDefeated) {
      enterBurningPlains();
      return;
    }
    buildCamp();
    return;
  }

  if (dist(p.x, p.y, boss.x, boss.y) < 110 && state.bossUnlocked && boss.alive) {
    boss.active = true;
    message =
      boss.kind === "cat"
        ? "Robot Cat activated: keep moving and strike between charges."
        : "Flying Fire Shark dives in: dodge the ember volleys.";
  }
}

function craft(p) {
  if (p.craftCd > 0 || !inCamp(p)) return;
  p.craftCd = 0.5;
  if (!state.camp.bench) {
    message = "Build a crafting bench at camp before crafting weapons.";
    return;
  }
  if (state.resources.wood >= 1 && state.resources.scrap >= 2 && state.resources.stormCores >= 1) {
    spendResource("wood", 1);
    spendResource("scrap", 2);
    spendResource("stormCores", 1);
    p.weapon = "storm spear";
    p.spears += 1;
    message = `${p.role} crafted a storm spear.`;
  } else {
    message = "Storm spear needs 1 wood, 2 scrap, and 1 storm core.";
  }
}

function buildCamp() {
  if (!state.camp.shelter && state.resources.wood >= 3) {
    spendResource("wood", 3);
    state.camp.shelter = true;
    state.built.push({ kind: "Shelter", x: 190, y: 945 });
    message = "Shelter built. Camp respawns are safer.";
    return;
  }
  if (!state.camp.bench && state.resources.wood >= 2 && state.resources.scrap >= 2) {
    spendResource("wood", 2);
    spendResource("scrap", 2);
    state.camp.bench = true;
    state.built.push({ kind: "Crafting Bench", x: 305, y: 950 });
    message = "Crafting bench built. Storm spears are available.";
    return;
  }
  if (!state.camp.med && state.resources.herbs >= 2 && state.resources.scrap >= 1) {
    spendResource("herbs", 2);
    spendResource("scrap", 1);
    state.camp.med = true;
    state.built.push({ kind: "Medical Station", x: 330, y: 1045 });
    message = "Medical station built. Stand in camp to heal.";
    return;
  }
  if (state.camp.wall < 4 && state.resources.wood >= 2 && state.resources.scrap >= 1) {
    spendResource("wood", 2);
    spendResource("scrap", 1);
    state.camp.wall += 1;
    state.built.push({ kind: "Wall", x: 175 + state.camp.wall * 42, y: 1095 });
    message = "Wall section built. Spirits slow near camp.";
    return;
  }
  message = "Camp menu: need wood, scrap, or herbs for the next structure.";
}

function spendResource(type, amount) {
  state.resources[type] = Math.max(0, state.resources[type] - amount);
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    e.spin += dt * 7;
    e.attackCd = Math.max(0, e.attackCd - dt);
    const target = nearestActivePlayer(e.x, e.y);
    if (!target) continue;
    const d = dist(e.x, e.y, target.x, target.y);
    if (d > e.notice) continue;
    const speed = inCamp(e) && state.camp.wall ? e.speed * 0.55 : e.speed;
    if (d > 50) {
      e.x += ((target.x - e.x) / d) * speed * dt;
      e.y += ((target.y - e.y) / d) * speed * dt;
    }
    if (d < e.r + target.r + 5 && e.attackCd <= 0) {
      damagePlayer(target, 10);
      e.attackCd = 1.65;
    }
  }
}

function updateBoss(dt) {
  if (!boss.alive) return;
  const requiredSpirits = state.level === 1 ? 4 : 5;
  if (!state.bossUnlocked && state.spiritsDefeated >= requiredSpirits && totalSpears() >= 2) {
    state.bossUnlocked = true;
    message =
      state.level === 1
        ? "Robot Cat signal found in the northern scrapyard."
        : "Flying Fire Shark is circling over the burned highway.";
  }
  if (!boss.active) return;

  boss.cooldown -= dt;
  const target = nearestActivePlayer(boss.x, boss.y);
  if (!target) return;
  const d = dist(boss.x, boss.y, target.x, target.y);
  if (d > 58) {
    const speed = boss.phase === 2 ? 122 : 92;
    boss.x += ((target.x - boss.x) / d) * speed * dt;
    boss.y += ((target.y - boss.y) / d) * speed * dt;
  }
  if (d < boss.r + target.r + 8) damagePlayer(target, 24 * dt);
  if (boss.cooldown <= 0) {
    boss.cooldown = boss.phase === 2 ? 1.1 : 1.65;
    fireBossVolley(target);
  }
}

function fireBossVolley(target) {
  const shots = boss.kind === "shark" ? (boss.phase === 2 ? 8 : 5) : boss.phase === 2 ? 7 : 4;
  for (let i = 0; i < shots; i += 1) {
    const spread = boss.kind === "shark" ? 0.24 : 0.18;
    const angle = Math.atan2(target.y - boss.y, target.x - boss.x) + (i - (shots - 1) / 2) * spread;
    bullets.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(angle) * (boss.kind === "shark" ? 285 : 245),
      vy: Math.sin(angle) * (boss.kind === "shark" ? 285 : 245),
      r: boss.kind === "shark" ? 8 : 7,
      life: 2.8,
      kind: boss.kind === "shark" ? "ember" : "bolt",
    });
  }
  hazards.push({ x: target.x, y: target.y, r: boss.kind === "shark" ? 28 : 20, life: 2.4, maxLife: 2.4 });
}

function updateBullets(dt) {
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const p of players) {
      if (!p.downed && dist(b.x, b.y, p.x, p.y) < b.r + p.r) {
        damagePlayer(p, 18);
        b.life = 0;
      }
    }
  }
  removeDead(bullets, (b) => b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H);
}

function updateHazards(dt) {
  for (const h of hazards) {
    h.life -= dt;
    h.r += dt * 8;
    for (const p of players) {
      if (!p.downed && dist(h.x, h.y, p.x, p.y) < h.r + p.r) damagePlayer(p, 10 * dt);
    }
  }
  removeDead(hazards, (h) => h.life <= 0);
}

function damagePlayer(p, amount) {
  p.hp -= amount;
  if (p.hp <= 0 && !p.downed) {
    p.hp = 0;
    p.downed = true;
    p.bleed = state.camp.shelter ? 22 : 16;
    message = `${p.role} is down. Revive them before they respawn and lose gear.`;
  }
}

function updateQuests() {
  if (state.level === 1) {
    getQuest("gather").done =
      state.resources.wood + spentOn("wood") >= 5 &&
      state.resources.scrap + spentOn("scrap") >= 4 &&
      state.resources.herbs + spentOn("herbs") >= 2;
  } else {
    getQuest("gather").done =
      state.resources.scrap + spentOn("scrap") >= 4 &&
      state.resources.herbs + spentOn("herbs") >= 2 &&
      state.resources.stormCores >= 2;
  }
  getQuest("build").done = state.camp.shelter && state.camp.bench;
  getQuest("craft").done = totalSpears() >= 2;
  getQuest("spirits").done = state.spiritsDefeated >= (state.level === 1 ? 4 : 5);
  getQuest("boss").done = state.bossDefeated;
}

function spentOn(type) {
  const builtCost = {
    wood: (state.camp.shelter ? 3 : 0) + (state.camp.bench ? 2 : 0) + state.camp.wall * 2,
    scrap: (state.camp.bench ? 2 : 0) + (state.camp.med ? 1 : 0) + state.camp.wall,
    herbs: state.camp.med ? 2 : 0,
  };
  const spearCost = players.reduce((sum, p) => sum + p.spears, 0);
  if (type === "wood") return builtCost.wood + spearCost;
  if (type === "scrap") return builtCost.scrap + spearCost * 2;
  if (type === "herbs") return builtCost.herbs;
  return 0;
}

function getQuest(id) {
  return state.quests.find((q) => q.id === id);
}

function totalSpears() {
  return players.reduce((sum, p) => sum + p.spears, 0);
}

function nearestActivePlayer(x, y) {
  return players
    .filter((p) => !p.downed)
    .sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y))[0];
}

function inCamp(entity) {
  return dist(entity.x, entity.y, state.camp.x, state.camp.y) < state.camp.r;
}

function draw() {
  updateCamera();
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawWorld();
  drawPickups();
  drawCamp();
  drawEnemies();
  drawBoss();
  drawPlayers();
  drawProjectiles();
  ctx.restore();
  drawUI();
  if (gameState === "menu") drawAttractText();
}

function updateCamera() {
  const active = players.filter((p) => !p.downed);
  const focus = active.length ? active : players;
  const centerX = focus.reduce((sum, p) => sum + p.x, 0) / focus.length;
  const centerY = focus.reduce((sum, p) => sum + p.y, 0) / focus.length;
  camera.x += (clamp(centerX - W / 2, 0, WORLD_W - W) - camera.x) * 0.12;
  camera.y += (clamp(centerY - H / 2, 0, WORLD_H - H) - camera.y) * 0.12;
}

function drawWorld() {
  const isBurning = state.level === 2;
  ctx.fillStyle = isBurning ? colors.plains : colors.grass;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  const skyGlow = ctx.createRadialGradient(1700, 220, 20, 1700, 220, 720);
  skyGlow.addColorStop(0, isBurning ? "rgba(221,93,51,.28)" : "rgba(185,220,190,.14)");
  skyGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = skyGlow;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.fillStyle = isBurning ? "#6b5636" : colors.grass2;
  for (let i = 0; i < 210; i += 1) {
    const x = (i * 97) % WORLD_W;
    const y = 55 + ((i * 53) % (WORLD_H - 90));
    ctx.fillRect(x, y, 4 + (i % 5), 3 + (i % 4));
  }
  ctx.fillStyle = isBurning ? "#332f2b" : colors.road;
  polygon([
    [0, 1160],
    [420, 1080],
    [760, 935],
    [1160, 820],
    [1630, 690],
    [2100, 610],
    [2100, 760],
    [1680, 805],
    [1230, 930],
    [790, 1060],
    [380, 1210],
    [0, 1280],
  ]);
  ctx.fillStyle = isBurning ? "#503328" : colors.mud;
  ellipse(1760, 245, 235, 132);
  ctx.fillStyle = isBurning ? "#7c2f25" : colors.water;
  ellipse(1840, 1110, 330, 92);
  if (isBurning) {
    drawFlameField();
  }
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i += 1) {
    line(1570 + i * 30, 135 + (i % 2) * 18, 1660 + i * 22, 330);
  }
  ctx.fillStyle = isBurning ? colors.ash : "#203827";
  for (let i = 0; i < 78; i += 1) {
    drawTree(70 + ((i * 151) % 1960), 65 + ((i * 79) % 1110), 18 + (i % 4) * 4, isBurning);
  }
}

function drawFlameField() {
  for (let i = 0; i < 24; i += 1) {
    const x = 520 + ((i * 173) % 1450);
    const y = 150 + ((i * 97) % 920);
    const flicker = Math.sin(elapsed * 9 + i) * 3;
    ctx.fillStyle = "rgba(197,93,61,.32)";
    circle(x, y, 18 + flicker);
    ctx.fillStyle = "rgba(245,166,95,.72)";
    triangle(x, y - 22 - flicker, x - 9, y + 12, x + 11, y + 10);
    ctx.fillStyle = "rgba(255,221,128,.85)";
    triangle(x + 2, y - 12 - flicker, x - 4, y + 7, x + 7, y + 6);
  }
}

function drawPickups() {
  for (const item of pickups) {
    if (item.taken) continue;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(((item.x + item.y) % 90) / 90);
    if (item.type === "wood") {
      ctx.fillStyle = colors.wood;
      roundRect(-15, -5, 30, 10, 4);
      ctx.fill();
      ctx.fillStyle = "#b78a54";
      ctx.fillRect(-9, -4, 3, 8);
      ctx.fillRect(7, -4, 3, 8);
    } else if (item.type === "scrap") {
      ctx.fillStyle = colors.scrap;
      polygon([
        [-12, -8],
        [10, -12],
        [14, 6],
        [-7, 12],
      ]);
      ctx.fillStyle = "#697274";
      ctx.fillRect(-3, -5, 13, 4);
    } else if (item.type === "herbs") {
      ctx.fillStyle = colors.herb;
      ellipse(-5, 0, 7, 12);
      ellipse(5, 0, 7, 12);
      ctx.fillStyle = "#c5dda6";
      circle(0, -3, 4);
    } else {
      ctx.fillStyle = "#b9b18d";
      roundRect(-14, -10, 28, 20, 5);
      ctx.fill();
      ctx.fillStyle = "#4e4d48";
      circle(-5, 0, 3);
      circle(6, 0, 3);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawCamp() {
  ctx.fillStyle = "rgba(117,91,58,.48)";
  circle(state.camp.x, state.camp.y, state.camp.r);
  ctx.strokeStyle = "rgba(242,239,230,.3)";
  ctx.setLineDash([8, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const b of state.built) {
    ctx.fillStyle = b.kind === "Wall" ? "#7a5a3f" : "#846c4e";
    ctx.fillRect(b.x - 18, b.y - 14, 36, 28);
    ctx.fillStyle = colors.ui;
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(b.kind.split(" ")[0], b.x, b.y + 3);
  }
  ctx.fillStyle = "#dd8f46";
  circle(state.camp.x + 6, state.camp.y + 18, 9 + Math.sin(elapsed * 9) * 2);
}

function drawEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    const ember = e.type === "ember";
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.spin);
    ctx.strokeStyle = ember ? "#ffb36f" : colors.spirit;
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, e.r + i * 5, i * 1.6, i * 1.6 + Math.PI * 1.2);
      ctx.stroke();
    }
    ctx.fillStyle = ember ? "rgba(223,83,52,.58)" : "rgba(185,229,218,.35)";
    triangle(0, -18, -10, 12, 11, 10);
    ctx.fillStyle = ember ? "#ffd38c" : "#e7fff9";
    circle(0, 0, 5);
    ctx.restore();
    bar(e.x - 22, e.y - 30, 44, 5, e.hp / e.maxHp, colors.danger);
  }
}

function drawBoss() {
  if (!boss.alive) {
    ctx.fillStyle = "#2a2d2d";
    ellipse(boss.x, boss.y, 54, 24);
    return;
  }
  ctx.save();
  ctx.translate(boss.x, boss.y);
  if (boss.kind === "shark") {
    drawFireSharkBoss();
    ctx.restore();
    bar(boss.x - 64, boss.y - 62, 128, 8, boss.hp / boss.maxHp, boss.phase === 2 ? "#ff7d54" : "#ffb36f");
    if (!boss.active) label("Flying Fire Shark", boss.x, boss.y - 74);
    return;
  }
  ctx.fillStyle = boss.active ? colors.boss : "#4b5158";
  roundRect(-42, -30, 84, 60, 10);
  ctx.fill();
  ctx.fillStyle = "#30363c";
  circle(-24, 28, 12);
  circle(24, 28, 12);
  ctx.fillStyle = "#d7e7ec";
  circle(-16, -8, 6);
  circle(16, -8, 6);
  ctx.fillStyle = boss.phase === 2 ? "#ff7d54" : "#8bc3df";
  triangle(0, -2, -8, 12, 8, 12);
  ctx.fillStyle = "#68737b";
  triangle(-30, -27, -14, -48, -2, -26);
  triangle(30, -27, 14, -48, 2, -26);
  ctx.restore();
  bar(boss.x - 56, boss.y - 58, 112, 8, boss.hp / boss.maxHp, boss.phase === 2 ? "#ff7d54" : "#84c4d8");
  if (!boss.active) {
    label("Robot Cat", boss.x, boss.y - 70);
  }
}

function drawFireSharkBoss() {
  const flap = Math.sin(elapsed * 8) * 8;
  ctx.rotate(Math.sin(elapsed * 1.6) * 0.08);
  ctx.fillStyle = boss.active ? "#b74835" : "#6e4036";
  ellipse(0, 0, 76, 29);
  ctx.fillStyle = "#ff8b4f";
  triangle(-12, -24, -56, -64 - flap, -4, -12);
  triangle(-12, 24, -56, 64 + flap, -4, 12);
  ctx.fillStyle = "#d45f3e";
  triangle(-58, 0, -98, -27, -91, 26);
  ctx.fillStyle = "#f7c66f";
  triangle(54, -9, 88, -18, 70, 0);
  triangle(54, 9, 88, 18, 70, 0);
  ctx.fillStyle = "#101313";
  circle(43, -9, 5);
  ctx.fillStyle = "#ffe1a1";
  for (let i = 0; i < 4; i += 1) {
    triangle(62 + i * 5, -5, 66 + i * 5, 0, 62 + i * 5, 5);
  }
  ctx.fillStyle = "rgba(245,166,95,.55)";
  circle(-72, 0, 18 + Math.sin(elapsed * 12) * 4);
}

function drawPlayers() {
  for (const p of players) {
    drawSurvivor(p);
    bar(p.x - 20, p.y - 28, 40, 5, p.hp / p.maxHp, p.downed ? "#a19b90" : "#78c284");
    if (p.downed) label(`Down ${Math.ceil(p.bleed)}`, p.x, p.y - 38);
  }
}

function drawSurvivor(p) {
  const angle = Math.atan2(p.facingY, p.facingX);
  const disabled = p.downed;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);

  ctx.strokeStyle = disabled ? "#5f5a54" : "#24231f";
  ctx.lineWidth = 5;
  line(-3, -8, -12, 11);
  line(-3, 8, -12, -11);
  line(6, -7, 20, -12);
  line(6, 7, 20, 12);

  ctx.fillStyle = disabled ? "#77726b" : "#5f4737";
  roundRect(-10, -12, 22, 24, 6);
  ctx.fill();

  ctx.fillStyle = disabled ? "#8b857b" : p.color;
  roundRect(-4, -14, 24, 28, 7);
  ctx.fill();

  ctx.fillStyle = disabled ? "#9a9288" : "#c79a70";
  circle(20, 0, 9);

  ctx.fillStyle = "#1d221f";
  circle(24, -3, 2);
  circle(24, 3, 2);

  ctx.strokeStyle = p.weapon === "storm spear" ? "#b7e6f4" : "#ddd2a0";
  ctx.lineWidth = p.weapon === "storm spear" ? 5 : 4;
  line(18, 0, p.weapon === "storm spear" ? 55 : 39, 0);
  if (p.weapon === "storm spear") {
    ctx.fillStyle = "#d7f5ff";
    triangle(61, 0, 50, -6, 50, 6);
  }
  ctx.restore();
}

function drawProjectiles() {
  for (const b of bullets) {
    ctx.fillStyle = b.kind === "ember" ? "#ff8b4f" : "#f5a65f";
    circle(b.x, b.y, b.r);
    ctx.fillStyle = b.kind === "ember" ? "rgba(255,211,140,.65)" : "rgba(255,255,255,.45)";
    circle(b.x - b.vx * 0.018, b.y - b.vy * 0.018, Math.max(3, b.r - 3));
  }
  for (const h of hazards) {
    ctx.strokeStyle =
      state.level === 2
        ? `rgba(245,166,95,${Math.max(0.15, h.life / h.maxLife)})`
        : `rgba(185,229,218,${Math.max(0.15, h.life / h.maxLife)})`;
    ctx.lineWidth = 3;
    circle(h.x, h.y, h.r);
    ctx.stroke();
  }
}

function drawUI() {
  ctx.fillStyle = "rgba(12,15,13,.78)";
  ctx.fillRect(0, 0, W, 78);
  ctx.fillRect(0, H - 112, W, 112);
  ctx.fillStyle = colors.ui;
  ctx.font = "700 18px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Stormfall: ${state.levelName}`, 18, 28);
  ctx.font = "14px sans-serif";
  ctx.fillText(`Resources  wood ${state.resources.wood}   scrap ${state.resources.scrap}   herbs ${state.resources.herbs}   cores ${state.resources.stormCores}`, 18, 55);
  ctx.fillText(message, 18, H - 82);

  const questX = 790;
  ctx.font = "700 15px sans-serif";
  ctx.fillText("Quests", questX, 26);
  ctx.font = "13px sans-serif";
  state.quests.forEach((q, i) => {
    ctx.fillStyle = q.done ? "#9fd3b2" : "#d8d2c4";
    ctx.fillText(`${q.done ? "✓" : "□"} ${q.text}`, questX, 48 + i * 20);
  });

  players.forEach((p, i) => {
    const x = 18 + i * 315;
    ctx.fillStyle = p.color;
    ctx.font = "700 15px sans-serif";
    ctx.fillText(`P${p.id} ${p.role}`, x, H - 52);
    ctx.fillStyle = colors.ui;
    ctx.font = "13px sans-serif";
    ctx.fillText(`HP ${Math.ceil(p.hp)}  Weapon ${p.weapon}  Spears ${p.spears}  Gear lost ${p.gearLost}`, x, H - 29);
  });

  if (state.bossDefeated) {
    ctx.textAlign = "center";
    ctx.font = "700 25px sans-serif";
    ctx.fillStyle = "#9fd3b2";
    ctx.fillText(
      state.level === 1
        ? "Level Complete: return to camp and press interact to enter Burning Plains"
        : "Level Complete: Flooded Ruins unlocked for the next prototype build",
      W / 2,
      H - 72,
    );
  }
}

function drawAttractText() {
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(0, 0, W, H);
}

function drawTree(x, y, r, burned = false) {
  if (burned) {
    ctx.strokeStyle = "#1f1f1c";
    ctx.lineWidth = 5;
    line(x, y + r, x, y - r * 0.9);
    ctx.lineWidth = 3;
    line(x, y - r * 0.2, x - r * 0.75, y - r * 0.55);
    line(x, y - r * 0.05, x + r * 0.65, y - r * 0.45);
    return;
  }
  ctx.fillStyle = "#1c2b21";
  circle(x, y, r);
  ctx.fillStyle = "#243c2c";
  circle(x - r * 0.28, y - r * 0.24, r * 0.7);
  ctx.fillStyle = "#594332";
  ctx.fillRect(x - 3, y + r * 0.45, 6, r * 0.8);
}

function circle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function triangle(x1, y1, x2, y2, x3, y3) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function polygon(points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function bar(x, y, w, h, ratio, color) {
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(ratio, 0, 1), h);
}

function label(text, x, y) {
  ctx.textAlign = "center";
  ctx.font = "700 12px sans-serif";
  ctx.fillStyle = colors.ui;
  ctx.fillText(text, x, y);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function removeDead(array, predicate) {
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (predicate(array[i])) array.splice(i, 1);
  }
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  if (gameState === "play") update(dt);
  draw();
  pressed.clear();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (gameCodes.has(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);
  if (!event.repeat) {
    pressed.add(event.code);
  }
});

window.addEventListener("keyup", (event) => {
  if (gameCodes.has(event.code)) {
    event.preventDefault();
  }
  keys.delete(event.code);
});
document.querySelectorAll("#touchControls button[data-code]").forEach((button) => {
  const code = button.dataset.code;
  const press = (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    keys.add(code);
    pressed.add(code);
  };
  const release = (event) => {
    event.preventDefault();
    keys.delete(code);
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});
startButton.addEventListener("click", startGame);
helpButton.addEventListener("click", () => help.classList.toggle("visible"));
requestAnimationFrame(loop);
