import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const TIERS = {
  PRIMARY: 'Primary',
  SECONDARY: 'Secondary',
  TERTIARY: 'Tertiary'
};

const COLORS = [
  { id: 'red', label: 'Red', hex: 0xff2b2b, tier: TIERS.PRIMARY },
  { id: 'yellow', label: 'Yellow', hex: 0xffef00, tier: TIERS.PRIMARY },
  { id: 'blue', label: 'Blue', hex: 0x1548ff, tier: TIERS.PRIMARY },
  { id: 'orange', label: 'Orange', hex: 0xff8d00, tier: TIERS.SECONDARY },
  { id: 'green', label: 'Green', hex: 0x10c000, tier: TIERS.SECONDARY },
  { id: 'purple', label: 'Purple', hex: 0x9f27d9, tier: TIERS.SECONDARY },
  { id: 'red-orange', label: 'Red Orange', hex: 0xff5b1f, tier: TIERS.TERTIARY },
  { id: 'yellow-orange', label: 'Yellow Orange', hex: 0xffba00, tier: TIERS.TERTIARY },
  { id: 'yellow-green', label: 'Yellow Green', hex: 0x98e600, tier: TIERS.TERTIARY },
  { id: 'blue-green', label: 'Blue Green', hex: 0x0c9da5, tier: TIERS.TERTIARY },
  { id: 'blue-purple', label: 'Blue Purple', hex: 0x5f2dff, tier: TIERS.TERTIARY },
  { id: 'red-purple', label: 'Red Purple', hex: 0xcb1797, tier: TIERS.TERTIARY }
];

const MIX_RECIPES = new Map([
  ['red+yellow', 'orange'],
  ['blue+yellow', 'green'],
  ['blue+red', 'purple'],
  ['orange+red', 'red-orange'],
  ['orange+yellow', 'yellow-orange'],
  ['green+yellow', 'yellow-green'],
  ['blue+green', 'blue-green'],
  ['blue+purple', 'blue-purple'],
  ['purple+red', 'red-purple']
]);

const LEVELS = [
  {
    id: 1,
    label: 'Level 1 - Primary',
    tier: TIERS.PRIMARY,
    hardTime: 35,
    targetRadius: 0.34,
    bumperHeight: 0.36,
    targetLayout: 'fixed',
    obstacles: []
  },
  {
    id: 2,
    label: 'Level 2 - Mix Secondary',
    tier: TIERS.SECONDARY,
    hardTime: 55,
    targetRadius: 0.2,
    bumperHeight: 0.24,
    targetLayout: 'fixed',
    mixing: true,
    sourceTier: TIERS.PRIMARY,
    mixSourceTier: TIERS.PRIMARY,
    mixTargetTier: TIERS.PRIMARY,
    reusableMixPadTier: TIERS.PRIMARY,
    targetColorIds: ['red', 'yellow', 'blue', 'orange', 'green', 'purple'],
    hiddenUntilMixedTier: TIERS.SECONDARY,
    obstacles: []
  },
  {
    id: 3,
    label: 'Level 3 - Mix Tertiary',
    tier: TIERS.TERTIARY,
    hardTime: 65,
    targetRadius: 0.15,
    bumperHeight: 0.18,
    targetLayout: 'fixed',
    mixing: true,
    sourceTier: TIERS.PRIMARY,
    mixSourceTier: TIERS.PRIMARY,
    mixTargetTier: TIERS.SECONDARY,
    reusableMixPadTier: TIERS.SECONDARY,
    targetColorIds: ['orange', 'green', 'purple', 'red-orange', 'yellow-orange', 'yellow-green', 'blue-green', 'blue-purple', 'red-purple'],
    scoringColorIds: ['red-orange', 'yellow-orange', 'yellow-green', 'blue-green', 'blue-purple', 'red-purple'],
    hiddenUntilMixedTier: TIERS.TERTIARY,
    obstacles: []
  }
];

const MODE = {
  EASY: 'Easy',
  HARD: 'Hard'
};

const LAYOUT = {
  floorY: 0,
  ballRadius: 0.16,
  mixSpawnLift: 0.38,
  laneWidth: 2.28,
  laneLength: 8.8,
  laneStartZ: 1.0,
  laneEndZ: -7.8,
  releasePoint: new THREE.Vector3(0, 0.2, 0.78),
  returnOrigin: new THREE.Vector3(1.75, 0.33, 0.78),
  targetZ: -7.25,
  targetY: 0.28,
  targetHitPadding: 0.14
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgmTimer = null;
    this.rollTimer = null;
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
  }

  tone(freq, duration = 0.12, type = 'triangle', volume = 0.08, delay = 0) {
    this.ensure();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime + delay;

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(this.master);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  noise(duration = 0.12, volume = 0.08, filterFreq = 700) {
    this.ensure();
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  startBgm() {
    this.ensure();
    if (this.bgmTimer) return;

    const bass = [110, 110, 146.83, 164.81, 196, 164.81, 146.83, 110];
    const lead = [440, 554.37, 659.25, 880];
    let step = 0;

    this.bgmTimer = window.setInterval(() => {
      this.tone(bass[step % bass.length], 0.16, 'sawtooth', 0.035);
      if (step % 4 === 0) {
        this.tone(lead[(step / 4) % lead.length], 0.18, 'square', 0.025, 0.02);
      }
      step += 1;
    }, 210);
  }

  stopBgm() {
    if (!this.bgmTimer) return;
    window.clearInterval(this.bgmTimer);
    this.bgmTimer = null;
  }

  startRolling() {
    this.ensure();
    if (this.rollTimer) return;
    this.rollTimer = window.setInterval(() => {
      this.noise(0.055, 0.026, 260);
      this.tone(70 + Math.random() * 32, 0.04, 'triangle', 0.018);
    }, 130);
  }

  stopRolling() {
    if (!this.rollTimer) return;
    window.clearInterval(this.rollTimer);
    this.rollTimer = null;
  }

  pick() {
    this.tone(520, 0.06, 'square', 0.04);
  }

  launch() {
    this.tone(180, 0.08, 'triangle', 0.05);
    this.noise(0.08, 0.035, 420);
  }

  ping() {
    this.tone(1046.5, 0.18, 'triangle', 0.1);
    this.tone(1568, 0.16, 'sine', 0.055, 0.025);
  }

  wrong() {
    this.tone(105, 0.22, 'sawtooth', 0.09);
    this.noise(0.22, 0.09, 320);
  }

  bumper() {
    this.tone(210, 0.055, 'square', 0.045);
  }

  mix() {
    this.tone(392, 0.08, 'triangle', 0.06);
    this.tone(523.25, 0.11, 'square', 0.045, 0.06);
    this.tone(659.25, 0.13, 'triangle', 0.05, 0.13);
  }

  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
      this.tone(freq, 0.18, 'triangle', 0.09, index * 0.12);
    });
  }

  lose() {
    this.tone(92.5, 0.45, 'sawtooth', 0.1);
  }
}

