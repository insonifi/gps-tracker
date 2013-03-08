var redis = require('redis'),
	client = redis.createClient();
var EventEmitter = require('events').EventEmitter;
var Proto = new EventEmitter;

function error(err) {
	if (err) throw err;
}
Proto.on('record', function() {
	console.info('[redis] record added');
});

Proto.addRecord = function(gps_msg) {
	var gps_timestamp = gps_msg.gps_timestamp.toString();
	var key = gps_timestamp
	var timestamp = ['timestamps', gps_timestamp, key];
	var waypoint = ['waypoints:' + key];
	for(property in gps_msg) {
		waypoint.push(property)
		waypoint.push(gps_msg[property].toString())
	}
	client.zadd(timestamp, error);
	client.hmset(waypoint, error);
	this.emit('record', true);
}

Proto.query = function(begin, end) {
	client.zrangebyscore(['timestamps', begin, end], function (err, replies) {
		if (undefined != replies) {
			console.log('found ' + replies.length);
			replies.forEach(function (key, i) {
				client.hgetall('waypoints:' + key, function(err, hash) {
					//console.log('[hgetall] got ' + Proto.result.length);
					Proto.emit('result', hash);
				});
			});
			//console.log('[zrangebyscore] got ' + Proto.result.length);
			Proto.emit('result', Proto.result);
		} else {
			Proto.emit('empty', undefined);
		}
	});
}

module.exports = Proto;
