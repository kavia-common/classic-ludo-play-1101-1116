/**
 * Swagger/OpenAPI Configuration
 * 
 * Configures swagger-jsdoc to generate OpenAPI 3.0 spec
 * from JSDoc annotations in route files.
 */

const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ludo Game Backend API',
      version: '1.0.0',
      description: 'REST API for the Classic Ludo game. Provides endpoints for game initialization, dice rolls, token moves, game state management, and player settings. Designed for pass-and-play mode with 2-4 players.',
    },
    tags: [
      {
        name: 'Health',
        description: 'Service health check endpoints',
      },
      {
        name: 'Games',
        description: 'Ludo game management - create games, roll dice, move tokens, and check game state',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
