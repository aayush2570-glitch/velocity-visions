import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, PerspectiveCamera, Sky, useGLTF } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { createGroundTexture, createTrackWorld, buildRibbon, RACERS, sampleTrack, TRACKS, type TrackDefinition, type TrackId, type TrackWorld } from "@/lib/racing";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";

type RacePhase = "ready" | "countdown" | "racing" | "paused" | "finished";
type Telemetry = { speed: number; lap: number; place: number; elapsed: number; progress: number; boost: number };
type RaceRecord = { distance: number; lateral: number; speed: number; lateralSpeed: number; yaw: number; boost: number; drift: number };

const LAP_COUNT = 3;
const ZERO_TELEMETRY: Telemetry = { speed: 0, lap: 1, place: 1, elapsed: 0, progress: 0, boost: 100 };

function carRecord(distance: number): RaceRecord {
  return { distance, lateral: 0, speed: 0, lateralSpeed: 0, yaw: 0, boost: 100, drift: 0 };
}

function useRaceKeys() {
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
      keys.current.add(event.code);
    };
    const onUp = (event: KeyboardEvent) => keys.current.delete(event.code);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);
  return keys;
}

function TrackScenery({ definition, world }: { definition: TrackDefinition; world: TrackWorld }) {
  const objects = useMemo(() => {
    const items: { x: number; z: number; scale: number; type: string; rotation: number }[] = [];
    for (let i = 0; i < world.center.length; i += 6) {
      const point = world.center[i];
      const right = world.right[i];
        if (!point || !right) continue;
      for (const side of [-1, 1]) {
        const wobble = Math.sin(i * 12.9898 + side * 78.233) * 1.8;
        const offset = side * (15.5 + wobble);
        items.push({
          x: point.x + right.x * offset,
          z: point.z + right.y * offset,
          scale: 0.75 + (Math.sin(i * 2.1 + side) * 0.5 + 0.5) * 0.8,
          type: definition.treeType,
          rotation: Math.sin(i * 0.71) * 0.22,
        });
      }
    }
    return items;
  }, [definition.treeType, world]);

  return (
    <>
      {objects.map((item, index) => (
        <group key={index} position={[item.x, 0, item.z]} rotation-y={item.rotation} scale={item.scale}>
          {item.type === "pine" ? (
            <>
              <mesh position={[0, 0.65, 0]} castShadow>
                <cylinderGeometry args={[0.13, 0.24, 1.3, 7]} />
                <meshStandardMaterial color="#725846" roughness={1} />
              </mesh>
              <mesh position={[0, 1.55, 0]} castShadow>
                <coneGeometry args={[0.8, 2.2, 7]} />
                <meshStandardMaterial color={definition.tree} roughness={0.94} flatShading />
              </mesh>
              <mesh position={[0, 2.25, 0]} castShadow>
                <coneGeometry args={[0.57, 1.8, 7]} />
                <meshStandardMaterial color={definition.tree} roughness={0.94} flatShading />
              </mesh>
            </>
          ) : item.type === "palm" ? (
            <>
              <mesh position={[0, 1.45, 0]} rotation-z={0.09} castShadow>
                <cylinderGeometry args={[0.16, 0.26, 3, 7]} />
                <meshStandardMaterial color="#917052" roughness={0.88} />
              </mesh>
              {Array.from({ length: 6 }, (_, leaf) => (
                <mesh key={leaf} position={[0, 2.82, 0]} rotation-y={(leaf / 6) * Math.PI * 2} rotation-z={-0.72} castShadow>
                  <boxGeometry args={[0.17, 1.8, 0.34]} />
                  <meshStandardMaterial color={definition.tree} roughness={0.84} />
                </mesh>
              ))}
            </>
          ) : (
            <>
              <mesh position={[0, 0.62, 0]} castShadow>
                <cylinderGeometry args={[0.22, 0.28, 1.25, 7]} />
                <meshStandardMaterial color="#6b8754" roughness={0.9} />
              </mesh>
              <mesh position={[0.35, 0.65, 0]} rotation-z={-0.85} castShadow>
                <cylinderGeometry args={[0.12, 0.16, 0.85, 7]} />
                <meshStandardMaterial color="#6b8754" roughness={0.9} />
              </mesh>
              <mesh position={[-0.29, 0.86, 0]} rotation-z={0.8} castShadow>
                <cylinderGeometry args={[0.11, 0.15, 0.77, 7]} />
                <meshStandardMaterial color="#6b8754" roughness={0.9} />
              </mesh>
            </>
          )}
        </group>
      ))}
      {definition.id === "alpine" && <Mountains color={definition.peak} />}
      {definition.id === "coast" && <CoastWater />}
      {definition.id === "desert" && <DesertRocks color={definition.peak} />}
    </>
  );
}

