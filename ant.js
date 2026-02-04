// Ant Game Prototype (p5.js)
// 1200x800, food as blobs, weak search pheromone + strong return pheromone

let W = 1200, H = 800;

// --- Simulation grid (smaller than screen for speed) ---
const gridScale = 2;                 // 2 => grid is 600x400
let gw, gh, gSize;
let foodPhero, homePhero, tmpA, tmpB;

// --- Gameplay tuning ---
let ants = [];
let maxAnts = 10;                    // player starts with 10
let startAnts = 10;
let nestFood = 0;

const nest = { x: W / 2, y: H / 2, r: 16 };

const sensorOffset = 18;             // pixels ahead to sample
const sensorAngle = 28;              // degrees left/right
const pickupDist = 10;
const depositDist = 18;

// Pheromone behavior
let eraseRate = 0.02;                // slider
let followRate = 1.0;                // slider

const diffusion = 0.15;              // how "blurry" pheromones spread (0..1)
const seedHomeStrength = 2.0;        // always seed nest with home pheromone
const searchDeposit = 0.08;          // ants deposit home pheromone while searching (small)
const returnDeposit = 1.2;           // ants deposit food pheromone while returning (strong)
const noiseTurn = 6;                 // random wobble in degrees (exploration)

// Spawning economy
const spawnCost = 5;                 // food required to spawn one ant
const spawnCooldownMs = 2500;
let lastSpawnAt = -1e9;

// Food blobs
let foods = [];
const foodBlobCount = 35;
const foodMinR = 18;
const foodMaxR = 50;

// --- UI ---
let eraseSlider, followSlider, upgradeBtn;
let infoP;

// --- Rendering pheromone ---
let fieldImg; // p5.Image (gw x gh)

function setup() {
    createCanvas(W, H);
    angleMode(DEGREES);
    pixelDensity(1);

    // Grid init
    gw = Math.floor(W / gridScale);
    gh = Math.floor(H / gridScale);
    gSize = gw * gh;
    foodPhero = new Float32Array(gSize);
    homePhero = new Float32Array(gSize);
    tmpA = new Float32Array(gSize);
    tmpB = new Float32Array(gSize);
    fieldImg = createImage(gw, gh);

    // Ants
    ants.length = 0;
    for (let i = 0; i < startAnts; i++) ants.push(makeAnt());

    // Food blobs
    initFood();

    // UI
    createUI();
}

function draw() {
    // Read UI
    eraseRate = eraseSlider.value();
    followRate = followSlider.value();

    // 1) seed nest "home pheromone" so returning ants can find home
    addPheroAt(homePhero, nest.x, nest.y, seedHomeStrength);

    // 2) diffuse + evaporate
    diffuseAndEvaporate(foodPhero, tmpA, eraseRate, diffusion);
    diffuseAndEvaporate(homePhero, tmpB, eraseRate, diffusion);

    // 3) ants update
    for (let step = 0; step < 2; step++) {  // 2 substeps for smoother motion
        for (const a of ants) {
            steerAnt(a);
            moveAnt(a);
            interactAnt(a);
            depositAnt(a);
        }
    }

    // 4) food regen
    regenFood();

    // 5) spawning
    trySpawn();

    // 6) render fields + entities
    renderFields();
    renderFood();
    renderNest();
    renderAnts();
    renderHUD();
}

function createUI() {
    const uiY = 10;

    createDiv("eraseRate (evaporation)").position(10, uiY).style("color", "white");
    eraseSlider = createSlider(0.002, 0.08, eraseRate, 0.001);
    eraseSlider.position(10, uiY + 22);
    eraseSlider.style("width", "220px");

    createDiv("followRate (steering strength)").position(10, uiY + 50).style("color", "white");
    followSlider = createSlider(0.2, 2.5, followRate, 0.01);
    followSlider.position(10, uiY + 72);
    followSlider.style("width", "220px");

    upgradeBtn = createButton("Upgrade: +5 max ants (cost scales)");
    upgradeBtn.position(10, uiY + 110);
    upgradeBtn.mousePressed(() => {
        const cost = upgradeCost();
        if (nestFood >= cost) {
            nestFood -= cost;
            maxAnts += 5;
        }
    });

    infoP = createP("").position(10, uiY + 140).style("color", "white");
}

