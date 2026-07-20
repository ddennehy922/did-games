const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const mini = minimap.getContext('2d');
const keys = new Set();

let data, bounds, scale = 1, camera = { x: 0, y: 0 };

const VEHICLES = {
  ambulance: {
    label: 'Ambulance',
    description: 'Ambulance: quicker acceleration, tighter turning, and better for EMS route practice.',
    accel: 126, reverse: -62, maxForward: 122, maxReverse: -34, dragCoast: 0.955, dragPower: 0.982, turn: 1.72, speedDivisor: 35, mphScale: 0.72, scoreBonus: 0,
    primary: '#f8fbff', stripe: '#e3222c', roof: '#dff3ff', outline: '#10233a', light: '#3dbbff'
  },
  engine: {
    label: 'Fire Engine',
    description: 'Fire Engine: powerful but heavy, with stable turning, strong brakes, and a full apparatus look.',
    accel: 104, reverse: -58, maxForward: 112, maxReverse: -30, dragCoast: 0.948, dragPower: 0.978, turn: 1.38, speedDivisor: 42, mphScale: 0.69, scoreBonus: 50,
    primary: '#d71920', dark: '#8f0d15', stripe: '#ffd166', roof: '#ffffff', outline: '#ffffff', light: '#5bc0ff', chrome: '#c9d6e2'
  }
};

let selectedVehicle = 'ambulance';
let truck = { x: 0, y: 0, angle: 0, speed: 0, station: null };
let activeCall = null;
let lastCompletedCall = null;
let runStart = null;
let gps = true;
let score = 0;
let runs = 0;
let trainingMode = 'guided';
let viewMode = 'close';
const VIEW_MODES = {
  close: { label: 'Close', divisor: 760, labelDistance: 760 },
  wide: { label: 'Wide', divisor: 1250, labelDistance: 1200 },
  city: { label: 'City', divisor: 1900, labelDistance: 1800 }
};
let bestRun = Number(localStorage.getItem('xeniaFireTrainerBestSeconds') || 0);
const ROUTE_BESTS_KEY = 'xeniaFireTrainerRouteBestsV1';
let routeBests = loadRouteBests();
let toastTimer = null;
let roadSegments = [];
let lastRoadDistance = 0;
let activeRoadSegment = null;

const ui = {
  modePill: document.getElementById('modePill'),
  dispatchTitle: document.getElementById('dispatchTitle'),
  dispatchText: document.getElementById('dispatchText'),
  distanceText: document.getElementById('distanceText'),
  timerText: document.getElementById('timerText'),
  gpsText: document.getElementById('gpsText'),
  bestText: document.getElementById('bestText'),
  routeBestText: document.getElementById('routeBestText'),
  medalText: document.getElementById('medalText'),
  scoreText: document.getElementById('scoreText'),
  runsText: document.getElementById('runsText'),
  speedText: document.getElementById('speedText'),
  hudSpeed: document.getElementById('hudSpeed'),
  hudDistance: document.getElementById('hudDistance'),
  hudGps: document.getElementById('hudGps'),
  gradeText: document.getElementById('gradeText'),
  stationButtons: document.getElementById('stationButtons'),
  replayCallBtn: document.getElementById('replayCallBtn'),
  modeDescription: document.getElementById('modeDescription'),
  vehicleDescription: document.getElementById('vehicleDescription'),
  toast: document.getElementById('toast'),
  overlay: document.getElementById('startOverlay')
};

function loadRouteBests() {
  try {
    return JSON.parse(localStorage.getItem(ROUTE_BESTS_KEY) || '{}') || {};
  } catch (err) {
    return {};
  }
}

function saveRouteBests() {
  try {
    localStorage.setItem(ROUTE_BESTS_KEY, JSON.stringify(routeBests));
  } catch (err) {
    // Keep the session playable if private browsing or storage limits block saving.
  }
}

function routeKey(call = activeCall, mode = trainingMode, vehicle = selectedVehicle) {
  if (!call) return '';
  return `${call.id || call.label}|${mode}|${vehicle}`;
}

function medalForRun(elapsed, usedGps) {
  const target = usedGps ? 90 : 115;
  if (elapsed <= target * 0.72) return '🥇 Gold';
  if (elapsed <= target * 0.95) return '🥈 Silver';
  if (elapsed <= target * 1.25) return '🥉 Bronze';
  return 'Practice';
}

function updateRouteReplayText(call = activeCall) {
  if (!call) {
    ui.routeBestText.textContent = 'Route best: —';
    ui.medalText.textContent = 'Medal: —';
    return;
  }
  const best = routeBests[routeKey(call)];
  ui.routeBestText.textContent = `Route best: ${best ? fmt(best.seconds) : '—'}`;
  ui.medalText.textContent = `Medal: ${best?.medal || '—'}`;
}

