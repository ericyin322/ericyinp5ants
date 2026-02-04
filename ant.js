// Ant War - Multi-Colony RTS
// 1200x800, 3 Races, 4 Pheromone Channels

// --- Configuration & Constants ---
const W = 1200, H = 800;
const GRID_SCALE = 2;
const GW = W / GRID_SCALE;
const GH = H / GRID_SCALE;
const G_SIZE = GW * GH;

// Pheromone Channels
const P_HOME = 0;
const P_HARVEST = 1;
const P_ATTACK = 2;
const P_DANGER = 3;

// Race Definitions
const RACES = {
    VARIEGATUS: {
        name: "C. Variegatus",
        color: [255, 200, 100], // Orange-ish
        stats: {
            speed: 1.0,
            hp: 10,
            carry: 2, // Carries more
            sensorRange: 22, // Sees further
            spawnRate: 1.0,
            lifespan: 1.0
        }
    },
    IRRITANS: {
        name: "C. Irritans",
        color: [100, 255, 100], // Green-ish
        stats: {
            speed: 1.3, // Fast
            hp: 8,
            carry: 1,
            sensorRange: 18,
            spawnRate: 1.2, // Spawns faster
            lifespan: 0.9
        }
    },
    HABERERI: {
        name: "C. Habereri",
        color: [100, 200, 255], // Blue-ish
        stats: {
            speed: 0.9,
            hp: 15, // Tough
            carry: 1,
            sensorRange: 18,
            spawnRate: 0.8,
            lifespan: 1.5 // Lives longer
        }
    }
};

let game;

function setup() {
    createCanvas(W, H);
    angleMode(DEGREES);
    pixelDensity(1);
    game = new Game();
}

function draw() {
    game.update();
    game.draw();
}

// --- Main Game Engine ---
class Game {
    constructor() {
        this.colonies = [];
        this.foods = [];
        this.fieldImage = createImage(GW, GH);

        // Initialize Colonies
        // Player is Colony 0 (Variegatus)
        this.colonies.push(new Colony(RACES.VARIEGATUS, 200, 200, 0));
        this.colonies[0].isPlayer = true;

        this.colonies.push(new Colony(RACES.IRRITANS, 1000, 200, 1));
        this.colonies.push(new Colony(RACES.HABERERI, 600, 700, 2));

        // Initialize Food
        this.spawnFood(50);

        // UI
        this.setupUI();
    }

    setupUI() {
        this.uiDiv = createDiv('').position(10, 10).style('color', 'white').style('font-family', 'monospace');

        const btnContainer = createDiv('').position(10, H - 60);

        this.btnSpawnWorker = createButton('Spawn Worker (10 Food)').parent(btnContainer);
        this.btnSpawnWorker.mousePressed(() => this.colonies[0].manualSpawn('WORKER'));

        this.btnSpawnArmy = createButton('Spawn Army (20 Food)').parent(btnContainer);
        this.btnSpawnArmy.mousePressed(() => this.colonies[0].manualSpawn('ARMY'));

        this.btnUpgradeCarry = createButton('Upgrade Carry (100 Food)').parent(btnContainer);
        this.btnUpgradeCarry.mousePressed(() => this.colonies[0].upgrade('CARRY'));

        this.btnUpgradeSpawn = createButton('Upgrade Spawn Rate (150 Food)').parent(btnContainer);
        this.btnUpgradeSpawn.mousePressed(() => this.colonies[0].upgrade('SPAWN'));
    }

    updateUI() {
        const pc = this.colonies[0];
        this.uiDiv.html(
            `<h3>${pc.race.name} (Player)</h3>` +
            `Food: ${Math.floor(pc.foodStock)}<br>` +
            `Workers: ${pc.ants.filter(a => a.role === 'WORKER').length}<br>` +
            `Army: ${pc.ants.filter(a => a.role === 'ARMY').length}<br>` +
            `Carry Cap: ${pc.race.stats.carry}<br>` +
            `Spawn Rate: ${pc.race.stats.spawnRate.toFixed(1)}<br>`
        );

        // Dynamic disable/enable buttons based on food
        if (pc.foodStock < 10) this.btnSpawnWorker.attribute('disabled', '');
        else this.btnSpawnWorker.removeAttribute('disabled');

        if (pc.foodStock < 20) this.btnSpawnArmy.attribute('disabled', '');
        else this.btnSpawnArmy.removeAttribute('disabled');

        if (pc.foodStock < 100) this.btnUpgradeCarry.attribute('disabled', '');
        else this.btnUpgradeCarry.removeAttribute('disabled');

        if (pc.foodStock < 150) this.btnUpgradeSpawn.attribute('disabled', '');
        else this.btnUpgradeSpawn.removeAttribute('disabled');
    }

    spawnFood(count) {
        for (let i = 0; i < count; i++) {
            this.foods.push(new Food());
        }
    }