function upgradeCost() {
    return 1;
    // cost grows as maxAnts grows
    // e.g. 10->15 costs 20, 15->20 costs 30, ...
    return 10 + Math.floor((maxAnts - 10) * 2);
}

function makeAnt() {
    return {
        x: nest.x + random(-5, 5),
        y: nest.y + random(-5, 5),
        angle: random(360),
        step: random(1.8, 2.6),
        state: "SEARCH",     // SEARCH or RETURN
        carrying: 0
    };
}

// -------------------- Fields helpers --------------------
function idxFromXY(x, y) {
    // x,y in screen pixels -> grid coords
    const gx = constrain((x / gridScale) | 0, 0, gw - 1);
    const gy = constrain((y / gridScale) | 0, 0, gh - 1);
    return gx + gy * gw;
}

function addPheroAt(field, x, y, amount) {
    field[idxFromXY(x, y)] += amount;
}

function sampleField(field, x, y) {
    return field[idxFromXY(x, y)];
}

function diffuseAndEvaporate(field, tmp, evap, diff) {
    // 4-neighbor diffusion into tmp, then swap into field
    // tmp reused; we write tmp then copy back into field
    for (let y = 0; y < gh; y++) {
        const row = y * gw;
        const yUp = (y === 0) ? row : (y - 1) * gw;
        const yDn = (y === gh - 1) ? row : (y + 1) * gw;

        for (let x = 0; x < gw; x++) {
            const i = row + x;
            const l = row + (x === 0 ? x : x - 1);
            const r = row + (x === gw - 1 ? x : x + 1);
            const u = yUp + x;
            const d = yDn + x;

            const center = field[i];
            const avgN = (field[l] + field[r] + field[u] + field[d]) * 0.25;

            // diffuse + evaporate
            let v = center * (1 - diff) + avgN * diff;
            v *= (1 - evap);

            // clamp
            tmp[i] = v < 0 ? 0 : v;
        }
    }
    field.set(tmp);
}

// -------------------- Food blobs --------------------
function initFood() {
    foods.length = 0;
    for (let i = 0; i < foodBlobCount; i++) {
        const r = random(foodMinR, foodMaxR);
        // keep away from nest a bit
        let x, y;
        for (let t = 0; t < 30; t++) {
            x = random(r, W - r);
            y = random(r, H - r);
            if (dist(x, y, nest.x, nest.y) > 120) break;
        }
        const maxAmount = Math.floor(random(30, 90));
        foods.push({
            x, y, r,
            amount: maxAmount,
            maxAmount,
            regenRate: 0, // per frame
        });
    }
}

function regenFood() {
    for (const f of foods) {
        if (f.amount < f.maxAmount) f.amount = min(f.maxAmount, f.amount + f.regenRate);
    }
}

// -------------------- Ant behavior --------------------
function steerAnt(a) {
    // sense 3 directions
    const aimC = a.angle;
    const aimL = a.angle - sensorAngle;
    const aimR = a.angle + sensorAngle;

    const sxC = a.x + sensorOffset * cos(aimC);
    const syC = a.y + sensorOffset * sin(aimC);
    const sxL = a.x + sensorOffset * cos(aimL);
    const syL = a.y + sensorOffset * sin(aimL);
    const sxR = a.x + sensorOffset * cos(aimR);
    const syR = a.y + sensorOffset * sin(aimR);

    // what to follow depends on state:
    // SEARCH: follow foodPhero (food trails), lightly avoid too-strong home
    // RETURN: follow homePhero (home trail)
    let vC, vL, vR;

    if (a.state === "SEARCH") {
        vC = sampleField(foodPhero, sxC, syC) - 0.25 * sampleField(homePhero, sxC, syC);
        vL = sampleField(foodPhero, sxL, syL) - 0.25 * sampleField(homePhero, sxL, syL);
        vR = sampleField(foodPhero, sxR, syR) - 0.25 * sampleField(homePhero, sxR, syR);
    } else {
        vC = sampleField(homePhero, sxC, syC);
        vL = sampleField(homePhero, sxL, syL);
        vR = sampleField(homePhero, sxR, syR);
    }

    // convert to a turn: choose the best direction but scale by followRate
    let turn = 0;
    if (vC >= vL && vC >= vR) {
        turn = 0;
    } else if (vL > vR) {
        turn = -sensorAngle;
    } else if (vR > vL) {
        turn = sensorAngle;
    } else {
        turn = random([-sensorAngle, sensorAngle]);
    }

    // add exploration noise
    turn += random(-noiseTurn, noiseTurn);

    // apply follow strength
    a.angle += turn * followRate;
}

