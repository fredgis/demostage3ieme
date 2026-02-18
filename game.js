// ============================================
// 🎰 FLIPPER WEB — Version corrigée v2
// ============================================

const canvas = document.getElementById('pinball');
const ctx = canvas.getContext('2d');

const W = canvas.width;   // 400
const H = canvas.height;  // 700

// --- Constantes plateau ---
const WALL_LEFT = 30;
const WALL_RIGHT = 330;
const WALL_TOP = 80;
const LANE_LEFT = 340;
const LANE_RIGHT = 370;

// --- Physique ---
const GRAVITY = 0.2;
const FRICTION = 0.998;
const BOUNCE = 0.65;

// --- État du jeu ---
let score = 0;
let lives = 3;
let gameState = 'title';
let highScore = parseInt(localStorage.getItem('flipperHighScore') || '0');

// --- Particules ---
const particles = [];

// --- Étoiles de fond (générées une seule fois) ---
const stars = [];
for (let i = 0; i < 80; i++) {
    stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random(),
        speed: 0.005 + Math.random() * 0.01
    });
}

// --- La bille ---
const ball = {
    x: 355, y: 600,
    vx: 0, vy: 0,
    radius: 8,
    launched: false
};

// --- Lanceur ---
const launcher = {
    x: 355, y: 630,
    power: 0,
    maxPower: 16,
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
    particles.length = 0;
    resetBall();
}

// --- Murs du plateau ---
const walls = [
    // Mur gauche vertical
    { x1: WALL_LEFT, y1: WALL_TOP, x2: WALL_LEFT, y2: 430 },
    // Mur gauche diagonal → vers flipper gauche
    { x1: WALL_LEFT, y1: 430, x2: 100, y2: 620 },
    // Mur droit vertical
    { x1: WALL_RIGHT, y1: WALL_TOP + 20, x2: WALL_RIGHT, y2: 430 },
    // Mur droit diagonal → vers flipper droit
    { x1: WALL_RIGHT, y1: 430, x2: 265, y2: 620 },
    // Arc du haut : segments formant un arc qui ferme le plateau
    { x1: WALL_LEFT, y1: WALL_TOP, x2: 100, y2: 62 },
    { x1: 100, y1: 62, x2: 180, y2: 55 },
    { x1: 180, y1: 55, x2: 260, y2: 58 },
    { x1: 260, y1: 58, x2: WALL_RIGHT, y2: WALL_TOP },
    // Couloir lanceur : mur intérieur
    { x1: LANE_LEFT, y1: 120, x2: LANE_LEFT, y2: H },
    // Couloir lanceur : mur extérieur droit
    { x1: LANE_RIGHT, y1: 55, x2: LANE_RIGHT, y2: H },
    // Courbe en haut du couloir : guide la bille vers la gauche dans le plateau
    { x1: LANE_LEFT, y1: 120, x2: WALL_RIGHT, y2: WALL_TOP + 20 },
    // Mur du haut côté lanceur (relie l'arc au couloir)
    { x1: WALL_RIGHT, y1: WALL_TOP, x2: LANE_RIGHT, y2: 55 },
];

// --- Flippers ---
const FLIPPER_LENGTH = 65;
const FLIPPER_WIDTH = 14;
const FLIPPER_SPEED = 0.18;
// Au repos les flippers pointent vers le bas (position basse)
// Quand activés, ils montent (angle négatif)
const FLIPPER_REST_ANGLE = 0.45;   // repos = pointe vers le bas
const FLIPPER_UP_ANGLE = -0.55;    // activé = pointe vers le haut

const flippers = [
    {
        x: 110, y: 630,
        angle: FLIPPER_REST_ANGLE,
        targetAngle: FLIPPER_REST_ANGLE,
        angularVelocity: 0,
        side: 'left',
        direction: 1       // s'étend vers la droite
    },
    {
        x: 255, y: 630,
        angle: Math.PI - FLIPPER_REST_ANGLE,  // miroir : repos vers le bas côté gauche
        targetAngle: Math.PI - FLIPPER_REST_ANGLE,
        angularVelocity: 0,
        side: 'right',
        direction: 1       // on utilise direction=1 et on gère le miroir via l'angle
    }
];

