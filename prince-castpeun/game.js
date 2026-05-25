const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const heroName = document.getElementById("hero-name");
const heroKit = document.getElementById("hero-kit");
const healthFill = document.getElementById("health-fill");
const partyEl = document.getElementById("party");
const relicsEl = document.getElementById("relics");
const levelNameEl = document.getElementById("level-name");
const objectiveEl = document.getElementById("objective");
const completeBanner = document.getElementById("complete-banner");
const completeText = document.getElementById("complete-text");
const speakerEl = document.getElementById("speaker");
const dialogueText = document.getElementById("dialogue-text");

const keys = new Set();
const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, down: false, moved: false };
const world = { width: 2200, height: 1700 };
const localPlayerId = "local-lucy";

const heroes = [
  {
    id: "castpeun",
    name: "Prince Castpeun",
    short: "Castpeun",
    kit: "Mighty sword",
    color: "#e0b54a",
    trim: "#78412d",
    weapon: "sword",
    range: 90,
    maxHealth: 125,
    x: 1020,
    y: 930
  },
  {
    id: "peter",
    name: "Peter",
    short: "Peter",
    kit: "High King sword",
    color: "#b83b39",
    trim: "#d7c18a",
    weapon: "sword",
    range: 82,
    maxHealth: 115,
    x: 960,
    y: 980
  },
  {
    id: "edmund",
    name: "Edmund",
    short: "Edmund",
    kit: "Quick sword",
    color: "#3c5688",
    trim: "#a8b6d4",
    weapon: "sword",
    range: 76,
    maxHealth: 105,
    x: 1080,
    y: 980
  },
  {
    id: "susan",
    name: "Susan",
    short: "Susan",
    kit: "Bow and special arrows",
    color: "#7c3f75",
    trim: "#f0dca0",
    weapon: "bow",
    range: 480,
    maxHealth: 95,
    x: 1140,
    y: 1030
  },
  {
    id: "lucy",
    name: "Lucy",
    short: "Lucy",
    kit: "Dagger + healing potion",
    color: "#58a667",
    trim: "#f6e4a5",
    weapon: "dagger",
    range: 60,
    maxHealth: 100,
    x: 900,
    y: 1030
  }
].map((hero) => ({
  ...hero,
  health: hero.maxHealth,
  vx: 0,
  vy: 0,
  angle: -Math.PI / 2,
  cooldown: 0,
  healCooldown: 0,
  attackFlash: 0
}));

let activeHeroIndex = 4;
let collectedRelics = 0;
let lastTime = performance.now();
let dialogueTimer = 7;
let camera = { x: 0, y: 0, zoom: 1 };
let storyBeatIndex = 0;
let levelComplete = false;
let nextLevelTimer = 0;
let levelRelicsNeeded = 0;
let levelRelicsFound = 0;
let levelHealsUsed = 0;
let coronationMode = false;
const projectiles = [];
const hitBursts = [];

