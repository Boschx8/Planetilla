import Phaser from 'phaser'
import { PLANETS, PlanetConfig, SHAPE_WAVES } from '../config/planets'

// Base sphere colour, shadow tint, surface detail colour
const BASE   = [0xC8A878, 0xB8B8B8, 0xF0C860, 0x4898E0, 0xCC4818, 0xE8A850, 0xE8CC70, 0x48D8D0, 0x3060D8, 0xFFCC00]
const SHADOW = [0x8B6448, 0x787878, 0xC88830, 0x1A5090, 0x902010, 0xC07828, 0xC8A040, 0x289090, 0x183898, 0xCC8800]
const DETAIL = [0x7A5835, 0x606060, 0xD4A030, 0x3AAA50, 0x883010, 0xC87030, 0xD0B050, 0x30B0A8, 0x1A3898, 0xFF8800]

export function generatePlanetTextures(scene: Phaser.Scene) {
  for (const config of PLANETS) {
    if (config.texture === 'supernova') continue
    const id = Math.min(config.id, 9)
    drawPlanet(scene, config, BASE[id], SHADOW[id], DETAIL[id])
  }
  drawSaturnRingsTexture(scene, PLANETS.find(p => p.texture === 'saturn')!)
  drawNeptuneRingsTexture(scene, PLANETS.find(p => p.texture === 'neptune')!)
}

// Backwards-compat export used by BootScene
export function generateSaturnRings(scene: Phaser.Scene, config: PlanetConfig) {
  drawSaturnRingsTexture(scene, config)
}

// ─── main planet draw ──────────────────────────────────────────────────────

// ─── polygon / bumpy shape helpers ────────────────────────────────────────

function filledPoly(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  sides: number, color: number, alpha: number,
) {
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  g.fillStyle(color, alpha)
  g.beginPath()
  pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
  g.closePath()
  g.fillPath()
}

function bumpedPoly(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  waves: Array<[number, number, number]>,
  color: number, alpha: number,
) {
  const steps = 32   // enough points to look smooth
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    let br = r
    for (const [freq, amp, phase] of waves) br += r * amp * Math.sin(freq * angle + phase)
    pts.push({ x: cx + Math.cos(angle) * br, y: cy + Math.sin(angle) * br })
  }
  g.fillStyle(color, alpha)
  g.beginPath()
  pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
  g.closePath()
  g.fillPath()
}

// ─── main planet draw ──────────────────────────────────────────────────────