// Contrôles clavier
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ') {
        e.preventDefault();
        if (gameState === 'title' || gameState === 'gameover') {
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
    { x: 130, y: 210, radius: 22, points: 100, glow: 0 },
    { x: 240, y: 195, radius: 22, points: 100, glow: 0 },
    { x: 180, y: 300, radius: 28, points: 150, glow: 0 },
    { x: 90, y: 360, radius: 18, points: 100, glow: 0 },
    { x: 270, y: 350, radius: 18, points: 100, glow: 0 },
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

        if (dist < ball.radius && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;
            ball.x = closest.x + nx * (ball.radius + 0.5);
            ball.y = closest.y + ny * (ball.radius + 0.5);
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dot * nx) * BOUNCE;
            ball.vy = (ball.vy - 2 * dot * ny) * BOUNCE;
        }
    }

    // Drain : la bille tombe en bas → perte de vie
    if (ball.y - ball.radius > H + 20) {
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
    // Flipper gauche
    if (keys['ArrowLeft'] || keys['a'] || keys['q']) {
        flippers[0].targetAngle = FLIPPER_UP_ANGLE;
    } else {
        flippers[0].targetAngle = FLIPPER_REST_ANGLE;
    }

    // Flipper droit (miroir : angle = PI - angle)
    if (keys['ArrowRight'] || keys['d'] || keys['p']) {
        flippers[1].targetAngle = Math.PI - FLIPPER_UP_ANGLE;
    } else {
        flippers[1].targetAngle = Math.PI - FLIPPER_REST_ANGLE;
    }

    for (const flipper of flippers) {
        const prev = flipper.angle;
        const diff = flipper.targetAngle - flipper.angle;
        flipper.angle += diff * FLIPPER_SPEED * 5;
        flipper.angularVelocity = flipper.angle - prev;
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

        if (dist < minDist && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;

            ball.x = closest.x + nx * (minDist + 1);
            ball.y = closest.y + ny * (minDist + 1);

            const angVel = flipper.angularVelocity || 0;
            const contactDist = Math.sqrt((closest.x - flipper.x) ** 2 + (closest.y - flipper.y) ** 2);
            const hitStrength = Math.abs(angVel) * contactDist * 1.8;

            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dot * nx) * BOUNCE;
            ball.vy = (ball.vy - 2 * dot * ny) * BOUNCE;

            // Impulsion du flipper : envoie la bille vers le haut
            if (Math.abs(angVel) > 0.01) {
                ball.vy -= hitStrength * 1.8;
                const dir = flipper.side === 'left' ? 1 : -1;
                ball.vx += dir * hitStrength * 0.6;
            }
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

        if (dist < minDist && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;

            ball.x = bumper.x + nx * (minDist + 1);
            ball.y = bumper.y + ny * (minDist + 1);

            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const reboundSpeed = Math.max(speed, 5) * 1.2;
            ball.vx = nx * reboundSpeed;
            ball.vy = ny * reboundSpeed;

            score += bumper.points;
            bumper.glow = 1.0;
            spawnParticles(bumper.x, bumper.y, 10);
        }
        if (bumper.glow > 0) bumper.glow -= 0.025;
    }
}

// --- Particules ---
function spawnParticles(x, y, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: ['#ffff00', '#ff6ec7', '#00ffff', '#ff4444', '#44ff44'][Math.floor(Math.random() * 5)],
            size: 2 + Math.random() * 4
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life -= 0.02;
        p.size *= 0.97;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

// --- Lanceur ---
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

// ===================== DESSIN =====================

function drawBackground() {
    // Fond espace profond
    const gradient = ctx.createRadialGradient(W / 2, H / 3, 50, W / 2, H / 2, H);
    gradient.addColorStop(0, '#1a0a3e');
    gradient.addColorStop(0.4, '#0d0d2b');
    gradient.addColorStop(1, '#050510');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Étoiles animées
    const time = Date.now() / 1000;
    for (const star of stars) {
        const twinkle = 0.4 + 0.6 * Math.sin(time * star.speed * 100 + star.x);
        ctx.globalAlpha = star.brightness * twinkle;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Nébuleuse décorative (tache de couleur subtile)
    ctx.globalAlpha = 0.06;
    const neb1 = ctx.createRadialGradient(120, 250, 10, 120, 250, 120);
    neb1.addColorStop(0, '#ff6ec7');
    neb1.addColorStop(1, 'transparent');
    ctx.fillStyle = neb1;
    ctx.fillRect(0, 130, 250, 250);

    const neb2 = ctx.createRadialGradient(280, 400, 10, 280, 400, 100);
    neb2.addColorStop(0, '#00ffff');
    neb2.addColorStop(1, 'transparent');
    ctx.fillStyle = neb2;
    ctx.fillRect(180, 300, 200, 200);
    ctx.globalAlpha = 1;

    // Surface de jeu intérieure (subtile)
    ctx.fillStyle = 'rgba(15, 15, 50, 0.4)';
    ctx.beginPath();
    ctx.moveTo(WALL_LEFT + 3, WALL_TOP);
    ctx.lineTo(WALL_RIGHT - 3, WALL_TOP);
    ctx.lineTo(WALL_RIGHT - 3, 430);
    ctx.lineTo(265, 620);
    ctx.lineTo(110, 620);
    ctx.lineTo(WALL_LEFT + 3, 430);
    ctx.closePath();
    ctx.fill();
}

function drawWalls() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const wall of walls) {
        // Lueur extérieure
        ctx.strokeStyle = 'rgba(255, 110, 199, 0.12)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(wall.x1, wall.y1);
        ctx.lineTo(wall.x2, wall.y2);
        ctx.stroke();

        // Mur principal
        ctx.strokeStyle = '#c44a9e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(wall.x1, wall.y1);
        ctx.lineTo(wall.x2, wall.y2);
        ctx.stroke();

        // Highlight intérieur
        ctx.strokeStyle = '#ff8ed4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(wall.x1, wall.y1);
        ctx.lineTo(wall.x2, wall.y2);
        ctx.stroke();
    }

    // Petits guides lumineux au-dessus des flippers
    ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(100, 620);
    ctx.lineTo(110, 630);
    ctx.lineTo(90, 635);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(265, 620);
    ctx.lineTo(255, 630);
    ctx.lineTo(275, 635);
    ctx.closePath();
    ctx.fill();
}

