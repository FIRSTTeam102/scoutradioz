const logger = require('log4js').getLogger();
const utilities = require("../utilities");

var functions = module.exports = {};

functions.isQuantifiableType = function(type) {
    if (type == 'checkbox' || type == 'counter' || type == 'badcounter' || type == 'derived')
        return true;
    return false;
}