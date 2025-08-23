/**
 * @file Vent Chase Game Logic
 * @description This file contains the complete logic for the Vent Chase game,
 * including player movement, impostor AI, drawing, and game state management.
 * Features tap-to-move for player control.
 */

// --- DOM and Rendering Context ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let flag = false;
let count;


// --- Core Game Configuration ---
// NOTE: These values make the impostor very fast for a high-difficulty experience.
const moveDuration = [90, 60, 55];
const fleeDuration = [65, 40, 30];
const playerDuration = [60, 80, 120];
const time = [1500, 1000, 500];
let level = parseInt(localStorage.getItem("level"), 10);
if (isNaN(level) || level < 1 || level > moveDuration.length) {
  level = 1; // Default to level 1 if not set or invalid
  localStorage.setItem("level", 1);
}
count = parseInt(localStorage.getItem("count"), 10);
if (isNaN(count) || count < 1 ) {
  count = 1; // Default to count 1 if not set or invalid
  localStorage.setItem("count", count);
}
const PLAYER_MOVE_DURATION = playerDuration[level - 1]; // Player animation speed (lower is faster)
let IMPOSTOR_MOVE_DURATION = moveDuration[level - 1]; // Base impostor animation speed
let IMPOSTOR_FLEE_ANIMATION_DURATION = fleeDuration[level - 1]; // Faster animation when fleeing
const IMPOSTOR_MOVE_INTERVAL = 200; // ms between impostor moves
const IMPOSTOR_FLEE_DISTANCE = 7; // How close player must be for impostor to flee
const IMPOSTOR_PATH_AVOID_DISTANCE = 3; // Impostor avoids plotting paths this close to the player
const IMPOSTOR_VENT_TELEPORT_DELAY = time[level - 1]; // 1.5 second gap between teleporting
const IMPOSTOR_HUNT_CHANCE = 0.7; // 70% chance for the impostor to hunt a task instead of patrolling
const replayButton = document.getElementById("replay");
const levelup = document.getElementById("levelPlusButton");
const leveldown = document.getElementById("levelMinusButton");

console.log(`Current Player Move Duration: ${PLAYER_MOVE_DURATION}`);
console.log(`Current Impostor Move Duration: ${IMPOSTOR_MOVE_DURATION}`);
console.log(`Current Level: ${level}, Count: ${count}`);
// --- Sound Effects ---
const sounds = {
  tap: new Audio("sounds/tap.mp3"),
  move: new Audio("sounds/move.mp3"),
  task: new Audio("sounds/task.mp3"),
  seal: new Audio("sounds/seal.mp3"),
  win: new Audio("sounds/win.mp3"),
  lose: new Audio("sounds/lose.mp3"),
};
sounds.move.volume = 0.8;
sounds.task.volume = 0.7;
sounds.seal.volume = 0.7;
sounds.tap.volume = 0.5;

// --- Game State ---
let tasksCompleted = 0;
let ventsSealed = 0;
let startTime = Date.now();
let gameOver = false;
let isMoving = false; // Player's animation lock
let isImpostorMoving = false; // Impostor's animation lock
let playerTargetTile = null; // Stores {x, y} for tap-to-move

// --- Timers & Intervals ---
let timerInterval = null;
let impostorMoveInterval = null;

// --- The Game Map Layout ---
let tileMap = [
  "XXXXXXXXXXXXXXXXXXXXXXXXX",
  "X   T    V              X",
  "X XXXXXXXX XXX XXXVXXX XX",
  "X V   X     T   X  PX",
  "X   XXX X XXXXXXX X XXX X",
  "X X   X X   V   X X   X X",
  "X X X X XXXXXXX X XXX X X",
  "X X X   X  T  X     X X X",
  "X XXXXX X XXX X XXXXX X X",
  "X   V     V I X     V   X",
  "XXXX XX X XXX X XXXXXXX X",
  "X       X     X         X",
  "X XXXXX X XXX XXXXXXX XXX",
  "X   T     X V         X",
  "XXXXXXXXXXXXXXXXXXXXXXXXX",
];

