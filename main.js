import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY, PROGRESSION_PANEL_HEIGHT } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
// Capture any uncaught JS error and show it on screen so we can debug
window.onerror = (msg, src, line, _col, err) => {
    const div = document.createElement('div');
    div.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
        'background:#cc0000', 'color:#fff', 'padding:10px',
        'font:11px monospace', 'white-space:pre-wrap',
    ].join(';');
    const stack = err?.stack?.split('\n').slice(0, 4).join('\n') ?? '';
    div.textContent = `ERROR: ${err?.message ?? msg}\n${src}:${line}\n${stack}`;
    document.body.appendChild(div);
    return false;
};
const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT + PROGRESSION_PANEL_HEIGHT,
    backgroundColor: '#00000a',
    physics: {
        default: 'matter',
        matter: {
            gravity: { x: 0, y: GRAVITY * 0.001 },
            debug: false,
            // Reduced iterations — prevents CPU spike when many bodies pile up
            positionIterations: 6,
            velocityIterations: 4,
            constraintIterations: 2,
        },
    },
    scene: [BootScene, GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
        antialias: true,
        pixelArt: false,
    },
};
new Phaser.Game(config);
