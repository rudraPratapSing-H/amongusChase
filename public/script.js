const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- Game Configuration ---
const PLAYER_MOVE_DURATION = 100;  // Player speed (lower is faster)
const IMPOSTOR_MOVE_DURATION = 150; // Base impostor animation speed
const IMPOSTOR_FLEE_ANIMATION_DURATION = 75;
let IMPOSTOR_FLEE_MOVE_INTERVAL // Faster animation when fleeing
let IMPOSTOR_MOVE_INTERVAL = 400; // ms between impostor moves
const IMPOSTOR_FLEE_DISTANCE = 7; // How close player must be for impostor to flee
// NEW CONSTRAINT: The impostor will not plot a path within this distance of the player.
const IMPOSTOR_PATH_AVOID_DISTANCE = 3; 

// --- Sound Effects ---
const sounds = {
    move: new Audio('sounds/move.mp3'),
    task: new Audio('sounds/task.mp3'),
    seal: new Audio('sounds/seal.mp3'),
    win: new Audio('sounds/win.mp3'),
    lose: new Audio('sounds/lose.mp3'),
};
sounds.move.volume = 0.4;
sounds.task.volume = 0.7;
sounds.seal.volume = 0.8;

// --- Game State ---
let tasksCompleted = 0;
let ventsSealed = 0;
let startTime = Date.now();
let gameOver = false;
let isMoving = false;
let isImpostorMoving = false;

// --- Timers & Intervals ---
let timerInterval = null;
let impostorMoveInterval = null;

// --- Mobile Swipe Controls ---
let touchStartX = null;
let touchStartY = null;

let tileMap = [
  "XXXXXXXXXXXXXXXXXXXXXXXXX",
  "X   T       X   T        X",
  "X XXXXXXXX XXX XXXXXXX XX",
  "X V     X   X       X   X",
  "X   XXX X XXXXXXX X XXX X",
  "X X   X X   V   X X   X X",
  "X X X X XXXXXXX X XXX X X",
  "X X X   X     X     X X X",
  "X XXXXX X XXX X XXXXX X X",
  "X   V   X X I X X   V   X",
  "XXXXXXX X XXX X XXXXXXX X",
  "X       X     X         P X",
  "X XXXXXXX XXX XXXXXXX XXX",
  "X   T     X V       T   X",
  "XXXXXXXXXXXXXXXXXXXXXXXXX",
];

const rows = tileMap.length;
const cols = tileMap[0].length;
let tileSize = 32;

let player = { x: 0, y: 0, screenX: 0, screenY: 0 };
let impostor = { x: 0, y: 0, screenX: 0, screenY: 0 };

// --- Main Game Functions ---

function setup() {
  for (let y = 0; y < rows; y++) {
    let rowArray = tileMap[y].split("");
    for (let x = 0; x < cols; x++) {
      if (rowArray[x] === "P") {
        player.x = x;
        player.y = y;
        rowArray[x] = " ";
      } else if (rowArray[x] === "I") {
        impostor.x = x;
        impostor.y = y;
        rowArray[x] = " ";
      }
    }
    tileMap[y] = rowArray.join("");
  }
  player.screenX = player.x * tileSize;
  player.screenY = player.y * tileSize;
  impostor.screenX = impostor.x * tileSize;
  impostor.screenY = impostor.y * tileSize;

  resizeCanvas();
  startTimers();
  drawGrid();
}

function startTimers() {
  startTime = Date.now();
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
  impostorMoveInterval = setInterval(moveImpostorAI, IMPOSTOR_MOVE_INTERVAL);
}

function endGame(message) {
  if (gameOver) return;
  gameOver = true;
  clearInterval(timerInterval);
  clearInterval(impostorMoveInterval);
  sounds.move.pause(); // Stop movement sounds

  const endButton = document.getElementById('formButton');

  // Check if the game message indicates a win or a loss
  if (message.includes("Caught") || message.includes("trapped") || message.includes("win")) {
      // --- PLAYER WON ---
      sounds.win.play();
      endButton.innerHTML = '📝 Proceed to Form';
      endButton.onclick = () => {
          // Make sure to replace with your actual form link
          window.location.href = 'https://forms.gle/YOUR_FORM_LINK';
      };
  } else {
      // --- PLAYER LOST ---
      sounds.lose.play();
      endButton.innerHTML = '🔄 Retry';
      endButton.onclick = () => {
          window.location.reload(); // Reloads the page to restart the game
      };
  }

  // Show the newly configured button
  endButton.style.display = 'block';

  // Display the final message on the canvas
  setTimeout(() => {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.floor(tileSize * 1.5)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  }, 200);
}

