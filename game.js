// ============================================
// 🎰 FLIPPER WEB — Version corrigée v2
// ============================================

const canvas = document.getElementById('pinball');
const ctx = canvas.getContext('2d');

const W = canvas.width;   // 460
const H = canvas.height;  // 800

// --- Constantes plateau ---
const WALL_LEFT = 30;
const WALL_TOP = 120;

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
    x: 408, y: 700,
    vx: 0, vy: 0,
    radius: 8,
    launched: false
};

// --- Lanceur ---
const launcher = {
    x: 408, y: 730,
    power: 0,
    maxPower: 30,
    charging: false
};

function resetBall() {
    ball.x = 408;
    ball.y = 700;
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
// La bille monte dans le couloir droit, tape l'arc arrondi en haut,
// redescend et glisse sur la rampe diagonale vers le plateau.
// Le couloir droit a un plafond incliné qui redirige la bille vers le plateau.
// Une ouverture entre le plafond et le mur droit permet à la bille de passer.

const LANE_INNER_X = 390;
const LANE_OUTER_X = 425;
const RAMP_BOTTOM_Y = 240;  // Le mur droit du plateau commence ici (sous l'ouverture)

const walls = [
    // Mur gauche vertical
    { x1: WALL_LEFT, y1: WALL_TOP, x2: WALL_LEFT, y2: 510 },
    // Mur gauche diagonal → vers flipper gauche
    { x1: WALL_LEFT, y1: 510, x2: 125, y2: 720 },
    // Mur du haut (section plateau, horizontal)
    { x1: WALL_LEFT, y1: WALL_TOP, x2: LANE_INNER_X, y2: WALL_TOP },
    // Plafond incliné du couloir (redirige la bille vers la gauche / le plateau)
    { x1: LANE_INNER_X, y1: WALL_TOP, x2: LANE_OUTER_X, y2: WALL_TOP + 25 },
    // Mur droit du plateau (commence sous l'ouverture, laissant un passage)
    { x1: LANE_INNER_X, y1: RAMP_BOTTOM_Y, x2: LANE_INNER_X, y2: 510 },
    // Mur droit diagonal → vers flipper droit
    { x1: LANE_INNER_X, y1: 510, x2: 290, y2: 720 },
    // Couloir lanceur : mur extérieur droit
    { x1: LANE_OUTER_X, y1: WALL_TOP + 25, x2: LANE_OUTER_X, y2: H },
    // Couloir lanceur : mur intérieur (sous le plateau)
    { x1: LANE_INNER_X, y1: 510, x2: LANE_INNER_X, y2: H },
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
        x: 135, y: 725,
        angle: FLIPPER_REST_ANGLE,
        targetAngle: FLIPPER_REST_ANGLE,
        angularVelocity: 0,
        side: 'left',
        direction: 1       // s'étend vers la droite
    },
    {
        x: 280, y: 725,
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
// Disposition en triangle inversé + bumper MEGA spécial au centre
const bumpers = [
    // Rangée du haut (2 bumpers)
    { x: 130, y: 250, radius: 22, points: 100, glow: 0, special: false },
    { x: 240, y: 230, radius: 22, points: 100, glow: 0, special: false },
    // Rangée du milieu (2 bumpers)
    { x: 170, y: 360, radius: 22, points: 100, glow: 0, special: false },
    { x: 300, y: 360, radius: 22, points: 100, glow: 0, special: false },
    // ⭐ MEGA bumper central — plus gros, x3 points, look doré
    { x: 220, y: 455, radius: 35, points: 500, glow: 0, special: true },
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
            const hitStrength = Math.min(Math.abs(angVel) * contactDist * 1.0, 7);

            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dot * nx) * BOUNCE;
            ball.vy = (ball.vy - 2 * dot * ny) * BOUNCE;

            // Impulsion du flipper : envoie la bille vers le haut
            if (Math.abs(angVel) > 0.01) {
                ball.vy -= hitStrength;
                const dir = flipper.side === 'left' ? 1 : -1;
                ball.vx += dir * hitStrength * 0.3;
            }

            // Clamper la vitesse immédiatement après le coup
            const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (spd > MAX_SPEED) {
                ball.vx = (ball.vx / spd) * MAX_SPEED;
                ball.vy = (ball.vy / spd) * MAX_SPEED;
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
            const reboundSpeed = Math.max(speed, 4) * (bumper.special ? 1.2 : 1.1);
            ball.vx = nx * reboundSpeed;
            ball.vy = ny * reboundSpeed;

            // Clamper après rebond bumper
            const bspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (bspd > MAX_SPEED) {
                ball.vx = (ball.vx / bspd) * MAX_SPEED;
                ball.vy = (ball.vy / bspd) * MAX_SPEED;
            }

            score += bumper.points;
            bumper.glow = 1.0;
            spawnParticles(bumper.x, bumper.y, bumper.special ? 20 : 10);
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
const MAX_SPEED = 30;  // Vitesse max — le sub-stepping (ceil(30/8)=4 pas) protège les murs

function updateBall() {
    if (!ball.launched) return;
    ball.vy += GRAVITY;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;

    // Limiter la vitesse max
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > MAX_SPEED) {
        ball.vx = (ball.vx / speed) * MAX_SPEED;
        ball.vy = (ball.vy / speed) * MAX_SPEED;
    }

    // Sub-stepping : découper le mouvement en petits pas
    // pour que la bille ne traverse jamais un mur
    const steps = Math.ceil(speed / ball.radius);
    const subSteps = Math.max(1, steps);
    for (let i = 0; i < subSteps; i++) {
        ball.x += ball.vx / subSteps;
        ball.y += ball.vy / subSteps;
        collideWalls();
        collideFlippers();
        collideBumpers();
    }

    // Sécurité : clamper la bille dans les limites du terrain
    if (ball.x < WALL_LEFT + ball.radius) {
        ball.x = WALL_LEFT + ball.radius;
        ball.vx = Math.abs(ball.vx) * BOUNCE;
    }
    if (ball.x > LANE_OUTER_X - ball.radius) {
        ball.x = LANE_OUTER_X - ball.radius;
        ball.vx = -Math.abs(ball.vx) * BOUNCE;
    }
    if (ball.y < WALL_TOP + ball.radius) {
        ball.y = WALL_TOP + ball.radius;
        ball.vy = Math.abs(ball.vy) * BOUNCE;
    }
}

// ===================== DESSIN =====================

// Image de fond pré-rendue (générée une seule fois pour la performance)
let bgCanvas = null;

function generateBackgroundImage() {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = W;
    bgCanvas.height = H;
    const bg = bgCanvas.getContext('2d');

    // Fond principal : dégradé profond
    const mainGrad = bg.createLinearGradient(0, 0, 0, H);
    mainGrad.addColorStop(0, '#0c0028');
    mainGrad.addColorStop(0.3, '#140038');
    mainGrad.addColorStop(0.7, '#0a0020');
    mainGrad.addColorStop(1, '#050010');
    bg.fillStyle = mainGrad;
    bg.fillRect(0, 0, W, H);

    // Étoiles fixes
    for (let i = 0; i < 120; i++) {
        const sx = Math.random() * W;
        const sy = Math.random() * H;
        const sr = Math.random() * 1.5 + 0.3;
        bg.globalAlpha = Math.random() * 0.6 + 0.1;
        bg.fillStyle = ['#ffffff', '#aaccff', '#ffccdd'][Math.floor(Math.random() * 3)];
        bg.beginPath();
        bg.arc(sx, sy, sr, 0, Math.PI * 2);
        bg.fill();
    }
    bg.globalAlpha = 1;

    // Grande nébuleuse rose-violet au centre
    bg.globalAlpha = 0.08;
    const neb1 = bg.createRadialGradient(210, 350, 20, 210, 350, 220);
    neb1.addColorStop(0, '#ff44aa');
    neb1.addColorStop(0.5, '#8800cc');
    neb1.addColorStop(1, 'transparent');
    bg.fillStyle = neb1;
    bg.fillRect(0, 100, W, 500);

    // Nébuleuse cyan en bas
    const neb2 = bg.createRadialGradient(320, 560, 10, 320, 560, 170);
    neb2.addColorStop(0, '#00ccff');
    neb2.addColorStop(0.6, '#0044aa');
    neb2.addColorStop(1, 'transparent');
    bg.fillStyle = neb2;
    bg.fillRect(100, 400, 350, 350);
    bg.globalAlpha = 1;

    // Dessin décoratif : grande fusée / vaisseau stylisé au centre
    bg.save();
    bg.translate(210, 480);
    bg.globalAlpha = 0.07;
    // Corps de la fusée
    bg.fillStyle = '#ff6ec7';
    bg.beginPath();
    bg.moveTo(0, -80);
    bg.lineTo(20, -40);
    bg.lineTo(20, 40);
    bg.lineTo(30, 60);
    bg.lineTo(-30, 60);
    bg.lineTo(-20, 40);
    bg.lineTo(-20, -40);
    bg.closePath();
    bg.fill();
    // Hublot
    bg.fillStyle = '#00ffff';
    bg.beginPath();
    bg.arc(0, -10, 10, 0, Math.PI * 2);
    bg.fill();
    // Flammes
    bg.fillStyle = '#ffaa00';
    bg.beginPath();
    bg.moveTo(-15, 60);
    bg.lineTo(0, 110);
    bg.lineTo(15, 60);
    bg.closePath();
    bg.fill();
    bg.fillStyle = '#ff4400';
    bg.beginPath();
    bg.moveTo(-8, 60);
    bg.lineTo(0, 95);
    bg.lineTo(8, 60);
    bg.closePath();
    bg.fill();
    bg.restore();

    // Éclairs décoratifs
    bg.globalAlpha = 0.05;
    bg.strokeStyle = '#00ffff';
    bg.lineWidth = 2;
    bg.beginPath();
    bg.moveTo(70, 180);
    bg.lineTo(90, 220);
    bg.lineTo(75, 220);
    bg.lineTo(100, 270);
    bg.stroke();

    bg.strokeStyle = '#ff6ec7';
    bg.beginPath();
    bg.moveTo(340, 210);
    bg.lineTo(360, 250);
    bg.lineTo(345, 250);
    bg.lineTo(370, 300);
    bg.stroke();
    bg.globalAlpha = 1;

    // Anneaux décoratifs
    bg.globalAlpha = 0.04;
    bg.strokeStyle = '#ff6ec7';
    bg.lineWidth = 1;
    for (let r = 40; r < 200; r += 30) {
        bg.beginPath();
        bg.arc(210, 350, r, 0, Math.PI * 2);
        bg.stroke();
    }
    bg.globalAlpha = 1;

    // Textes décoratifs dans le plateau
    bg.globalAlpha = 0.06;
    bg.fillStyle = '#ff6ec7';
    bg.font = 'bold 60px monospace';
    bg.textAlign = 'center';
    bg.fillText('SPACE', 210, 580);
    bg.font = 'bold 40px monospace';
    bg.fillStyle = '#00ffff';
    bg.fillText('PINBALL', 210, 620);
    bg.globalAlpha = 1;

    // Surface de jeu (zone légèrement plus claire)
    bg.fillStyle = 'rgba(20, 10, 50, 0.3)';
    bg.beginPath();
    bg.moveTo(WALL_LEFT + 5, WALL_TOP + 5);
    bg.lineTo(LANE_INNER_X - 5, WALL_TOP + 5);
    bg.lineTo(LANE_INNER_X - 5, 510);
    bg.lineTo(290, 720);
    bg.lineTo(125, 720);
    bg.lineTo(WALL_LEFT + 5, 510);
    bg.closePath();
    bg.fill();
}

// Appel au démarrage
generateBackgroundImage();

function drawBackground() {
    // Fond pré-rendu
    ctx.drawImage(bgCanvas, 0, 0);

    // Étoiles scintillantes (animées par-dessus le fond fixe)
    const time = Date.now() / 1000;
    for (const star of stars) {
        const twinkle = 0.3 + 0.7 * Math.sin(time * star.speed * 80 + star.x * 10);
        if (twinkle > 0.6) {
            ctx.globalAlpha = (twinkle - 0.6) * 2.5 * star.brightness;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
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
    ctx.moveTo(125, 720);
    ctx.lineTo(135, 725);
    ctx.lineTo(115, 730);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(290, 720);
    ctx.lineTo(280, 725);
    ctx.lineTo(300, 730);
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
        const isSpecial = bumper.special;
        ctx.save();

        // Ombre
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(bumper.x + 3, bumper.y + 3, bumper.radius + 2, 0, Math.PI * 2);
        ctx.fill();

        if (g > 0.1) {
            ctx.shadowColor = isSpecial ? '#ffaa00' : '#ffff00';
            ctx.shadowBlur = (isSpecial ? 60 : 40) * g;
        }

        // Corps — doré pour le MEGA, rose/violet pour les normaux
        const grad = ctx.createRadialGradient(
            bumper.x - bumper.radius * 0.3, bumper.y - bumper.radius * 0.3, 2,
            bumper.x, bumper.y, bumper.radius
        );
        if (isSpecial) {
            const bright = Math.floor(220 + 35 * g);
            grad.addColorStop(0, `rgb(${bright}, ${Math.floor(200 + 55 * g)}, ${Math.floor(50 + 80 * g)})`);
            grad.addColorStop(0.6, '#cc8800');
            grad.addColorStop(1, '#885500');
        } else {
            const bright = Math.floor(200 + 55 * g);
            grad.addColorStop(0, `rgb(${bright}, ${Math.floor(80 + 175 * g)}, ${Math.floor(180 + 75 * g)})`);
            grad.addColorStop(0.7, '#cc3388');
            grad.addColorStop(1, '#881155');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
        ctx.fill();

        // Anneau extérieur
        ctx.strokeStyle = isSpecial
            ? (g > 0.3 ? `rgba(255,215,0,${0.5 + g * 0.5})` : '#ffaa44')
            : (g > 0.3 ? `rgba(255,255,0,${0.5 + g * 0.5})` : '#ff6ec7');
        ctx.lineWidth = isSpecial ? 4 : 3;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Anneau intérieur
        ctx.strokeStyle = `rgba(255,255,255,${0.2 + g * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, bumper.radius * 0.65, 0, Math.PI * 2);
        ctx.stroke();

        // Étoiles décoratives autour du MEGA bumper
        if (isSpecial) {
            const time = Date.now() / 600;
            for (let i = 0; i < 6; i++) {
                const a = time + (i * Math.PI * 2 / 6);
                const sx = bumper.x + Math.cos(a) * (bumper.radius + 8);
                const sy = bumper.y + Math.sin(a) * (bumper.radius + 8);
                ctx.fillStyle = `rgba(255,215,0,${0.4 + 0.3 * Math.sin(time + i)})`;
                ctx.font = '8px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('✦', sx, sy);
            }
        }

        // Points
        ctx.fillStyle = isSpecial ? '#fff' : '#fff';
        ctx.font = `bold ${bumper.radius > 24 ? 14 : (bumper.radius > 20 ? 13 : 10)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isSpecial ? '★' + bumper.points : bumper.points, bumper.x, bumper.y);

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
    ctx.fillRect(WALL_LEFT, WALL_TOP - 28, LANE_INNER_X - WALL_LEFT, 24);

    ctx.fillStyle = '#00ffdd';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${score}`, WALL_LEFT + 8, WALL_TOP - 10);

    // Vies
    for (let i = 0; i < lives; i++) {
        const cx = LANE_INNER_X - 15 - i * 20;
        const cy = WALL_TOP - 14;
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
    ctx.fillText('FLIPPER', W / 2, 280);
    ctx.shadowBlur = 0;

    // Sous-titre
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('\u26A1 ARCADE \u26A1', W / 2, 330);
    ctx.shadowBlur = 0;

    // Petite planète décorative
    const planetGrad = ctx.createRadialGradient(W / 2 - 10, 390, 5, W / 2, 400, 40);
    planetGrad.addColorStop(0, '#6644aa');
    planetGrad.addColorStop(0.7, '#3322aa');
    planetGrad.addColorStop(1, '#110055');
    ctx.fillStyle = planetGrad;
    ctx.beginPath();
    ctx.arc(W / 2, 400, 35, 0, Math.PI * 2);
    ctx.fill();
    // Anneau
    ctx.strokeStyle = 'rgba(200, 180, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(W / 2, 400, 55, 12, -0.3, 0, Math.PI * 2);
    ctx.stroke();

    // Instructions
    ctx.fillStyle = '#8888aa';
    ctx.font = '13px monospace';
    ctx.fillText('\u2190 \u2192  Flippers', W / 2, 470);
    ctx.fillText('ESPACE  Lancer', W / 2, 492);

    // Start clignotant
    ctx.globalAlpha = 0.4 + 0.6 * Math.sin(time * 4);
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('APPUIE SUR ESPACE', W / 2, 570);
    ctx.globalAlpha = 1;

    if (highScore > 0) {
        ctx.fillStyle = '#ff6ec7';
        ctx.font = '14px monospace';
        ctx.fillText(`RECORD: ${highScore}`, W / 2, 620);
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
    ctx.fillText('GAME OVER', W / 2, 310);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00ffdd';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(`${score}`, W / 2, 370);
    ctx.fillStyle = '#777';
    ctx.font = '14px monospace';
    ctx.fillText('POINTS', W / 2, 392);

    if (score >= highScore && score > 0) {
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('\u2605 NOUVEAU RECORD \u2605', W / 2, 440);
        ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 0.4 + 0.6 * Math.sin(time * 4);
    ctx.fillStyle = '#ffff00';
    ctx.font = '15px monospace';
    ctx.fillText('APPUIE SUR ESPACE', W / 2, 510);
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
