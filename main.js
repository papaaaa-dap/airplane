// Konfigurasi Game Phaser (Dibuat Full Screen Otomatis)
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.RESIZE, // Ini kuncinya biar full screen tanpa hitam-hitam!
        width: '100%',
        height: '100%'
    },
    render: { pixelArt: true },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

function preload() {
    this.load.image('bg_texture', 'assets/bg.png');
    this.load.image('player_tex', 'assets/player.png');
    this.load.image('enemy_tex', 'assets/enemy.png');
    this.load.image('bullet_tex', 'assets/bullet.png');
    this.load.image('powerup_tex', 'assets/powerup.png'); 
    this.load.image('enemy_bullet_tex', 'assets/bullet.png');

    this.load.audio('shoot_sfx', 'assets/shoot.mp3');
    this.load.audio('explode_sfx', 'assets/explode.mp3');
    this.load.audio('powerup_sfx', 'assets/powerup.mp3');
    this.load.audio('start_sfx', 'assets/start.mp3');
}

function create() {
    let W = this.scale.width;
    let H = this.scale.height;

    this.score = 0;
    this.health = 3;
    this.playerSpeed = 300; 
    this.weaponLevel = 1;
    this.enemySpeedMultiplier = 1;
    this.spawnDelay = 1000; 
    this.isGameOver = false;
    this.isGameStarted = false; 
    this.lastFired = 0; 

    this.input.addPointer(1);

    // Background ngikutin ukuran layar penuh
    this.bg = this.add.tileSprite(W/2, H/2, W, H, 'bg_texture');
    
    this.bullets = this.physics.add.group();
    this.enemyBullets = this.physics.add.group(); 
    this.enemies = this.physics.add.group();
    this.powerups = this.physics.add.group();

    // Spawn player di tengah bawah layar
    this.player = this.physics.add.sprite(W/2, H - 100, 'player_tex');
    this.player.setCollideWorldBounds(true);
    this.player.setDisplaySize(48, 48); // Kunci ukuran biar gak raksasa
    this.player.setVisible(false);

    // UI
    this.scoreText = this.add.text(10, 10, 'Score: 0', { fontSize: '20px', fill: '#fff' }).setVisible(false);
    this.healthText = this.add.text(10, 35, 'Health: ❤️ 3', { fontSize: '20px', fill: '#ff4d4d' }).setVisible(false);
    this.levelText = this.add.text(W - 80, 10, 'Lv. 1', { fontSize: '20px', fill: '#fff' }).setVisible(false);

    // Overlay Start
    this.startOverlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.7);
    this.startText = this.add.text(W/2, H/2, 'TAP TO START', { 
        fontSize: '32px', fill: '#00ff00', fontStyle: 'bold' 
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.startText.on('pointerdown', () => {
        this.sound.play('start_sfx', { volume: 0.5 });

        this.isGameStarted = true;
        this.startOverlay.destroy();
        this.startText.destroy();
        this.player.setVisible(true);
        this.scoreText.setVisible(true);
        this.healthText.setVisible(true);
        this.levelText.setVisible(true);
        
        this.enemyTimer = this.time.addEvent({ delay: this.spawnDelay, callback: spawnEnemy, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 12000, callback: spawnPowerUp, callbackScope: this, loop: true });
    });

    this.cursors = this.input.keyboard.createCursorKeys();

    this.physics.add.overlap(this.bullets, this.enemies, hitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, hitPlayer, null, this);
    this.physics.add.overlap(this.player, this.enemyBullets, hitPlayerBullet, null, this);
    this.physics.add.overlap(this.player, this.powerups, collectPowerUp, null, this);

    // Update ukuran kalau layar di-rotate (opsional tapi bagus)
    this.scale.on('resize', (gameSize) => {
        let newW = gameSize.width;
        let newH = gameSize.height;
        this.bg.setSize(newW, newH);
        this.bg.setPosition(newW/2, newH/2);
        this.levelText.setX(newW - 80);
        this.physics.world.setBounds(0, 0, newW, newH);
    });
}

function update(time, delta) {
    if (!this.isGameStarted || this.isGameOver) return;

    this.bg.tilePositionY -= 2;

    this.player.setVelocity(0);
    let pointer = this.input.activePointer;
    
    if (pointer.isDown) {
        if (pointer.x < this.player.x - 10) this.player.setVelocityX(-this.playerSpeed);
        else if (pointer.x > this.player.x + 10) this.player.setVelocityX(this.playerSpeed);
    } 
    else {
        if (this.cursors.left.isDown) this.player.setVelocityX(-this.playerSpeed);
        else if (this.cursors.right.isDown) this.player.setVelocityX(this.playerSpeed);
    }

    if (time > this.lastFired) {
        shootBullet.call(this);
        this.lastFired = time + 200;
    }

    // Hapus objek yang keluar dari batas layar
    this.bullets.children.each(b => { if (b.active && b.y < 0) b.destroy(); });
    this.enemyBullets.children.each(eb => { if (eb.active && eb.y > this.scale.height) eb.destroy(); });
    this.enemies.children.each(e => { if (e.active && e.y > this.scale.height + 50) e.destroy(); });
}

function shootBullet() {
    const bulletSpeed = -500;
    const bSize = {w: 16, h: 32};

    this.sound.play('shoot_sfx', { volume: 0.1 });

    if (this.weaponLevel === 1) {
        let b = this.bullets.create(this.player.x, this.player.y - 30, 'bullet_tex');
        b.setVelocityY(bulletSpeed);
        b.setDisplaySize(bSize.w, bSize.h);
    } else if (this.weaponLevel === 2) {
        [this.player.x - 15, this.player.x + 15].forEach(xPos => {
            let b = this.bullets.create(xPos, this.player.y - 30, 'bullet_tex');
            b.setVelocityY(bulletSpeed);
            b.setDisplaySize(bSize.w, bSize.h);
        });
    } else {
        [-100, 0, 100].forEach(vx => {
            let b = this.bullets.create(this.player.x, this.player.y - 30, 'bullet_tex');
            b.setVelocityY(bulletSpeed);
            b.setVelocityX(vx);
            b.setDisplaySize(bSize.w, bSize.h);
        });
    }
}

function spawnEnemy() {
    if (this.isGameOver) return;
    // Musuh spawn acak selebar layar
    let x = Phaser.Math.Between(30, this.scale.width - 30);
    let enemy = this.enemies.create(x, -30, 'enemy_tex');
    enemy.setVelocityY(Phaser.Math.Between(100, 200) * this.enemySpeedMultiplier);
    enemy.setDisplaySize(48, 48);

    if (this.score >= 100) {
        this.time.addEvent({
            delay: Phaser.Math.Between(1000, 3000),
            callback: () => {
                if (enemy.active) {
                    let eb = this.enemyBullets.create(enemy.x, enemy.y + 20, 'enemy_bullet_tex');
                    eb.setVelocityY(300);
                    eb.setDisplaySize(12, 24);
                    eb.setTint(0xffcc00); 
                    eb.setFlipY(true); 
                }
            },
            callbackScope: this
        });
    }
}

function hitEnemy(bullet, enemy) {
    bullet.destroy();
    enemy.destroy();
    
    this.sound.play('explode_sfx', { volume: 0.4 });

    this.score += 10;
    this.scoreText.setText('Score: ' + this.score);

    if (this.score % 100 === 0) {
        this.enemySpeedMultiplier += 0.2;
        this.levelText.setText('Lv. ' + (this.score/100 + 1));
        
        if (this.spawnDelay > 300) {
            this.spawnDelay -= 100;
            this.enemyTimer.remove(); 
            this.enemyTimer = this.time.addEvent({ delay: this.spawnDelay, callback: spawnEnemy, callbackScope: this, loop: true });
        }

        let diffText = this.add.text(this.scale.width/2, this.scale.height/4, 'DIFFICULTY UP!', { fontSize: '30px', fill: '#ff0' }).setOrigin(0.5);
        this.time.delayedCall(1000, () => diffText.destroy());
    }
}

function hitPlayer(player, enemy) {
    enemy.destroy();
    processDamage.call(this);
}

function hitPlayerBullet(player, bullet) {
    bullet.destroy();
    processDamage.call(this);
}

function processDamage() {
    this.health -= 1;
    this.healthText.setText('Health: ❤️ ' + this.health);
    
    this.sound.play('explode_sfx', { volume: 0.7 });

    this.tweens.add({ targets: this.player, alpha: 0, yoyo: true, repeat: 3, duration: 100 });

    if (this.health <= 0) {
        this.isGameOver = true;
        this.physics.pause();
        
        this.player.setTint(0xff0000);
        this.add.text(this.scale.width/2, this.scale.height/2 - 50, 'GAME OVER', { fontSize: '40px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        
        let restartBtn = this.add.text(this.scale.width/2, this.scale.height/2 + 20, '[ TAP TO RESTART ]', { 
            fontSize: '20px', fill: '#0f0', backgroundColor: '#333', padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        restartBtn.on('pointerdown', () => this.scene.restart());
    }
}

function spawnPowerUp() {
    if (this.isGameOver) return;
    let types = ['P', 'H', 'S'];
    let chosenType = Phaser.Math.RND.pick(types);
    let powerup = this.powerups.create(Phaser.Math.Between(30, this.scale.width - 30), -20, 'powerup_tex');
    powerup.typeLabel = chosenType;
    powerup.setVelocityY(100);
    powerup.setDisplaySize(32, 32);
}

function collectPowerUp(player, powerup) {
    let type = powerup.typeLabel;
    powerup.destroy();

    this.sound.play('powerup_sfx', { volume: 0.6 });

    if (type === 'P' && this.weaponLevel < 3) this.weaponLevel++;
    else if (type === 'H') {
        this.health++;
        this.healthText.setText('Health: ❤️ ' + this.health);
    }
    else if (type === 'S') this.playerSpeed += 50; 
}