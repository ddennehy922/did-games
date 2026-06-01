# Skyline Drone Rally Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a new original mobile-first browser arcade game where players fly a delivery drone through city gates, collect batteries, dodge hazards, and chase a high score.

**Architecture:** Add one self-contained static game at `skyline-drone-rally/index.html` using Canvas 2D, inline CSS, and vanilla JavaScript so Netlify can serve it without a build step. Update the home page to add a live game card, hero link, thumbnail style, and live-game count. Keep persistence limited to `localStorage` high score.

**Tech Stack:** HTML5, CSS3, Canvas 2D, vanilla JavaScript, localStorage, static Netlify hosting.

---

### Task 1: Create the game shell

**Objective:** Add the new game route with mobile-safe layout, canvas, HUD, start overlay, and touch controls.

**Files:**
- Create: `skyline-drone-rally/index.html`

**Step 1: Write failing test**

Create a quick route check command that should fail before the file exists:

```bash
test -f skyline-drone-rally/index.html
```

**Step 2: Run test to verify failure**

Run: `test -f skyline-drone-rally/index.html`
Expected: FAIL — shell exits with status `1` because the file does not exist.

**Step 3: Write minimal implementation**

Create `skyline-drone-rally/index.html` with a complete HTML document containing:

```html
<a class="home" href="../">← Arcade</a>
<canvas id="game" width="900" height="1600"></canvas>
<button id="startBtn" type="button">Start Rally</button>
```

Then expand it with the full game implementation in Task 2.

**Step 4: Run test to verify pass**

Run: `test -f skyline-drone-rally/index.html`
Expected: PASS — shell exits with status `0`.

**Step 5: Commit**

```bash
git add skyline-drone-rally/index.html
git commit -m "feat: add skyline drone rally shell"
```

### Task 2: Implement core rally gameplay

**Objective:** Make the game fun in the first 10 seconds with movement, gates, batteries, hazards, scoring, and game over.

**Files:**
- Modify: `skyline-drone-rally/index.html`

**Step 1: Write failing test**

Run a static feature check that fails until the game code includes the core systems:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('skyline-drone-rally/index.html').read_text()
for token in ['spawnGate', 'spawnBattery', 'spawnHazard', 'localStorage', 'requestAnimationFrame']:
    assert token in text, token
PY
```

**Step 2: Run test to verify failure**

Run the Python command above.
Expected: FAIL — missing at least one token.

**Step 3: Write minimal implementation**

Inside the page script, add:

```js
function spawnGate() { /* add a gate pair with a safe opening */ }
function spawnBattery() { /* add collectible energy boost */ }
function spawnHazard() { /* add blimp or signal tower obstacle */ }
function update(dt) { /* move drone, scroll objects, score gates */ }
function draw() { /* render city, drone, gates, batteries, hazards */ }
requestAnimationFrame(loop);
```

Use pointer/touch drag plus keyboard controls. End the run when energy reaches zero or the drone hits a hazard/gate.

**Step 4: Run test to verify pass**

Run the Python static feature check again.
Expected: PASS.

**Step 5: Commit**

```bash
git add skyline-drone-rally/index.html
git commit -m "feat: implement skyline drone rally gameplay"
```

### Task 3: Add mobile polish and replayability

**Objective:** Add high score persistence, speed ramp, combo scoring, power-up feedback, responsive HUD, and clear instructions.

**Files:**
- Modify: `skyline-drone-rally/index.html`

**Step 1: Write failing test**

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('skyline-drone-rally/index.html').read_text()
for token in ['Best', 'Combo', 'Energy', 'Skyline Drone Rally', 'did-skyline-drone-rally-high']:
    assert token in text, token
PY
```

**Step 2: Run test to verify failure**

Run the Python command above.
Expected: FAIL until all labels and storage key exist.

**Step 3: Write minimal implementation**

Add HUD labels for Score, Best, Combo, and Energy. Store best score with:

```js
const BEST_KEY = 'did-skyline-drone-rally-high';
localStorage.setItem(BEST_KEY, String(best));
```

Add CSS media queries to keep buttons readable on phones.

**Step 4: Run test to verify pass**

Run the Python check again.
Expected: PASS.

**Step 5: Commit**

```bash
git add skyline-drone-rally/index.html
git commit -m "feat: polish skyline drone rally replay loop"
```

### Task 4: Update the landing page

**Objective:** Link the new game from the home page and add a distinct CSS poster thumbnail.

**Files:**
- Modify: `index.html`

**Step 1: Write failing test**

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('index.html').read_text()
assert 'skyline-drone-rally/' in text
assert 'Six playable prototypes' in text
assert 'thumb skyline' in text
PY
```

**Step 2: Run test to verify failure**

Run the Python command above.
Expected: FAIL until the home page is updated.

**Step 3: Write minimal implementation**

Update `index.html`:

```html
<a class="pill" href="skyline-drone-rally/">Fly Drone Rally</a>
<p>Six playable prototypes are live now. Each card links straight into the game folder on Netlify.</p>
<a class="game-card" href="skyline-drone-rally/" aria-label="Play Skyline Drone Rally">
  <div class="thumb skyline"><span class="rally-road"></span><span class="rally-drone"></span><span class="rally-gate"></span></div>
  <div class="game-info">
    <div class="tag-row"><span class="tag">Drone Racing</span><span class="tag">High Score</span></div>
    <h3>Skyline Drone Rally</h3>
    <p>Thread neon city gates, collect batteries, dodge tower hazards, and build combos before energy runs out.</p>
    <span class="control-note">Drag/touch steering plus WASD/arrow keys</span>
    <div class="play-line"><span>Play game</span><span>→</span></div>
  </div>
</a>
```

Add `.thumb.skyline`, `.rally-road`, `.rally-drone`, and `.rally-gate` CSS near the other thumbnail styles.

**Step 4: Run test to verify pass**

Run the Python check again.
Expected: PASS.

**Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add skyline drone rally to arcade"
```

### Task 5: Verify static site behavior

**Objective:** Confirm the JavaScript parses, internal links exist, and pages load through a local HTTP server.

**Files:**
- Test: `index.html`
- Test: `skyline-drone-rally/index.html`

**Step 1: Verify JavaScript syntax**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
import re, subprocess, tempfile
for file in ['index.html', 'skyline-drone-rally/index.html']:
    text = Path(file).read_text()
    for i, script in enumerate(re.findall(r'<script[^>]*>(.*?)</script>', text, re.S), 1):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
            f.write(script)
            name = f.name
        subprocess.check_call(['node', '--check', name])
        print(file, 'inline script', i, 'OK')
PY
```

Expected: PASS — every inline script reports OK.

**Step 2: Verify links**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
for href in ['drone-defender/', 'wardrobe-winter/', 'stormfall/', 'prince-castpeun/', 'xenia-fire-trainer/', 'skyline-drone-rally/']:
    assert Path(href, 'index.html').exists(), href
print('all game links exist')
PY
```

Expected: PASS — all game folders include `index.html`.

**Step 3: Verify local HTTP loading**

Run:

```bash
python3 -m http.server 4173
curl -I http://127.0.0.1:4173/
curl -I http://127.0.0.1:4173/skyline-drone-rally/
```

Expected: both `curl` commands return `HTTP/1.0 200 OK`.

**Step 4: Commit or amend verification fixes**

If verification required fixes:

```bash
git add index.html skyline-drone-rally/index.html
git commit -m "fix: verify skyline drone rally static site"
```
