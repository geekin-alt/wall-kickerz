// Initialize Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// Add fallback for testing outside Telegram
if (!window.Telegram.WebApp) {
    window.Telegram = {
        WebApp: {
            ready: () => {},
            expand: () => {},
            themeParams: {
                bg_color: '#ffffff',
                text_color: '#000000',
                button_color: '#3390ec'
            },
            CloudStorage: {
                getItem: (key) => Promise.resolve(null),
                setItem: (key, value) => Promise.resolve()
            }
        }
    };
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.highScore = 0;
        this.gameOver = false;
        this.gameStarted = false;
        
        // Load high score
        this.loadHighScore();
        
        // Game objects
        this.player = {
            x: 0,
            y: 0,
            width: 40,
            height: 40,
            velocityY: 0,
            velocityX: 0,
            isJumping: false,
            wallJumped: false
        };
        
        this.walls = [];
        this.gravity = 0.4;
        this.jumpForce = -12;
        this.wallJumpForceY = -8;
        this.wallJumpForceX = 6;
        
        // Initialize
        this.resize();
        this.setupEventListeners();
        this.reset();
        
        // Show start screen
        document.getElementById('start-screen').classList.remove('hidden');
        document.getElementById('game-over').classList.add('hidden');
        
        // Start animation loop
        this.gameLoop();
    }

    async loadHighScore() {
        try {
            const savedScore = await tg.CloudStorage.getItem('highScore');
            if (savedScore) {
                this.highScore = parseInt(savedScore);
                this.updateScoreDisplay();
            }
        } catch (error) {
            console.log('Error loading high score:', error);
        }
    }

    async saveHighScore() {
        try {
            await tg.CloudStorage.setItem('highScore', this.score.toString());
        } catch (error) {
            console.log('Error saving high score:', error);
        }
    }

    updateScoreDisplay() {
        document.getElementById('score').textContent = `Score: ${this.score} | High Score: ${this.highScore}`;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.gameStarted) {
            this.draw(); // Redraw if game is in progress
        }
    }

    startGame() {
        this.gameStarted = true;
        this.gameOver = false;
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-over').classList.add('hidden');
        this.reset();
    }

    reset() {
        this.score = 0;
        this.gameOver = false;
        this.player.x = this.canvas.width / 2 - this.player.width / 2;
        this.player.y = this.canvas.height - 150;
        this.player.velocityY = 0;
        this.player.velocityX = 0;
        this.walls = this.generateInitialWalls();
        this.updateScoreDisplay();
    }

    generateInitialWalls() {
        const walls = [];
        const wallWidth = 30;
        const spacing = 180;
        
        for (let i = 0; i < 10; i++) {
            // Left wall
            walls.push({
                x: this.canvas.width * 0.25,
                y: this.canvas.height - (i * spacing),
                width: wallWidth,
                height: 120
            });
            
            // Right wall
            walls.push({
                x: this.canvas.width * 0.75 - wallWidth,
                y: this.canvas.height - (i * spacing) - spacing/2,
                width: wallWidth,
                height: 120
            });
        }
        return walls;
    }

    handleTouch(e) {
        if (!this.gameStarted || this.gameOver) return;
        
        const touch = e.touches[0];
        const touchX = touch.clientX;
        
        if (touchX < this.canvas.width / 2) {
            this.jump(-1); // Jump right
        } else {
            this.jump(1); // Jump left
        }
    }

    jump(direction) {
        if (this.player.wallJumped) return;
        
        // Check if player is near a wall
        const nearWall = this.walls.some(wall => 
            this.player.x + this.player.width >= wall.x - 10 &&
            this.player.x <= wall.x + wall.width + 10 &&
            this.player.y + this.player.height >= wall.y &&
            this.player.y <= wall.y + wall.height
        );

        if (nearWall) {
            this.player.velocityY = this.wallJumpForceY;
            this.player.velocityX = this.wallJumpForceX * direction;
            this.player.wallJumped = true;
            setTimeout(() => this.player.wallJumped = false, 300);
        }
    }

    update() {
        if (!this.gameStarted || this.gameOver) return;

        // Apply gravity
        this.player.velocityY += this.gravity;
        
        // Add air resistance
        this.player.velocityX *= 0.98;
        
        // Update player position
        this.player.x += this.player.velocityX;
        this.player.y += this.player.velocityY;
        
        // Wall collision
        this.walls.forEach(wall => {
            if (this.checkCollision(this.player, wall)) {
                // Horizontal collision
                if (this.player.velocityX > 0) {
                    this.player.x = wall.x - this.player.width;
                    this.player.velocityX *= -0.1;
                } else if (this.player.velocityX < 0) {
                    this.player.x = wall.x + wall.width;
                    this.player.velocityX *= -0.1;
                }
            }
        });
        
        // Screen boundaries with bounce
        if (this.player.x < 0) {
            this.player.x = 0;
            this.player.velocityX *= -0.5;
        }
        if (this.player.x + this.player.width > this.canvas.width) {
            this.player.x = this.canvas.width - this.player.width;
            this.player.velocityX *= -0.5;
        }
        
        // Update score based on height
        const newScore = Math.floor(Math.abs(this.player.y) / 100);
        if (newScore > this.score) {
            this.score = newScore;
            this.updateScoreDisplay();
            
            // Update high score if needed
            if (this.score > this.highScore) {
                this.highScore = this.score;
                this.saveHighScore();
                this.updateScoreDisplay();
            }
        }
        
        // Generate new walls as player climbs
        if (this.player.y < this.walls[this.walls.length - 1].y) {
            this.generateMoreWalls();
        }
        
        // Check for game over
        if (this.player.y > this.canvas.height) {
            this.gameOver = true;
            this.gameStarted = false;
            document.getElementById('game-over').classList.remove('hidden');
            document.getElementById('final-score').textContent = `${this.score} (High Score: ${this.highScore})`;
        }
    }

    generateMoreWalls() {
        const wallWidth = 30;
        const lastWall = this.walls[this.walls.length - 1];
        const spacing = 180;
        
        // Add new pair of walls
        this.walls.push({
            x: this.canvas.width * 0.25,
            y: lastWall.y - spacing,
            width: wallWidth,
            height: 120
        });
        
        this.walls.push({
            x: this.canvas.width * 0.75 - wallWidth,
            y: lastWall.y - spacing/2,
            width: wallWidth,
            height: 120
        });
        
        // Remove walls that are far below
        while (this.walls.length > 20) {
            this.walls.shift();
        }
    }

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = tg.themeParams.bg_color || '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw walls
        this.ctx.fillStyle = tg.themeParams.button_color || '#3390ec';
        this.walls.forEach(wall => {
            this.ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
        });
        
        // Draw player
        this.ctx.fillStyle = tg.themeParams.text_color || '#000000';
        this.ctx.fillRect(
            this.player.x,
            this.player.y,
            this.player.width,
            this.player.height
        );
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('touchstart', (e) => this.handleTouch(e));
        document.getElementById('start-button').addEventListener('click', () => this.startGame());
        document.getElementById('restart-button').addEventListener('click', () => this.startGame());
    }
}

// Start the game when the page loads
window.onload = () => {
    tg.ready();
    new Game();
};