function drawPlanet(
  scene: Phaser.Scene,
  config: PlanetConfig,
  baseColor: number,
  shadowColor: number,
  detailColor: number,
) {
  const r  = config.radius
  const g  = scene.make.graphics({ x: 0, y: 0 } as any)
  const cx = r, cy = r
  const ol = Math.max(3, r * 0.09)
  const ir = r - ol * 0.6

  const waves = SHAPE_WAVES[config.shape as keyof typeof SHAPE_WAVES]
  const sides = config.shape === 'poly5' ? 5 : config.shape === 'poly6' ? 6 : 0

  if (waves) {
    // ── organic bumpy planet (asteroid / meteorite) ─────────────────────────
    // Scale base so max bump extent = r, fitting exactly within the texture canvas
    const maxAmp = waves.reduce((sum, [, amp]) => sum + amp, 0)
    const vr  = r / (1 + maxAmp)   // base radius: bumps reach exactly r at peak
    const vir = vr - ol * 0.6

    bumpedPoly(g, cx, cy, vr,  waves, 0x111122, 1)  // outline
    bumpedPoly(g, cx, cy, vir, waves, baseColor, 1)  // fill

    // Surface craters / blotches within the shape
    if (config.id === 0) {  // Asteroide — dark brownish blotches
      for (const [dx, dy, cr, a] of [
        [0.18, -0.22, 0.16, 0.62], [-0.22, 0.16, 0.13, 0.52], [0.06, 0.28, 0.10, 0.48],
      ] as number[][]) {
        g.fillStyle(detailColor, a)
        g.fillCircle(cx + vir * dx, cy + vir * dy, vir * cr)
      }
    } else {  // Meteorite (Mercury) — grey craters
      for (const [dx, dy, cr] of [
        [0.20, -0.26, 0.14], [-0.26, 0.14, 0.11], [0.05, 0.32, 0.09], [-0.10, -0.14, 0.08],
      ] as number[][]) {
        g.fillStyle(shadowColor, 0.52)
        g.fillCircle(cx + vir * dx, cy + vir * dy, vir * cr)
      }
    }

    // Highlight
    g.fillStyle(0xffffff, 0.48)
    g.fillCircle(cx - vir * 0.30, cy - vir * 0.28, vir * 0.13)

    // Face — within the minimum inscribed circle of the fill shape
    const faceR = vir * (1 - maxAmp) * 0.92
    drawFace(g, config.id, cx, cy, faceR)
  } else if (sides > 0) {
    // ── polygon planet ──────────────────────────────────────────────────────
    filledPoly(g, cx, cy, r,  sides, 0x111122, 1)   // outline
    filledPoly(g, cx, cy, ir, sides, baseColor, 1)  // fill

    // Subtle top-left highlight (small enough to stay well inside polygon)
    g.fillStyle(0xffffff, 0.50)
    g.fillCircle(cx - ir * 0.32, cy - ir * 0.30, ir * 0.16)

    // Face uses 80% of inner radius to stay inside the polygon's inscribed circle
    drawFace(g, config.id, cx, cy, ir * 0.80)
  } else {
    // ── circle planet ───────────────────────────────────────────────────────
    if (config.id === 9) drawSunRays(g, cx, cy, ir, detailColor)

    g.fillStyle(0x111122, 1)
    g.fillCircle(cx, cy, r)
    g.fillStyle(baseColor, 1)
    g.fillCircle(cx, cy, ir)

    drawSurface(g, config.id, cx, cy, ir, baseColor, shadowColor, detailColor)

    g.fillStyle(shadowColor, 0.32)
    g.fillCircle(cx + ir * 0.30, cy + ir * 0.28, ir * 0.78)
    g.fillStyle(0xffffff, 0.11)
    g.fillCircle(cx - ir * 0.18, cy - ir * 0.14, ir * 0.75)
    g.fillStyle(0xffffff, 0.65)
    g.fillCircle(cx - ir * 0.36, cy - ir * 0.33, ir * 0.19)

    drawFace(g, config.id, cx, cy, ir)
  }

  g.generateTexture(config.texture, r * 2, r * 2)
  g.destroy()
}

// ─── surface details ───────────────────────────────────────────────────────