function roadColor(cls) {
  return ({ motorway: '#7f95a3', trunk: '#ffb14a', primary: '#ffd166', secondary: '#c7d66d', tertiary: '#8bcf7a', residential: '#5a7894', service: '#36546e' }[cls] || '#47657e');
}

function roadDrawRank(cls) {
  return ({ service: 0, residential: 1, unclassified: 2, tertiary: 3, secondary: 4, primary: 5, trunk: 6, motorway: 7 }[cls] ?? 2);
}

function isPriorityStreet(name = '') {
  return /detroit|main|second|columbus|church/i.test(name);
}

function priorityStreetColor(name = '') {
  if (/main/i.test(name)) return '#ffdf5d';
  if (/detroit/i.test(name)) return '#ff9f43';
  if (/second/i.test(name)) return '#8ee6ff';
  if (/columbus/i.test(name)) return '#c6ff6f';
  if (/church/i.test(name)) return '#f7a7ff';
  return '#ffe58f';
}

function drawRoadPolyline(targetCtx, toPoint, road) {
  targetCtx.beginPath();
  road.points.forEach((p, i) => {
    const [x, y] = toPoint(p[0], p[1]);
    i ? targetCtx.lineTo(x, y) : targetCtx.moveTo(x, y);
  });
}

function calcBounds() {
  const xs = [], ys = [];
  data.roads.forEach(r => r.points.forEach(p => { xs.push(p[0]); ys.push(p[1]); }));
  data.stations.forEach(s => { xs.push(s.point[0]); ys.push(s.point[1]); });
  data.destinations.forEach(d => { xs.push(d.point[0]); ys.push(d.point[1]); });
  bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function buildRoadSegments() {
  roadSegments = [];
  data.roads.forEach(road => {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1];
      const b = road.points[i];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const lenSq = dx * dx + dy * dy;
      if (lenSq > 4) roadSegments.push({ a, b, dx, dy, lenSq, road });
    }
  });
}