// --- Drawing and Display ---
function resizeCanvas() {
    const aspectRatio = 3 / 2; // width : height

    // Available space from your existing constraints
    const maxWidth = window.innerWidth * 0.64;
    const maxHeight = window.innerHeight * 0.95;

    // Calculate best fit for 3:2 ratio
    let width = maxWidth;
    let height = width / aspectRatio;

    if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
    }

    // Apply to canvas
    canvas.width = width;
    canvas.height = height;

    // Adjust tile size to fit the width (or height, depending on your grid)
    tileSize = Math.floor(width / cols);

    // Update player and impostor screen positions
    player.screenX = player.x * tileSize;
    player.screenY = player.y * tileSize;
    if (impostor) {
        impostor.screenX = impostor.x * tileSize;
        impostor.screenY = impostor.y * tileSize;
    }

    // Redraw if game still active
    if (!gameOver) {
        drawGrid();
    }
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  document.getElementById("timer").textContent = `Time: ${elapsed}s`;
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tile = tileMap[row][col];
      const x = col * tileSize;
      const y = row * tileSize;
      switch (tile) {
        case "X": ctx.fillStyle = "#444"; break;
        case "V": ctx.fillStyle = "#555"; break;
        case "T": ctx.fillStyle = "#2c2c2c"; break;
        default: ctx.fillStyle = "#1e1e1e"; break;
      }
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.font = `bold ${tileSize * 0.6}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (tile === "V") {
        ctx.fillStyle = "#0ff";
        ctx.fillText("V", x + tileSize / 2, y + tileSize / 2);
      }
      if (tile === "T") {
        ctx.fillStyle = "#0f0";
        ctx.fillText("T", x + tileSize / 2, y + tileSize / 2);
      }
    }
  }
  ctx.fillStyle = "blue";
  ctx.beginPath();
  ctx.arc(player.screenX + tileSize / 2, player.screenY + tileSize / 2, tileSize / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  if (impostor) {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(impostor.screenX + tileSize / 2, impostor.screenY + tileSize / 2, tileSize / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Player Logic ---

function handlePlayerInput(dx, dy) {
    if (isMoving || gameOver) return;
    
    sounds.move.play();
    movePlayer(dx, dy);
}

function movePlayer(dx, dy) {
  const newX = player.x + dx;
  const newY = player.y + dy;
  if (!isWalkable(newX, newY)) return;
  
  isMoving = true;
  const startX = player.screenX;
  const startY = player.screenY;
  const endX = newX * tileSize;
  const endY = newY * tileSize;
  const animStartTime = performance.now();
  player.x = newX;
  player.y = newY;

  function animate(time) {
    let t = (time - animStartTime) / PLAYER_MOVE_DURATION;
    if (t > 1) t = 1;
    player.screenX = startX + (endX - startX) * t;
    player.screenY = startY + (endY - startY) * t;
    drawGrid();
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      player.screenX = endX;
      player.screenY = endY;
      isMoving = false;
      checkPlayerInteraction();
      checkGameEndConditions();
    }
  }
  requestAnimationFrame(animate);
}

function checkPlayerInteraction() {
  const tile = tileMap[player.y][player.x];
  if (tile === "T" || tile === "V") {
    if (tile === "T") {
      tasksCompleted++;
      document.getElementById("tasksCounter").textContent = `Tasks Completed: ${tasksCompleted}`;
      sounds.task.play();
    } else if (tile === "V") {
      ventsSealed++;
      document.getElementById("ventsCounter").textContent = `Vents Sealed: ${ventsSealed}`;
      sounds.seal.play();
    }
    const row = tileMap[player.y].split("");
    row[player.x] = " ";
    tileMap[player.y] = row.join("");
  }
}

// --- Impostor AI ---
/**
 * Finds all "interesting" empty tiles for the impostor to patrol to.
 * An interesting tile is not a dead end (i.e., has 3 or more walkable neighbors).
 */
function findPatrolPoints() {
    const locations = [];
    // Iterate through the inner part of the map, avoiding edges.
    for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
            if (tileMap[y][x] === ' ') {
                let walkableNeighbors = 0;
                if (isWalkable(x, y - 1)) walkableNeighbors++;
                if (isWalkable(x, y + 1)) walkableNeighbors++;
                if (isWalkable(x - 1, y)) walkableNeighbors++;
                if (isWalkable(x + 1, y)) walkableNeighbors++;

                if (walkableNeighbors >= 3) {
                    locations.push({ x, y });
                }
            }
        }
    }
    return locations;
}

function moveImpostorAI() {
    if (isImpostorMoving || gameOver || !impostor) return;

    const distToPlayer = distance(impostor, player);
    const tasks = findAll("T");
    const vents = findAll("V");
    let path = null;
    let animationDuration = IMPOSTOR_MOVE_DURATION;
    const isInFleeMode = distToPlayer <= IMPOSTOR_FLEE_DISTANCE || tasks.length === 0;

    if (isInFleeMode) {
        // Fleeing logic remains the same: find the safest vent.
        IMPOSTOR_MOVE_INTERVAL = 200;
        animationDuration = IMPOSTOR_FLEE_ANIMATION_DURATION;
        if (vents.length > 0) {
            const bestVent = vents
                .map(vent => ({ vent, score: distance(impostor, vent) - (distance(player, vent) * 1.5) }))
                .sort((a, b) => a.score - b.score)[0].vent;
            path = bfs(impostor, bestVent, player, IMPOSTOR_PATH_AVOID_DISTANCE);
        }
    } else {
        // --- NEW BEHAVIOR SELECTION ---
        IMPOSTOR_MOVE_INTERVAL = 400;
        animationDuration = IMPOSTOR_MOVE_DURATION;
        const actionChance = Math.random();

        if (actionChance < 0.70 && tasks.length > 0) {
            // 70% chance to HUNT for a task
            let shortestPath = null;
            for (const task of tasks) {
                const p = bfs(impostor, task, player, IMPOSTOR_PATH_AVOID_DISTANCE);
                if (p && (!shortestPath || p.length < shortestPath.length)) {
                    shortestPath = p;
                }
            }
            path = shortestPath;
        } else {
            // 30% chance to PATROL to a random intersection
            const patrolPoints = findPatrolPoints();
            if (patrolPoints.length > 0) {
                const randomPatrolPoint = patrolPoints[Math.floor(Math.random() * patrolPoints.length)];
                path = bfs(impostor, randomPatrolPoint, player, IMPOSTOR_PATH_AVOID_DISTANCE);
            }
        }

        // If patrolling fails to find a path, always fall back to hunting a task.
        if (!path && tasks.length > 0) {
            let shortestPath = null;
            for (const task of tasks) {
                const p = bfs(impostor, task, player, IMPOSTOR_PATH_AVOID_DISTANCE);
                if (p && (!shortestPath || p.length < shortestPath.length)) {
                    shortestPath = p;
                }
            }
            path = shortestPath;
        }
    }

    // Fallback "Panic" logic to ensure the impostor never stops
    if (!path) {
        if (isInFleeMode) {
            const directions = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
            let bestPanicMove = null;
            let maxDist = -1;
            for (const dir of directions) {
                const nx = impostor.x + dir.dx;
                const ny = impostor.y + dir.dy;
                if (isWalkable(nx, ny)) {
                    const d = distance({ x: nx, y: ny }, player);
                    if (d > maxDist) {
                        maxDist = d;
                        bestPanicMove = { x: nx, y: ny };
                    }
                }
            }
            if (bestPanicMove) {
                animateImpostorMove(bestPanicMove.x, bestPanicMove.y, animationDuration);
                return;
            }
        } else if (tasks.length > 0) {
            // Reckless hunt, ignoring player proximity
            let shortestPath = null;
            for (const task of tasks) {
                const p = bfs(impostor, task);
                if (p && (!shortestPath || p.length < shortestPath.length)) {
                    shortestPath = p;
                }
            }
            path = shortestPath;
        }
    }

    // Set the timer for the next move and execute the chosen path
    clearInterval(impostorMoveInterval);
    impostorMoveInterval = setInterval(moveImpostorAI, IMPOSTOR_MOVE_INTERVAL);

    if (path && path.length > 0) {
        const target = path[0];
        if (target.x === player.x && target.y === player.y) return;
        animateImpostorMove(target.x, target.y, animationDuration);
    }
}
function animateImpostorMove(x, y, duration) {
  isImpostorMoving = true;
  const startX = impostor.screenX;
  const startY = impostor.screenY;
  const endX = x * tileSize;
  const endY = y * tileSize;
  const animStartTime = performance.now();
  impostor.x = x;
  impostor.y = y;
  function animate(time) {
    let t = (time - animStartTime) / duration;
    if (t > 1) t = 1;
    impostor.screenX = startX + (endX - startX) * t;
    impostor.screenY = startY + (endY - startY) * t;
    drawGrid();
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      impostor.screenX = endX;
      impostor.screenY = endY;
      isImpostorMoving = false;
      handleImpostorLanding();
      checkGameEndConditions();
    }
  }
  requestAnimationFrame(animate);
}

function handleImpostorLanding() {
  const currentTile = tileMap[impostor.y][impostor.x];
  if (currentTile === "T") {
    const row = tileMap[impostor.y].split("");
    row[impostor.x] = " ";
    tileMap[impostor.y] = row.join("");
  }
  
  const allTasks = findAll("T");
  const allVents = findAll("V");
  const isOnVent = allVents.some(v => v.x === impostor.x && v.y === impostor.y);
  if (isOnVent) {
    if (allTasks.length === 0) {
      endGame("Impostor Escaped!");
      return;
    }
    setTimeout(()=>{ const otherVents = allVents.filter(v => v.x !== impostor.x || v.y !== impostor.y);
    if (otherVents.length > 0) {
      const randomVent = otherVents[Math.floor(Math.random() * otherVents.length)];
      impostor.x = randomVent.x;
      impostor.y = randomVent.y;
      impostor.screenX = impostor.x * tileSize;
      impostor.screenY = impostor.y * tileSize;
      drawGrid();
    }}, 1000)
   
  }
}

function checkGameEndConditions() {
  if (gameOver || !impostor) return;
  if (player.x === impostor.x && player.y === impostor.y) {
    impostor = null;
    endGame("You Caught the Impostor!");
    return;
  }
  const remainingTasks = findAll("T");
  const remainingVents = findAll("V");
  if (remainingTasks.length === 0 && remainingVents.length === 0) {
    endGame("Impostor is trapped! You win!");
    return;
  }
}

// --- Utility & Pathfinding ---

function isWalkable(x, y) {
  if (y < 0 || y >= rows || x < 0 || x >= cols) return false;
  return tileMap[y][x] !== "X";
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function findAll(char) {
  const locations = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (tileMap[y][x] === char) {
        locations.push({ x, y });
      }
    }
  }
  return locations;
}

// REFACTORED: The pathfinding function is now "player-aware".
function bfs(start, goal, player, avoidDistance) {
  const queue = [{ x: start.x, y: start.y, path: [] }];
  const visited = new Set([`${start.x},${start.y}`]);
  const directions = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];

  while (queue.length > 0) {
    const { x, y, path } = queue.shift();
    if (x === goal.x && y === goal.y) return path;

    for (const { dx, dy } of directions) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;

      // NEW CONSTRAINT: This check ensures the generated path is never too close to the player.
      if (player && distance({ x: nx, y: ny }, player) <= avoidDistance) {
        continue; // Skip this tile, it's too close.
      }

      if (isWalkable(nx, ny) && !visited.has(key)) {
        visited.add(key);
        const newPath = [...path, { x: nx, y: ny }];
        queue.push({ x: nx, y: ny, path: newPath });
      }
    }
  }
  return null; // No valid path found
}

// --- Event Listeners ---

window.addEventListener('resize', resizeCanvas);

document.addEventListener("keydown", (e) => {
  if (gameOver) return;
  if (e.key === "ArrowUp" || e.key === "w") handlePlayerInput(0, -1);
  else if (e.key === "ArrowDown" || e.key === "s") handlePlayerInput(0, 1);
  else if (e.key === "ArrowLeft" || e.key === "a") handlePlayerInput(-1, 0);
  else if (e.key === "ArrowRight" || e.key === "d") handlePlayerInput(1, 0);
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (gameOver || e.touches.length !== 1) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (gameOver || touchStartX === null) return;
  
  const touch = e.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  const minDist = 30;
  
  if (Math.abs(dx) > minDist || Math.abs(dy) > minDist) {
      if (Math.abs(dx) > Math.abs(dy)) {
        handlePlayerInput(dx > 0 ? 1 : -1, 0);
      } else {
        handlePlayerInput(0, dy > 0 ? 1 : -1);
      }
  }

  touchStartX = null;
  touchStartY = null;
}, { passive: false });

// --- Start the game ---

function setupAndStartGame() {
    document.body.classList.add('game-active');

    document.getElementById('up-btn').addEventListener('click', () => handlePlayerInput(0, -1));
    document.getElementById('down-btn').addEventListener('click', () => handlePlayerInput(0, 1));
    document.getElementById('left-btn').addEventListener('click', () => handlePlayerInput(-1, 0));
    document.getElementById('right-btn').addEventListener('click', () => handlePlayerInput(1, 0));

    setup();
}

const startButton = document.getElementById('start-button');
const startOverlay = document.getElementById('start-overlay');

startButton.addEventListener('click', async () => {
    startOverlay.style.display = 'none';
    
    try {
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        }
        if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape');
        }
        setupAndStartGame();
    } catch (err) {
        console.error("Could not activate landscape/fullscreen mode:", err);
        alert("Could not switch to landscape fullscreen automatically. Please rotate your device if possible. The game will now start.");
        setupAndStartGame();
    }
}, { once: true });