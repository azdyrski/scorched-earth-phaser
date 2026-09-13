import { sfx } from '../utils/audio.js';

export class Start extends Phaser.Scene {
    constructor() {
        super('Start');
    }

    create() {
        const { width, height } = this.scale;

        // Dark retro gradient background
        const bgGraphics = this.add.graphics();
        bgGraphics.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a0933, 0x2d0b4e, 1);
        bgGraphics.fillRect(0, 0, width, height);

        // Starfield background
        for (let i = 0; i < 90; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height * 0.75);
            const size = Phaser.Math.Between(1, 3);
            const alpha = Phaser.Math.FloatBetween(0.3, 1.0);
            this.add.rectangle(x, y, size, size, 0xffffff, alpha);
        }

        // Mountain silhouette at bottom of start screen
        const mountainGfx = this.add.graphics();
        mountainGfx.fillStyle(0x0f2b1d, 1);
        mountainGfx.beginPath();
        mountainGfx.moveTo(0, height);
        mountainGfx.lineTo(0, height - 120);
        mountainGfx.lineTo(width * 0.25, height - 220);
        mountainGfx.lineTo(width * 0.5, height - 140);
        mountainGfx.lineTo(width * 0.75, height - 260);
        mountainGfx.lineTo(width, height - 160);
        mountainGfx.lineTo(width, height);
        mountainGfx.closePath();
        mountainGfx.fillPath();

        // Title text
        this.add.text(width / 2, 130, 'SCORCHED EARTH', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '64px',
            fontStyle: 'bold',
            color: '#ffdd00',
            stroke: '#ff3300',
            strokeThickness: 8,
            shadow: { offsetX: 4, offsetY: 4, color: '#000000', blur: 8, fill: true }
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(width / 2, 195, 'TACTICAL ARTILLERY WARFARE', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#00ffff',
            letterSpacing: 4
        }).setOrigin(0.5);

        // Mode Selection Buttons
        this.createButton(width / 2, 280, '1 PLAYER (VS CPU)', 0x3b82f6, () => {
            sfx.playClick();
            this.scene.start('GameScene', { mode: '1p' });
        });

        this.createButton(width / 2, 360, '2 PLAYERS (PASS & PLAY)', 0x10b981, () => {
            sfx.playClick();
            this.scene.start('GameScene', { mode: '2p' });
        });

        // Instructions Card
        const cardBg = this.add.graphics();
        cardBg.fillStyle(0x000000, 0.65);
        cardBg.fillRoundedRect(width / 2 - 320, 430, 640, 240, 16);
        cardBg.lineStyle(2, 0x3b82f6, 0.8);
        cardBg.strokeRoundedRect(width / 2 - 320, 430, 640, 240, 16);

        this.add.text(width / 2, 450, 'HOW TO PLAY', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ffdd00'
        }).setOrigin(0.5);

        const instructions = [
            '🎯 Set your Shot Angle using the slider or UP / DOWN arrow keys.',
            '⚡ Set Fire Power by dragging the Power Bar or using LEFT / RIGHT keys.',
            '💥 Click FIRE or press SPACEBAR to launch your artillery missile.',
            '🤖 1 Player Mode: The CPU gets increasingly accurate with each shot!',
            '👥 2 Player Mode: Pass the device between turns to face a friend!'
        ];

        instructions.forEach((text, i) => {
            this.add.text(width / 2 - 290, 490 + i * 32, text, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '15px',
                color: '#e2e8f0'
            });
        });
    }

    createButton(x, y, label, colorHex, callback) {
        const btnWidth = 340;
        const btnHeight = 56;

        const container = this.add.container(x, y);

        const bg = this.add.graphics();
        bg.fillStyle(colorHex, 1);
        bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 12);
        bg.lineStyle(3, 0xffffff, 0.8);
        bg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 12);

        const text = this.add.text(0, 0, label, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        container.add([bg, text]);

        container.setSize(btnWidth, btnHeight);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerover', () => {
            this.tweens.add({
                targets: container,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100
            });
        });

        container.on('pointerout', () => {
            this.tweens.add({
                targets: container,
                scaleX: 1.0,
                scaleY: 1.0,
                duration: 100
            });
        });

        container.on('pointerdown', callback);
    }
}