function closestRoadPoint(x, y) {
  let best = null;
  const moving = Math.abs(truck.speed) > 8;
  const headingX = Math.cos(truck.angle) * Math.sign(truck.speed || 1);
  const headingY = Math.sin(truck.angle) * Math.sign(truck.speed || 1);
  const isManeuvering = truck.isReversing || truck.isBraking || (truck.isTurning && Math.abs(truck.speed) < 20);

  for (const seg of roadSegments) {
    const t = Math.max(0, Math.min(1, ((x - seg.a[0]) * seg.dx + (y - seg.a[1]) * seg.dy) / seg.lenSq));
    const px = seg.a[0] + seg.dx * t;
    const py = seg.a[1] + seg.dy * t;
    const distSq = (x - px) ** 2 + (y - py) ** 2;
    const segLen = Math.sqrt(seg.lenSq);
    const ux = seg.dx / segLen;
    const uy = seg.dy / segLen;
    const headingMatch = Math.abs(ux * headingX + uy * headingY);

    // Bias toward the road we are already on and toward the vehicle heading.
    // At intersections this prevents the assist from grabbing a crossing side road
    // when the player is trying to continue straight past it.
    const sameRoad = activeRoadSegment && seg.road.id === activeRoadSegment.road.id;
    const sameSegment = activeRoadSegment && seg === activeRoadSegment;
    const headingPenalty = moving && !isManeuvering ? (1 - headingMatch) * 900 : 0;
    const switchPenalty = moving && !isManeuvering && !sameRoad ? 520 : 0;
    const continuityBonus = sameSegment ? -260 : sameRoad ? -150 : 0;
    const score = distSq + headingPenalty + switchPenalty + continuityBonus;

    if (!best || score < best.score) {
      best = { x: px, y: py, angle: Math.atan2(seg.dy, seg.dx), distSq, road: seg.road, segment: seg, score };
    }
  }
  return best;
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

function applyRoadAssist(dt) {
  const nearest = closestRoadPoint(truck.x, truck.y);
  if (!nearest) return;
  const dist = Math.sqrt(nearest.distSq);
  lastRoadDistance = dist;
  const snapRange = 70;
  if (dist > snapRange) {
    activeRoadSegment = null;
    truck.speed *= Math.pow(0.72, dt * 60);
    return;
  }
  activeRoadSegment = nearest.segment;
  const isManeuvering = truck.isReversing || truck.isBraking || (truck.isTurning && Math.abs(truck.speed) < 20);
  const strength = isManeuvering ? 0.08 : dist < 12 ? 0.16 : dist < 30 ? 0.28 : 0.44;
  const blend = Math.min(0.75, strength * dt * 8);
  truck.x += (nearest.x - truck.x) * blend;
  truck.y += (nearest.y - truck.y) * blend;

  // Do not force road heading while backing/braking/doing a tight low-speed turn.
  // That was making dead ends feel like the vehicle could not turn around.
  if (!isManeuvering && Math.abs(truck.speed) > 12 && dist < 35) {
    let roadAngle = nearest.angle;
    if (Math.cos(truck.angle - roadAngle) < 0) roadAngle += Math.PI;
    const align = Math.min(0.18, dt * 1.8) * (1 - Math.min(1, dist / 45));
    truck.angle += angleDelta(truck.angle, roadAngle) * align;
  }
}

function worldToScreen(x, y) {
  // World Y increases north with latitude. Canvas Y increases downward, so
  // invert Y to keep the map north-up instead of upside down.
  return [(x - camera.x) * scale + canvas.width / 2, canvas.height / 2 - (y - camera.y) * scale];
}

function miniPoint(x, y) {
  const pad = 12;
  const sx = (minimap.width - pad * 2) / Math.max(1, bounds.maxX - bounds.minX);
  const sy = (minimap.height - pad * 2) / Math.max(1, bounds.maxY - bounds.minY);
  const s = Math.min(sx, sy);
  const ox = (minimap.width - (bounds.maxX - bounds.minX) * s) / 2;
  const oy = (minimap.height - (bounds.maxY - bounds.minY) * s) / 2;
  return [ox + (x - bounds.minX) * s, oy + (bounds.maxY - y) * s];
}

function setStation(id) {
  const s = data.stations.find(station => station.id === id) || data.stations[0];
  truck.x = s.point[0];
  truck.y = s.point[1];
  truck.angle = (s.headingDegrees || 90) * Math.PI / 180;
  truck.speed = 0;
  truck.station = s;
  activeRoadSegment = null;
  camera.x = truck.x;
  camera.y = truck.y;
  showToast(`${VEHICLES[selectedVehicle].label} starting from ${s.name}`);
}

function setMode(mode) {
  trainingMode = mode;
  gps = mode !== 'memory';
  if (mode === 'free') activeCall = null;
  const labels = {
    guided: ['Guided Dispatch', 'GPS starts on so you can learn the route, street names, and general direction.'],
    memory: ['Street Memory', 'GPS starts off. Use street names and your own route knowledge. Toggle GPS if you get stuck.'],
    free: ['Free Drive', 'No active call. Explore Xenia streets and learn the road network.']
  };
  ui.modePill.textContent = labels[mode][0];
  ui.modeDescription.textContent = labels[mode][1];
  document.querySelectorAll('[data-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  updateGpsText();
  updateRouteReplayText(activeCall);
  if (mode === 'free') {
    ui.dispatchTitle.textContent = 'Free Drive';
    ui.dispatchText.textContent = 'Explore the map, learn street names, then switch to dispatch training when ready.';
  }
  showToast(labels[mode][0]);
}

function newDispatch() {
  if (!data.destinations.length) return;
  if (trainingMode === 'free') setMode('guided');
  activeCall = data.destinations[Math.floor(Math.random() * data.destinations.length)];
  startDispatchRun();
}

function replayLastDispatch() {
  if (!lastCompletedCall) {
    showToast('Finish a dispatch first, then replay it for a faster route.');
    return;
  }
  if (trainingMode === 'free') setMode('guided');
  activeCall = lastCompletedCall;
  startDispatchRun(true);
}

function startDispatchRun(isReplay = false) {
  keys.clear();
  runStart = performance.now();
  ui.modePill.textContent = trainingMode === 'memory' ? 'Memory Run Active' : 'Dispatch Active';
  ui.dispatchTitle.textContent = activeCall.label;
  ui.dispatchText.textContent = `${isReplay ? 'Replay route: ' : ''}${VEHICLES[selectedVehicle].label} response to ${activeCall.address}. ${gps ? 'GPS guide is available.' : 'GPS is off: use street names and memory.'}`;
  updateRouteReplayText(activeCall);
  showToast(`${isReplay ? 'REPLAY' : 'DISPATCH'}: ${VEHICLES[selectedVehicle].label} to ${activeCall.label} — ${activeCall.address}`);
}

function completeCall() {
  const elapsed = (performance.now() - runStart) / 1000;
  const finishedCall = activeCall;
  const finishedKey = routeKey(finishedCall);
  const medal = medalForRun(elapsed, gps);
  const oldRouteBest = routeBests[finishedKey];
  const routeRecord = !oldRouteBest || elapsed < oldRouteBest.seconds;
  const gpsPenalty = gps && trainingMode === 'memory' ? 150 : 0;
  const vehicle = VEHICLES[selectedVehicle];
  const earned = Math.max(100, Math.round(1300 - elapsed * 8 - gpsPenalty + vehicle.scoreBonus));
  const grade = elapsed < 60 ? 'A' : elapsed < 100 ? 'B' : elapsed < 150 ? 'C' : 'Practice';
  score += earned;
  runs++;
  if (!bestRun || elapsed < bestRun) {
    bestRun = elapsed;
    localStorage.setItem('xeniaFireTrainerBestSeconds', String(bestRun));
  }
  if (routeRecord) {
    routeBests[finishedKey] = { seconds: elapsed, medal, label: finishedCall.label, mode: trainingMode, vehicle: selectedVehicle };
    saveRouteBests();
  }
  ui.scoreText.textContent = score;
  ui.runsText.textContent = runs;
  ui.gradeText.textContent = grade;
  ui.bestText.textContent = `Best: ${fmt(bestRun)}`;
  ui.routeBestText.textContent = `Route best: ${fmt(routeBests[finishedKey].seconds)}`;
  ui.medalText.textContent = `Medal: ${routeBests[finishedKey].medal}`;
  ui.modePill.textContent = `Arrived +${earned}`;
  ui.dispatchTitle.textContent = 'Call complete';
  ui.dispatchText.textContent = `${routeRecord ? 'New route record! ' : ''}Arrived at ${finishedCall.address} in ${fmt(elapsed)} for ${medal}. Grade: ${grade}. Press Replay Last to chase a faster medal route or New Dispatch for a fresh call.`;
  showToast(`${routeRecord ? 'Route record! ' : ''}${earned} points. ${medal}.`);
  lastCompletedCall = finishedCall;
  ui.replayCallBtn.disabled = false;
  activeCall = null;
  runStart = null;
}

function update(dt) {
  const vehicle = VEHICLES[selectedVehicle];
  const forward = keys.has('ArrowUp') || keys.has('KeyW');
  const reverse = keys.has('ArrowDown') || keys.has('KeyS');
  const brake = keys.has('Space');
  const accel = forward ? vehicle.accel : reverse ? vehicle.reverse : 0;

  if (brake) truck.speed *= Math.pow(selectedVehicle === 'ambulance' ? 0.13 : 0.10, dt);
  else truck.speed += accel * dt;

  const drag = accel === 0 ? vehicle.dragCoast : vehicle.dragPower;
  truck.speed *= Math.pow(drag, dt * 60);
  truck.speed = Math.max(vehicle.maxReverse, Math.min(vehicle.maxForward, truck.speed));

  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  const turnInput = (left ? -1 : 0) + (right ? 1 : 0);
  truck.isReversing = reverse || truck.speed < -2;
  truck.isBraking = brake;
  truck.isTurning = turnInput !== 0;
  const baseSpeedFactor = Math.min(1, Math.abs(truck.speed) / vehicle.speedDivisor);
  const maneuverFloor = selectedVehicle === 'ambulance' ? 0.34 : 0.26;
  const speedFactor = turnInput && (forward || reverse || brake) ? Math.max(maneuverFloor, baseSpeedFactor) : baseSpeedFactor;
  const reverseBoost = reverse ? 1.18 : 1;
  const brakePivotBoost = brake && Math.abs(truck.speed) < 16 ? 1.55 : 1;
  const steeringDirection = truck.speed < -2 ? -1 : 1;
  const turnRate = vehicle.turn * speedFactor * steeringDirection * reverseBoost * brakePivotBoost;
  truck.angle += turnInput * turnRate * dt;

  truck.x += Math.cos(truck.angle) * truck.speed * dt;
  truck.y += Math.sin(truck.angle) * truck.speed * dt;
  applyRoadAssist(dt);
  camera.x += (truck.x - camera.x) * Math.min(1, dt * 4.2);
  camera.y += (truck.y - camera.y) * Math.min(1, dt * 4.2);
  const mph = Math.round(Math.abs(truck.speed) * vehicle.mphScale);
  ui.speedText.textContent = mph;
  ui.hudSpeed.textContent = `${mph} mph`;

  if (activeCall) {
    const dist = Math.hypot(activeCall.point[0] - truck.x, activeCall.point[1] - truck.y);
    ui.distanceText.textContent = `Distance: ${Math.round(dist)} m`;
    ui.hudDistance.textContent = `${Math.round(dist)} m`;
    ui.timerText.textContent = `Timer: ${fmt((performance.now() - runStart) / 1000)}`;
    if (dist < (activeCall.arrivalRadiusMeters || 18) + 18) completeCall();
  } else {
    ui.distanceText.textContent = 'Distance: —';
    ui.hudDistance.textContent = 'Distance —';
    ui.timerText.textContent = 'Timer: 00:00';
  }
}

function fmt(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function drawRoads(targetCtx, toPoint, alpha = 1, labelDistance = 850) {
  targetCtx.lineCap = 'round';
  targetCtx.lineJoin = 'round';
  [...data.roads].sort((a, b) => roadDrawRank(a.roadClass) - roadDrawRank(b.roadClass)).forEach(r => {
    drawRoadPolyline(targetCtx, toPoint, r);
    targetCtx.strokeStyle = roadColor(r.roadClass);
    const major = ['motorway', 'trunk', 'primary'].includes(r.roadClass);
    const priority = isPriorityStreet(r.name);
    targetCtx.globalAlpha = (r.roadClass === 'service' ? 0.38 : major ? 0.9 : 0.66) * alpha;
    targetCtx.lineWidth = Math.max(1.1, (r.roadClass === 'motorway' ? 7 : r.roadClass === 'trunk' ? 7 : r.roadClass === 'primary' ? 6 : r.roadClass === 'secondary' ? 4.4 : r.roadClass === 'tertiary' ? 3.6 : priority ? 3.2 : 2) * (targetCtx === ctx ? scale : 0.34));
    targetCtx.stroke();
  });

  // Draw a second highlighted pass for core Xenia streets. This keeps Main St
  // and Detroit visible even after adding the dense full OSM street layer.
  const priorityRoads = data.roads.filter(r => isPriorityStreet(r.name));
  priorityRoads.forEach(r => {
    drawRoadPolyline(targetCtx, toPoint, r);
    targetCtx.globalAlpha = 0.92 * alpha;
    targetCtx.strokeStyle = 'rgba(4,10,18,.9)';
    targetCtx.lineWidth = Math.max(2, 10 * (targetCtx === ctx ? scale : 0.34));
    targetCtx.stroke();
    drawRoadPolyline(targetCtx, toPoint, r);
    targetCtx.globalAlpha = 1 * alpha;
    targetCtx.strokeStyle = priorityStreetColor(r.name);
    targetCtx.lineWidth = Math.max(1.8, 6.4 * (targetCtx === ctx ? scale : 0.34));
    targetCtx.stroke();
  });
  targetCtx.globalAlpha = 1;

  if (targetCtx !== ctx) return;
  ctx.font = '700 12px system-ui';
  ctx.fillStyle = 'rgba(220,236,255,.9)';
  ctx.strokeStyle = 'rgba(4,10,18,.82)';
  ctx.lineWidth = 3;
  const labelCandidates = data.roads
    .filter(r => r.name && !r.name.startsWith('Unnamed'))
    .map(r => {
      const mid = r.points[Math.floor(r.points.length / 2)];
      const dist = Math.hypot(mid[0] - truck.x, mid[1] - truck.y);
      return { road: r, mid, dist, priority: (isPriorityStreet(r.name) ? 10000 : 0) + roadDrawRank(r.roadClass) * 1000 - dist };
    })
    .filter(item => item.dist <= labelDistance || isPriorityStreet(item.road.name))
    .sort((a, b) => b.priority - a.priority);
  let labels = 0;
  const usedLabelSpots = [];
  for (const item of labelCandidates) {
    if (labels > 135) break;
    const r = item.road;
    const mid = item.mid;
    const [x, y] = worldToScreen(mid[0], mid[1]);
    const priority = isPriorityStreet(r.name);
    if (x < 20 || x > canvas.width - 20 || y < 20 || y > canvas.height - 20) continue;
    if (!priority && usedLabelSpots.some(([lx, ly]) => Math.hypot(lx - x, ly - y) < 58)) continue;
    if (priority && usedLabelSpots.some(([lx, ly]) => Math.hypot(lx - x, ly - y) < 26)) continue;
    ctx.font = `${priority ? '900' : '700'} ${priority ? 13 : 12}px system-ui`;
    ctx.fillStyle = priority ? 'rgba(255,226,128,.98)' : 'rgba(220,236,255,.9)';
    ctx.strokeText(r.name, x + 4, y - 4);
    ctx.fillText(r.name, x + 4, y - 4);
    usedLabelSpots.push([x, y]);
    labels++;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  scale = Math.min(canvas.width, canvas.height) / VIEW_MODES[viewMode].divisor;
  drawRoads(ctx, worldToScreen, 1, VIEW_MODES[viewMode].labelDistance);

  data.stations.forEach(s => {
    const [x, y] = worldToScreen(s.point[0], s.point[1]);
    ctx.fillStyle = '#5bc0ff';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '800 13px system-ui';
    ctx.fillText(s.name.replace('Fire ', ''), x + 12, y + 5);
  });

  if (activeCall) {
    const [dx, dy] = worldToScreen(activeCall.point[0], activeCall.point[1]);
    if (gps) {
      const [tx, ty] = worldToScreen(truck.x, truck.y);
      ctx.strokeStyle = 'rgba(255,92,92,.72)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(dx, dy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#ff5c5c';
    ctx.beginPath();
    ctx.arc(dx, dy, 14 + Math.sin(performance.now() / 180) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '900 14px system-ui';
    ctx.fillText('INCIDENT', dx + 18, dy + 4);
    const callRoad = activeCall.snappedToRoad || activeCall.address;
    if (callRoad) {
      ctx.font = '800 12px system-ui';
      ctx.strokeStyle = 'rgba(4,10,18,.9)';
      ctx.lineWidth = 3;
      ctx.strokeText(callRoad, dx + 18, dy + 20);
      ctx.fillText(callRoad, dx + 18, dy + 20);
    }
  }

  drawVehicle(ctx, worldToScreen(truck.x, truck.y), 1);
  drawMinimap();
  requestAnimationFrame(draw);
}

function drawVehicle(targetCtx, point, size) {
  if (selectedVehicle === 'ambulance') drawAmbulance(targetCtx, point, size);
  else drawEngine(targetCtx, point, size);
}

function drawAmbulance(targetCtx, point, size) {
  const [x, y] = point;
  const v = VEHICLES.ambulance;
  targetCtx.save();
  targetCtx.translate(x, y);
  targetCtx.rotate(-truck.angle);
  targetCtx.lineWidth = 2 * size;
  targetCtx.strokeStyle = v.outline;
  targetCtx.fillStyle = v.primary;
  targetCtx.beginPath();
  targetCtx.roundRect(-20 * size, -11 * size, 40 * size, 22 * size, 5 * size);
  targetCtx.fill();
  targetCtx.stroke();
  targetCtx.fillStyle = v.roof;
  targetCtx.beginPath();
  targetCtx.roundRect(-6 * size, -8 * size, 17 * size, 16 * size, 3 * size);
  targetCtx.fill();
  targetCtx.fillStyle = v.stripe;
  targetCtx.fillRect(-18 * size, -2.3 * size, 31 * size, 4.6 * size);
  targetCtx.fillRect(-5.5 * size, -8 * size, 4.5 * size, 16 * size);
  targetCtx.fillStyle = '#10233a';
  targetCtx.fillRect(9 * size, -7 * size, 7 * size, 5 * size);
  targetCtx.fillRect(9 * size, 2 * size, 7 * size, 5 * size);
  targetCtx.fillStyle = v.light;
  targetCtx.fillRect(14 * size, -10 * size, 5 * size, 4 * size);
  targetCtx.fillStyle = '#ff4b55';
  targetCtx.fillRect(14 * size, 6 * size, 5 * size, 4 * size);
  targetCtx.fillStyle = '#ffd166';
  targetCtx.beginPath();
  targetCtx.moveTo(25 * size, 0);
  targetCtx.lineTo(16 * size, -7 * size);
  targetCtx.lineTo(16 * size, 7 * size);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.restore();
}

function drawEngine(targetCtx, point, size) {
  const [x, y] = point;
  const v = VEHICLES.engine;
  const flash = Math.sin(performance.now() / 95) > 0;
  targetCtx.save();
  targetCtx.translate(x, y);
  targetCtx.rotate(-truck.angle);
  targetCtx.lineWidth = 2 * size;

  // Long apparatus body with darker rear pump compartment.
  targetCtx.fillStyle = v.primary;
  targetCtx.strokeStyle = v.outline;
  targetCtx.beginPath();
  targetCtx.roundRect(-25 * size, -12 * size, 50 * size, 24 * size, 4 * size);
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.fillStyle = v.dark;
  targetCtx.beginPath();
  targetCtx.roundRect(-24 * size, -10 * size, 16 * size, 20 * size, 3 * size);
  targetCtx.fill();

  // Cab, windshield, grille, and gold side stripe.
  targetCtx.fillStyle = v.roof;
  targetCtx.beginPath();
  targetCtx.roundRect(4 * size, -9 * size, 14 * size, 18 * size, 3 * size);
  targetCtx.fill();
  targetCtx.fillStyle = '#20344a';
  targetCtx.fillRect(13 * size, -7 * size, 6 * size, 5 * size);
  targetCtx.fillRect(13 * size, 2 * size, 6 * size, 5 * size);
  targetCtx.fillStyle = v.chrome;
  targetCtx.fillRect(21 * size, -7 * size, 4 * size, 14 * size);
  targetCtx.fillStyle = v.stripe;
  targetCtx.fillRect(-23 * size, -2.3 * size, 27 * size, 4.6 * size);

  // Pump panel and ladder rails so it reads as a fire truck.
  targetCtx.strokeStyle = v.chrome;
  targetCtx.lineWidth = 1.5 * size;
  for (let i = 0; i < 4; i++) {
    const px = (-21 + i * 4) * size;
    targetCtx.strokeRect(px, -7 * size, 3 * size, 4 * size);
    targetCtx.strokeRect(px, 3 * size, 3 * size, 4 * size);
  }
  targetCtx.beginPath();
  targetCtx.moveTo(-20 * size, -14 * size);
  targetCtx.lineTo(9 * size, -14 * size);
  targetCtx.moveTo(-20 * size, 14 * size);
  targetCtx.lineTo(9 * size, 14 * size);
  for (let lx = -17; lx < 8; lx += 5) {
    targetCtx.moveTo(lx * size, -14 * size);
    targetCtx.lineTo((lx + 2) * size, 14 * size);
  }
  targetCtx.stroke();

  // Wheels/outriggers and emergency lights.
  targetCtx.fillStyle = '#101722';
  targetCtx.fillRect(-19 * size, -15 * size, 8 * size, 4 * size);
  targetCtx.fillRect(8 * size, -15 * size, 8 * size, 4 * size);
  targetCtx.fillRect(-19 * size, 11 * size, 8 * size, 4 * size);
  targetCtx.fillRect(8 * size, 11 * size, 8 * size, 4 * size);
  targetCtx.fillStyle = flash ? '#5bc0ff' : '#ff4b55';
  targetCtx.fillRect(14 * size, -12 * size, 5 * size, 4 * size);
  targetCtx.fillStyle = flash ? '#ff4b55' : '#5bc0ff';
  targetCtx.fillRect(14 * size, 8 * size, 5 * size, 4 * size);

  // Direction marker / headlights.
  targetCtx.fillStyle = '#ffd166';
  targetCtx.beginPath();
  targetCtx.moveTo(31 * size, 0);
  targetCtx.lineTo(19 * size, -8 * size);
  targetCtx.lineTo(19 * size, 8 * size);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.restore();
}

function drawMinimap() {
  mini.clearRect(0, 0, minimap.width, minimap.height);
  mini.fillStyle = 'rgba(6,15,26,.92)';
  mini.fillRect(0, 0, minimap.width, minimap.height);
  drawRoads(mini, miniPoint, 0.58);
  data.stations.forEach(s => {
    const [x, y] = miniPoint(s.point[0], s.point[1]);
    mini.fillStyle = '#5bc0ff';
    mini.beginPath();
    mini.arc(x, y, 3.5, 0, Math.PI * 2);
    mini.fill();
  });
  if (activeCall) {
    const [x, y] = miniPoint(activeCall.point[0], activeCall.point[1]);
    mini.fillStyle = '#ff5c5c';
    mini.beginPath();
    mini.arc(x, y, 5, 0, Math.PI * 2);
    mini.fill();
  }
  drawVehicle(mini, miniPoint(truck.x, truck.y), 0.42);
  mini.fillStyle = 'rgba(255,255,255,.85)';
  mini.font = '700 11px system-ui';
  mini.fillText('Xenia overview', 10, 16);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  requestAnimationFrame(loop);
}

function updateGpsText() {
  const label = gps ? 'On' : 'Off';
  ui.gpsText.textContent = `GPS: ${gps ? 'On' : 'Off'}`;
  ui.hudGps.textContent = `GPS ${gps ? 'On' : 'Off'}`;
  document.querySelectorAll('#gpsBtn, #touchGps').forEach(btn => {
    btn.textContent = btn.id === 'touchGps' ? `GPS ${label}` : `GPS: ${label}`;
    btn.setAttribute('aria-pressed', String(gps));
    btn.setAttribute('aria-label', `${gps ? 'Turn off' : 'Turn on'} GPS route guide`);
  });
  if (activeCall) ui.dispatchText.textContent = `${VEHICLES[selectedVehicle].label} response to ${activeCall.address}. ${gps ? 'GPS guide is available.' : 'GPS is off: use street names and memory.'}`;
}

function setVehicle(type) {
  selectedVehicle = VEHICLES[type] ? type : 'ambulance';
  const vehicle = VEHICLES[selectedVehicle];
  truck.speed = 0;
  activeRoadSegment = null;
  ui.vehicleDescription.textContent = vehicle.description;
  document.querySelectorAll('[data-vehicle]').forEach(btn => btn.classList.toggle('active', btn.dataset.vehicle === selectedVehicle));
  updateRouteReplayText(activeCall);
  showToast(`${vehicle.label} selected`);
  if (activeCall) updateGpsText();
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.add('hidden'), 3300);
}

function setupUI() {
  data.stations.forEach(s => {
    const b = document.createElement('button');
    b.textContent = s.name;
    b.onclick = () => setStation(s.id);
    ui.stationButtons.appendChild(b);
  });
  document.getElementById('newCallBtn').onclick = newDispatch;
  ui.replayCallBtn.onclick = replayLastDispatch;
  document.getElementById('touchDispatch').onclick = newDispatch;
  document.getElementById('touchReset').onclick = () => setStation(truck.station?.id);
  document.getElementById('gpsBtn').onclick = toggleGps;
  document.getElementById('touchGps').onclick = toggleGps;
  document.getElementById('zoomBtn').onclick = toggleViewMode;
  document.getElementById('touchZoom').onclick = toggleViewMode;
  document.getElementById('menuBtn').onclick = () => ui.overlay.classList.remove('hidden');
  document.getElementById('minimapToggle').onclick = () => {
    const collapsed = document.querySelector('.map-panel').classList.toggle('minimap-collapsed');
    updateMinimapToggle(!collapsed);
  };
  document.getElementById('closeOverlayBtn').onclick = () => ui.overlay.classList.add('hidden');
  document.querySelectorAll('[data-mode]').forEach(btn => btn.onclick = () => setMode(btn.dataset.mode));
  document.querySelectorAll('[data-vehicle]').forEach(btn => btn.onclick = () => setVehicle(btn.dataset.vehicle));
  document.querySelectorAll('[data-start-mode]').forEach(btn => btn.onclick = () => {
    setMode(btn.dataset.startMode);
    ui.overlay.classList.add('hidden');
    if (btn.dataset.startMode !== 'free') newDispatch();
  });
  ui.bestText.textContent = `Best: ${fmt(bestRun)}`;
  updateViewButtons();
  updateMinimapToggle(true);
  setVehicle('ambulance');
  setMode('guided');
}

function updateViewButtons() {
  const label = VIEW_MODES[viewMode].label;
  document.querySelectorAll('#zoomBtn, #touchZoom').forEach(btn => {
    btn.textContent = `View: ${label}`;
    btn.setAttribute('aria-label', `Change map view, currently ${label}`);
  });
}

function updateMinimapToggle(visible) {
  const btn = document.getElementById('minimapToggle');
  btn.textContent = visible ? 'Hide Map' : 'Show Map';
  btn.setAttribute('aria-label', visible ? 'Hide minimap' : 'Show minimap');
  btn.setAttribute('aria-pressed', String(visible));
}

function toggleGps() {
  gps = !gps;
  updateGpsText();
  showToast(`GPS guide ${gps ? 'on' : 'off'}`);
}

function toggleViewMode() {
  const order = ['close', 'wide', 'city'];
  viewMode = order[(order.indexOf(viewMode) + 1) % order.length];
  const label = VIEW_MODES[viewMode].label;
  updateViewButtons();
  showToast(`Map view: ${label}`);
}

window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyN', 'KeyL', 'KeyG', 'KeyR', 'KeyV'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyN') newDispatch();
  else if (e.code === 'KeyL') replayLastDispatch();
  else if (e.code === 'KeyG') toggleGps();
  else if (e.code === 'KeyV') toggleViewMode();
  else if (e.code === 'KeyR') setStation(truck.station?.id);
  else keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));

function clearTouchDriving() {
  keys.clear();
  document.querySelectorAll('[data-key].is-pressed').forEach(btn => btn.classList.remove('is-pressed'));
}

window.addEventListener('blur', clearTouchDriving);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTouchDriving();
});

