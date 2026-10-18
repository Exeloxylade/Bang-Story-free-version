const path = require('node:path');
module.exports = {
  cacheDirectory: path.join(__dirname, '.runtime', 'browser'),
  'chrome-headless-shell': {skipDownload: true},
  firefox: {skipDownload: true},
};
