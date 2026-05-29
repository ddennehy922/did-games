# Xenia Streets Trainer Web Prototype

This is a rescued playable prototype for the Xenia driver-training idea. It runs in a normal browser, uses the imported Xenia road data, and gives Derek something testable immediately before returning to a heavier Unity build.

## Run locally

From this repository root:

```bash
cd xenia-fire-trainer-web
python3 -m http.server 8090
```

Then open:

```text
http://127.0.0.1:8090/
```

## Controls

- WASD / Arrow keys: drive
- Space: brake
- N: new dispatch
- G: toggle GPS guide
- R: reset to selected station

Mobile/tablet touch controls are included for basic testing.

## Current scope

- Expanded real Xenia road network from OpenStreetMap via `map-pipeline/xenia-oh/raw/xenia-osm-roads-expanded.osm.json` and `map-pipeline/xenia-oh/converted/roads.json`
- Start screen with Guided Dispatch, Street Memory, and Free Drive modes
- Fire Station 31/32 start buttons
- Apparatus selection with an improved ambulance and heavier fire engine
- Expanded dispatch destination coverage across more of Xenia using the imported road network
- Fuller street coverage: 1,600+ road segments including additional residential roads, highways, ramps, unclassified roads, and named service roads
- Random dispatch destinations
- Arrival detection, timer, simple score, completed runs, grades, and best time
- GPS guide toggle for learning vs. memory testing
- Street-follow assist that gently keeps the vehicle close to the imported Xenia road centerlines
- Intersection road assist now favors the current road and vehicle heading, so driving straight past a side street is less likely to pull the vehicle onto the wrong road
- Close / Wide / City view modes for seeing more of the map when needed
- Low-speed turning and reverse maneuvering tuned so vehicles can turn around at dead ends instead of being forced straight by road assist
- Map and minimap render north-up so North Detroit appears above downtown and South Detroit appears below it
- Dispatch destinations are generated directly from named road centerlines, with `On [road name]` text matching the actual target road
- Fire station and dispatch markers are snapped onto matching road centerlines so calls do not appear off-road
- Fire station and lat/lon dispatch coordinates are projected north-up to match the corrected road orientation
- Major streets such as North/South Detroit, East/West Main, Second, Columbus, and Church are drawn with a dedicated highlighted overlay and higher-priority labels so they do not disappear under the dense residential street layer
- Minimap and street labels near the vehicle
- Fire Engine now has a more detailed apparatus visual: longer body, cab, grille, pump panel, ladder rails, wheels, stripe, and flashing lights
- Distinct ambulance handling: quicker acceleration, tighter turning, cleaner EMS-style visual
- Improved fire-engine handling: more power, stable heavy turning, strong brakes, and better apparatus feel

## Why this exists

The Unity project currently exists, but the useful gameplay scripts/data were mostly still in scaffold form. This web version proves the core training loop first: choose station → receive dispatch → drive real Xenia streets → arrive → score → repeat.
