/**
 * Express Application Setup
 * 
 * Configures middleware (CORS, JSON parsing), Swagger documentation,
 * route mounting, database initialization, and error handling.
 * 
 * CORS is configured to allow the frontend preview origin and
 * any additional origins specified in the ALLOWED_ORIGINS env variable.
 */

require('dotenv').config();
const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');
const { getDb } = require('./db');

// Initialize express app
const app = express();

// Build allowed origins list from environment
const allowedOriginsList = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Add FRONTEND_URL if set and not already in the list
if (process.env.FRONTEND_URL && !allowedOriginsList.includes(process.env.FRONTEND_URL)) {
  allowedOriginsList.push(process.env.FRONTEND_URL);
}

// CORS configuration - allow specific origins from env, plus fallback wildcard for dev
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow if origin is in the allowed list
    if (allowedOriginsList.length > 0 && allowedOriginsList.includes(origin)) {
      return callback(null, true);
    }
    // In development, allow all origins as fallback
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    // Block in production if not in allowed list
    callback(new Error('Not allowed by CORS'));
  },
  methods: (process.env.ALLOWED_METHODS || 'GET,POST,PUT,DELETE,PATCH,OPTIONS').split(','),
  allowedHeaders: (process.env.ALLOWED_HEADERS || 'Content-Type,Authorization,X-Requested-With').split(','),
  credentials: true,
  maxAge: parseInt(process.env.CORS_MAX_AGE || '3600', 10),
};

app.use(cors(corsOptions));

// Trust proxy for correct protocol detection behind reverse proxies
app.set('trust proxy', process.env.TRUST_PROXY === 'true');

// Swagger UI documentation
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const host = req.get('host');
  let protocol = req.protocol;
  const actualPort = req.socket.localPort;
  const hasPort = host.includes(':');

  const needsPort =
    !hasPort &&
    ((protocol === 'http' && actualPort !== 80) ||
     (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  protocol = req.secure ? 'https' : protocol;

  const dynamicSpec = {
    ...swaggerSpec,
    servers: [
      {
        url: `${protocol}://${fullHost}`,
        description: 'Current server',
      },
    ],
  };
  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// OpenAPI JSON endpoint for programmatic access
app.get('/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});

// Parse JSON request body
app.use(express.json());

// Initialize database connection on startup
try {
  getDb();
} catch (error) {
  console.error('Database initialization failed:', error.message);
  console.warn('Server will start but database-dependent routes may fail.');
}

// Mount routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error',
  });
});

module.exports = app;
