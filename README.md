# 🎰 Flipper Web — Projet de stage 3ème

## C'est quoi ce projet ?

C'est un **jeu de flipper** (comme dans les salles d'arcade !) qui tourne directement dans ton navigateur web. Pas besoin d'installer quoi que ce soit : tu ouvres le fichier `index.html` et c'est parti ! 🚀

Le jeu fonctionne sur **PC, tablette et téléphone**.

## 🎮 Comment jouer ?

| Action | Sur PC | Sur mobile |
|--------|--------|------------|
| Lancer la bille | Maintenir **ESPACE** puis relâcher | Appuyer sur l'écran puis relâcher |
| Flipper gauche | **← (flèche gauche)** ou touche **A** | Bouton **GAUCHE** |
| Flipper droit | **→ (flèche droite)** ou touche **P** | Bouton **DROITE** |

**Le but** : marquer un maximum de points en faisant rebondir la bille sur les **bumpers** (les ronds colorés). Chaque bumper touché donne 100 ou 150 points. Tu as **3 billes** par partie.

⚠️ Si la bille tombe entre les deux flippers... tu perds une vie !

## 📁 Les fichiers du projet

Le projet est très simple, il n'y a que **3 fichiers** :

```
📂 demostage3ieme/
├── 📄 index.html    ← La page web (structure)
├── 🎨 style.css     ← Le design (couleurs, mise en page)
└── ⚙️ game.js       ← Le code du jeu (toute la logique !)
```

### `index.html` — La structure de la page

C'est le fichier que tu ouvres dans le navigateur. Il contient :
- Le **titre** du jeu
- Le **canvas** : c'est comme une toile de peinture numérique où on dessine le jeu
- Les **boutons tactiles** pour jouer sur mobile
- Les liens vers les fichiers CSS et JavaScript

### `style.css` — Le style visuel

Ce fichier dit au navigateur **comment afficher les choses** :
- La couleur de fond (bleu très foncé)
- Le style du titre (rose fluo avec un effet lumineux)
- La bordure du canvas (rose avec une ombre)
- Les boutons pour mobile

### `game.js` — Le cerveau du jeu 🧠

C'est le fichier le plus important ! Il contient toute la **logique du jeu** :

#### Les variables
Ce sont des "boîtes" qui stockent des informations. Par exemple :
```javascript
let score = 0;        // Le score du joueur
let lives = 3;        // Le nombre de vies restantes
const GRAVITY = 0.2;  // La force de la gravité
```

#### La boucle de jeu (Game Loop)
Le jeu se redessine **60 fois par seconde** ! À chaque image :
1. On efface l'écran
2. On met à jour la position de la bille (gravité, vitesse)
3. On vérifie les collisions (murs, bumpers, flippers)
4. On redessine tout

C'est la fonction `gameLoop()` qui fait ça :
```javascript
function gameLoop() {
    drawBackground();   // Dessiner le fond
    updateBall();       // Bouger la bille
    drawBall();         // Dessiner la bille
    requestAnimationFrame(gameLoop);  // Recommencer !
}
```

#### La physique
La bille bouge grâce à des calculs simples :
- **Gravité** : à chaque image, la bille accélère vers le bas (`vy += 0.2`)
- **Friction** : la bille ralentit un petit peu à chaque image
- **Rebond** : quand la bille touche un mur, sa vitesse s'inverse (elle repart dans l'autre sens)

#### Les collisions
Pour savoir si la bille touche un mur ou un bumper, on calcule la **distance** entre eux. Si la distance est plus petite que le rayon de la bille → il y a collision ! 💥

Pour un bumper (qui est rond), c'est facile :
```
distance = √((bille.x - bumper.x)² + (bille.y - bumper.y)²)
si distance < rayon_bille + rayon_bumper → COLLISION !
```

C'est du **théorème de Pythagore** qu'on apprend en cours de maths ! 📐

#### Les flippers
Les flippers tournent autour d'un **point de pivot** (le rond rose). Quand tu appuies sur une touche, l'angle du flipper change. On utilise `Math.cos()` et `Math.sin()` (cosinus et sinus) pour calculer où se trouve le bout du flipper.