function drawSurface(
  g: Phaser.GameObjects.Graphics,
  id: number, cx: number, cy: number, r: number,
  base: number, shadow: number, detail: number,
) {
  switch (id) {
    case 0: { // Asteroide — 3 brownish blotches (fallback, unused for bumpy shape)
      for (const [dx, dy, cr, a] of [
        [0.25, -0.30, 0.22, 0.70], [-0.30, 0.20, 0.18, 0.60], [0.10, 0.38, 0.14, 0.55],
      ] as number[][]) {
        g.fillStyle(detail, a)
        g.fillCircle(cx + r * dx, cy + r * dy, r * cr)
      }
      break
    }
    case 1: { // Mercuri — scattered craters
      for (const [dx, dy, cr] of [
        [0.24, -0.32, 0.17], [-0.32, 0.18, 0.14],
        [0.08, 0.40, 0.12], [-0.14, -0.18, 0.10], [0.38, 0.14, 0.09],
      ] as number[][]) {
        g.fillStyle(shadow, 0.55)
        g.fillCircle(cx + r * dx, cy + r * dy, r * cr)
        g.fillStyle(0x222222, 0.22)
        g.strokeCircle(cx + r * dx, cy + r * dy, r * cr)
      }
      break
    }
    case 2: { // Venus — horizontal wavy bands
      const lw = Math.max(2, r * 0.12)
      g.lineStyle(lw, detail, 0.35)
      for (const yOff of [-0.40, -0.05, 0.35]) {
        const dy = yOff * r
        if (Math.abs(dy) >= r) break
        const hw = Math.sqrt(r * r - dy * dy) * 0.82
        g.beginPath(); g.moveTo(cx - hw, cy + dy); g.lineTo(cx + hw, cy + dy); g.strokePath()
      }
      break
    }
    case 3: { // Terra — continent + cloud patches
      g.fillStyle(detail, 0.88)
      g.fillEllipse(cx - r * 0.10, cy - r * 0.06, r * 0.80, r * 0.60)
      g.fillStyle(0xffffff, 0.80)
      g.fillEllipse(cx + r * 0.24, cy - r * 0.36, r * 0.35, r * 0.16)
      g.fillEllipse(cx - r * 0.28, cy + r * 0.30, r * 0.28, r * 0.12)
      break
    }
    case 4: { // Mart — dark patches + subtle crater
      g.fillStyle(shadow, 0.55)
      g.fillEllipse(cx + r * 0.18, cy + r * 0.10, r * 0.52, r * 0.40)
      g.fillEllipse(cx - r * 0.28, cy - r * 0.20, r * 0.30, r * 0.24)
      g.fillStyle(0xffffff, 0.55)
      g.fillEllipse(cx, cy - r * 0.72, r * 0.32, r * 0.14)  // polar cap
      break
    }
    case 5: { // Júpiter — horizontal bands + great red spot
      const lw5 = Math.max(2, r * 0.16)
      g.lineStyle(lw5, shadow, 0.50)
      for (const yOff of [-0.48, -0.12, 0.24, 0.55]) {
        const dy = yOff * r
        if (Math.abs(dy) >= r) break
        const hw = Math.sqrt(r * r - dy * dy) * 0.90
        g.beginPath(); g.moveTo(cx - hw, cy + dy); g.lineTo(cx + hw, cy + dy); g.strokePath()
      }
      g.fillStyle(0xCC3300, 0.70)
      g.fillEllipse(cx + r * 0.24, cy + r * 0.13, r * 0.36, r * 0.22)
      break
    }
    case 6: { // Saturn — subtle bands
      const lw6 = Math.max(2, r * 0.10)
      g.lineStyle(lw6, shadow, 0.40)
      for (const yOff of [-0.30, 0.20]) {
        const dy = yOff * r
        const hw = Math.sqrt(r * r - dy * dy) * 0.85
        g.beginPath(); g.moveTo(cx - hw, cy + dy); g.lineTo(cx + hw, cy + dy); g.strokePath()
      }
      break
    }
    case 7: { // Urà — very smooth, faint bands
      const lw7 = Math.max(1.5, r * 0.08)
      g.lineStyle(lw7, shadow, 0.28)
      for (const yOff of [-0.22, 0.20]) {
        const dy = yOff * r
        const hw = Math.sqrt(r * r - dy * dy) * 0.82
        g.beginPath(); g.moveTo(cx - hw, cy + dy); g.lineTo(cx + hw, cy + dy); g.strokePath()
      }
      break
    }
    case 8: { // Neptú — deep blue bands
      const lw8 = Math.max(2, r * 0.12)
      g.lineStyle(lw8, shadow, 0.45)
      for (const yOff of [-0.42, -0.10, 0.28]) {
        const dy = yOff * r
        if (Math.abs(dy) >= r) break
        const hw = Math.sqrt(r * r - dy * dy) * 0.86
        g.beginPath(); g.moveTo(cx - hw, cy + dy); g.lineTo(cx + hw, cy + dy); g.strokePath()
      }
      break
    }
    case 9: { // Sol — freckles / sunspots
      for (const [dx, dy, cr] of [
        [-0.18, 0.20, 0.10], [0.30, -0.10, 0.09], [-0.30, -0.15, 0.07],
        [0.12, 0.38, 0.08], [-0.08, -0.38, 0.06],
      ] as number[][]) {
        g.fillStyle(detail, 0.55)
        g.fillCircle(cx + r * dx, cy + r * dy, r * cr)
      }
      break
    }
  }
}

// ─── Sun rays ──────────────────────────────────────────────────────────────

function drawSunRays(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, ir: number, color: number,
) {
  const rayCount = 16
  const tipR    = ir * 1.38   // how far the tip extends (≈ up to texture edge)
  const baseR   = ir * 1.01   // where the ray base meets the sphere edge
  const halfW   = ir * 0.08   // half-width at the base

  for (let i = 0; i < rayCount; i++) {
    const angle    = (i / rayCount) * Math.PI * 2
    const perpA    = angle + Math.PI / 2
    const tipX     = cx + Math.cos(angle) * tipR
    const tipY     = cy + Math.sin(angle) * tipR
    const bx       = cx + Math.cos(angle) * baseR
    const by       = cy + Math.sin(angle) * baseR
    const px       = Math.cos(perpA) * halfW
    const py       = Math.sin(perpA) * halfW
    const alpha    = i % 2 === 0 ? 0.95 : 0.70
    g.fillStyle(color, alpha)
    g.fillTriangle(tipX, tipY, bx + px, by + py, bx - px, by - py)
  }
}

// ─── kawaii faces ──────────────────────────────────────────────────────────

