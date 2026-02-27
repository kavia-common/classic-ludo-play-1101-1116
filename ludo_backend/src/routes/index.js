/**
 * Main Route Index
 * 
 * Aggregates all route modules and mounts them on the Express router.
 * Health endpoint at root, game API routes under /api/games.
 */

const express = require('express');
const healthController = require('../controllers/health');
const gameRoutes = require('./game');

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health endpoint
 *     description: Returns the health status of the backend service.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

/**
 * @swagger
 * /api:
 *   get:
 *     summary: API health check
 *     description: Returns the health status specifically for the API layer.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Ludo API is running
 */
router.get('/api', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Ludo API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount game routes under /api/games
router.use('/api/games', gameRoutes);

module.exports = router;
