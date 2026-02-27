/**
 * OpenAPI Specification Generator
 * 
 * Reads the Swagger spec from swagger.js and writes it
 * as a JSON file to the interfaces directory.
 * Run with: node generate_openapi.js
 */

const fs = require('fs');
const path = require('path');
const swaggerSpec = require('./swagger');

const outputDir = path.join(__dirname, 'interfaces');
const outputPath = path.join(outputDir, 'openapi.json');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(
  outputPath,
  JSON.stringify(swaggerSpec, null, 2)
);

console.log(`OpenAPI spec written to ${outputPath}`);
