import Phaser from 'phaser'
import { PLANETS, PlanetConfig, SHAPE_WAVES } from '../config/planets'

/**
 * Builds the convex hull polygon of sphere ∪ ring-ellipse for ringed planets.
 * The ring ellipse (semi-major ringA, semi-minor ringB) is wider but flatter
 * than the sphere (radius r). We sample each arc and join them at the
 * transition angles where both curves have the same polar radius.
 */
function buildPolyVerts(sides: number, r: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2
    pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
  }
  return pts
}

function buildBumpyVerts(r: number, waves: Array<[number, number, number]>): { x: number; y: number }[] {
  // Scale base so max extent = r (visual and physics both capped at r)
  const maxAmp = waves.reduce((s, [, a]) => s + a, 0)
  const base = r / (1 + maxAmp)
  const steps = 16
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    let br = base
    for (const [freq, amp, phase] of waves) br += base * amp * Math.sin(freq * angle + phase)
    pts.push({ x: Math.cos(angle) * br, y: Math.sin(angle) * br })
  }
  return pts
}

function buildRingPhysicsVerts(r: number, ringA: number, ringB: number): { x: number; y: number }[] {

  // Polar angle where ring polar-radius equals sphere radius
  const sinSq = ((ringA * ringB) ** 2 / r ** 2 - ringB ** 2) / (ringA ** 2 - ringB ** 2)
  const trans = Math.asin(Math.sqrt(Math.max(0, sinSq)))  // ≈ 0.504 rad / 28.9°

  const pts: { x: number; y: number }[] = []
  const RS = 8  // samples per ring arc
  const SS = 6  // samples per sphere arc

  const ringPt = (θ: number) => {
    const c = Math.cos(θ), s = Math.sin(θ)
    const rp = (ringA * ringB) / Math.sqrt((ringB * c) ** 2 + (ringA * s) ** 2)
    return { x: rp * c, y: rp * s }
  }
  const spherePt = (θ: number) => ({ x: r * Math.cos(θ), y: r * Math.sin(θ) })

  // Right ring arc (θ: −trans → +trans, through 0)
  for (let i = 0; i <= RS; i++) pts.push(ringPt(-trans + (2 * trans) * i / RS))
  // Top sphere arc (θ: +trans → π−trans)
  for (let i = 1; i < SS; i++) pts.push(spherePt(trans + (Math.PI - 2 * trans) * i / SS))
  // Left ring arc (θ: π−trans → π+trans, through π)
  for (let i = 0; i <= RS; i++) pts.push(ringPt(Math.PI - trans + (2 * trans) * i / RS))
  // Bottom sphere arc (θ: π+trans → 2π−trans)
  for (let i = 1; i < SS; i++) pts.push(spherePt(Math.PI + trans + (Math.PI - 2 * trans) * i / SS))

  return pts
}

export class Planet extends Phaser.Physics.Matter.Image {
  planetId: number
  planetConfig: PlanetConfig
  merging = false
  justSpawned = true
  dangerTime = 0
  private _inDanger = false

  private glowSprite: Phaser.GameObjects.Image
  private ringsSprite: Phaser.GameObjects.Image | null = null
  private trailGfx: Phaser.GameObjects.Graphics
  private pulseTime: number
  private rotationSpeed: number
  private posHistory: { x: number; y: number }[] = []

