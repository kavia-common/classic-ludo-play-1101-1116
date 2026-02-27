/**
 * Server Entry Point
 * 
 * Starts the Express HTTP server and handles graceful shutdown
 * including closing the database connection.
 */

require('dotenv').config();
const app = require('./app');
const { closeDb } = require('./db');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`Ludo Backend Server running at http://${HOST}:${PORT}`);
  console.log(`API documentation available at http://${HOST}:${PORT}/docs`);
  console.log(`OpenAPI spec at http://${HOST}:${PORT}/openapi.json`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    closeDb();
    console.log('HTTP server and database closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    closeDb();
    console.log('HTTP server and database closed');
    process.exit(0);
  });
});

module.exports = server;