const rows = tileMap.length;
const cols = tileMap[0].length;
let tileSize = 32; // This will be dynamically calculated

// --- Character Objects ---
let player = { x: 0, y: 0, screenX: 0, screenY: 0 };
let impostor = { x: 0, y: 0, screenX: 0, screenY: 0 };

// ================================================================================= //
//                               MAIN GAME FUNCTIONS                                 //
// ================================================================================= //

/**
 * Generates a random string to use as a security token.
 */
function generateToken() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

console.log(level);

/**
 * Initializes the game state, parses the map to find player/impostor start positions.
 */
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
  // Set initial screen positions based on grid positions
  player.screenX = player.x * tileSize;
  player.screenY = player.y * tileSize;
  impostor.screenX = impostor.x * tileSize;
  impostor.screenY = impostor.y * tileSize;

  resizeCanvas();

  drawGrid();
}

/**
 * Starts the game timer and the impostor's movement interval.
 */

/**
 * Handles the end of the game, displaying a message and setting up the final button.
 * @param {string} message - The win or loss message to display.
 */
function endGame(message) {

  if (gameOver) return;
  let count = parseInt(localStorage.getItem("count"), 10);
    const isWin =
    message.includes("Caught") ||
    message.includes("trapped") ||
    message.includes("Won") ||
    message.includes("escaped") ||
    message.includes("Sealed") ;
    const islost =
    message.includes("LOST") ||
    count > 3;
 

  localStorage.setItem("oncePlayed", "true");
  gameOver = true;
  playerTargetTile = null; // Stop any automated movement
  clearInterval(timerInterval);
  clearInterval(impostorMoveInterval);
  sounds.move.pause(); // Stop any lingering movement sounds

  const endButton = document.getElementById("formButton");
  // Update status and count before checking for popup
  
  let status = localStorage.getItem("won");
  if (islost) {
    localStorage.setItem("won", "false");
    count++;
    localStorage.setItem("count", count);
    status = "false";
  }
  // Now check with updated values
  if (count > 3 && status === "false") {
    console.log("more than three turns");
    const modal = document.getElementById("popup-modal");
    document.getElementById("popup-message").textContent =
      `( Level: ${level} ) You’ve tried many times—don’t worry! You can fill out the form now and play again later. Tip: Predict the Saboteur’s moves and click ahead to catch it..`;
    modal.style.display = "flex";
    window.popupActive = true;
    document.body.classList.add("popup-active");

    function resumeGame() {
      modal.style.display = "none";
      document.removeEventListener("mousedown", resumeGame);
      document.removeEventListener("touchstart", resumeGame);
      window.popupActive = false;
      document.body.classList.remove("popup-active");
    }
    document.addEventListener("mousedown", resumeGame);
    document.addEventListener("touchstart", resumeGame);
  }






if (isWin) {
    localStorage.setItem("won", "true");
    sounds.win.play();
    replayButton.style.display = "block";
    endButton.innerHTML = "📝 Proceed to Form";

    // Show "Try another level too!" message
    setTimeout(() => {
      const modal = document.getElementById("popup-modal");
      document.getElementById("popup-message").textContent =
        "Congratulations! You won! 🎉<br>Try another level too!";
      modal.style.display = "flex";
      window.popupActive = true;
      document.body.classList.add("popup-active");

      function resumeGame() {
        modal.style.display = "none";
        document.removeEventListener("mousedown", resumeGame);
        document.removeEventListener("touchstart", resumeGame);
        window.popupActive = false;
        document.body.classList.remove("popup-active");
      }
      document.addEventListener("mousedown", resumeGame);
      document.addEventListener("touchstart", resumeGame);
    }, 2200); // Show after the win message on canvas

    const winToken = generateToken(); // Create a new token
    localStorage.setItem("secureFormToken", winToken); // Save it to the browser's memory
    endButton.onclick = () => {
      window.location.href = `protected.html?token=${winToken}`;
    };
} else {
    localStorage.setItem("won", "false");
    
    sounds.lose.play();
    if(count > 3){ replayButton.style.display = "block";

    endButton.innerHTML = "📝 Proceed to Form";

    const winToken = generateToken(); // Create a new token
    localStorage.setItem("secureFormToken", winToken); // Save it to the browser's memory

    // NEW: Update the button's click action to use the token
    // Make sure 'protected.html' is the name of your protected form file
    endButton.onclick = () => {
      window.location.href = `protected.html?token=${winToken}`;
    };}else{    endButton.innerHTML = "🔄 Retry";

    endButton.onclick = () => window.location.reload();}

  }

  endButton.style.display = "block";

  // Display the final message over the canvas after a short delay
  setTimeout(() => {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.floor(tileSize * 1.5)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);

    // Add "Game by Rudra Pratap Singh" below the message
    ctx.font = `bold ${Math.floor(tileSize * 0.6)}px sans-serif`;
    ctx.fillStyle = "#00ffff";
    ctx.fillText(
      "Game by Rudra Pratap Singh",
      canvas.width / 2,
      canvas.height / 2 + tileSize * 1.2
    );
  }, 2000);
}
// ================================================================================= //
//                              DRAWING AND DISPLAY                                  //
// ================================================================================= //