    update() {
        // Update Colonies
        for (let c of this.colonies) {
            c.update();
        }

        // Food Regen
        for (let f of this.foods) {
            f.update();
        }

        this.updateUI();
    }

    draw() {
        background(20);

        // Render Pheromones (Composite of all colonies? Or just one debug?)
        // For gameplay, maybe separate layers or mixed?
        // Let's implement a "Scent View" mode later. For now, render territories.
        this.renderPheromones();

        // Render Food
        noStroke();
        for (let f of this.foods) f.draw();

        // Render Colonies
        for (let c of this.colonies) c.draw();
    }

    renderPheromones() {
        // Simple visualization: Color pixels based on dominant colony pheromone
        // This is expensive per frame! Let's do it every 4 frames or optimized.
        // For now, let's just clear background and let trails be drawn by dots or standard p5 image ops.
        // Actually, the pixel manipulation IS the fast way for fields.

        this.fieldImage.loadPixels();
        const d = this.fieldImage.pixels;

        // Decay/Diffuse steps are done in Colony.update()
        // Here we just visualize.
        // Let's visualize "Home" + "Harvest" combined for all colonies.

        for (let i = 0; i < G_SIZE; i++) {
            let r = 0, g = 0, b = 0;

            for (let c of this.colonies) {
                // Add colony color scaled by pheromone intensity
                // Focusing on HARVEST (trail) and HOME (territory)
                const home = c.grids[P_HOME][i];
                const harvest = c.grids[P_HARVEST][i];
                const attack = c.grids[P_ATTACK][i];

                const intensity = (home * 0.5 + harvest * 1.5 + attack * 2.0);
                if (intensity > 0.01) {
                    r += c.race.color[0] * intensity;
                    g += c.race.color[1] * intensity;
                    b += c.race.color[2] * intensity;
                }
            }

            const idx = i * 4;
            d[idx] = Math.min(255, r);
            d[idx + 1] = Math.min(255, g);
            d[idx + 2] = Math.min(255, b);
            d[idx + 3] = 255; // Alpha
        }

        this.fieldImage.updatePixels();
        image(this.fieldImage, 0, 0, W, H);
    }
}

// --- Colony Class ---
class Colony {
    constructor(race, x, y, id) {
        this.race = race;
        this.home = createVector(x, y);
        this.id = id;
        this.ants = [];
        this.foodStock = 100; // Starting food
        this.brood = 0;
        this.isPlayer = false;

        // Pheromone Grids: 4 channels
        // 0: HOME, 1: HARVEST, 2: ATTACK, 3: DANGER
        this.grids = [
            new Float32Array(G_SIZE),
            new Float32Array(G_SIZE),
            new Float32Array(G_SIZE),
            new Float32Array(G_SIZE)
        ];
        // Temp grids for diffusion
        this.tmpGrids = [
            new Float32Array(G_SIZE),
            new Float32Array(G_SIZE),
            new Float32Array(G_SIZE),
            new Float32Array(G_SIZE)
        ];

        // Spawn initial ants
        for (let i = 0; i < 10; i++) {
            this.spawnAnt('WORKER');
        }
    }

    spawnAnt(role) {
        if (role === 'WORKER') {
            this.ants.push(new WorkerAnt(this, this.home.x, this.home.y));
        } else {
            this.ants.push(new ArmyAnt(this, this.home.x, this.home.y));
        }
    }

    manualSpawn(role) {
        const cost = role === 'WORKER' ? 10 : 20;
        if (this.foodStock >= cost) {
            this.foodStock -= cost;
            this.spawnAnt(role);
        }
    }

    upgrade(type) {
        if (type === 'CARRY' && this.foodStock >= 100) {
            this.foodStock -= 100;
            this.race.stats.carry += 1;
        } else if (type === 'SPAWN' && this.foodStock >= 150) {
            this.foodStock -= 150;
            this.race.stats.spawnRate *= 1.2; // 20% increase
        }
    }

    update() {
        // AI Logic for Non-Player Colonies
        if (!this.isPlayer) {
            if (this.foodStock >= 10 && this.ants.length < 50) {
                if (random() < 0.05 * this.race.stats.spawnRate) {
                    this.foodStock -= 10;
                    this.spawnAnt(random() < 0.8 ? 'WORKER' : 'ARMY');
                }
            }
        }

        // Pheromone Physics (Diffuse & Evaporate)
        // Tuning per channel
        this.processGrid(P_HOME, 0.999, 0.2); // Lasts long, diffuses well
        this.processGrid(P_HARVEST, 0.98, 0.1); // Evaporates medium
        this.processGrid(P_ATTACK, 0.95, 0.1); // Evaporates fast
        this.processGrid(P_DANGER, 0.90, 0.4); // Evaporates very fast

        // Seed Home Pheromone
        this.deposit(P_HOME, this.home.x, this.home.y, 10.0);

        // Update Ants
        for (let ant of this.ants) {
            ant.update();
        }
    }

