// Game settings
const LEVEL_SETTINGS = [
  { buckets: 5, seconds: 60 },
  { buckets: 8, seconds: 75 },
  { buckets: 12, seconds: 90 },
  { buckets: 16, seconds: 105 },
  { buckets: 20, seconds: 120 }
];
const CATCHES_PER_BUCKET = 3;
const COLA_CHANCE = 0.15;
const COLA_PENALTY = 2;

const BASE_SPAWN_SPEED = 1500;
const SPEED_STEP = 100;
const MIN_SPAWN_SPEED = 800;
const PLAYER_FRAME_DURATIONS = [180, 130, 130, 220];
const PLAYER_FRAME_POSITIONS = ["0%", "33.333%", "66.667%", "100%"];
const BUCKET_SPRITE_FRAME_INTERVAL = 150;
const SCENE_ART_ASSETS = [
  "img/MAIN-GIRL-SPRITE.png",
  "img/MAIN-GIRL-SHOULDER-SPRITE.png",
  "img/WATER-DROP-BUCKET-SPRITE.png"
];
const SCENE_FRAME_INTERVAL = 600;
const SCENE_IDLE_HOLD_TICKS = Math.ceil(5000 / SCENE_FRAME_INTERVAL);
const SCENE_ROTATION_INTERVAL = 20000;

// Game state
let level = 1;
let levelCleared = false;
let score = 0;
let timeLeft = LEVEL_SETTINGS[0].seconds;
let gameActive = false;
let selectedPlayer = null;
let currentBucketCatches = 0;
let completedBuckets = 0;
let renderedCompletedBuckets = -1;
let activeItems = [];
const itemPool = [];
let turnCount = 0;
let spawnTimeout;
let timerInterval;
const playerAnimationTimeouts = [null, null, null, null];
let bucketSidekickAnimating = false;
let bucketSpriteAnimationInterval;
let gameArtLoaded = false;
let sceneRotationInterval;
let sceneFrameInterval;
let currentScene = 0;
let currentSceneFrame = 0;
let sceneAnimationMode = "idle";
let idleHoldTicks = 0;

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

// Empty, 1/3-full, and 2/3-full active bucket images.
const bucketImages = [
  "img/EMPTY BUCKET.png",
  "img/1/A BIT FULL BUCKET.png",
  "img/3/ALMOST FULL BUCKET.png"
];

const bucketNames = [
  "Empty water bucket",
  "Water bucket one-third full",
  "Water bucket two-thirds full"
];

// Find the HTML elements
const levelDisplay = document.getElementById("level");
const mainGirl = document.getElementById("main-girl-sprite");
const celebrationSparkles = document.getElementById("celebration-sparkles");
const scoreDisplay = document.getElementById("current-cans");
const timerDisplay = document.getElementById("timer");
const achievementDisplay = document.getElementById("achievements");
const turnStatus = document.getElementById("turn-status");
const gameItem = document.getElementById("game-item");
itemPool.push(gameItem);
const arrow = document.getElementById("direction-arrow");
const startButton = document.getElementById("start-game");
const resetButton = document.getElementById("reset-game");
const bucketImage = document.getElementById("bucket-image");
const completedBucketsDisplay = document.getElementById("completed-buckets-count");
const bucketGoalDisplay = document.getElementById("bucket-goal");
const currentBucketDisplay = document.getElementById("current-bucket-progress");
const completedBucketsContainer = document.getElementById("completed-buckets");
const beneficiaryDisplay = document.getElementById("beneficiary-display");
const shoulderGirlSprite = document.getElementById("shoulder-girl-sprite");
const mainGirlScene = document.getElementById("girl-main-scene");
const shoulderGirlScene = document.getElementById("girl-shoulder-scene");
const waterDropBucketSprite = document.getElementById("water-drop-bucket-sprite");
const gameArtLoading = document.getElementById("game-art-loading");
const confettiContainer = document.getElementById("confetti");
const youLabel = document.getElementById("you-label");
const courtPlayers = document.querySelectorAll(".court-player");
const court = document.getElementById("game-court");
const courtSquares = document.querySelectorAll(".court-square");
const timeBackgroundLayers = [
  document.getElementById("time-background-a"),
  document.getElementById("time-background-b")
];
const truckPickup = document.getElementById("truck-pickup");
const truckCountdown = document.getElementById("truck-countdown");
const truckIcon = document.getElementById("truck-icon");

