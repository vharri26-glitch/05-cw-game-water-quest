// Game settings
const GAME_TIME = 45;
const TIME_STEP = 5;
const MIN_GAME_TIME = 40;
const COLA_CHANCE = 0.15;
const COLA_PENALTY = 2;

// Each level is a little faster and asks for a little more
const BASE_GOAL = 8;
const GOAL_EVERY = 2; // goal grows by 1 every 2 levels
const MAX_GOAL = 16;
const BASE_SPAWN_SPEED = 1500;
const SPEED_STEP = 100;
const MIN_SPAWN_SPEED = 800;

// Game state
let level = 1;
let levelCleared = false;
let score = 0;
let timeLeft = GAME_TIME;
let gameActive = false;
let selectedPlayer = null;
let activeItems = [];
const itemPool = [];
let turnCount = 0;
let spawnTimeout;
let timerInterval;
let playerAnimationTimeout;
let animatedPlayer = null;

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
const bucketWaterLevel = document.getElementById("bucket-water-level");
const gameItem = document.getElementById("game-item");
itemPool.push(gameItem);
const arrow = document.getElementById("direction-arrow");
const startButton = document.getElementById("start-game");
const resetButton = document.getElementById("reset-game");
const bucketImage = document.getElementById("bucket-image");
const bucketProgress = document.getElementById("bucket-progress");
const confettiContainer = document.getElementById("confetti");
const youLabel = document.getElementById("you-label");
const courtPlayers = document.querySelectorAll(".court-player");
const court = document.getElementById("game-court");
const courtSquares = document.querySelectorAll(".court-square");

// The three arrows inside AROWS.png
const arrowClasses = [
  "arrow-right",
  "arrow-left",
  "arrow-curve"
];

function getGoal() {
  return Math.min(MAX_GOAL, BASE_GOAL + Math.floor((level - 1) / GOAL_EVERY));
}

// Each level gives less time
function getGameTime() {
  return Math.max(MIN_GAME_TIME, GAME_TIME - (level - 1) * TIME_STEP);
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
  updateLegend();
}

// Show only this level's bad item in the legend
function updateLegend() {
  const shown = level <= badItemByLevel.length ? badItemByLevel[level - 1] : "all";

  ["cola", "gas", "orange", "red"].forEach(function (type) {
    document.getElementById("legend-" + type).hidden =
      shown !== "all" && shown !== type;
  });
}