class VRColorBowling {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x10121d);
    this.scene.fog = new THREE.Fog(0x10121d, 8, 18);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 60);
    this.camera.position.set(0, 1.65, 4.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    document.body.appendChild(this.renderer.domElement);
    document.body.appendChild(VRButton.createButton(this.renderer));

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.tempVec = new THREE.Vector3();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LAYOUT.floorY);
    this.audio = new AudioEngine();

    this.mode = MODE.EASY;
    this.currentLevelIndex = 0;
    this.unlockedLevel = 1;
    this.remainingTime = Infinity;
    this.levelRunning = false;
    this.score = 0;
    this.correctHits = 0;
    this.levelTransitionTimer = null;

    this.balls = [];
    this.targets = [];
    this.obstacles = [];
    this.particles = [];
    this.controllers = [];
    this.selectedBall = null;
    this.laneObjects = [];
    this.rouletteGroup = null;

    this.ui = {
      level: document.getElementById('levelLabel'),
      mode: document.getElementById('modeLabel'),
      timer: document.getElementById('timerLabel'),
      status: document.getElementById('statusLabel'),
      easyBtn: document.getElementById('easyBtn'),
      hardBtn: document.getElementById('hardBtn'),
      nextBtn: document.getElementById('nextBtn'),
      resetBtn: document.getElementById('resetBtn'),
      victoryOverlay: document.getElementById('victoryOverlay'),
      playAgainBtn: document.getElementById('playAgainBtn')
    };

    this.setupWorld();
    this.setupControllers();
    this.setupDesktopControls();
    this.bindUI();
    this.startLevel(1);

    window.addEventListener('resize', () => this.onResize());
    this.renderer.setAnimationLoop(() => this.animate());
  }

  setupWorld() {
    this.scene.add(new THREE.HemisphereLight(0x6fe7ff, 0x2b1f30, 1.05));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(2.5, 5, 2.5);
    this.scene.add(keyLight);

    const neonA = new THREE.PointLight(0xff2bd6, 1.7, 8);
    neonA.position.set(-2.6, 2.2, -2.2);
    this.scene.add(neonA);

    const neonB = new THREE.PointLight(0x34d7ff, 1.5, 8);
    neonB.position.set(2.7, 1.8, -5.5);
    this.scene.add(neonB);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(7.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x1f2232, roughness: 0.88, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI * 0.5;
    floor.position.set(0, LAYOUT.floorY - 0.018, -3.4);
    this.scene.add(floor);

    const lane = new THREE.Mesh(
      new THREE.BoxGeometry(LAYOUT.laneWidth, 0.08, LAYOUT.laneLength),
      new THREE.MeshStandardMaterial({ color: 0xc58b4a, roughness: 0.42, metalness: 0.05 })
    );
    lane.position.set(0, LAYOUT.floorY - 0.04, (LAYOUT.laneStartZ + LAYOUT.laneEndZ) * 0.5);
    this.scene.add(lane);
    this.laneObjects.push(lane);

    this.addLaneStripes();
    this.addBallReturn();
    this.addBackWall();
  }

  addLaneStripes() {
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfff0b8, transparent: true, opacity: 0.34 });
    [-0.38, 0, 0.38].forEach((x) => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, LAYOUT.laneLength - 0.5), stripeMat);
      stripe.position.set(x, LAYOUT.floorY + 0.012, -3.35);
      this.scene.add(stripe);
    });

    const foul = new THREE.Mesh(
      new THREE.BoxGeometry(LAYOUT.laneWidth, 0.014, 0.045),
      new THREE.MeshBasicMaterial({ color: 0xff4fd8 })
    );
    foul.position.set(0, LAYOUT.floorY + 0.018, 0.86);
    this.scene.add(foul);
  }

  addBallReturn() {
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x20242d, roughness: 0.55, metalness: 0.38 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x39e4ff, transparent: true, opacity: 0.45 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.18, 1.45), baseMat);
    base.position.set(1.77, 0.12, 0.48);
    this.scene.add(base);

    const railGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.35, 16);
    [-0.19, 0.19].forEach((x) => {
      const rail = new THREE.Mesh(railGeo, baseMat);
      rail.rotation.x = Math.PI * 0.5;
      rail.position.set(1.77 + x, 0.28, 0.48);
      this.scene.add(rail);
    });

    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.03, 0.12), glowMat);
    sign.position.set(1.77, 0.42, 1.12);
    this.scene.add(sign);
  }

  addBackWall() {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 1.6, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x171923, roughness: 0.7, metalness: 0.12 })
    );
    wall.position.set(0, 0.75, -7.75);
    this.scene.add(wall);

    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(3.15, 0.035, 0.035),
      new THREE.MeshBasicMaterial({ color: 0xff2bd6 })
    );
    glow.position.set(0, 1.5, -7.66);
    this.scene.add(glow);
  }

  setupDesktopControls() {
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(0, 0.45, -3.35);
    this.orbit.enableDamping = true;
    this.orbit.minDistance = 3;
    this.orbit.maxDistance = 9;
    this.orbit.maxPolarAngle = Math.PI * 0.48;
    this.orbit.update();

    this.renderer.domElement.addEventListener('pointerdown', (event) => this.onDesktopPointerDown(event));
    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'f') this.focusDesktopView();
      if (event.key === 'Escape') this.setSelectedBall(null);
    });
  }

  focusDesktopView() {
    if (this.renderer.xr.isPresenting) return;
    this.camera.position.set(0, 1.65, 4.2);
    this.camera.lookAt(0, 0.45, -3.35);
    if (this.orbit) {
      this.orbit.target.set(0, 0.45, -3.35);
      this.orbit.update();
    }
  }

  setupControllers() {
    for (let i = 0; i < 2; i += 1) {
      const controller = this.renderer.xr.getController(i);
      controller.userData.grabbed = null;
      controller.userData.history = [];

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1)
        ]),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.68 })
      );
      line.name = 'ray';
      line.scale.z = 4.5;
      controller.add(line);

      controller.addEventListener('selectstart', (event) => this.onSelectStart(controller, event));
      controller.addEventListener('selectend', (event) => this.onSelectEnd(controller, event));

      this.scene.add(controller);
      this.controllers.push(controller);
    }
  }

  bindUI() {
    this.ui.easyBtn.addEventListener('click', () => {
      this.mode = MODE.EASY;
      this.hideVictoryOverlay();
      this.startLevel(1);
    });

    this.ui.hardBtn.addEventListener('click', () => {
      this.mode = MODE.HARD;
      this.hideVictoryOverlay();
      this.startLevel(1);
    });

    this.ui.nextBtn.addEventListener('click', () => {
      const next = Math.min(this.currentLevelIndex + 2, 3);
      this.hideVictoryOverlay();
      this.startLevel(next);
    });

    this.ui.resetBtn.addEventListener('click', () => {
      this.unlockedLevel = 1;
      this.hideVictoryOverlay();
      this.startLevel(1);
      this.updateHud('Đã reset về Level 1.');
    });

    this.ui.playAgainBtn.addEventListener('click', () => {
      this.unlockedLevel = 1;
      this.hideVictoryOverlay();
      this.startLevel(1);
    });

    const unlockAudio = () => {
      this.audio.startBgm();
      window.removeEventListener('pointerdown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
  }

  startLevel(levelId) {
    this.cancelLevelTransition();

    if (levelId > this.unlockedLevel) {
      this.updateHud('Level chưa mở khóa.');
      return;
    }

    const cfg = LEVELS[levelId - 1];
    this.currentLevelIndex = levelId - 1;
    this.levelRunning = true;
    this.score = 0;
    this.correctHits = 0;
    this.remainingTime = this.mode === MODE.HARD ? cfg.hardTime : Infinity;

    this.setSelectedBall(null);
    this.hideVictoryOverlay();
    this.clearLevelObjects();
    this.buildBumpers(cfg);
    this.buildObstacles(cfg);
    this.buildTargets(cfg);
    this.spawnReturnBalls(cfg);
    this.focusDesktopView();

    const targetText = cfg.id === 3 ? 'bia xoay Roulette' : 'bia cố định';
    if (cfg.mixing) {
      if (cfg.mixTargetTier === TIERS.SECONDARY) {
        this.updateHud(`${cfg.label}: ném bóng Primary vào ô Secondary để tạo Tertiary, rồi ném bóng mới vào ô cùng màu.`);
      } else {
        this.updateHud(`${cfg.label}: ném bóng Primary vào ô Primary khác màu để tạo Secondary, rồi ném bóng mới vào ô cùng màu.`);
      }
    } else {
      this.updateHud(`${cfg.label}: ném bóng đúng màu vào ${targetText}.`);
    }
  }

  clearLevelObjects() {
    [...this.balls, ...this.targets, ...this.obstacles, ...this.particles].forEach((obj) => this.disposeObject(obj));
    this.balls = [];
    this.targets = [];
    this.obstacles = [];
    this.particles = [];

    if (this.bumperGroup) {
      this.scene.remove(this.bumperGroup);
      this.bumperGroup.traverse((child) => {
        if (child.isMesh) this.disposeMesh(child);
      });
      this.bumperGroup = null;
    }

    if (this.rouletteGroup) {
      this.scene.remove(this.rouletteGroup);
      this.rouletteGroup = null;
    }

    this.audio.stopRolling();
  }

  disposeObject(obj) {
    if (!obj) return;
    if (obj.parent) {
      obj.parent.remove(obj);
    } else {
      this.scene.remove(obj);
    }
    obj.traverse((child) => {
      if (child.isMesh || child.isPoints) this.disposeMesh(child);
    });
  }

  disposeMesh(mesh) {
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  }

  buildBumpers(cfg) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x31394a,
      roughness: 0.5,
      metalness: 0.35,
      emissive: 0x101626
    });

    [-1, 1].forEach((side) => {
      const bumper = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, cfg.bumperHeight, LAYOUT.laneLength),
        mat.clone()
      );
      bumper.position.set(
        side * (LAYOUT.laneWidth * 0.5 + 0.08),
        LAYOUT.floorY + cfg.bumperHeight * 0.5,
        (LAYOUT.laneStartZ + LAYOUT.laneEndZ) * 0.5
      );
      bumper.userData.side = side;
      group.add(bumper);
    });

    this.scene.add(group);
    this.bumperGroup = group;
  }

  buildObstacles(cfg) {
    cfg.obstacles.forEach((item) => {
      const obstacle = new THREE.Mesh(
        new THREE.CylinderGeometry(item.radius, item.radius, 0.68, 28),
        new THREE.MeshStandardMaterial({
          color: 0x232936,
          roughness: 0.45,
          metalness: 0.35,
          emissive: 0x25104a
        })
      );
      obstacle.position.set(item.x, LAYOUT.floorY + 0.34, item.z);
      obstacle.userData.radius = item.radius;
      this.scene.add(obstacle);
      this.obstacles.push(obstacle);
    });
  }

  buildTargets(cfg) {
    const colors = this.getLevelTargetColors(cfg);
    const parent = cfg.targetLayout === 'roulette' ? new THREE.Group() : this.scene;

    if (cfg.targetLayout === 'roulette') {
      parent.position.set(0, 0.72, LAYOUT.targetZ);
      this.scene.add(parent);
      this.rouletteGroup = parent;
    }

    colors.forEach((color, index) => {
      const target = this.createTarget(color, cfg.targetRadius);
      target.userData.hiddenUntilMixed = cfg.hiddenUntilMixedTier === color.tier;
      target.visible = !target.userData.hiddenUntilMixed;

      if (cfg.targetLayout === 'roulette') {
        const angle = (index / colors.length) * Math.PI * 2;
        target.position.set(Math.cos(angle) * 0.72, Math.sin(angle) * 0.44, 0);
        target.userData.localOffset = target.position.clone();
        parent.add(target);
      } else {
        const position = this.getFixedTargetPosition(index, colors.length);
        target.position.set(position.x, position.y, LAYOUT.targetZ);
        parent.add(target);
      }

      this.targets.push(target);
    });
  }

  createTarget(color, radius) {
    const group = new THREE.Group();

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.035, 14, 38),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.22,
        metalness: 0.2,
        emissive: 0x101010
      })
    );
    group.add(ring);

    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.86, radius * 0.86, 0.06, 36),
      new THREE.MeshStandardMaterial({
        color: color.hex,
        roughness: 0.33,
        metalness: 0.08,
        emissive: new THREE.Color(color.hex).multiplyScalar(0.25)
      })
    );
    face.rotation.x = Math.PI * 0.5;
    group.add(face);

    group.userData = {
      colorId: color.id,
      colorHex: color.hex,
      tier: color.tier,
      label: color.label,
      radius,
      completed: false,
      baseScale: 1
    };

    return group;
  }

  spawnReturnBalls(cfg) {
    const colors = this.getLevelSourceColors(cfg);
    colors.forEach((color, index) => this.createReturnBall(color, index, { source: true }));
  }

  getLevelTargetColors(cfg) {
    if (cfg.targetColorIds) {
      return cfg.targetColorIds.map((id) => COLORS.find((color) => color.id === id)).filter(Boolean);
    }

    return COLORS.filter((color) => color.tier === cfg.tier);
  }

  getLevelScoreColors(cfg) {
    if (cfg.scoringColorIds) {
      return cfg.scoringColorIds.map((id) => COLORS.find((color) => color.id === id)).filter(Boolean);
    }

    return this.getLevelTargetColors(cfg);
  }

  getLevelSourceColors(cfg) {
    const sourceTier = cfg.sourceTier || cfg.tier;
    return COLORS.filter((color) => color.tier === sourceTier);
  }

  getFixedTargetPosition(index, count) {
    if (count <= 3) {
      return new THREE.Vector3((index - (count - 1) * 0.5) * 0.72, LAYOUT.targetY, LAYOUT.targetZ);
    }

    const spacing = count > 6 ? 0.26 : 0.42;
    const y = count > 6 ? LAYOUT.targetY + 0.04 : LAYOUT.targetY + 0.08;
    return new THREE.Vector3((index - (count - 1) * 0.5) * spacing, y, LAYOUT.targetZ);
  }

  createReturnBall(color, index, extraData = {}) {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(LAYOUT.ballRadius, 32, 32),
      new THREE.MeshStandardMaterial({
        color: color.hex,
        roughness: 0.21,
        metalness: 0.18,
        emissive: new THREE.Color(color.hex).multiplyScalar(0.08)
      })
    );

    const row = Math.floor(index / 3);
    const col = index % 3;
    const spawn = LAYOUT.returnOrigin.clone().add(new THREE.Vector3(col * 0.34 - row * 0.04, row * LAYOUT.mixSpawnLift, -col * 0.36 - row * 0.18));
    ball.position.copy(spawn);
    ball.userData = {
      colorId: color.id,
      colorHex: color.hex,
      tier: color.tier,
      label: color.label,
      spawn,
      velocity: new THREE.Vector3(),
      state: 'ready',
      rollAngle: 0,
      cooldown: 0,
      spent: false,
      ...extraData
    };

    this.scene.add(ball);
    this.balls.push(ball);
    return ball;
  }

  onSelectStart(controller, event) {
    if (!this.levelRunning) return;

    const hit = this.findControllerBall(controller);
    if (!hit) return;

    const ball = hit.object;
    if (ball.userData.state !== 'ready') return;

    controller.userData.grabbed = ball;
    ball.userData.state = 'held';
    controller.attach(ball);
    ball.position.set(0, 0, -0.18);
    this.audio.pick();
    this.pulseController(event, 0.35, 65);
    this.updateHud(`Đang cầm bóng ${ball.userData.label}.`);
  }

  onSelectEnd(controller, event) {
    const ball = controller.userData.grabbed;
    if (!ball) return;

    this.scene.attach(ball);
    controller.userData.grabbed = null;

    const velocity = this.getControllerThrowVelocity(controller);
    if (velocity.length() < 1.1) {
      this.resetBall(ball);
      this.updateHud('Ném mạnh hơn để bóng lăn xuống lane.');
      return;
    }

    velocity.x = THREE.MathUtils.clamp(velocity.x, -4.8, 4.8);
    velocity.y = THREE.MathUtils.clamp(velocity.y + 0.25, -0.2, 3.2);
    velocity.z = Math.min(velocity.z - 3.6, -4.2);
    this.launchBall(ball, ball.position.clone(), velocity);
    this.pulseController(event, 0.18, 45);
  }

  findControllerBall(controller) {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const candidates = this.balls.filter((ball) => ball.userData.state === 'ready');
    const hits = this.raycaster.intersectObjects(candidates, false);
    return hits[0] || null;
  }

  getControllerThrowVelocity(controller) {
    const history = controller.userData.history;
    if (history.length < 2) return new THREE.Vector3(0, 0, -4);

    const newest = history[history.length - 1];
    let oldest = history[0];
    for (let i = history.length - 2; i >= 0; i -= 1) {
      if (newest.time - history[i].time > 0.07) {
        oldest = history[i];
        break;
      }
    }

    const dt = Math.max(newest.time - oldest.time, 0.016);
    return newest.pos.clone().sub(oldest.pos).divideScalar(dt);
  }

  tryMixBallWithTarget(ball, target, center) {
    const cfg = LEVELS[this.currentLevelIndex];
    if (!cfg.mixing) return false;
    const sourceTier = cfg.mixSourceTier || TIERS.PRIMARY;
    const targetTier = cfg.mixTargetTier || TIERS.PRIMARY;
    if (ball.userData.tier !== sourceTier || target.userData.tier !== targetTier) return false;
    if (ball.userData.colorId === target.userData.colorId) return false;

    const resultId = this.getMixResultId(ball.userData.colorId, target.userData.colorId);
    if (!resultId) return false;

    const resultColor = COLORS.find((color) => color.id === resultId);
    const existing = this.balls.find((candidate) => candidate.userData.colorId === resultId);
    if (existing?.userData.spent) {
      return 'spent';
    }
    const resultBall = existing || this.createReturnBall(resultColor, this.balls.length, {
      source: false,
      mixedFrom: [ball.userData.colorId, target.userData.colorId]
    });
    this.revealMixedTarget(resultId);

    resultBall.visible = true;
    resultBall.userData.state = 'ready';
    resultBall.userData.velocity.set(0, 0, 0);
    resultBall.position.copy(resultBall.userData.spawn);

    this.resetBall(ball, 0.55);
    this.spawnFirework(center, resultColor.hex);
    this.audio.mix();
    this.pulseAll(0.55, 80);
    this.updateHud(`${ball.userData.label} + ô ${target.userData.label} = ${resultColor.label}. Lấy bóng ${resultColor.label} ở máng rồi ném vào ô ${resultColor.label}.`);
    return true;
  }

  getMixResultId(a, b) {
    const key = [a, b].sort().join('+');
    return MIX_RECIPES.get(key) || null;
  }

  revealMixedTarget(colorId) {
    const target = this.targets.find((item) => item.userData.colorId === colorId);
    if (!target || target.userData.completed) return;

    target.visible = true;
    target.userData.hiddenUntilMixed = false;
  }

  isReusableMixPad(target, cfg) {
    return Boolean(cfg.mixing && cfg.reusableMixPadTier && target.userData.tier === cfg.reusableMixPadTier);
  }

  isScoreTarget(target, cfg) {
    if (!cfg.scoringColorIds) return true;
    return cfg.scoringColorIds.includes(target.userData.colorId);
  }

  getTierLabel(tier) {
    if (tier === TIERS.PRIMARY) return 'Primary';
    if (tier === TIERS.SECONDARY) return 'Secondary';
    if (tier === TIERS.TERTIARY) return 'Tertiary';
    return 'màu';
  }

  pulseController(event, intensity, duration) {
    const actuator = event?.data?.gamepad?.hapticActuators?.[0] || event?.inputSource?.gamepad?.hapticActuators?.[0];
    if (actuator?.pulse) {
      actuator.pulse(intensity, duration);
    }
  }

  pulseAll(intensity, duration) {
    const session = this.renderer.xr.getSession();
    if (!session) return;

    session.inputSources.forEach((source) => {
      const actuator = source.gamepad?.hapticActuators?.[0];
      if (actuator?.pulse) {
        actuator.pulse(intensity, duration);
      }
    });
  }

  onDesktopPointerDown(event) {
    if (event.button !== 0 || this.renderer.xr.isPresenting || !this.levelRunning) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const readyBalls = this.balls.filter((ball) => ball.userData.state === 'ready');
    const ballHits = this.raycaster.intersectObjects(readyBalls, false);
    if (ballHits.length > 0) {
      const hitBall = ballHits[0].object;
      this.setSelectedBall(hitBall);
      this.audio.pick();
      this.updateHud(`Đã chọn bóng ${this.selectedBall.userData.label}. Click lane hoặc bia để ném.`);
      return;
    }

    if (!this.selectedBall) return;

    const targetHits = this.raycaster.intersectObjects(this.targets.filter((target) => target.visible), true);
    let aimPoint = null;
    if (targetHits.length > 0) {
      const target = this.findTargetRoot(targetHits[0].object);
      if (!target) return;
      aimPoint = new THREE.Vector3();
      target.getWorldPosition(aimPoint);
    } else {
      aimPoint = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(this.aimPlane, aimPoint)) return;
      aimPoint.x = THREE.MathUtils.clamp(aimPoint.x, -LAYOUT.laneWidth * 0.48, LAYOUT.laneWidth * 0.48);
      aimPoint.z = THREE.MathUtils.clamp(aimPoint.z, LAYOUT.laneEndZ, LAYOUT.laneStartZ);
      aimPoint.y = LAYOUT.ballRadius;
    }

    const start = LAYOUT.releasePoint.clone();
    const toAim = aimPoint.clone().sub(start);
    const flatDistance = Math.max(Math.hypot(toAim.x, toAim.z), 0.1);
    const speed = THREE.MathUtils.clamp(flatDistance * 1.58, 7.2, 13.2);
    const velocity = new THREE.Vector3(
      (toAim.x / flatDistance) * speed,
      THREE.MathUtils.clamp((aimPoint.y - start.y) * 1.2 + 0.06, 0.02, 1.7),
      (toAim.z / flatDistance) * speed
    );

    this.launchBall(this.selectedBall, start, velocity);
    this.setSelectedBall(null);
  }

  setSelectedBall(ball) {
    if (this.selectedBall?.material?.emissive) {
      this.selectedBall.material.emissive.setHex(this.selectedBall.userData.colorHex);
      this.selectedBall.material.emissive.multiplyScalar(0.08);
    }

    this.selectedBall = ball;

    if (this.selectedBall?.material?.emissive) {
      this.selectedBall.material.emissive.setHex(0xffffff);
    }
  }

  launchBall(ball, position, velocity) {
    ball.userData.state = 'rolling';
    ball.userData.velocity.copy(velocity);
    ball.userData.previousPosition = position.clone();
    ball.userData.cooldown = 0;
    ball.position.copy(position);
    ball.position.y = Math.max(ball.position.y, LAYOUT.ballRadius);
    this.audio.launch();
    this.audio.startRolling();
    this.updateHud(`Bóng ${ball.userData.label} đang lăn...`);
  }

  updateBallPhysics(ball, dt) {
    const data = ball.userData;
    if (data.state !== 'rolling') return;

    data.previousPosition = ball.position.clone();
    data.cooldown = Math.max(0, data.cooldown - dt);
    data.velocity.y -= 5.8 * dt;
    ball.position.addScaledVector(data.velocity, dt);

    if (ball.position.y < LAYOUT.ballRadius) {
      ball.position.y = LAYOUT.ballRadius;
      if (Math.abs(data.velocity.y) > 0.65) {
        data.velocity.y *= -0.42;
        this.audio.bumper();
      } else {
        data.velocity.y = 0;
      }
    }

    const rollingOnLane = ball.position.y <= LAYOUT.ballRadius + 0.025;
    const friction = rollingOnLane ? 0.996 : 0.999;
    data.velocity.x *= friction;
    data.velocity.z *= friction;

    const sideLimit = LAYOUT.laneWidth * 0.5 - LAYOUT.ballRadius * 0.52;
    if (Math.abs(ball.position.x) > sideLimit) {
      ball.position.x = Math.sign(ball.position.x) * sideLimit;
      data.velocity.x *= -0.72;
      data.velocity.z *= 0.992;
      this.audio.bumper();
      this.spawnSpark(ball.position, 0x39e4ff, 12, 0.26);
    }

    this.handleObstacleCollisions(ball);
    this.handleTargetCollisions(ball);
    if (data.state !== 'rolling') return;

    const rollSpeed = Math.hypot(data.velocity.x, data.velocity.z);
    data.rollAngle += rollSpeed * dt / LAYOUT.ballRadius;
    ball.rotation.x += data.velocity.z * dt / LAYOUT.ballRadius;
    ball.rotation.z -= data.velocity.x * dt / LAYOUT.ballRadius;

    if (ball.position.z < LAYOUT.laneEndZ - 0.75 || rollSpeed < 0.35 || ball.position.z > LAYOUT.laneStartZ + 0.8) {
      this.onBallMissed(ball);
    }
  }

  handleObstacleCollisions(ball) {
    this.obstacles.forEach((obstacle) => {
      const dx = ball.position.x - obstacle.position.x;
      const dz = ball.position.z - obstacle.position.z;
      const minDist = obstacle.userData.radius + LAYOUT.ballRadius;
      const distSq = dx * dx + dz * dz;

      if (distSq > minDist * minDist || ball.userData.cooldown > 0) return;

      const dist = Math.max(Math.sqrt(distSq), 0.001);
      const normal = new THREE.Vector3(dx / dist, 0, dz / dist);
      const velocity = ball.userData.velocity;
      const reflected = velocity.clone().reflect(normal).multiplyScalar(0.78);
      velocity.x = reflected.x;
      velocity.z = reflected.z;
      velocity.y = Math.max(velocity.y, 0.55);
      ball.position.x = obstacle.position.x + normal.x * minDist;
      ball.position.z = obstacle.position.z + normal.z * minDist;
      ball.userData.cooldown = 0.08;
      this.audio.bumper();
      this.spawnSpark(ball.position, 0xfff0b8, 14, 0.28);
    });
  }

  handleTargetCollisions(ball) {
    if (ball.userData.cooldown > 0) return;

    const cfg = LEVELS[this.currentLevelIndex];
    const ballStart = ball.userData.previousPosition || ball.position;
    const ballEnd = ball.position;
    let bestHit = null;

    for (const target of this.targets) {
      if (!target.visible) continue;

      const reusableMixPad = this.isReusableMixPad(target, cfg);
      if (target.userData.completed && !reusableMixPad) continue;

      const center = new THREE.Vector3();
      target.getWorldPosition(center);
      const dist = this.distancePointToBallPath(center, ballStart, ballEnd);
      const hitRadius = target.userData.radius + LAYOUT.ballRadius + LAYOUT.targetHitPadding;

      if (dist > hitRadius) continue;
      if (!bestHit || dist < bestHit.dist) {
        bestHit = { target, center, dist };
      }
    }

    if (!bestHit) return;

    const { target, center } = bestHit;
    if (ball.userData.colorId === target.userData.colorId) {
      if (!this.isScoreTarget(target, cfg)) {
        this.resetBall(ball, 0.45);
        this.updateHud(`Ô ${target.userData.label} là pad phối màu. Bắn bóng ${this.getTierLabel(cfg.mixSourceTier || TIERS.PRIMARY)} khác màu vào đây để tạo màu mới.`);
      } else if (target.userData.completed) {
        this.resetBall(ball, 0.45);
        this.updateHud(`Ô ${target.userData.label} đã ghi điểm. Dùng nó để mix với bóng Primary khác.`);
      } else {
        this.onCorrectHit(ball, target, center);
      }
      return;
    }

    if (this.tryMixBallWithTarget(ball, target, center)) return;
    this.onWrongHit(ball, target, center);
  }

  distancePointToBallPath(point, start, end) {
    const segment = end.clone().sub(start);
    const lengthSq = segment.lengthSq();
    if (lengthSq <= 0.0001) {
      return point.distanceTo(end);
    }

    const t = THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / lengthSq, 0, 1);
    const closest = start.clone().addScaledVector(segment, t);
    return point.distanceTo(closest);
  }

  onCorrectHit(ball, target, center) {
    target.userData.completed = true;
    const cfg = LEVELS[this.currentLevelIndex];
    const reusableMixPad = this.isReusableMixPad(target, cfg);
    target.visible = reusableMixPad;
    this.score += 100;
    this.correctHits += 1;
    this.spawnFirework(center, ball.userData.colorHex);
    this.audio.ping();
    this.pulseAll(0.85, 95);

    if (ball.userData.mixedFrom) {
      this.retireMixedBall(ball);
    } else {
      this.resetBall(ball, 0.7);
    }

    const total = this.getLevelScoreColors(cfg).length;
    if (this.correctHits >= total) {
      this.onLevelCompleted();
    } else {
      this.updateHud(`Ping! Đúng ${this.correctHits}/${total}. Điểm: ${this.score}`);
    }
  }

  onWrongHit(ball, target, center) {
    this.spawnSmoke(center);
    this.audio.wrong();
    this.pulseAll(0.6, 80);

    if (this.mode === MODE.HARD && Number.isFinite(this.remainingTime)) {
      this.remainingTime = Math.max(0, this.remainingTime - 2);
    }

    const label = target.userData.label;
    this.resetBall(ball, 0.85);
    this.updateHud(`Sai màu: bóng ${ball.userData.label} trúng ${label}. ${this.mode === MODE.HARD ? '-2 giây.' : 'Thử lại.'}`);
  }

  retireMixedBall(ball) {
    ball.userData.state = 'spent';
    ball.userData.spent = true;
    ball.userData.velocity.set(0, 0, 0);
    ball.visible = false;
    ball.position.copy(ball.userData.spawn);
    ball.rotation.set(0, 0, 0);
    this.stopRollingIfIdle();
  }

  onBallMissed(ball) {
    if (ball.userData.state !== 'rolling') return;
    this.spawnSmoke(ball.position);
    this.audio.wrong();
    this.resetBall(ball, 0.75);
    this.updateHud('Bóng trượt mục tiêu. Nhặt bóng khác và căn lại.');
  }

  resetBall(ball, delay = 0) {
    ball.userData.state = 'returning';
    ball.userData.velocity.set(0, 0, 0);
    window.setTimeout(() => {
      if (!this.balls.includes(ball)) return;
      ball.position.copy(ball.userData.spawn);
      ball.rotation.set(0, 0, 0);
      ball.visible = true;
      ball.userData.state = 'ready';
      this.stopRollingIfIdle();
    }, delay * 1000);
  }

  stopRollingIfIdle() {
    const anyRolling = this.balls.some((ball) => ball.userData.state === 'rolling');
    if (!anyRolling) this.audio.stopRolling();
  }

  findTargetRoot(object) {
    let current = object;
    while (current && !this.targets.includes(current)) {
      current = current.parent;
    }
    return current;
  }

  spawnFirework(position, hex) {
    this.spawnParticles(position, hex, 42, 0.9, 0.9);
  }

  spawnSpark(position, hex, count = 12, life = 0.25) {
    this.spawnParticles(position, hex, count, life, 0.38);
  }

  spawnSmoke(position) {
    this.spawnParticles(position, 0x151515, 28, 0.85, 0.5, true);
  }

  spawnParticles(position, hex, count, life, speed, smoke = false) {
    const geometry = new THREE.BufferGeometry();
    const points = new Float32Array(count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));

    const material = new THREE.PointsMaterial({
      color: hex,
      size: smoke ? 0.085 : 0.055,
      transparent: true,
      opacity: smoke ? 0.62 : 0.9,
      depthWrite: false
    });

    const system = new THREE.Points(geometry, material);
    system.position.copy(position);
    system.userData = {
      life,
      maxLife: life,
      smoke,
      velocities: Array.from({ length: count }, () => {
        const dir = new THREE.Vector3(
          Math.random() * 2 - 1,
          smoke ? Math.random() * 0.85 : Math.random() * 1.7 - 0.2,
          Math.random() * 2 - 1
        ).normalize();
        return dir.multiplyScalar(speed * (0.45 + Math.random() * 0.9));
      })
    };

    this.scene.add(system);
    this.particles.push(system);
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.userData.life -= dt;

      const attr = particle.geometry.getAttribute('position');
      for (let j = 0; j < attr.count; j += 1) {
        const v = particle.userData.velocities[j];
        attr.array[j * 3] += v.x * dt;
        attr.array[j * 3 + 1] += v.y * dt;
        attr.array[j * 3 + 2] += v.z * dt;
        if (particle.userData.smoke) {
          v.y += 0.22 * dt;
          v.multiplyScalar(0.992);
        } else {
          v.y -= 1.25 * dt;
        }
      }
      attr.needsUpdate = true;
      particle.material.opacity = Math.max(particle.userData.life / particle.userData.maxLife, 0) * (particle.userData.smoke ? 0.62 : 0.9);

      if (particle.userData.life <= 0) {
        this.particles.splice(i, 1);
        this.disposeObject(particle);
      }
    }
  }

  onLevelCompleted() {
    this.levelRunning = false;
    this.audio.stopRolling();
    const levelNum = this.currentLevelIndex + 1;

    if (levelNum >= LEVELS.length) {
      this.audio.win();
      this.updateHud(`Chiến thắng! Tổng điểm Level 3: ${this.score}.`);
      this.showVictoryOverlay();
      return;
    }

    this.unlockedLevel = Math.max(this.unlockedLevel, levelNum + 1);
    this.audio.win();
    this.updateHud(`Qua màn! Tự động chuyển sang Level ${this.unlockedLevel}...`);

    this.levelTransitionTimer = window.setTimeout(() => {
      this.hideVictoryOverlay();
      this.startLevel(this.unlockedLevel);
    }, 1500);
  }

  onTimeUp() {
    if (!this.levelRunning) return;
    this.levelRunning = false;
    this.audio.stopRolling();
    this.audio.lose();
    this.updateHud('Hết giờ! Chơi lại level này để phục thù.');
  }

  showVictoryOverlay() {
    this.ui.victoryOverlay.classList.add('show');
    this.ui.victoryOverlay.setAttribute('aria-hidden', 'false');
  }

  hideVictoryOverlay() {
    this.ui.victoryOverlay.classList.remove('show');
    this.ui.victoryOverlay.setAttribute('aria-hidden', 'true');
  }

  cancelLevelTransition() {
    if (!this.levelTransitionTimer) return;
    window.clearTimeout(this.levelTransitionTimer);
    this.levelTransitionTimer = null;
  }

  renderLabels() {
    const level = LEVELS[this.currentLevelIndex];
    const total = this.getLevelScoreColors(level).length;
    this.ui.level.textContent = `Level: ${level.label}`;
    this.ui.mode.textContent = `Mode: ${this.mode} | Score: ${this.score} | Hit: ${this.correctHits}/${total}`;

    if (this.mode === MODE.HARD && Number.isFinite(this.remainingTime)) {
      this.ui.timer.textContent = `Time: ${Math.ceil(Math.max(this.remainingTime, 0))}`;
    } else {
      this.ui.timer.textContent = 'Time: Unlimited';
    }
  }

  updateHud(text) {
    this.ui.status.textContent = text;
    this.renderLabels();
  }

  updateControllers() {
    const now = performance.now() / 1000;
    this.controllers.forEach((controller) => {
      const pos = new THREE.Vector3();
      pos.setFromMatrixPosition(controller.matrixWorld);
      controller.userData.history.push({ time: now, pos });
      while (controller.userData.history.length > 8) {
        controller.userData.history.shift();
      }
    });
  }

  animateTargets(dt) {
    const cfg = LEVELS[this.currentLevelIndex];
    if (this.rouletteGroup && this.levelRunning) {
      this.rouletteGroup.rotation.z += (cfg.rouletteSpeed || 0) * dt;
    }

    this.targets.forEach((target) => {
      if (target.userData.completed) return;
      const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.025;
      target.scale.setScalar(pulse);
    });
  }

  animate() {
    const dt = Math.min(this.clock.getDelta(), 0.033);

    if (this.orbit && !this.renderer.xr.isPresenting) {
      this.orbit.update();
    }

    this.updateControllers();
    this.animateTargets(dt);
    this.balls.forEach((ball) => this.updateBallPhysics(ball, dt));
    this.updateParticles(dt);
    this.stopRollingIfIdle();

    if (this.levelRunning && this.mode === MODE.HARD) {
      this.remainingTime -= dt;
      if (this.remainingTime <= 0) {
        this.remainingTime = 0;
        this.onTimeUp();
      }
      this.renderLabels();
    }

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.orbit) this.orbit.update();
  }
}

new VRColorBowling();
