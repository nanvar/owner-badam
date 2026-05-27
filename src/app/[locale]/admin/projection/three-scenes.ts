"use client";

// Offscreen Three.js scenes used by the projection PDF exporter.
// Each export function builds a small scene, renders it to an
// offscreen canvas with anti-aliasing + soft shadows + filmic
// tone-mapping, and returns a PNG data URL ready for jsPDF.

import * as THREE from "three";

type SceneBuilder = (
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
) => void;

async function renderScene(
  width: number,
  height: number,
  build: SceneBuilder,
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 200);
  build(scene, camera);
  renderer.render(scene, camera);
  const url = canvas.toDataURL("image/png");
  renderer.dispose();
  return url;
}

// Shared three-point lighting tuned for the "premium" palette.
function addStudioLights(scene: THREE.Scene, opts?: { rim?: number }) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff4e1, 1.5);
  key.position.set(6, 9, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xe6efff, 0.6);
  fill.position.set(-6, 4, 4);
  scene.add(fill);

  const rim = new THREE.PointLight(0xc5a572, opts?.rim ?? 4, 25, 2);
  rim.position.set(-3, 5, -3);
  scene.add(rim);
}

// === Slide 1 hero — premium architectural tower with glowing windows ===
export function renderTower3D(
  width: number,
  height: number,
): Promise<string> {
  return renderScene(width, height, (scene, camera) => {
    addStudioLights(scene);

    // Soft cream ground disc gives a subtle floor reflection of the
    // shadow without competing with the PDF's cream background.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(9, 64),
      new THREE.MeshStandardMaterial({
        color: 0xf3ede2,
        metalness: 0.05,
        roughness: 0.85,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Stacked tower — four boxes narrowing as they rise, slightly
    // rotated between layers to break the symmetry.
    type Layer = { w: number; h: number; d: number; y: number; rot: number };
    const layers: Layer[] = [
      { w: 3.4, h: 1.3, d: 3.4, y: 0.65, rot: 0 },
      { w: 2.9, h: 1.6, d: 2.9, y: 2.1, rot: 0.08 },
      { w: 2.4, h: 1.8, d: 2.4, y: 3.8, rot: -0.05 },
      { w: 1.9, h: 1.4, d: 1.9, y: 5.4, rot: 0.04 },
    ];

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1f2734,
      metalness: 0.55,
      roughness: 0.42,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xc5a572,
      metalness: 0.85,
      roughness: 0.25,
    });
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xfff0c8,
      emissive: 0xffcb6a,
      emissiveIntensity: 0.95,
    });

    layers.forEach((L) => {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(L.w, L.h, L.d),
        bodyMat,
      );
      body.position.y = L.y;
      body.rotation.y = L.rot;
      body.castShadow = true;
      body.receiveShadow = true;
      scene.add(body);

      // Thin gold trim along the top of each layer.
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(L.w + 0.04, 0.07, L.d + 0.04),
        trimMat,
      );
      trim.position.set(0, L.y + L.h / 2 + 0.03, 0);
      trim.rotation.y = L.rot;
      trim.castShadow = true;
      scene.add(trim);

      // Window rows on every face (front/back/left/right).
      const cols = Math.max(2, Math.round(L.w * 2.4));
      const rows = Math.max(2, Math.round(L.h * 2.2));
      const wSpan = L.w - 0.4;
      const hSpan = L.h - 0.4;
      const wGeom = new THREE.BoxGeometry(0.13, 0.13, 0.04);
      const faces: Array<[number, number, number, number]> = [
        [0, 0, L.d / 2 + 0.01, 0], // front
        [0, 0, -L.d / 2 - 0.01, Math.PI], // back
        [L.w / 2 + 0.01, 0, 0, Math.PI / 2], // right
        [-L.w / 2 - 0.01, 0, 0, -Math.PI / 2], // left
      ];
      faces.forEach(([fx, fy, fz, fr]) => {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const win = new THREE.Mesh(wGeom, winMat);
            const local = new THREE.Vector3(
              -wSpan / 2 + (c * wSpan) / Math.max(1, cols - 1),
              L.y - L.h / 2 + 0.25 + (r * hSpan) / Math.max(1, rows - 1),
              0,
            );
            const offset = new THREE.Vector3(fx, fy, fz);
            const m = new THREE.Matrix4().makeRotationY(fr);
            local.applyMatrix4(m);
            win.position.set(
              offset.x + local.x,
              offset.y + local.y,
              offset.z + local.z,
            );
            win.rotation.y = fr + L.rot;
            scene.add(win);
          }
        }
      });
    });

    // Antenna spire on top — a slim cylinder + small sphere finial.
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.08, 1.4, 12),
      trimMat,
    );
    spire.position.y = 6.85;
    spire.castShadow = true;
    scene.add(spire);
    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 16, 12),
      trimMat,
    );
    finial.position.y = 7.65;
    scene.add(finial);

    camera.position.set(7.6, 5.8, 9.4);
    camera.lookAt(0, 3.2, 0);
  });
}

