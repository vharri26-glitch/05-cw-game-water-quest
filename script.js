// Game settings
const GAME_TIME = 60;
const COLA_CHANCE = 0.2;
const COLA_PENALTY = 2;

// Each level is a little faster and asks for a little more
const BASE_GOAL = 10;
const GOAL_STEP = 2;
const MAX_GOAL = 20;
const BASE_SPAWN_SPEED = 1500;
const SPEED_STEP = 150;
const MIN_SPAWN_SPEED = 700;

// Game state
let level = 1;
let levelCleared = false;
let score = 0;
let timeLeft = GAME_TIME;
let gameActive = false;
let selectedPlayer = null;
let currentItemType = null;
let currentSquare = null;
let turnCount = 0;
let spawnTimeout;
let timerInterval;

// Random winning messages
const winningMessages = [
  "Amazing work! You filled the bucket with clean water!",
  "You did it! Every bottle helped the beneficiary!",
  "Mission complete! You made every drop count!"
];

// Random losing messages
const losingMessages = [
  "Good effort! Try again and keep the clean water moving.",
  "Time is up, but the mission continues. Try again!",
  "Almost there! Reset the game and fill the bucket."
];

// Bucket stages
const bucketImages = [
  "img/EMPTY BUCKET.png",
  "img/1/A BIT FULL BUCKET.png",
  "img/1/HALF FULL BUCKET.png",
  "img/3/ALMOST FULL BUCKET.png",
  "img/FULL BUCKET.png"
];

const bucketNames = [
  "Empty water bucket",
  "Quarter-full water bucket",
  "Half-full water bucket",
  "Three-quarter-full water bucket",
  "Full water bucket"
];

// Find the HTML elements
const levelDisplay = document.getElementById("level");
const mainGirl = document.querySelector(".main-girl");
const celebrationSparkles = document.getElementById("celebration-sparkles");
const scoreDisplay = document.getElementById("current-cans");
const timerDisplay = document.getElementById("timer");
const achievementDisplay = document.getElementById("achievements");
const turnStatus = document.getElementById("turn-status");
const gameItem = document.getElementById("game-item");
const arrow = document.getElementById("direction-arrow");
const startButton = document.getElementById("start-game");
const resetButton = document.getElementById("reset-game");
const bucketImage = document.getElementById("bucket-image");
const bucketProgress = document.getElementById("bucket-progress");
const confettiContainer = document.getElementById("confetti");
const youLabel = document.getElementById("you-label");
const playerHint = document.getElementById("player-select-hint");
const playerButtons = document.querySelectorAll(".player-choice");
const courtPlayers = document.querySelectorAll(".court-player");
const court = document.getElementById("game-court");
const courtSquares = document.querySelectorAll(".court-square");

// Where the item appears in each of the four squares (index 0-3)
const squarePositions = [
  { left: 40, top: 30 },
  { left: 60, top: 30 },
  { left: 40, top: 72 },
  { left: 60, top: 72 }
];

// The three arrows inside AROWS.png
const arrowClasses = [
  "arrow-right",
  "arrow-left",
  "arrow-curve"
];

function getGoal() {
  return Math.min(MAX_GOAL, BASE_GOAL + (level - 1) * GOAL_STEP);
}

function getSpawnSpeed() {
  return Math.max(MIN_SPAWN_SPEED, BASE_SPAWN_SPEED - (level - 1) * SPEED_STEP);
}

// Short pause after a click, shrinking with the level
function getClickPause() {
  return Math.round(getSpawnSpeed() * 0.45);
}

// Update the score, timer, and bucket
function updateDisplay() {
  const goal = getGoal();

  levelDisplay.textContent = level;
  scoreDisplay.textContent = score;
  timerDisplay.textContent = timeLeft;

  bucketProgress.textContent =
    Math.min(score, goal) + " / " + goal + " bottles";

  updateBucket();
}

// Change the bucket picture as the score increases
function updateBucket() {
  const bucketStage = Math.min(
    bucketImages.length - 1,
    Math.floor((score / getGoal()) * (bucketImages.length - 1))
  );

  bucketImage.src = bucketImages[bucketStage];
  bucketImage.alt = bucketNames[bucketStage];
}

// Display feedback to the player
function showFeedback(message, type) {
  achievementDisplay.textContent = message;
  achievementDisplay.className = "achievement " + type;
}

// Display whose turn it is
function showTurnStatus(message, type) {
  turnStatus.textContent = message;
  turnStatus.className = "turn-status " + type;
}