/**
 * Resizes the canvas to fit the window while maintaining a 3:2 aspect ratio.
 * Also recalculates tileSize and character screen positions.
 */
function resizeCanvas() {
  // Use the full available window size for the canvas
  const aspectRatio = 25 / 15;
  const maxWidth = window.innerWidth;
  const maxHeight = window.innerHeight;

  let width = maxWidth;
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  canvas.width = width;
  canvas.height = height;
  tileSize = Math.floor(width / cols);

  // Update screen positions to match the new tile size
  player.screenX = player.x * tileSize;
  player.screenY = player.y * tileSize;
  if (impostor) {
    impostor.screenX = impostor.x * tileSize;
    impostor.screenY = impostor.y * tileSize;
  }

  if (!gameOver) {
    drawGrid();
  }
}

function forceFullscreenPrompt() {
  const modal = document.getElementById("popup-modal");
  document.getElementById(
    "popup-message"
  ).textContent = `( Level: ${level} ) For the best experience, tap to enter fullscreen mode.`;
  modal.style.display = "flex";
  window.popupActive = true;
  document.body.classList.add("popup-active");

  function requestFullScreenAndResume() {
    modal.style.display = "none";
    document.removeEventListener("mousedown", requestFullScreenAndResume);
    document.removeEventListener("touchstart", requestFullScreenAndResume);
    window.popupActive = false;
    document.body.classList.remove("popup-active");
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
    // Optionally, lock orientation to landscape
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock("landscape").catch((err) => {
        console.warn("Could not activate landscape/fullscreen mode:", err);
        // Optionally show a message to the user if you want
      });
    }
  }

  document.addEventListener("mousedown", requestFullScreenAndResume);
  document.addEventListener("touchstart", requestFullScreenAndResume);
}

/**
 * Updates the HUD timer every second.
 */