function moveAnt(a) {
    a.x += cos(a.angle) * a.step;
    a.y += sin(a.angle) * a.step;

    // wrap
    if (a.x < 0) a.x += W;
    if (a.x >= W) a.x -= W;
    if (a.y < 0) a.y += H;
    if (a.y >= H) a.y -= H;
}

function interactAnt(a) {
    if (a.state === "SEARCH") {
        // pick up from nearest blob if close enough
        for (const f of foods) {
            if (f.amount <= 0.01) continue;
            const d = dist(a.x, a.y, f.x, f.y);
            if (d < min(f.r, pickupDist)) {
                f.amount = max(0, f.amount - 1);
                a.carrying = 1;
                a.state = "RETURN";
                // bias angle roughly toward nest
                a.angle = atan2(nest.y - a.y, nest.x - a.x);
                return;
            }
        }
    } else {
        // RETURN: deposit at nest
        if (dist(a.x, a.y, nest.x, nest.y) < depositDist) {
            nestFood += a.carrying;
            a.carrying = 0;
            a.state = "SEARCH";
            a.angle = random(360);
        }
    }
}

function depositAnt(a) {
    // ants always deposit something:
    // SEARCH: tiny home pheromone
    // RETURN: strong food pheromone (marks path to food)
    if (a.state === "SEARCH") {
        addPheroAt(homePhero, a.x, a.y, searchDeposit);
    } else {
        addPheroAt(foodPhero, a.x, a.y, returnDeposit);
    }
}

// -------------------- Spawning --------------------
function trySpawn() {
    if (ants.length >= maxAnts) return;
    if (nestFood < spawnCost) return;
    if (millis() - lastSpawnAt < spawnCooldownMs) return;

    nestFood -= spawnCost;
    ants.push(makeAnt());
    lastSpawnAt = millis();
}

// -------------------- Rendering --------------------
function renderFields() {
    fieldImg.loadPixels();

    // Map pheromones to colors (simple and readable):
    // - foodPhero -> cyan-ish
    // - homePhero -> yellow-ish
    // clamp to avoid blowing out
    const foodGain = 18;
    const homeGain = 18;

    for (let i = 0; i < gSize; i++) {
        const fp = Math.min(255, foodPhero[i] * foodGain);
        const hp = Math.min(255, homePhero[i] * homeGain);

        const p = i * 4;
        // R, G, B
        fieldImg.pixels[p + 0] = hp;                 // red from home
        fieldImg.pixels[p + 1] = (hp + fp) * 0.6;    // green mix
        fieldImg.pixels[p + 2] = fp;                 // blue from food
        fieldImg.pixels[p + 3] = 255;
    }

    fieldImg.updatePixels();
    image(fieldImg, 0, 0, W, H);
}

function renderFood() {
    noStroke();
    for (const f of foods) {
        // brightness based on amount
        const t = f.amount / f.maxAmount;
        fill(255 * t, 180 * t, 80 * t, 220);
        circle(f.x, f.y, f.r * 2);

        // small core
        fill(255 * t, 240 * t, 180 * t, 240);
        circle(f.x, f.y, f.r * 0.6);
    }
}

function renderNest() {
    noStroke();
    fill(255, 80, 80, 230);
    circle(nest.x, nest.y, nest.r * 2);
    fill(255, 180, 180, 230);
    circle(nest.x, nest.y, nest.r * 0.8);
}

function renderAnts() {
    strokeWeight(2);
    for (const a of ants) {
        if (a.state === "SEARCH") stroke(255, 255, 255, 220);
        else stroke(120, 255, 255, 220);
        point(a.x, a.y);
    }
}

function renderHUD() {
    const cost = upgradeCost();
    infoP.html(
        `ants: ${ants.length} / ${maxAnts}<br>` +
        `nestFood: ${nestFood.toFixed(0)}<br>` +
        `spawn cost: ${spawnCost} (cooldown ${(spawnCooldownMs / 1000).toFixed(1)}s)<br>` +
        `upgrade cost: ${cost}`
    );
}