  constructor(scene: Phaser.Scene, x: number, y: number, planetId: number) {
    const config = PLANETS[planetId]

    const ringDims: Record<string, [number, number]> = {
      saturn: [config.radius * 1.55, config.radius * 0.44],
      neptune: [config.radius * 1.60, config.radius * 0.38],
    }
    const dims = ringDims[config.texture]
    const bodyShape: any = dims
      ? { type: 'fromVerts', verts: buildRingPhysicsVerts(config.radius, dims[0], dims[1]), flagInternal: true }
      : config.shape === 'poly5'
        ? { type: 'fromVerts', verts: buildPolyVerts(5, config.radius), flagInternal: true }
        : config.shape === 'poly6'
          ? { type: 'fromVerts', verts: buildPolyVerts(6, config.radius), flagInternal: true }
          : config.shape === 'meteorite' && SHAPE_WAVES.meteorite
            ? { type: 'fromVerts', verts: buildBumpyVerts(config.radius, SHAPE_WAVES.meteorite), flagInternal: true }
            : { type: 'circle', radius: config.radius }

    super(scene.matter.world, x, y, config.texture, undefined, {
      shape: bodyShape,
      restitution: 0.05,
      friction: 0.6,
      frictionAir: 0.01,
      frictionStatic: 0.3,
      density: 0.003,
      label: 'planet',
    })

    this.planetId = planetId
    this.planetConfig = config
    this.pulseTime = Math.random() * Math.PI * 2
    this.rotationSpeed = config.hasRings ? 0 : (Math.random() - 0.5) * 0.003

    // Prevent rotation for ringed planets so the ring stays horizontal
    if (config.hasRings) {
      const mb = this.body as any
      if (mb) { mb.inertia = Infinity; mb.inverseInertia = 0 }
    }

    scene.add.existing(this)
    this.setDisplaySize(config.radius * 2, config.radius * 2)
    this.setDepth(10)

    // Glow
    this.glowSprite = scene.add.image(x, y, config.texture)
    this.glowSprite.setDisplaySize(config.radius * 2.8, config.radius * 2.8)
    this.glowSprite.setAlpha(0)
    this.glowSprite.setDepth(9)
    this.glowSprite.setTint(config.glowColor)
    this.glowSprite.setBlendMode(Phaser.BlendModes.ADD)

    // Rings sprite (behind planet body)
    if (config.hasRings) {
      const ringKey = `${config.texture}_rings`
      this.ringsSprite = scene.add.image(x, y, ringKey)
      this.ringsSprite.setDepth(8)
      this.ringsSprite.setAlpha(config.texture === 'saturn' ? 0.85 : 0.70)
    }

    // Trail (below planet)
    this.trailGfx = scene.add.graphics()
    this.trailGfx.setDepth(8)

    // Spawn pop animation — only on the visual layer, NOT the physics body
    // Scaling a Matter body breaks collision shapes
    this.setAlpha(0)
    this.glowSprite.setAlpha(0)
    scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 120,
      ease: 'Power2',
    })
    // Quick scale pulse on glow to give "pop" feel
    this.glowSprite.setScale(2.5)
    scene.tweens.add({
      targets: this.glowSprite,
      scaleX: 1,
      scaleY: 1,
      duration: 250,
      ease: 'Back.easeOut',
    })

    setTimeout(() => { this.justSpawned = false }, 250)
  }

  setInDanger(inDanger: boolean) {
    this._inDanger = inDanger
    if (!inDanger) this.clearTint()
  }

  update(delta: number) {
    if (!this.scene || !this.glowSprite) return
    if (this.merging) {
      this.glowSprite?.setAlpha(0)
      this.trailGfx?.clear()
      return
    }

    // Red danger flash
    if (this._inDanger) {
      const flash = Math.sin(Date.now() * 0.012) > 0
      this.setTint(flash ? 0xff3333 : 0xffffff)
      this.glowSprite?.setTint(flash ? 0xff0000 : this.planetConfig.glowColor)
    }

    this.pulseTime += delta * 0.002
    const pulse = 0.5 + 0.5 * Math.sin(this.pulseTime * 2)
    const baseAlpha = this.planetConfig.glowIntensity * 0.32
    this.glowSprite.setAlpha(baseAlpha + pulse * 0.1)
    this.glowSprite.setPosition(this.x, this.y)
    this.glowSprite.setAngle(this.angle)

    if (this.ringsSprite) {
      this.ringsSprite.setPosition(this.x, this.y)
    }

    this.setAngle(this.angle + this.rotationSpeed * delta)

    // Trail — only when moving fast and not static
    this.updateTrail()
  }

  private updateTrail() {
    if (!this.body) return
    const body = this.body as MatterJS.BodyType & { velocity?: { x: number; y: number } }
    const vx = body.velocity?.x ?? 0
    const vy = body.velocity?.y ?? 0
    const speed = Math.sqrt(vx * vx + vy * vy)

    if (speed > 1.5 && !this.justSpawned && !this.merging) {
      this.posHistory.unshift({ x: this.x, y: this.y })
      if (this.posHistory.length > 10) this.posHistory.pop()
    } else {
      if (this.posHistory.length > 0) this.posHistory.pop()
    }

    this.trailGfx.clear()
    const r = this.planetConfig.radius
    const color = this.planetConfig.glowColor

    for (let i = 0; i < this.posHistory.length; i++) {
      const t = 1 - i / this.posHistory.length
      const trailR = r * 0.55 * t
      const alpha = t * 0.28
      this.trailGfx.fillStyle(color, alpha)
      this.trailGfx.fillCircle(this.posHistory[i].x, this.posHistory[i].y, trailR)
    }
  }

  destroyWithGlow() {
    // Capture visuals and null local refs BEFORE calling destroy()
    // so the destroy() override doesn't double-destroy them
    const scene  = this.scene
    const glow   = this.glowSprite
    const trail  = this.trailGfx
    const rings  = this.ringsSprite

    this.glowSprite  = null!
    this.trailGfx    = null!
    this.ringsSprite = null

    // Destroy physics body only
    super.destroy()

    // Tween out visual elements independently
    scene.tweens.add({
      targets: [glow, trail].filter(Boolean),
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        glow?.destroy()
        trail?.destroy()
        rings?.destroy()
      },
    })
  }

  destroy(fromScene?: boolean) {
    this.glowSprite?.destroy()
    this.trailGfx?.destroy()
    this.ringsSprite?.destroy()
    super.destroy(fromScene)
  }
}