// === Slide 2 service icons — laptop / briefcase / key on tinted base ===
export function renderServiceIcon3D(
  kind: "listing" | "guest" | "property",
  width: number,
  height: number,
): Promise<string> {
  return renderScene(width, height, (scene, camera) => {
    addStudioLights(scene, { rim: 2.5 });

    // Pedestal — low cylinder for the icon to sit on.
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.8, 0.18, 64),
      new THREE.MeshStandardMaterial({
        color: 0xf3ede2,
        metalness: 0.15,
        roughness: 0.75,
      }),
    );
    pedestal.position.y = -0.09;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xc5a572,
      metalness: 0.88,
      roughness: 0.22,
    });
    const inkMat = new THREE.MeshStandardMaterial({
      color: 0x1f2734,
      metalness: 0.55,
      roughness: 0.4,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xb73f66,
      metalness: 0.45,
      roughness: 0.4,
    });

    if (kind === "listing") {
      // Laptop — flat base + tilted screen.
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.4), inkMat);
      base.position.y = 0.1;
      base.castShadow = true;
      scene.add(base);
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 1.35, 0.08),
        inkMat,
      );
      screen.position.set(0, 0.9, -0.55);
      screen.rotation.x = -0.42;
      screen.castShadow = true;
      scene.add(screen);
      const display = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 1.15),
        new THREE.MeshStandardMaterial({
          color: 0xfff0c8,
          emissive: 0xffcb6a,
          emissiveIntensity: 0.4,
        }),
      );
      display.position.set(0, 0.93, -0.5);
      display.rotation.x = -0.42;
      scene.add(display);
      // Gold edge trim
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(2.22, 0.04, 1.42),
        goldMat,
      );
      trim.position.y = 0.05;
      scene.add(trim);
    } else if (kind === "guest") {
      // Briefcase — body + handle + clasp.
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 0.7), inkMat);
      body.position.y = 0.9;
      body.castShadow = true;
      scene.add(body);
      // Handle
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.07, 16, 32, Math.PI),
        goldMat,
      );
      handle.position.set(0, 1.75, 0);
      scene.add(handle);
      // Clasps
      [-0.6, 0.6].forEach((x) => {
        const clasp = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.18, 0.08),
          goldMat,
        );
        clasp.position.set(x, 1.2, 0.4);
        scene.add(clasp);
      });
      // Center seam
      const seam = new THREE.Mesh(
        new THREE.BoxGeometry(2.22, 0.04, 0.05),
        goldMat,
      );
      seam.position.set(0, 0.9, 0.36);
      scene.add(seam);
    } else {
      // House — base + roof + door + window.
      const base = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 1.5), inkMat);
      base.position.y = 0.8;
      base.castShadow = true;
      scene.add(base);
      // Roof as a 4-sided pyramid (cone with 4 segments)
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 0.95, 4),
        goldMat,
      );
      roof.position.y = 1.95;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      scene.add(roof);
      // Door
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.85, 0.06),
        accentMat,
      );
      door.position.set(0, 0.6, 0.78);
      scene.add(door);
      // Window
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.05),
        new THREE.MeshStandardMaterial({
          color: 0xfff0c8,
          emissive: 0xffcb6a,
          emissiveIntensity: 0.5,
        }),
      );
      win.position.set(-0.65, 1.05, 0.78);
      scene.add(win);
      const win2 = win.clone();
      win2.position.x = 0.65;
      scene.add(win2);
    }

    camera.position.set(3.4, 3.1, 4.8);
    camera.lookAt(0, 0.7, 0);
  });
}

// === Slide 4 — 3D bar chart for the three scenarios ===
export function renderScenarioChart3D(
  values: { pessimistic: number; realistic: number; optimistic: number },
  width: number,
  height: number,
): Promise<string> {
  return renderScene(width, height, (scene, camera) => {
    addStudioLights(scene, { rim: 1.8 });

    // Base slab the bars sit on.
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 0.15, 2.6),
      new THREE.MeshStandardMaterial({
        color: 0xf3ede2,
        metalness: 0.1,
        roughness: 0.8,
      }),
    );
    slab.position.y = -0.075;
    slab.receiveShadow = true;
    scene.add(slab);

    const max = Math.max(
      values.pessimistic,
      values.realistic,
      values.optimistic,
      1,
    );
    const items: Array<{ x: number; v: number; color: number }> = [
      { x: -2, v: values.pessimistic, color: 0xc14041 },
      { x: 0, v: values.realistic, color: 0x71a8c7 },
      { x: 2, v: values.optimistic, color: 0x89bc60 },
    ];
    items.forEach(({ x, v, color }) => {
      const h = 0.4 + (v / max) * 3.6;
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, h, 1.2),
        new THREE.MeshStandardMaterial({
          color,
          metalness: 0.4,
          roughness: 0.35,
        }),
      );
      bar.position.set(x, h / 2, 0);
      bar.castShadow = true;
      bar.receiveShadow = true;
      scene.add(bar);
      // Gold cap
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(1.24, 0.06, 1.24),
        new THREE.MeshStandardMaterial({
          color: 0xc5a572,
          metalness: 0.85,
          roughness: 0.2,
        }),
      );
      cap.position.set(x, h + 0.03, 0);
      scene.add(cap);
    });

    camera.position.set(5.8, 4.8, 6);
    camera.lookAt(0, 1.6, 0);
  });
}
