const config = require('../config');

function topics() {
  return config.kafka?.topics || {
    rawEndpoint: 'xdr.raw.endpoint',
    normalized: 'xdr.normalized',
    detections: 'xdr.detections',
  };
}

module.exports = { topics };