function drawFace(
  g: Phaser.GameObjects.Graphics,
  id: number, cx: number, cy: number, r: number,
) {
  const sw  = Math.max(1.5, r * 0.07)
  const eR  = Math.max(3.5, r * 0.18)
  const eLX = cx - r * 0.28
  const eRX = cx + r * 0.28
  const eY  = cy - r * 0.08

  switch (id) {
    case 0: drawFacePluto(g, cx, cy, r, eLX, eRX, eY, eR, sw); break
    case 1: drawFaceMercury(g, cx, cy, r, eLX, eRX, eY, eR, sw); break
    case 2: drawFaceVenus(g, cx, cy, r, eLX, eRX, eY, eR, sw); break
    case 3: drawFaceEarth(g, cx, cy, r, eLX, eRX, eY, eR, sw); break
    case 4: drawFaceMars(g, cx, cy, r, eLX, eRX, eY, eR, sw); break
    case 5: drawFaceJupiter(g, cx, cy, r, eLX, eRX, eY, eR, sw); break
    case 6: drawFaceSaturn(g, cx, cy, r, eLX, eRX, eY, eR, sw); break
    case 7: drawFaceUranus(g, cx, cy, r, eLX, eRX, eY, eR, sw); break
    case 8: drawFaceNeptune(g, cx, cy, r, eLX, eRX, eY, eR, sw); break
    case 9: drawFaceSun(g, cx, cy, r, eLX, eRX, eY, eR, sw); break
  }
}

// ── shared helpers ────────────────────────────────────────────────────────

function cheeks(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number) {
  g.fillStyle(0xFF8899, 0.50)
  g.fillEllipse(cx - r * 0.42, cy + r * 0.26, r * 0.52, r * 0.26)
  g.fillEllipse(cx + r * 0.42, cy + r * 0.26, r * 0.52, r * 0.26)
}

// Closed happy eye: upward arc (~~)
function closedEyeHappy(
  g: Phaser.GameObjects.Graphics,
  ex: number, ey: number, eR: number, sw: number,
) {
  g.lineStyle(sw * 2.0, 0x111122, 1)
  g.beginPath()
  g.arc(ex, ey + eR * 0.55, eR, Math.PI + 0.3, 2 * Math.PI - 0.3, false)
  g.strokePath()
}

// Closed sleepy eye: downward arc (drooping)
function closedEyeSleepy(
  g: Phaser.GameObjects.Graphics,
  ex: number, ey: number, eR: number, sw: number,
) {
  g.lineStyle(sw * 2.2, 0x111122, 1)
  g.beginPath()
  g.arc(ex, ey - eR * 0.30, eR * 0.95, 0.2, Math.PI - 0.2, false)
  g.strokePath()
}

// Closed wink: tight upward arc (><)
function closedEyeWink(
  g: Phaser.GameObjects.Graphics,
  ex: number, ey: number, eR: number, sw: number,
) {
  g.lineStyle(sw * 2.0, 0x111122, 1)
  g.lineBetween(ex - eR * 0.80, ey - eR * 0.50, ex, ey + eR * 0.18)
  g.lineBetween(ex + eR * 0.80, ey - eR * 0.50, ex, ey + eR * 0.18)
}

function smile(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, sw: number) {
  g.lineStyle(sw * 1.3, 0x111122, 1)
  g.beginPath()
  g.arc(cx, cy + r * 0.14, r * 0.22, 0.15, Math.PI - 0.15, false)
  g.strokePath()
}

// ── per-planet face functions ─────────────────────────────────────────────

function drawFacePluto(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  eLX: number, eRX: number, eY: number, eR: number, sw: number,
) {
  // Sad brows (inner corners raised = sad expression)
  g.lineStyle(sw * 1.4, 0x111122, 1)
  const bY = eY - eR * 1.4
  g.lineBetween(eLX - eR * 0.80, bY, eLX + eR * 0.45, bY - sw * 2)
  g.lineBetween(eRX - eR * 0.45, bY - sw * 2, eRX + eR * 0.80, bY)

  // Sad drooping eyes (like Neptune but with inner-raised brows making it sadder)
  closedEyeSleepy(g, eLX, eY, eR, sw)
  closedEyeSleepy(g, eRX, eY, eR, sw)

  cheeks(g, cx, cy, r)

  // Frown
  g.lineStyle(sw * 1.3, 0x111122, 1)
  g.beginPath()
  g.arc(cx, cy + r * 0.42, r * 0.17, Math.PI + 0.3, 2 * Math.PI - 0.3, false)
  g.strokePath()

  // Teardrop under left eye
  const tx = eLX - eR * 0.10, ty = eY + eR * 1.5
  g.fillStyle(0x88ccff, 0.90)
  g.fillCircle(tx, ty + r * 0.04, r * 0.058)
  g.fillTriangle(tx, ty - r * 0.03, tx - r * 0.048, ty + r * 0.06, tx + r * 0.048, ty + r * 0.06)
}

