import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const TIERS = {
  PRIMARY: 'Primary',
  SECONDARY: 'Secondary',
  TERTIARY: 'Tertiary'
};

const WHEEL_COLORS = [
  { id: 'red', hex: 0xff2b2b, tier: TIERS.PRIMARY },
  { id: 'red-orange', hex: 0xff5b1f, tier: TIERS.TERTIARY },
  { id: 'orange', hex: 0xff8d00, tier: TIERS.SECONDARY },
  { id: 'yellow-orange', hex: 0xffba00, tier: TIERS.TERTIARY },
  { id: 'yellow', hex: 0xffef00, tier: TIERS.PRIMARY },
  { id: 'yellow-green', hex: 0x98e600, tier: TIERS.TERTIARY },
  { id: 'green', hex: 0x10c000, tier: TIERS.SECONDARY },
  { id: 'blue-green', hex: 0x0c9da5, tier: TIERS.TERTIARY },
  { id: 'blue', hex: 0x1548ff, tier: TIERS.PRIMARY },
  { id: 'blue-purple', hex: 0x5f2dff, tier: TIERS.TERTIARY },
  { id: 'purple', hex: 0x9f27d9, tier: TIERS.SECONDARY },
  { id: 'red-purple', hex: 0xcb1797, tier: TIERS.TERTIARY }
];

const LEVELS = [
  { id: 1, label: 'Level 1 - Primary', tier: TIERS.PRIMARY, hardTime: 28, targetCount: 9, noiseCount: 0 },
  { id: 2, label: 'Level 2 - Secondary', tier: TIERS.SECONDARY, hardTime: 35, targetCount: 9, noiseCount: 0 },
  { id: 3, label: 'Level 3 - Tertiary', tier: TIERS.TERTIARY, hardTime: 55, targetCount: 18, noiseCount: 0 }
];

const MODE = {
  EASY: 'Easy',
  HARD: 'Hard'
};

const SCENE_LAYOUT = {
  floorY: -0.35,
  wheelCenter: new THREE.Vector3(0, 1.6, -1.45),
  wheelInnerRadius: 0.55,
  wheelOuterRadius: 1.65,
  pieceBaseY: -0.15,
  pieceAreaZ: 0.8
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgmTimer = null;
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
  }

  startBgm() {
    this.ensure();
    if (this.bgmTimer) return;

    const notes = [220, 246.94, 261.63, 329.63];
    let i = 0;
    this.bgmTimer = window.setInterval(() => {
      this.tone(notes[i % notes.length], 0.2, 'sine', 0.04);
      i += 1;
    }, 420);
  }

  stopBgm() {
    if (!this.bgmTimer) return;
    window.clearInterval(this.bgmTimer);
    this.bgmTimer = null;
  }

  tone(freq, duration = 0.12, type = 'triangle', volume = 0.08) {
    this.ensure();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0;

    osc.connect(gain);
    gain.connect(this.master);

    const now = this.ctx.currentTime;
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  pick() { this.tone(660, 0.07, 'square', 0.05); }
  correct() { this.tone(880, 0.15, 'triangle', 0.09); }
  wrong() { this.tone(180, 0.2, 'sawtooth', 0.08); }
  win() {
    this.tone(523.25, 0.2, 'triangle', 0.1);
    window.setTimeout(() => this.tone(659.25, 0.2, 'triangle', 0.1), 140);
    window.setTimeout(() => this.tone(783.99, 0.25, 'triangle', 0.1), 280);
  }
  lose() { this.tone(110, 0.35, 'sawtooth', 0.1); }
}

