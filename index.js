var Autobahn = require('./autobahn.min.js');
var mobile = require('./lib/mobile.js');
Autobahn.transports.register('mobile', mobile.Factory);

module.exports = Autobahn;