// Change the bucket picture as the score increases
function updateBucket() {
  const bucketStage = Math.min(
    bucketImages.length - 1,
    Math.floor((score / getGoal()) * (bucketImages.length - 1))
  );

  // Water level rises a little with every bottle
  bucketWaterLevel.style.height =
    Math.min(100, (score / getGoal()) * 100) + "%";

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

// Play one row of the selected player's four-frame sprite sheet.
function playPlayerAnimation(row, holdFinalFrame) {
  if (selectedPlayer === null) {
    return;
  }

  resetPlayerSprite();
  animatedPlayer = courtPlayers[selectedPlayer - 1];

  let frame = 0;

  function showNextFrame() {
    const columnPosition = (frame / 3) * 100;
    const rowPosition = (row / 2) * 100;

    animatedPlayer.style.backgroundPosition =
      columnPosition + "% " + rowPosition + "%";

    if (frame === 3) {
      if (holdFinalFrame) {
        return;
      }

      playerAnimationTimeout = setTimeout(function () {
        resetPlayerSprite();
      }, frameDuration);
      return;
    }

    frame += 1;
    playerAnimationTimeout = setTimeout(showNextFrame, frameDuration);
  }

  const frameDuration = selectedPlayer === 4 ? 150 : 120;
  showNextFrame();
}

function resetPlayerSprite() {
  clearTimeout(playerAnimationTimeout);
  if (animatedPlayer) {
    animatedPlayer.style.backgroundPosition = "0 0";
    animatedPlayer = null;
  }
}

// Choose which player the user controls
function selectPlayer(playerNumber) {
  if (gameActive) {
    return;
  }

  resetPlayerSprite();
  selectedPlayer = playerNumber;
  court.classList.remove("choose-mode");

  courtPlayers.forEach(function (player, index) {
    const isSelected = index === playerNumber - 1;

    player.classList.toggle("selected", isSelected);
    player.setAttribute("aria-pressed", isSelected);
  });

  youLabel.className = "you-label visible you-" + playerNumber;

  startButton.disabled = false;

  showTurnStatus("Player " + playerNumber + " selected.", "idle");
}

// Remove every item, the arrow, and the square glow
function hideItem() {
  itemPool.forEach(function (el) {
    el.className = "game-item";
  });
  activeItems = [];
  arrow.className = "direction-arrow";
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

const badItemInfo = {
  cola: { label: "dirty water" },
  gas: { label: "gas can" },
  orange: { label: "orange soda" },
  red: { label: "red soda" }
};

// One bad item per level: dirty water, gas can, orange soda, red soda.
// After level 4 it is picked at random from all of them.
const badItemByLevel = ["cola", "gas", "orange", "red"];

function getBadType() {
  if (level <= badItemByLevel.length) {
    return badItemByLevel[level - 1];
  }

  return badItemByLevel[Math.floor(Math.random() * badItemByLevel.length)];
}

// Get a reusable item button (the first one is the original in the HTML)
function getItemElement(index) {
  while (itemPool.length <= index) {
    const clone = gameItem.cloneNode(false);
    clone.removeAttribute("id");
    clone.className = "game-item";
    clone.addEventListener("click", collectItem);
    court.appendChild(clone);
    itemPool.push(clone);
  }

  return itemPool[index];
}

// Show one item (water or a bad item) inside a square
function placeItem(index, type, squareIndex) {
  const el = getItemElement(index);
  // Random spot inside the square so items keep moving around
  el.style.left = (squareIndex % 2) * 50 + 17 + Math.random() * 16 + "%";
  el.style.top = Math.floor(squareIndex / 2) * 50 + 17 + Math.random() * 16 + "%";

  el.className = "game-item visible " + type + "-item";


  el.setAttribute(
    "aria-label",
    type === "water" ? "Collect water bottle" : "Avoid " + badItemInfo[type].label
  );

  activeItems.push({ el: el, type: type, square: squareIndex });
}

// Make the items for this turn appear
function spawnItem() {
  if (!gameActive) {
    return;
  }

  hideItem();

  const waterSquare = pickSquare();
  const randomArrow = Math.floor(Math.random() * arrowClasses.length);

  placeItem(0, Math.random() < COLA_CHANCE ? getBadType() : "water", waterSquare);

  arrow.className =
    "direction-arrow visible " + arrowClasses[randomArrow];

  const myIndex = selectedPlayer - 1;
  const mine = activeItems.find(function (item) {
    return item.square === myIndex;
  });

  if (mine && mine.type === "water") {
    playPlayerAnimation(0);
    highlightSquare(myIndex);
    showTurnStatus("YOUR TURN — CLICK NOW!", "your-turn");
  } else if (mine) {
    highlightSquare(-1);
    showTurnStatus(
      mine.type === "cola" ? "DIRTY WATER! DON'T CLICK!" : "NOT WATER! DON'T CLICK!",
      "cola"
    );
  } else {
    highlightSquare(-1);
    showTurnStatus("WAIT FOR YOUR TURN", "wait");
  }

  // The items stay until one is clicked or this turn ends
  scheduleNextItem(getSpawnSpeed());
}

// Run when an item is clicked
function collectItem(event) {
  event.stopPropagation();

  const item = activeItems.find(function (entry) {
    return entry.el === event.currentTarget;
  });

  if (!gameActive || !item) {
    return;
  }

  if (item.type !== "water") {
    score = Math.max(0, score - COLA_PENALTY);
    playPlayerAnimation(1);

    showFeedback(
      "Oh no, " + "the " + badItemInfo[item.type].label +
        " is not water! -" + COLA_PENALTY + " points",
      "penalty"
    );

    flashPenalty();
  } else if (item.square === selectedPlayer - 1) {
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
  timeLeft = getGameTime();
  turnCount = 0;
  gameActive = true;

  startButton.disabled = true;
  startButton.textContent = "Level " + level + " Running";
  court.classList.add("game-running");

  confettiContainer.innerHTML = "";

  hideItem();
  setGirlCelebrating(false);
  resetPlayerSprite();
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
  court.classList.remove("game-running");

  const playerWon = score >= getGoal();
  const messages = playerWon ? winningMessages : losingMessages;

  const randomMessage =
    messages[Math.floor(Math.random() * messages.length)];

  if (playerWon) {
    levelCleared = true;
    startButton.textContent = "Start Level " + (level + 1);
    playPlayerAnimation(2, selectedPlayer === 4);

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
  timeLeft = getGameTime();
  turnCount = 0;

  hideItem();
  setGirlCelebrating(false);
  resetPlayerSprite();

  // Start stays locked until a player is selected
  startButton.disabled = selectedPlayer === null;
  startButton.textContent = "Start Game";
  court.classList.remove("game-running");

  confettiContainer.innerHTML = "";

  updateDisplay();

  if (selectedPlayer === null) {
    showTurnStatus("", "idle");
  } else {
    showTurnStatus("Player " + selectedPlayer + " selected.", "idle");
  }

  showFeedback("Game reset.", "good");
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

// Players on the court are the only way to choose a character
courtPlayers.forEach(function (player, index) {
  player.addEventListener("click", function () {
    selectPlayer(index + 1);
  });

  if (player.tagName !== "BUTTON") {
    player.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectPlayer(index + 1);
      }
    });
  }
});

gameItem.addEventListener("click", collectItem);
startButton.addEventListener("click", startGame);
resetButton.addEventListener("click", resetGame);

// Display the starting score and bucket
updateDisplay();