// Mark one square as the active turn square (or none)
function highlightSquare(squareIndex) {
  courtSquares.forEach(function (square, index) {
    square.classList.toggle("active-turn", index === squareIndex);
  });
}

// Lock or unlock the player buttons
function setPlayerButtonsDisabled(disabled) {
  playerButtons.forEach(function (button) {
    button.disabled = disabled;
  });
}

// Choose which player the user controls
function selectPlayer(playerNumber) {
  if (gameActive) {
    return;
  }

  selectedPlayer = playerNumber;
  court.classList.remove("choose-mode");

  playerButtons.forEach(function (button) {
    const isSelected = Number(button.dataset.player) === playerNumber;

    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", isSelected);
  });

  courtPlayers.forEach(function (player, index) {
    player.classList.toggle("selected", index === playerNumber - 1);
  });

  youLabel.className = "you-label visible you-" + playerNumber;

  startButton.disabled = false;

  playerHint.textContent =
    "You are Player " + playerNumber + ". Press Start Game!";

  showTurnStatus(
    "You are Player " + playerNumber + " — press Start Game",
    "idle"
  );

  showFeedback(
    "Player " + playerNumber + " selected. Press Start Game when ready.",
    "good"
  );
}

// Remove the item, arrow, and square glow
function hideItem() {
  gameItem.className = "game-item";
  arrow.className = "direction-arrow";
  currentItemType = null;
  currentSquare = null;
  highlightSquare(-1);
}

// Wait, then show the next item
function scheduleNextItem(delay) {
  clearTimeout(spawnTimeout);
  spawnTimeout = setTimeout(spawnItem, delay);
}

// Pick the next square. Every second turn is the player's own square
// so the goal stays reachable; the others are random other squares.
function pickSquare() {
  const ownSquare = selectedPlayer - 1;
  turnCount = turnCount + 1;

  if (turnCount % 2 === 0) {
    return ownSquare;
  }

  const otherSquares = [0, 1, 2, 3].filter(function (index) {
    return index !== ownSquare;
  });

  return otherSquares[Math.floor(Math.random() * otherSquares.length)];
}

// Make a water bottle or cola can appear
function spawnItem() {
  if (!gameActive) {
    return;
  }

  const squareIndex = pickSquare();
  const position = squarePositions[squareIndex];
  const itemVariant = Math.floor(Math.random() * 3);
  const randomArrow = Math.floor(Math.random() * arrowClasses.length);

  currentSquare = squareIndex;
  currentItemType = Math.random() < COLA_CHANCE ? "cola" : "water";

  gameItem.className =
    "game-item visible " + currentItemType + "-item";

  gameItem.style.left = position.left + "%";
  gameItem.style.top = position.top + "%";

  /*
  WATER BOTTLES.png and COLA CANS.png each contain
  three pictures horizontally.

  0%, 50%, or 100% selects only one picture.
  */
  gameItem.style.backgroundPosition = itemVariant * 50 + "% center";

  gameItem.setAttribute(
    "aria-label",
    currentItemType === "water"
      ? "Collect water bottle"
      : "Avoid cola can"
  );

  arrow.className =
    "direction-arrow visible " + arrowClasses[randomArrow];

  const isMySquare = squareIndex === selectedPlayer - 1;

  if (currentItemType === "water" && isMySquare) {
    highlightSquare(squareIndex);
    showTurnStatus("YOUR TURN — CLICK NOW!", "your-turn");
  } else if (currentItemType === "cola" && isMySquare) {
    highlightSquare(-1);
    showTurnStatus("COLA CAN! DON'T CLICK!", "cola");
  } else {
    highlightSquare(-1);
    showTurnStatus("WAIT FOR YOUR TURN", "wait");
  }

  // The item stays until it is clicked or this turn ends
  scheduleNextItem(getSpawnSpeed());
}

// Run when the bottle or can is clicked
function collectItem(event) {
  event.stopPropagation();

  if (!gameActive || !currentItemType) {
    return;
  }

  if (currentItemType === "cola") {
    score = Math.max(0, score - COLA_PENALTY);

    showFeedback(
      "Oh no, cola! -" + COLA_PENALTY + " points",
      "penalty"
    );

    flashPenalty();
  } else if (currentSquare === selectedPlayer - 1) {
    score = score + 1;

    showFeedback(
      "Clean water collected! +1",
      "good"
    );
  } else {
    // Not the player's square: no points gained or lost
    showFeedback(
      "That bottle is not in your square. Wait for your turn!",
      "good"
    );

    return;
  }

  updateDisplay();
  hideItem();

  if (score >= getGoal()) {
    endGame();
    return;
  }

  showTurnStatus("WAIT FOR YOUR TURN", "wait");
  scheduleNextItem(getClickPause());
}