function drawBall() {
    // Ombre
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(ball.x + 3, ball.y + 3, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Bille métallique
    const gradient = ctx.createRadialGradient(
        ball.x - 3, ball.y - 3, 1,
        ball.x, ball.y, ball.radius
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.4, '#c0c0c0');
    gradient.addColorStop(1, '#606060');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Reflet
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(ball.x - 3, ball.y - 3, ball.radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
}

function drawFlippers() {
    for (const flipper of flippers) {
        const end = getFlipperEnd(flipper);
        ctx.save();

        // Ombre
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = FLIPPER_WIDTH + 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(flipper.x + 2, flipper.y + 2);
        ctx.lineTo(end.x + 2, end.y + 2);
        ctx.stroke();

        // Corps du flipper
        const grad = ctx.createLinearGradient(flipper.x, flipper.y, end.x, end.y);
        grad.addColorStop(0, '#00cccc');
        grad.addColorStop(0.5, '#00ffff');
        grad.addColorStop(1, '#00aaaa');
        ctx.strokeStyle = grad;
        ctx.lineWidth = FLIPPER_WIDTH;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(flipper.x, flipper.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Highlight
        ctx.strokeStyle = 'rgba(200,255,255,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(flipper.x, flipper.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Pivot
        const pivotGrad = ctx.createRadialGradient(flipper.x - 1, flipper.y - 1, 1, flipper.x, flipper.y, 8);
        pivotGrad.addColorStop(0, '#ffffff');
        pivotGrad.addColorStop(0.5, '#ff6ec7');
        pivotGrad.addColorStop(1, '#aa3377');
        ctx.fillStyle = pivotGrad;
        ctx.beginPath();
        ctx.arc(flipper.x, flipper.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff8ed4';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }
}

function drawBumpers() {
    for (const bumper of bumpers) {
        const g = bumper.glow;
        ctx.save();

        // Ombre
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(bumper.x + 3, bumper.y + 3, bumper.radius + 2, 0, Math.PI * 2);
        ctx.fill();

        if (g > 0.1) {
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 40 * g;
        }

        // Corps
        const grad = ctx.createRadialGradient(
            bumper.x - bumper.radius * 0.3, bumper.y - bumper.radius * 0.3, 2,
            bumper.x, bumper.y, bumper.radius
        );
        const bright = Math.floor(200 + 55 * g);
        grad.addColorStop(0, `rgb(${bright}, ${Math.floor(80 + 175 * g)}, ${Math.floor(180 + 75 * g)})`);
        grad.addColorStop(0.7, '#cc3388');
        grad.addColorStop(1, '#881155');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
        ctx.fill();

        // Anneau extérieur
        ctx.strokeStyle = g > 0.3 ? `rgba(255,255,0,${0.5 + g * 0.5})` : '#ff6ec7';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Anneau intérieur
        ctx.strokeStyle = `rgba(255,255,255,${0.2 + g * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, bumper.radius * 0.65, 0, Math.PI * 2);
        ctx.stroke();

        // Points
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${bumper.radius > 20 ? 13 : 10}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bumper.points, bumper.x, bumper.y);

        ctx.restore();
    }
}

function drawLauncher() {
    const barHeight = 80;
    const barWidth = 18;
    const barX = launcher.x - barWidth / 2;
    const barY = launcher.y + 10;
    const fillHeight = (launcher.power / launcher.maxPower) * barHeight;

    ctx.fillStyle = 'rgba(30, 30, 60, 0.8)';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    if (fillHeight > 0) {
        const grad = ctx.createLinearGradient(barX, barY + barHeight, barX, barY);
        grad.addColorStop(0, '#00cc00');
        grad.addColorStop(0.5, '#ffcc00');
        grad.addColorStop(1, '#ff2200');
        ctx.fillStyle = grad;
        ctx.fillRect(barX + 2, barY + barHeight - fillHeight, barWidth - 4, fillHeight);
    }

    // Ressort visuel
    if (!ball.launched) {
        const springY = ball.y + ball.radius + 5;
        const compression = launcher.power / launcher.maxPower;
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        const coils = 5;
        const springH = 40 * (1 - compression * 0.6);
        ctx.beginPath();
        for (let i = 0; i <= coils; i++) {
            const sx = launcher.x + (i % 2 === 0 ? -6 : 6);
            const sy = springY + (i / coils) * springH;
            if (i === 0) ctx.moveTo(launcher.x, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        ctx.fillStyle = '#aaa';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ESPACE', launcher.x, barY + barHeight + 18);
    }
}

function drawScore() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(WALL_LEFT, 42, WALL_RIGHT - WALL_LEFT, 24);

    ctx.fillStyle = '#00ffdd';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${score}`, WALL_LEFT + 8, 60);

    // Vies
    for (let i = 0; i < lives; i++) {
        const cx = WALL_RIGHT - 15 - i * 20;
        const cy = 56;
        const g = ctx.createRadialGradient(cx - 1, cy - 1, 1, cx, cy, 6);
        g.addColorStop(0, '#fff');
        g.addColorStop(1, '#aaa');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }
}

// --- Écran titre ---
function drawTitleScreen() {
    drawBackground();

    const time = Date.now() / 1000;
    const pulse = 0.7 + 0.3 * Math.sin(time * 3);

    ctx.save();

    // Plateau en fond
    ctx.globalAlpha = 0.12;
    drawWalls();
    drawBumpers();
    ctx.globalAlpha = 1;

    // Titre
    ctx.shadowColor = '#ff6ec7';
    ctx.shadowBlur = 30 * pulse;
    ctx.fillStyle = '#ff6ec7';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FLIPPER', W / 2, 240);
    ctx.shadowBlur = 0;

    // Sous-titre
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('\u26A1 ARCADE \u26A1', W / 2, 290);
    ctx.shadowBlur = 0;

    // Petite planète décorative
    const planetGrad = ctx.createRadialGradient(W / 2 - 10, 350, 5, W / 2, 360, 40);
    planetGrad.addColorStop(0, '#6644aa');
    planetGrad.addColorStop(0.7, '#3322aa');
    planetGrad.addColorStop(1, '#110055');
    ctx.fillStyle = planetGrad;
    ctx.beginPath();
    ctx.arc(W / 2, 360, 35, 0, Math.PI * 2);
    ctx.fill();
    // Anneau
    ctx.strokeStyle = 'rgba(200, 180, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(W / 2, 360, 55, 12, -0.3, 0, Math.PI * 2);
    ctx.stroke();

    // Instructions
    ctx.fillStyle = '#8888aa';
    ctx.font = '13px monospace';
    ctx.fillText('\u2190 \u2192  Flippers', W / 2, 430);
    ctx.fillText('ESPACE  Lancer', W / 2, 452);

    // Start clignotant
    ctx.globalAlpha = 0.4 + 0.6 * Math.sin(time * 4);
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('APPUIE SUR ESPACE', W / 2, 530);
    ctx.globalAlpha = 1;

    if (highScore > 0) {
        ctx.fillStyle = '#ff6ec7';
        ctx.font = '14px monospace';
        ctx.fillText(`RECORD: ${highScore}`, W / 2, 580);
    }

    ctx.restore();
}

// --- Écran game over ---
function drawGameOverScreen() {
    drawBackground();
    drawWalls();
    ctx.globalAlpha = 0.3;
    drawBumpers();
    ctx.globalAlpha = 1;
    drawFlippers();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, W, H);

    const time = Date.now() / 1000;
    ctx.save();

    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ff3333';
    ctx.font = 'bold 44px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, 270);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00ffdd';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(`${score}`, W / 2, 330);
    ctx.fillStyle = '#777';
    ctx.font = '14px monospace';
    ctx.fillText('POINTS', W / 2, 352);

    if (score >= highScore && score > 0) {
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('\u2605 NOUVEAU RECORD \u2605', W / 2, 400);
        ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 0.4 + 0.6 * Math.sin(time * 4);
    ctx.fillStyle = '#ffff00';
    ctx.font = '15px monospace';
    ctx.fillText('APPUIE SUR ESPACE', W / 2, 470);
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

gameLoop();