function drawFaceMercury(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  eLX: number, eRX: number, eY: number, eR: number, sw: number,
) {
  // Left eye: happy closed ~~
  closedEyeHappy(g, eLX, eY, eR, sw)
  // Right eye: wink ><
  closedEyeWink(g, eRX, eY, eR, sw)

  cheeks(g, cx, cy, r)
  smile(g, cx, cy, r, sw)
}

function drawFaceVenus(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  eLX: number, eRX: number, eY: number, eR: number, sw: number,
) {
  closedEyeHappy(g, eLX, eY, eR, sw)
  closedEyeHappy(g, eRX, eY, eR, sw)
  cheeks(g, cx, cy, r)
  smile(g, cx, cy, r, sw)
}

function drawFaceEarth(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  eLX: number, eRX: number, eY: number, eR: number, sw: number,
) {
  closedEyeHappy(g, eLX, eY, eR, sw)
  closedEyeHappy(g, eRX, eY, eR, sw)
  cheeks(g, cx, cy, r)
  // Big smile arc
  g.lineStyle(sw * 1.4, 0x111122, 1)
  g.beginPath()
  g.arc(cx, cy + r * 0.12, r * 0.28, 0.12, Math.PI - 0.12, false)
  g.strokePath()
}

function drawFaceMars(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  eLX: number, eRX: number, eY: number, eR: number, sw: number,
) {
  // Angry V brows
  g.lineStyle(sw * 1.6, 0x111122, 1)
  const bY = eY - eR * 1.4
  g.lineBetween(eLX - eR * 0.85, bY + sw, eLX + eR * 0.60, bY - sw * 0.8)
  g.lineBetween(eRX - eR * 0.60, bY - sw * 0.8, eRX + eR * 0.85, bY + sw)

  // Angry wink eyes (>< on both)
  closedEyeWink(g, eLX, eY, eR, sw)
  closedEyeWink(g, eRX, eY, eR, sw)

  cheeks(g, cx, cy, r)

  // Big smile arc (tsundere — angry face but smiling)
  g.lineStyle(sw * 1.4, 0x111122, 1)
  g.beginPath()
  g.arc(cx, cy + r * 0.12, r * 0.28, 0.12, Math.PI - 0.12, false)
  g.strokePath()
}

function drawFaceJupiter(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  eLX: number, eRX: number, eY: number, eR: number, sw: number,
) {
  // Both eyes laughing ><
  closedEyeWink(g, eLX, eY, eR, sw)
  closedEyeWink(g, eRX, eY, eR, sw)

  cheeks(g, cx, cy, r)

  // Wide laughing mouth arc (big, no teeth)
  g.lineStyle(sw * 1.5, 0x111122, 1)
  g.beginPath()
  g.arc(cx, cy + r * 0.10, r * 0.32, 0.08, Math.PI - 0.08, false)
  g.strokePath()
}

function drawFaceSaturn(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  eLX: number, eRX: number, eY: number, eR: number, sw: number,
) {
  closedEyeHappy(g, eLX, eY, eR, sw)
  closedEyeHappy(g, eRX, eY, eR, sw)
  cheeks(g, cx, cy, r)
  smile(g, cx, cy, r, sw)
}

function drawFaceUranus(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  eLX: number, eRX: number, eY: number, eR: number, sw: number,
) {
  // Left: happy ~~ / Right: wink ><
  closedEyeHappy(g, eLX, eY, eR, sw)
  closedEyeWink(g, eRX, eY, eR, sw)

  cheeks(g, cx, cy, r)
  smile(g, cx, cy, r, sw)
}

function drawFaceNeptune(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  eLX: number, eRX: number, eY: number, eR: number, sw: number,
) {
  closedEyeSleepy(g, eLX, eY, eR, sw)
  closedEyeSleepy(g, eRX, eY, eR, sw)

  // Eyelashes
  g.lineStyle(sw, 0x111122, 1)
  for (let i = 0; i < 3; i++) {
    const lx = eLX + (i - 1) * eR * 0.55
    g.lineBetween(lx, eY + eR * 0.60, lx, eY + eR * 0.90 + (i === 1 ? eR * 0.12 : 0))
  }
  for (let i = 0; i < 3; i++) {
    const lx = eRX + (i - 1) * eR * 0.55
    g.lineBetween(lx, eY + eR * 0.60, lx, eY + eR * 0.90 + (i === 1 ? eR * 0.12 : 0))
  }

  cheeks(g, cx, cy, r)

  // Small O mouth
  g.fillStyle(0x111122, 0.85)
  g.fillCircle(cx, cy + r * 0.40, r * 0.10)
}

