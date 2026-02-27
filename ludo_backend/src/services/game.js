/**
 * Game Service
 * 
 * Implements the complete Ludo game logic with SQLite persistence.
 * Matches the frontend's gameEngine.js logic for consistency.
 * 
 * Classic Ludo Rules:
 * - 2-4 players, each with 4 tokens
 * - Roll 6 to leave base
 * - Capture opponent tokens by landing on them
 * - Safe squares protect tokens from capture
 * - Home stretch is color-specific
 * - First player to get all 4 tokens home wins
 * - Roll 6 gives extra turn (three 6s = lose turn)
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

// Board configuration constants (must match frontend gameEngine.js)
const BOARD_SIZE = 52;
const TOKENS_PER_PLAYER = 4;
const HOME_STRETCH_LENGTH = 5;

// Player configs matching frontend
const PLAYER_CONFIGS = [
  { color: 'red', name: 'Red', startPos: 0, homeEntryPos: 50 },
  { color: 'green', name: 'Green', startPos: 13, homeEntryPos: 11 },
  { color: 'yellow', name: 'Yellow', startPos: 26, homeEntryPos: 24 },
  { color: 'blue', name: 'Blue', startPos: 39, homeEntryPos: 37 },
];

// Safe square positions (0-indexed on the main track)
const SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];

// Token states
const TOKEN_STATE = {
  BASE: 'base',
  ACTIVE: 'active',
  HOME: 'home',
};

/**
 * Roll a six-sided die.
 * @returns {number} Value between 1 and 6
 */
function rollDieValue() {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Load full game state from the database.
 * @param {string} gameId - The game identifier
 * @returns {object|null} Full game state object or null if not found
 */
function loadGameState(gameId) {
  const db = getDb();

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game) return null;

  const playerRows = db.prepare(
    'SELECT * FROM players WHERE game_id = ? ORDER BY player_index'
  ).all(gameId);

  const tokenRows = db.prepare(
    'SELECT * FROM tokens WHERE game_id = ? ORDER BY player_index, token_index'
  ).all(gameId);

  const moveRows = db.prepare(
    'SELECT * FROM move_history WHERE game_id = ? ORDER BY move_order'
  ).all(gameId);

  // Build players with tokens
  const players = playerRows.map((p) => {
    const playerTokens = tokenRows
      .filter((t) => t.player_index === p.player_index)
      .map((t) => ({
        id: t.token_id,
        state: t.state,
        position: t.position,
        homeStretchPos: t.home_stretch_pos,
        stepsFromStart: t.steps_from_start,
      }));

    return {
      index: p.player_index,
      name: p.name,
      color: p.color,
      startPos: p.start_pos,
      homeEntryPos: p.home_entry_pos,
      tokens: playerTokens,
      hasFinished: p.has_finished === 1,
      finishOrder: p.finish_order,
    };
  });

  const moveHistory = moveRows.map((m) => ({
    playerIndex: m.player_index,
    tokenId: m.token_id,
    diceValue: m.dice_value,
  }));

  return {
    id: game.id,
    players,
    currentPlayerIndex: game.current_player_index,
    diceValue: game.dice_value,
    diceRolled: game.dice_rolled === 1,
    hasExtraTurn: game.has_extra_turn === 1,
    consecutiveSixes: game.consecutive_sixes,
    winner: game.winner,
    gameOver: game.game_over === 1,
    turnPhase: game.turn_phase,
    message: game.message,
    moveHistory,
    finishOrder: JSON.parse(game.finish_order || '[]'),
  };
}

/**
 * Save a full game state to the database (update).
 * Uses a transaction for atomicity.
 * @param {object} gameState - Full game state object
 */
