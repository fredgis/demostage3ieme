// ============================================
// 🎰 FLIPPER WEB — Phase 1 : Squelette + Plateau + Bille
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
// Le plateau a une forme de trapèze : plus étroit en bas pour guider vers les flippers
const walls = [
    // Mur gauche haut (vertical)
    { x1: 30, y1: 50, x2: 30, y2: 400 },
    // Mur gauche bas (diagonal vers le centre)
    { x1: 30, y1: 400, x2: 80, y2: 600 },
    // Mur droit haut (vertical) — laisse un couloir à droite pour le lanceur
    { x1: 340, y1: 50, x2: 340, y2: 400 },
    // Mur droit bas (diagonal vers le centre)
    { x1: 340, y1: 400, x2: 290, y2: 600 },
    // Mur du haut
    { x1: 30, y1: 50, x2: 340, y2: 50 },
    // Couloir du lanceur — mur intérieur
    { x1: 340, y1: 50, x2: 370, y2: 50 },
    { x1: 370, y1: 50, x2: 370, y2: 650 },
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

    // Rebond sur le sol (temporaire — sera remplacé par le drain + game over)
    if (ball.y + ball.radius > H - 10) {
        ball.y = H - 10 - ball.radius;
        ball.vy *= -BOUNCE;
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
    // Glow effect
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Reflet
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, ball.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
}

// --- Game Loop ---
function gameLoop() {
    drawBackground();
    drawWalls();
    updateBall();
    drawBall();
    requestAnimationFrame(gameLoop);
}

// Lancer le jeu
// Pour l'instant, on donne une petite impulsion à la bille
ball.vx = 2;
ball.vy = -3;

gameLoop();