    draw() {
        // Draw Nest
        fill(this.race.color);
        stroke(255);
        strokeWeight(2);
        circle(this.home.x, this.home.y, 30);

        // Draw Ants
        for (let ant of this.ants) {
            ant.draw();
        }
    }

    // --- Pheromone Utils ---
    processGrid(ch, decay, diffusion) {
        const grid = this.grids[ch];
        const tmp = this.tmpGrids[ch];

        // Simple 4-neighbor diffusion
        for (let y = 1; y < GH - 1; y++) {
            for (let x = 1; x < GW - 1; x++) {
                const i = x + y * GW;
                const sum = grid[i - 1] + grid[i + 1] + grid[i - GW] + grid[i + GW];
                let val = (grid[i] + sum * diffusion) / (1 + 4 * diffusion);
                val *= decay;
                if (val < 0.001) val = 0;
                tmp[i] = val;
            }
        }
        // Swap arrays
        this.grids[ch] = tmp;
        this.tmpGrids[ch] = grid;
    }

    deposit(ch, x, y, amt) {
        const gx = Math.floor(x / GRID_SCALE);
        const gy = Math.floor(y / GRID_SCALE);
        if (gx >= 0 && gx < GW && gy >= 0 && gy < GH) {
            this.grids[ch][gx + gy * GW] += amt;
        }
    }

    sample(ch, x, y) {
        const gx = Math.floor(x / GRID_SCALE);
        const gy = Math.floor(y / GRID_SCALE);
        if (gx >= 0 && gx < GW && gy >= 0 && gy < GH) {
            return this.grids[ch][gx + gy * GW];
        }
        return 0;
    }
}

// --- Ant Classes ---
class BaseAnt {
    constructor(colony, x, y) {
        this.colony = colony;
        this.pos = createVector(x, y);
        this.angle = random(360);
        this.state = 'IDLE'; // IDLE, WORK, RETURN, FIGHT
        this.hp = colony.race.stats.hp;
        this.maxHp = colony.race.stats.hp;
        this.age = 0;

        // Movement
        this.vel = p5.Vector.fromAngle(radians(this.angle));
        this.wanderStrength = 5;
        this.steerStrength = 0.2;
    }

    update() {
        this.behavior();
        this.move();
        this.borders();
        this.age++;
    }

    move() {
        this.vel.setHeading(radians(this.angle));
        this.vel.setMag(this.colony.race.stats.speed);
        this.pos.add(this.vel);
    }

    borders() {
        if (this.pos.x < 0 || this.pos.x > W) {
            this.angle = 180 - this.angle;
            this.pos.x = constrain(this.pos.x, 0, W);
        }
        if (this.pos.y < 0 || this.pos.y > H) {
            this.angle = 360 - this.angle;
            this.pos.y = constrain(this.pos.y, 0, H);
        }
    }

    draw() {
        // Base draw logic, override in child
        stroke(this.colony.race.color);
        strokeWeight(3);
        point(this.pos.x, this.pos.y);
    }

    // Sensors
    sense(channel) {
        const sensorDist = this.colony.race.stats.sensorRange;
        const sensorAngle = 30;

        const r = this.getSensorPos(sensorAngle, sensorDist, this.angle);
        const l = this.getSensorPos(-sensorAngle, sensorDist, this.angle);
        const f = this.getSensorPos(0, sensorDist, this.angle);

        const vR = this.colony.sample(channel, r.x, r.y);
        const vL = this.colony.sample(channel, l.x, l.y);
        const vF = this.colony.sample(channel, f.x, f.y);

        return { vL, vF, vR };
    }

    getSensorPos(angleOffset, distMs, heading) {
        return createVector(
            this.pos.x + cos(heading + angleOffset) * distMs,
            this.pos.y + sin(heading + angleOffset) * distMs
        );
    }

    steerTowards(readings) {
        const { vL, vF, vR } = readings;
        if (vF > vL && vF > vR) {
            // Keep straight
        } else if (vF < vL && vF < vR) {
            this.angle += random() < 0.5 ? -this.wanderStrength * 2 : this.wanderStrength * 2;
        } else if (vL > vR) {
            this.angle -= this.wanderStrength;
        } else if (vR > vL) {
            this.angle += this.wanderStrength;
        } else {
            this.angle += random(-this.wanderStrength, this.wanderStrength);
        }
    }
}

class WorkerAnt extends BaseAnt {
    constructor(colony, x, y) {
        super(colony, x, y);
        this.role = 'WORKER';
        this.carrying = 0;
        this.capacity = colony.race.stats.carry;
        this.state = 'FORAGE';
    }