// The three arrows inside AROWS.png
const arrowClasses = [
  "arrow-right",
  "arrow-left",
  "arrow-curve"
];

function getGoal() {
  return getLevelSettings().buckets;
}

function getGameTime() {
  return getLevelSettings().seconds;
}

function getLevelSettings() {
  return LEVEL_SETTINGS[Math.min(level - 1, LEVEL_SETTINGS.length - 1)];
}

function getSpawnSpeed() {
  return Math.max(MIN_SPAWN_SPEED, BASE_SPAWN_SPEED - (level - 1) * SPEED_STEP);
}

// Short pause after a click, shrinking with the level
function getClickPause() {
  return Math.round(getSpawnSpeed() * 0.45);
}

function setSpriteFrame(sprite, frame) {
  const column = frame % 4;
  const row = Math.floor(frame / 4);
  sprite.style.backgroundPosition =
    (column * 100 / 3) + "% " + (row * 50) + "%";
}

function setScene(sceneIndex) {
  const sceneChanged = currentScene !== sceneIndex;
  currentScene = sceneIndex;
  mainGirlScene.classList.toggle("active", sceneIndex !== 1);
  shoulderGirlScene.classList.toggle("active", sceneIndex === 1);
  waterDropBucketSprite.classList.toggle("active", sceneIndex === 2);
  if (sceneChanged) {
    sceneAnimationMode = "idle";
    currentSceneFrame = 0;
    idleHoldTicks = 0;
    setSpriteFrame(getActiveGirlSprite(), 0);
  }
  if (sceneIndex === 2 && !bucketSidekickAnimating) {
    positionWaterDropAtGirl(false);
  }
}

function positionWaterDropAtGirl(animate) {
  const parentRect = completedBucketsContainer.parentElement.getBoundingClientRect();
  const girlRect = document.querySelector(".girl-scene-stage").getBoundingClientRect();
  const x = girlRect.left - parentRect.left + girlRect.width * 0.66 - 24;
  const y = girlRect.top - parentRect.top + girlRect.height * 0.18 - 24;
  waterDropBucketSprite.style.transition = animate
    ? "transform 650ms cubic-bezier(0.2, 0.75, 0.3, 1)"
    : "none";
  waterDropBucketSprite.style.transform = "translate3d(" + x + "px, " + y + "px, 0)";
}

function moveWaterDropToBucket(bucket) {
  waterDropBucketSprite.style.transition =
    "transform 650ms cubic-bezier(0.2, 0.75, 0.3, 1)";
  requestAnimationFrame(function () {
    const parentRect = completedBucketsContainer.parentElement.getBoundingClientRect();
    const bucketRect = bucket.getBoundingClientRect();
    const x = bucketRect.left - parentRect.left + bucketRect.width / 2 - 24;
    const y = bucketRect.top - parentRect.top + bucketRect.height / 2 - 24;
    waterDropBucketSprite.style.transform =
      "translate3d(" + x + "px, " + y + "px, 0)";
  });
}

function getActiveGirlSprite() {
  return currentScene === 1 ? shoulderGirlSprite : mainGirl;
}

function tickSceneSprites() {
  const activeGirlSprite = getActiveGirlSprite();

  if (sceneAnimationMode === "idle") {
    if (idleHoldTicks > 0) {
      idleHoldTicks -= 1;
      return;
    }

    setSpriteFrame(activeGirlSprite, currentSceneFrame);
    currentSceneFrame += 1;
    if (currentSceneFrame >= 4) {
      currentSceneFrame = 0;
      idleHoldTicks = SCENE_IDLE_HOLD_TICKS;
      setSpriteFrame(activeGirlSprite, 0);
    }
    return;
  }

  if (sceneAnimationMode === "encouraging" || sceneAnimationMode === "girlCelebrating") {
    const firstFrame = sceneAnimationMode === "encouraging" ? 4 : 8;
    setSpriteFrame(activeGirlSprite, firstFrame + currentSceneFrame);
    currentSceneFrame += 1;
    if (currentSceneFrame >= 4) {
      sceneAnimationMode = "idle";
      currentSceneFrame = 0;
      idleHoldTicks = SCENE_IDLE_HOLD_TICKS;
      setSpriteFrame(activeGirlSprite, 0);
    }
  }
}