function drawFaceSun(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  eLX: number, eRX: number, eY: number, eR: number, sw: number,
) {
  closedEyeHappy(g, eLX, eY, eR, sw)
  closedEyeHappy(g, eRX, eY, eR, sw)
  cheeks(g, cx, cy, r)
  smile(g, cx, cy, r, sw)
}

// ─── Saturn rings texture ──────────────────────────────────────────────────

function drawSaturnRingsTexture(scene: Phaser.Scene, config: PlanetConfig) {
  const r  = config.radius
  const rw = Math.round(r * 1.55)
  const rh = Math.round(r * 0.44)
  const cx = rw, cy = rh
  const g  = scene.make.graphics({ x: 0, y: 0 } as any)

  const rings = [
    { rw: rw * 0.98, rh: rh * 0.98, color: 0xC8B870, alpha: 0.28, lw: 4 },
    { rw: rw * 0.88, rh: rh * 0.88, color: 0xD8C880, alpha: 0.48, lw: 5 },
    { rw: rw * 0.76, rh: rh * 0.76, color: 0xE8D890, alpha: 0.62, lw: 6 },
    { rw: rw * 0.65, rh: rh * 0.65, color: 0xF0E0A0, alpha: 0.38, lw: 4 },
  ]
  for (const d of rings) {
    g.lineStyle(d.lw, d.color, d.alpha)
    g.strokeEllipse(cx, cy, d.rw * 2, d.rh * 2)
  }

  g.generateTexture('saturn_rings', rw * 2, rh * 2)
  g.destroy()
}

// ─── Neptune rings texture ─────────────────────────────────────────────────

function drawNeptuneRingsTexture(scene: Phaser.Scene, config: PlanetConfig) {
  const r  = config.radius
  // Narrower and less flat than Saturn — distinct silhouette
  const rw = Math.round(r * 1.60)
  const rh = Math.round(r * 0.38)
  const cx = rw, cy = rh
  const g  = scene.make.graphics({ x: 0, y: 0 } as any)

  // Dark blue-indigo thin rings
  const rings = [
    { rw: rw * 0.98, rh: rh * 0.98, color: 0x6688FF, alpha: 0.20, lw: 2 },
    { rw: rw * 0.86, rh: rh * 0.86, color: 0x8899FF, alpha: 0.40, lw: 3 },
    { rw: rw * 0.72, rh: rh * 0.72, color: 0xAABBFF, alpha: 0.55, lw: 2 },
    { rw: rw * 0.60, rh: rh * 0.60, color: 0x6677EE, alpha: 0.28, lw: 2 },
  ]
  for (const d of rings) {
    g.lineStyle(d.lw, d.color, d.alpha)
    g.strokeEllipse(cx, cy, d.rw * 2, d.rh * 2)
  }

  g.generateTexture('neptune_rings', rw * 2, rh * 2)
  g.destroy()
}

// ─── Supernova texture (for special planet id=10) ──────────────────────────

export function generateSupernovaTexture(scene: Phaser.Scene) {
  const size = 56
  const cx = size / 2, cy = size / 2
  const g = scene.make.graphics({ x: 0, y: 0 } as any)

  for (let i = 5; i > 0; i--) {
    g.fillStyle(0xffaa00, 0.07 * i)
    g.fillCircle(cx, cy, size * 0.46 * (i / 5 + 0.5))
  }

  const rays = 8
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2
    const len   = i % 2 === 0 ? size * 0.46 : size * 0.28
    g.fillStyle(0xffe066, 0.85)
    const cos = Math.cos(angle), sin = Math.sin(angle)
    const tipX = cx + cos * len, tipY = cy + sin * len
    const px = -sin * size * 0.04, py = cos * size * 0.04
    g.fillTriangle(tipX, tipY, cx + px, cy + py, cx - px, cy - py)
  }

  g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, size * 0.18)
  g.fillStyle(0xffee88, 0.9); g.fillCircle(cx, cy, size * 0.13)
  g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, size * 0.07)

  g.generateTexture('supernova', size, size)
  g.destroy()
}