const storyBeats = [
  {
    level: "Level 1: England - The Horn Call",
    scene: "england",
    startHero: "lucy",
    objective: "As Lucy, reach the wardrobe and listen for the horn.",
    speaker: "Lucy",
    text: "The horn is calling from spring Narnia. We have to go back through the wardrobe.",
    relicGoal: 0,
    placements: [[990, 1280], [940, 1370], [1040, 1370], [890, 1440], [760, 1450]],
    props: [
      { type: "wardrobe", x: 980, y: 1340, w: 90, h: 120 },
      { type: "lamp", x: 740, y: 1180, w: 40, h: 120 }
    ],
    relics: [],
    enemies: []
  },
  {
    level: "Level 2: The Woods Attack",
    scene: "woods",
    startHero: "castpeun",
    objective: "Defeat the dwarf attackers and learn sword combat.",
    speaker: "Prince Castpeun",
    text: "I blew the horn at Cair Paravel. Now the woods are full of danger.",
    relicGoal: 1,
    placements: [[1060, 860], [970, 940], [1040, 1000], [1130, 960], [900, 1000]],
    props: [
      { type: "horn", x: 1130, y: 820, w: 50, h: 50 },
      { type: "log", x: 620, y: 1040, w: 220, h: 38 },
      { type: "log", x: 1320, y: 720, w: 260, h: 38 }
    ],
    relics: [
      { name: "Castpeun royal item", x: 1150, y: 860, color: "#f0b84f", taken: false }
    ],
    enemies: [
      ["Dwarf Scout", 640, 700, 70, "#7c5a42"],
      ["Giant Dwarf Warrior", 820, 1220, 135, "#6b4935"]
    ]
  },
  {
    level: "Level 3: Ruins of Cair Paravel",
    scene: "ruins",
    startHero: "castpeun",
    objective: "Explore the ruins, find relics, and unlock hero switching.",
    speaker: "Peter",
    text: "Cair Paravel is broken, but its old courage is still here. Search the ruins.",
    relicGoal: 2,
    placements: [[620, 560], [520, 640], [710, 650], [600, 760], [800, 720]],
    props: [
      { type: "ruin", x: 420, y: 520, w: 270, h: 75 },
      { type: "ruin", x: 900, y: 470, w: 340, h: 85 },
      { type: "ruin", x: 1350, y: 620, w: 290, h: 78 }
    ],
    relics: [
      { name: "Ancient Narnian relic", x: 430, y: 410, color: "#f3d673", taken: false },
      { name: "Peter armor piece", x: 1210, y: 570, color: "#e8e8e8", taken: false }
    ],
    enemies: []
  },
  {
    level: "Level 4: Hidden Narnians",
    scene: "allies",
    startHero: "susan",
    objective: "Find hidden allies and defeat the Telmarine captain.",
    speaker: "Susan",
    text: "Listen. Talking animals and centaurs are hiding nearby. We can bring them together.",
    relicGoal: 2,
    placements: [[1030, 900], [950, 990], [1100, 1000], [1160, 910], [880, 920]],
    props: [
      { type: "ally", x: 540, y: 560, w: 70, h: 70 },
      { type: "ally", x: 1540, y: 600, w: 80, h: 80 },
      { type: "ally", x: 760, y: 1240, w: 80, h: 80 }
    ],
    relics: [
      { name: "Talking animal ally token", x: 540, y: 560, color: "#c7f07f", taken: false },
      { name: "Centaur ally token", x: 1540, y: 600, color: "#f0c07f", taken: false }
    ],
    enemies: [
      ["Telmarine Captain", 1380, 900, 145, "#495665"],
      ["Telmarine Soldier", 1160, 620, 85, "#54616f"]
    ]
  },
  {
    level: "Level 5: Night Raid",
    scene: "camp",
    startHero: "edmund",
    objective: "Sneak through Miraz's camp and defeat the general.",
    speaker: "Edmund",
    text: "Quiet feet first, quick sword second. We can get through the camp together.",
    relicGoal: 1,
    placements: [[460, 1220], [370, 1310], [520, 1340], [650, 1260], [740, 1340]],
    props: [
      { type: "camp", x: 1180, y: 620, w: 320, h: 210 },
      { type: "camp", x: 1540, y: 1040, w: 300, h: 200 },
      { type: "torch", x: 920, y: 900, w: 34, h: 100 }
    ],
    relics: [
      { name: "Edmund sword relic", x: 1610, y: 1390, color: "#9cc7ff", taken: false }
    ],
    enemies: [
      ["Miraz's General", 1510, 990, 175, "#5f4350"],
      ["Camp Guard", 1260, 760, 90, "#5a6670"],
      ["Camp Guard", 1660, 1160, 90, "#5a6670"]
    ]
  },
  {
    level: "Level 6: Aslan's Forest",
    scene: "aslan",
    startHero: "lucy",
    objective: "Use Lucy's healing potion and gather forest bottles.",
    speaker: "Lucy",
    text: "The forest is awake. Stay close and let the healing cordial do its work.",
    relicGoal: 2,
    healGoal: 1,
    placements: [[1030, 780], [930, 880], [1080, 900], [1180, 820], [850, 790]],
    props: [
      { type: "glade", x: 960, y: 720, w: 300, h: 180 },
      { type: "river", x: 300, y: 1030, w: 1600, h: 130 }
    ],
    relics: [
      { name: "Lucy healing bottle", x: 910, y: 510, color: "#7ff5c9", taken: false },
      { name: "Forest healing bottle", x: 1370, y: 860, color: "#a2ffd7", taken: false }
    ],
    enemies: [
      ["Black Wolf", 1510, 1160, 120, "#25282d"],
      ["River God", 530, 1060, 160, "#2f8fb3"]
    ]
  },
  {
    level: "Level 7: The Great Battle",
    scene: "battle",
    startHero: "peter",
    objective: "Switch between heroes and win the battlefield.",
    speaker: "Peter",
    text: "For Narnia. Everyone has a part to play in this battle.",
    relicGoal: 2,
    placements: [[880, 980], [760, 1080], [980, 1100], [1110, 1000], [670, 940]],
    props: [
      { type: "banner", x: 620, y: 720, w: 60, h: 150 },
      { type: "banner", x: 1520, y: 700, w: 60, h: 150 },
      { type: "barricade", x: 1020, y: 840, w: 320, h: 70 }
    ],
    relics: [
      { name: "Susan special arrows", x: 1760, y: 520, color: "#b897ff", taken: false },
      { name: "Battlefield royal crest", x: 370, y: 1340, color: "#f0b84f", taken: false }
    ],
    enemies: [
      ["Telmarine Captain", 1380, 840, 150, "#495665"],
      ["Miraz's General", 1580, 1040, 185, "#5f4350"],
      ["Telmarine Soldier", 1210, 1180, 95, "#54616f"],
      ["Telmarine Soldier", 1710, 720, 95, "#54616f"]
    ]
  },
  {
    level: "Level 8: Final Boss - Peter vs Miraz",
    scene: "duel",
    startHero: "peter",
    objective: "Defeat Miraz in a one-on-one sword duel.",
    speaker: "Miraz",
    text: "So, High King, let us finish this with swords.",
    relicGoal: 0,
    forceHero: "peter",
    placements: [[1060, 860], [990, 920], [1130, 930], [930, 1010], [1200, 1010]],
    props: [
      { type: "duel", x: 760, y: 520, w: 680, h: 520 },
      { type: "banner", x: 680, y: 620, w: 60, h: 150 },
      { type: "banner", x: 1480, y: 620, w: 60, h: 150 }
    ],
    relics: [],
    enemies: [
      ["Miraz", 1220, 840, 240, "#49333f"]
    ]
  }
];

// Multiplayer-ready model: local inputs mutate a player snapshot that can later be
// synchronized through WebSocket/WebRTC without changing rendering or combat code.
const session = {
  roomCode: "SPRING-NARNIA-TEST",
  players: new Map([[localPlayerId, { heroId: "lucy", ready: true, input: {} }]]),
  remoteSnapshots: new Map()
};

const enemies = [
  makeEnemy("Dwarf Scout", 640, 700, 70, "#7c5a42", false),
  makeEnemy("Telmarine Guard", 1340, 680, 90, "#44505e", false),
  makeEnemy("Black Wolf", 1510, 1160, 80, "#25282d", false),
  makeEnemy("Dwarf Warrior", 820, 1220, 120, "#6b4935", false)
];

const relics = [
  { name: "Ancient Narnian relic", x: 430, y: 410, color: "#f3d673", taken: false },
  { name: "Lucy healing bottle", x: 910, y: 510, color: "#7ff5c9", taken: false },
  { name: "Susan special arrows", x: 1760, y: 520, color: "#b897ff", taken: false },
  { name: "Peter armor piece", x: 370, y: 1340, color: "#e8e8e8", taken: false },
  { name: "Edmund sword relic", x: 1610, y: 1390, color: "#9cc7ff", taken: false },
  { name: "Castpeun royal item", x: 1150, y: 860, color: "#f0b84f", taken: false }
];

