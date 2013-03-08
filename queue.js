var EventEmitter = require('events').EventEmitter;
var Proto = new EventEmitter;
var googleApi = require('./google_api');
var redis = require('./redis_db');
var nmea = require('./nmea');
var queue = new Array;
var notProcessing = true;

googleApi.on('address', function (gps_msg) {
	redis.addRecord(gps_msg);
});

Proto.add = function (input) {
	queue.push(input);
	if(notProcessing) {
		notProcessing = false
		Proto.emit('next');
	}
}

Proto.on('next', function () {
	if(queue.length > 0) {
		var string = queue.shift();
		var gps_msg = nmea.parse(string);
		if (gps_msg.isValid) {
			gps_msg.id = vId;
			googleApi.addressLookup(gps_msg);
			//trigger request address event
			//when address acquired trigger database record event
			//record to database
		}
		var delay = 300 + Math.random() * 1000;//introduce some interval to avoit OVER_QUERY_LIMIT
		setTimeout(function () {
			console.log('[queue] ' + (new Date).toLocaleTimeString());
			Proto.emit('next');
		}, delay);
	} else {
		notProcessing = true;
	}
});

module.exports = Proto;