function Mountains({ color }: { color: string }) {
  return (
    <group>
      {Array.from({ length: 17 }, (_, i) => {
        const angle = (i / 17) * Math.PI * 2;
        const radius = 58 + (i % 3) * 3;
        return (
          <group key={i} position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]} rotation-y={angle}>
            <mesh position={[0, 10 + (i % 4) * 2, -12]} castShadow>
              <coneGeometry args={[13 + (i % 3) * 2, 31 + (i % 4) * 4, 5]} />
              <meshStandardMaterial color={i % 3 === 0 ? color : "#778981"} roughness={1} flatShading />
            </mesh>
            <mesh position={[0, 23 + (i % 4) * 2, -12]}>
              <coneGeometry args={[5.3 + (i % 3), 12, 5]} />
              <meshStandardMaterial color="#e3e8e3" roughness={1} flatShading />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function CoastWater() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[63, -0.8, -7]}>
        <planeGeometry args={[160, 150]} />
        <meshStandardMaterial color="#4c9da0" roughness={0.28} metalness={0.2} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} position={[50 + (i % 4) * 4, 0.04 + (i % 3) * 0.02, -40 + i * 5]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[2.5 + (i % 3), 0.07]} />
          <meshBasicMaterial color="#9bd1ca" transparent opacity={0.42} />
        </mesh>
      ))}
    </>
  );
}

function DesertRocks({ color }: { color: string }) {
  return (
    <>
      {Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2;
        const radius = 55 + (i % 4) * 4;
        return (
          <mesh key={i} position={[Math.sin(angle) * radius, 0.85 + (i % 3) * 0.45, Math.cos(angle) * radius]} rotation={[0.2, angle, 0.12]} scale={[1.2 + (i % 4) * 0.4, 1.2 + (i % 3) * 0.5, 1]} castShadow>
            <dodecahedronGeometry args={[2.6 + (i % 3) * 0.6, 0]} />
            <meshStandardMaterial color={color} roughness={1} flatShading />
          </mesh>
        );
      })}
    </>
  );
}

function RaceTrack({ definition, world }: { definition: TrackDefinition; world: TrackWorld }) {
  const groundTexture = useMemo(() => createGroundTexture(definition.ground, definition.id === "alpine" ? 27 : definition.id === "coast" ? 67 : 91), [definition]);
  const shoulder = useMemo(() => buildRibbon(world, 10.8, 0.015), [world]);
  const road = useMemo(() => buildRibbon(world, 8.1, 0.055), [world]);
  const edgeLeft = useMemo(() => buildRibbon(world, 7.88, 0.073), [world]);
  const edgeRight = useMemo(() => buildRibbon(world, 8.13, 0.073), [world]);

  useEffect(() => () => {
    shoulder.dispose(); road.dispose(); edgeLeft.dispose(); edgeRight.dispose(); groundTexture?.dispose();
  }, [edgeLeft, edgeRight, groundTexture, road, shoulder]);

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.12} receiveShadow>
        <planeGeometry args={[280, 280]} />
        <meshStandardMaterial map={groundTexture ?? null} color={definition.ground} roughness={1} />
      </mesh>
      <TrackScenery definition={definition} world={world} />
      <mesh receiveShadow position-y={-0.02}>
        <primitive object={shoulder} attach="geometry" />
        <meshStandardMaterial color={definition.verge} roughness={0.92} />
      </mesh>
      <mesh receiveShadow position-y={0.02}>
        <primitive object={road} attach="geometry" />
        <meshStandardMaterial color={definition.road} roughness={0.84} metalness={0.04} />
      </mesh>
      <mesh position-y={0.01}>
        <primitive object={edgeLeft} attach="geometry" />
        <meshStandardMaterial color={definition.accent} roughness={0.64} />
      </mesh>
      <mesh position-y={0.01}>
        <primitive object={edgeRight} attach="geometry" />
        <meshStandardMaterial color={definition.accent} roughness={0.64} />
      </mesh>
      <TrackDetails world={world} />
    </>
  );
}

function TrackDetails({ world }: { world: TrackWorld }) {
  const dashes = useMemo(() => {
    const lines: [number, number, number, number][] = [];
    for (let distance = 7; distance < world.length; distance += 14) {
      const start = sampleTrack(world, distance, 0);
      const end = sampleTrack(world, distance + 2.1, 0);
      lines.push([start.x, start.z, end.x, end.z]);
    }
    return lines;
  }, [world]);

  return (
    <group>
      {dashes.map(([x1, z1, x2, z2], index) => {
        const x = (x1 + x2) / 2;
        const z = (z1 + z2) / 2;
        const yaw = Math.atan2(x2 - x1, z2 - z1);
        return (
          <mesh key={index} position={[x, 0.08, z]} rotation-y={yaw}>
            <boxGeometry args={[0.14, 0.015, 2.1]} />
            <meshStandardMaterial color="#d5d3ca" roughness={0.8} />
          </mesh>
        );
      })}
      <StartGrid world={world} />
    </group>
  );
}