function saveGameState(gameState) {
  const db = getDb();

  const updateGame = db.prepare(`
    UPDATE games SET
      current_player_index = ?,
      dice_value = ?,
      dice_rolled = ?,
      has_extra_turn = ?,
      consecutive_sixes = ?,
      winner = ?,
      game_over = ?,
      turn_phase = ?,
      message = ?,
      finish_order = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const updateToken = db.prepare(`
    UPDATE tokens SET
      state = ?,
      position = ?,
      home_stretch_pos = ?,
      steps_from_start = ?
    WHERE game_id = ? AND player_index = ? AND token_index = ?
  `);

  const updatePlayer = db.prepare(`
    UPDATE players SET
      has_finished = ?,
      finish_order = ?
    WHERE game_id = ? AND player_index = ?
  `);

  const insertMove = db.prepare(`
    INSERT INTO move_history (game_id, player_index, token_id, dice_value, move_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    updateGame.run(
      gameState.currentPlayerIndex,
      gameState.diceValue,
      gameState.diceRolled ? 1 : 0,
      gameState.hasExtraTurn ? 1 : 0,
      gameState.consecutiveSixes,
      gameState.winner,
      gameState.gameOver ? 1 : 0,
      gameState.turnPhase,
      gameState.message,
      JSON.stringify(gameState.finishOrder),
      gameState.id
    );

    for (const player of gameState.players) {
      updatePlayer.run(
        player.hasFinished ? 1 : 0,
        player.finishOrder,
        gameState.id,
        player.index
      );

      for (let t = 0; t < player.tokens.length; t++) {
        const token = player.tokens[t];
        updateToken.run(
          token.state,
          token.position,
          token.homeStretchPos,
          token.stepsFromStart,
          gameState.id,
          player.index,
          t
        );
      }
    }

    // Insert new move history entries that aren't already in DB
    const existingMoveCount = db.prepare(
      'SELECT COUNT(*) as count FROM move_history WHERE game_id = ?'
    ).get(gameState.id).count;

    for (let i = existingMoveCount; i < gameState.moveHistory.length; i++) {
      const move = gameState.moveHistory[i];
      insertMove.run(gameState.id, move.playerIndex, move.tokenId, move.diceValue, i);
    }
  });

  transaction();
}

/**
 * Check if a move results in capturing an opponent's token.
 * @param {object} gameState - Current game state
 * @param {number} playerIndex - Index of the moving player
 * @param {number} position - Target position on the main track
 * @returns {object|null} { playerIndex, tokenIndex } of captured token or null
 */
function checkCapture(gameState, playerIndex, position) {
  if (SAFE_SQUARES.includes(position)) {
    return null;
  }

  for (let i = 0; i < gameState.players.length; i++) {
    if (i === playerIndex) continue;
    const opponent = gameState.players[i];
    for (let t = 0; t < opponent.tokens.length; t++) {
      const oppToken = opponent.tokens[t];
      if (
        oppToken.state === TOKEN_STATE.ACTIVE &&
        oppToken.position === position &&
        oppToken.homeStretchPos < 0
      ) {
        return { playerIndex: i, tokenIndex: t };
      }
    }
  }
  return null;
}

/**
 * Get the next player index, skipping finished players.
 * @param {object} gameState - Current game state
 * @returns {number} Index of the next active player
 */
function getNextPlayerIndex(gameState) {
  const totalPlayers = gameState.players.length;
  let next = (gameState.currentPlayerIndex + 1) % totalPlayers;
  let attempts = 0;

  while (attempts < totalPlayers) {
    if (!gameState.players[next].hasFinished) {
      return next;
    }
    next = (next + 1) % totalPlayers;
    attempts++;
  }

  return gameState.currentPlayerIndex;
}

/**
 * Calculate valid moves for the current player given the dice value.
 * @param {object} gameState - Current game state
 * @returns {Array<object>} Array of { tokenId, tokenIndex }
 */
function calculateValidMoves(gameState) {
  const player = gameState.players[gameState.currentPlayerIndex];
  const diceValue = gameState.diceValue;

  if (!diceValue) return [];

  const validMoves = [];

  player.tokens.forEach((token, index) => {
    if (token.state === TOKEN_STATE.HOME) return;

    if (token.state === TOKEN_STATE.BASE) {
      if (diceValue === 6) {
        validMoves.push({ tokenId: token.id, tokenIndex: index });
      }
    } else if (token.state === TOKEN_STATE.ACTIVE) {
      const newSteps = token.stepsFromStart + diceValue;
      const totalPath = BOARD_SIZE + HOME_STRETCH_LENGTH + 1;

      if (newSteps <= totalPath) {
        validMoves.push({ tokenId: token.id, tokenIndex: index });
      }
    }
  });

  return validMoves;
}

