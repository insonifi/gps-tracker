'use strict';
var colors = require('colors'),
	pg = require('pg'),
	db_uri = (process.env.OPENSHIFT_POSTGRESQL_DB_URL || 'pg://localhost') + '/' + (process.env.OPENSHIFT_APP_NAME || 'gpstracker'),
	EventEmitter = require('events').EventEmitter,
	Proto = new EventEmitter(),
	i,
	mapApi = require('./map_api'),
	connect = function () {
		pg.connect(function (err, client) {
			if (err) {
				console.log('[database]'.grey, 'reconnect'.red);
				setTimeout(function () {
					connect();
				}, 2 * 1000); //retry in 2 sec;
			}
			Proto.client = client;
		});
	},
	error = function (err) {
		if (err) {
			console.warn('[database]'.grey, err.message.red);
		}
	},
	cleanup = function () {
		if (!Proto.client) {
			console.log('[database]'.grey, 'not ready yet'.red);
			setTimeout(function () {
				cleanup();
			}, 2 * 1000); //retry in 2 sec;
			return;
		}
        var expire = 2 * 3600 * 1000 * 24 * 365, //two years
            now = (new Date()).valueOf();
		//delete expired records if any
		console.log('[database]'.grey, 'cleaning up');
		Proto.client.query({
			text: 'DELETE FROM waypoints WHERE timestamp <@ lseg(POINT($1,0), POINT($2,0))',
			values: [0, now - expire]
		}, error);
		Proto.client.query({text: 'VACUUM'}, error);
	},
	init_db = function () {
		if (!Proto.client) {
			console.log('[database]'.grey, 'not ready yet'.red);
			setTimeout(function () {
				init_db();
			}, 2 * 1000); //retry in 2 sec;
			return;
		}
		console.log('[database]'.grey, 'connection to database is', 'OK'.green);
		//create waypoints table if doesn't exists
		Proto.client.query({
			text: 'CREATE TABLE waypoints ('
				+ 'module_id	varchar(20),'
				+ 'timestamp	point,'
				+ 'address	    varchar(100),'
				+ 'coords	    point,'
				+ 'kph		    real,'
				+ 'track	    smallint,'
				+ 'magv		    smallint'
				+ ')'
		}, error);
		Proto.client.query({
			text: 'CREATE INDEX coords_idx ON waypoints USING gist (timestamp)'
		}, error);
		Proto.client.query({
			text: 'CREATE TABLE modules ('
				+ 'module_id	varchar(20) PRIMARY KEY,'
				+ 'name		    varchar(20))'
		}, error);
		Proto.ready = true;
		Proto.emit('connected');
	};

pg.on('error', function (err) {
	error(err);
	Proto.ready = false;
	connect();
});

mapApi.on('got-address', function (response) {
	Proto.setAddress(response.coords);
	Proto.emit('send-address', response);
});

Proto.ready = false;

Proto.addRecord = function (gps_msg) {
	if (!Proto.client) {
		console.log('[database]'.grey, 'not ready yet'.red);
		setTimeout(function () {
			Proto.addRecord(gps_msg);
		}, 2 * 1000); //retry in 2 sec;
		return;
	}
	var g = gps_msg,
	    /* insert new waypoint */
		insert = Proto.client.query({
			text: 'INSERT INTO waypoints '
				+ '(module_id, timestamp, coords, kph, track, magv) '
				+ 'VALUES ($1, POINT($2, 0), POINT($3, $4), $5, $6, $7)',
			values: [g.module_id, g.timestamp, g.lat, g.long, g.kph, g.track, g.magv]
		}, function (err) {
			if (err) {
                var keyExists = '23505';
                if (err.code === keyExists) {
                    console.log('[database]'.grey, 'ignore duplicate');
                    /* var update = Proto.client.query({
                    * 	text: 'UPDATE waypoints SET '
                    * 		+ 'coords = POINT($3, $4), kph = $5, track = $6, magv = $7 '
                    * 		+ 'WHERE module_id = $1 and timestamp ~= POINT($2, 0)',
                    * 	values: [g.module_id, g.timestamp, g.lat, g.long, g.kph, g.track, g.magv]
                    * }, error);
                    */
                } else {
                    console.log('[database]'.grey, err);
                }
			}
		});
		insert.on('end', function (result) {
            /* insertion confirmed */
            Proto.emit('record', true);
            if (process.env.DEBUG_RECORD) {
                console.info('[database]'.grey, result.rowCount, 'record added', 
                    '(', [g.module_id, g.lat, g.long, (new Date(g.timestamp)).toISOString()].toString().grey, ')'
                );
		    }
		})
};