class VRColorCircle {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a2a3a);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 50);
    this.camera.position.set(0, 1.65, 2.6);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    document.body.appendChild(this.renderer.domElement);
    document.body.appendChild(VRButton.createButton(this.renderer));

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.audio = new AudioEngine();

    this.mode = MODE.EASY;
    this.currentLevelIndex = 0;
    this.unlockedLevel = 1;
    this.remainingTime = 0;
    this.levelRunning = false;
    this.correctPlaced = 0;

    this.slots = [];
    this.pieces = [];
    this.activeTier = TIERS.PRIMARY;
    this.activeColorIds = [];
    this.activeTargets = new Set();
    this.completedSlots = new Map();

    this.controllers = [];
    this.selectedPiece = null;

    this.ui = {
      level: document.getElementById('levelLabel'),
      mode: document.getElementById('modeLabel'),
      timer: document.getElementById('timerLabel'),
      status: document.getElementById('statusLabel'),
      easyBtn: document.getElementById('easyBtn'),
      hardBtn: document.getElementById('hardBtn'),
      nextBtn: document.getElementById('nextBtn'),
      resetBtn: document.getElementById('resetBtn')
    };

    this.setupWorld();
    this.setupWheel();
    this.setupControllers();
    this.setupDesktopControls();
    this.bindUI();
    this.updateHud('Đang khởi động chế độ Desktop test...');
    this.startLevel(1);

    window.addEventListener('resize', () => this.onResize());
    this.renderer.setAnimationLoop(() => this.animate());
  }

  setupWorld() {
    this.scene.add(new THREE.HemisphereLight(0xfff5d1, 0x66717a, 1.15));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(2.5, 4, 2.5);
    this.scene.add(keyLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(6, 64),
      new THREE.MeshStandardMaterial({ color: 0xcfba6f, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI * 0.5;
    floor.position.y = SCENE_LAYOUT.floorY;
    this.scene.add(floor);

    const board = new THREE.Mesh(
      new THREE.CylinderGeometry(1.85, 1.85, 0.1, 64),
      new THREE.MeshStandardMaterial({ color: 0xfefcf4, roughness: 0.75 })
    );
    board.position.copy(SCENE_LAYOUT.wheelCenter);
    board.rotation.x = Math.PI * 0.5;
    this.scene.add(board);

    const centerGuide = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x202020 })
    );
    centerGuide.position.copy(SCENE_LAYOUT.wheelCenter);
    this.scene.add(centerGuide);
  }

  setupDesktopControls() {
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.copy(SCENE_LAYOUT.wheelCenter);
    this.orbit.enableDamping = true;
    this.orbit.minDistance = 1.2;
    this.orbit.maxDistance = 5;
    this.orbit.minPolarAngle = Math.PI * 0.5;
    this.orbit.maxPolarAngle = Math.PI * 0.5;
    this.orbit.update();

    this.renderer.domElement.addEventListener('pointerdown', (event) => this.onDesktopPointerDown(event));
    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'f') {
        this.focusDesktopView();
      }
    });
  }

  focusDesktopView() {
    if (this.renderer.xr.isPresenting) {
      return;
    }

    this.camera.position.set(0, SCENE_LAYOUT.wheelCenter.y, 3.35);
    this.camera.lookAt(SCENE_LAYOUT.wheelCenter);
    
    if (this.orbit) {
      this.orbit.target.copy(SCENE_LAYOUT.wheelCenter);
      this.orbit.update();
    }
  }

  setupWheel() {
    const sectorCount = WHEEL_COLORS.length; // 12 sectors
    const ringBounds = [0.26, 0.72, 1.18, SCENE_LAYOUT.wheelOuterRadius]; // 3 rings => 36 cells

    for (let ring = 0; ring < 3; ring += 1) {
      const innerRadius = ringBounds[ring];
      const outerRadius = ringBounds[ring + 1];

      WHEEL_COLORS.forEach((item, index) => {
        const angle1 = (index / sectorCount) * Math.PI * 2;
        const angle2 = ((index + 1) / sectorCount) * Math.PI * 2;

        const thetaLength = angle2 - angle1;
        const geometry = new THREE.RingGeometry(
          innerRadius,
          outerRadius,
          18,
          1,
          angle1,
          thetaLength
        );

        const cellTone = ring === 0 ? 0xf9f9f9 : ring === 1 ? 0xf3f3f3 : 0xededed;
        const mat = new THREE.MeshStandardMaterial({
          color: cellTone,
          roughness: 0.5,
          metalness: 0.15,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        });

        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.set(
          SCENE_LAYOUT.wheelCenter.x,
          SCENE_LAYOUT.wheelCenter.y,
          SCENE_LAYOUT.wheelCenter.z + 0.07
        );

        mesh.userData = {
          colorId: item.id,
          colorHex: item.hex,
          tier: item.tier,
          ring,
          filled: false
        };

        this.scene.add(mesh);
        this.slots.push(mesh);
      });
    }

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth: 4,
      fog: false,
      depthTest: false,
      depthWrite: false
    });

    const radialGeo = new THREE.BufferGeometry();
    const radialVertices = [];
    for (let i = 0; i < sectorCount; i += 1) {
      const angle = (i / sectorCount) * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      radialVertices.push(c * ringBounds[0], 0, s * ringBounds[0]);
      radialVertices.push(c * ringBounds[3], 0, s * ringBounds[3]);
    }
    radialGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(radialVertices), 3));

    const radialLines = new THREE.LineSegments(radialGeo, lineMaterial);
    radialLines.position.set(
      SCENE_LAYOUT.wheelCenter.x,
      SCENE_LAYOUT.wheelCenter.y,
      SCENE_LAYOUT.wheelCenter.z + 0.1
    );
    radialLines.rotation.x = -Math.PI * 0.5;
    radialLines.renderOrder = 20;
    this.scene.add(radialLines);

    for (const r of ringBounds) {
      const circleGeo = new THREE.BufferGeometry();
      const circleVertices = [];
      for (let i = 0; i <= 96; i += 1) {
        const angle = (i / 96) * Math.PI * 2;
        circleVertices.push(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      }
      circleGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(circleVertices), 3));

      const circleLine = new THREE.Line(circleGeo, lineMaterial);
      circleLine.position.set(
        SCENE_LAYOUT.wheelCenter.x,
        SCENE_LAYOUT.wheelCenter.y,
        SCENE_LAYOUT.wheelCenter.z + 0.1
      );
      circleLine.rotation.x = -Math.PI * 0.5;
      circleLine.renderOrder = 20;
      this.scene.add(circleLine);
    }
  }

  setupControllers() {
    for (let i = 0; i < 2; i += 1) {
      const controller = this.renderer.xr.getController(i);
      controller.userData.grabbed = null;

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1)
        ]),
        new THREE.LineBasicMaterial({ color: 0x1f1f1f })
      );
      line.name = 'ray';
      line.scale.z = 6;
      controller.add(line);

      controller.addEventListener('selectstart', () => this.onSelectStart(controller));
      controller.addEventListener('selectend', () => this.onSelectEnd(controller));

      this.scene.add(controller);
      this.controllers.push(controller);
    }
  }

  bindUI() {
    this.ui.easyBtn.addEventListener('click', () => {
      this.mode = MODE.EASY;
      this.startLevel(1);
    });

    this.ui.hardBtn.addEventListener('click', () => {
      this.mode = MODE.HARD;
      this.startLevel(1);
    });

    this.ui.nextBtn.addEventListener('click', () => {
      const next = Math.min(this.currentLevelIndex + 2, 3);
      this.startLevel(next);
    });

    this.ui.resetBtn.addEventListener('click', () => {
      this.unlockedLevel = 1;
      this.currentLevelIndex = 0;
      this.setSelectedPiece(null);
      this.clearPieces();
      this.resetSlots();
      this.levelRunning = false;
      this.updateHud('Đã reset. Chọn Start để chơi lại.');
      this.renderLabels();
    });

    const unlockAudio = () => {
      this.audio.startBgm();
      window.removeEventListener('pointerdown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
  }

  startLevel(levelId) {
    if (levelId > this.unlockedLevel) {
      this.updateHud('Level chưa mở khóa');
      return;
    }

    const cfg = LEVELS[levelId - 1];
    this.currentLevelIndex = levelId - 1;
    this.activeTier = cfg.tier;
    this.levelRunning = true;
    this.correctPlaced = 0;

    this.remainingTime = this.mode === MODE.HARD ? cfg.hardTime : Infinity;

    if (levelId === 1) {
      this.completedSlots.clear();
    }

    this.setSelectedPiece(null);
    this.clearPieces();
    this.spawnPiecesForTier(cfg.tier);
    this.resetSlots();
    this.focusDesktopView();

    const pieceCount = cfg.targetCount;
    const noiseText = cfg.noiseCount > 0 ? ` (+ ${cfg.noiseCount} nhiễu)` : '';
    this.updateHud(`Bắt đầu ${cfg.label} - Gắn ${pieceCount} ô mục tiêu${noiseText}`);
    this.renderLabels();
  }

  getShadeVariants(hex) {
    const base = new THREE.Color(hex);
    const white = new THREE.Color(0xffffff);
    return [0, 0.35, 0.6].map((mix) => base.clone().lerp(white, mix).getHex());
  }

  getShadeIndexFromRing(ring) {
    return 2 - ring; // outer ring darkest, inner ring lightest
  }

  spawnPiecesForTier(tier) {
    const cfg = LEVELS[this.currentLevelIndex];

    if (cfg.id >= 1 && cfg.id <= 3) {
      const tierColors = WHEEL_COLORS.filter((c) => c.tier === tier);
      const pieceGeo = new THREE.SphereGeometry(0.11, 28, 28);
      const ringOrder = [2, 1, 0];
      const colCount = tierColors.length;
      const spacing = colCount > 4 ? 0.36 : 0.5;
      const startX = -((colCount - 1) * spacing) * 0.5;

      tierColors.forEach((c, colIndex) => {
        const shades = this.getShadeVariants(c.hex);

        ringOrder.forEach((ring, rowIndex) => {
          const shadeHex = shades[this.getShadeIndexFromRing(ring)];
          const mat = new THREE.MeshStandardMaterial({
            color: shadeHex,
            roughness: 0.25,
            metalness: 0.15
          });

          const mesh = new THREE.Mesh(pieceGeo, mat);
          const x = startX + colIndex * spacing;
          const y = SCENE_LAYOUT.pieceBaseY + rowIndex * 0.33;
          const z = SCENE_LAYOUT.pieceAreaZ;

          mesh.position.set(x, y, z);
          mesh.castShadow = false;
          mesh.userData = {
            colorId: c.id,
            tier: c.tier,
            targetRing: ring,
            shadeHex,
            spawn: new THREE.Vector3(x, y, z),
            placed: false
          };

          this.scene.add(mesh);
          this.pieces.push(mesh);
        });
      });

      return;
    }
    
    // Target colors
    const targetColors = WHEEL_COLORS.filter((c) => c.tier === tier);
    
    // Noise colors - randomly selected
    const otherColors = WHEEL_COLORS.filter((c) => c.tier !== tier);
    const noiseColors = [];
    for (let i = 0; i < cfg.noiseCount && otherColors.length > 0; i++) {
      const idx = Math.floor(Math.random() * otherColors.length);
      noiseColors.push(otherColors[idx]);
      otherColors.splice(idx, 1);
    }
    
    // Store active colors for resetSlots to use
    this.activeColorIds = [...targetColors.map(c => c.id), ...noiseColors.map(c => c.id)];
    
    const allColors = [...targetColors, ...noiseColors];
    const pieceGeo = new THREE.SphereGeometry(0.16, 28, 28);

    allColors.forEach((c, idx) => {
      const mat = new THREE.MeshStandardMaterial({
        color: c.hex,
        roughness: 0.25,
        metalness: 0.15
      });

      const mesh = new THREE.Mesh(pieceGeo, mat);
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const x = -0.4 + col * 0.4;
      const y = SCENE_LAYOUT.pieceBaseY + row * 0.34;
      const z = SCENE_LAYOUT.pieceAreaZ;

      mesh.position.set(x, y, z);
      mesh.castShadow = false;
      mesh.userData = {
        colorId: c.id,
        tier: c.tier,
        spawn: new THREE.Vector3(x, y, z),
        placed: false
      };

      this.scene.add(mesh);
      this.pieces.push(mesh);
    });
  }

  resetSlots() {
    const cfg = LEVELS[this.currentLevelIndex];
    this.activeTargets.clear();

    if (cfg.id >= 1 && cfg.id <= 3) {
      const targetIds = new Set(WHEEL_COLORS.filter((c) => c.tier === cfg.tier).map((c) => c.id));

      this.slots.forEach((slot) => {
        const key = `${slot.userData.colorId}-${slot.userData.ring}`;
        const completedHex = this.completedSlots.get(key);

        slot.visible = true;
        slot.userData.isTarget = targetIds.has(slot.userData.colorId) && !completedHex;
        slot.userData.filled = !!completedHex;

        if (slot.userData.isTarget) {
          const shadeIndex = this.getShadeIndexFromRing(slot.userData.ring);
          const shades = this.getShadeVariants(slot.userData.colorHex);
          slot.userData.targetHex = shades[shadeIndex];
          this.activeTargets.add(`${slot.userData.colorId}-${slot.userData.ring}`);
        } else {
          slot.userData.targetHex = null;
        }

        if (completedHex) {
          slot.material.color.setHex(completedHex);
          slot.material.emissive.setHex(0x333333);
        } else {
          slot.material.color.setHex(0xffffff);
          slot.material.emissive.setHex(0x000000);
        }
        slot.scale.setScalar(1);
      });
      return;
    }

    // Reset default for other levels
    this.slots.forEach((slot) => {
      slot.userData.filled = false;
      slot.visible = true;
      slot.userData.isTarget = slot.userData.tier === cfg.tier && slot.userData.ring === 2;
      slot.userData.targetHex = slot.userData.colorHex;
      const baseTone = slot.userData.ring === 0 ? 0xf9f9f9 : slot.userData.ring === 1 ? 0xf3f3f3 : 0xededed;
      slot.material.color.setHex(baseTone);
      slot.material.emissive.setHex(0x000000);
      slot.scale.setScalar(1);
    });
  }

  clearPieces() {
    this.setSelectedPiece(null);
    this.pieces.forEach((p) => {
      this.scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
    });
    this.pieces = [];
  }

  onSelectStart(controller) {
    if (!this.levelRunning) return;

    const hit = this.findClosestIntersect(controller);
    if (!hit) return;

    controller.userData.grabbed = hit.object;
    controller.attach(hit.object);
    this.audio.pick();
  }

  onSelectEnd(controller) {
    const grabbed = controller.userData.grabbed;
    if (!grabbed) return;

    this.scene.attach(grabbed);
    controller.userData.grabbed = null;

    const slot = this.findNearestSlot(grabbed.position);
    if (!slot) {
      grabbed.position.copy(grabbed.userData.spawn);
      this.audio.wrong();
      return;
    }

    this.placePieceOnSlot(grabbed, slot);
  }

  onDesktopPointerDown(event) {
    if (event.button !== 0) return;
    if (this.renderer.xr.isPresenting) return;
    if (!this.levelRunning) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const slotHits = this.raycaster.intersectObjects(this.slots.filter((s) => s.visible), false);
    if (this.selectedPiece && slotHits.length > 0) {
      this.placePieceOnSlot(this.selectedPiece, slotHits[0].object);
      return;
    }

    const pieceHits = this.raycaster.intersectObjects(
      this.pieces.filter((p) => !p.userData.placed && p.visible),
      false
    );

    if (pieceHits.length > 0) {
      const piece = pieceHits[0].object;
      this.setSelectedPiece(piece);
      this.audio.pick();
      this.updateHud(`Đã chọn màu ${piece.userData.colorId}. Click ô màu để thả.`);
      return;
    }

    if (this.selectedPiece) {
      this.updateHud('Chưa chọn đúng ô. Click bi màu rồi click ô tương ứng.');
    }
  }

  setSelectedPiece(piece) {
    if (this.selectedPiece && this.selectedPiece.material && this.selectedPiece.material.emissive) {
      this.selectedPiece.material.emissive.setHex(0x000000);
    }

    this.selectedPiece = piece;

    if (this.selectedPiece && this.selectedPiece.material && this.selectedPiece.material.emissive) {
      this.selectedPiece.material.emissive.setHex(0x333333);
    }
  }

  placePieceOnSlot(piece, slot) {
    if (!piece || !slot) {
      return;
    }

    const sameColor = slot.userData.colorId === piece.userData.colorId;
    const ringMatched = piece.userData.targetRing === undefined || piece.userData.targetRing === slot.userData.ring;
    const correct = sameColor && ringMatched && !slot.userData.filled;

    if (!correct) {
      piece.position.copy(piece.userData.spawn);
      this.audio.wrong();
      this.updateHud('Sai vị trí, thử lại');
      return;
    }

    // Only count if piece is from target tier
    const cfg = LEVELS[this.currentLevelIndex];
    const isTargetColor = piece.userData.tier === cfg.tier;
    
    slot.userData.filled = true;
    const finalHex = slot.userData.targetHex || piece.userData.shadeHex || slot.userData.colorHex;
    slot.material.color.setHex(finalHex);
    slot.material.emissive.setHex(0x333333);
    this.completedSlots.set(`${slot.userData.colorId}-${slot.userData.ring}`, finalHex);
    piece.position.copy(slot.position);
    piece.userData.placed = true;
    piece.visible = false;
    this.setSelectedPiece(null);

    if (isTargetColor) {
      this.correctPlaced += 1;
      this.audio.correct();

      const target = cfg.targetCount;
      if (this.correctPlaced >= target) {
        this.onLevelCompleted();
      } else {
        this.updateHud(`Đúng ${this.correctPlaced}/${target}`);
      }
    } else {
      this.audio.pick();
      this.updateHud('Gắn được 1 bi, nhưng chưa phải màu chính yêu cầu');
    }
  }

  findClosestIntersect(controller) {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const candidates = this.pieces.filter((p) => !p.userData.placed && p.visible);
    const hits = this.raycaster.intersectObjects(candidates, false);
    return hits[0] || null;
  }

  findNearestSlot(pos) {
    const tempRaycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3().copy(pos).negate().normalize();
    
    tempRaycaster.ray.origin.copy(pos);
    tempRaycaster.ray.direction.copy(direction);

    const visibleSlots = this.slots.filter((s) => !s.userData.filled && s.visible);
    const hits = tempRaycaster.intersectObjects(visibleSlots, false);
    
    return hits.length > 0 ? hits[0].object : null;
  }

  onLevelCompleted() {
    this.levelRunning = false;
    const levelNum = this.currentLevelIndex + 1;

    if (levelNum >= 3) {
      this.audio.win();
      this.updateHud('Chiến thắng! Hoàn thành Level 3.');
      return;
    }

    this.unlockedLevel = Math.max(this.unlockedLevel, levelNum + 1);
    this.audio.correct();
    this.updateHud(`Qua màn! Đã mở khóa Level ${this.unlockedLevel}`);
  }

  onTimeUp() {
    this.levelRunning = false;
    this.audio.lose();
    this.updateHud('Hết giờ! Chơi lại level này.');
  }

  renderLabels() {
    const level = LEVELS[this.currentLevelIndex];
    this.ui.level.textContent = `Level: ${level ? level.label : '-'}`;
    this.ui.mode.textContent = `Mode: ${this.mode}`;

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

  animate() {
    const dt = this.clock.getDelta();

    if (this.orbit && !this.renderer.xr.isPresenting) {
      this.orbit.update();
    }

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
    if (this.orbit) {
      this.orbit.update();
    }
  }
}

new VRColorCircle();
