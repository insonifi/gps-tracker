var EventEmitter = require('events').EventEmitter;
var Proto = new EventEmitter;
var googleApi = require('./google_api');
var database = require('./database');
var nmea = require('./nmea');
var queue = new Array;

googleApi.on('address', function (gps_msg) {
	database.addRecord(gps_msg);
	Proto.emit('send-update', gps_msg);
});

Proto.notProcessing = true;
Proto.add = function (input) {
	queue.push(input);
	/* initiate processing immediately
	*  only if processing is not in progress,
	*  otherwise just add message to the queue.
	*/
	if(Proto.notProcessing) {
		Proto.notProcessing = false
		Proto.emit('next');
	}
}


Proto.isTracked = new Object;
Proto.on('next', function () {
	if(queue.length > 0) {
		var string = queue.shift();
		var id = string.slice(0, string.indexOf('$'));
		//do we track this module
		if (!Proto.isTracked[id]) {
			console.error('[queue]'.grey, 'not tracking'.red, id, '-- not processing!'.red);
			return;
		}
		//parse GPS message
		var gps_msg = nmea.parse(string.slice(id.length));
		if (gps_msg.isValid) {
			gps_msg.module_id = id;
			googleApi.addressLookup(gps_msg);
		}
		//initiate next message processing with a delay
		var delay = 300 + Math.random() * 1000;//introduce some interval to avoit OVER_QUERY_LIMIT
		setTimeout(function () {
			console.log('[queue]'.grey, 'process next', (new Date).toISOString());
			Proto.emit('next');
		}, delay);
	} else {
		Proto.notProcessing = true;
	}
});

module.exports = Proto;
