import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { generatePlanetTextures, generateSupernovaTexture } from '../objects/PlanetGenerator';
export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }
    create() {
        generatePlanetTextures(this);
        generateSupernovaTexture(this);
        const bg = this.add.graphics();
        bg.fillStyle(0x00000a);
        bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        for (let i = 0; i < 80; i++) {
            const x = Math.random() * GAME_WIDTH;
            const y = Math.random() * GAME_HEIGHT;
            const r = Math.random() * 1.5 + 0.3;
            bg.fillStyle(0xffffff, Math.random() * 0.7 + 0.3);
            bg.fillCircle(x, y, r);
        }
        const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'PLANETILLA', {
            fontFamily: 'Arial Black, Arial',
            fontSize: '36px',
            color: '#ffffff',
            stroke: '#4466ff',
            strokeThickness: 5,
        }).setOrigin(0.5).setAlpha(0);
        const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, 'carregant...', {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#6688cc',
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({
            targets: [title, sub],
            alpha: 1,
            duration: 400,
            onComplete: () => {
                this.tweens.add({
                    targets: sub,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                        sub.setText('preparat!').setAlpha(1);
                        this.tweens.add({
                            targets: [title, sub],
                            alpha: 0,
                            delay: 300,
                            duration: 300,
                            onComplete: () => this.scene.start('GameScene'),
                        });
                    },
                });
            },
        });
    }
}
