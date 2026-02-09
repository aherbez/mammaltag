import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import initOpenCascade from 'opencascade.js'
import { visualizeShapes } from './visualize'

export default function ThreeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let animationId: number
    let rendererInstance: THREE.WebGLRenderer | null = null
    let controlsInstance: OrbitControls | null = null
    let resizeHandler: (() => void) | null = null

    async function init() {
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x1a1a2e)

      const camera = new THREE.PerspectiveCamera(
        75,
        container!.clientWidth / container!.clientHeight,
        0.1,
        1000
      )
      camera.position.set(2, 1.5, 2)
      camera.lookAt(0.5, 0.5, 0.5)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(container!.clientWidth, container!.clientHeight)
      renderer.setPixelRatio(window.devicePixelRatio)
      container!.appendChild(renderer.domElement)
      rendererInstance = renderer

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambientLight)
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(5, 5, 5)
      scene.add(directionalLight)

      // Orbit controls
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.target.set(0.5, 0.5, 0.5)
      controls.update()
      controlsInstance = controls

      // Start render loop (shows empty scene while OpenCascade loads)
      function animate() {
        if (cancelled) return
        animationId = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      const onResize = () => {
        camera.aspect = container!.clientWidth / container!.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(container!.clientWidth, container!.clientHeight)
      }
      window.addEventListener('resize', onResize)
      resizeHandler = onResize

      // Initialize OpenCascade (downloads + compiles WASM, may take a moment)
      const oc = await initOpenCascade()
      if (cancelled) return

      // Hello world geometry: box with a sphere cut out
      const box = new oc.BRepPrimAPI_MakeBox_2(1, 1, 1)
      const sphere = new oc.BRepPrimAPI_MakeSphere_5(
        new oc.gp_Pnt_3(0.5, 0.5, 0.5),
        0.65
      )
      const cut = new oc.BRepAlgoAPI_Cut_3(
        box.Shape(),
        sphere.Shape(),
        new oc.Message_ProgressRange_1()
      )
      cut.Build(new oc.Message_ProgressRange_1())

      // Convert to GLB and load into Three.js
      const modelUrl = visualizeShapes(oc, cut.Shape())
      if (cancelled) return

      const loader = new GLTFLoader()
      loader.load(modelUrl, (gltf) => {
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x00aaff,
              metalness: 0.3,
              roughness: 0.7,
            })
          }
        })
        scene.add(gltf.scene)
        URL.revokeObjectURL(modelUrl)
        setLoading(false)
      })
    }

    init()

    return () => {
      cancelled = true
      if (animationId) cancelAnimationFrame(animationId)
      if (resizeHandler) window.removeEventListener('resize', resizeHandler)
      controlsInstance?.dispose()
      if (rendererInstance) {
        rendererInstance.dispose()
        container.removeChild(rendererInstance.domElement)
      }
    }
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
          color: 'white',
          fontSize: '1.2rem',
        }}>
          Loading OpenCascade...
        </div>
      )}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}