function StartGrid({ world }: { world: TrackWorld }) {
  const start = sampleTrack(world, 1, 0);
  return (
    <group position={[start.x, 0.09, start.z]} rotation-y={start.yaw}>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[(i % 2 === 0 ? -1 : 1) * 7.8 + 0.65, 0, Math.floor(i / 2) * 0.55 - 1.5]}>
          <boxGeometry args={[1.3, 0.025, 0.55]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#f5f0e5" : "#202323"} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function CarModel({ color, reference }: { color: string; reference?: (group: THREE.Group | null) => void }) {
  const { scene } = useGLTF("/models/racer/race.glb");
  const car = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as THREE.Group;
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const existingMaterial = mesh.material;
      if (!existingMaterial) return;
      const original = Array.isArray(existingMaterial) ? existingMaterial : [existingMaterial];
      const painted = original.map((material) => {
        const copy = material.clone();
        const standard = copy as THREE.MeshStandardMaterial;
        standard.color.set(color);
        standard.map = null;
        standard.roughness = 0.32;
        standard.metalness = 0.34;
        return copy;
      });
      const singlePainted = painted[0];
      if (Array.isArray(existingMaterial)) mesh.material = painted;
      else if (singlePainted) mesh.material = singlePainted;
    });
    return clone;
  }, [color, scene]);

  useEffect(() => () => {
    car.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }, [car]);

  return <primitive ref={reference} object={car} scale={1.6} position-y={0.08} />;
}

