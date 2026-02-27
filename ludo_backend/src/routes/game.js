/**
 * Game Routes
 * 
 * Defines REST API routes for Ludo game operations.
 * All routes are prefixed with /api/games when mounted.
 */

const express = require('express');
const gameController = require('../controllers/game');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Token:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: red_0
 *         state:
 *           type: string
 *           enum: [base, active, home]
 *           example: base
 *         position:
 *           type: integer
 *           example: -1
 *         homeStretchPos:
 *           type: integer
 *           example: -1
 *         stepsFromStart:
 *           type: integer
 *           example: 0
 *     Player:
 *       type: object
 *       properties:
 *         index:
 *           type: integer
 *           example: 0
 *         name:
 *           type: string
 *           example: Player 1
 *         color:
 *           type: string
 *           enum: [red, green, yellow, blue]
 *           example: red
 *         startPos:
 *           type: integer
 *           example: 0
 *         homeEntryPos:
 *           type: integer
 *           example: 50
 *         tokens:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Token'
 *         hasFinished:
 *           type: boolean
 *           example: false
 *         finishOrder:
 *           type: integer
 *           example: -1
 *     GameState:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         players:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Player'
 *         currentPlayerIndex:
 *           type: integer
 *           example: 0
 *         diceValue:
 *           type: integer
 *           nullable: true
 *           example: null
 *         diceRolled:
 *           type: boolean
 *           example: false
 *         hasExtraTurn:
 *           type: boolean
 *           example: false
 *         consecutiveSixes:
 *           type: integer
 *           example: 0
 *         winner:
 *           type: integer
 *           nullable: true
 *           example: null
 *         gameOver:
 *           type: boolean
 *           example: false
 *         turnPhase:
 *           type: string
 *           enum: [roll, move]
 *           example: roll
 *         message:
 *           type: string
 *           example: "Player 1's turn - Roll the dice!"
 *         moveHistory:
 *           type: array
 *           items:
 *             type: object
 *         finishOrder:
 *           type: array
 *           items:
 *             type: integer
 *     CreateGameRequest:
 *       type: object
 *       properties:
 *         playerCount:
 *           type: integer
 *           minimum: 2
 *           maximum: 4
 *           example: 2
 *           description: Number of players (2-4)
 *         playerNames:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Alice", "Bob"]
 *           description: Optional player names
 *         playerColors:
 *           type: array
 *           items:
 *             type: string
 *             enum: [red, green, yellow, blue]
 *           example: ["red", "green"]
 *           description: Optional player colors
 *     MoveTokenRequest:
 *       type: object
 *       required:
 *         - tokenId
 *       properties:
 *         tokenId:
 *           type: string
 *           example: red_0
 *           description: ID of the token to move
 *         playerIndex:
 *           type: integer
 *           example: 0
 *           description: Index of the player making the move
 *     ValidMovesResponse:
 *       type: object
 *       properties:
 *         validMoves:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               tokenId:
 *                 type: string
 *               tokenIndex:
 *                 type: integer
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: error
 *         message:
 *           type: string
 */

/**
 * @swagger
 * tags:
 *   - name: Games
 *     description: Ludo game management endpoints
 */

/**
 * @swagger
 * /api/games:
 *   post:
 *     tags: [Games]
 *     summary: Create a new Ludo game
 *     description: Initialize a new Ludo game with 2-4 players. Returns the full initial game state.
 *     operationId: createGame
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateGameRequest'
 *     responses:
 *       201:
 *         description: Game created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameState'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 */
router.post('/', gameController.createGame.bind(gameController));

/**
 * @swagger
 * /api/games/{gameId}:
 *   get:
 *     tags: [Games]
 *     summary: Get current game state
 *     description: Retrieve the full game state including all players, tokens, and game status.
 *     operationId: getGameState
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique game identifier
 *     responses:
 *       200:
 *         description: Game state retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameState'
 *       404:
 *         description: Game not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:gameId', gameController.getGameState.bind(gameController));

/**
 * @swagger
 * /api/games/{gameId}/roll:
 *   post:
 *     tags: [Games]
 *     summary: Roll the dice
 *     description: Roll the dice for the current player. Automatically handles no-move situations and auto-moves when only one valid move exists.
 *     operationId: rollDice
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique game identifier
 *     responses:
 *       200:
 *         description: Dice rolled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameState'
 *       404:
 *         description: Game not found
 *       500:
 *         description: Server error
 */
router.post('/:gameId/roll', gameController.rollDice.bind(gameController));

/**
 * @swagger
 * /api/games/{gameId}/move:
 *   post:
 *     tags: [Games]
 *     summary: Move a token
 *     description: Move a specific token for the current player. The token must be in the valid moves list.
 *     operationId: moveToken
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique game identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MoveTokenRequest'
 *     responses:
 *       200:
 *         description: Token moved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameState'
 *       400:
 *         description: Invalid move
 *       404:
 *         description: Game not found
 *       500:
 *         description: Server error
 */
router.post('/:gameId/move', gameController.moveToken.bind(gameController));

/**
 * @swagger
 * /api/games/{gameId}/valid-moves:
 *   get:
 *     tags: [Games]
 *     summary: Get valid moves
 *     description: Get the list of valid token moves for the current dice roll and player.
 *     operationId: getValidMoves
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique game identifier
 *     responses:
 *       200:
 *         description: Valid moves retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidMovesResponse'
 *       404:
 *         description: Game not found
 *       500:
 *         description: Server error
 */
router.get('/:gameId/valid-moves', gameController.getValidMoves.bind(gameController));

module.exports = router;
