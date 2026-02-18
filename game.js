// ============================================
// 🎰 FLIPPER WEB — Version complète !
// ============================================

const canvas = document.getElementById('pinball');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

// --- Physique ---
const GRAVITY = 0.15;
const FRICTION = 0.995;
const BOUNCE = 0.7;

// --- État du jeu ---
let score = 0;
let lives = 3;
let gameState = 'title';  // 'title', 'playing', 'gameover'
let highScore = parseInt(localStorage.getItem('flipperHighScore') || '0');

// --- Particules ---
const particles = [];

// --- La bille ---
const ball = {
    x: 355, y: 600,
    vx: 0, vy: 0,
    radius: 8,
    color: '#ffffff',
    launched: false
};

// --- Lanceur ---
const launcher = {
    x: 355, y: 630,
    power: 0,
    maxPower: 18,
    charging: false
};

function resetBall() {
    ball.x = 355;
    ball.y = 600;
    ball.vx = 0;
    ball.vy = 0;
    ball.launched = false;
    launcher.power = 0;
    launcher.charging = false;
}

function startGame() {
    score = 0;
    lives = 3;
    gameState = 'playing';
    resetBall();
}

// --- Murs du plateau ---
const walls = [
    { x1: 30, y1: 50, x2: 30, y2: 400 },
    { x1: 30, y1: 400, x2: 80, y2: 600 },
    { x1: 340, y1: 50, x2: 340, y2: 400 },
    { x1: 340, y1: 400, x2: 290, y2: 600 },
    { x1: 30, y1: 50, x2: 340, y2: 50 },
    { x1: 340, y1: 50, x2: 370, y2: 50 },
    { x1: 370, y1: 50, x2: 370, y2: 650 },
];

// --- Flippers ---
const FLIPPER_LENGTH = 70;
const FLIPPER_WIDTH = 12;
const FLIPPER_SPEED = 0.15;
const FLIPPER_REST_ANGLE = 0.4;    // angle de repos (radians, vers le bas)
const FLIPPER_UP_ANGLE = -0.5;     // angle quand activé (vers le haut)

const flippers = [
    {
        x: 120, y: 620,          // point de pivot
        angle: FLIPPER_REST_ANGLE,
        targetAngle: FLIPPER_REST_ANGLE,
        side: 'left',
        direction: 1              // 1 = s'étend vers la droite
    },
    {
        x: 250, y: 620,
        angle: -FLIPPER_REST_ANGLE,
        targetAngle: -FLIPPER_REST_ANGLE,
        side: 'right',
        direction: -1             // -1 = s'étend vers la gauche
    }
];

// Contrôles clavier
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ') {
        e.preventDefault();
        if (gameState === 'title') {
            startGame();
        } else if (gameState === 'gameover') {
            startGame();
        } else if (gameState === 'playing' && !launcher.charging && !ball.launched) {
            launcher.charging = true;
        }
    }
});
document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    if (e.key === ' ' && launcher.charging && gameState === 'playing') {
        ball.vy = -launcher.power;
        ball.launched = true;
        launcher.charging = false;
        launcher.power = 0;
    }
});

// --- Bumpers ---
const bumpers = [
    { x: 120, y: 200, radius: 20, points: 100, glow: 0 },
    { x: 250, y: 180, radius: 20, points: 100, glow: 0 },
    { x: 185, y: 280, radius: 25, points: 150, glow: 0 },
    { x: 100, y: 350, radius: 18, points: 100, glow: 0 },
    { x: 270, y: 330, radius: 18, points: 100, glow: 0 },
];

// --- Collision bille / segment ---
function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return { x: x1, y: y1 };
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return { x: x1 + t * dx, y: y1 + t * dy };
}

function collideWalls() {
    for (const wall of walls) {
        const closest = closestPointOnSegment(ball.x, ball.y, wall.x1, wall.y1, wall.x2, wall.y2);
        const dx = ball.x - closest.x;
        const dy = ball.y - closest.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ball.radius) {
            // Normale de collision
            const nx = dx / dist;
            const ny = dy / dist;

            // Repousser la bille hors du mur
            ball.x = closest.x + nx * ball.radius;
            ball.y = closest.y + ny * ball.radius;

            // Réflexion de la vitesse
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dot * nx) * BOUNCE;
            ball.vy = (ball.vy - 2 * dot * ny) * BOUNCE;
        }
    }

    // Drain : la bille tombe en bas → perte de vie
    if (ball.y - ball.radius > H) {
        lives--;
        if (lives <= 0) {
            gameState = 'gameover';
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('flipperHighScore', highScore.toString());
            }
        } else {
            resetBall();
        }
    }
}

