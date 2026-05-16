import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, WALL_THICKNESS, DROP_ZONE_Y, MERGE_COOLDOWN_MS, PROGRESSION_PANEL_HEIGHT } from '../config/gameConfig'
import { PLANETS, MAX_DROP_PLANET_ID, SUPERNOVA_PLANET_ID, SUPERNOVA_SCORE_THRESHOLD } from '../config/planets'
import { Planet } from '../objects/Planet'
import { StarField } from '../objects/StarField'
import { playMergeEffect, playExplosionEffect, playSunEffect } from '../objects/MergeEffect'
import { soundManager } from '../audio/SoundManager'

const SN_EXPLOSION_RADIUS = 260
const SN_EXPLOSION_SPEED  = 14  // px/step impulse added to each planet

export class GameScene extends Phaser.Scene {
  private starField!: StarField
  private planets: Planet[] = []
  private pendingPlanet: Planet | null = null
  private nextPlanetId = 0
  private canDrop = true
  private readonly dropCooldown = 600

  private score = 0
  private nextSupernovaThreshold = SUPERNOVA_SCORE_THRESHOLD

  // Supernova state
  private supernovaQueued = false
  private activeSupernovaPlanet: Planet | null = null
  private supernovaBurnTimer: Phaser.Time.TimerEvent | null = null
  private supernovaIndicator!: Phaser.GameObjects.Text

  private scoreText!: Phaser.GameObjects.Text
  private nextPlanetPreview!: Phaser.GameObjects.Image
  private dangerLine!: Phaser.GameObjects.Graphics
  private cursor!: Phaser.GameObjects.Graphics
  private warningText!: Phaser.GameObjects.Text
  private muteBtn!: Phaser.GameObjects.Text

  private readonly DANGER_GRACE = 4000
  private gameOverTriggered = false
  private lastWarnBeep = 0
  private blockNextDrop = false

  private mergeCooldowns = new Map<string, number>()

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    // Resume physics in case it was paused by a previous game over
    try { this.matter.world.resume() } catch (_) {}

    this.score = 0
    this.nextSupernovaThreshold = SUPERNOVA_SCORE_THRESHOLD
    this.planets = []
    this.pendingPlanet = null
    this.canDrop = true
    this.gameOverTriggered = false
    this.supernovaQueued = false
    this.activeSupernovaPlanet = null
    this.supernovaBurnTimer = null
    this.blockNextDrop = false
    this.lastWarnBeep = 0
    this.mergeCooldowns.clear()

    this.drawBackground()
    this.starField = new StarField(this)
    this.drawWalls()
    this.createUI()
    this.drawProgressionPanel()
    this.setupInput()
    this.setupCollisions()

