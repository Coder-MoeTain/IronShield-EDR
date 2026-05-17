/**
 * OpenAPI route coverage helpers (used by validate-openapi-coverage.js).
 */
const path = require('path');
const { getMountedRoutes } = require('../../scripts/lib/openapiRouteMounts');

function getSpecPath() {
  return path.join(__dirname, '../../openapi/openapi.json');
}

module.exports = {
  getSpecPath,
  getMountedRoutes,
};
