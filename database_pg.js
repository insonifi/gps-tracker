var colors = require('colors'),
	pg = require('pg'),
	db_uri = (process.env.OPENSHIFT_POSTGRESQL_DB_URL || 'tcp://127.0.0.1:1234/') + (process.env.OPENSHIFT_APP_NAME || 'gpstracker'),
	client = new pg.Client(db_uri),
	EventEmitter = require('events').EventEmitter,
	Proto = new EventEmitter,
	expire_yr = 2;
	Proto.ready = false;
	
	
console.log('[database]'.grey, 'connecting to'.grey, db_uri);
	
var error = function (err) {
        if (err) {
			console.warn('[database]'.grey, err.message.red);
		} 
 }

var cleanup = function () {
	//delete expired records if any
	console.log('[database]'.grey, 'cleaning up');
	client.query({
		text: 'DELETE FROM waypoints WHERE timestamp (now() - \'$1 years\')::interval',
		values: [expire_yr]
	}, error);
}

//connect to Postgres
client.connect(function (err) {
		if (typeof(err) == 'Error') {
			error(err);
			return;
		}
		console.log('[database]'.grey, 'connected to database'.green);
		
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
	var g = gps_msg;
	//insert new waypoint
	var insert = client.query({
		text: 'INSERT INTO waypoints '
			+ '(module_id, timestamp, address, lat, long, kph, track, magv) '
			+ 'values($1, $2, $3, $4, $5, $6, $7, $8)',
		values: [g.module_id, g.timestamp, g.address, g.lat, g.long, g.kph, g.track, g.magv]
	})
	insert.on('error', function () {
		client.query({
		text: 'UPDATE waypoints SET '
			+ 'address = $3, lat = $4, long = $5, kph = $6, track = $7, magv = $8 '
			+ 'WHERE module_id = $1 and timestamp = $2',
		values: [g.module_id, g.timestamp, g.address, g.lat, g.long, g.kph, g.track, g.magv]
	}, error);
	
	
	Proto.emit('record', true);
	
}

Proto.updateModuleList = function(changes) {
	if (!Proto.ready) {
		console.log('[database]'.grey, 'not ready yet'.red);
		setTimeout(function () {
			Proto.updateModuleList(changes);
		}, 2 * 1000); //retry in 2 sec;
		return;
	}
	if(changes) {
		console.log('[database]'.grey, 'add', changes.add, 'remove', changes.remove);
		var add_length = changes.add.length;
		if (add_length > 0) {
			for (i = 0; i < add_length; i++) {
				var add_module = changes.add[i];
				var update_list = client.query({
					text: 'UPDATE modules SET name = $2 WHERE module_id = $1',
					values: [add_module.id, add_module.name]
				}, error);
				update_list.on('error', function () {
					client.query({
						text: 'INSERT INTO modules(module_id, name) values($1, $2)',
						values: [add_module.id, add_module.name]
					}, error);
				});
			}
		}
		var rm_length = changes.remove.length;
		if (rm_length > 0) {
			for (i = 0; i < rm_length; i++) {
				var rm_module = changes.remove[i];
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
		text: 'SELECT * FROM modules'
	}, error));
	
	query_modules.on('row', function (row, result) {
		result.addRow(row);
	}, error));
	query_modules.on('end', function(result) {
		console.info('[database]'.grey, 'found', list == undefined ? '0' : list.length, 'in track modules list');
		Proto.emit('modulelist-' + dst, {'socket_id': client_id, 'list': result.rows});
	}, error));
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
	var begin = request.begin,
		end = request.end,
		module_id = request.module_id,
		client_id = request.socket_id;
	console.log('[database]'.grey, 'Query', module_id, begin, '..', end);
	/*** execute query ***/

	var query_waypoints = client.query({
		text: 'SELECT * FROM waypoints WHERE module_id = $1 AND timestamp BETWEEN $2 AND $3',
		values: [module_id, begin, end]
	}, error);
	query_waypoints.on('row', function (row) {
		Proto.emit('result', {'socket_id': client_id, 'result': row});
	});
	query_waypoints.on('end', function(result) {
		console.log('[database]'.grey, 'query complete, found', result.rowCount);
		Proto.emit('end', {'socket_id': client_id, 'count': result.rowCount});
	});
}

module.exports = Proto;