function playGirlEncouragement() {
  if (sceneAnimationMode !== "idle") {
    return;
  }

  sceneAnimationMode = "encouraging";
  currentSceneFrame = 1;
  idleHoldTicks = 0;
  setSpriteFrame(getActiveGirlSprite(), 4);
}

function playBucketCelebration(bucketNumber) {
  const completedBucket = completedBucketsContainer.children[bucketNumber - 1];
  if (!completedBucket) {
    console.error("Could not find completed bucket " + bucketNumber + " for sprite celebration.");
    return;
  }

  completedBucketsContainer
    .querySelectorAll(".bucket-celebrating")
    .forEach(function (bucket) {
      bucket.classList.remove("bucket-celebrating");
    });

  setScene(2);
  completedBucket.classList.add("bucket-celebrating");
  bucketSidekickAnimating = true;
  sceneAnimationMode = "girlCelebrating";
  currentSceneFrame = 1;
  idleHoldTicks = 0;
  setSpriteFrame(mainGirl, 8);
  setSpriteFrame(waterDropBucketSprite, 0);
  moveWaterDropToBucket(completedBucket);

  clearInterval(bucketSpriteAnimationInterval);
  let bucketFrame = 0;
  bucketSpriteAnimationInterval = setInterval(function () {
    bucketFrame += 1;
    if (bucketFrame >= 12) {
      clearInterval(bucketSpriteAnimationInterval);
      bucketSpriteAnimationInterval = null;
      bucketSidekickAnimating = false;
      setSpriteFrame(waterDropBucketSprite, 0);
      completedBucket.classList.remove("bucket-celebrating");
      positionWaterDropAtGirl(true);
      return;
    }
    setSpriteFrame(waterDropBucketSprite, bucketFrame);
  }, BUCKET_SPRITE_FRAME_INTERVAL);
}

function playWinningGirlAnimation() {
  setScene(2);
  sceneAnimationMode = "girlCelebrating";
  currentSceneFrame = 1;
  idleHoldTicks = 0;
  setSpriteFrame(mainGirl, 8);
  courtPlayers.forEach(function (player, playerIndex) {
    playPlayerAnimation(playerIndex, 2);
  });
}

function resetDecorativeAnimations() {
  clearInterval(bucketSpriteAnimationInterval);
  bucketSpriteAnimationInterval = null;
  bucketSidekickAnimating = false;
  sceneAnimationMode = "idle";
  currentSceneFrame = 0;
  idleHoldTicks = 0;
  setSpriteFrame(waterDropBucketSprite, 0);
  if (currentScene === 2) {
    positionWaterDropAtGirl(false);
  }
  completedBucketsContainer
    .querySelectorAll(".bucket-celebrating")
    .forEach(function (bucket) {
      bucket.classList.remove("bucket-celebrating");
    });
}

function initializeSceneArt() {
  const loadPromises = SCENE_ART_ASSETS.map(function (assetPath) {
    return new Promise(function (resolve) {
      const image = new Image();
      image.onload = function () {
        resolve(true);
      };
      image.onerror = function () {
        console.error("Failed to load game art: " + assetPath);
        resolve(false);
      };
      image.src = assetPath;
    });
  });

  Promise.all(loadPromises).then(function (results) {
    gameArtLoaded = true;
    if (results.some(function (loaded) { return !loaded; })) {
      gameArtLoading.textContent =
        "Some game art could not load. Check the browser console; you can still play.";
      gameArtLoading.hidden = false;
    } else {
      gameArtLoading.hidden = true;
    }

    setScene(0);
    sceneFrameInterval = setInterval(tickSceneSprites, SCENE_FRAME_INTERVAL);
    sceneRotationInterval = setInterval(function () {
      if (sceneAnimationMode !== "idle") {
        return;
      }
      setScene((currentScene + 1) % 3);
    }, SCENE_ROTATION_INTERVAL);
    startButton.disabled = selectedPlayer === null;
  });
}

// Update the score, timer, and bucket
function updateDisplay() {
  levelDisplay.textContent = level;
  scoreDisplay.textContent = score;
  timerDisplay.textContent = timeLeft;
  completedBucketsDisplay.textContent = completedBuckets;
  bucketGoalDisplay.textContent = getGoal();
  currentBucketDisplay.textContent = currentBucketCatches;

  updateBucket();
  updateCompletedBuckets();
  updateLegend();
}