class GameService {
  // PUBLIC_INTERFACE
  /**
   * Create a new Ludo game.
   * @param {object} params - { playerCount, playerNames, playerColors }
   * @returns {object} Initial game state
   */
  createGame({ playerCount = 2, playerNames = [], playerColors = [] }) {
    const db = getDb();
    const gameId = uuidv4();
    const defaultColors = ['red', 'green', 'yellow', 'blue'];
    const defaultNames = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

    const players = [];
    for (let i = 0; i < playerCount; i++) {
      const color = playerColors[i] || defaultColors[i];
      const config = PLAYER_CONFIGS.find((c) => c.color === color) || PLAYER_CONFIGS[i];

      const tokens = [];
      for (let t = 0; t < TOKENS_PER_PLAYER; t++) {
        tokens.push({
          id: `${color}_${t}`,
          state: TOKEN_STATE.BASE,
          position: -1,
          homeStretchPos: -1,
          stepsFromStart: 0,
        });
      }

      players.push({
        index: i,
        name: playerNames[i] || defaultNames[i],
        color: color,
        startPos: config.startPos,
        homeEntryPos: config.homeEntryPos,
        tokens: tokens,
        hasFinished: false,
        finishOrder: -1,
      });
    }

    const message = `${players[0].name}'s turn - Roll the dice!`;

    // Insert into database using a transaction
    const insertGame = db.prepare(`
      INSERT INTO games (id, current_player_index, dice_value, dice_rolled, has_extra_turn,
        consecutive_sixes, winner, game_over, turn_phase, message, finish_order)
      VALUES (?, 0, NULL, 0, 0, 0, NULL, 0, 'roll', ?, '[]')
    `);

    const insertPlayer = db.prepare(`
      INSERT INTO players (game_id, player_index, name, color, start_pos, home_entry_pos, has_finished, finish_order)
      VALUES (?, ?, ?, ?, ?, ?, 0, -1)
    `);

    const insertToken = db.prepare(`
      INSERT INTO tokens (game_id, player_index, token_index, token_id, state, position, home_stretch_pos, steps_from_start)
      VALUES (?, ?, ?, ?, 'base', -1, -1, 0)
    `);

    const transaction = db.transaction(() => {
      insertGame.run(gameId, message);

      for (const player of players) {
        insertPlayer.run(
          gameId,
          player.index,
          player.name,
          player.color,
          player.startPos,
          player.homeEntryPos
        );

        for (let t = 0; t < player.tokens.length; t++) {
          insertToken.run(gameId, player.index, t, player.tokens[t].id);
        }
      }
    });

    transaction();

    return {
      id: gameId,
      players,
      currentPlayerIndex: 0,
      diceValue: null,
      diceRolled: false,
      hasExtraTurn: false,
      consecutiveSixes: 0,
      winner: null,
      gameOver: false,
      turnPhase: 'roll',
      message,
      moveHistory: [],
      finishOrder: [],
    };
  }

  // PUBLIC_INTERFACE
  /**
   * Get the current game state.
   * @param {string} gameId - The game identifier
   * @returns {object|null} Game state or null if not found
   */
  getGameState(gameId) {
    return loadGameState(gameId);
  }