function WorldScene({
  definition,
  phase,
  elapsed,
  resetKey,
  controls,
  onTelemetry,
  onFinish,
}: {
  definition: TrackDefinition;
  phase: RacePhase;
  elapsed: number;
  resetKey: number;
  controls: React.MutableRefObject<{ steer: number; throttle: number; brake: number; boost: boolean }>;
  onTelemetry: (value: Telemetry) => void;
  onFinish: (place: number) => void;
}) {
  const world = useMemo(() => createTrackWorld(definition), [definition]);
  const keys = useRaceKeys();
  const playerRef = useRef<THREE.Group>(null);
  const opponentRefs = useRef<Array<THREE.Group | null>>([]);
  const carStates = useRef<RaceRecord[]>(RACERS.map((_, index) => carRecord(-index * 3.4)));
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  const cameraLook = useMemo(() => new THREE.Vector3(), []);
  const worldForward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const telemetryClock = useRef(0);
  const finished = useRef(false);
  const hasStarted = phase === "racing" || phase === "paused" || phase === "finished";

  useEffect(() => {
    carStates.current = RACERS.map((_, index) => carRecord(-index * 3.4));
    finished.current = false;
    telemetryClock.current = 0;
  }, [resetKey, world]);

  useEffect(() => {
    RACERS.forEach((_, index) => {
      const pose = sampleTrack(world, carStates.current[index]?.distance ?? -index * 3.4, RACERS[index]?.lane ?? 0);
      if (index === 0 && playerRef.current) {
        playerRef.current.position.set(pose.x, 0, pose.z);
        playerRef.current.rotation.y = pose.yaw;
      }
      const opponent = opponentRefs.current[index];
      if (opponent) {
        opponent.position.set(pose.x, 0, pose.z);
        opponent.rotation.y = pose.yaw;
      }
    });
  }, [resetKey, world]);

  useFrame(({ camera }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const player = carStates.current[0];
    if (!player) return;
    const moving = phase === "racing";
    const keyboard = keys.current;
    const steer = THREE.MathUtils.clamp(
      controls.current.steer + (keyboard.has("KeyD") || keyboard.has("ArrowRight") ? 1 : 0) - (keyboard.has("KeyA") || keyboard.has("ArrowLeft") ? 1 : 0),
      -1,
      1,
    );
    const throttle = Math.max(controls.current.throttle, keyboard.has("KeyW") || keyboard.has("ArrowUp") ? 1 : 0);
    const brake = Math.max(controls.current.brake, keyboard.has("KeyS") || keyboard.has("ArrowDown") ? 1 : 0);
    const boosting = controls.current.boost || keyboard.has("ShiftLeft") || keyboard.has("ShiftRight");
    const drifting = keyboard.has("Space") && player.speed > 8 && steer !== 0;

    if (moving) {
      const offRoad = Math.abs(player.lateral) > 6.6;
      const topSpeed = offRoad ? 9.5 : 28.5;
      player.speed += throttle * (boosting && player.boost > 0 ? 30 : 18) * dt;
      player.speed -= brake * 25 * dt;
      player.speed -= player.speed * (offRoad ? 2.1 : drifting ? 0.9 : 0.45) * dt;
      if (boosting && player.boost > 0) {
        player.speed = Math.min(topSpeed + 9, player.speed);
        player.boost = Math.max(0, player.boost - dt * 29);
      } else {
        player.boost = Math.min(100, player.boost + dt * (drifting ? 9 : 4.2));
      }
      player.speed = THREE.MathUtils.clamp(player.speed, 0, topSpeed + (boosting ? 9 : 0));
      player.lateralSpeed += steer * (5.6 + player.speed * (drifting ? 0.34 : 0.24)) * dt;
      player.lateralSpeed *= Math.exp(-(brake > 0 ? 1.55 : drifting ? 1.4 : 4.6) * dt);
      player.lateral += player.lateralSpeed * dt;
      player.lateral = THREE.MathUtils.clamp(player.lateral, -8.6, 8.6);
      player.distance += player.speed * dt;
      const driftTarget = player.lateralSpeed * Math.min(player.speed / 20, 1) * (drifting ? 1.8 : 1);
      player.drift = THREE.MathUtils.damp(player.drift, driftTarget, 6, dt);
    } else {
      player.speed = Math.max(0, player.speed - player.speed * 2.2 * dt);
      player.drift = THREE.MathUtils.damp(player.drift, 0, 4, dt);
    }

    const playerPose = sampleTrack(world, player.distance, player.lateral);
    if (playerRef.current) {
      playerRef.current.position.set(playerPose.x, 0, playerPose.z);
      playerRef.current.rotation.y = playerPose.yaw + THREE.MathUtils.clamp(-player.lateralSpeed * 0.025, -0.35, 0.35);
      const visual = playerRef.current.children[0];
      if (visual) visual.rotation.z = THREE.MathUtils.damp(visual.rotation.z, -player.drift * 0.012, 5, dt);
    }

    for (let index = 1; index < RACERS.length; index += 1) {
      const opponent = carStates.current[index];
      if (!opponent) continue;
      const pace = [22.2, 23.1, 21.4, 22.6][index - 1] ?? 22;
      const variation = Math.sin(elapsed * 0.47 + index * 1.9) * 1.1 + Math.sin(elapsed * 0.17 + index) * 0.65;
      const desiredSpeed = pace + variation;
      opponent.speed = THREE.MathUtils.damp(opponent.speed, moving ? desiredSpeed : 0, 1.4, dt);
      if (moving) opponent.distance += opponent.speed * dt;
      const pose = sampleTrack(world, opponent.distance, RACERS[index]?.lane ?? 0);
      const group = opponentRefs.current[index];
      if (group) {
        group.position.set(pose.x, 0, pose.z);
        group.rotation.y = pose.yaw;
        const child = group.children[0];
        if (child) child.rotation.z = Math.sin(elapsed * 3 + index) * 0.018;
      }
    }

    const standings = carStates.current
      .map((record, index) => ({ index, distance: record.distance }))
      .sort((a, b) => b.distance - a.distance);
    const place = standings.findIndex((entry) => entry.index === 0) + 1;

    if (phase === "racing") {
      telemetryClock.current += dt;
      if (telemetryClock.current >= 0.11) {
        telemetryClock.current = 0;
        onTelemetry({ speed: Math.round(player.speed * 4.8), lap: Math.min(LAP_COUNT, Math.floor(player.distance / world.length) + 1), place, elapsed: Math.max(0, elapsed), progress: player.distance / (world.length * LAP_COUNT), boost: player.boost });
      }
      if (player.distance >= world.length * LAP_COUNT && !finished.current) {
        finished.current = true;
        onFinish(place);
      }
    }

    const followPose = sampleTrack(world, player.distance, player.lateral);
    const forwardX = Math.sin(followPose.yaw);
    const forwardZ = Math.cos(followPose.yaw);
    cameraTarget.set(followPose.x - forwardX * 12.6, 7.4, followPose.z - forwardZ * 12.6);
    camera.position.lerp(cameraTarget, 1 - Math.exp(-3.3 * dt));
    cameraLook.set(followPose.x + forwardX * 4.4, 1.05, followPose.z + forwardZ * 4.4);
    camera.lookAt(cameraLook);
  });

  const startDistance = 0;
  const playerStart = sampleTrack(world, startDistance, 0);
  const mapFog = definition.id === "coast" ? "#aec9c1" : definition.id === "desert" ? "#c9aa7e" : "#b5c8c1";
  const groundTexture = useMemo(() => createGroundTexture(definition.ground, 11), [definition]);
  useEffect(() => () => groundTexture?.dispose(), [groundTexture]);

  return (
    <>
      <color attach="background" args={[mapFog]} />
      <fog attach="fog" args={[mapFog, 92, 180]} />
      <Sky sunPosition={[45, 28, -35]} turbidity={6} rayleigh={1.15} mieCoefficient={0.003} mieDirectionalG={0.84} />
      <hemisphereLight args={["#e0f1f1", definition.ground, 1.45]} />
      <directionalLight position={[-24, 36, 18]} intensity={2.35} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-52} shadow-camera-right={52} shadow-camera-top={52} shadow-camera-bottom={-52} shadow-bias={-0.00025} />
      <Environment resolution={128}>
        <Lightformer intensity={2.4} position={[5, 8, 0]} scale={[9, 7, 1]} />
        <Lightformer intensity={1.35} position={[-8, 5, -4]} rotation-y={Math.PI / 3} scale={[10, 6, 1]} />
      </Environment>
      <PerspectiveCamera makeDefault fov={56} position={[playerStart.x, 7.4, playerStart.z - 13]} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.3}>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial map={groundTexture ?? null} color={definition.ground} roughness={1} />
      </mesh>
      <RaceTrack definition={definition} world={world} />
      {RACERS.map((racer, index) => (
        <group
          key={racer.name}
          ref={(group) => {
            if (index === 0) playerRef.current = group;
            else opponentRefs.current[index] = group;
          }}
          position={[playerStart.x, 0, playerStart.z]}
          rotation-y={playerStart.yaw}
        >
          {index === 0 && <pointLight position={[0, 1.1, 2.1]} color="#e6fd78" intensity={1.1} distance={4.2} />}
          <Suspense fallback={<CarStandIn color={racer.color} />}>
            <CarModel color={racer.color} />
          </Suspense>
          {index > 0 && <RacerMarker name={racer.name} color={racer.color} />}
        </group>
      ))}
      {!hasStarted && <StartLights world={world} />}
    </>
  );
}