const props = [
  { type: "wardrobe", x: 980, y: 1340, w: 90, h: 120 },
  { type: "horn", x: 1130, y: 820, w: 50, h: 50 },
  { type: "ruin", x: 520, y: 560, w: 230, h: 70 },
  { type: "ruin", x: 1210, y: 430, w: 280, h: 80 },
  { type: "camp", x: 1550, y: 820, w: 260, h: 180 }
];

const trees = Array.from({ length: 56 }, (_, i) => {
  const ring = i % 4;
  return {
    x: 120 + ((i * 181) % (world.width - 240)),
    y: 110 + ((i * 257) % (world.height - 220)),
    r: 22 + ring * 5,
    trunk: 15 + ring * 3
  };
});

function makeEnemy(name, x, y, health, color, active = true) {
  return {
    name,
    x,
    y,
    vx: 0,
    vy: 0,
    color,
    health,
    maxHealth: health,
    attackCooldown: 0,
    hurt: 0,
    active,
    alive: true
  };
}

function resize() {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!mouse.moved) {
    mouse.x = window.innerWidth / 2;
    mouse.y = window.innerHeight / 2;
  }
}

function activeHero() {
  return heroes[activeHeroIndex];
}

function setHero(index) {
  if (index < 0 || index >= heroes.length) return;
  const level = storyBeats[storyBeatIndex];
  if (level?.forceHero && heroes[index].id !== level.forceHero) {
    const forced = heroes.find((candidate) => candidate.id === level.forceHero);
    showDialogue(forced?.name || "Story", `This moment needs ${forced?.name || "the chosen hero"}.`);
    return;
  }
  activeHeroIndex = index;
  const hero = activeHero();
  session.players.get(localPlayerId).heroId = hero.id;
  showDialogue(hero.name, `${hero.name} is ready. ${hero.kit}.`);
  if (storyBeatIndex === 1 && hero.id === "castpeun") {
    showDialogue("Prince Castpeun", "Sword ready. Keep the scout in front of you and strike when close.");
  }
}

function showDialogue(speaker, text) {
  speakerEl.textContent = speaker;
  dialogueText.textContent = text;
  dialogueTimer = 6;
}

function update(dt) {
  const hero = activeHero();
  const speed = keys.has("shift") ? 270 : 205;
  let mx = 0;
  let my = 0;
  if (keys.has("w") || keys.has("arrowup")) my -= 1;
  if (keys.has("s") || keys.has("arrowdown")) my += 1;
  if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
  if (keys.has("d") || keys.has("arrowright")) mx += 1;
  const len = Math.hypot(mx, my) || 1;
  hero.vx = (mx / len) * speed;
  hero.vy = (my / len) * speed;
  hero.x = clamp(hero.x + hero.vx * dt, 70, world.width - 70);
  hero.y = clamp(hero.y + hero.vy * dt, 70, world.height - 70);

  const aim = screenToWorld(mouse.x, mouse.y);
  hero.angle = Math.atan2(aim.y - hero.y, aim.x - hero.x);
  if (hero.cooldown > 0) hero.cooldown -= dt;
  if (hero.healCooldown > 0) hero.healCooldown -= dt;
  if (hero.attackFlash > 0) hero.attackFlash -= dt;
  if (dialogueTimer > 0) dialogueTimer -= dt;

  if (mouse.down) attack(hero);
  if (keys.has(" ") || keys.has("enter")) attack(hero);
  if (keys.has("q")) heal(hero);

  updateFollowers(dt, hero);
  updateEnemies(dt, hero);
  updateProjectiles(dt);
  collectRelics(hero);
  updateStory(dt, hero);
  updateCamera(hero);
  updateHud();
}

function updateFollowers(dt, leader) {
  heroes.forEach((hero, index) => {
    if (index === activeHeroIndex) return;
    const partyOrder = heroes
      .map((member, memberIndex) => ({ member, memberIndex }))
      .filter((entry) => entry.memberIndex !== activeHeroIndex);
    const followerSlot = partyOrder.findIndex((entry) => entry.memberIndex === index);
    const formation = [
      { back: 170, side: -115 },
      { back: 170, side: 115 },
      { back: 285, side: -170 },
      { back: 285, side: 170 }
    ][followerSlot] || { back: 350, side: 0 };
    const backX = Math.cos(leader.angle) * formation.back;
    const backY = Math.sin(leader.angle) * formation.back;
    const sideX = Math.cos(leader.angle + Math.PI / 2) * formation.side;
    const sideY = Math.sin(leader.angle + Math.PI / 2) * formation.side;
    const goalX = leader.x - backX + sideX;
    const goalY = leader.y - backY + sideY;
    const dx = goalX - hero.x;
    const dy = goalY - hero.y;
    const dist = Math.hypot(dx, dy) || 1;
    const followSpeed = Math.min(230, dist * 3.2);
    hero.x += (dx / dist) * followSpeed * dt;
    hero.y += (dy / dist) * followSpeed * dt;
    hero.angle = Math.atan2(leader.y - hero.y, leader.x - hero.x);
    if (hero.cooldown > 0) hero.cooldown -= dt;
    if (hero.attackFlash > 0) hero.attackFlash -= dt;
  });
}

