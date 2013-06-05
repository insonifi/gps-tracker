'use strict';
var colors = require('colors'),
	pg = require('pg'),
	db_uri = (process.env.OPENSHIFT_POSTGRESQL_DB_URL || 'tcp://127.0.0.1:1234') + '/' + (process.env.OPENSHIFT_APP_NAME || 'gpstracker'),
	client = new pg.Client(db_uri),
	EventEmitter = require('events').EventEmitter,
	Proto = new EventEmitter(),
	expire_yr = 2,
	i,
	error = function (err) {
		if (err) {
			console.warn('[database]'.grey, err.message.red);
		}
	},
	cleanup = function () {
		client.connect(err);
		//delete expired records if any
		console.log('[database]'.grey, 'cleaning up');
		client.query({
			text: 'DELETE FROM waypoints WHERE timestamp (now() - \'$1 years\')::interval',
			values: [expire_yr]
		}, error);
		client.query({text: 'VACUUM'}, error);
	};

client.on('drain', client.end.bind(client));

Proto.ready = false;

Proto.addRecord = function (gps_msg) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		setTimeout(function () {
			Proto.addRecord(gps_msg);
		}, 2 * 1000); //retry in 2 sec;
		return;
	}
	client.connect(err);
	var g = gps_msg,
	//insert new waypoint
		insert = client.query({
			text: 'INSERT INTO waypoints '
				+ '(module_id, timestamp, address, lat, long, kph, track, magv) '
				+ 'values($1, $2, $3, $4, $5, $6, $7, $8)',
			values: [g.module_id, g.timestamp, g.address, g.lat, g.long, g.kph, g.track, g.magv]
		}, function (err) {
			if (err) {
				var update = client.query({
					text: 'UPDATE waypoints SET '
						+ 'address = $3, lat = $4, long = $5, kph = $6, track = $7, magv = $8 '
						+ 'WHERE module_id = $1 and timestamp = $2',
					values: [g.module_id, g.timestamp, g.address, g.lat, g.long, g.kph, g.track, g.magv]
				}, error);
			}
		});
	Proto.emit('record', true);
};

Proto.updateModuleList = function (changes) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		setTimeout(function () {
			Proto.updateModuleList(changes);
		}, 2 * 1000); //retry in 2 sec;
		return;
	}
	client.connect(err);
	var add_length,
		add_module,
		rm_length,
		rm_module,
		insert_list,
		update_list;
	if (changes) {
		console.log('[database]'.grey, 'add', changes.add, 'remove', changes.remove);
		add_length = changes.add.length;
		if (add_length > 0) {
			for (i = 0; i < add_length; i + 1) {
				add_module = changes.add[i];
				insert_list = client.query({
					text: 'INSERT INTO modules(module_id, name) values($1, $2)',
					values: [add_module.id, add_module.name]
				}, function (err) {
					if (err) {
						update_list = client.query({
							text: 'UPDATE modules SET name = $2 WHERE module_id = $1',
							values: [add_module.id, add_module.name]
						}, error);
					}
				});
			}
		}
		rm_length = changes.remove.length;
		if (rm_length > 0) {
			for (i = 0; i < rm_length; i + 1) {
				rm_module = changes.remove[i];
				client.query({
					text: 'DELETE FROM waypoints WHERE module_id = $1',
					values: [rm_module.id]
				}, error);
				client.query({
					text: 'DELETE FROM modules WHERE module_id = $1',
					values: [rm_module.id]
				}, error);
			}
		}
		this.getModuleList({'client': 'server'});
	}
};
Proto.getModuleList = function (request) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		setTimeout(function () {
			Proto.getModuleList(request);
		}, 2 * 1000); //retry in 2 sec;
		return;
	}
	client.connect(err);
	var dst = request.client,
		client_id = request.socket_id,
		query_modules;

	console.info('[database]'.grey, 'request module list');

	query_modules = client.query({
		text: 'SELECT * FROM modules'
	}, error);
	/*
	query_modules.on('row', function (row, result) {
		result.addRow(row);
	}, error);*/
	query_modules.on('end', function (result) {
		console.info('[database]'.grey, 'found', result.rows.length, 'in track modules list');
		Proto.emit('modulelist-' + dst, {'socket_id': client_id, 'list': result.rows});
	}, error);
};
Proto.query = function (request) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		setTimeout(function () {
			Proto.query(request);
		}, 2 * 1000); //retry in 2 sec;
		return;
	}
	client.connect(err);
	/*** prepare query parameters ***/
	var begin = request.begin,
		end = request.end,
		module_id = request.module_id,
		client_id = request.socket_id,
	/*** execute query ***/
		query_waypoints = client.query({
			text: 'SELECT * FROM waypoints WHERE module_id = $1 AND timestamp BETWEEN $2 AND $3',
			values: [module_id, begin, end]
		}, error);

	console.log('[database]'.grey, 'Query', module_id, begin, '..', end);
	query_waypoints.on('row', function (row) {
		Proto.emit('result', {'socket_id': client_id, 'result': row});
	});
	query_waypoints.on('end', function (result) {
		console.log('[database]'.grey, 'query complete, found', result.rows.length);
		Proto.emit('end', {'socket_id': client_id, 'count': result.rows.length});
	});
};

console.log('[database]'.grey, 'connecting to'.grey, db_uri);
/** initial connect to Postgres */
client.connect(function (err) {
	if (err) {
		error(err);
		return;
	}
	console.log('[database]'.grey, 'connection to database is', 'OK'.green);

	//create waypoints table if doesn't exists
	client.query({
		text: 'CREATE TABLE waypoints ('
			+ 'module_id	varchar(20),'
			+ 'timestamp	timestamp,'
			+ 'address		varchar(100),'
			+ 'lat		real,'
			+ 'long		real,'
			+ 'kph		real,'
			+ 'track	smallint,'
			+ 'magv		smallint,'
			+ 'PRIMARY KEY (module_id, timestamp))'
	}, error);
	client.query({
		text: 'CREATE TABLE modules ('
			+ 'module_id	varchar(20) PRIMARY KEY,'
			+ 'name		varchar(20))'
	}, error);
	Proto.ready = true;
	Proto.emit('connected');
	//start clenup service to remove old data regularly (24h)
	setInterval(cleanup, 1000 * 3600 * 24);
});


Proto.on('record', function () {
	console.info('[database]'.grey, 'record added');
});


module.exports = Proto;

