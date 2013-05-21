var colors = require('colors'),
	mongodb = require('mongodb'),
	server = new mongodb.Server('127.0.0.1', 27017, {auto_reconnect: true}),
	dbname = 'gps',
	db = new mongodb.Db(dbname, server, {w: 1}),
	collections = {},
	EventEmitter = require('events').EventEmitter,
	Proto = new EventEmitter;
	Proto.ready = false

//provide connection to Mongo
db.open(function(err, client_instance) {
	if (err) {
		error(err);
	} else {
		console.log('[database]'.grey, 'err:'.red, 'connected to database');
		Proto.client = client_instance;
		Proto.ready = true;
		Proto.emit('connected');
	}
});

function error(err, object) {
        if (err) console.warn('[database]'.grey, err.message.red);
        else console.dir(object);  // undefined if no matching object exists.
 }
Proto.on('record', function() {
	console.info('[database]'.grey, 'record added');
});

Proto.addRecord = function(gps_msg) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		return;
	}
	var client = Proto.client,
		module_id = gps_msg.module_id,
		collection = collections[module_id];
	//insert new waypoint
	collection.insert(gps_msg, {safe: true}, error);
	Proto.emit('record', true);
}

Proto.updateModuleList = function(changes) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		return;
	}
	var client = Proto.client;
	if(changes) {
		console.log('[database]'.grey, 'add', changes.add, 'remove', changes.remove);
		if (changes.add.length > 0) {
			for (i = 0; i < changes.add.length; i++) {
				var module = changes.add[i];
				client.modules.update({id: module.id},{ $set:{name: module.name}, {upsert: true});
				client.createCollection(module.id, {}, function(err, collection) {
					if (err) error(err);
					collections[module.id] = collection;
					collection.ensureIndex({timestamps: 1}, {expireAfterSeconds: 60 * 24 * 365 * 2}, error);
				});
			}
		}
		if (changes.remove.length > 0) {
			for (i = 0; i < changes.remove.length; i++) {
				var module = changes.remove[i];
				client.modules.remove({id: module.id});
				client.dropCollection(module.id, function(err, result) {
					if (err) error(err);
					delete collections[module_id];
				});
			}
		}
		this.getModuleList({'client': 'server'});
	}
}
Proto.getModuleList = function(request) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		return;
	}
	var client = Proto.client,
		dst = request.client,
		client_id = request.socket_id;

	console.info('[database]'.grey, 'request module list');
	/* client.collectionNames(function(err, names) {
		var list = [];
		for (i = 0; i < names.length; i++) {
			var module_id = names[i].name.replace(dbname + '.', '');
			if (module_id == 'system.indexes') continue;
			list.push(module_id);
			collections[module_id] = client.collection(module_id);
		}
		console.info('[database]'.grey, 'found', list == undefined ? '0' : list.length, 'in track modules list');
		Proto.emit('modulelist-' + dst, {'socket_id': client_id, 'list': list});
	});
	*/
	var list = [],
		stream = collections.modules.find().stream();
	stream.on('error', error);
	stream.on('data', function (doc) {
		list.push(doc);
	});
	stream.on('end', function() {
		console.info('[database]'.grey, 'found', list == undefined ? '0' : list.length, 'in track modules list');
		Proto.emit('modulelist-' + dst, {'socket_id': client_id, 'list': list});
	});
}

Proto.query = function(request) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		return;
	}
	/*** prepare query parameters ***/
	var begin = request.begin;
	var end = request.end;
	var module_id = request.module_id;
	var client_id = request.socket_id;
	console.log('[database]'.grey, 'Query', module_id, begin, '..', end);
	/*** execute query ***/
	collection = collections[module_id]
	var stream = collection.find({timestamp: {$gt: begin, $lt: end}}, {sort: ['timestamp', 'ascending']}
	).stream()
	var count = 0;
	stream.on('error', error);
	stream.on('data', function (doc) {
		count++;
		Proto.emit('result', {'socket_id': client_id, 'result': doc});
	});
	stream.on('end', function() {
		console.log('[database]'.grey, 'query complete, found', count);
		Proto.emit('count', {'socket_id': client_id, 'count': count});
	});
}

module.exports = Proto;