// --- Flippers : mise à jour ---
function updateFlippers() {
    // Flipper gauche : touche ArrowLeft ou a/q
    if (keys['ArrowLeft'] || keys['a'] || keys['q']) {
        flippers[0].targetAngle = FLIPPER_UP_ANGLE;
    } else {
        flippers[0].targetAngle = FLIPPER_REST_ANGLE;
    }

    // Flipper droit : touche ArrowRight ou p
    if (keys['ArrowRight'] || keys['d'] || keys['p']) {
        flippers[1].targetAngle = -FLIPPER_UP_ANGLE;
    } else {
        flippers[1].targetAngle = -FLIPPER_REST_ANGLE;
    }

    for (const flipper of flippers) {
        const diff = flipper.targetAngle - flipper.angle;
        flipper.angularVelocity = diff * FLIPPER_SPEED * 20;
        flipper.angle += diff * FLIPPER_SPEED * 5;
    }
}

// --- Collision bille / flipper ---
function getFlipperEnd(flipper) {
    return {
        x: flipper.x + Math.cos(flipper.angle) * FLIPPER_LENGTH * flipper.direction,
        y: flipper.y + Math.sin(flipper.angle) * FLIPPER_LENGTH
    };
}

function collideFlippers() {
    for (const flipper of flippers) {
        const end = getFlipperEnd(flipper);
        const closest = closestPointOnSegment(ball.x, ball.y, flipper.x, flipper.y, end.x, end.y);
        const dx = ball.x - closest.x;
        const dy = ball.y - closest.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = ball.radius + FLIPPER_WIDTH / 2;

        if (dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;

            // Repousser la bille
            ball.x = closest.x + nx * minDist;
            ball.y = closest.y + ny * minDist;

            // Vitesse du flipper au point de contact (effet de frappe)
            const angVel = flipper.angularVelocity || 0;
            const contactDist = Math.sqrt((closest.x - flipper.x) ** 2 + (closest.y - flipper.y) ** 2);
            const flipperHitVx = -Math.sin(flipper.angle) * angVel * contactDist * 0.3;
            const flipperHitVy = Math.cos(flipper.angle) * angVel * contactDist * 0.3;

            // Réflexion + impulsion du flipper
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dot * nx) * BOUNCE + flipperHitVx;
            ball.vy = (ball.vy - 2 * dot * ny) * BOUNCE + flipperHitVy;
        }
    }
}

// --- Collision bille / bumpers ---
function collideBumpers() {
    for (const bumper of bumpers) {
        const dx = ball.x - bumper.x;
        const dy = ball.y - bumper.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = ball.radius + bumper.radius;

        if (dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;

            // Repousser
            ball.x = bumper.x + nx * minDist;
            ball.y = bumper.y + ny * minDist;

            // Rebond amplifié (les bumpers poussent fort !)
            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const minSpeed = 5;
            const reboundSpeed = Math.max(speed, minSpeed) * 1.2;
            ball.vx = nx * reboundSpeed;
            ball.vy = ny * reboundSpeed;

            // Score + effet visuel + particules
            score += bumper.points;
            bumper.glow = 1.0;
            spawnParticles(bumper.x, bumper.y, 8);
        }
        // Fade du glow
        if (bumper.glow > 0) bumper.glow -= 0.03;
    }
}

