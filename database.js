var colors = require('colors'),
	MongoClient = require('mongodb').MongoClient,
	//host = process.env.OPENSHIFT_MONGODB_DB_HOST || 'localhost',
	//port = process.env.OPENSHIFT_MONGODB_DB_PORT || 27013,
	//server = new mongodb.Server(host, port, {auto_reconnect: true}),
	db_uri = (process.env.OPENSHIFT_MONGODB_DB_URL || 'mongodb://127.0.0.1:27013/') + (process.env.OPENSHIFT_APP_NAME || 'gpstracker'),
	//db = new mongodb.Db,
	EventEmitter = require('events').EventEmitter,
	Proto = new EventEmitter;
	Proto.ready = false;
	Proto.collections = {};
	
	console.log('[database]'.grey, 'connecting to'.grey, db_uri);
//provide connection to Mongo
MongoClient.connect(db_uri, function(err, client_instance) {
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
		collection = Proto.collections[module_id];
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
				client.modules.update({id: module.id},{ $set:{name: module.name}}, {upsert: true});
				client.createCollection(module.id, {}, function(err, collection) {
					if (err) error(err);
					Proto.collections[module.id] = collection;
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
					delete Proto.collections[module_id];
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
	
	function acquire_list() {
		if (!Proto.collections.modules) {
			return console.info('[database]'.grey, 'modules list wasn\'t created'.red);
		}
		var list = [],
			stream = Proto.collections.modules.find(error).stream();
		stream.on('error', error);
		stream.on('data', function (doc) {
			list.push(doc);
		});
		stream.on('end', function() {
			console.info('[database]'.grey, 'found', list == undefined ? '0' : list.length, 'in track modules list');
			Proto.emit('modulelist-' + dst, {'socket_id': client_id, 'list': list});
		});
	}

	//ensure collection exists
	client.collectionNames(function(err, names) {
		if (err) error(err);
		if (names.indexOf('modules') == -1) {
			console.info('[database]'.grey, 'no modules list found'.red);
			client.createCollection('modules', {}, function(err, collection) {
				console.info('[database]'.grey, 'creating modules list');
				if (err) {
					error(err)
				} else {
					Proto.collections['modules'] = client.collection('modules');
					acquire_list();
				}
			});
		} else {
			acquire_list();
		}
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
	collection = Proto.collections[module_id]
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