function updateEnemies(dt, hero) {
  for (const enemy of enemies) {
    if (!enemy.active || !enemy.alive) continue;
    const dx = hero.x - enemy.x;
    const dy = hero.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 560) {
      enemy.vx = (dx / dist) * 92;
      enemy.vy = (dy / dist) * 92;
    } else {
      enemy.vx = Math.sin(performance.now() / 900 + enemy.x) * 18;
      enemy.vy = Math.cos(performance.now() / 1100 + enemy.y) * 18;
    }
    enemy.x = clamp(enemy.x + enemy.vx * dt, 60, world.width - 60);
    enemy.y = clamp(enemy.y + enemy.vy * dt, 60, world.height - 60);
    if (enemy.attackCooldown > 0) enemy.attackCooldown -= dt;
    if (enemy.hurt > 0) enemy.hurt -= dt;
    if (dist < 54 && enemy.attackCooldown <= 0) {
      hero.health = Math.max(0, hero.health - 9);
      enemy.attackCooldown = 1.1;
      hitBursts.push({ x: hero.x, y: hero.y, life: 0.35, color: "#ff786b" });
      if (hero.health <= 0) showDialogue("Aslan's Forest", `${hero.name} needs healing. Switch heroes or use Lucy's potion.`);
    }
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    for (const enemy of enemies) {
      if (!enemy.active || !enemy.alive) continue;
      if (Math.hypot(enemy.x - p.x, enemy.y - p.y) < 36) {
        damageEnemy(enemy, p.damage);
        p.life = 0;
      }
    }
    if (p.life <= 0) projectiles.splice(i, 1);
  }
  for (let i = hitBursts.length - 1; i >= 0; i--) {
    hitBursts[i].life -= dt;
    if (hitBursts[i].life <= 0) hitBursts.splice(i, 1);
  }
}

function collectRelics(hero) {
  for (const relic of relics) {
    if (!relic.taken && Math.hypot(hero.x - relic.x, hero.y - relic.y) < 54) {
      relic.taken = true;
      collectedRelics += 1;
      levelRelicsFound += 1;
      showDialogue("Narnian Relic", `Found: ${relic.name}. The ruins remember the old Kings and Queens.`);
    }
  }
}

function attack(hero) {
  if (hero.cooldown > 0 || hero.health <= 0) return;
  hero.attackFlash = 0.18;
  if (hero.weapon === "bow") {
    hero.cooldown = 0.48;
    projectiles.push({
      x: hero.x + Math.cos(hero.angle) * 42,
      y: hero.y + Math.sin(hero.angle) * 42,
      vx: Math.cos(hero.angle) * 620,
      vy: Math.sin(hero.angle) * 620,
      damage: 26,
      life: 0.85
    });
    return;
  }

  hero.cooldown = hero.weapon === "dagger" ? 0.36 : 0.44;
  const damage = hero.weapon === "dagger" ? 18 : hero.id === "castpeun" ? 34 : 27;
  for (const enemy of enemies) {
    if (!enemy.active || !enemy.alive) continue;
    const dist = Math.hypot(enemy.x - hero.x, enemy.y - hero.y);
    const angleToEnemy = Math.atan2(enemy.y - hero.y, enemy.x - hero.x);
    const arc = Math.abs(angleDelta(hero.angle, angleToEnemy));
    if (dist < hero.range + 30 && arc < 0.9) damageEnemy(enemy, damage);
  }
}

function heal(hero) {
  if (hero.id !== "lucy" || hero.healCooldown > 0) return;
  hero.healCooldown = 4.5;
  levelHealsUsed += 1;
  for (const member of heroes) {
    if (Math.hypot(member.x - hero.x, member.y - hero.y) < 230) {
      member.health = Math.min(member.maxHealth, member.health + 30);
      hitBursts.push({ x: member.x, y: member.y, life: 0.55, color: "#9df5b8" });
    }
  }
  showDialogue("Lucy", "The healing cordial sparkles. Everyone nearby feels braver.");
}

function damageEnemy(enemy, amount) {
  enemy.health = Math.max(0, enemy.health - amount);
  enemy.hurt = 0.22;
  hitBursts.push({ x: enemy.x, y: enemy.y, life: 0.3, color: "#ffe176" });
  if (enemy.health <= 0) {
    enemy.alive = false;
    showDialogue("Test Map", `${enemy.name} is defeated. The way through spring Narnia is safer.`);
  }
}

function updateStory(dt, hero) {
  if (levelComplete) {
    nextLevelTimer -= dt;
    if (nextLevelTimer <= 0 && storyBeatIndex < storyBeats.length - 1) startLevel(storyBeatIndex + 1);
    return;
  }

  const level = storyBeats[storyBeatIndex];
  if (level.forceHero && hero.id !== level.forceHero) {
    setHero(heroes.findIndex((candidate) => candidate.id === level.forceHero));
    return;
  }

  if (storyBeatIndex === 0) {
    const wardrobe = props.find((prop) => prop.type === "wardrobe");
    if (nearRect(hero, wardrobe, 100)) completeLevel();
    return;
  }

  if (level.healGoal && levelHealsUsed < level.healGoal) return;
  if (levelRelicsFound < levelRelicsNeeded) return;
  if (!activeEnemiesDefeated()) return;
  completeLevel();
}

function startLevel(index) {
  storyBeatIndex = Math.min(index, storyBeats.length - 1);
  const level = storyBeats[storyBeatIndex];
  levelComplete = false;
  coronationMode = false;
  nextLevelTimer = 0;
  levelRelicsNeeded = level.relicGoal || 0;
  levelRelicsFound = 0;
  levelHealsUsed = 0;
  projectiles.length = 0;
  hitBursts.length = 0;

  props.length = 0;
  props.push(...level.props.map((prop) => ({ ...prop })));
  relics.length = 0;
  relics.push(...level.relics.map((relic) => ({ ...relic })));
  enemies.length = 0;
  enemies.push(...level.enemies.map((enemy) => makeEnemy(enemy[0], enemy[1], enemy[2], enemy[3], enemy[4], true)));

  heroes.forEach((hero, heroIndex) => {
    const spot = level.placements[heroIndex] || level.placements[0];
    hero.x = spot[0];
    hero.y = spot[1];
    hero.health = Math.min(hero.maxHealth, Math.max(hero.health, Math.round(hero.maxHealth * 0.72)));
    hero.cooldown = 0;
    hero.healCooldown = 0;
    hero.attackFlash = 0;
  });

  const startHeroIndex = heroes.findIndex((hero) => hero.id === level.startHero);
  if (startHeroIndex >= 0) activeHeroIndex = startHeroIndex;
  session.players.get(localPlayerId).heroId = activeHero().id;
  showDialogue(level.speaker, level.text);
  updateCamera(activeHero());
}