#### Les événements clavier
Le navigateur nous dit quand une touche est appuyée ou relâchée :
```javascript
document.addEventListener('keydown', (e) => {
    // La touche e.key vient d'être appuyée !
});
```

#### Le score et les vies
- Chaque bumper touché ajoute des points
- Quand la bille tombe en bas (le "drain"), on perd une vie
- À 0 vies → Game Over !
- Le meilleur score est sauvegardé dans le navigateur grâce à `localStorage`

## 🎨 Le design

Le jeu a un thème **espace / arcade** :
- Fond étoilé avec des étoiles qui scintillent
- Des **nébuleuses** colorées (taches rose et cyan)
- Les murs sont en rose avec un effet 3D (ombre + highlight)
- Les bumpers ont un dégradé et flashent en jaune quand la bille les touche
- La bille est **métallique** avec un reflet
- Des **particules** (étincelles) apparaissent à chaque collision avec un bumper

## 🧑‍💻 Concepts de programmation utilisés

Voici ce qu'on a appris en codant ce jeu :

| Concept | Explication | Où dans le code ? |
|---------|-------------|-------------------|
| **Variables** | Stocker des données (score, position...) | `let score = 0;` |
| **Constantes** | Valeurs qui ne changent pas | `const GRAVITY = 0.2;` |
| **Fonctions** | Blocs de code réutilisables | `function drawBall() { ... }` |
| **Conditions** | Si... alors... | `if (dist < ball.radius)` |
| **Boucles** | Répéter des actions | `for (const bumper of bumpers)` |
| **Tableaux** | Listes d'éléments | `const bumpers = [...]` |
| **Objets** | Regrouper des données | `{ x: 100, y: 200, radius: 20 }` |
| **Événements** | Réagir aux actions de l'utilisateur | `addEventListener('keydown', ...)` |
| **Canvas** | Dessiner dans le navigateur | `ctx.arc(x, y, r, 0, Math.PI*2)` |
| **Maths** | Pythagore, cos, sin, racine carrée | Collisions, rotation des flippers |
| **Physique** | Gravité, vitesse, rebonds | `ball.vy += GRAVITY` |

## 🔧 Technologies utilisées

- **HTML5** : le langage qui structure les pages web
- **CSS3** : le langage qui met en forme les pages web (couleurs, tailles, positions)
- **JavaScript** : le langage de programmation qui rend les pages web interactives
- **Canvas API** : une fonctionnalité du navigateur pour dessiner des graphiques 2D

**Aucun framework** n'a été utilisé ! Tout est codé "à la main" (on dit "vanilla JavaScript") pour bien comprendre comment ça marche.

## 🚀 Comment lancer le jeu ?

1. Télécharge ou clone ce dépôt :
   ```
   git clone https://github.com/fredgis/demostage3ieme.git
   ```
2. Ouvre le fichier `index.html` dans ton navigateur (Chrome, Firefox, Edge...)
3. Appuie sur **ESPACE** et amuse-toi ! 🎮

## 💡 Idées pour aller plus loin

Si tu veux améliorer le jeu, voici quelques idées :
- 🔊 Ajouter des **effets sonores** (rebond, score, game over)
- 🎯 Ajouter des **cibles** qui donnent des bonus
- 🌈 Changer les **couleurs** des bumpers
- 📊 Afficher un **tableau des scores**
- 🏆 Ajouter des **niveaux** de plus en plus difficiles
- 🎵 Mettre de la **musique** de fond

## 📝 Ce que j'ai appris pendant ce stage

*(Tu peux compléter cette section avec tes propres observations !)*

- Comment un jeu vidéo fonctionne en coulisses (la boucle de jeu)
- Les bases de la programmation en JavaScript
- Comment on utilise les maths (Pythagore, trigonométrie) dans un vrai programme
- Comment un site web est structuré (HTML + CSS + JS)
- Comment on utilise Git et GitHub pour sauvegarder et partager du code
- Le travail en équipe et la méthode de travail des développeurs

---

*Projet réalisé lors d'un stage d'observation de 3ème* 🎓
