import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { Button, Input, Stack } from "@mui/material";

interface MeshData {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

declare global {
  interface Window {
    electronAPI: {
      platform: string;
      buildHelloWorld: () => Promise<MeshData>;
      buildTag: (
        width: number,
        depth: number,
        height: number,
        text?: string,
      ) => Promise<MeshData>;
      onExportSTL: (callback: () => void) => () => void;
      saveSTL: (buffer: ArrayBuffer) => Promise<boolean>;
    };
  }
}

const material = new THREE.MeshStandardMaterial({
  color: 0x00aaff,
  metalness: 0.3,
  roughness: 0.7,
});

function meshDataToThree(data: MeshData): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Float32Array(data.vertices), 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(new Float32Array(data.normals), 3),
  );
  geometry.setIndex(
    new THREE.BufferAttribute(new Uint32Array(data.indices), 1),
  );
  return new THREE.Mesh(geometry, material);
}

export default function ThreeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<THREE.Group>();
  const [width, setWidth] = useState<number>(1);
  const [depth, setDepth] = useState<number>(1);
  const [height, setHeight] = useState<number>(1);
  const [text, setText] = useState<string>("");

  async function update() {
    if (!group) return;

    setLoading(true);
    const meshData = await window.electronAPI.buildTag(width, depth, height, text || undefined);
    group.clear();
    group.add(meshDataToThree(meshData));
    setLoading(false);
  }

  // Listen for "Export as STL" from the File menu
  useEffect(() => {
    if (!group) return;
    const handleExport = () => {
      const exporter = new STLExporter();
      const result = exporter.parse(group, { binary: true });
      window.electronAPI.saveSTL(result.buffer as ArrayBuffer);
    };
    const cleanup = window.electronAPI.onExportSTL(handleExport);
    return cleanup;
  }, [group]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let animationId: number;
    let rendererInstance: THREE.WebGLRenderer | null = null;
    let controlsInstance: OrbitControls | null = null;
    let resizeHandler: (() => void) | null = null;

    async function init() {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);

      const camera = new THREE.PerspectiveCamera(
        75,
        container!.clientWidth / container!.clientHeight,
        0.1,
        1000,
      );
      camera.position.set(2, 1.5, 2);
      camera.lookAt(0.5, 0.5, 0.5);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(container!.clientWidth, container!.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      container!.appendChild(renderer.domElement);
      rendererInstance = renderer;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 5, 5);
      scene.add(directionalLight);

      // Orbit controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.target.set(0.5, 0.5, 0.5);
      controls.update();
      controlsInstance = controls;

      const modelGroup = new THREE.Group();
      scene.add(modelGroup);

      // Start render loop (shows empty scene while OpenCascade loads)
      function animate() {
        if (cancelled) return;
        animationId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }
      animate();

      const onResize = () => {
        camera.aspect = container!.clientWidth / container!.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container!.clientWidth, container!.clientHeight);
      };
      window.addEventListener("resize", onResize);
      resizeHandler = onResize;

      setGroup(modelGroup);
    }

    init();

    return () => {
      cancelled = true;
      if (animationId) cancelAnimationFrame(animationId);
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      controlsInstance?.dispose();
      if (rendererInstance) {
        rendererInstance.dispose();
        container.removeChild(rendererInstance.domElement);
      }
    };
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Stack direction="row">
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
        <Stack direction="column">
          <Input
            defaultValue={width}
            onChange={(event) => {
              const v = parseFloat(event.target.value);
              if (v) {
                setWidth(v);
              }
            }}
          />
          <Input
            defaultValue={depth}
            onChange={(event) => {
              const v = parseFloat(event.target.value);
              if (v) {
                setDepth(v);
              }
            }}
          />
          <Input
            defaultValue={height}
            onChange={(event) => {
              const v = parseFloat(event.target.value);
              if (v) {
                setHeight(v);
              }
            }}
          />
          <Input
            placeholder="Tag text"
            defaultValue={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
          <Button onClick={() => update()}>Update</Button>
        </Stack>
      </Stack>
    </div>
  );
}