    behavior() {
        if (this.state === 'FORAGE') {
            // 1. Follow HARVEST pheromone
            const readings = this.sense(P_HARVEST);
            this.steerTowards(readings);

            // 2. Deposit HOME pheromone (bread crumbs)
            this.colony.deposit(P_HOME, this.pos.x, this.pos.y, 0.2);

            // 3. Look for Food
            // (Naive check against all food for now - optimization needed later)
            for (let f of game.foods) {
                if (f.amount > 0 && p5.Vector.dist(this.pos, f.pos) < f.size) {
                    this.harvest(f);
                    break;
                }
            }
        } else if (this.state === 'RETURN') {
            // 1. Follow HOME pheromone
            const readings = this.sense(P_HOME);
            this.steerTowards(readings);

            // 2. Deposit HARVEST pheromone (I found food!)
            this.colony.deposit(P_HARVEST, this.pos.x, this.pos.y, 2.0);

            // 3. Check Nest
            if (p5.Vector.dist(this.pos, this.colony.home) < 20) {
                this.deliver();
            }
        }
    }

    harvest(food) {
        let take = Math.min(this.capacity * 5, food.amount); // Arbitrary scaling
        food.amount -= take;
        this.carrying = take;
        this.state = 'RETURN';
        this.angle += 180; // Turn around
    }

    deliver() {
        this.colony.foodStock += this.carrying;
        this.carrying = 0;
        this.state = 'FORAGE';
        this.angle += 180;
    }

    draw() {
        strokeWeight(this.carrying > 0 ? 5 : 2);
        stroke(this.colony.race.color);
        point(this.pos.x, this.pos.y);
    }
}

class ArmyAnt extends BaseAnt {
    constructor(colony, x, y) {
        super(colony, x, y);
        this.role = 'ARMY';
        this.state = 'PATROL';
        this.damage = 1;
    }

    behavior() {
        // Army Behavior: Patrol -> Chase -> Fight
        // For now, simpler: Follow ATTACK pheromone, or Patrol near HOME

        // 1. Follow ATTACK pheromone
        const readings = this.sense(P_ATTACK);
        // If no attack trail, follow Home loosely to stay near base
        if (readings.vL + readings.vF + readings.vR < 0.1) {
            const homeReadings = this.sense(P_HOME);
            this.steerTowards(homeReadings);
        } else {
            this.steerTowards(readings);
        }

        // 2. Look for Enemies
        // Simple radius check against ants of other colonies
        let enemy = this.findEnemy();
        if (enemy) {
            this.engage(enemy);
            // Drop DANGER/ATTACK pheromone
            this.colony.deposit(P_ATTACK, this.pos.x, this.pos.y, 2.0);
        }
    }

    findEnemy() {
        // Inefficient O(N*M), but functional for prototype
        for (let c of game.colonies) {
            if (c === this.colony) continue;
            for (let a of c.ants) {
                if (p5.Vector.dist(this.pos, a.pos) < this.colony.race.stats.sensorRange) {
                    return a;
                }
            }
        }
        return null;
    }

    engage(enemy) {
        // Move towards enemy
        let angleTo = degrees(Math.atan2(enemy.pos.y - this.pos.y, enemy.pos.x - this.pos.x));
        this.angle = angleTo; // Snap for now

        // Attack
        if (p5.Vector.dist(this.pos, enemy.pos) < 5) {
            enemy.hp -= this.damage;
            if (enemy.hp <= 0) {
                // Kill enemy
                // For now, removing is handled in colony update or needs a flag.
                // Let's set a flag on the ant
                enemy.dead = true;
            }
        }
    }

    draw() {
        strokeWeight(4);
        stroke(255, 50, 50); // Red highlight for army
        point(this.pos.x, this.pos.y);
        strokeWeight(2);
        stroke(this.colony.race.color);
        point(this.pos.x, this.pos.y);
    }
}

// --- Food Class ---
class Food {
    constructor() {
        this.pos = createVector(random(50, W - 50), random(50, H - 50));
        this.amount = random(200, 500);
        this.size = random(10, 20);
    }

    update() {
        if (this.amount <= 0) {
            this.pos = createVector(random(50, W - 50), random(50, H - 50));
            this.amount = random(200, 500);
        }
        this.size = map(this.amount, 0, 500, 5, 20);
    }

    draw() {
        fill(0, 255, 200, 150);
        circle(this.pos.x, this.pos.y, this.size * 2);
    }
}

// Ant cleanup helper in Colony
Colony.prototype.cleanup = function () {
    for (let i = this.ants.length - 1; i >= 0; i--) {
        if (this.ants[i].dead) {
            this.ants.splice(i, 1);
        }
    }
};

// Add cleanup to Colony update
const originalUpdate = Colony.prototype.update;
Colony.prototype.update = function () {
    originalUpdate.call(this);
    this.cleanup();
}
