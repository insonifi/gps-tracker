var colors = require('colors'),
	pg = require('pg'),
	db_uri = (process.env.OPENSHIFT_POSTGRESQL_DB_URL || 'tcp://127.0.0.1:1234/') + (process.env.OPENSHIFT_APP_NAME || 'gpstracker'),
	client = new pg.Client(db_uri),
	EventEmitter = require('events').EventEmitter,
	Proto = new EventEmitter,
	expire_yr = 2;
	Proto.ready = false;
	
	
console.log('[database]'.grey, 'connecting to'.grey, db_uri);
	
function error(err) {
        if (err) {
			console.warn('[database]'.grey, err.message.red);
		} 
 }

//connect to Postgres
client.connect(function (err) {
		if (typeof(err) == 'Error') {
			error(err);
			return;
		}
		console.log('[database]'.grey, 'connected to database');
		
		//create waypoints table if doesn't exists
		client.query({
			text: 'CREATE TABLE waypoints ('
			+ 'module_id	varchar(20),'
			+ 'timestampt	timestamp,'
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
});


Proto.on('record', function() {
	console.info('[database]'.grey, 'record added');
});

Proto.addRecord = function(gps_msg) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		setTimeout(function () {
			Proto.addRecord(gps_msg);
		}, 2 * 1000); //retry in 2 sec;
		return;
	}
	var client = Proto.client,
		g = gps_msg;
	//insert new waypoint
	client.query({
		text: 'INSERT INTO waypoints '
			+ '(module_id, timestamp, address, lat, long, kph, track, magv) '
			+ 'values($1, $2, $3, $4, $5, $6, $7, $8)',
		values: [g.module_id, g.timestamp, g.address, g.lat, g.long, g.kph, g.track, g.magv]
	}, error);
	Proto.emit('record', true);
	//delete expired records if any
	client.query({
		text: 'DELETE waypoints WHERE timestamp (now() - \'$1 years\'::interval)',
		values: [expire_yr]
	}, error);
}

Proto.updateModuleList = function(changes) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		setTimeout(function () {
			Proto.updateModuleList(changes);
		}, 2 * 1000); //retry in 2 sec;
		return;
	}
	var client = Proto.client;
	if(changes) {
		console.log('[database]'.grey, 'add', changes.add, 'remove', changes.remove);
		if (changes.add.length > 0) {
			for (i = 0; i < changes.add.length; i++) {
				var add_module = changes.add[i];
				client.query({
					text: 'UPDATE modules SET name = $2 WHERE module_id = $1',
					value: [add_module.id, add_module.name]
				}, error);
				client.query({
					text: 'INSERT INTO modules(module_id, name) value($1, $2)',
					value: [add_module.id, add_module.name]
				}, error);
			}
		}
		if (changes.remove.length > 0) {
			for (i = 0; i < changes.remove.length; i++) {
				var rm_module = changes.remove[i];
				client.query({
					text: 'DELETE FROM waypoints WHERE module_id = $1',
					value: [rm_module.id]
				}, error);
				client.query({
					text: 'DELETE FROM modules WHERE module_id = $1',
					value: [rm_module.id]
				}, error);
				
			}
		}
		this.getModuleList({'client': 'server'});
	}
}
Proto.getModuleList = function(request) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		setTimeout(function () {
			Proto.getModuleList(request);
		}, 2 * 1000); //retry in 2 sec;
		return;
	}
	var dst = request.client,
		client_id = request.socket_id,
		list = [];

	console.info('[database]'.grey, 'request module list');
	
	var query_modules = client.query({
		text: 'SELECT id, name FROM modules'
	}, error);
	
	query_modules.on('row', function (row) {
		list.push(row)
	}, error);
	query_modules.on('end', function() {
		console.info('[database]'.grey, 'found', list == undefined ? '0' : list.length, 'in track modules list');
		Proto.emit('modulelist-' + dst, {'socket_id': client_id, 'list': list});
	});
}

Proto.query = function(request) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		setTimeout(function () {
			Proto.query(request);
		}, 2 * 1000); //retry in 2 sec;
		return;
	}
	/*** prepare query parameters ***/
	var begin = request.begin;
	var end = request.end;
	var module_id = request.module_id;
	var client_id = request.socket_id;
	console.log('[database]'.grey, 'Query', module_id, begin, '..', end);
	/*** execute query ***/

	var query_waypoints = client.query({
		text: 'SELECT * FROM waypoints WHERE module_id = $1 AND timestamp BETWEEN $2 AND $3',
		values: [module_id, begin, end]
	}, error);
	query_waypoints.on('row', function (row) {
		count++;
		Proto.emit('result', {'socket_id': client_id, 'result': row});
	});
	query_waypoints.on('end', function() {
		console.log('[database]'.grey, 'query complete, found', count);
		Proto.emit('count', {'socket_id': client_id, 'count': count});
	});
}

module.exports = Proto;

