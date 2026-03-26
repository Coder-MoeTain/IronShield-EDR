const { DEFAULT_SOD_MATRIX } = require('../middleware/sod');

function getMatrix(req, res) {
  res.json({ matrix: DEFAULT_SOD_MATRIX });
}

module.exports = { getMatrix };

