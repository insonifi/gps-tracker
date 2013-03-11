var EventEmitter = require('events').EventEmitter;
var Proto = new EventEmitter;
var googleApi = require('./google_api');
var redis = require('./redis_db');
var nmea = require('./nmea');
var queue = new Array;
var notProcessing = true;

googleApi.on('address', function (gps_msg) {
	redis.addRecord(gps_msg);
	Proto.emit('send-client', gps_msg);
});

Proto.add = function (input) {
	queue.push(input);
	if(notProcessing) {
		notProcessing = false
		Proto.emit('next');
	}
}


Proto.isTracked = new Object;

Proto.on('next', function () {
	if(queue.length > 0) {
		var string = queue.shift();
		var Id = string.slice(0, string.indexOf('$'));
		if (!Proto.isTracked[Id]) {
			console.error('[queue]'.grey, 'not tracking'.red, Id, '-- not processing!'.red);
			return;
		}
		var gps_msg = nmea.parse(string.slice(Id.length));
		if (gps_msg.isValid) {
			gps_msg.id = Id;
			googleApi.addressLookup(gps_msg);
		}
		var delay = 300 + Math.random() * 1000;//introduce some interval to avoit OVER_QUERY_LIMIT
		setTimeout(function () {
			console.log('[queue]'.grey, 'process next', (new Date).toISOString());
			Proto.emit('next');
		}, delay);
	} else {
		notProcessing = true;
	}
});

module.exports = Proto;
