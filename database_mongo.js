var colors = require('colors'),
	MongoClient = require('mongodb').MongoClient,
	//host = process.env.OPENSHIFT_MONGODB_DB_HOST || 'localhost',
	//port = process.env.OPENSHIFT_MONGODB_DB_PORT || 27013,
	//server = new mongodb.Server(host, port, {auto_reconnect: true}),
	db_uri = (process.env.OPENSHIFT_MONGODB_DB_URL || 'mongodb://127.0.0.1:27017/') + (process.env.OPENSHIFT_APP_NAME || 'gpstracker'),
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
        if (err) {console.warn('[database]'.grey, err.message.red);}
        else {console.dir(object);} // undefined if no matching object exists.
}
Proto.on('record', function() {
	console.info('[database]'.grey, 'record added');
});

Proto.addRecord = function(gps_msg) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		return;
	}
	var module_id = gps_msg.module_id,
		collection = Proto.collections[module_id];
	//insert new waypoint
	collection.update({timestamp: gps_msg.timestamp}, {$set: gps_msg}, {safe: true, upsert: true}, error);
	Proto.emit('record', true);
};

Proto.updateModuleList = function(changes) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		return;
	}
	var client = Proto.client;
	if(changes) {
		console.log('[database]'.grey, 'add', changes.add, 'remove', changes.remove);
		if (changes.add.length > 0) {
			for (var i = 0; i < changes.add.length; i++) {
				var add_module = changes.add[i];
				Proto.collections.modules.update({id: add_module.id},{ $set:{name: add_module.name}}, {upsert: true}, error);
				client.createCollection(add_module.id, {}, function(err, collection) {
					if (err) error(err);
					Proto.collections[add_module.id] = collection;
					collection.ensureIndex({timestamps: 1}, {expireAfterSeconds: 60 * 24 * 365 * 2}, error);
				});
			}
		}
		if (changes.remove.length > 0) {
			for (var i = 0; i < changes.remove.length; i++) {
				var rm_module = changes.remove[i];
				Proto.collections.modules.remove({id: rm_module.id}, error);
				client.dropCollection(rm_module.id, function(err) {
					if (err) error(err);
					delete Proto.collections[rm_module.id];
				});
			}
		}
		this.getModuleList({'client': 'server'});
	}
};
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
			return console.info('[database]'.grey, 'modules list not found'.red);
		}
		var list = [],
			stream = Proto.collections.modules.find().stream();
		stream.on('error', error);
		stream.on('data', function (doc) {
			list.push(doc);
			//console.log('[database]'.grey, 'got', doc);
			Proto.collections[doc.id] = client.collection(doc.id);
		});
		stream.on('end', function() {
			console.info('[database]'.grey, 'found', list == undefined ? '0' : list.length, 'in track modules list');
			Proto.emit('modulelist-' + dst, {'socket_id': client_id, 'list': list});
		});
	}

	//ensure collection exists
	client.collectionNames('modules', function(err, names) {
		if (err) error(err);
		if (names.length === 0) {
			console.info('[database]'.grey, 'no modules list found'.red);
			client.createCollection('modules', {}, function(err, collection) {
				if (err) {
					error(err)
				} else {
					console.info('[database]'.grey, 'list created');
					Proto.collections['modules'] = collection;
					acquire_list();
				}
			});
		} else {
			Proto.collections['modules'] = client.collection('modules');
			acquire_list();
		}
	});
};

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
	var collection = Proto.collections[module_id];
	if (!collection) {
		console.log('[database]'.grey, 'collection no ready');
		return;
	}
	var stream = collection.find({timestamp: {$gt: begin, $lt: end}}, {sort: ['timestamp', 'ascending']}
	).stream();
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
};

module.exports = Proto;