Proto.updateModuleList = function (changes) {
	if (!Proto.client) {
		console.log('[database]'.grey, 'not ready yet'.red);
		setTimeout(function () {
			Proto.updateModuleList(changes);
		}, 2 * 1000); //retry in 2 sec;
		return;
	}
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
			for (i = 0; i < add_length; i += 1) {
				add_module = changes.add[i];
				insert_list = Proto.client.query({
					text: 'INSERT INTO modules(module_id, name) VALUES($1, $2)',
					values: [add_module.id, add_module.name]
				}, function (err) {
					if (err) {
                        var keyExists = '23505';
                        if (err.code === keyExists) {
                            update_list = Proto.client.query({
                                text: 'UPDATE modules SET name = $2 WHERE module_id = $1',
                                values: [add_module.id, add_module.name]
                            }, error);
					    }
					}
				});
			}
		}
		rm_length = changes.remove.length;
		if (rm_length > 0) {
			for (i = 0; i < rm_length; i += 1) {
				rm_module = changes.remove[i];
				Proto.client.query({
					text: 'DELETE FROM waypoints WHERE module_id = $1',
					values: [rm_module.id]
				}, error);
				Proto.client.query({
					text: 'DELETE FROM modules WHERE module_id = $1',
					values: [rm_module.id]
				}, error);
			}
		}
		Proto.getModuleList({'client': 'server'});
	}
};
Proto.getModuleList = function (request) {
	if (!Proto.client) {
		console.log('[database]'.grey, 'not ready yet'.red);
		setTimeout(function () {
			Proto.getModuleList(request);
		}, 2 * 1000); //retry in 2 sec;
		return;
	}
	var dst = request.client,
		client_id = request.socket_id,
		query_modules;

	console.info('[database]'.grey, 'request module list');

	query_modules = Proto.client.query({
		text: 'SELECT * FROM modules'
	}, error);
	query_modules.on('end', function (result) {
		console.info('[database]'.grey, 'found', result.rowCount, 'in tracked modules list');
		Proto.emit('modulelist-' + dst, {'socket_id': client_id, 'list': result.rows});
	}, error);
};

Proto.setAddress = function(coords) {
	var address = coords.address,
		update = Proto.client.query({
			text: 'UPDATE waypoints SET '
				+ 'address = $1'
				+ 'WHERE coords ~= POINT($2, $3)',
			values: [address, coords.lat, coords.long]
		}, error);
	console.log('[database]'.grey, 'cache address:', address, '(', coords.lat, coords.long, ')');
}

Proto.getAddress = function (req) {
	var response = {'socket_id': req.socket_id,
			'coords': req.coords
		},
		query = Proto.client.query({
			text: 'SELECT address FROM waypoints WHERE coords ~= POINT($1, $2) AND address != \'\' LIMIT 1',
			values: [req.coords.lat, req.coords.long]
		}, error);
	console.log('[database]'.grey, 'lookup address', '(', req.coords.lat, req.coords.long, ')')
	query.on('end', function (result) {
		if (result.rowCount > 0) {
			response.coords.address = result.rows[0].address;
			Proto.emit('send-address', response);
			console.log('[database]'.grey, 'found address', '(', req.coords.lat, req.coords.long, ')');
		} else {
			console.log('[database]'.grey, 'no address in database', '(', req.coords.lat, req.coords.long, ')');
			mapApi.emit('lookup-address', req);
		}
	});
}

