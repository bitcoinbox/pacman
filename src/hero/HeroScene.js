import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export default class HeroScene {
  constructor(container) {
    this.container = container;
    this.mouse = { x: 0, y: 0 };
    this.time = 0;
    this.ghosts = [];
    this.pellets = [];
    this.mazeFragments = [];
    this._visible = true;
    this._destroyed = false;

    try {
      this._init();
      this._createScene();
      this._setupPostProcessing();
      this._bindEvents();
      this._animate();
    } catch (e) {
      console.warn('HeroScene: WebGL not available', e);
    }
  }

  _init() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x040407, 0.045);

    const rect = this.container.getBoundingClientRect();
    this.camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.1, 120);
    this.camera.position.set(0, 0.3, 12);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(rect.width, rect.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.container.appendChild(this.renderer.domElement);
  }

  _createScene() {
    this._createGhosts();
    this._createMazeFragments();
    this._createPellets();
    this._createParticles();
    this._createLights();
  }

  // ── GHOSTS — pushed to edges, scaled for viewport ────
  _createGhosts() {
    const configs = [
      { color: 0xFF0000, pos: [-6.0, 2.8, -4] },    // Blinky — top-left
      { color: 0xFFB8FF, pos: [6.5, 3.0, -5] },     // Pinky — top-right
      { color: 0x00FFFF, pos: [-5.5, -3.0, -3] },   // Inky — bottom-left
      { color: 0xFF8800, pos: [5.5, -2.5, -6] },    // Sue — bottom-right deep
    ];

    // On narrow screens, pull ghosts inward so they're visible
    const aspect = this.camera.aspect;
    const xScale = aspect < 1 ? aspect * 0.7 : 1;

    configs.forEach((cfg, i) => {
      const mesh = this._buildGhost(cfg.color);
      const pos = [cfg.pos[0] * xScale, cfg.pos[1], cfg.pos[2]];
      mesh.position.set(...pos);
      mesh.scale.setScalar(0.3);
      this.scene.add(mesh);
      this.ghosts.push({
        mesh,
        base: { x: pos[0], y: pos[1], z: pos[2] },
        phase: i * 1.57,
        speed: 0.18 + i * 0.05,
        driftX: (0.4 + i * 0.1) * xScale,
        driftY: 0.3 + i * 0.08
      });
    });
  }

  _buildGhost(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.05,
      transparent: true,
      opacity: 0.8
    });

    // Head
    const headGeo = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    g.add(new THREE.Mesh(headGeo, mat));

    // Body
    const bodyGeo = new THREE.CylinderGeometry(1, 1, 0.85, 18, 1, true);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = -0.42;
    g.add(body);

    // Skirt tentacles
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const tentGeo = new THREE.SphereGeometry(0.26, 6, 6);
      const tent = new THREE.Mesh(tentGeo, mat);
      tent.position.set(Math.cos(angle) * 0.7, -0.85, Math.sin(angle) * 0.7);
      g.add(tent);
    }

    // Eyes
    const eyeWhiteGeo = new THREE.SphereGeometry(0.22, 8, 8);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF, emissive: 0xFFFFFF, emissiveIntensity: 0.6
    });
    const pupilGeo = new THREE.SphereGeometry(0.11, 6, 6);
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x1122AA, emissive: 0x0033FF, emissiveIntensity: 0.3
    });

    const pupils = [];
    [-0.3, 0.3].forEach(x => {
      const white = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
      white.position.set(x, 0.2, 0.85);
      g.add(white);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(x, 0.18, 0.98);
      pupil.userData.baseX = x;
      g.add(pupil);
      pupils.push(pupil);
    });

    g.userData.pupils = pupils;
    return g;
  }

  // ── MAZE FRAGMENTS — deep background, subtle ─────────
  _createMazeFragments() {
    const frags = [
      { pos: [-8, 4, -12], rot: [0.3, 0.5, 0], s: 2.5, c: 0x1818AA },
      { pos: [9, -3, -14], rot: [-0.2, 0.8, 0.1], s: 2.0, c: 0x0088BB },
      { pos: [-6, -5, -10], rot: [0.5, -0.3, 0.2], s: 1.8, c: 0x1818AA },
      { pos: [7, 5, -16], rot: [-0.1, 0.4, -0.3], s: 3.0, c: 0x5500AA },
      { pos: [-3, -7, -11], rot: [0.2, 0, 0.4], s: 2.0, c: 0x1818AA },
      { pos: [10, 1, -18], rot: [0.6, 0.2, -0.1], s: 2.5, c: 0x0088BB },
      { pos: [-10, 0, -15], rot: [-0.3, 0.6, 0.15], s: 2.8, c: 0x5500AA },
    ];

    const aspect = this.camera.aspect;
    const mxScale = aspect < 1 ? aspect * 0.7 : 1;

    frags.forEach(f => {
      const mesh = this._buildMazeFragment(f.c);
      mesh.position.set(f.pos[0] * mxScale, f.pos[1], f.pos[2]);
      mesh.rotation.set(...f.rot);
      mesh.scale.setScalar(f.s);
      this.scene.add(mesh);
      this.mazeFragments.push({
        mesh,
        baseRot: { x: f.rot[0], y: f.rot[1], z: f.rot[2] },
        speed: 0.04 + Math.random() * 0.06
      });
    });
  }

  _buildMazeFragment(color) {
    const pts = [];
    const s = 1;

    // Create a cleaner maze grid pattern
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * s * 2 - s;
      // Full horizontal line with one gap
      const gap = 0.3 + Math.random() * 0.4;
      const gapPos = -0.5 + Math.random() * 0.6;
      pts.push(new THREE.Vector3(-s, y, 0), new THREE.Vector3(gapPos, y, 0));
      pts.push(new THREE.Vector3(gapPos + gap, y, 0), new THREE.Vector3(s, y, 0));
    }

    for (let i = 0; i <= 4; i++) {
      const x = (i / 4) * s * 2 - s;
      const gap = 0.3 + Math.random() * 0.4;
      const gapPos = -0.5 + Math.random() * 0.6;
      pts.push(new THREE.Vector3(x, -s, 0), new THREE.Vector3(x, gapPos, 0));
      pts.push(new THREE.Vector3(x, gapPos + gap, 0), new THREE.Vector3(x, s, 0));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2
    });

    return new THREE.LineSegments(geo, mat);
  }

  // ── PELLETS — wider orbit, away from center ──────────
  _createPellets() {
    const pelletGeo = new THREE.SphereGeometry(0.055, 6, 6);
    const pelletMat = new THREE.MeshStandardMaterial({
      color: 0xFFE000,
      emissive: 0xFFE000,
      emissiveIntensity: 0.8
    });

    const powerGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const powerMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFCC,
      emissive: 0xFFE000,
      emissiveIntensity: 1.0
    });

    const pAspect = this.camera.aspect;
    const pxScale = pAspect < 1 ? pAspect * 0.7 : 1;

    for (let i = 0; i < 20; i++) {
      const isPower = i % 5 === 0;
      const mesh = new THREE.Mesh(
        isPower ? powerGeo : pelletGeo,
        isPower ? powerMat : pelletMat
      );

      const angle = (i / 20) * Math.PI * 2;
      const r = (4.5 + Math.sin(angle * 2) * 0.8) * pxScale;

      mesh.position.set(
        Math.cos(angle) * r,
        Math.sin(angle * 3) * 1.2,
        Math.sin(angle) * r - 2
      );

      this.scene.add(mesh);
      this.pellets.push({
        mesh, angle, radius: r,
        yBase: Math.sin(angle * 3) * 1.2,
        speed: 0.08,
        isPower
      });
    }
  }

  // ── PARTICLES — sparse near center, dense at edges ───
  _createParticles() {
    const count = 300;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color(0xFFD700),
      new THREE.Color(0x00CCDD),
      new THREE.Color(0xDDA0DD),
      new THREE.Color(0x1818AA),
      new THREE.Color(0x888899),
    ];

    for (let i = 0; i < count; i++) {
      // Generate position, push away from center
      let x = (Math.random() - 0.5) * 30;
      let y = (Math.random() - 0.5) * 24;
      let z = (Math.random() - 0.5) * 24;

      // Clear zone in center — push particles outward
      const distFromCenter = Math.sqrt(x * x + y * y);
      if (distFromCenter < 5) {
        const angle = Math.atan2(y, x);
        const push = 5 + Math.random() * 3;
        x = Math.cos(angle) * push;
        y = Math.sin(angle) * push;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particleCloud = new THREE.Points(geo, mat);
    this.scene.add(this.particleCloud);
  }

  // ── LIGHTS — balanced, less aggressive ───────────────
  _createLights() {
    this.scene.add(new THREE.AmbientLight(0x0a0a18, 0.6));

    // Key — warm gold, softer
    const key = new THREE.PointLight(0xFFD700, 1.8, 20);
    key.position.set(5, 2, 8);
    this.scene.add(key);

    // Fill — cool cyan
    const fill = new THREE.PointLight(0x00BBCC, 0.8, 16);
    fill.position.set(-5, -1, 5);
    this.scene.add(fill);

    // Rim — magenta, subtle
    const rim = new THREE.PointLight(0xCC00CC, 1.0, 20);
    rim.position.set(0, 2, -8);
    this.scene.add(rim);

    // Accent — blue
    const accent = new THREE.PointLight(0x1818AA, 0.8, 14);
    accent.position.set(-6, 4, -4);
    this.scene.add(accent);
  }

  // ── POST-PROCESSING — restrained bloom ───────────────
  _setupPostProcessing() {
    const rect = this.container.getBoundingClientRect();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(rect.width, rect.height),
      0.7,   // strength — pulled back for cleaner look
      0.4,   // radius
      0.88   // threshold — only bright things glow
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  // ── EVENTS ───────────────────────────────────────────
  _bindEvents() {
    this._onMouseMove = (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('resize', () => this._onResize());

    this._observer = new IntersectionObserver(
      (entries) => { this._visible = entries[0].isIntersecting; },
      { threshold: 0 }
    );
    this._observer.observe(this.container);
  }

  _onResize() {
    const rect = this.container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  // ── ANIMATION — slower, more deliberate ──────────────
  _animate() {
    if (this._destroyed) return;
    this._raf = requestAnimationFrame(() => this._animate());
    if (!this._visible) return;

    this.time += 0.016;
    const t = this.time;

    // Ghosts — gentle drift with eye tracking
    this.ghosts.forEach(g => {
      const p = g.phase + t * g.speed;
      g.mesh.position.x = g.base.x + Math.sin(p) * g.driftX + Math.sin(p * 0.3) * 0.15;
      g.mesh.position.y = g.base.y + Math.cos(p * 1.1) * g.driftY + Math.cos(p * 0.7) * 0.1;
      g.mesh.position.z = g.base.z + Math.sin(p * 0.5) * 0.2;
      g.mesh.rotation.y = Math.sin(p * 0.3) * 0.15;

      // Eye tracking — pupils follow mouse
      const pupils = g.mesh.userData.pupils;
      if (pupils) {
        const eyeShift = 0.06;
        pupils.forEach(pupil => {
          pupil.position.x = pupil.userData.baseX + this.mouse.x * eyeShift;
          pupil.position.y = 0.18 + this.mouse.y * eyeShift;
        });
      }
    });

    // Maze fragments — very slow rotation
    this.mazeFragments.forEach(f => {
      f.mesh.rotation.x = f.baseRot.x + t * f.speed * 0.15;
      f.mesh.rotation.y = f.baseRot.y + t * f.speed * 0.6;
      f.mesh.rotation.z = f.baseRot.z + Math.sin(t * f.speed * 0.5) * 0.08;
    });

    // Pellets — slow orbit
    this.pellets.forEach(p => {
      p.angle += p.speed * 0.016;
      const r = p.radius + Math.sin(t * 0.3 + p.angle) * 0.2;
      p.mesh.position.x = Math.cos(p.angle) * r;
      p.mesh.position.y = p.yBase + Math.sin(t * 0.4 + p.angle * 2) * 0.25;
      p.mesh.position.z = Math.sin(p.angle) * r - 2;

      if (p.isPower) {
        const scale = 1 + Math.sin(t * 2.5) * 0.2;
        p.mesh.scale.setScalar(scale);
      }
    });

    // Particle cloud — barely perceptible rotation
    if (this.particleCloud) {
      this.particleCloud.rotation.y = t * 0.008;
    }

    // Camera — subtle mouse parallax
    const camTargetX = this.mouse.x * 0.6;
    const camTargetY = 0.3 + this.mouse.y * 0.35;
    this.camera.position.x += (camTargetX - this.camera.position.x) * 0.02;
    this.camera.position.y += (camTargetY - this.camera.position.y) * 0.02;
    this.camera.lookAt(0, 0, 0);

    this.composer.render();
  }

  destroy() {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('mousemove', this._onMouseMove);
    if (this._observer) this._observer.disconnect();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
