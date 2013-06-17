'use strict';
var EventEmitter = require('events').EventEmitter,
	Proto = new EventEmitter(),
	mapApi = require('./map_api'),
	database = require('./database_pg'),
	nmea = require('./nmea'),
	string,
	marker_position,
	id,
	gpstext,
	gps_msg,
	queue = [],
	process = function (string) {
		if (!string) {
			return;
		}
		marker_position = string.indexOf('$');
		id = string.slice(0, marker_position);
		gpstext = string.slice(marker_position);
		//do we track this module
		if (!Proto.isTracked[id]) {
			console.error('[queue]'.grey, 'not tracking'.red, id, '-- not processing!'.red);
			return;
		}
		//parse GPS message
		gps_msg = nmea.parse(gpstext);
		if (gps_msg.isValid) {
			gps_msg.module_id = id;
			mapApi.addressLookup(gps_msg);
		}
	};

mapApi.on('address', function (gps_msg) {
	database.addRecord(gps_msg);
	Proto.emit('send-update', gps_msg);
});

Proto.notProcessing = true;
Proto.add = function (string) {
	process(string);
};

Proto.isTracked = {};

module.exports = Proto;