function CarStandIn({ color }: { color: string }) {
  const wheelPositions: [number, number, number][] = [
    [-0.56, 0.2, 0.7],
    [0.56, 0.2, 0.7],
    [-0.56, 0.2, -0.7],
    [0.56, 0.2, -0.7],
  ];
  return (
    <group scale={1.6} position-y={0.08}>
      <mesh position={[0, 0.28, 0]} castShadow><boxGeometry args={[1.1, 0.42, 2.4]} /><meshStandardMaterial color={color} metalness={0.28} roughness={0.38} /></mesh>
      <mesh position={[0, 0.56, -0.2]} castShadow><boxGeometry args={[0.84, 0.4, 1.05]} /><meshStandardMaterial color="#34434a" roughness={0.22} metalness={0.32} /></mesh>
      {wheelPositions.map(([x, y, z], i) => <mesh key={i} position={[x, y, z]} rotation-z={Math.PI / 2} castShadow><cylinderGeometry args={[0.23, 0.23, 0.18, 12]} /><meshStandardMaterial color="#202527" roughness={0.88} /></mesh>)}
    </group>
  );
}

function RacerMarker({ name, color }: { name: string; color: string }) {
  return (
    <group position={[0, 2.25, 0]}>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.055, 10, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <group position={[0, 0.9, 0]}>
        <RacerLabel name={name} color={color} />
      </group>
    </group>
  );
}

function RacerLabel({ name, color }: { name: string; color: string }) {
  return (
    <mesh>
      <planeGeometry args={[1.45, 0.44]} />
      <meshBasicMaterial color={color} transparent opacity={0.88} side={THREE.DoubleSide} />
      <RacerText name={name} />
    </mesh>
  );
}

function RacerText({ name }: { name: string }) {
  const canvas = useMemo(() => {
    const node = document.createElement("canvas");
    node.width = 256; node.height = 80;
    const ctx = node.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#111514";
      ctx.font = "800 38px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, 128, 42);
    }
    return new THREE.CanvasTexture(node);
  }, [name]);
  useEffect(() => () => canvas.dispose(), [canvas]);
  return (
    <mesh position={[0, 0, 0.008]}>
      <planeGeometry args={[1.45, 0.44]} />
      <meshBasicMaterial map={canvas} transparent side={THREE.DoubleSide} />
    </mesh>
  );
}

function StartLights({ world }: { world: TrackWorld }) {
  const start = sampleTrack(world, 3, 0);
  return (
    <group position={[start.x, 0, start.z]} rotation-y={start.yaw}>
      <mesh position={[0, 5.2, -0.5]} castShadow><boxGeometry args={[10, 0.25, 0.35]} /><meshStandardMaterial color="#202626" metalness={0.52} roughness={0.4} /></mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} position={[-4 + i * 2, 5.2, -0.2]}>
          <mesh><sphereGeometry args={[0.52, 16, 12]} /><meshStandardMaterial color="#552e2d" emissive="#ed4437" emissiveIntensity={0.78} roughness={0.25} /></mesh>
        </group>
      ))}
      <mesh position={[-10, 2.6, 0]} castShadow><boxGeometry args={[0.16, 5.2, 0.18]} /><meshStandardMaterial color="#e9e6dd" metalness={0.22} roughness={0.42} /></mesh>
      <mesh position={[10, 2.6, 0]} castShadow><boxGeometry args={[0.16, 5.2, 0.18]} /><meshStandardMaterial color="#e9e6dd" metalness={0.22} roughness={0.42} /></mesh>
    </group>
  );
}