    this.nextPlanetId = this.randomDropPlanetId()
    this.spawnPendingPlanet()
  }

  // ─── Background & walls ───────────────────────────────────────────────────

  private drawBackground() {
    const bg = this.add.graphics()
    bg.fillStyle(0x00000a)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    bg.setDepth(0)
  }

  private drawWalls() {
    const W = WALL_THICKNESS
    const opts = { isStatic: true, label: 'wall', friction: 0.8, restitution: 0.02, frictionStatic: 0.5 }

    this.matter.add.rectangle(W / 2, GAME_HEIGHT / 2, W, GAME_HEIGHT, opts)
    this.matter.add.rectangle(GAME_WIDTH - W / 2, GAME_HEIGHT / 2, W, GAME_HEIGHT, opts)
    this.matter.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT + W / 2, GAME_WIDTH, W, opts)

    const g = this.add.graphics().setDepth(5)
    g.lineStyle(2, 0x2244aa, 0.8)
    g.strokeRect(W, DROP_ZONE_Y, GAME_WIDTH - W * 2, GAME_HEIGHT - DROP_ZONE_Y - W)
    g.lineStyle(1, 0x4466ff, 0.15)
    g.fillStyle(0x1122aa, 0.05)
    g.fillRect(W, DROP_ZONE_Y, GAME_WIDTH - W * 2, GAME_HEIGHT - DROP_ZONE_Y - W)

    this.dangerLine = this.add.graphics().setDepth(6)
    this.redrawDangerLine(false)
  }

  private redrawDangerLine(danger: boolean) {
    this.dangerLine.clear()
    const color = danger ? 0xff2222 : 0xff6644
    const alpha = danger ? 0.9 : 0.3
    this.dangerLine.lineStyle(1.5, color, alpha)
    this.dangerLine.lineBetween(WALL_THICKNESS, DROP_ZONE_Y, GAME_WIDTH - WALL_THICKNESS, DROP_ZONE_Y)
  }

  // ─── UI ───────────────────────────────────────────────────────────────────

  private createUI() {
    const panelTop = this.add.graphics().setDepth(30)
    panelTop.fillStyle(0x000020, 0.85)
    panelTop.fillRect(0, 0, GAME_WIDTH, DROP_ZONE_Y)
    panelTop.lineStyle(1, 0x3355cc, 0.6)
    panelTop.strokeRect(0, 0, GAME_WIDTH, DROP_ZONE_Y)

    this.scoreText = this.add.text(20, 18, '0', {
      fontFamily: 'Arial Black, Arial', fontSize: '28px',
      color: '#ffffff', stroke: '#2244cc', strokeThickness: 4,
    }).setDepth(31)

    this.add.text(20, 52, 'PUNTS', {
      fontFamily: 'Arial', fontSize: '10px', color: '#6688cc', letterSpacing: 3,
    }).setDepth(31)

    this.add.text(GAME_WIDTH - 90, 12, 'SEGÜENT', {
      fontFamily: 'Arial', fontSize: '10px', color: '#6688cc', letterSpacing: 2,
    }).setDepth(31)

    this.nextPlanetPreview = this.add.image(GAME_WIDTH - 45, 55, 'pluto')
    this.nextPlanetPreview.setDepth(31).setDisplaySize(44, 44)

    // Supernova queued indicator (center top)
    this.supernovaIndicator = this.add.text(GAME_WIDTH / 2, 50, '✨ SUPERNOVA PRÒXIMA!', {
      fontFamily: 'Arial Black', fontSize: '11px',
      color: '#ffcc44', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(32).setAlpha(0)

    this.warningText = this.add.text(GAME_WIDTH / 2, DROP_ZONE_Y + 18, '', {
      fontFamily: 'Arial Black', fontSize: '13px',
      color: '#ff3322', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(35).setAlpha(0)

    // Mute button
    this.muteBtn = this.add.text(GAME_WIDTH / 2, 22, '🔊', {
      fontSize: '18px',
    }).setOrigin(0.5).setDepth(35).setInteractive({ cursor: 'pointer' })

    this.muteBtn.on('pointerdown', () => {
      this.blockNextDrop = true
      soundManager.init()
      const muted = soundManager.toggleMute()
      this.muteBtn.setText(muted ? '🔇' : '🔊')
    })
  }

  // ─── Progression panel ────────────────────────────────────────────────────

  private drawProgressionPanel() {
    const panelY = GAME_HEIGHT
    const panelH = PROGRESSION_PANEL_HEIGHT

    // Background
    const bg = this.add.graphics().setDepth(5)
    bg.fillStyle(0x000015, 1)
    bg.fillRect(0, panelY, GAME_WIDTH, panelH)
    bg.lineStyle(1, 0x2244aa, 0.55)
    bg.lineBetween(0, panelY, GAME_WIDTH, panelY)

    this.add.text(GAME_WIDTH / 2, panelY + 5, 'PROGRESSIÓ', {
      fontFamily: 'Arial', fontSize: '9px', color: '#445599', letterSpacing: 3,
    }).setOrigin(0.5, 0).setDepth(6)

    // 10 main planets in id order
    const planets = PLANETS.filter(p => p.id <= 9)

    // Display radii: proportional between 8 px (smallest) and 21 px (Sun)
    const minDisp = 8, maxDisp = 21
    const minSrc = planets[0].radius   // 18
    const maxSrc = planets[9].radius   // 118
    const dispR = planets.map(p =>
      Math.round(minDisp + (p.radius - minSrc) / (maxSrc - minSrc) * (maxDisp - minDisp))
    )

    const arrowW = 9
    const totalW = dispR.reduce((s, r) => s + r * 2, 0) + arrowW * (planets.length - 1)
    let curX = (GAME_WIDTH - totalW) / 2

    // Baseline: all icons sit bottom-aligned here
    const baseline = panelY + panelH - 8

    for (let i = 0; i < planets.length; i++) {
      const r  = dispR[i]
      const cx = curX + r
      const cy = baseline - r

      const img = this.add.image(cx, cy, planets[i].texture)
      img.setDisplaySize(r * 2, r * 2)
      img.setDepth(6)

      curX += r * 2

      if (i < planets.length - 1) {
        const arrowCY = baseline - (dispR[i] + dispR[i + 1]) / 2
        this.add.text(curX + arrowW / 2, arrowCY, '›', {
          fontFamily: 'Arial', fontSize: '11px', color: '#334477',
        }).setOrigin(0.5, 0.5).setDepth(6)
        curX += arrowW
      }
    }
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private setupInput() {
    this.cursor = this.add.graphics().setDepth(15)

    this.input.once('pointerdown', () => {
      soundManager.init()
      soundManager.resume()
    })

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.pendingPlanet?.scene) return
      const r = this.pendingPlanet.planetConfig.radius

      if (this.pendingPlanet.planetId === SUPERNOVA_PLANET_ID) {
        // Supernova: free placement anywhere inside the play area
        const x = Phaser.Math.Clamp(ptr.x, WALL_THICKNESS + r, GAME_WIDTH - WALL_THICKNESS - r)
        const y = Phaser.Math.Clamp(ptr.y, DROP_ZONE_Y + r, GAME_HEIGHT - WALL_THICKNESS - r)
        this.pendingPlanet.setPosition(x, y)
        this.drawSupernovaCursor(x, y)
      } else {
        const x = Phaser.Math.Clamp(ptr.x, WALL_THICKNESS + r, GAME_WIDTH - WALL_THICKNESS - r)
        this.pendingPlanet.setPosition(x, DROP_ZONE_Y - r - 5)
        this.drawDropCursor(x)
      }
    })

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      // Touch: wait for pointerup so the player can drag to aim first
      if (ptr.wasTouch) return
      if (this.blockNextDrop) { this.blockNextDrop = false; return }
      if (this.canDrop && this.pendingPlanet) this.dropPlanet()
    })

    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.wasTouch) return
      if (this.blockNextDrop) { this.blockNextDrop = false; return }
      if (this.canDrop && this.pendingPlanet) this.dropPlanet()
    })
  }

  private drawDropCursor(x: number) {
    this.cursor.clear()
    this.cursor.lineStyle(1, 0xffffff, 0.18)
    this.cursor.lineBetween(x, DROP_ZONE_Y, x, GAME_HEIGHT)
  }

  private drawSupernovaCursor(x: number, y: number) {
    this.cursor.clear()
    // Explosion radius preview
    this.cursor.lineStyle(1, 0xff8800, 0.20)
    this.cursor.strokeCircle(x, y, SN_EXPLOSION_RADIUS)
    // Crosshair
    this.cursor.lineStyle(1, 0xffcc44, 0.60)
    this.cursor.lineBetween(x - 14, y, x + 14, y)
    this.cursor.lineBetween(x, y - 14, x, y + 14)
    this.cursor.strokeCircle(x, y, 18)
  }

  // ─── Collisions ───────────────────────────────────────────────────────────

  private setupCollisions() {
    // Remove any leftover listeners from a previous run of this scene
    this.matter.world.removeAllListeners('collisionstart')
    this.matter.world.removeAllListeners('collisionactive')

    const handler = (event: { pairs: { bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType }[] }) => {
      for (const pair of event.pairs) {
        if (!pair.bodyA || !pair.bodyB) continue
        this.checkMerge(pair.bodyA, pair.bodyB)
      }
    }
    this.matter.world.on('collisionstart', handler)
    this.matter.world.on('collisionactive', handler)
  }

  private checkMerge(a: MatterJS.BodyType, b: MatterJS.BodyType) {
    if (this.gameOverTriggered) return
    const planetA = this.getPlanetFromBody(a)
    const planetB = this.getPlanetFromBody(b)

    if (!planetA || !planetB) return
    if (planetA === planetB) return
    // Never merge the pending (not-yet-dropped) planet
    if (planetA === this.pendingPlanet || planetB === this.pendingPlanet) return
    if (planetA.planetId !== planetB.planetId) return
    // Supernova planets don't merge
    if (planetA.planetId === SUPERNOVA_PLANET_ID) return
    if (planetA.merging || planetB.merging) return
    if (planetA.justSpawned || planetB.justSpawned) return

    const idA = (planetA.body as MatterJS.BodyType & { id: number }).id
    const idB = (planetB.body as MatterJS.BodyType & { id: number }).id
    const key = `${Math.min(idA, idB)}-${Math.max(idA, idB)}`
    if (this.mergeCooldowns.has(key)) return

    this.mergeCooldowns.set(key, Date.now() + MERGE_COOLDOWN_MS)
    planetA.merging = true
    planetB.merging = true
    planetA.setStatic(true)
    planetB.setStatic(true)

    const mx = (planetA.x + planetB.x) / 2
    const my = (planetA.y + planetB.y) / 2
    const config = planetA.planetConfig

    playMergeEffect(this, mx, my, config)
    soundManager.playMerge(planetA.planetId)

    const doMerge = () => {
      if (this.gameOverTriggered) return
      this.planets = this.planets.filter(p => p !== planetA && p !== planetB)
      if (planetA.scene) planetA.destroy()
      if (planetB.scene) planetB.destroy()

      if (config.nextPlanetId !== null) {
        const next = new Planet(this, mx, my, config.nextPlanetId)
        this.planets.push(next)
        if (config.nextPlanetId === SUPERNOVA_PLANET_ID - 1) {
          this.time.delayedCall(150, () => playSunEffect(this, mx, my))
          soundManager.playSun()
        }
      }
      this.addScore(config.points * 2, mx, my)

      const impulseRadius = config.radius * 5
      const impulsePower  = config.radius * 0.000018
      for (const planet of this.planets) {
        if (planet.merging || planet === this.pendingPlanet || !planet.scene || planet.isStatic()) continue
        const dx = planet.x - mx
        const dy = planet.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 1 || dist > impulseRadius) continue
        const force = impulsePower * (1 - dist / impulseRadius)
        this.matter.applyForce(planet.body as MatterJS.BodyType, { x: (dx / dist) * force, y: (dy / dist) * force })
      }
    }

    let completed = 0
    const onDone = () => { if (++completed === 2) doMerge() }

    this.tweens.add({ targets: planetA, x: mx, y: my, alpha: 0, duration: 120, ease: 'Power2.in', onComplete: onDone })
    this.tweens.add({ targets: planetB, x: mx, y: my, alpha: 0, duration: 120, ease: 'Power2.in', onComplete: onDone })
  }

  private getPlanetFromBody(body: MatterJS.BodyType): Planet | null {
    // For compound bodies (fromVerts creates parent+parts), the collision event
    // reports the sub-part — use body.parent to get the compound root.
    const bodyAny = body as any
    const id: number = (bodyAny.parent ?? bodyAny).id
    for (const planet of this.planets) {
      if (!planet.scene) continue
      const pb = planet.body as any
      if (pb?.id === id) return planet
    }
    return null
  }

  // ─── Planet spawning & dropping ───────────────────────────────────────────

  private spawnPendingPlanet() {
    // Inject supernova if queued
    let spawnId: number
    if (this.supernovaQueued) {
      this.supernovaQueued = false
      spawnId = SUPERNOVA_PLANET_ID
    } else {
      spawnId = this.nextPlanetId
      this.nextPlanetId = this.randomDropPlanetId()
    }

    const spawnR = PLANETS[spawnId].radius
    const x = GAME_WIDTH / 2
    this.pendingPlanet = new Planet(this, x, DROP_ZONE_Y - spawnR - 5, spawnId)
    this.pendingPlanet.setStatic(true)
    this.pendingPlanet.setDepth(12)
    this.planets.push(this.pendingPlanet)

    // Sensor mode: detects collisions but applies zero physical forces
    const pmb = this.pendingPlanet.body as any
    if (pmb) pmb.parts?.forEach((p: any) => { p.isSensor = true })

    // Preview shows next normal planet (supernova indicator handles the rest)
    const nextCfg = PLANETS[this.nextPlanetId]
    this.nextPlanetPreview.setTexture(nextCfg.texture)
    this.nextPlanetPreview.setDisplaySize(Math.min(44, nextCfg.radius * 2), Math.min(44, nextCfg.radius * 2))
  }

  private dropPlanet() {
    if (!this.pendingPlanet) return
    this.canDrop = false
    this.cursor.clear()

    const dropped = this.pendingPlanet
    this.pendingPlanet = null

    soundManager.resume()
    soundManager.playDrop()

    if (dropped.planetId === SUPERNOVA_PLANET_ID) {
      // Supernova stays fixed at the chosen position and detonates after burn
      this.activeSupernovaPlanet = dropped
      this.supernovaBurnTimer = this.time.delayedCall(2000, () => this.detonateActiveSupernovaAt())
    } else {
      // Destroy the sensor placeholder and spawn a fresh dynamic body at the same position.
      // Turning isSensor off on an already-overlapping body doesn't trigger collisionstart in
      // Matter.js, so the dropped planet would pass through risen planets. A brand-new body
      // always gets proper collision detection from frame one.
      const dropX = dropped.x
      const dropY = dropped.y
      const planetId = dropped.planetId

      this.planets = this.planets.filter(p => p !== dropped)
      dropped.destroy()

      const fresh = new Planet(this, dropX, dropY, planetId)
      this.planets.push(fresh)
    }

    this.time.delayedCall(this.dropCooldown, () => {
      this.canDrop = true
      this.spawnPendingPlanet()
    })
  }

  private randomDropPlanetId(): number {
    return Math.floor(Math.random() * (MAX_DROP_PLANET_ID + 1))
  }

  // ─── Supernova detonation ─────────────────────────────────────────────────

  private detonateActiveSupernovaAt() {
    if (!this.activeSupernovaPlanet || this.gameOverTriggered) return

    const sx = this.activeSupernovaPlanet.x
    const sy = this.activeSupernovaPlanet.y

    this.supernovaBurnTimer?.remove()
    this.supernovaBurnTimer = null

    // Remove from planet list and destroy visually
    this.planets = this.planets.filter(p => p !== this.activeSupernovaPlanet)
    this.activeSupernovaPlanet.destroyWithGlow()
    this.activeSupernovaPlanet = null

    // Big explosion
    playExplosionEffect(this, sx, sy, SN_EXPLOSION_RADIUS)
    soundManager.playExplosion()
    this.cameras.main.shake(220, 0.018)

    // Push all planets in radius — outward + always upward so floor planets scatter too
    for (const planet of this.planets) {
      if (planet === this.pendingPlanet || planet.merging || !planet.scene) continue
      const body = planet.body as any
      if (!body || body.isStatic) continue

      const dx = planet.x - sx
      const dy = planet.y - sy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1 || dist >= SN_EXPLOSION_RADIUS) continue

      const t = 1 - dist / SN_EXPLOSION_RADIUS
      const speed = t * SN_EXPLOSION_SPEED
      const nx = dx / dist
      // Always push upward — planets below also fly up, not into the floor
      const ny = dy > 0 ? -(0.6 + t * 0.4) : (dy / dist)
      const curVx = body.velocity?.x ?? 0
      const curVy = body.velocity?.y ?? 0
      this.matter.setVelocity(planet, curVx + nx * speed, curVy + ny * speed)
    }
  }

  // ─── Score & supernova queue ───────────────────────────────────────────────

  private addScore(points: number, x?: number, y?: number) {
    this.score += points
    this.scoreText.setText(this.score.toString())

    this.tweens.add({ targets: this.scoreText, scaleX: 1.3, scaleY: 1.3, duration: 80, yoyo: true, ease: 'Power2' })

    if (x !== undefined && y !== undefined) {
      const floatTxt = this.add.text(x, y, `+${points}`, {
        fontFamily: 'Arial Black', fontSize: `${Math.min(28, 14 + points / 4)}px`,
        color: '#ffffff', stroke: '#2244cc', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(60)

      this.tweens.add({
        targets: floatTxt, y: y - 70, alpha: 0, scaleX: 1.3, scaleY: 1.3,
        duration: 900, ease: 'Power2', onComplete: () => floatTxt.destroy(),
      })
    }

    // Queue supernova at each threshold
    while (this.score >= this.nextSupernovaThreshold) {
      this.nextSupernovaThreshold += SUPERNOVA_SCORE_THRESHOLD
      if (!this.supernovaQueued) {
        this.supernovaQueued = true
        this.showSupernovaQueued()
      }
    }
  }

  private showSupernovaQueued() {
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, '✨ SUPERNOVA PRÒXIMA!', {
      fontFamily: 'Arial Black', fontSize: '26px',
      color: '#ffcc44', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(50)

    this.tweens.add({
      targets: text, y: GAME_HEIGHT / 2 - 100, alpha: 0, scaleX: 1.35, scaleY: 1.35,
      duration: 1400, ease: 'Power2', onComplete: () => text.destroy(),
    })
  }

  // ─── Main update ──────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (this.gameOverTriggered) return
    try {
      this.updateInternal(delta)
    } catch (e: any) {
      console.error('GameScene update crash:', e)
      if (!this.gameOverTriggered) this.triggerGameOver()
    }
  }

  private updateInternal(delta: number) {
    this.starField.update(delta)

    // Supernova indicator pulse
    if (this.supernovaQueued || (this.pendingPlanet?.planetId === SUPERNOVA_PLANET_ID)) {
      this.supernovaIndicator.setAlpha(0.7 + 0.3 * Math.sin(Date.now() * 0.008))
    } else {
      this.supernovaIndicator.setAlpha(0)
    }

    // Supernova planet burn flash (gets redder as time runs out)
    if (this.activeSupernovaPlanet && this.supernovaBurnTimer) {
      const elapsed = 2000 - this.supernovaBurnTimer.getRemaining()
      const t = elapsed / 2000  // 0→1
      const flash = Math.sin(Date.now() * (0.01 + t * 0.03)) > 0
      const col = flash ? 0xff4400 : 0xffcc44
      this.activeSupernovaPlanet.setTint(col)
    }

    // Per-planet danger tracking
    let maxDangerTime = 0
    let anyDanger = false

    for (const planet of this.planets) {
      if (planet === this.pendingPlanet || planet.merging || !planet.scene || planet.justSpawned) continue
      if (planet.planetId === SUPERNOVA_PLANET_ID) continue  // supernova doesn't trigger game over

      const inDanger = planet.y < DROP_ZONE_Y + 5
      if (inDanger) {
        planet.dangerTime += delta
        planet.setInDanger(true)
        anyDanger = true
        if (planet.dangerTime > maxDangerTime) maxDangerTime = planet.dangerTime
        if (planet.dangerTime >= this.DANGER_GRACE) {
          this.triggerGameOver()
          return
        }
      } else {
        planet.dangerTime = 0
        planet.setInDanger(false)
      }
    }

    for (const planet of this.planets) {
      if (!planet.scene) continue
      try { planet.update(delta) } catch (_) {}
    }

    this.planets = this.planets.filter(p => p.scene != null)

    const now = Date.now()
    for (const [key, expiry] of this.mergeCooldowns.entries()) {
      if (now > expiry) this.mergeCooldowns.delete(key)
    }

    if (anyDanger && maxDangerTime > 0) {
      const secsLeft = Math.ceil((this.DANGER_GRACE - maxDangerTime) / 1000)
      this.warningText.setText(`⚠️ PERILL! ${secsLeft}s`)
      this.warningText.setAlpha(0.7 + 0.3 * Math.sin(Date.now() * 0.01))
      if (now - this.lastWarnBeep > 800) {
        soundManager.playWarning()
        this.lastWarnBeep = now
      }
    } else {
      this.warningText.setAlpha(0)
    }

    this.redrawDangerLine(anyDanger)
  }

  // ─── Game Over ────────────────────────────────────────────────────────────

  private triggerGameOver() {
    if (this.gameOverTriggered) return
    this.gameOverTriggered = true
    this.canDrop = false

    this.supernovaBurnTimer?.remove()
    this.supernovaBurnTimer = null
    this.activeSupernovaPlanet = null

    // Pause physics immediately — stops the freeze that blocks the RAF
    try { this.matter.world.pause() } catch (_) {}

    // Use native setTimeout: fires even if Phaser's timer is stalled mid-step
    setTimeout(() => {
      try {
        this.showGameOverUI()
      } catch (e) {
        console.error('showGameOverUI crash:', e)
        this.showDOMGameOver()
      }
    }, 150)
  }

  private showDOMGameOver() {
    const score = this.score
    const div = document.createElement('div')
    div.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(0,0,20,0.95)',
      'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
      'z-index:99999', 'font-family:Arial Black,Arial', 'color:#fff',
    ].join(';')
    div.innerHTML = `
      <div style="font-size:38px;color:#ff3344;margin-bottom:20px;text-shadow:0 0 8px #000">GAME OVER</div>
      <div style="font-size:16px;color:#aabbdd;margin-bottom:6px">PUNTUACIÓ</div>
      <div style="font-size:56px;margin-bottom:30px;text-shadow:0 0 12px #2244cc">${score}</div>
      <button onclick="location.reload()" style="font-size:16px;padding:14px 36px;background:#2244cc;color:#fff;border:none;border-radius:10px;cursor:pointer;letter-spacing:1px">TORNAR A JUGAR</button>
    `
    document.body.appendChild(div)
  }

  private showGameOverUI() {
    soundManager.playGameOver()
    this.cameras.main.shake(300, 0.01)

    const finalScore = this.score
    const best = parseInt(localStorage.getItem('planetilla_best') ?? '0', 10)
    if (finalScore > best) localStorage.setItem('planetilla_best', String(finalScore))
    const bestScore = Math.max(best, finalScore)
    const isNew = finalScore > 0 && finalScore >= best

    const cx = GAME_WIDTH / 2
    const cy = GAME_HEIGHT / 2

    // Dark overlay — immediate, no tween
    const overlay = this.add.graphics().setDepth(100)
    overlay.fillStyle(0x000015, 0.92)
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Panel
    const panel = this.add.graphics().setDepth(101)
    panel.fillStyle(0x080820, 1)
    panel.fillRoundedRect(cx - 145, cy - 165, 290, 330, 16)
    panel.lineStyle(2, 0x4466ff, 1)
    panel.strokeRoundedRect(cx - 145, cy - 165, 290, 330, 16)

    this.add.text(cx, cy - 130, 'GAME OVER', {
      fontFamily: 'Arial Black', fontSize: '32px', color: '#ff3344',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(102)

    this.add.text(cx, cy - 60, 'PUNTUACIÓ', {
      fontFamily: 'Arial', fontSize: '11px', color: '#6688cc', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(102)

    this.add.text(cx, cy - 20, String(finalScore), {
      fontFamily: 'Arial Black', fontSize: '52px', color: '#ffffff',
      stroke: '#2244cc', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(102)

    this.add.text(cx, cy + 50, isNew ? 'NOU RECORD!' : 'RECORD', {
      fontFamily: 'Arial', fontSize: '11px',
      color: isNew ? '#FFD700' : '#6688cc', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(102)

    this.add.text(cx, cy + 75, String(bestScore), {
      fontFamily: 'Arial Black', fontSize: '22px',
      color: isNew ? '#FFD700' : '#aabbdd', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(102)

    const btnY = cy + 130
    const btnBg = this.add.graphics().setDepth(102)
    btnBg.fillStyle(0x2244cc, 1)
    btnBg.fillRoundedRect(cx - 100, btnY - 22, 200, 44, 10)

    this.add.text(cx, btnY, 'TORNAR A JUGAR', {
      fontFamily: 'Arial Black', fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(103)

    this.add.zone(cx, btnY, 200, 44).setInteractive().setDepth(104)
      .on('pointerover',  () => { btnBg.clear(); btnBg.fillStyle(0x3366ff, 1); btnBg.fillRoundedRect(cx - 100, btnY - 22, 200, 44, 10) })
      .on('pointerout',   () => { btnBg.clear(); btnBg.fillStyle(0x2244cc, 1); btnBg.fillRoundedRect(cx - 100, btnY - 22, 200, 44, 10) })
      .on('pointerdown',  () => this.scene.restart())
  }

  // Keep for potential future use
  private _drawSadPlanetUI(cx: number, cy: number) {
    const r = 34
    const g = this.add.graphics().setDepth(102)
    g.fillStyle(0x3050C8, 1); g.fillCircle(cx + r * 0.12, cy + r * 0.15, r * 0.94)
    g.fillStyle(0x4466DD, 1); g.fillCircle(cx, cy, r)
    g.fillStyle(0x7090FF, 0.45); g.fillCircle(cx - r * 0.22, cy - r * 0.2, r * 0.58)
    g.fillStyle(0xffffff, 0.55); g.fillCircle(cx - r * 0.3, cy - r * 0.28, r * 0.18)
    const ew = r * 0.13
    const eyeLX = cx - r * 0.28, eyeRX = cx + r * 0.28, eyeY = cy - r * 0.1
    g.lineStyle(Math.max(2, r * 0.08), 0x18182a, 1)
    g.lineBetween(eyeLX - ew, eyeY - ew, eyeLX + ew, eyeY + ew)
    g.lineBetween(eyeLX + ew, eyeY - ew, eyeLX - ew, eyeY + ew)
    g.lineBetween(eyeRX - ew, eyeY - ew, eyeRX + ew, eyeY + ew)
    g.lineBetween(eyeRX + ew, eyeY - ew, eyeRX - ew, eyeY + ew)
    g.lineStyle(Math.max(2, r * 0.075), 0x332233, 1)
    g.beginPath(); g.arc(cx, cy + r * 0.33 + r * 0.22 * 0.55, r * 0.22, Math.PI + 0.2, Math.PI * 2 - 0.2, false); g.strokePath()
    g.fillStyle(0x88ccff, 0.9)
    g.fillCircle(eyeLX - ew, eyeY + ew + r * 0.12, r * 0.065)
    g.fillTriangle(eyeLX - ew, eyeY + ew, eyeLX - ew - r * 0.055, eyeY + ew + r * 0.14, eyeLX - ew + r * 0.055, eyeY + ew + r * 0.14)
  }

  private spawnConfetti() {
    const colors = [0xFFD700, 0xFF6699, 0x66FFAA, 0x66AAFF, 0xFF8844]
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * GAME_WIDTH
      const p = this.add.graphics().setDepth(110)
      p.fillStyle(colors[Math.floor(Math.random() * colors.length)], 1)
      p.fillRect(-4, -4, 8, 8)
      p.setPosition(x, -10)
      this.tweens.add({
        targets: p, y: GAME_HEIGHT + 20, x: x + (Math.random() - 0.5) * 150,
        angle: Math.random() * 720 - 360,
        duration: 1500 + Math.random() * 1000, delay: Math.random() * 800,
        ease: 'Power1', onComplete: () => p.destroy(),
      })
    }
  }
}
