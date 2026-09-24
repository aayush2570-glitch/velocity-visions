import * as THREE from "three";

export type TrackId = "alpine" | "coast" | "desert";

export type TrackDefinition = {
  id: TrackId;
  name: string;
  location: string;
  lengthLabel: string;
  points: [number, number][];
  ground: string;
  road: string;
  verge: string;
  accent: string;
  tree: string;
  peak: string;
  treeType: "pine" | "palm" | "cactus";
};

export const TRACKS: TrackDefinition[] = [
  {
    id: "alpine",
    name: "Alpine Pass",
    location: "SWISS ALPS · 03 LAPS",
    lengthLabel: "2.4 KM",
    points: [[0, 0], [18, 2], [30, -8], [38, -25], [29, -40], [12, -47], [-8, -43], [-27, -34], [-40, -17], [-35, 0], [-21, 12], [-5, 15]],
    ground: "#48614d",
    road: "#30363c",
    verge: "#ece8de",
    accent: "#c74334",
    tree: "#284c3e",
    peak: "#d9e7e4",
    treeType: "pine",
  },
  {
    id: "coast",
    name: "Azure Coast",
    location: "AMALFI COAST · 03 LAPS",
    lengthLabel: "2.1 KM",
    points: [[0, 0], [17, 2], [30, -8], [35, -24], [25, -38], [7, -43], [-12, -37], [-30, -27], [-37, -10], [-32, 8], [-18, 18], [-2, 14]],
    ground: "#4a756e",
    road: "#343b3c",
    verge: "#eee8dc",
    accent: "#e4553e",
    tree: "#497b55",
    peak: "#f0d7b7",
    treeType: "palm",
  },
  {
    id: "desert",
    name: "Redstone Rally",
    location: "MOJAVE DESERT · 03 LAPS",
    lengthLabel: "2.7 KM",
    points: [[0, 0], [20, 0], [36, -12], [37, -27], [23, -38], [4, -38], [-13, -31], [-30, -22], [-39, -6], [-31, 11], [-15, 16], [1, 13]],
    ground: "#9c7651",
    road: "#393633",
    verge: "#d7c19a",
    accent: "#e8753f",
    tree: "#55784b",
    peak: "#c58c5d",
    treeType: "cactus",
  },
];

export type TrackWorld = {
  curve: THREE.CatmullRomCurve3;
  center: THREE.Vector3[];
  right: THREE.Vector2[];
  cumulative: number[];
  length: number;
};

export function createTrackWorld(definition: TrackDefinition, segments = 240): TrackWorld {
  const controlPoints = definition.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(controlPoints, true, "catmullrom", 0.32);
  const center = curve.getSpacedPoints(segments).slice(0, segments);
  const right: THREE.Vector2[] = [];
  const cumulative = [0];

  for (let i = 0; i < segments; i += 1) {
    const before = center[(i - 1 + segments) % segments];
    const after = center[(i + 1) % segments];
    const dx = after.x - before.x;
    const dz = after.z - before.z;
    const magnitude = Math.hypot(dx, dz) || 1;
    right.push(new THREE.Vector2(dz / magnitude, -dx / magnitude));
    if (i > 0) cumulative.push(cumulative[i - 1] + center[i].distanceTo(center[i - 1]));
  }

  const length = cumulative[segments - 1] + center[segments - 1].distanceTo(center[0]);
  return { curve, center, right, cumulative, length };
}

export function sampleTrack(world: TrackWorld, distance: number, laneOffset = 0) {
  const wrappedDistance = ((distance % world.length) + world.length) % world.length;
  let low = 0;
  let high = world.cumulative.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (world.cumulative[middle] < wrappedDistance) low = middle + 1;
    else high = middle;
  }

  const next = low % world.center.length;
  const current = (next - 1 + world.center.length) % world.center.length;
  const startDistance = current > next ? world.cumulative[current] : world.cumulative[current];
  const endDistance = next === 0 ? world.length : world.cumulative[next];
  const span = Math.max(0.0001, endDistance - startDistance);
  const amount = THREE.MathUtils.clamp((wrappedDistance - startDistance) / span, 0, 1);
  const point = world.center[current].clone().lerp(world.center[next], amount);
  const sideways = world.right[current].clone().lerp(world.right[next], amount).normalize();
  const before = world.center[current];
  const after = world.center[next];
  const tangentX = after.x - before.x;
  const tangentZ = after.z - before.z;
  point.x += sideways.x * laneOffset;
  point.z += sideways.y * laneOffset;
  return {
    x: point.x,
    z: point.z,
    yaw: Math.atan2(tangentX, tangentZ),
    tangentX,
    tangentZ,
  };
}

export function buildRibbon(world: TrackWorld, halfWidth: number, height: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  const count = world.center.length;

  for (let i = 0; i < count; i += 1) {
    const point = world.center[i];
    const right = world.right[i];
    positions.push(
      point.x - right.x * halfWidth, height, point.z - right.y * halfWidth,
      point.x + right.x * halfWidth, height, point.z + right.y * halfWidth,
    );
    const next = (i + 1) % count;
    const a = i * 2;
    const b = next * 2;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGroundTexture(color: string, seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = color;
  context.fillRect(0, 0, 256, 256);
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < 900; i += 1) {
    const shade = random() > 0.5 ? "rgba(255,255,255,.07)" : "rgba(15,20,16,.11)";
    context.fillStyle = shade;
    const size = random() * 2 + 1;
    context.fillRect(random() * 256, random() * 256, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 14);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const RACERS = [
  { name: "YOU", color: "#d8fa48", lane: 0 },
  { name: "NOVA", color: "#e65b48", lane: -3.5 },
  { name: "KAI", color: "#57a9d8", lane: 3.5 },
  { name: "MILA", color: "#f2e4ca", lane: -1.75 },
  { name: "JAX", color: "#e9a43b", lane: 1.75 },
];