function TrackMap({ track, selected = false }: { track: TrackDefinition; selected?: boolean }) {
  const points = useMemo(() => {
    const xs = track.points.map(([x]) => x);
    const zs = track.points.map(([, z]) => z);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    return track.points.map(([x, z]) => `${14 + ((x - minX) / (maxX - minX || 1)) * 82},${12 + ((z - minZ) / (maxZ - minZ || 1)) * 49}`).join(" ");
  }, [track]);
  return (
    <svg viewBox="0 0 110 74" className="h-full w-full" aria-hidden="true">
      <polyline points={`${points} ${points.split(" ")[0]}`} fill="none" stroke="currentColor" strokeWidth="11" strokeLinejoin="round" strokeLinecap="round" className="text-race-verge" />
      <polyline points={`${points} ${points.split(" ")[0]}`} fill="none" stroke="currentColor" strokeWidth="7.5" strokeLinejoin="round" strokeLinecap="round" className="text-race-road" />
      <polyline points={`${points} ${points.split(" ")[0]}`} fill="none" stroke="currentColor" strokeWidth="0.65" strokeDasharray="2 2.5" className={selected ? "text-race-accent" : "text-muted-foreground"} />
      <circle cx="14" cy="12" r="3" className={selected ? "fill-race-accent" : "fill-muted-foreground"} />
    </svg>
  );
}

