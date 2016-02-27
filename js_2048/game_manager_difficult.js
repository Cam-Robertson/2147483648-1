function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = 2;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
  if (this.size < 4)
  {
    var lasttileclass = Math.pow(2, (this.size * (this.size + 1))/2)
  }
  else
  {
    var lasttileclass = Math.pow(2, (this.size * (this.size + 1))/2 + 1)
  }

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (1>2) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;

    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in (hopefully) the worst position possible
GameManager.prototype.addTile = function () {
  if (this.grid.cellsAvailable()) {
    // var value = Math.random() < 0.9 ? 2 : 4;
    // var tile = new Tile(this.grid.randomAvailableCell(), value);
    // Strategy: place the new tile along the edge of the last direction the player pressed.
    // This forces the player to press a different direction.
    // Also, place the new tile next to the largest number possible.
    var vector = this.getVector(this.lastDirection);
    // Flip the direction
    vector.x *= -1;
    vector.y *= -1;

    // Build an array next available cells in the direction specified.
    var cellOptions = [];
    for (var i = 0; i < this.size; i++) {
      for (var j = 0; j < this.size; j++) {
        var cell = {x: 0, y: 0};
        if (vector.x == 1)
          cell.x = j;
        else if (vector.x == -1)
          cell.x = this.size - j - 1;
        else
          cell.x = i;
        if (vector.y == 1)
          cell.y = j;
        else if (vector.y == -1)
          cell.y = this.size - j - 1;
        else
          cell.y = i;

        if (this.grid.cellAvailable(cell)) {
          cellOptions.push(cell);
          break;
        }
      }
    }
    // Find the available cell with the best score
    var bestScore = 0;
    var bestInvalidScore = 0;
    var winners = [];
    var invalidWinner = null;
    //var maxTileValue = Math.pow(2, Math.min(this.size * this.size, 32));
    for (i = 0; i < cellOptions.length; i++) {
      // Look at the surrounding cells
      //var minValue = maxTileValue;
      var score = 0;
      var valid_2 = true;
      var valid_4 = true;
      var scored = false;
      for (var direction = 0; direction < 4; direction++) {
        var adjVector = this.getVector(direction);
        var adjCell = {
          x: cellOptions[i].x + adjVector.x,
          y: cellOptions[i].y + adjVector.y
        };
        var adjTile = this.grid.cellContent(adjCell);
        if (adjTile) {
          score = Math.max(score, adjTile.value);
          scored = true;
          if (adjTile.value == 1)
            valid_2 = false;
          else if (adjTile.value == 2)
            valid_4 = false;
        }
      }
      if (!scored) {
        score = 0;
      }
      var valid = valid_2 || valid_4;
      if (score >= bestScore) {
        if (valid) {
          if (score > bestScore) {
            winners = [];
            bestScore = score;
          }
          winners.push(new Tile(cellOptions[i], valid_2 ? 1 : 2));
        } else if (winners.length == 0 && score >= bestInvalidScore) { // Invalid but no winner yet
          invalidWinner = new Tile(cellOptions[i], 2);
          bestInvalidScore = score;
        }
      }
    }
    if (winners.length) {
      var winnerIndex = Math.floor(Math.random() * winners.length);
      //var value = (adjacent4 || bestScore != 2 ? 2 : 4);
      //var tile = new Tile(winners[winnerIndex], value);
      //this.grid.insertTile(tile);
      this.grid.insertTile(winners[winnerIndex]);
    } else {
      this.grid.insertTile(invalidWinner);
    }
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.isGameTerminated()
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += Math.round(Math.random() * 2048) + merged.value * merged.value;

          // The mighty 2048 tile
          if (merged.value === Goal) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
