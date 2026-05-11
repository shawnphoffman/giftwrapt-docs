// Vanilla three.js viewer for the GiftWrapt hero.
// Public API: initGift3D(canvas, options?) -> { dispose }
import {
	ACESFilmicToneMapping,
	Box3,
	Color,
	DirectionalLight,
	DoubleSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshPhysicalMaterial,
	PerspectiveCamera,
	PMREMGenerator,
	BoxGeometry,
	Scene,
	Vector3,
	WebGLRenderer,
	AmbientLight,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const DEFAULTS = {
	modelUrl: '/models/gift3d.gltf',
	color: 'darkred',
	background: null, // null = transparent so Starlight bg shows through
	targetSize: 2.4,
	restRotation: { x: -0.295, y: 0.449, z: 0 },
	cameraPos: [0.6, 0.5, 5.6],
	fov: 30,
	// Spring physics for rubber-band return.
	springK: 95,
	springC: 16,
}

export function initGift3D(canvas, options = {}) {
	const opts = { ...DEFAULTS, ...options }

	// Renderer ----------------------------------------------------------------
	const renderer = new WebGLRenderer({
		canvas,
		antialias: true,
		alpha: opts.background == null,
	})
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
	// Match R3F's Canvas defaults: ACES Filmic deepens reds, kills the washed look.
	renderer.toneMapping = ACESFilmicToneMapping
	renderer.toneMappingExposure = 1.0
	if (opts.background != null) {
		renderer.setClearColor(new Color(opts.background), 1)
	} else {
		renderer.setClearAlpha(0)
	}

	// Scene + camera ----------------------------------------------------------
	const scene = new Scene()
	const camera = new PerspectiveCamera(opts.fov, 1, 0.1, 100)
	camera.position.set(...opts.cameraPos)
	camera.lookAt(0, 0, 0)

	// Environment (IBL) replaces drei's <Environment preset="studio" />.
	const pmrem = new PMREMGenerator(renderer)
	scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

	// Lights ------------------------------------------------------------------
	scene.add(new AmbientLight(0xffffff, 0.22))
	const key = new DirectionalLight(0xffffff, 3.4)
	key.position.set(-2.5, 10, -2)
	scene.add(key)
	const fill = new DirectionalLight(0xffffff, 0.35)
	fill.position.set(3, 1, 5)
	scene.add(fill)

	// Pivot group -------------------------------------------------------------
	const pivot = new Group()
	pivot.rotation.set(opts.restRotation.x, opts.restRotation.y, opts.restRotation.z)
	scene.add(pivot)

	// Load model --------------------------------------------------------------
	const loader = new GLTFLoader()
	let modelScale = 1
	let bbox = new Vector3(1, 1, 1)
	let disposed = false

	loader.load(
		opts.modelUrl,
		gltf => {
			if (disposed) return
			const root = gltf.scene

			const material = new MeshPhysicalMaterial({
				color: opts.color,
				roughness: 0.42,
				metalness: 0.05,
				clearcoat: 0.6,
				clearcoatRoughness: 0.3,
				envMapIntensity: 0.2,
				reflectivity: 0.5,
				side: DoubleSide,
			})

			root.traverse(child => {
				if (child.isMesh) {
					child.material = material
					child.castShadow = true
					child.receiveShadow = true
					// GLTF brings its own vertex normals; do not recompute.
				}
			})

			// Compute bbox from visible meshes only.
			root.updateWorldMatrix(true, true)
			const box = new Box3()
			let meshCount = 0
			root.traverse(child => {
				if (child.isMesh && child.geometry) {
					meshCount += 1
					box.expandByObject(child)
				}
			})
			if (meshCount === 0 || box.isEmpty()) box.setFromObject(root)

			const size = new Vector3()
			const center = new Vector3()
			box.getSize(size)
			box.getCenter(center)
			bbox.copy(size)

			const maxAxis = Math.max(size.x, size.y, size.z) || 1
			modelScale = opts.targetSize / maxAxis

			// Recenter root in local space.
			root.position.set(-center.x, -center.y, -center.z)

			pivot.add(root)
			pivot.scale.setScalar(modelScale)

			// Invisible bbox-shaped catcher so hover fires through the bow loops.
			const catcher = new Mesh(
				new BoxGeometry(size.x, size.y, size.z),
				new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
			)
			pivot.add(catcher)
		},
		undefined,
		err => console.error('[gift3d] failed to load model', err),
	)

	// Interaction state -------------------------------------------------------
	const ptr = { x: 0, y: 0 }
	const tilt = { x: 0, y: 0 }
	const drag = {
		active: false,
		pointerId: null,
		lastX: 0,
		lastY: 0,
		rx: 0,
		ry: 0,
		vx: 0,
		vy: 0,
		holdWeight: 0,
	}
	let hovered = false
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

	// Pointer events ----------------------------------------------------------
	const setCursor = () => {
		canvas.style.cursor = drag.active ? 'grabbing' : hovered ? 'grab' : 'auto'
	}

	const isOverModel = e => {
		// Cheap hit test: pointer is inside the canvas rect. Three.js raycasting
		// against the pivot bbox is overkill for a hero; the catcher mesh extends
		// pointer pickup, but we just gate hover on canvas hover.
		const rect = canvas.getBoundingClientRect()
		return (
			e.clientX >= rect.left &&
			e.clientX <= rect.right &&
			e.clientY >= rect.top &&
			e.clientY <= rect.bottom
		)
	}

	const onPointerEnter = () => {
		hovered = true
		setCursor()
	}
	const onPointerLeave = () => {
		hovered = false
		ptr.x = 0
		ptr.y = 0
		setCursor()
	}

	const onPointerMove = e => {
		const rect = canvas.getBoundingClientRect()
		ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
		ptr.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)

		if (!drag.active) return
		const dx = e.clientX - drag.lastX
		const dy = e.clientY - drag.lastY
		drag.lastX = e.clientX
		drag.lastY = e.clientY

		const sensX = (Math.PI * 2) / Math.max(rect.width, 1)
		const sensY = (Math.PI * 2) / Math.max(rect.height, 1)
		drag.ry += dx * sensX
		drag.rx += dy * sensY
		drag.vy = dx * sensX * 60
		drag.vx = dy * sensY * 60

		const limit = Math.PI * 0.45
		if (drag.rx > limit) {
			drag.rx = limit
			drag.vx = 0
		} else if (drag.rx < -limit) {
			drag.rx = -limit
			drag.vx = 0
		}
	}

	const onPointerDown = e => {
		if (!isOverModel(e)) return
		drag.active = true
		drag.pointerId = e.pointerId
		drag.lastX = e.clientX
		drag.lastY = e.clientY
		drag.vx = 0
		drag.vy = 0
		canvas.setPointerCapture?.(e.pointerId)
		setCursor()
	}

	const endDrag = e => {
		if (!drag.active) return
		drag.active = false
		if (drag.pointerId != null) {
			try {
				canvas.releasePointerCapture?.(drag.pointerId)
			} catch {
				/* ignore */
			}
		}
		drag.pointerId = null
		setCursor()
	}

	canvas.addEventListener('pointerenter', onPointerEnter)
	canvas.addEventListener('pointerleave', onPointerLeave)
	canvas.addEventListener('pointermove', onPointerMove)
	canvas.addEventListener('pointerdown', onPointerDown)
	canvas.addEventListener('pointerup', endDrag)
	canvas.addEventListener('pointercancel', endDrag)
	canvas.addEventListener('lostpointercapture', endDrag)
	// Prevent the canvas from stealing touch scroll on mobile only when dragging.
	canvas.style.touchAction = 'none'

	// Resize ------------------------------------------------------------------
	let observer = null
	const handleResize = () => {
		const rect = canvas.getBoundingClientRect()
		const w = Math.max(1, Math.floor(rect.width))
		const h = Math.max(1, Math.floor(rect.height))
		renderer.setSize(w, h, false)
		camera.aspect = w / h
		camera.updateProjectionMatrix()
	}
	if ('ResizeObserver' in window) {
		observer = new ResizeObserver(handleResize)
		observer.observe(canvas)
	} else {
		window.addEventListener('resize', handleResize)
	}
	handleResize()

	// Animation loop ----------------------------------------------------------
	let lastT = performance.now()
	let raf = 0
	const tick = now => {
		raf = requestAnimationFrame(tick)
		const deltaRaw = (now - lastT) / 1000
		lastT = now
		const dt = Math.min(deltaRaw, 1 / 30)

		// Crossfade hover-tilt out while dragging.
		const holdTarget = drag.active ? 1 : 0
		drag.holdWeight += (holdTarget - drag.holdWeight) * (1 - Math.exp(-12 * dt))

		// Spring rubber-band when released.
		if (!drag.active) {
			drag.vx += (-opts.springK * drag.rx - opts.springC * drag.vx) * dt
			drag.vy += (-opts.springK * drag.ry - opts.springC * drag.vy) * dt
			drag.rx += drag.vx * dt
			drag.ry += drag.vy * dt
			if (Math.abs(drag.rx) < 1e-4 && Math.abs(drag.vx) < 1e-3) {
				drag.rx = 0
				drag.vx = 0
			}
			if (Math.abs(drag.ry) < 1e-4 && Math.abs(drag.vy) < 1e-3) {
				drag.ry = 0
				drag.vy = 0
			}
		}

		// Hover tilt (parallax) -- disabled under reduced motion.
		const hoverWeight = reducedMotion ? 0 : (hovered ? 1 : 0) * (1 - drag.holdWeight)
		const tiltXTarget = ptr.y * 0.09 * hoverWeight
		const tiltYTarget = ptr.x * 0.11 * hoverWeight
		const kTilt = 1 - Math.exp(-7 * dt)
		tilt.x += (tiltXTarget - tilt.x) * kTilt
		tilt.y += (tiltYTarget - tilt.y) * kTilt

		// Scale lift on hover/drag (disabled under reduced motion).
		const lift = 1 + (!reducedMotion && (hovered || drag.active) ? 0.04 : 0)
		const sTarget = modelScale * lift
		const kS = 1 - Math.exp(-9 * dt)
		const s = pivot.scale.x + (sTarget - pivot.scale.x) * kS
		pivot.scale.setScalar(s)

		pivot.rotation.x = opts.restRotation.x + tilt.x + drag.rx
		pivot.rotation.y = opts.restRotation.y + tilt.y + drag.ry
		pivot.rotation.z = opts.restRotation.z

		renderer.render(scene, camera)
	}
	raf = requestAnimationFrame(tick)

	// Dispose -----------------------------------------------------------------
	return {
		dispose() {
			disposed = true
			cancelAnimationFrame(raf)
			canvas.removeEventListener('pointerenter', onPointerEnter)
			canvas.removeEventListener('pointerleave', onPointerLeave)
			canvas.removeEventListener('pointermove', onPointerMove)
			canvas.removeEventListener('pointerdown', onPointerDown)
			canvas.removeEventListener('pointerup', endDrag)
			canvas.removeEventListener('pointercancel', endDrag)
			canvas.removeEventListener('lostpointercapture', endDrag)
			if (observer) observer.disconnect()
			else window.removeEventListener('resize', handleResize)
			pmrem.dispose()
			renderer.dispose()
		},
	}
}
