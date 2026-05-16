import Phaser from 'phaser'
import { PlanetConfig } from '../config/planets'
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig'

export function playMergeEffect(scene: Phaser.Scene, x: number, y: number, config: PlanetConfig) {
  const color = config.glowColor

  const ring = scene.add.graphics()
  ring.setDepth(20)
  ring.lineStyle(4, color, 1)
  ring.strokeCircle(x, y, config.radius)

  scene.tweens.add({
    targets: ring,
    scaleX: 3,
    scaleY: 3,
    alpha: 0,
    duration: 500,
    ease: 'Power2',
    onComplete: () => ring.destroy(),
  })

  const flash = scene.add.graphics()
  flash.setDepth(21)
  flash.fillStyle(color, 0.8)
  flash.fillCircle(x, y, config.radius * 1.5)

  scene.tweens.add({
    targets: flash,
    alpha: 0,
    scaleX: 2,
    scaleY: 2,
    duration: 300,
    ease: 'Power3',
    onComplete: () => flash.destroy(),
  })

  const particleCount = 12 + config.id * 3
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2
    const speed = 80 + Math.random() * 140
    const size = 2 + Math.random() * 3

    const p = scene.add.graphics()
    p.setDepth(22)
    p.fillStyle(color, 1)
    p.fillCircle(0, 0, size)
    p.setPosition(x, y)

    const tx = x + Math.cos(angle) * speed * 2
    const ty = y + Math.sin(angle) * speed * 2

    scene.tweens.add({
      targets: p,
      x: tx,
      y: ty,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 400 + Math.random() * 300,
      ease: 'Power2',
      onComplete: () => p.destroy(),
    })
  }

  if (config.id >= 4) {
    const cam = scene.cameras.main
    cam.shake(180, 0.006 * (config.id - 3))
  }
}

export function playExplosionEffect(scene: Phaser.Scene, x: number, y: number, radius: number) {
  const shockwave = scene.add.graphics()
  shockwave.setDepth(25)
  shockwave.lineStyle(6, 0xffffff, 1)
  shockwave.strokeCircle(x, y, 10)

  scene.tweens.add({
    targets: shockwave,
    scaleX: radius / 10,
    scaleY: radius / 10,
    alpha: 0,
    duration: 600,
    ease: 'Power2',
    onComplete: () => shockwave.destroy(),
  })

  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2
    const speed = 150 + Math.random() * 200

    const p = scene.add.graphics()
    p.setDepth(26)
    p.fillStyle(0xffffff, 1)
    p.fillCircle(0, 0, 3 + Math.random() * 4)
    p.setPosition(x, y)

    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * speed * 2,
      y: y + Math.sin(angle) * speed * 2,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 600 + Math.random() * 400,
      ease: 'Power2',
      onComplete: () => p.destroy(),
    })
  }

  scene.cameras.main.shake(300, 0.015)

  const flash = scene.add.graphics()
  flash.setDepth(27)
  flash.fillStyle(0xffffff, 0.6)
  flash.fillCircle(x, y, radius * 1.2)

  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 250,
    ease: 'Power3',
    onComplete: () => flash.destroy(),
  })
}

export function playSunEffect(scene: Phaser.Scene, x: number, y: number) {
  // Full-screen golden flash
  const screenFlash = scene.add.graphics()
  screenFlash.setDepth(80)
  screenFlash.fillStyle(0xFFDD00, 0.75)
  screenFlash.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  scene.tweens.add({
    targets: screenFlash,
    alpha: 0,
    duration: 900,
    ease: 'Power2',
    onComplete: () => screenFlash.destroy(),
  })

  // Multiple expanding rings
  const ringColors = [0xFFFF00, 0xFFAA00, 0xFFFFAA, 0xFFCC44]
  for (let i = 0; i < 4; i++) {
    const ring = scene.add.graphics()
    ring.setDepth(82)
    ring.lineStyle(6 - i, ringColors[i % ringColors.length], 1)
    ring.strokeCircle(x, y, 20)
    scene.tweens.add({
      targets: ring,
      scaleX: 14 + i * 3,
      scaleY: 14 + i * 3,
      alpha: 0,
      delay: i * 120,
      duration: 900 + i * 100,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    })
  }

  // Corona rays
  for (let i = 0; i < 16; i++) {
    const angle  = (i / 16) * Math.PI * 2
    const length = 80 + Math.random() * 120
    const ray    = scene.add.graphics()
    ray.setDepth(81)
    ray.lineStyle(3, 0xFFEE44, 0.9)
    ray.lineBetween(x, y, x + Math.cos(angle) * 30, y + Math.sin(angle) * 30)
    scene.tweens.add({
      targets: ray,
      x: Math.cos(angle) * length,
      y: Math.sin(angle) * length,
      alpha: 0,
      scaleX: 0.2,
      duration: 800,
      ease: 'Power2',
      onComplete: () => ray.destroy(),
    })
  }

  // Burst particles
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2 + Math.random() * 0.3
    const speed = 150 + Math.random() * 250
    const p = scene.add.graphics()
    p.setDepth(83)
    p.fillStyle(i % 2 === 0 ? 0xFFFF88 : 0xFFAA00, 1)
    p.fillCircle(0, 0, 2 + Math.random() * 4)
    p.setPosition(x, y)
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * speed * 2.5,
      y: y + Math.sin(angle) * speed * 2.5,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 800 + Math.random() * 500,
      ease: 'Power2',
      onComplete: () => p.destroy(),
    })
  }

  // "SOL!" text
  const txt = scene.add.text(x, y - 40, '☀️ SOL!', {
    fontFamily: 'Arial Black',
    fontSize: '36px',
    color: '#FFE000',
    stroke: '#FF8800',
    strokeThickness: 6,
  }).setOrigin(0.5).setDepth(90).setScale(0)

  scene.tweens.add({
    targets: txt,
    scaleX: 1.2,
    scaleY: 1.2,
    duration: 400,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: txt,
        y: y - 120,
        alpha: 0,
        delay: 600,
        duration: 600,
        onComplete: () => txt.destroy(),
      })
    },
  })

  scene.cameras.main.shake(500, 0.025)
  scene.cameras.main.flash(400, 255, 220, 0, false)
}