// Shake the score and turn banner when cola removes points
function flashPenalty() {
  [scoreDisplay.parentElement, turnStatus].forEach(function (element) {
    element.classList.remove("penalty-shake");
    void element.offsetWidth;
    element.classList.add("penalty-shake");
  });
}

// Make the main girl cheer, or stop
function setGirlCelebrating(celebrating) {
  mainGirl.classList.toggle("celebrating", celebrating);
  celebrationSparkles.classList.toggle("visible", celebrating);
}

// Start a new game
function startGame() {
  if (gameActive || selectedPlayer === null) {
    return;
  }

  clearTimeout(spawnTimeout);
  clearInterval(timerInterval);

  if (levelCleared) {
    level = level + 1;
    levelCleared = false;
  }

  score = 0;
  timeLeft = GAME_TIME;
  turnCount = 0;
  gameActive = true;

  startButton.disabled = true;
  startButton.textContent = "Level " + level + " Running";
  setPlayerButtonsDisabled(true);
  court.classList.add("game-running");

  confettiContainer.innerHTML = "";

  hideItem();
  setGirlCelebrating(false);
  updateDisplay();

  showFeedback(
    "Level " + level + ": collect " + getGoal() + " bottles! You are Player " +
      selectedPlayer + ". Click the bottle only in your square!",
    "good"
  );

  showTurnStatus("WAIT FOR YOUR TURN", "wait");

  // Short pause so the player can read the instructions
  scheduleNextItem(getClickPause());

  // Start the countdown timer
  timerInterval = setInterval(function () {
    timeLeft = timeLeft - 1;

    updateDisplay();

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

// End the game
function endGame() {
  gameActive = false;

  clearTimeout(spawnTimeout);
  clearInterval(timerInterval);

  hideItem();

  startButton.disabled = false;
  setPlayerButtonsDisabled(false);
  court.classList.remove("game-running");

  const playerWon = score >= getGoal();
  const messages = playerWon ? winningMessages : losingMessages;

  const randomMessage =
    messages[Math.floor(Math.random() * messages.length)];

  if (playerWon) {
    levelCleared = true;
    startButton.textContent = "Start Level " + (level + 1);

    showFeedback(
      "Level " + level + " complete! " + randomMessage +
        " Next level is faster!",
      "win"
    );

    showTurnStatus("LEVEL " + level + " COMPLETE!", "idle");
    setGirlCelebrating(true);
    createConfetti();
  } else {
    startButton.textContent = "Try Level " + level + " Again";

    showFeedback(
      randomMessage + " Final score: " + score + ".",
      "lose"
    );

    showTurnStatus("TIME'S UP!", "idle");
  }
}

// Reset the game
function resetGame() {
  gameActive = false;

  clearTimeout(spawnTimeout);
  clearInterval(timerInterval);

  score = 0;
  level = 1;
  levelCleared = false;
  timeLeft = GAME_TIME;
  turnCount = 0;

  hideItem();
  setGirlCelebrating(false);

  // Start stays locked until a player is chosen
  startButton.disabled = selectedPlayer === null;
  startButton.textContent = "Start Game";
  setPlayerButtonsDisabled(false);
  court.classList.remove("game-running");

  confettiContainer.innerHTML = "";

  updateDisplay();

  if (selectedPlayer === null) {
    showTurnStatus("Choose your player to begin", "idle");
  } else {
    showTurnStatus(
      "You are Player " + selectedPlayer + " — press Start Game",
      "idle"
    );
  }

  showFeedback(
    "Game reset. Press Start Game when ready.",
    "good"
  );
}

// Create the celebration
function createConfetti() {
  const colors = [
    "#ffc907",
    "#2e9df7",
    "#ffffff",
    "#1f1f1f"
  ];

  confettiContainer.innerHTML = "";

  for (let i = 0; i < 70; i = i + 1) {
    const piece = document.createElement("span");

    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDelay = Math.random() + "s";
    piece.style.animationDuration = 2 + Math.random() * 2 + "s";

    confettiContainer.appendChild(piece);
  }
}

// Button and game controls
playerButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    selectPlayer(Number(button.dataset.player));
  });
});

// Players on the court can be clicked too
courtPlayers.forEach(function (player, index) {
  player.addEventListener("click", function () {
    selectPlayer(index + 1);
  });
});

gameItem.addEventListener("click", collectItem);
startButton.addEventListener("click", startGame);
resetButton.addEventListener("click", resetGame);

// Display the starting score and bucket
updateDisplay();
