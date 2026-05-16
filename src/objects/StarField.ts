import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig'

interface Star {
  x: number
  y: number
  radius: number
  alpha: number
  speed: number
  twinkleOffset: number
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  length: number
  color: number
}

export class StarField {
  private scene: Phaser.Scene
  private graphics: Phaser.GameObjects.Graphics
  private shootingGfx: Phaser.GameObjects.Graphics
  private stars: Star[] = []
  private shootingStars: ShootingStar[] = []
  private nebulae: Phaser.GameObjects.Graphics
  private time = 0
  private nextShootingStarIn = 2000 + Math.random() * 4000

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    this.nebulae = scene.add.graphics()
    this.nebulae.setDepth(1)
    this.drawNebulae()

    this.graphics = scene.add.graphics()
    this.graphics.setDepth(2)

    this.shootingGfx = scene.add.graphics()
    this.shootingGfx.setDepth(3)

    this.generateStars()
  }

  private drawNebulae() {
    const g = this.nebulae
    g.clear()

    const nebulaData = [
      { x: 80,  y: 150, rx: 120, ry: 80,  color: 0x1a0a3a, alpha: 0.5 },
      { x: 400, y: 300, rx: 100, ry: 140, color: 0x0a1a3a, alpha: 0.4 },
      { x: 200, y: 550, rx: 140, ry: 90,  color: 0x0a2a1a, alpha: 0.3 },
      { x: 420, y: 600, rx: 80,  ry: 100, color: 0x2a0a1a, alpha: 0.35 },
    ]

    for (const n of nebulaData) {
      for (let r = 0; r < 8; r++) {
        const t = r / 8
        const alpha = n.alpha * (1 - t) * 0.3
        g.fillStyle(n.color, alpha)
        g.fillEllipse(n.x, n.y, n.rx * 2 * (1 - t * 0.3), n.ry * 2 * (1 - t * 0.3))
      }
    }
  }

  private generateStars() {
    const counts = [120, 60, 20]
    const sizes  = [0.6, 1.2, 2.0]

    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < counts[layer]; i++) {
        this.stars.push({
          x: Math.random() * GAME_WIDTH,
          y: Math.random() * GAME_HEIGHT,
          radius: sizes[layer],
          alpha: 0.4 + Math.random() * 0.6,
          speed: 0.2 + layer * 0.15,
          twinkleOffset: Math.random() * Math.PI * 2,
        })
      }
    }
  }

  private spawnShootingStar() {
    const colors = [0xffffff, 0xaaddff, 0xffeeaa, 0xccaaff]
    const angle  = Math.PI * 0.15 + Math.random() * Math.PI * 0.2
    const speed  = 350 + Math.random() * 250

    this.shootingStars.push({
      x: Math.random() * GAME_WIDTH * 1.2 - GAME_WIDTH * 0.1,
      y: -10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.5,
      length: 40 + Math.random() * 80,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }

  update(delta: number) {
    this.time += delta * 0.001
    const dt = delta * 0.001

    // Stars
    this.graphics.clear()
    for (const star of this.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(this.time * star.speed * 3 + star.twinkleOffset)
      const alpha = star.alpha * (0.6 + 0.4 * twinkle)

      this.graphics.fillStyle(0xffffff, alpha)
      this.graphics.fillCircle(star.x, star.y, star.radius)

      if (star.radius >= 1.8) {
        this.graphics.fillStyle(0xaaddff, alpha * 0.3)
        this.graphics.fillCircle(star.x, star.y, star.radius * 2.5)
      }
    }

    // Shooting stars timer
    this.nextShootingStarIn -= delta
    if (this.nextShootingStarIn <= 0) {
      this.spawnShootingStar()
      this.nextShootingStarIn = 3000 + Math.random() * 6000
    }

    // Draw + update shooting stars
    this.shootingGfx.clear()
    this.shootingStars = this.shootingStars.filter(s => {
      s.x    += s.vx * dt
      s.y    += s.vy * dt
      s.life += dt

      const t     = s.life / s.maxLife
      const alpha = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7
      const tailX = s.x - (s.vx / Math.sqrt(s.vx * s.vx + s.vy * s.vy)) * s.length * alpha
      const tailY = s.y - (s.vy / Math.sqrt(s.vx * s.vx + s.vy * s.vy)) * s.length * alpha

      // Glow head
      this.shootingGfx.fillStyle(s.color, alpha * 0.9)
      this.shootingGfx.fillCircle(s.x, s.y, 2.5)
      this.shootingGfx.fillStyle(s.color, alpha * 0.3)
      this.shootingGfx.fillCircle(s.x, s.y, 5)

      // Tail gradient (3 segments)
      for (let i = 0; i < 3; i++) {
        const f  = i / 3
        const g2 = 1 - f
        const px = s.x + (tailX - s.x) * f
        const py = s.y + (tailY - s.y) * f
        const qx = s.x + (tailX - s.x) * (f + 1 / 3)
        const qy = s.y + (tailY - s.y) * (f + 1 / 3)
        this.shootingGfx.lineStyle(2 * g2, s.color, alpha * g2 * 0.85)
        this.shootingGfx.beginPath()
        this.shootingGfx.moveTo(px, py)
        this.shootingGfx.lineTo(qx, qy)
        this.shootingGfx.strokePath()
      }

      return s.life < s.maxLife && s.x < GAME_WIDTH + 50 && s.y < GAME_HEIGHT + 50
    })
  }
}