// --- Particules ---
function spawnParticles(x, y, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: ['#ffff00', '#ff6ec7', '#00ffff', '#ff4444'][Math.floor(Math.random() * 4)],
            size: 2 + Math.random() * 3
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        p.size *= 0.98;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// --- Lanceur : mise à jour ---
function updateLauncher() {
    if (launcher.charging) {
        launcher.power = Math.min(launcher.power + 0.3, launcher.maxPower);
    }
}

// --- Mise à jour de la bille ---
function updateBall() {
    if (!ball.launched) return;
    ball.vy += GRAVITY;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;
    ball.x += ball.vx;
    ball.y += ball.vy;
    collideWalls();
    collideFlippers();
    collideBumpers();
}

// --- Dessin ---
function drawBackground() {
    // Fond sombre avec léger dégradé
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#1a1a3e');
    gradient.addColorStop(1, '#0a0a1e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
}

function drawWalls() {
    ctx.strokeStyle = '#ff6ec7';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff6ec7';
    ctx.shadowBlur = 10;
    for (const wall of walls) {
        ctx.beginPath();
        ctx.moveTo(wall.x1, wall.y1);
        ctx.lineTo(wall.x2, wall.y2);
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
}

function drawBall() {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, ball.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
}

function drawFlippers() {
    for (const flipper of flippers) {
        const end = getFlipperEnd(flipper);
        ctx.save();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = FLIPPER_WIDTH;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(flipper.x, flipper.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#ff6ec7';
        ctx.beginPath();
        ctx.arc(flipper.x, flipper.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawBumpers() {
    for (const bumper of bumpers) {
        const glowAmount = bumper.glow;
        ctx.save();

        // Outer glow
        if (glowAmount > 0) {
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 30 * glowAmount;
        }

        // Bumper body
        const gradient = ctx.createRadialGradient(bumper.x, bumper.y, 0, bumper.x, bumper.y, bumper.radius);
        const r = Math.floor(255 * (0.5 + 0.5 * glowAmount));
        gradient.addColorStop(0, `rgb(${r}, ${Math.floor(100 + 155 * glowAmount)}, 50)`);
        gradient.addColorStop(1, '#ff6ec7');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
        ctx.fill();

        // Ring
        ctx.strokeStyle = glowAmount > 0.3 ? '#ffff00' : '#ff6ec7';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Points label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bumper.points, bumper.x, bumper.y);
        ctx.restore();
    }
}

function drawLauncher() {
    // Barre de puissance
    const barHeight = 100;
    const barWidth = 15;
    const barX = launcher.x - barWidth / 2;
    const barY = launcher.y;
    const fillHeight = (launcher.power / launcher.maxPower) * barHeight;

    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Remplissage de bas en haut
    const gradient = ctx.createLinearGradient(barX, barY + barHeight, barX, barY);
    gradient.addColorStop(0, '#00ff00');
    gradient.addColorStop(0.5, '#ffff00');
    gradient.addColorStop(1, '#ff0000');
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY + barHeight - fillHeight, barWidth, fillHeight);

    if (!ball.launched) {
        ctx.fillStyle = '#aaa';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ESPACE', launcher.x, barY + barHeight + 15);
    }
}

function drawScore() {
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.fillText(`SCORE: ${score}`, 40, 35);
    ctx.shadowBlur = 0;

    // Vies (petites billes)
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('VIES:', 310, 35);
    for (let i = 0; i < lives; i++) {
        ctx.fillStyle = '#ff6ec7';
        ctx.beginPath();
        ctx.arc(320 + i * 18, 31, 6, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- Écran titre ---
function drawTitleScreen() {
    drawBackground();

    // Titre avec glow animé
    const time = Date.now() / 1000;
    const pulse = 0.7 + 0.3 * Math.sin(time * 3);

    ctx.save();
    ctx.shadowColor = '#ff6ec7';
    ctx.shadowBlur = 30 * pulse;
    ctx.fillStyle = '#ff6ec7';
    ctx.font = 'bold 50px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FLIPPER', W / 2, 250);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('🎰 WEB 🎰', W / 2, 310);

    // Instructions
    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.fillText('← → : Flippers', W / 2, 400);
    ctx.fillText('ESPACE : Lancer la bille', W / 2, 425);

    // Start
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('APPUIE SUR ESPACE', W / 2, 520);
    ctx.globalAlpha = 1;

    // High score
    if (highScore > 0) {
        ctx.fillStyle = '#ff6ec7';
        ctx.font = '16px monospace';
        ctx.fillText(`MEILLEUR SCORE: ${highScore}`, W / 2, 580);
    }
    ctx.restore();
}

// --- Écran game over ---
function drawGameOverScreen() {
    drawBackground();
    drawWalls();
    drawBumpers();
    drawFlippers();

    // Overlay sombre
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, W, H);

    const time = Date.now() / 1000;

    ctx.save();
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, 280);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`SCORE: ${score}`, W / 2, 340);

    if (score >= highScore && score > 0) {
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('🏆 NOUVEAU RECORD ! 🏆', W / 2, 390);
    }

    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.fillStyle = '#ffff00';
    ctx.font = '16px monospace';
    ctx.fillText('APPUIE SUR ESPACE', W / 2, 460);
    ctx.globalAlpha = 1;
    ctx.restore();
}

// --- Game Loop ---
function gameLoop() {
    if (gameState === 'title') {
        drawTitleScreen();
    } else if (gameState === 'gameover') {
        drawGameOverScreen();
    } else {
        drawBackground();
        drawWalls();
        updateFlippers();
        updateLauncher();
        updateBall();
        updateParticles();
        drawBumpers();
        drawFlippers();
        drawParticles();
        drawBall();
        drawLauncher();
        drawScore();
    }
    requestAnimationFrame(gameLoop);
}

// --- Contrôles tactiles ---
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

if (btnLeft && btnRight) {
    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowLeft'] = true; });
    btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowLeft'] = false; });
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowRight'] = true; });
    btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowRight'] = false; });
}

// Tap sur le canvas pour lancer (mobile)
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'title' || gameState === 'gameover') {
        startGame();
    } else if (!ball.launched) {
        launcher.charging = true;
    }
});
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (launcher.charging && gameState === 'playing') {
        ball.vy = -launcher.power;
        ball.launched = true;
        launcher.charging = false;
        launcher.power = 0;
    }
});

// Lancer le jeu
gameLoop();
