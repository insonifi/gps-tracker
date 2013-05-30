'use strict';
var EventEmitter = require('events').EventEmitter,
	Proto = new EventEmitter(),
	mapApi = require('./map_api'),
	database = require('./database_pg'),
	nmea = require('./nmea'),
	queue = [];

mapApi.on('address', function (gps_msg) {
	database.addRecord(gps_msg);
	Proto.emit('send-update', gps_msg);
});

Proto.notProcessing = true;
Proto.add = function (string) {
	queue.push(string);
	/* initiate processing immediately
	*  only if processing is not in progress,
	*  otherwise just add message to the queue.
	*/
	if (Proto.notProcessing) {
		Proto.notProcessing = false;
		Proto.emit('next');
	}
};

Proto.isTracked = {};
Proto.on('next', function () {
	if (queue.length > 0) {
		var string = queue.shift(),
			id = string.slice(0, string.indexOf('$')),
			gps_msg,
			delay;
		//do we track this module
		if (!Proto.isTracked[id]) {
			console.error('[queue]'.grey, 'not tracking'.red, id, '-- not processing!'.red);
			return;
		}
		//parse GPS message
		gps_msg = nmea.parse(string.slice(id.length));
		if (gps_msg.isValid) {
			gps_msg.module_id = id;
			mapApi.addressLookup(gps_msg);
		}
		//initiate next message processing with a delay
		delay = 300 + Math.random() * 1000;//introduce some interval to avoid OVER_QUERY_LIMIT
		setTimeout(function () {
			console.log('[queue]'.grey, 'process next', (new Date()).toISOString().slice(11, 23).white);
			Proto.emit('next');
		}, delay);
	} else {
		Proto.notProcessing = true;
	}
});

module.exports = Proto;
