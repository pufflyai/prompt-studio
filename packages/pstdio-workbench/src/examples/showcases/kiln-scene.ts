import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { WorkbenchCore } from "../../core";
import { kilnTracks, sampleKilnTrack } from "./kiln-animation";
import { kilnObjects, kilnPage, kilnResource } from "./kiln-data";
import { kilnStore } from "./kiln-state";
import { kilnTheme } from "./themes";

export const createKilnScene = (canvas: HTMLCanvasElement, workbench: WorkbenchCore) => {
  const styles = getComputedStyle(canvas);
  // The story applies its theme after mounting children. Read its overrides directly for the first canvas frame.
  const color = (token: string) =>
    new THREE.Color(
      kilnTheme.tokens?.[`colors.${token}`] ??
        styles.getPropertyValue(`--chakra-colors-${token.replaceAll(".", "-")}`).trim(),
    );
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  scene.background = color("bg.subtle");
  scene.fog = new THREE.Fog(scene.background, 20, 48);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.up.set(0, 0, 1);
  camera.position.set(8, -13, 9);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(-0.4, 0, 1.2);
  controls.minDistance = 5;
  controls.maxDistance = 30;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.update();
  controls.saveState();
  controls.listenToKeyEvents(canvas);

  scene.add(new THREE.HemisphereLight(color("fg"), color("bg.panel"), 2.4));
  const fill = new THREE.DirectionalLight(color("fg"), 3);
  fill.position.set(5, -3, 8);
  fill.castShadow = true;
  fill.shadow.mapSize.set(1024, 1024);
  Object.assign(fill.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  fill.shadow.normalBias = 0.04;
  scene.add(fill);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: color("bg.panel"), roughness: 1 }),
  );
  floor.position.z = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(60, 60, color("border"), color("border"));
  grid.rotation.x = Math.PI / 2;
  grid.material.transparent = true;
  grid.material.opacity = 0.38;
  scene.add(grid);

  const objects = new Map<string, THREE.Group>();
  const outlines = new Map<string, THREE.Mesh>();
  const surfaces: THREE.MeshStandardMaterial[] = [];
  for (const object of kilnObjects) {
    const group = new THREE.Group();
    group.userData.objectId = object.id;
    const tint = color(`${object.tint}.300`);
    if (object.kind === "mesh") {
      const geometry =
        object.id === "cube" ? new RoundedBoxGeometry(2, 2, 2, 4, 0.08) : new THREE.SphereGeometry(1, 48, 32);
      const material = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.42, metalness: 0.08 });
      surfaces.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      const outline = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: color("border.accent"), side: THREE.BackSide }),
      );
      outline.scale.setScalar(1.025);
      group.add(outline);
      outlines.set(object.id, outline);
    } else if (object.kind === "light") {
      group.add(new THREE.PointLight(tint, 65, 20));
      group.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: tint })));
      for (const axis of [0, 1, 2]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.32, 0.012, 6, 48),
          new THREE.MeshBasicMaterial({ color: tint }),
        );
        if (axis === 1) ring.rotation.x = Math.PI / 2;
        if (axis === 2) ring.rotation.y = Math.PI / 2;
        group.add(ring);
      }
    } else {
      const material = new THREE.MeshBasicMaterial({ color: tint, wireframe: true });
      group.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.45), material));
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.16, 0.45, 4, 1, true), material);
      lens.rotation.x = Math.PI / 2;
      lens.position.z = -0.4;
      group.add(lens);
    }
    objects.set(object.id, group);
    scene.add(group);
  }

  const selection = new THREE.BoxHelper(objects.get(kilnObjects[0].id)!, color("border.accent"));
  scene.add(selection);
  const render = () => renderer.render(scene, camera);
  const sync = () => {
    const state = kilnStore.getState();
    for (const [id, object] of objects) {
      const value = state.objectStates[id];
      object.position.fromArray(value.position);
      object.rotation.set(...(value.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]));
      object.scale.fromArray(value.scale);
      object.visible = value.visible;
    }
    for (const track of kilnTracks) {
      const object = objects.get(track.objectId);
      if (!object) continue;
      const value = sampleKilnTrack(track.keys, state.frame);
      object[track.property].z += track.property === "rotation" ? THREE.MathUtils.degToRad(value) : value;
    }
    const selectedId = workbench.getPrimaryResource()?.id ?? kilnObjects[0].id;
    const selected = objects.get(selectedId);
    for (const [id, outline] of outlines) outline.visible = id === selectedId;
    selection.visible = Boolean(selected?.visible) && !outlines.has(selectedId);
    if (selected) selection.setFromObject(selected);
    render();
  };
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  controls.addEventListener("change", render);
  const unsubscribe = kilnStore.subscribe(sync);
  const resourceListener = workbench.onDidChangePrimaryResource(sync);

  const pointerStart = new THREE.Vector2();
  const pointerDown = (event: PointerEvent) => pointerStart.set(event.clientX, event.clientY);
  const select = (event: PointerEvent) => {
    if (event.button !== 0 || pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 4) return;
    const rect = canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const visible = [...objects.values()].filter((object) => object.visible);
    const hit = raycaster.intersectObjects(visible, true)[0];
    let target: THREE.Object3D | undefined = hit?.object;
    while (target && !target.userData.objectId) target = target.parent ?? undefined;
    const object = kilnObjects.find((item) => item.id === target?.userData.objectId);
    if (object) workbench.pageLocations.navigate({ kind: "page", page: kilnPage, resource: kilnResource(object) });
  };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointerup", select);
  sync();
  resize();

  return {
    resetView: () => controls.reset(),
    setGrid: (visible: boolean) => {
      grid.visible = visible;
      render();
    },
    setWireframe: (wireframe: boolean) => {
      for (const material of surfaces) material.wireframe = wireframe;
      render();
    },
    dispose: () => {
      observer.disconnect();
      unsubscribe();
      resourceListener.dispose();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", select);
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
        if (object instanceof THREE.Light) object.dispose();
      });
      renderer.dispose();
    },
  };
};