Proto.queryPeriod = function (request) {
  /*** prepare and validate query ***/
  var Query = function (request) {
        var params = ['start', 'end', 'module_id', 'type'],
            idx,
            length = params.length;
        request.isValid = true;
        for (idx = 0; idx < length; idx += 1) {;
            if (!request[params[idx]]) {
                request.isValid = false;
                break;
            }
        }
        return request;
    }(request),
    response = {
        'module_id': request.module_id,
        'socket_id': request.socket_id
		};

    if (!Query.isValid) {
        console.log('[database]'.grey, 'query invalid', Query);
        return;
    }
    
    /*** check database connection ***/
    if (!Proto.client) {
        console.log('[database]'.grey, 'not ready yet'.red);
        setTimeout(function () {
            Proto.query(request);
        }, 2 * 1000); //retry in 2 sec;
        return;
    }
	/*** execute query ***/
	var query_waypoints = Proto.client.query({
		text: 'SELECT module_id, timestamp[0], address, coords[0] AS "lat", coords[1] AS "long", kph, track, magv' 
            + ' FROM waypoints'
            + ' WHERE module_id = $1 AND timestamp <@ lseg(POINT($2,0), POINT($3,0))',
		values: [Query.module_id, Query.start, Query.end]
	}, error);

	console.log('[database]'.grey, 'Query:', Query.module_id, '(', Query.start, '..', Query.end, '), type:', Query.type);
    query_waypoints.on('row', function (row) {
        response.result = row;
        if(request.type === 'progressive') {
            Proto.emit('single-result', response);
        }
    });
	query_waypoints.on('end', function (result) {
		response.count = result !== undefined ? result.rowCount : 0;
		console.log('[database]'.grey, 'query complete, found', response.count);
		Proto.emit('end-result', response);
	});
};

Proto.queryArea = function (request) {
  /*** prepare and validate query ***/
  var Query = function (request) {
        var params = ['coordsA', 'coordsB', 'module_id', 'type'],
            idx,
            length = params.length;
        request.isValid = true;
        for (idx = 0; idx < length; idx += 1) {;
            if (!request[params[idx]]) {
                request.isValid = false;
                break;
            }
        }
        return request;
    }(request),
    response = {
        'module_id': request.module_id,
        'socket_id': request.socket_id
    };

    if (!Query.isValid) {
        console.log('[database]'.grey, 'query invalid', Query);
        return;
    }
    
    /*** check database connection ***/
    if (!Proto.client) {
        console.log('[database]'.grey, 'not ready yet'.red);
        setTimeout(function () {
            Proto.query(request);
        }, 2 * 1000); //retry in 2 sec;
        return;
    }
	/*** execute query ***/
	var query_waypoints = Proto.client.query({
		text: 'SELECT module_id, timestamp[0], address, coords[0] AS "lat", coords[1] AS "long", kph, track, magv' 
            + ' FROM waypoints'
            + ' WHERE module_id = $1 AND coords <@ box(POINT($2,$3), POINT($4,$5))',
		values: [Query.module_id, Query.coordsA.lat, Query.coordsA.long, Query.coordsB.lat, Query.coordsB.long]
	}, error);

	console.log('[database]'.grey, 'Query:',
        Query.module_id, '(',
            Query.coordsA.lat, ',', Query.coordsA.long,
            Query.coordsB.lat, ',', Query.coordsB.long,
        '), type:', Query.type
    );
    query_waypoints.on('row', function (row) {
        response.result = row;
        if(request.type === 'progressive') {
            Proto.emit('single-result', response);
        }
    });
	query_waypoints.on('end', function (result) {
		response.count = result !== undefined ? result.rowCount : 0;
		console.log('[database]'.grey, 'query complete, found', response.count);
		Proto.emit('end-result', response);
	});
};

/** initial connect to Postgres */
connect();
console.log('[database]'.grey, 'connecting to'.grey, db_uri);
init_db();
//start clenup service to remove old data regularly (24h)
setInterval(cleanup, 1000 * 3600 * 24);

module.exports = Proto;

