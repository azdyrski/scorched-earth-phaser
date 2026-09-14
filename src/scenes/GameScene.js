import { sfx } from '../utils/audio.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        this.gameMode = data.mode || '1p'; // '1p' or '2p'
        this.currentPlayer = 1; // 1 or 2
        this.turnCount = 0;
        this.cpuShotCount = 0;
        this.isFiring = false;
        this.isGameOver = false;

        // Player states
        this.playerStates = {
            1: { angle: 45, power: 550 },
            2: { angle: 135, power: 550 }
        };

        this.gravity = 350;
        this.terrainHeights = new Float32Array(1280);
    }

    create() {
        const { width, height } = this.scale;

        // 1. Sky & Environment Background
        this.createSkyAndStars();

        // 2. Procedural Terrain Generation
        this.createTerrain();

        // 3. Create Tanks
        this.createTanks();

        // 4. Particle Emitter for Explosions & Missile Trails
        this.createParticleEffects();

        // 5. Build HUD UI (Angle readout, Power Bar, Fire Button, Turn Banner)
        this.createHUD();

        // 6. Keyboard Controls Setup
        this.createKeyboardControls();

        // 7. Click & drag on the play field to aim
        this.createAimingControls();

        // 8. Graphics layer for trajectory preview
        this.trajectoryGfx = this.add.graphics();

        // Initial setup for Player 1 turn
        this.startTurn();
    }

    createSkyAndStars() {
        const { width, height } = this.scale;

        // Gradient background
        const skyGfx = this.add.graphics();
        skyGfx.fillGradientStyle(0x0a0c27, 0x0a0c27, 0x1f1a42, 0x3b1c59, 1);
        skyGfx.fillRect(0, 0, width, height);

        // Stars
        for (let i = 0; i < 100; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height * 0.6);
            const size = Phaser.Math.Between(1, 2);
            const alpha = Phaser.Math.FloatBetween(0.3, 0.9);
            this.add.rectangle(x, y, size, size, 0xffffff, alpha);
        }

        // Distant mountains silhouette
        const mountainGfx = this.add.graphics();
        mountainGfx.fillStyle(0x131838, 0.8);
        mountainGfx.beginPath();
        mountainGfx.moveTo(0, height);
        mountainGfx.lineTo(0, height * 0.55);
        mountainGfx.lineTo(200, height * 0.45);
        mountainGfx.lineTo(450, height * 0.58);
        mountainGfx.lineTo(750, height * 0.40);
        mountainGfx.lineTo(1050, height * 0.52);
        mountainGfx.lineTo(width, height * 0.42);
        mountainGfx.lineTo(width, height);
        mountainGfx.closePath();
        mountainGfx.fillPath();
    }

    createTerrain() {
        const { width, height } = this.scale;
        const baseLine = height * 0.62;

        const f1 = 0.002 + Math.random() * 0.002;
        const f2 = 0.006 + Math.random() * 0.003;
        const f3 = 0.015 + Math.random() * 0.004;

        const a1 = 110 + Math.random() * 40;
        const a2 = 35 + Math.random() * 20;
        const a3 = 15 + Math.random() * 10;

        const phase1 = Math.random() * Math.PI * 2;
        const phase2 = Math.random() * Math.PI * 2;

        for (let x = 0; x < width; x++) {
            let y = baseLine
                + Math.sin(x * f1 + phase1) * a1
                + Math.sin(x * f2 + phase2) * a2
                + Math.cos(x * f3) * a3;
            this.terrainHeights[x] = Math.max(180, Math.min(height - 110, y));
        }

        this.terrainGfx = this.add.graphics();
        this.drawTerrain();
    }

    drawTerrain() {
        const { width, height } = this.scale;
        this.terrainGfx.clear();

        // Fill earth polygon
        this.terrainGfx.fillStyle(0x1d3d24, 1);
        this.terrainGfx.beginPath();
        this.terrainGfx.moveTo(0, height);
        this.terrainGfx.lineTo(0, this.terrainHeights[0]);

        for (let x = 1; x < width; x++) {
            this.terrainGfx.lineTo(x, this.terrainHeights[x]);
        }

        this.terrainGfx.lineTo(width, height);
        this.terrainGfx.closePath();
        this.terrainGfx.fillPath();

        // Top grass/surface line
        this.terrainGfx.lineStyle(4, 0x34d399, 1);
        this.terrainGfx.beginPath();
        this.terrainGfx.moveTo(0, this.terrainHeights[0]);

        for (let x = 1; x < width; x++) {
            this.terrainGfx.lineTo(x, this.terrainHeights[x]);
        }
        this.terrainGfx.strokePath();
    }

    carveCrater(ex, ey, radius) {
        const minX = Math.max(0, Math.floor(ex - radius));
        const maxX = Math.min(1280 - 1, Math.ceil(ex + radius));

        for (let x = minX; x <= maxX; x++) {
            const dx = x - ex;
            const dySquare = radius * radius - dx * dx;
            if (dySquare >= 0) {
                const distY = Math.sqrt(dySquare);
                const craterBottomY = ey + distY;
                if (craterBottomY > this.terrainHeights[x]) {
                    this.terrainHeights[x] = Math.min(720 - 110, craterBottomY);
                }
            }
        }
        this.drawTerrain();
        this.updateTankPositions();
    }

    createTanks() {
        this.p1X = 180;
        this.p2X = 1100;

        // Player 1 Tank (Blue)
        this.p1Container = this.add.container(this.p1X, this.terrainHeights[this.p1X]);
        this.p1Chassis = this.drawTankGraphic(0x00d2ff, 0x0088cc);
        this.p1Barrel = this.add.rectangle(0, -10, 24, 6, 0xffffff).setOrigin(0, 0.5);
        this.p1Label = this.add.text(0, -32, 'P1', {
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#00d2ff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.p1Container.add([this.p1Barrel, this.p1Chassis, this.p1Label]);

        // Player 2 Tank (Red/Orange)
        const p2Name = this.gameMode === '1p' ? 'CPU' : 'P2';
        this.p2Container = this.add.container(this.p2X, this.terrainHeights[this.p2X]);
        this.p2Chassis = this.drawTankGraphic(0xff4500, 0xb33000);
        this.p2Barrel = this.add.rectangle(0, -10, 24, 6, 0xffffff).setOrigin(0, 0.5);
        this.p2Label = this.add.text(0, -32, p2Name, {
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ff4500',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.p2Container.add([this.p2Barrel, this.p2Chassis, this.p2Label]);

        this.updateTankPositions();
    }

    drawTankGraphic(primaryColor, darkColor) {
        const gfx = this.add.graphics();

        // Treads
        gfx.fillStyle(0x333333, 1);
        gfx.fillRoundedRect(-18, -6, 36, 10, 4);
        gfx.lineStyle(1, 0x666666, 1);
        gfx.strokeRoundedRect(-18, -6, 36, 10, 4);

        // Body Chassis
        gfx.fillStyle(primaryColor, 1);
        gfx.fillRoundedRect(-14, -16, 28, 12, 4);
        gfx.lineStyle(2, darkColor, 1);
        gfx.strokeRoundedRect(-14, -16, 28, 12, 4);

        // Turret Dome
        gfx.fillStyle(darkColor, 1);
        gfx.fillCircle(0, -12, 8);

        return gfx;
    }

    updateTankPositions() {
        this.p1Container.y = this.terrainHeights[Math.floor(this.p1X)];
        this.p2Container.y = this.terrainHeights[Math.floor(this.p2X)];

        // Tilt tank according to slope
        const slope1 = (this.terrainHeights[this.p1X + 10] - this.terrainHeights[this.p1X - 10]) / 20;
        this.p1Container.rotation = Math.atan(slope1);

        const slope2 = (this.terrainHeights[this.p2X + 10] - this.terrainHeights[this.p2X - 10]) / 20;
        this.p2Container.rotation = Math.atan(slope2);

        this.updateBarrels();
    }

    updateBarrels() {
        const p1Angle = this.playerStates[1].angle;
        this.p1Barrel.rotation = -Phaser.Math.DegToRad(p1Angle);

        const p2Angle = this.playerStates[2].angle;
        this.p2Barrel.rotation = -Phaser.Math.DegToRad(p2Angle);
    }

    createParticleEffects() {
        // Simple trail/explosion graphics generator
        const particleGfx = this.make.graphics({ x: 0, y: 0, add: false });
        particleGfx.fillStyle(0xffffff);
        particleGfx.fillCircle(4, 4, 4);
        particleGfx.generateTexture('smokeParticle', 8, 8);
    }

    createHUD() {
        const { width, height } = this.scale;

        // Bottom HUD Panel
        const hudBg = this.add.graphics();
        hudBg.fillStyle(0x0f172a, 0.9);
        hudBg.fillRect(0, height - 100, width, 100);
        hudBg.lineStyle(2, 0x3b82f6, 1);
        hudBg.lineBetween(0, height - 100, width, height - 100);

        // Turn Header Banner
        this.turnBanner = this.add.text(width / 2, 35, "PLAYER 1'S TURN", {
            fontFamily: 'Arial, sans-serif',
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#00d2ff',
            stroke: '#000000',
            strokeThickness: 5,
            shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 4, fill: true }
        }).setOrigin(0.5);

        // Back to Menu Button
        const menuBtn = this.add.text(40, 35, '⚙ MENU', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#94a3b8',
            backgroundColor: '#1e293b',
            padding: { x: 12, y: 8 }
        }).setInteractive({ useHandCursor: true });

        menuBtn.on('pointerdown', () => {
            sfx.playClick();
            this.scene.start('Start');
        });

        // --- CONTROLS IN HUD ---

        // 1. Angle Readout (angle is now set by clicking & dragging on the play field)
        this.add.text(120, height - 85, 'ANGLE:', {
            fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#94a3b8'
        });

        this.angleValText = this.add.text(190, height - 85, '45°', {
            fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#38bdf8'
        });

        // 2. Power Readout (power is set via the vertical bar next to the active tank)
        this.add.text(120, height - 55, 'POWER:', {
            fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#94a3b8'
        });

        this.powerValText2 = this.add.text(190, height - 55, '550', {
            fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#facc15'
        });

        // 3. Vertical Power Bar next to the active player's turret
        this.createPowerBar();

        // 4. FIRE BUTTON
        const fireBtnX = 780;
        const fireBtnY = height - 50;

        this.fireBtn = this.add.container(fireBtnX, fireBtnY);

        const fireBg = this.add.graphics();
        fireBg.fillStyle(0xef4444, 1);
        fireBg.fillRoundedRect(-60, -26, 120, 52, 12);
        fireBg.lineStyle(3, 0xffffff, 0.9);
        fireBg.strokeRoundedRect(-60, -26, 120, 52, 12);

        const fireText = this.add.text(0, 0, '🔥 FIRE', {
            fontFamily: 'Arial, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);

        this.fireBtn.add([fireBg, fireText]);
        this.fireBtn.setSize(120, 52);
        this.fireBtn.setInteractive({ useHandCursor: true });

        this.fireBtn.on('pointerdown', () => {
            if (!this.isFiring && !(this.gameMode === '1p' && this.currentPlayer === 2)) {
                this.fireMissile();
            }
        });

        // Quick Controls Helper Label
        this.add.text(870, height - 55, 'Drag on the battlefield to aim | Drag the bar at your tank = Power | SPACE = Fire', {
            fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#64748b', wordWrap: { width: 380 }
        });
    }

    createPowerBar() {
        this.powerBarHeight = 130;

        this.powerBarTrackGfx = this.add.graphics();
        this.powerFillGfx = this.add.graphics();

        this.powerHandle = this.add.container(0, 0);
        const pHandleGfx = this.add.graphics();
        pHandleGfx.fillStyle(0xfacc15, 1);
        pHandleGfx.fillRoundedRect(-16, -8, 32, 16, 4);
        pHandleGfx.lineStyle(2, 0xffffff, 1);
        pHandleGfx.strokeRoundedRect(-16, -8, 32, 16, 4);
        this.powerHandle.add(pHandleGfx);
        this.powerHandle.setSize(32, 16);
        this.powerHandle.setInteractive({ useHandCursor: true, draggable: true });

        this.input.setDraggable(this.powerHandle);

        this.powerHandle.on('drag', (pointer, dragX, dragY) => {
            if (this.isFiring || (this.gameMode === '1p' && this.currentPlayer === 2)) return;
            const clampedY = Phaser.Math.Clamp(dragY, this.powerBarTop, this.powerBarTop + this.powerBarHeight);
            this.powerHandle.y = clampedY;
            const norm = 1 - (clampedY - this.powerBarTop) / this.powerBarHeight;
            const power = Math.round(100 + norm * 900);
            this.playerStates[this.currentPlayer].power = power;
            this.updateHUDValues();
        });
    }

    createAimingControls() {
        this.isAiming = false;

        this.input.on('pointerdown', (pointer) => {
            if (this.isFiring || this.isGameOver) return;
            if (this.gameMode === '1p' && this.currentPlayer === 2) return;
            if (pointer.y >= this.scale.height - 100) return; // ignore clicks in the HUD panel
            if (this.input.hitTestPointer(pointer).length > 0) return; // let the power handle/buttons handle their own input

            this.isAiming = true;
            this.updateAimAngle(pointer);
        });

        this.input.on('pointermove', (pointer) => {
            if (!this.isAiming) return;
            if (!pointer.isDown) {
                this.isAiming = false;
                return;
            }
            this.updateAimAngle(pointer);
        });

        this.input.on('pointerup', () => {
            this.isAiming = false;
        });
    }

    updateAimAngle(pointer) {
        if (this.isFiring || this.isGameOver) return;
        if (this.gameMode === '1p' && this.currentPlayer === 2) return;

        const isP1 = this.currentPlayer === 1;
        const tankX = isP1 ? this.p1X : this.p2X;
        const tankY = isP1 ? this.p1Container.y - 12 : this.p2Container.y - 12;

        const dx = pointer.x - tankX;
        const dy = pointer.y - tankY;
        const angle = Math.round(Phaser.Math.Clamp(Phaser.Math.RadToDeg(-Math.atan2(dy, dx)), 0, 180));

        this.playerStates[this.currentPlayer].angle = angle;
        this.updateHUDValues();
    }

    createKeyboardControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    updatePowerBarPosition() {
        const isP1 = this.currentPlayer === 1;
        const tankX = isP1 ? this.p1X : this.p2X;
        const tankY = isP1 ? this.p1Container.y : this.p2Container.y;
        const offsetX = isP1 ? 50 : -50;

        this.powerBarX = tankX + offsetX;
        this.powerBarBottom = Math.max(tankY - 20, 220);
        this.powerBarTop = this.powerBarBottom - this.powerBarHeight;

        const barColor = isP1 ? 0x00d2ff : 0xff4500;
        this.powerBarTrackGfx.clear();
        this.powerBarTrackGfx.fillStyle(0x0f172a, 0.75);
        this.powerBarTrackGfx.fillRoundedRect(this.powerBarX - 11, this.powerBarTop - 4, 22, this.powerBarHeight + 8, 8);
        this.powerBarTrackGfx.fillStyle(0x334155, 1);
        this.powerBarTrackGfx.fillRoundedRect(this.powerBarX - 8, this.powerBarTop, 16, this.powerBarHeight, 6);
        this.powerBarTrackGfx.lineStyle(2, barColor, 0.9);
        this.powerBarTrackGfx.strokeRoundedRect(this.powerBarX - 8, this.powerBarTop, 16, this.powerBarHeight, 6);
    }

    updateHUDValues() {
        const state = this.playerStates[this.currentPlayer];
        this.angleValText.setText(`${state.angle}°`);
        this.powerValText2.setText(`${state.power}`);

        this.updatePowerBarPosition();

        const powerNorm = (state.power - 100) / 900;

        this.powerHandle.x = this.powerBarX;
        this.powerHandle.y = this.powerBarBottom - powerNorm * this.powerBarHeight;

        this.powerFillGfx.clear();
        this.powerFillGfx.fillGradientStyle(0xef4444, 0xef4444, 0xfacc15, 0x38bdf8, 1);
        const fillHeight = Math.max(8, powerNorm * this.powerBarHeight);
        this.powerFillGfx.fillRoundedRect(this.powerBarX - 8, this.powerBarBottom - fillHeight, 16, fillHeight, 6);

        this.updateBarrels();
        this.drawTrajectoryPreview();
    }

    drawTrajectoryPreview() {
        this.trajectoryGfx.clear();
        if (this.isFiring || this.isGameOver) return;
        if (this.gameMode === '1p' && this.currentPlayer === 2) return;

        const isP1 = this.currentPlayer === 1;
        const tankX = isP1 ? this.p1X : this.p2X;
        const tankY = isP1 ? this.p1Container.y - 12 : this.p2Container.y - 12;

        const state = this.playerStates[this.currentPlayer];
        const angleRad = Phaser.Math.DegToRad(state.angle);
        const barrelLen = 24;

        const startX = tankX + Math.cos(-angleRad) * barrelLen;
        const startY = tankY + Math.sin(-angleRad) * barrelLen;

        const vx = Math.cos(-angleRad) * (state.power * 0.95);
        const vy = Math.sin(-angleRad) * (state.power * 0.95);

        const dt = 0.04;
        let x = startX;
        let y = startY;
        let curVy = vy;

        const color = isP1 ? 0x00d2ff : 0xff4500;
        this.trajectoryGfx.fillStyle(color, 0.6);

        for (let i = 0; i < 45; i++) {
            x += vx * dt;
            y += curVy * dt;
            curVy += this.gravity * dt;

            if (x < 0 || x >= 1280 || y > 720) break;

            const groundY = this.terrainHeights[Math.floor(x)];
            if (y >= groundY) {
                this.trajectoryGfx.fillStyle(0xffff00, 0.9);
                this.trajectoryGfx.fillCircle(x, groundY, 5);
                break;
            }

            if (i % 2 === 0) {
                this.trajectoryGfx.fillCircle(x, y, 2.5);
            }
        }
    }

    startTurn() {
        if (this.isGameOver) return;

        this.isFiring = false;
        this.turnCount++;

        const isP1 = this.currentPlayer === 1;
        const playerColor = isP1 ? '#00d2ff' : '#ff4500';

        if (this.gameMode === '1p' && !isP1) {
            this.turnBanner.setText("CPU'S TURN").setColor(playerColor);
            this.runCpuTurn();
        } else {
            const pName = isP1 ? "PLAYER 1'S TURN" : "PLAYER 2'S TURN";
            this.turnBanner.setText(pName).setColor(playerColor);
        }

        this.updateHUDValues();
    }

    runCpuTurn() {
        // CPU Aiming & Shot Calculation Logic
        // The CPU starts with an initial estimation error and gets increasingly closer each shot!
        this.cpuShotCount++;

        const cpuX = this.p2X;
        const cpuY = this.p2Container.y - 12;
        const targetX = this.p1X;
        const targetY = this.p1Container.y - 12;

        const dx = targetX - cpuX; // Negative (pointing left)
        const dy = targetY - cpuY;

        // Choose ideal fixed angle pointing leftwards (e.g. 135 degrees = 45 degrees relative to left horizon)
        const idealAngle = 135;
        const angleRad = Phaser.Math.DegToRad(idealAngle);

        // Physics formula for power needed to reach target at angleRad
        const cosA = Math.cos(-angleRad);
        const sinA = Math.sin(-angleRad);
        const g = this.gravity;

        // dy = dx * (sinA / cosA) + (g * dx^2) / (2 * v^2 * cosA^2)
        const term1 = dy - dx * (sinA / cosA);
        let idealPower = 550;

        if (term1 > 0) {
            const vSquare = (g * dx * dx) / (2 * term1 * cosA * cosA);
            idealPower = Math.sqrt(vSquare) / 0.95;
        }

        // Bounded error multiplier that decreases exponentially each CPU shot
        // Shot 1: Error factor ~ 1.0 (can overshoot or undershoot by up to 200 power)
        // Shot 2: Error factor ~ 0.5 (much closer)
        // Shot 3: Error factor ~ 0.15 (very close)
        // Shot 4+: Error factor ~ 0.0 (direct hit precision)
        const errorFactor = Math.pow(0.4, this.cpuShotCount - 1);

        // Direction bias: if previous shot landed short (to the right of player 1), increase power
        let bias = 0;
        if (this.cpuLastImpactX !== undefined) {
            const lastMissX = this.cpuLastImpactX - targetX;
            bias = lastMissX * 0.6; // adjust based on miss offset
        }

        const randomSpread = (Math.random() - 0.5) * 200 * errorFactor;
        let chosenPower = Math.round(idealPower + bias + randomSpread);
        chosenPower = Phaser.Math.Clamp(chosenPower, 150, 950);

        let chosenAngle = Math.round(idealAngle + (Math.random() - 0.5) * 12 * errorFactor);
        chosenAngle = Phaser.Math.Clamp(chosenAngle, 95, 175);

        const prevAngle = this.playerStates[2].angle;
        const prevPower = this.playerStates[2].power;
        this.playerStates[2].angle = chosenAngle;
        this.playerStates[2].power = chosenPower;

        // Visually animate the CPU adjusting its aim/power before firing
        const proxy = { angle: prevAngle, power: prevPower };
        this.tweens.add({
            targets: proxy,
            angle: chosenAngle,
            power: chosenPower,
            duration: 800,
            ease: 'Power2',
            onUpdate: () => {
                this.playerStates[2].angle = Math.round(proxy.angle);
                this.playerStates[2].power = Math.round(proxy.power);
                this.updateHUDValues();
            },
            onComplete: () => {
                this.playerStates[2].angle = chosenAngle;
                this.playerStates[2].power = chosenPower;
                this.updateHUDValues();
                this.time.delayedCall(400, () => {
                    this.fireMissile();
                });
            }
        });
    }

    fireMissile() {
        if (this.isFiring || this.isGameOver) return;
        this.isFiring = true;
        this.trajectoryGfx.clear();

        const isP1 = this.currentPlayer === 1;
        const tankX = isP1 ? this.p1X : this.p2X;
        const tankY = isP1 ? this.p1Container.y - 12 : this.p2Container.y - 12;

        const state = this.playerStates[this.currentPlayer];
        const angleRad = Phaser.Math.DegToRad(state.angle);
        const barrelLen = 24;

        const startX = tankX + Math.cos(-angleRad) * barrelLen;
        const startY = tankY + Math.sin(-angleRad) * barrelLen;

        const speed = state.power * 0.95;
        let vx = Math.cos(-angleRad) * speed;
        let vy = Math.sin(-angleRad) * speed;

        // Create Missile Visual
        const missile = this.add.container(startX, startY);
        const mGfx = this.add.graphics();
        mGfx.fillStyle(0xfff000, 1);
        mGfx.fillCircle(0, 0, 4);
        mGfx.fillStyle(0xff4500, 1);
        mGfx.fillCircle(0, 0, 2);
        missile.add(mGfx);

        sfx.playLaunch();

        // Missile Movement loop
        const dt = 0.016; // 16ms
        const flightTimer = this.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                missile.x += vx * dt;
                missile.y += vy * dt;
                vy += this.gravity * dt;

                // Smoke trail
                if (Math.random() < 0.6) {
                    const smoke = this.add.rectangle(missile.x, missile.y, 3, 3, 0x94a3b8, 0.7);
                    this.tweens.add({
                        targets: smoke,
                        alpha: 0,
                        scaleX: 2,
                        scaleY: 2,
                        duration: 300,
                        onComplete: () => smoke.destroy()
                    });
                }

                // Check Out of Bounds
                if (missile.x < -50 || missile.x > 1330 || missile.y > 750) {
                    flightTimer.remove();
                    missile.destroy();
                    this.onShotImpact(missile.x, missile.y, false);
                    return;
                }

                // Check Ground Collision
                if (missile.x >= 0 && missile.x < 1280) {
                    const groundY = this.terrainHeights[Math.floor(missile.x)];
                    if (missile.y >= groundY) {
                        flightTimer.remove();
                        const impactX = missile.x;
                        const impactY = groundY;
                        missile.destroy();
                        this.onShotImpact(impactX, impactY, true);
                        return;
                    }
                }
            }
        });
    }

    onShotImpact(x, y, hitGround) {
        if (hitGround) {
            sfx.playExplosion();

            // Create Explosion Visual Effect
            const explosionRadius = 32;

            const expCircle = this.add.circle(x, y, 5, 0xffeb3b, 1);
            this.tweens.add({
                targets: expCircle,
                radius: explosionRadius,
                alpha: 0,
                duration: 450,
                ease: 'Quad.out',
                onComplete: () => expCircle.destroy()
            });

            // Debris/Spark particles
            for (let i = 0; i < 16; i++) {
                const angle = Math.random() * Math.PI * 2;
                const pSpeed = Phaser.Math.Between(60, 220);
                const spark = this.add.rectangle(x, y, 4, 4, 0xff9800);

                this.tweens.add({
                    targets: spark,
                    x: x + Math.cos(angle) * pSpeed * 0.4,
                    y: y + Math.sin(angle) * pSpeed * 0.4,
                    alpha: 0,
                    duration: Phaser.Math.Between(300, 600),
                    onComplete: () => spark.destroy()
                });
            }

            // Screen Shake
            this.cameras.main.shake(200, 0.01);

            // Carve terrain crater
            this.carveCrater(x, y, explosionRadius);

            // Store CPU impact position for learning algorithm
            if (this.currentPlayer === 2) {
                this.cpuLastImpactX = x;
            }

            // Check if explosion hits either tank
            const d1 = Phaser.Math.Distance.Between(x, y, this.p1X, this.p1Container.y);
            const d2 = Phaser.Math.Distance.Between(x, y, this.p2X, this.p2Container.y);

            const hitRadius = explosionRadius + 14;

            if (d1 <= hitRadius || d2 <= hitRadius) {
                let winner = null;
                if (d1 <= hitRadius && d2 <= hitRadius) {
                    // Both hit! Current player loses or tie
                    winner = this.currentPlayer === 1 ? (this.gameMode === '1p' ? 'CPU' : 'PLAYER 2') : 'PLAYER 1';
                } else if (d1 <= hitRadius) {
                    winner = this.gameMode === '1p' ? 'CPU' : 'PLAYER 2';
                } else if (d2 <= hitRadius) {
                    winner = 'PLAYER 1';
                }

                this.triggerVictory(winner);
                return;
            }
        }

        // Missed shot -> switch turns
        this.time.delayedCall(600, () => {
            this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
            this.startTurn();
        });
    }

    triggerVictory(winnerName) {
        this.isGameOver = true;
        sfx.playVictory();

        const { width, height } = this.scale;

        // Dark modal overlay
        const modalBg = this.add.graphics();
        modalBg.fillStyle(0x000000, 0.75);
        modalBg.fillRect(0, 0, width, height);

        // Victory Box
        const boxWidth = 500;
        const boxHeight = 260;
        const box = this.add.graphics();
        box.fillStyle(0x0f172a, 1);
        box.fillRoundedRect(width / 2 - boxWidth / 2, height / 2 - boxHeight / 2, boxWidth, boxHeight, 16);
        box.lineStyle(4, 0xfacc15, 1);
        box.strokeRoundedRect(width / 2 - boxWidth / 2, height / 2 - boxHeight / 2, boxWidth, boxHeight, 16);

        this.add.text(width / 2, height / 2 - 70, '🏆 VICTORY! 🏆', {
            fontFamily: 'Arial, sans-serif', fontSize: '36px', fontStyle: 'bold', color: '#facc15'
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 - 15, `${winnerName} WINS!`, {
            fontFamily: 'Arial, sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);

        // Play Again Button
        const playBtn = this.add.container(width / 2 - 110, height / 2 + 55);
        const pBtnBg = this.add.graphics();
        pBtnBg.fillStyle(0x10b981, 1);
        pBtnBg.fillRoundedRect(-90, -22, 180, 44, 10);
        const pBtnText = this.add.text(0, 0, 'PLAY AGAIN', {
            fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);
        playBtn.add([pBtnBg, pBtnText]);
        playBtn.setSize(180, 44);
        playBtn.setInteractive({ useHandCursor: true });

        playBtn.on('pointerdown', () => {
            sfx.playClick();
            this.scene.restart({ mode: this.gameMode });
        });

        // Main Menu Button
        const menuBtn = this.add.container(width / 2 + 110, height / 2 + 55);
        const mBtnBg = this.add.graphics();
        mBtnBg.fillStyle(0x3b82f6, 1);
        mBtnBg.fillRoundedRect(-90, -22, 180, 44, 10);
        const mBtnText = this.add.text(0, 0, 'MAIN MENU', {
            fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);
        menuBtn.add([mBtnBg, mBtnText]);
        menuBtn.setSize(180, 44);
        menuBtn.setInteractive({ useHandCursor: true });

        menuBtn.on('pointerdown', () => {
            sfx.playClick();
            this.scene.start('Start');
        });
    }

    update() {
        if (this.isGameOver || this.isFiring) return;
        if (this.gameMode === '1p' && this.currentPlayer === 2) return;

        let stateChanged = false;
        const state = this.playerStates[this.currentPlayer];

        // Arrow keys / WASD controls for angle and power
        if (this.cursors.left.isDown || this.keyA.isDown) {
            state.power = Phaser.Math.Clamp(state.power - 4, 100, 1000);
            stateChanged = true;
        } else if (this.cursors.right.isDown || this.keyD.isDown) {
            state.power = Phaser.Math.Clamp(state.power + 4, 100, 1000);
            stateChanged = true;
        }

        if (this.cursors.up.isDown || this.keyW.isDown) {
            state.angle = Phaser.Math.Clamp(state.angle + 1, 0, 180);
            stateChanged = true;
        } else if (this.cursors.down.isDown || this.keyS.isDown) {
            state.angle = Phaser.Math.Clamp(state.angle - 1, 0, 180);
            stateChanged = true;
        }

        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.fireMissile();
            return;
        }

        if (stateChanged) {
            this.updateHUDValues();
        }
    }
}