document.querySelectorAll('[data-key]').forEach(btn => {
  const code = btn.dataset.key;
  let activePointerId = null;
  btn.setAttribute('unselectable', 'on');
  if (!btn.hasAttribute('aria-label')) btn.setAttribute('aria-label', `Touch control ${code}`);
  btn.addEventListener('contextmenu', e => e.preventDefault());
  const down = e => {
    e.preventDefault();
    if (activePointerId !== null && activePointerId !== e.pointerId) return;
    activePointerId = e.pointerId;
    keys.add(code);
    btn.classList.add('is-pressed');
    btn.setPointerCapture?.(e.pointerId);
  };
  const up = e => {
    e.preventDefault();
    const pointerId = e.pointerId ?? activePointerId;
    if (activePointerId !== null && pointerId !== activePointerId) return;
    activePointerId = null;
    keys.delete(code);
    btn.classList.remove('is-pressed');
  };
  btn.addEventListener('pointerdown', down, { passive: false });
  btn.addEventListener('pointerup', up, { passive: false });
  btn.addEventListener('pointercancel', up, { passive: false });
  btn.addEventListener('lostpointercapture', up, { passive: false });
  btn.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  btn.addEventListener('touchend', e => e.preventDefault(), { passive: false });
});

document.addEventListener('selectstart', e => {
  if (e.target.closest?.('.touch-controls')) e.preventDefault();
});

fetch('xenia-data.json').then(r => r.json()).then(json => {
  data = json;
  calcBounds();
  buildRoadSegments();
  setupUI();
  setStation(data.stations[0].id);
  requestAnimationFrame(draw);
  requestAnimationFrame(loop);
});
