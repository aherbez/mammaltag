import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Button, Input, Stack } from "@mui/material";

declare global {
  interface Window {
    electronAPI: {
      platform: string;
      buildHelloWorld: () => Promise<Uint8Array>;
      buildTag: (
        width: number,
        depth: number,
        height: number,
      ) => Promise<Uint8Array>;
    };
  }
}

/*
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
            color: "white",
            fontSize: "1.2rem",
          }}
        >
          Loading OpenCascade...
        </div>
      )}
*/

export default function ThreeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [scene, setScene] = useState<THREE.Group>();
  const [width, setWidth] = useState<number>(1);
  const [depth, setDepth] = useState<number>(1);
  const [height, setHeight] = useState<number>(1);

  async function update() {
    if (!scene) return;

    setLoading(true);

    // Request GLB from main process (OpenCascade runs there)
    const glbData = await window.electronAPI.buildTag(width, depth, height);

    // Load GLB into Three.js
    const blob = new Blob([new Uint8Array(glbData)], {
      type: "model/gltf-binary",
    });
    const url = URL.createObjectURL(blob);

    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            metalness: 0.3,
            roughness: 0.7,
          });
        }
      });

      scene.clear();
      scene.add(gltf.scene);
      URL.revokeObjectURL(url);
      setLoading(false);
    });
  }

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

      const group = new THREE.Group();
      scene.add(group);

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

      /*
      // Request GLB from main process (OpenCascade runs there)
      // const glbData = await window.electronAPI.buildHelloWorld();
      const glbData = await window.electronAPI.buildTag();
      if (cancelled) return;

      // Load GLB into Three.js
      const blob = new Blob([new Uint8Array(glbData)], {
        type: "model/gltf-binary",
      });
      const url = URL.createObjectURL(blob);

      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x00aaff,
              metalness: 0.3,
              roughness: 0.7,
            });
          }
        });
        scene.add(gltf.scene);
        URL.revokeObjectURL(url);
        
        setLoading(false);
      });
      */
      setScene(group);
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
          <Button onClick={() => update()}>Update</Button>
        </Stack>
      </Stack>
    </div>
  );
}