function updateCompletedBuckets() {
  if (renderedCompletedBuckets === completedBuckets) {
    return;
  }

  completedBucketsContainer.replaceChildren();
  for (let bucketNumber = 1; bucketNumber <= completedBuckets; bucketNumber += 1) {
    const bucket = document.createElement("img");
    bucket.className = "completed-bucket";
    bucket.src = "img/FULL BUCKET.png";
    bucket.alt = "Completed full water bucket " + bucketNumber;
    bucket.dataset.bucketNumber = bucketNumber;
    completedBucketsContainer.appendChild(bucket);
  }

  renderedCompletedBuckets = completedBuckets;
}

// Show only this level's bad item in the legend
function updateLegend() {
  const shown = level <= badItemByLevel.length ? badItemByLevel[level - 1] : "all";

  ["cola", "gas", "orange", "red"].forEach(function (type) {
    document.getElementById("legend-" + type).hidden =
      shown !== "all" && shown !== type;
  });
}

// Show the active bucket's empty, one-third, or two-thirds stage.
function updateBucket() {
  const bucketStage = Math.min(currentBucketCatches, bucketImages.length - 1);

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

// Player indices are zero-based and match the court's four buttons.
function playPlayerAnimation(playerIndex, row) {
  const player = courtPlayers[playerIndex];
  if (!player || row < 0 || row > 2) {
    return;
  }

  resetPlayerSprite(playerIndex);
  player.classList.add("is-animating");

  let frame = 0;

  function showFrame() {
    player.style.backgroundPosition =
      PLAYER_FRAME_POSITIONS[frame] + " " + (row * 50) + "%";

    if (frame >= PLAYER_FRAME_POSITIONS.length - 1) {
      playerAnimationTimeouts[playerIndex] = setTimeout(function () {
        resetPlayerSprite(playerIndex);
      }, PLAYER_FRAME_DURATIONS[frame]);
      return;
    }

    frame += 1;
    playerAnimationTimeouts[playerIndex] = setTimeout(showFrame, PLAYER_FRAME_DURATIONS[frame - 1]);
  }

  showFrame();
}

function resetPlayerSprite(playerIndex) {
  const indices = Number.isInteger(playerIndex)
    ? [playerIndex]
    : courtPlayers.map(function (_, index) {
      return index;
    });

  indices.forEach(function (index) {
    const player = courtPlayers[index];
    if (!player) {
      return;
    }

    clearTimeout(playerAnimationTimeouts[index]);
    playerAnimationTimeouts[index] = null;
    player.style.backgroundPosition = "0% 0%";
    player.classList.remove("is-animating");
  });
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

  startButton.disabled = selectedPlayer === null;

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

  const itemType = Math.random() < COLA_CHANCE ? getBadType() : "water";
  placeItem(0, itemType, waterSquare);
  playPlayerAnimation(waterSquare, 0);

  arrow.className =
    "direction-arrow visible " + arrowClasses[randomArrow];

  const myIndex = selectedPlayer - 1;
  const mine = activeItems.find(function (item) {
    return item.square === myIndex;
  });

  if (mine && mine.type === "water") {
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

  let completedBucket = false;

  if (item.type !== "water") {
    score = Math.max(0, score - COLA_PENALTY);
    currentBucketCatches = Math.max(0, currentBucketCatches - 1);
    playPlayerAnimation(selectedPlayer - 1, 1);

    showFeedback(
      "Oh no, " + "the " + badItemInfo[item.type].label +
        " is not water! -" + COLA_PENALTY + " points",
      "penalty"
    );

    flashPenalty();
  } else if (item.square === selectedPlayer - 1) {
    score = score + 1;
    currentBucketCatches += 1;
    playGirlEncouragement();

    if (currentBucketCatches === CATCHES_PER_BUCKET) {
      completedBuckets += 1;
      currentBucketCatches = 0;
      completedBucket = true;
    }

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
  if (completedBucket) {
    playBucketCelebration(completedBuckets);
  }
  hideItem();

  if (completedBuckets >= getGoal()) {
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

  resetDecorativeAnimations();
  score = 0;
  completedBuckets = 0;
  currentBucketCatches = 0;
  renderedCompletedBuckets = -1;
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
    "Level " + level + ": fill " + getGoal() + " buckets in " + getGameTime() +
      " seconds. You are Player " + selectedPlayer +
      ". Catch water only in your square!",
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

  startButton.disabled = selectedPlayer === null;
  court.classList.remove("game-running");

  const playerWon = completedBuckets >= getGoal();
  const messages = playerWon ? winningMessages : losingMessages;

  const randomMessage =
    messages[Math.floor(Math.random() * messages.length)];

  if (playerWon) {
    levelCleared = true;
    startButton.textContent = "Start Level " + (level + 1);
    playWinningGirlAnimation();

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
  completedBuckets = 0;
  currentBucketCatches = 0;
  renderedCompletedBuckets = -1;
  resetDecorativeAnimations();

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

function getBackgroundPeriod(hour) {
  if (hour >= 5 && hour < 8) {
    return "dawn";
  }
  if (hour >= 8 && hour < 12) {
    return "morning";
  }
  if (hour >= 12 && hour < 16) {
    return "afternoon";
  }
  if (hour >= 16 && hour < 19) {
    return "sunset";
  }
  return "night";
}

let activeBackgroundIndex = -1;
let activeBackgroundPeriod = "";

function updateTimeOfDayBackground() {
  const period = getBackgroundPeriod(new Date().getHours());
  if (period === activeBackgroundPeriod) {
    return;
  }

  const nextIndex = activeBackgroundIndex === 0 ? 1 : 0;
  const nextLayer = timeBackgroundLayers[nextIndex];
  const oldLayer = timeBackgroundLayers[activeBackgroundIndex];
  const imageName = "four-for-water-" + period + ".png";

  nextLayer.style.backgroundImage = 'url("img/' + imageName + '")';
  nextLayer.classList.add("active");
  if (oldLayer) {
    oldLayer.classList.remove("active");
  }

  activeBackgroundIndex = nextIndex;
  activeBackgroundPeriod = period;
}

function updateTruckPickupCountdown() {
  const now = new Date();
  const pickup = new Date(now);
  pickup.setHours(19, 0, 0, 0);

  if (now >= pickup) {
    pickup.setDate(pickup.getDate() + 1);
  }

  const secondsRemaining = Math.max(0, Math.floor((pickup - now) / 1000));
  const hours = String(Math.floor(secondsRemaining / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, "0");
  const seconds = String(secondsRemaining % 60).padStart(2, "0");

  truckCountdown.textContent = hours + ":" + minutes + ":" + seconds;
  truckCountdown.dateTime = "PT" + hours + "H" + minutes + "M" + seconds + "S";
  truckPickup.classList.toggle("urgent", secondsRemaining <= 30 * 60);
}

let truckAnimationInterval;

function animateTruckSprite() {
  let frame = 0;
  truckIcon.style.backgroundPosition = "0% 0%";
  clearInterval(truckAnimationInterval);
  truckAnimationInterval = setInterval(function () {
    frame = (frame + 1) % 12;
    const column = frame % 4;
    const row = Math.floor(frame / 4);
    truckIcon.style.backgroundPosition =
      (column * 100 / 3) + "% " + (row * 50) + "%";
  }, 130);
}

// Delegate selection so every court player remains selectable above its overlays.
court.addEventListener("click", function (event) {
  const player = event.target.closest(".court-player");
  if (!player || !court.contains(player)) {
    return;
  }

  const playerIndex = Array.prototype.indexOf.call(courtPlayers, player);
  if (playerIndex !== -1) {
    selectPlayer(playerIndex + 1);
  }
});

court.addEventListener("keydown", function (event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const player = event.target.closest(".court-player");
  if (!player || !court.contains(player)) {
    return;
  }

  const playerIndex = Array.prototype.indexOf.call(courtPlayers, player);
  if (playerIndex !== -1) {
    event.preventDefault();
    selectPlayer(playerIndex + 1);
  }
});

gameItem.addEventListener("click", collectItem);
startButton.addEventListener("click", startGame);
resetButton.addEventListener("click", resetGame);

updateTimeOfDayBackground();
setInterval(updateTimeOfDayBackground, 60 * 1000);
updateTruckPickupCountdown();
setInterval(updateTruckPickupCountdown, 1000);
animateTruckSprite();

// Display the starting score and bucket
updateDisplay();
initializeSceneArt();
