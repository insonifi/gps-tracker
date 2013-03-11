var redis = require('redis'),
	client = redis.createClient();
var EventEmitter = require('events').EventEmitter;
var Proto = new EventEmitter;

function error(err) {
	if (err) console.info('[redis]'.grey, 'error'.red);
	else console.info('[redis]'.grey, 'OK'.green);
}
Proto.on('record', function() {
	console.info('[redis]'.grey, 'record added');
});

Proto.addRecord = function(gps_msg) {
	var gps_timestamp = gps_msg.gps_timestamp.toString();
	var key = gps_msg.id + ':' + gps_timestamp;
	var timestamp = ['timestamps', gps_timestamp, key];
	var modulesId = ['modules-id', gps_msg.id]; //is it necessary??
	var waypoint = ['waypoints:' + key];
	for(property in gps_msg) {
		waypoint.push(property)
		waypoint.push(gps_msg[property].toString())
	}
	client.multi()
		.zadd(timestamp, error)
		.sadd(modulesId, error)
		.hmset(waypoint, error)
		.exec(error);
	this.emit('record', true);
}

Proto.updateTracklist = function(changes) {
	if(changes) {
		console.log('[redis]'.grey, 'add', changes.add, 'remove', changes.remove);
		if (changes.add.length > 0) {
			client.sadd(['tracklist'].concat(changes.add), error);
		}
		if (changes.remove.length > 0) {
			client.srem(['tracklist'].concat(changes.remove), error);
		}
		this.getList({'client': 'server'});
	}
}
Proto.getList = function(request) {
	var dst = request.client;
	var client_id = request.socket_id;
	console.log('[redis]'.grey, dst, 'requested tracking list');
	client.smembers('tracklist', function (err, list) {
		if (err) console.info('[redis]'.grey, 'error'.red);
		console.info('[redis]'.grey, 'found', list.length, 'in tracking list');
		Proto.emit('tracklist-' + dst, {'socket_id': client_id, 'list': list});
	});
}

Proto.query = function(request) {//must introduce query by id
	var begin = request.begin;
	var end = request.end;
	var client_id = request.socket_id;
	console.log('[redis]'.grey, 'Query', begin, '..', end);
	client.zrangebyscore(['timestamps', begin, end], function (err, replies) {
		if (undefined != replies) {
			console.log('[redis]'.grey, 'found', replies.length);
			replies.forEach(function (key, i) {
				client.hgetall('waypoints:' + key, function(err, hash) {
					//console.log('[redis]', 'hgetall got'.grey, Proto.result.length);
					Proto.emit('result', {'socket_id': client_id, 'result': hash});
				});
			});
			//console.log('[redis], 'zrangebyscore got'.grey, Proto.result.length);
			//Proto.emit('result', Proto.result);
		}
		var count = replies.length == undefined ? 0 : replies.length;
		Proto.emit('count', {'socket_id': client_id, 'count': count});
	});
}

module.exports = Proto;