  // PUBLIC_INTERFACE
  /**
   * Roll the dice for the current player.
   * @param {string} gameId - The game identifier
   * @returns {object} Updated game state with dice value and valid moves
   */
  rollDice(gameId) {
    const gameState = loadGameState(gameId);
    if (!gameState) {
      throw new Error('Game not found');
    }

    if (gameState.gameOver) {
      return { ...gameState, message: 'Game is over!' };
    }

    if (gameState.turnPhase !== 'roll') {
      return { ...gameState, message: 'You must move a token first!' };
    }

    const diceValue = rollDieValue();
    const newState = {
      ...gameState,
      diceValue,
      diceRolled: true,
    };

    // Track consecutive sixes
    if (diceValue === 6) {
      newState.consecutiveSixes = (gameState.consecutiveSixes || 0) + 1;
      // Three consecutive sixes = lose turn
      if (newState.consecutiveSixes >= 3) {
        const nextPlayerIndex = getNextPlayerIndex(newState);
        const result = {
          ...newState,
          turnPhase: 'roll',
          diceRolled: false,
          diceValue: null,
          consecutiveSixes: 0,
          currentPlayerIndex: nextPlayerIndex,
          hasExtraTurn: false,
          message: `${gameState.players[gameState.currentPlayerIndex].name} rolled three 6s! Turn lost. ${newState.players[nextPlayerIndex].name}'s turn.`,
        };
        saveGameState(result);
        return result;
      }
      newState.hasExtraTurn = true;
    } else {
      newState.consecutiveSixes = 0;
      newState.hasExtraTurn = false;
    }

    const validMoves = calculateValidMoves(newState);

    // If no valid moves, advance to next player
    if (validMoves.length === 0) {
      if (newState.hasExtraTurn) {
        const result = {
          ...newState,
          turnPhase: 'roll',
          diceRolled: false,
          diceValue: null,
          hasExtraTurn: false,
          message: `${gameState.players[gameState.currentPlayerIndex].name} rolled ${diceValue} but has no valid moves. Roll again!`,
        };
        saveGameState(result);
        return result;
      }
      const nextPlayerIndex = getNextPlayerIndex(newState);
      const result = {
        ...newState,
        turnPhase: 'roll',
        diceRolled: false,
        diceValue: null,
        currentPlayerIndex: nextPlayerIndex,
        message: `${gameState.players[gameState.currentPlayerIndex].name} rolled ${diceValue} but has no valid moves. ${newState.players[nextPlayerIndex].name}'s turn.`,
      };
      saveGameState(result);
      return result;
    }

    // Auto-move if only one valid move
    if (validMoves.length === 1) {
      const result = this.performMove(newState, validMoves[0].tokenId);
      return result;
    }

    newState.turnPhase = 'move';
    newState.message = `${gameState.players[gameState.currentPlayerIndex].name} rolled ${diceValue}. Choose a token to move.`;
    saveGameState(newState);
    return newState;
  }

  // PUBLIC_INTERFACE
  /**
   * Move a token for the current player.
   * @param {string} gameId - The game identifier
   * @param {string} tokenId - The token to move
   * @param {number} playerIndex - The player making the move
   * @returns {object} Updated game state
   */
  moveToken(gameId, tokenId, playerIndex) {
    const gameState = loadGameState(gameId);
    if (!gameState) {
      throw new Error('Game not found');
    }

    if (gameState.gameOver) {
      return { ...gameState, message: 'Game is over!' };
    }

    // Validate it's the correct player's turn
    if (playerIndex !== undefined && playerIndex !== gameState.currentPlayerIndex) {
      return { ...gameState, message: 'Not your turn!' };
    }

    // Validate the token move is valid
    const validMoves = calculateValidMoves(gameState);
    const isValid = validMoves.some((m) => m.tokenId === tokenId);
    if (!isValid) {
      return { ...gameState, message: 'Invalid move!' };
    }

    return this.performMove(gameState, tokenId);
  }

