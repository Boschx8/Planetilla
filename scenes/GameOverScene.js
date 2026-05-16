import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
export class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }
    create(data) {
        const score = data?.score ?? 0;
        const best = parseInt(localStorage.getItem('planetilla_best') ?? '0', 10);
        const isNew = score >= best && score > 0;
        // Dark overlay with stars
        const bg = this.add.graphics();
        bg.fillStyle(0x00000a, 0.92);
        bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        for (let i = 0; i < 60; i++) {
            bg.fillStyle(0xffffff, Math.random() * 0.5 + 0.1);
            bg.fillCircle(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT, Math.random() * 1.5 + 0.3);
        }
        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(0x080820, 0.96);
        panel.fillRoundedRect(GAME_WIDTH / 2 - 160, GAME_HEIGHT / 2 - 200, 320, 380, 20);
        panel.lineStyle(2, 0x4466ff, 0.8);
        panel.strokeRoundedRect(GAME_WIDTH / 2 - 160, GAME_HEIGHT / 2 - 200, 320, 380, 20);
        // Game Over title
        const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 160, 'GAME OVER', {
            fontFamily: 'Arial Black, Arial',
            fontSize: '34px',
            color: '#ff3344',
            stroke: '#000',
            strokeThickness: 6,
        }).setOrigin(0.5).setAlpha(0);
        // Sad planet face drawn with graphics
        this.drawSadPlanet(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 85);
        // Score
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'PUNTUACIÓ', {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#6688cc',
            letterSpacing: 3,
        }).setOrigin(0.5).setAlpha(0.8);
        const scoreText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, '0', {
            fontFamily: 'Arial Black',
            fontSize: '48px',
            color: '#ffffff',
            stroke: '#2244cc',
            strokeThickness: 5,
        }).setOrigin(0.5).setAlpha(0);
        // High score
        const bestLabel = isNew ? '🏆 NOU RÈCORD!' : 'RÈCORD';
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 68, bestLabel, {
            fontFamily: 'Arial',
            fontSize: isNew ? '14px' : '11px',
            color: isNew ? '#FFD700' : '#6688cc',
            letterSpacing: 2,
        }).setOrigin(0.5);
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 92, String(best), {
            fontFamily: 'Arial Black',
            fontSize: '22px',
            color: isNew ? '#FFD700' : '#aabbdd',
            stroke: '#000',
            strokeThickness: 3,
        }).setOrigin(0.5);
        // Restart button
        const btnY = GAME_HEIGHT / 2 + 148;
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x2244cc, 1);
        btnBg.fillRoundedRect(GAME_WIDTH / 2 - 100, btnY - 24, 200, 48, 12);
        btnBg.lineStyle(2, 0x88aaff, 0.8);
        btnBg.strokeRoundedRect(GAME_WIDTH / 2 - 100, btnY - 24, 200, 48, 12);
        const btnText = this.add.text(GAME_WIDTH / 2, btnY, '🚀 TORNAR A JUGAR', {
            fontFamily: 'Arial Black',
            fontSize: '14px',
            color: '#ffffff',
        }).setOrigin(0.5);
        const btnZone = this.add.zone(GAME_WIDTH / 2, btnY, 200, 48)
            .setInteractive({ cursor: 'pointer' });
        btnZone.on('pointerover', () => {
            btnBg.clear();
            btnBg.fillStyle(0x3366ff, 1);
            btnBg.fillRoundedRect(GAME_WIDTH / 2 - 100, btnY - 24, 200, 48, 12);
            btnBg.lineStyle(2, 0xaaccff, 1);
            btnBg.strokeRoundedRect(GAME_WIDTH / 2 - 100, btnY - 24, 200, 48, 12);
            btnText.setScale(1.05);
        });
        btnZone.on('pointerout', () => {
            btnBg.clear();
            btnBg.fillStyle(0x2244cc, 1);
            btnBg.fillRoundedRect(GAME_WIDTH / 2 - 100, btnY - 24, 200, 48, 12);
            btnBg.lineStyle(2, 0x88aaff, 0.8);
            btnBg.strokeRoundedRect(GAME_WIDTH / 2 - 100, btnY - 24, 200, 48, 12);
            btnText.setScale(1);
        });
        btnZone.on('pointerdown', () => {
            this.cameras.main.fade(300, 0, 0, 10);
            this.time.delayedCall(300, () => {
                this.scene.start('GameScene');
            });
        });
        // Entrance animations
        this.tweens.add({ targets: title, alpha: 1, y: GAME_HEIGHT / 2 - 155, duration: 500, ease: 'Back.easeOut' });
        this.tweens.add({
            targets: scoreText,
            alpha: 1,
            duration: 300,
            delay: 300,
            onComplete: () => {
                // Count up score
                this.tweens.addCounter({
                    from: 0,
                    to: score,
                    duration: Math.min(1500, score * 2),
                    ease: 'Power2',
                    onUpdate: (tween) => {
                        scoreText.setText(String(Math.floor(tween.getValue() ?? 0)));
                    },
                });
            },
        });
        if (isNew) {
            this.time.delayedCall(1000, () => this.spawnConfetti());
        }
    }
    drawSadPlanet(cx, cy) {
        const r = 36;
        const g = this.add.graphics();
        // Body
        g.fillStyle(0x3050C8, 1);
        g.fillCircle(cx + r * 0.12, cy + r * 0.15, r * 0.94);
        g.fillStyle(0x4466DD, 1);
        g.fillCircle(cx, cy, r);
        g.fillStyle(0x7090FF, 0.45);
        g.fillCircle(cx - r * 0.22, cy - r * 0.2, r * 0.58);
        g.fillStyle(0xffffff, 0.55);
        g.fillCircle(cx - r * 0.3, cy - r * 0.28, r * 0.18);
        // Eyes (X eyes)
        const eyeR = r * 0.13;
        const eyeLX = cx - r * 0.28;
        const eyeRX = cx + r * 0.28;
        const eyeY = cy - r * 0.1;
        g.lineStyle(Math.max(2, r * 0.08), 0x18182a, 1);
        // Left X
        g.lineBetween(eyeLX - eyeR, eyeY - eyeR, eyeLX + eyeR, eyeY + eyeR);
        g.lineBetween(eyeLX + eyeR, eyeY - eyeR, eyeLX - eyeR, eyeY + eyeR);
        // Right X
        g.lineBetween(eyeRX - eyeR, eyeY - eyeR, eyeRX + eyeR, eyeY + eyeR);
        g.lineBetween(eyeRX + eyeR, eyeY - eyeR, eyeRX - eyeR, eyeY + eyeR);
        // Sad mouth
        const mouthY = cy + r * 0.33;
        const smileR = r * 0.22;
        g.lineStyle(Math.max(2, r * 0.075), 0x332233, 1);
        g.beginPath();
        g.arc(cx, mouthY + smileR * 0.55, smileR, Math.PI + 0.2, Math.PI * 2 - 0.2, false);
        g.strokePath();
        // Tear drop
        g.fillStyle(0x88ccff, 0.9);
        g.fillCircle(eyeLX - eyeR, eyeY + eyeR + r * 0.12, r * 0.07);
        g.fillTriangle(eyeLX - eyeR, eyeY + eyeR, eyeLX - eyeR - r * 0.06, eyeY + eyeR + r * 0.14, eyeLX - eyeR + r * 0.06, eyeY + eyeR + r * 0.14);
    }
    spawnConfetti() {
        const colors = [0xFFD700, 0xFF6699, 0x66FFAA, 0x66AAFF, 0xFF8844];
        for (let i = 0; i < 40; i++) {
            const x = Math.random() * GAME_WIDTH;
            const p = this.add.graphics();
            p.fillStyle(colors[Math.floor(Math.random() * colors.length)], 1);
            p.fillRect(-4, -4, 8, 8);
            p.setPosition(x, -10);
            p.setDepth(90);
            this.tweens.add({
                targets: p,
                y: GAME_HEIGHT + 20,
                x: x + (Math.random() - 0.5) * 150,
                angle: Math.random() * 720 - 360,
                duration: 1500 + Math.random() * 1000,
                delay: Math.random() * 800,
                ease: 'Power1',
                onComplete: () => p.destroy(),
            });
        }
    }
}