function completeLevel() {
  const lastLevel = storyBeatIndex === storyBeats.length - 1;
  levelComplete = true;
  nextLevelTimer = lastLevel ? 999999 : 3.2;
  const level = storyBeats[storyBeatIndex];
  if (lastLevel) {
    beginCoronation();
    return;
  }
  showDialogue(level.speaker, `${level.level} complete. Next adventure starts soon.`);
}

function beginCoronation() {
  coronationMode = true;
  projectiles.length = 0;
  enemies.length = 0;
  props.length = 0;
  props.push(
    { type: "throne", x: 1000, y: 520, w: 220, h: 230 },
    { type: "banner", x: 720, y: 520, w: 60, h: 150 },
    { type: "banner", x: 1450, y: 520, w: 60, h: 150 },
    { type: "flower", x: 820, y: 890, w: 50, h: 50 },
    { type: "flower", x: 1390, y: 890, w: 50, h: 50 }
  );

  const finaleSpots = {
    castpeun: [1110, 710],
    peter: [920, 820],
    edmund: [1010, 910],
    susan: [1260, 830],
    lucy: [1180, 930]
  };
  heroes.forEach((hero) => {
    const spot = finaleSpots[hero.id];
    hero.x = spot[0];
    hero.y = spot[1];
    hero.health = hero.maxHealth;
    hero.angle = -Math.PI / 2;
    hero.attackFlash = 0;
  });
  setHero(0);
  showDialogue("Narnia Restored", "Prince Castpeun is crowned king. The old Kings and Queens stand with him, and all Narnia celebrates.");
}

function advanceStory(nextIndex) {
  startLevel(nextIndex);
}

function activateEnemies(names) {
  enemies.forEach((enemy) => {
    if (names.includes(enemy.name)) {
      enemy.active = true;
      enemy.alive = true;
      enemy.health = enemy.maxHealth;
    }
  });
}

function enemiesNamedDefeated(names) {
  return names.every((name) => {
    const enemy = enemies.find((candidate) => candidate.name === name);
    return enemy && (!enemy.active || !enemy.alive);
  });
}

function activeEnemiesDefeated() {
  return enemies.every((enemy) => !enemy.active || !enemy.alive);
}

function nearRect(hero, rect, padding) {
  const cx = clamp(hero.x, rect.x - padding, rect.x + rect.w + padding);
  const cy = clamp(hero.y, rect.y - padding, rect.y + rect.h + padding);
  return Math.hypot(hero.x - cx, hero.y - cy) < padding;
}

function updateCamera(hero) {
  const targetX = hero.x - Math.cos(hero.angle) * 185;
  const targetY = hero.y - Math.sin(hero.angle) * 185;
  camera.x += (targetX - camera.x) * 0.08;
  camera.y += (targetY - camera.y) * 0.08;
  camera.zoom = Math.min(window.innerWidth / 980, window.innerHeight / 620);
  camera.zoom = clamp(camera.zoom, 0.8, 1.25);
}

function draw() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  drawSky(w, h);
  withWorld(() => {
    drawGround();
    props.forEach(drawProp);
    trees.forEach((tree, index) => {
      const scene = storyBeats[storyBeatIndex].scene;
      if (scene === "england" && index % 5 !== 0) return;
      if ((scene === "camp" || scene === "battle" || scene === "duel") && index % 4 !== 0) return;
      drawTree(tree);
    });
    relics.forEach(drawRelic);
    drawObjectiveMarker();
    enemies.forEach(drawEnemy);
    heroes.forEach((hero, index) => drawHero(hero, index === activeHeroIndex));
    projectiles.forEach(drawProjectile);
    hitBursts.forEach(drawBurst);
    if (coronationMode) drawCoronationEffects();
  });
  drawVignette(w, h);
}