  /**
   * Perform the actual token move logic.
   * @param {object} gameState - Current game state
   * @param {string} tokenId - The token to move
   * @returns {object} Updated game state
   */
  performMove(gameState, tokenId) {
    const playerIndex = gameState.currentPlayerIndex;
    const player = gameState.players[playerIndex];
    const diceValue = gameState.diceValue;
    const tokenIndex = player.tokens.findIndex((t) => t.id === tokenId);

    if (tokenIndex === -1) {
      return { ...gameState, message: 'Invalid token!' };
    }

    // Deep clone token
    const token = { ...player.tokens[tokenIndex] };
    let capturedToken = null;
    let message = '';

    if (token.state === TOKEN_STATE.BASE && diceValue === 6) {
      // Move token out of base to start position
      token.state = TOKEN_STATE.ACTIVE;
      token.position = player.startPos;
      token.stepsFromStart = 0;
      message = `${player.name} moves a token to the starting position.`;

      // Check for capture at start position
      capturedToken = checkCapture(gameState, playerIndex, player.startPos);
    } else if (token.state === TOKEN_STATE.ACTIVE) {
      const newSteps = token.stepsFromStart + diceValue;
      const homeEntrySteps = BOARD_SIZE;
      const totalPathToHome = BOARD_SIZE + HOME_STRETCH_LENGTH + 1;

      if (newSteps === totalPathToHome) {
        // Token reaches home
        token.state = TOKEN_STATE.HOME;
        token.position = -1;
        token.homeStretchPos = -1;
        token.stepsFromStart = newSteps;
        message = `${player.name}'s token reached HOME! 🎉`;
      } else if (newSteps > homeEntrySteps) {
        // Token is in the home stretch
        token.homeStretchPos = newSteps - homeEntrySteps - 1;
        token.position = -1;
        token.stepsFromStart = newSteps;
        message = `${player.name} moves a token into the home stretch.`;
      } else {
        // Normal move on main track
        const newPosition = (player.startPos + newSteps) % BOARD_SIZE;
        token.position = newPosition;
        token.stepsFromStart = newSteps;
        message = `${player.name} moves a token ${diceValue} spaces.`;

        // Check for capture
        capturedToken = checkCapture(gameState, playerIndex, newPosition);
      }
    } else {
      return { ...gameState, message: 'Cannot move this token!' };
    }

    // Apply changes to players array (deep clone)
    const newPlayers = gameState.players.map((p, i) => {
      if (i === playerIndex) {
        const newTokens = p.tokens.map((t, ti) => (ti === tokenIndex ? token : { ...t }));
        return { ...p, tokens: newTokens };
      }
      if (capturedToken && i === capturedToken.playerIndex) {
        const newTokens = p.tokens.map((t, ti) => {
          if (ti === capturedToken.tokenIndex) {
            return {
              ...t,
              state: TOKEN_STATE.BASE,
              position: -1,
              homeStretchPos: -1,
              stepsFromStart: 0,
            };
          }
          return { ...t };
        });
        return { ...p, tokens: newTokens };
      }
      return { ...p, tokens: p.tokens.map((t) => ({ ...t })) };
    });

    if (capturedToken) {
      message += ` Captured ${gameState.players[capturedToken.playerIndex].name}'s token! 💥`;
    }

    // Check if player has won
    const updatedPlayer = newPlayers[playerIndex];
    const allHome = updatedPlayer.tokens.every((t) => t.state === TOKEN_STATE.HOME);
    let gameOver = false;
    let winner = null;
    const finishOrder = [...gameState.finishOrder];

    if (allHome && !updatedPlayer.hasFinished) {
      newPlayers[playerIndex] = {
        ...updatedPlayer,
        hasFinished: true,
        finishOrder: finishOrder.length,
      };
      finishOrder.push(playerIndex);
      message += ` ${updatedPlayer.name} has finished! 🏆`;

      const activePlayers = newPlayers.filter((p) => !p.hasFinished).length;
      if (activePlayers <= 1 || finishOrder.length === 1) {
        gameOver = true;
        winner = playerIndex;
        message = `🏆 ${updatedPlayer.name} WINS! Congratulations! 🏆`;
      }
    }

    // Determine next turn
    let nextPlayerIndex = playerIndex;
    const hasExtraTurn = gameState.hasExtraTurn || capturedToken !== null;

    if (!gameOver && !hasExtraTurn) {
      nextPlayerIndex = getNextPlayerIndex({ ...gameState, players: newPlayers });
    }

    if (!gameOver && !hasExtraTurn) {
      message += ` ${newPlayers[nextPlayerIndex].name}'s turn.`;
    } else if (!gameOver && hasExtraTurn) {
      message += ` ${updatedPlayer.name} gets another turn!`;
    }

    const result = {
      ...gameState,
      players: newPlayers,
      currentPlayerIndex: nextPlayerIndex,
      diceValue: null,
      diceRolled: false,
      turnPhase: 'roll',
      hasExtraTurn: false,
      consecutiveSixes: hasExtraTurn ? gameState.consecutiveSixes : 0,
      gameOver,
      winner,
      finishOrder,
      message,
      moveHistory: [...gameState.moveHistory, { playerIndex, tokenId, diceValue }],
    };

    saveGameState(result);
    return result;
  }

  // PUBLIC_INTERFACE
  /**
   * Get valid moves for the current dice roll.
   * @param {string} gameId - The game identifier
   * @returns {Array<object>} Valid moves array
   */
  getValidMoves(gameId) {
    const gameState = loadGameState(gameId);
    if (!gameState) {
      throw new Error('Game not found');
    }
    return calculateValidMoves(gameState);
  }
}

module.exports = new GameService();
