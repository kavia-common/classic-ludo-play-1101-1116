/**
 * Game Controller
 * 
 * Handles HTTP requests for Ludo game operations.
 * Delegates business logic to the game service.
 */

const gameService = require('../services/game');

class GameController {
  // PUBLIC_INTERFACE
  /**
   * Create a new Ludo game.
   * POST /api/games
   * Body: { playerCount, playerNames, playerColors }
   * @param {object} req - Express request
   * @param {object} res - Express response
   */
  createGame(req, res) {
    try {
      const { playerCount, playerNames, playerColors } = req.body;

      if (playerCount !== undefined && (playerCount < 2 || playerCount > 4)) {
        return res.status(400).json({
          status: 'error',
          message: 'Player count must be between 2 and 4',
        });
      }

      const gameState = gameService.createGame({
        playerCount: playerCount || 2,
        playerNames: playerNames || [],
        playerColors: playerColors || [],
      });

      return res.status(201).json(gameState);
    } catch (error) {
      console.error('Error creating game:', error.message);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create game',
      });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Get the current game state.
   * GET /api/games/:gameId
   * @param {object} req - Express request
   * @param {object} res - Express response
   */
  getGameState(req, res) {
    try {
      const { gameId } = req.params;
      const gameState = gameService.getGameState(gameId);

      if (!gameState) {
        return res.status(404).json({
          status: 'error',
          message: 'Game not found',
        });
      }

      return res.status(200).json(gameState);
    } catch (error) {
      console.error('Error getting game state:', error.message);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to get game state',
      });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Roll the dice for the current player.
   * POST /api/games/:gameId/roll
   * @param {object} req - Express request
   * @param {object} res - Express response
   */
  rollDice(req, res) {
    try {
      const { gameId } = req.params;
      const gameState = gameService.rollDice(gameId);

      return res.status(200).json(gameState);
    } catch (error) {
      if (error.message === 'Game not found') {
        return res.status(404).json({
          status: 'error',
          message: 'Game not found',
        });
      }
      console.error('Error rolling dice:', error.message);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to roll dice',
      });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Move a token on the board.
   * POST /api/games/:gameId/move
   * Body: { tokenId, playerIndex }
   * @param {object} req - Express request
   * @param {object} res - Express response
   */
  moveToken(req, res) {
    try {
      const { gameId } = req.params;
      const { tokenId, playerIndex } = req.body;

      if (!tokenId) {
        return res.status(400).json({
          status: 'error',
          message: 'tokenId is required',
        });
      }

      const gameState = gameService.moveToken(gameId, tokenId, playerIndex);

      return res.status(200).json(gameState);
    } catch (error) {
      if (error.message === 'Game not found') {
        return res.status(404).json({
          status: 'error',
          message: 'Game not found',
        });
      }
      console.error('Error moving token:', error.message);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to move token',
      });
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Get valid moves for the current dice roll.
   * GET /api/games/:gameId/valid-moves
   * @param {object} req - Express request
   * @param {object} res - Express response
   */
  getValidMoves(req, res) {
    try {
      const { gameId } = req.params;
      const validMoves = gameService.getValidMoves(gameId);

      return res.status(200).json({ validMoves });
    } catch (error) {
      if (error.message === 'Game not found') {
        return res.status(404).json({
          status: 'error',
          message: 'Game not found',
        });
      }
      console.error('Error getting valid moves:', error.message);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to get valid moves',
      });
    }
  }
}

module.exports = new GameController();