export function RacingGame() {
  const [trackId, setTrackId] = useState<TrackId>("alpine");
  const [phase, setPhase] = useState<RacePhase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [telemetry, setTelemetry] = useState(ZERO_TELEMETRY);
  const [finalPlace, setFinalPlace] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  const [muted, setMuted] = useState(true);
  const controls = useRef({ steer: 0, throttle: 0, brake: 0, boost: false });
  const activeTrack = TRACKS.find((track) => track.id === trackId) ?? TRACKS[0]!;

  useEffect(() => {
    if (phase !== "countdown" && phase !== "racing") return;
    const timer = window.setInterval(() => {
      setElapsed((previous) => {
        const next = previous + 0.05;
        if (next >= 3 && phase === "countdown") setPhase("racing");
        return next;
      });
    }, 50);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Escape") return;
      setPhase((current) => current === "racing" ? "paused" : current === "paused" ? "racing" : current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const startRace = useCallback(() => {
    setTelemetry(ZERO_TELEMETRY);
    setElapsed(0);
    setFinalPlace(1);
    setResetKey((value) => value + 1);
    setPhase("countdown");
  }, []);

  const finishRace = useCallback((place: number) => {
    setFinalPlace(place);
    setPhase("finished");
  }, []);

  const raceTime = Math.max(0, elapsed - 3);
  const countdown = Math.max(1, 3 - Math.floor(elapsed));
  const formattedTime = `${String(Math.floor(raceTime / 60)).padStart(2, "0")}:${(raceTime % 60).toFixed(2).padStart(5, "0")}`;

  const setControl = (key: keyof typeof controls.current, value: number | boolean) => {
    controls.current = { ...controls.current, [key]: value };
  };

  return (
    <main className="racer-shell relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-race-surface text-race-ink">
      <Canvas className="absolute inset-0" shadows dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} camera={{ position: [0, 7, 13], fov: 56 }}>
        <WorldScene definition={activeTrack} phase={phase} elapsed={raceTime} resetKey={resetKey} controls={controls} onTelemetry={setTelemetry} onFinish={finishRace} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-race-veil via-transparent to-race-veil/70" />

      <header className="absolute inset-x-0 top-0 z-10 flex h-[76px] items-center justify-between border-b border-race-line/65 px-5 md:px-10">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-race-accent text-race-accent-ink"><span className="text-lg font-black italic">A</span></div>
          <div>
            <div className="text-[13px] font-black leading-none tracking-[0.17em]">APEX / DRIVE</div>
            <div className="mt-1.5 text-[9px] font-semibold tracking-[0.19em] text-muted-foreground">MOTORSPORT SERIES</div>
          </div>
        </div>
        <div className="hidden items-center gap-2.5 sm:flex">
          <span className={`h-1.5 w-1.5 rounded-full ${phase === "racing" ? "animate-pulse bg-race-accent" : "bg-race-muted"}`} />
          <span className="text-[10px] font-bold tracking-[0.19em] text-race-soft">{phase === "racing" ? "LIVE SESSION" : phase === "paused" ? "SESSION PAUSED" : "WORLD TOUR · 2026"}</span>
        </div>
        <Button variant="ghost" size="icon" className="pointer-events-auto h-10 w-10 text-race-ink hover:bg-race-panel/70" title={muted ? "Turn sound on" : "Mute sound"} aria-label={muted ? "Turn sound on" : "Mute sound"} onClick={() => setMuted((value) => !value)}>
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
      </header>

      {(phase === "ready" || phase === "finished") && (
        <section className="pointer-events-none absolute inset-x-0 top-[76px] bottom-0 z-10 flex flex-col justify-between px-5 py-6 md:px-10 md:py-8">
          <div className="pointer-events-auto flex max-w-[470px] flex-col gap-4 pt-1 sm:pt-5">
            <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.22em] text-race-accent">
              <span className="h-px w-7 bg-race-accent" /> RACE SERIES <span className="text-race-soft">/ ROUND 01</span>
            </div>
            <h1 className="max-w-[450px] text-[clamp(3rem,8vw,6.4rem)] font-black leading-[0.82] tracking-[-0.04em] text-race-ink">{phase === "finished" ? "RACE\nCOMPLETE" : "OWN THE\nAPEX."}</h1>
            <p className="max-w-[350px] text-sm leading-6 text-race-soft">{phase === "finished" ? `You crossed the line ${ordinal(finalPlace)}. A new run is waiting.` : "Five drivers. Three laps. One clean line through the corner."}</p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={startRace} className="h-12 rounded-md bg-race-accent px-6 text-[11px] font-black tracking-[0.12em] text-race-accent-ink hover:bg-race-accent/90">
                {phase === "finished" ? <RotateCcw /> : <Play fill="currentColor" />} {phase === "finished" ? "RACE AGAIN" : "START RACE"}
              </Button>
              <div className="border-l border-race-line pl-4 text-[10px] font-bold leading-[1.8] tracking-[0.1em] text-race-soft"><span className="text-race-ink">03 LAPS</span><br />5 DRIVERS</div>
            </div>
          </div>

          <div className="pointer-events-auto flex w-full flex-col gap-3 pb-1 md:max-w-[820px]">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[9px] font-extrabold tracking-[0.22em] text-race-accent">CHOOSE YOUR CIRCUIT</div>
                <div className="mt-1 text-[11px] text-race-soft">Three destinations. Your line.</div>
              </div>
              <span className="text-[9px] font-bold tracking-[0.16em] text-race-soft">{String(TRACKS.findIndex((track) => track.id === trackId) + 1).padStart(2, "0")} <span className="opacity-45">/ 03</span></span>
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {TRACKS.map((track, index) => (
                <button key={track.id} type="button" onClick={() => { setTrackId(track.id); setTelemetry(ZERO_TELEMETRY); }} aria-pressed={trackId === track.id} className={`group relative flex min-h-[106px] items-center gap-2 overflow-hidden rounded-md border px-2 py-2 text-left transition-all sm:min-h-[124px] sm:gap-3 sm:px-3 ${trackId === track.id ? "border-race-accent bg-race-panel/90 shadow-[inset_0_0_0_1px_var(--color-race-accent)]" : "border-race-line/85 bg-race-panel/80 hover:border-race-soft"}`}>
                  <div className="h-[64px] w-[82px] shrink-0 sm:h-[80px] sm:w-[100px]"><TrackMap track={track} selected={trackId === track.id} /></div>
                  <div className="min-w-0 self-center">
                    <div className="text-[9px] font-bold tracking-[0.14em] text-race-accent">CIRCUIT 0{index + 1}</div>
                    <div className="mt-1 truncate text-[11px] font-black tracking-[0.005em] text-race-ink sm:text-sm">{track.name}</div>
                    <div className="mt-1 truncate text-[8px] font-semibold tracking-[0.08em] text-race-soft">{track.lengthLabel} <span className="hidden sm:inline">· {track.location.split(" · ")[0]}</span></div>
                  </div>
                  {trackId === track.id && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-race-accent" />}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {phase === "countdown" && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="text-center">
            <div className="text-[10px] font-extrabold tracking-[0.28em] text-race-ink">GET READY</div>
            <div className="mt-1 text-[clamp(7rem,24vw,15rem)] font-black leading-none text-race-accent [text-shadow:0_8px_35px_var(--color-race-shadow)]">{countdown}</div>
          </div>
        </div>
      )}

      {(phase === "racing" || phase === "paused") && (
        <>
          <section className="pointer-events-none absolute inset-x-0 top-[88px] z-10 flex items-start justify-between px-5 md:px-10">
            <div className="flex items-start gap-4 rounded-md border border-race-line/65 bg-race-panel/75 px-4 py-3 backdrop-blur-md sm:gap-6 sm:px-5">
              <div><div className="text-[9px] font-extrabold tracking-[0.19em] text-race-soft">POSITION</div><div className="mt-0.5 text-[28px] font-black leading-none tabular-nums">{String(telemetry.place).padStart(2, "0")}<span className="ml-1 text-[11px] text-race-accent">/ 05</span></div></div>
              <div className="h-10 w-px bg-race-line" />
              <div><div className="text-[9px] font-extrabold tracking-[0.19em] text-race-soft">LAP</div><div className="mt-0.5 text-[28px] font-black leading-none tabular-nums">{String(telemetry.lap).padStart(2, "0")}<span className="mx-1 text-race-soft">/</span><span className="text-race-soft">03</span></div></div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-[10px] font-bold tracking-[0.14em] text-race-ink sm:block">{activeTrack.name.toUpperCase()}</span>
              <Button variant="ghost" size="icon" className="pointer-events-auto h-10 w-10 rounded-md border border-race-line/65 bg-race-panel/75 text-race-ink backdrop-blur-md hover:bg-race-panel" title={phase === "paused" ? "Resume race" : "Pause race"} aria-label={phase === "paused" ? "Resume race" : "Pause race"} onClick={() => setPhase((current) => current === "paused" ? "racing" : "paused")}>
                {phase === "paused" ? <Play fill="currentColor" /> : <Pause />}
              </Button>
            </div>
          </section>

          <section className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-5 pb-6 md:px-10 md:pb-8">
            <div className="flex flex-col gap-2">
              <div className="rounded-md border border-race-line/65 bg-race-panel/75 px-4 py-3 backdrop-blur-md">
                <div className="text-[9px] font-extrabold tracking-[0.19em] text-race-soft">RACE TIME</div>
                <div className="mt-1 font-mono text-xl font-bold tabular-nums">{formattedTime}</div>
              </div>
              <div className="w-[158px] rounded-md border border-race-line/65 bg-race-panel/75 px-3 py-2.5 backdrop-blur-md sm:w-[180px]">
                <div className="mb-1.5 flex items-center justify-between text-[9px] font-extrabold tracking-[0.16em]"><span className="text-race-soft">NITRO</span><span className="text-race-accent">{Math.round(telemetry.boost)}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-sm bg-race-line"><div className="h-full bg-race-accent transition-[width] duration-100" style={{ width: `${telemetry.boost}%` }} /></div>
              </div>
            </div>
            <div className="flex items-end gap-2 sm:gap-4">
              <div className="mb-1 flex gap-1 sm:hidden">
                <TouchControl label="Steer left" display="←" onPress={() => setControl("steer", -1)} onRelease={() => setControl("steer", 0)} />
                <TouchControl label="Steer right" display="→" onPress={() => setControl("steer", 1)} onRelease={() => setControl("steer", 0)} />
              </div>
              <div className="text-right">
                <div className="text-[9px] font-extrabold tracking-[0.19em] text-race-ink">SPEED</div>
                <div className="flex items-baseline gap-1"><span className="text-[42px] font-black leading-none tabular-nums sm:text-[56px]">{String(telemetry.speed).padStart(3, "0")}</span><span className="text-[10px] font-extrabold text-race-accent">MPH</span></div>
              </div>
              <div className="hidden h-[58px] w-px bg-race-line sm:block" />
              <div className="hidden gap-1 sm:flex">
                <div className="grid h-8 w-8 place-items-center rounded-sm border border-race-line/75 bg-race-panel/80 text-[9px] font-black text-race-ink">W</div>
                <div className="mt-9 grid h-8 w-8 place-items-center rounded-sm border border-race-line/75 bg-race-panel/80 text-[9px] font-black text-race-ink">A</div>
                <div className="mt-9 grid h-8 w-8 place-items-center rounded-sm border border-race-line/75 bg-race-panel/80 text-[9px] font-black text-race-ink">S</div>
                <div className="mt-9 grid h-8 w-8 place-items-center rounded-sm border border-race-line/75 bg-race-panel/80 text-[9px] font-black text-race-ink">D</div>
              </div>
              <div className="flex flex-col gap-1 sm:hidden">
                <TouchControl label="Accelerate" display="▲" onPress={() => setControl("throttle", 1)} onRelease={() => setControl("throttle", 0)} />
                <TouchControl label="Brake" display="▼" onPress={() => setControl("brake", 1)} onRelease={() => setControl("brake", 0)} />
              </div>
            </div>
          </section>
          {phase === "paused" && <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-race-overlay/20"><div className="rounded-md border border-race-line bg-race-panel/95 px-10 py-8 text-center shadow-xl"><div className="text-[10px] font-extrabold tracking-[0.24em] text-race-accent">SESSION PAUSED</div><div className="mt-2 text-2xl font-black">Catch your breath.</div><div className="mt-4 text-[10px] font-bold tracking-[0.12em] text-race-soft">PRESS ESC OR CLICK PAUSE TO RESUME</div></div></div>}
        </>
      )}

      <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 hidden -translate-x-1/2 text-[8px] font-bold tracking-[0.16em] text-race-ink/80 sm:block">WASD / ARROWS DRIVE <span className="mx-2 opacity-50">·</span> SHIFT BOOST <span className="mx-2 opacity-50">·</span> SPACE DRIFT</div>
    </main>
  );
}

function TouchControl({ label, display, onPress, onRelease }: { label: string; display: string; onPress: () => void; onRelease: () => void }) {
  return <Button type="button" aria-label={label} variant="outline" className="h-11 w-11 touch-none rounded-md border-race-line/80 bg-race-panel/85 p-0 text-lg font-black text-race-ink active:bg-race-accent active:text-race-accent-ink" onPointerDown={(event) => { event.preventDefault(); onPress(); }} onPointerUp={onRelease} onPointerCancel={onRelease} onPointerLeave={onRelease}>{display}</Button>;
}

function ordinal(value: number) {
  return value === 1 ? "1st" : value === 2 ? "2nd" : value === 3 ? "3rd" : `${value}th`;
}

useGLTF.preload("/models/racer/race.glb");