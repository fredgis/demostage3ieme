// ============================================
// 🎰 FLIPPER WEB — Phase 2 : Avec Flippers !
// ============================================

const canvas = document.getElementById('pinball');
const ctx = canvas.getContext('2d');

// Dimensions du plateau
const W = canvas.width;   // 400
const H = canvas.height;  // 700

// --- Physique ---
const GRAVITY = 0.15;
const FRICTION = 0.995;
const BOUNCE = 0.7;

// --- La bille ---
const ball = {
    x: W / 2,
    y: 100,
    vx: 0,
    vy: 0,
    radius: 8,
    color: '#ffffff'
};

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
document.addEventListener('keydown', (e) => { keys[e.key] = true; });
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

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

    // Rebond sur le sol (temporaire — sera remplacé par le drain + game over)
    if (ball.y + ball.radius > H - 10) {
        ball.y = H - 10 - ball.radius;
        ball.vy *= -BOUNCE;
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

// --- Mise à jour de la bille ---
function updateBall() {
    ball.vy += GRAVITY;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;
    ball.x += ball.vx;
    ball.y += ball.vy;
    collideWalls();
    collideFlippers();
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

        // Pivot
        ctx.fillStyle = '#ff6ec7';
        ctx.beginPath();
        ctx.arc(flipper.x, flipper.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- Game Loop ---
function gameLoop() {
    drawBackground();
    drawWalls();
    updateFlippers();
    updateBall();
    drawFlippers();
    drawBall();
    requestAnimationFrame(gameLoop);
}

// Lancer le jeu
// Pour l'instant, on donne une petite impulsion à la bille
ball.vx = 2;
ball.vy = -3;

gameLoop();