/**
 * Clears and redraws the entire game grid, including tiles and characters.
 */
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tile = tileMap[row][col];
      const x = col * tileSize;
      const y = row * tileSize;

      // Draw tile background
      switch (tile) {
        case "X":
          ctx.fillStyle = "#444";
          break;
        case "V":
          ctx.fillStyle = "#555";
          break;
        case "T":
          ctx.fillStyle = "#2c2c2c";
          break;
        case "R":
          ctx.fillStyle = "#2c2c2c";
          break;
        default:
          ctx.fillStyle = "#1e1e1e";
          break;
      }
      ctx.fillRect(x, y, tileSize, tileSize);

      // Draw tile text (V, T, or R)
      ctx.font = `bold ${tileSize * 0.6}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (tile === "V") {
        ctx.fillStyle = "#0ff"; // Cyan for Vent
        ctx.fillText("V", x + tileSize / 2, y + tileSize / 2);
      } else if (tile === "T") {
        ctx.fillStyle = "#0f0"; // Green for Task
        ctx.fillText("T", x + tileSize / 2, y + tileSize / 2);
      } else if (tile === "R") {
        ctx.fillStyle = "#f00"; // Red for sabotaged Task
        ctx.fillText("T", x + tileSize / 2, y + tileSize / 2);
      }
    }
  }

  // Draw Player
  ctx.fillStyle = "yellow";
  ctx.beginPath();
  ctx.arc(
    player.screenX + tileSize / 2,
    player.screenY + tileSize / 2,
    tileSize / 2 - 2,
    0,
    Math.PI * 2
  );
  ctx.fill();
  // Label "You"
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${tileSize * 0.35}px sans-serif`;
  ctx.textAlign = "center";
  // ctx.fillText("You", player.screenX + tileSize / 2, player.screenY + tileSize - 6);

  // Draw Saboteur (Impostor)
  if (impostor && !impostor.isHidden) {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(
      impostor.screenX + tileSize / 2,
      impostor.screenY + tileSize / 2,
      tileSize / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    // Label "Saboteur"
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${tileSize * 0.35}px sans-serif`;
    ctx.textAlign = "center";
    // ctx.fillText("Saboteur", impostor.screenX + tileSize / 2, impostor.screenY + tileSize - 6);
  }
}

// ================================================================================= //
//                                 PLAYER LOGIC                                      //
// ================================================================================= //

/**
 * Handles manual directional input (keyboard), interrupting any automated movement.
 * @param {number} dx - The change in x-coordinate (-1, 0, or 1).
 * @param {number} dy - The change in y-coordinate (-1, 0, or 1).
 */
function handlePlayerInput(dx, dy) {
  if (isMoving || gameOver) return;
  playerTargetTile = null; // Cancel automated movement
  sounds.move.play();
  movePlayer(dx, dy);
}

/**
 * Processes automated movement towards the playerTargetTile.
 */
function processPathMovement() {
  if (isMoving || gameOver || !playerTargetTile) return;

  if (player.x === playerTargetTile.x && player.y === playerTargetTile.y) {
    playerTargetTile = null;
    return;
  }

  const path = bfs(player, playerTargetTile);
  if (path && path.length > 0) {
    const nextStep = path[0];
    const dx = nextStep.x - player.x;
    const dy = nextStep.y - player.y;
    sounds.move.play();
    movePlayer(dx, dy);
  } else {
    playerTargetTile = null;
  }
}

/**
 * Animates the player's movement from one tile to the next.
 * @param {number} dx - The change in x-coordinate.
 * @param {number} dy - The change in y-coordinate.
 */
function movePlayer(dx, dy) {
  const newX = player.x + dx;
  const newY = player.y + dy;
  if (!isWalkable(newX, newY)) {
    playerTargetTile = null; // Stop if we hit a wall
    return;
  }

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
      processPathMovement();
    }
  }
  requestAnimationFrame(animate);
}

/**
 * Checks for and handles player interaction with tasks or vents on the current tile.
 */
function checkPlayerInteraction() {
  const tile = tileMap[player.y][player.x];
  if (tile === "T") {
    // Player crosses normal task: do NOT remove, do NOT increment tasksCompleted
    // Optionally, you can play a sound or give feedback
    // sounds.task.play();
  } else if (tile === "R") {
    // Player crosses sabotaged (red) task: revert to normal
    const row = tileMap[player.y].split("");
    row[player.x] = "T";
    tileMap[player.y] = row.join("");
    sounds.task.play();
  } else if (tile === "V") {
    let level = parseInt(localStorage.getItem("level"), 10);
    if (level === 3) return;
    ventsSealed++;
    // document.getElementById("ventsCounter").textContent = `Vents Sealed: ${ventsSealed}`;
    sounds.seal.play();
    // Remove the vent from the map
    const row = tileMap[player.y].split("");
    row[player.x] = " ";
    tileMap[player.y] = row.join("");
  }
  // No removal for "T" or "R" tiles by player
}

// ================================================================================= //
//                                IMPOSTOR AI LOGIC                                  // ================================================================================= //

function findPatrolPoints() {
  const locations = [];
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (tileMap[y][x] === " ") {
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

// level up and down logics
function levelUp() {
  let level = parseInt(localStorage.getItem("level"), 10);
  if (level < moveDuration.length) {
    level++;
  }
  console.log("Current Level:", level);
  localStorage.setItem("level", level);
  document.getElementById("levelDisplay").innerText = `Level ${level}`;
  window.location.reload();
}

function levelDown() {
  let level = parseInt(localStorage.getItem("level"), 10);
  if (level > 1) {
    level--;
  }
  console.log("Current Level:", level);
  localStorage.setItem("level", level);
  document.getElementById("levelDisplay").innerText = `Level ${level}`;
  window.location.reload();
}

function moveImpostorAI() {
  if (isImpostorMoving || gameOver || !impostor) return;

  const distToPlayer = distance(impostor, player);
  const tasks = findAll("T");
  const vents = findAll("V");
  let path = null;
  let animationDuration = IMPOSTOR_MOVE_DURATION;
  const isFleeing =
    distToPlayer <= IMPOSTOR_FLEE_DISTANCE || tasks.length === 0;

  if (isFleeing) {
    animationDuration = IMPOSTOR_FLEE_ANIMATION_DURATION;
    if (vents.length > 0) {
      const bestVent = vents
        .map((vent) => ({
          vent,
          score: distance(impostor, vent) - distance(player, vent) * 1.5,
        }))
        .sort((a, b) => a.score - b.score)[0].vent;
      path = bfs(impostor, bestVent, player, IMPOSTOR_PATH_AVOID_DISTANCE);
    }
  } else {
    animationDuration = IMPOSTOR_MOVE_DURATION;
    const actionChance = Math.random();
    if (actionChance < IMPOSTOR_HUNT_CHANCE && tasks.length > 0) {
      let shortestPath = null;
      for (const task of tasks) {
        const p = bfs(impostor, task, player, IMPOSTOR_PATH_AVOID_DISTANCE);
        if (p && (!shortestPath || p.length < shortestPath.length)) {
          shortestPath = p;
        }
      }
      path = shortestPath;
    } else {
      const patrolPoints = findPatrolPoints();
      if (patrolPoints.length > 0) {
        const randomPoint =
          patrolPoints[Math.floor(Math.random() * patrolPoints.length)];
        path = bfs(impostor, randomPoint, player, IMPOSTOR_PATH_AVOID_DISTANCE);
      }
    }
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

  if (!path) {
    if (isFleeing) {
      const directions = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
      ];
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
        animateImpostorMove(
          bestPanicMove.x,
          bestPanicMove.y,
          animationDuration
        );
        return;
      }
    } else if (tasks.length > 0) {
      let shortestPath = null;
      for (const task of tasks) {
        const p = bfs(impostor, task, null, 0);
        if (p && (!shortestPath || p.length < shortestPath.length)) {
          shortestPath = p;
        }
      }
      path = shortestPath;
    }
  }

  clearInterval(impostorMoveInterval);
  const nextInterval = isFleeing ? 200 : IMPOSTOR_MOVE_INTERVAL;
  impostorMoveInterval = setInterval(moveImpostorAI, nextInterval);
  if (path && path.length > 0) {
    const nextStep = path[0];
    if (nextStep.x === player.x && nextStep.y === player.y) return;
    animateImpostorMove(nextStep.x, nextStep.y, animationDuration);
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
    // Impostor sabotages the task: turn it into a red task
    const row = tileMap[impostor.y].split("");
    row[impostor.x] = "R";
    tileMap[impostor.y] = row.join("");
    if (!window._impostorFirstSabotage) {
      window._impostorFirstSabotage = true;
    }
  }

  // --- MOVE THESE UP ---
  const allTasks = findAll("T");
  const allRedTasks = findAll("R");
  const allVents = findAll("V");
  const isOnVent = allVents.some(
    (v) => v.x === impostor.x && v.y === impostor.y
  );
  // ---------------------

  // VENT TELEPORT LOGIC
  if (isOnVent && !gameOver) {
    // Find all vents except the current one
    const otherVents = allVents.filter(v => v.x !== impostor.x || v.y !== impostor.y);
    if (otherVents.length > 0) {
      // Randomly pick another vent to teleport to
      const targetVent = otherVents[Math.floor(Math.random() * otherVents.length)];
      impostor.isHidden = true;
      drawGrid();
      setTimeout(() => {
        impostor.x = targetVent.x;
        impostor.y = targetVent.y;
        impostor.screenX = targetVent.x * tileSize;
        impostor.screenY = targetVent.y * tileSize;
        impostor.isHidden = false;
        drawGrid();
        checkGameEndConditions();
      }, IMPOSTOR_VENT_TELEPORT_DELAY);
    }
  }



  // If all tasks are sabotaged (red), impostor escapes
  if (allTasks.length === 0 && allRedTasks.length > 0 && isOnVent) {
    endGame("Impostor Escaped, YOU LOST!");
    return;
  }
}

function checkGameEndConditions() {
  if (gameOver || !impostor) return;
  if (player.x === impostor.x && player.y === impostor.y) {
    impostor = null;
    endGame("You caught the impostor! You Won!");
    return;
  }
}

// ================================================================================= //
//                            UTILITY & PATHFINDING                                  // ================================================================================= //

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

function bfs(start, goal, player, avoidDistance) {
  const queue = [{ x: start.x, y: start.y, path: [] }];
  const visited = new Set([`${start.x},${start.y}`]);
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];
  while (queue.length > 0) {
    const { x, y, path } = queue.shift();
    if (x === goal.x && y === goal.y) return path;
    for (const { dx, dy } of directions) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (
        player &&
        avoidDistance > 0 &&
        distance({ x: nx, y: ny }, player) <= avoidDistance
      ) {
        continue;
      }
      if (isWalkable(nx, ny) && !visited.has(key)) {
        visited.add(key);
        const newPath = [...path, { x: nx, y: ny }];
        queue.push({ x: nx, y: ny, path: newPath });
      }
    }
  }
  return null;
}

// ================================================================================= //
//                                EVENT LISTENERS                                    // ================================================================================= //

window.addEventListener("resize", resizeCanvas);

document.addEventListener("keydown", (e) => {
  if (gameOver) return;
  switch (e.key) {
    case "ArrowUp":
    case "w":
      handlePlayerInput(0, -1);
      break;
    case "ArrowDown":
    case "s":
      handlePlayerInput(0, 1);
      break;
    case "ArrowLeft":
    case "a":
      handlePlayerInput(-1, 0);
      break;
    case "ArrowRight":
    case "d":
      handlePlayerInput(1, 0);
      break;
  }
});

/**
 * Handles a click or touch on the canvas to set a movement target.
 * @param {MouseEvent|TouchEvent} event
 */
function handleCanvasInteraction(event) {
  if (gameOver || window.popupActive) return;
  event.preventDefault();

  const rect = canvas.getBoundingClientRect();
  let clientX, clientY;
  sounds.tap.currentTime = 0;
  IMPOSTOR_MOVE_DURATION = 90; // Base impostor animation speed
  IMPOSTOR_FLEE_ANIMATION_DURATION = 65;
  sounds.tap.play();
  if (event.touches) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = (clientX - rect.left) * scaleX;
  const canvasY = (clientY - rect.top) * scaleY;

  const gridX = Math.floor(canvasX / tileSize);
  const gridY = Math.floor(canvasY / tileSize);

  if (isWalkable(gridX, gridY)) {
    playerTargetTile = { x: gridX, y: gridY };
    if (!isMoving) {
      processPathMovement();
    }
  }
}

canvas.addEventListener("click", handleCanvasInteraction);
canvas.addEventListener("touchstart", handleCanvasInteraction, {
  passive: false,
});

// ================================================================================= //
//                            STORY INTRO INTEGRATION                              // ================================================================================= //

/**
 * This code checks if the player has arrived from the story intro page.
 * If so, it bypasses the rules overlay and starts the game immediately.
 */
document.addEventListener("DOMContentLoaded", () => {
  // Create a URLSearchParams object to easily read the URL's query string
  const params = new URLSearchParams(window.location.search);

  // Check if the 'from' parameter exists and is set to 'story'
  if (params.get("from") === "story") {
    const startOverlay = document.getElementById("start-overlay");
    const startButton = document.getElementById("start-button");

    // Hide the overlay immediately
    if (startOverlay) {
      startOverlay.style.display = "none";
    }

    // Trigger the game start logic directly, as if the button were clicked
    if (startButton) {
      // We can call the game start function directly for a smoother transition
      setupAndStartGame();
    }
  }
});

document.getElementById("start-button").addEventListener("click", () => {
  forceFullscreenPrompt();
});

// ================================================================================= //
//                                 GAME START                                        // ================================================================================= //

function setupAndStartGame() {
  document.body.classList.add("game-active");
  replayButton.style.display = "none";
  setup();
  // Show initial popups with improved English
  showPopup("Tap a location to move your character there.", 2200);

  // Track impostor's first sabotage
  window._impostorFirstSabotage = false;
  impostorMoveInterval = setInterval(moveImpostorAI, IMPOSTOR_MOVE_INTERVAL);
}
const startButton = document.getElementById("start-button");
const startOverlay = document.getElementById("start-overlay");
startButton.addEventListener(
  "click",
  async () => {
    sounds.move.play();
    startOverlay.style.display = "none";
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape");
      }
      setupAndStartGame();
    } catch (err) {
      console.log("Could not activate landscape/fullscreen mode:", err);
      
      setupAndStartGame();
    }
  },
  { once: true }
);

// pop up modal
let gamePlayedOnce = localStorage.getItem("oncePlayed");
function showPopup(message, duration = 500) {
  if (gamePlayedOnce === "true") return;
  document.getElementById("popup-message").textContent = message;
  const modal = document.getElementById("popup-modal");
  modal.style.display = "flex";
  window.popupActive = true;
  document.body.classList.add("popup-active");

  // Pause impostor movement while popup is active
  if (!gameOver) {
    clearInterval(impostorMoveInterval);
  }

  setTimeout(() => {
    window.popupActive = false;
    document.body.classList.remove("popup-active");
    // Resume impostor movement after popup closes
    if (!gameOver) {
      impostorMoveInterval = setInterval(
        moveImpostorAI,
        IMPOSTOR_MOVE_INTERVAL
      );
    }

    function resumeGame() {
      modal.style.display = "none";
      document.removeEventListener("mousedown", resumeGame);
      document.removeEventListener("touchstart", resumeGame);
    }
    document.addEventListener("mousedown", resumeGame);
    document.addEventListener("touchstart", resumeGame);
  }, duration);
}


//Window onload code. 
window.onload = () => {
  // Check if the game has been played before
  const level = parseInt(localStorage.getItem("level"), 10)
  document.getElementById("levelDisplay").innerText = `Level ${level}`;
}