function drawSky(w, h) {
  const scene = storyBeats[storyBeatIndex].scene;
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  if (coronationMode) {
    gradient.addColorStop(0, "#95d8f0");
    gradient.addColorStop(0.45, "#ffe69a");
    gradient.addColorStop(1, "#7fc875");
  } else if (scene === "camp" || scene === "duel") {
    gradient.addColorStop(0, "#1f2740");
    gradient.addColorStop(0.48, "#3e4357");
    gradient.addColorStop(1, "#3f4f40");
  } else if (scene === "england") {
    gradient.addColorStop(0, "#9fc4e6");
    gradient.addColorStop(0.48, "#d8e3d7");
    gradient.addColorStop(1, "#8f9b7a");
  } else if (scene === "aslan") {
    gradient.addColorStop(0, "#99dcf1");
    gradient.addColorStop(0.45, "#ffe6a8");
    gradient.addColorStop(1, "#7ec474");
  } else {
    gradient.addColorStop(0, "#8fd6f0");
    gradient.addColorStop(0.44, "#bfe8b5");
    gradient.addColorStop(1, "#6a9b5a");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function withWorld(drawFn) {
  ctx.save();
  ctx.translate(window.innerWidth / 2, window.innerHeight / 2 + 58);
  ctx.scale(camera.zoom, camera.zoom * 0.78);
  ctx.translate(-camera.x, -camera.y);
  drawFn();
  ctx.restore();
}

function drawGround() {
  const scene = coronationMode ? "coronation" : storyBeats[storyBeatIndex].scene;
  const groundColor = {
    england: "#839169",
    woods: "#77ad63",
    ruins: "#8fa276",
    allies: "#6fb06a",
    camp: "#555348",
    aslan: "#7fc875",
    battle: "#77795f",
    duel: "#897b67",
    coronation: "#78bd71"
  }[scene] || "#77ad63";
  ctx.fillStyle = groundColor;
  ctx.fillRect(0, 0, world.width, world.height);
  ctx.strokeStyle = scene === "camp" || scene === "duel" ? "rgba(255,224,150,0.10)" : "rgba(255,255,255,0.12)";
  ctx.lineWidth = 4;
  for (let x = 80; x < world.width; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 120, world.height);
    ctx.stroke();
  }
  if (scene === "england") {
    ctx.fillStyle = "#b9b39a";
    roundedRect(620, 1110, 680, 150, 20, true);
    ctx.fillStyle = "#6f6a58";
    roundedRect(700, 1010, 500, 105, 12, true);
  } else if (scene === "camp") {
    ctx.fillStyle = "#8b7658";
    roundedRect(260, 1210, 1570, 115, 22, true);
    roundedRect(900, 700, 670, 95, 18, true);
  } else if (scene === "aslan") {
    ctx.fillStyle = "#a8d989";
    roundedRect(820, 610, 560, 330, 90, true);
    ctx.fillStyle = "#78cfe6";
    roundedRect(260, 1030, 1660, 130, 40, true);
  } else if (scene === "coronation") {
    ctx.fillStyle = "#d9c287";
    roundedRect(620, 590, 940, 520, 48, true);
    ctx.fillStyle = "#e7dba5";
    roundedRect(820, 730, 560, 310, 36, true);
  } else if (scene === "battle" || scene === "duel") {
    ctx.fillStyle = "#c3ad7a";
    roundedRect(260, 710, 1660, 380, 36, true);
    ctx.fillStyle = "rgba(120,74,56,0.35)";
    roundedRect(480, 1140, 1200, 90, 24, true);
  } else {
    ctx.fillStyle = "#d8c287";
    roundedRect(170, 780, 1820, 110, 28, true);
    roundedRect(650, 1120, 940, 95, 26, true);
    ctx.fillStyle = "#86c9e7";
    roundedRect(50, 170, 410, 120, 36, true);
  }
}

function drawTree(tree) {
  ctx.fillStyle = "#6d4d30";
  roundedRect(tree.x - tree.trunk / 2, tree.y, tree.trunk, tree.trunk * 2.2, 4, true);
  ctx.fillStyle = "#2f7d43";
  blockDiamond(tree.x, tree.y - tree.r * 0.3, tree.r * 1.45);
  ctx.fillStyle = "#48a858";
  blockDiamond(tree.x - 8, tree.y - tree.r * 0.8, tree.r * 1.15);
}

function drawProp(prop) {
  if (prop.type === "wardrobe") {
    ctx.fillStyle = "#7b4a2e";
    roundedRect(prop.x, prop.y, prop.w, prop.h, 6, true);
    ctx.fillStyle = "#4b2a1d";
    roundedRect(prop.x + 14, prop.y + 12, 24, prop.h - 24, 4, true);
    roundedRect(prop.x + 52, prop.y + 12, 24, prop.h - 24, 4, true);
    ctx.fillStyle = "#f2c468";
    ctx.fillRect(prop.x + 42, prop.y + 64, 7, 7);
  } else if (prop.type === "horn") {
    ctx.fillStyle = "#f1dc8e";
    ctx.beginPath();
    ctx.ellipse(prop.x + 20, prop.y + 25, 36, 15, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b88935";
    ctx.fillRect(prop.x + 2, prop.y + 19, 16, 12);
  } else if (prop.type === "camp") {
    ctx.fillStyle = "#584235";
    roundedRect(prop.x, prop.y, prop.w, prop.h, 10, true);
    ctx.fillStyle = "#b34837";
    triangle(prop.x + 42, prop.y + 118, prop.x + 92, prop.y + 28, prop.x + 142, prop.y + 118);
    ctx.fillStyle = "#d9c38b";
    triangle(prop.x + 132, prop.y + 126, prop.x + 190, prop.y + 36, prop.x + 238, prop.y + 126);
  } else if (prop.type === "lamp" || prop.type === "torch") {
    ctx.fillStyle = "#3a2c26";
    roundedRect(prop.x + prop.w / 2 - 7, prop.y, 14, prop.h, 4, true);
    ctx.fillStyle = prop.type === "lamp" ? "#f3db83" : "#ffb447";
    ctx.beginPath();
    ctx.arc(prop.x + prop.w / 2, prop.y, 26, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.type === "log") {
    ctx.fillStyle = "#6c4930";
    roundedRect(prop.x, prop.y, prop.w, prop.h, 18, true);
    ctx.fillStyle = "#8c6543";
    ctx.beginPath();
    ctx.arc(prop.x + 18, prop.y + prop.h / 2, 17, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.type === "ally") {
    ctx.fillStyle = "#ead8a8";
    roundedRect(prop.x - 18, prop.y + 10, prop.w, prop.h - 10, 10, true);
    ctx.fillStyle = "#8a5f3d";
    roundedRect(prop.x, prop.y - 24, prop.w * 0.6, 42, 10, true);
    ctx.fillStyle = "#2f6f4d";
    blockDiamond(prop.x + prop.w + 10, prop.y + 4, 24);
  } else if (prop.type === "glade") {
    ctx.fillStyle = "rgba(255, 230, 160, 0.38)";
    roundedRect(prop.x, prop.y, prop.w, prop.h, 60, true);
    ctx.fillStyle = "#f6e69b";
    blockDiamond(prop.x + prop.w / 2, prop.y + prop.h / 2, 34);
  } else if (prop.type === "river") {
    ctx.fillStyle = "#6bc6e1";
    roundedRect(prop.x, prop.y, prop.w, prop.h, 48, true);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(prop.x + 30, prop.y + 42);
    ctx.lineTo(prop.x + prop.w - 30, prop.y + 76);
    ctx.stroke();
  } else if (prop.type === "banner") {
    ctx.fillStyle = "#3b2d27";
    roundedRect(prop.x + 24, prop.y, 12, prop.h, 3, true);
    ctx.fillStyle = "#b83935";
    roundedRect(prop.x + 36, prop.y + 12, 70, 82, 4, true);
    ctx.fillStyle = "#f0cf65";
    blockDiamond(prop.x + 70, prop.y + 52, 16);
  } else if (prop.type === "barricade") {
    ctx.fillStyle = "#6d4d30";
    for (let x = prop.x; x < prop.x + prop.w; x += 54) {
      roundedRect(x, prop.y, 42, prop.h, 8, true);
    }
  } else if (prop.type === "duel") {
    ctx.strokeStyle = "#f0cf65";
    ctx.lineWidth = 8;
    roundedRect(prop.x, prop.y, prop.w, prop.h, 34, false);
    ctx.fillStyle = "rgba(240,207,101,0.08)";
    roundedRect(prop.x, prop.y, prop.w, prop.h, 34, true);
  } else if (prop.type === "throne") {
    ctx.fillStyle = "#8b3f3d";
    roundedRect(prop.x, prop.y + 62, prop.w, prop.h - 62, 12, true);
    ctx.fillStyle = "#b74f4b";
    roundedRect(prop.x + 28, prop.y, prop.w - 56, prop.h, 12, true);
    ctx.fillStyle = "#f0cf65";
    roundedRect(prop.x + 18, prop.y + 42, prop.w - 36, 22, 8, true);
    roundedRect(prop.x + 42, prop.y + prop.h - 20, 40, 90, 8, true);
    roundedRect(prop.x + prop.w - 82, prop.y + prop.h - 20, 40, 90, 8, true);
    blockDiamond(prop.x + prop.w / 2, prop.y + 88, 22);
  } else if (prop.type === "flower") {
    ctx.fillStyle = "#3a8a4f";
    roundedRect(prop.x + 20, prop.y + 18, 10, 42, 4, true);
    ["#ffdf6c", "#ff8ab3", "#ffffff"].forEach((color, index) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(prop.x + 25 + Math.cos(index * 2.1) * 16, prop.y + 18 + Math.sin(index * 2.1) * 12, 12, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    ctx.fillStyle = "#b7b1a2";
    roundedRect(prop.x, prop.y, prop.w, prop.h, 6, true);
    ctx.fillStyle = "#8e887c";
    for (let x = prop.x + 16; x < prop.x + prop.w - 20; x += 54) {
      roundedRect(x, prop.y - 72, 32, 78, 5, true);
    }
  }
}

function drawRelic(relic) {
  if (relic.taken) return;
  ctx.save();
  ctx.translate(relic.x, relic.y + Math.sin(performance.now() / 260) * 5);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 20, 28, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = relic.color;
  blockDiamond(0, 0, 24);
  ctx.restore();
}

function drawHero(hero, active) {
  ctx.save();
  ctx.translate(hero.x, hero.y);
  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(0, 22, 33, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hero.color;
  roundedRect(-21, -31, 42, 54, 6, true);
  ctx.fillStyle = hero.trim;
  roundedRect(5, -23, 17, 39, 4, true);
  ctx.fillStyle = "#f1c79b";
  roundedRect(-15, -56, 30, 27, 6, true);
  ctx.fillStyle = "#684326";
  roundedRect(-17, -62, 34, 11, 4, true);
  if (coronationMode && hero.id === "castpeun") {
    drawCrown(0, -73, 1);
  }
  ctx.fillStyle = "#2b2730";
  roundedRect(-14, 20, 11, 27, 3, true);
  roundedRect(3, 20, 11, 27, 3, true);
  drawWeapon(hero);
  if (hero.attackFlash > 0) {
    ctx.save();
    ctx.rotate(hero.angle);
    ctx.strokeStyle = hero.weapon === "bow" ? "#f4e1a2" : "#ffffff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(28, 0, hero.weapon === "bow" ? 34 : hero.range, -0.65, 0.65);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  if (active) {
    ctx.strokeStyle = "#f1d169";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(hero.x, hero.y + 34, 46, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawHealthBar(hero.x, hero.y - 78, 64, hero.health / hero.maxHealth, "#7ee879");
}

function drawCrown(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#f0cf65";
  ctx.beginPath();
  ctx.moveTo(-22, 12);
  ctx.lineTo(-17, -10);
  ctx.lineTo(-6, 3);
  ctx.lineTo(0, -14);
  ctx.lineTo(6, 3);
  ctx.lineTo(17, -10);
  ctx.lineTo(22, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e85d6a";
  ctx.beginPath();
  ctx.arc(0, 1, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWeapon(hero) {
  ctx.save();
  ctx.rotate(hero.angle);
  if (hero.weapon === "bow") {
    ctx.strokeStyle = "#f0cf65";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(26, -4, 26, -1.1, 1.1);
    ctx.stroke();
    ctx.strokeStyle = "#f6f4e8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(37, -25);
    ctx.lineTo(37, 18);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#d9dde6";
    roundedRect(18, -5, 54, 8, 3, true);
    ctx.fillStyle = "#6b4a30";
    roundedRect(6, -8, 17, 14, 4, true);
  }
  ctx.restore();
}

function drawEnemy(enemy) {
  if (!enemy.active || !enemy.alive) return;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 21, 36, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = enemy.hurt > 0 ? "#ffd45d" : enemy.color;
  roundedRect(-24, -30, 48, 55, 6, true);
  ctx.fillStyle = "#d0b091";
  roundedRect(-15, -55, 30, 25, 5, true);
  ctx.fillStyle = "#202020";
  roundedRect(-13, -58, 26, 9, 4, true);
  ctx.fillStyle = "#2a2a2a";
  roundedRect(20, -8, 42, 8, 3, true);
  ctx.restore();
  drawHealthBar(enemy.x, enemy.y - 75, 58, enemy.health / enemy.maxHealth, "#ff7670");
}

function drawProjectile(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(p.vy, p.vx));
  ctx.fillStyle = "#f1db8d";
  roundedRect(-19, -3, 38, 6, 3, true);
  ctx.fillStyle = "#ffffff";
  triangle(20, 0, 8, -8, 8, 8);
  ctx.restore();
}

function drawBurst(burst) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, burst.life * 2);
  ctx.strokeStyle = burst.color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(burst.x, burst.y, 36 - burst.life * 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCoronationEffects() {
  const t = performance.now() / 1000;
  for (let i = 0; i < 48; i += 1) {
    const x = 360 + ((i * 127 + t * 55) % 1480);
    const y = 320 + ((i * 83 + t * 90) % 760);
    ctx.fillStyle = ["#f0cf65", "#ff8ab3", "#7ff5c9", "#ffffff"][i % 4];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t + i);
    ctx.fillRect(-5, -3, 10, 6);
    ctx.restore();
  }

  ctx.fillStyle = "rgba(255, 246, 190, 0.18)";
  ctx.beginPath();
  ctx.arc(1110, 710, 210 + Math.sin(t * 2) * 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f0cf65";
  drawCrown(1110, 470 + Math.sin(t * 2.4) * 6, 1.6);
}

function drawHealthBar(x, y, width, value, color) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundedRect(x - width / 2, y, width, 9, 5, true);
  ctx.fillStyle = color;
  roundedRect(x - width / 2 + 1, y + 1, (width - 2) * clamp(value, 0, 1), 7, 4, true);
}

function drawVignette(w, h) {
  const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(9,18,17,0.38)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function updateHud() {
  const hero = activeHero();
  const beat = storyBeats[storyBeatIndex];
  heroName.textContent = hero.name;
  heroKit.textContent = `${hero.kit}${hero.id === "lucy" ? ` - potion ${hero.healCooldown <= 0 ? "ready" : Math.ceil(hero.healCooldown) + "s"}` : ""}`;
  healthFill.style.width = `${(hero.health / hero.maxHealth) * 100}%`;
  levelNameEl.textContent = beat.level;
  objectiveEl.textContent = `Objective: ${beat.objective}`;
  const levelRelicText = levelRelicsNeeded > 0 ? `${levelRelicsFound} / ${levelRelicsNeeded} this level` : "none needed";
  relicsEl.textContent = `Relics: ${collectedRelics} total, ${levelRelicText}`;
  if (levelComplete && storyBeatIndex < storyBeats.length - 1) {
    completeText.textContent = `Next level starts in ${Math.max(1, Math.ceil(nextLevelTimer))}... Press N to continue now.`;
  } else if (levelComplete) {
    completeText.textContent = "Prince Castpeun is crowned king. Narnia celebrates!";
  }
  partyEl.innerHTML = heroes
    .map((member, index) => `
      <div class="party-card ${index === activeHeroIndex ? "active" : ""}">
        <b>${index + 1}. ${member.short}</b>
        <div class="mini-health"><i style="width:${(member.health / member.maxHealth) * 100}%"></i></div>
      </div>
    `)
    .join("");
  document.getElementById("dialogue").style.opacity = dialogueTimer > 0 ? "1" : "0.2";
  completeBanner.classList.toggle("visible", levelComplete);
}

function drawObjectiveMarker() {
  const target = objectiveTarget();
  if (!target || levelComplete) return;
  const bob = Math.sin(performance.now() / 220) * 7;
  ctx.save();
  ctx.translate(target.x, target.y + bob);
  ctx.strokeStyle = "#f0cf65";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(240, 207, 101, 0.18)";
  ctx.beginPath();
  ctx.arc(0, 0, target.radius + 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6f4e8";
  triangle(0, -target.radius - 42, -14, -target.radius - 18, 14, -target.radius - 18);
  ctx.restore();
}

function objectiveTarget() {
  if (storyBeatIndex === 0) {
    const wardrobe = props.find((prop) => prop.type === "wardrobe");
    return { x: wardrobe.x + wardrobe.w / 2, y: wardrobe.y + wardrobe.h / 2, radius: 76 };
  }
  const relic = relics.find((candidate) => !candidate.taken);
  if (relic && levelRelicsFound < levelRelicsNeeded) return { x: relic.x, y: relic.y, radius: 48 };
  const enemy = enemies.find((candidate) => candidate.active && candidate.alive);
  if (enemy) return { x: enemy.x, y: enemy.y, radius: 58 };
  return null;
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function screenToWorld(sx, sy) {
  const x = (sx - window.innerWidth / 2) / camera.zoom + camera.x;
  const y = (sy - window.innerHeight / 2 - 58) / (camera.zoom * 0.78) + camera.y;
  return { x, y };
}

function roundedRect(x, y, w, h, r, fill) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  if (fill) ctx.fill();
  else ctx.stroke();
}

function blockDiamond(x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter", "q", "shift", "n", "1", "2", "3", "4", "5"].includes(key)) {
    event.preventDefault();
  }
  const n = Number(event.key);
  if (n >= 1 && n <= 5) setHero(n - 1);
  if (key === "n" && levelComplete && storyBeatIndex < storyBeats.length - 1) startLevel(storyBeatIndex + 1);
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
canvas.addEventListener("mousemove", (event) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
  mouse.moved = true;
});
canvas.addEventListener("mousedown", () => {
  mouse.down = true;
});
window.addEventListener("mouseup", () => {
  mouse.down = false;
});
document.querySelectorAll("#touch-controls button[data-key]").forEach((button) => {
  const key = button.dataset.key;
  const press = (event) => {
    event.preventDefault();
    if (key === "n" && levelComplete && storyBeatIndex < storyBeats.length - 1) {
      startLevel(storyBeatIndex + 1);
      return;
    }
    keys.add(key);
  };
  const release = (event) => {
    event.preventDefault();
    keys.delete(key);
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

resize();
startLevel(0);
updateCamera(activeHero());
updateHud();
requestAnimationFrame(loop);
