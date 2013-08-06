#!/usr/bin/env node
'use strict';
var net = require('net');
var colors = require('colors'),
	database = require('./database_pg'),
	express = require('express'),
	mapApi = require('./map_api'),
	nmea = require('./nmea'),
    mq = require('./mq'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	socket_session = {},
	client_socket,
	auth = require('./pwdhash'),
	i,
	ip,
	isTracked = {},
	port,
	hash,
	vId,
	processor = function (string) {
		var id,
			gpstext,
			gps_msg = {},
			marker_position;
		if (!string) {
			return;
		}
		marker_position = string.indexOf('$');
		id = string.slice(0, marker_position);
		gpstext = string.slice(marker_position);
		/* do we track this module */
		if (!isTracked[id]) {
			console.error('[processor]'.grey, 'not tracking'.red, id, '-- not processing!'.red);
			return;
		}
		/* parse GPS message */
		gps_msg = nmea.parse(gpstext);
		if (gps_msg.isValid) {
			gps_msg.module_id = id;
			database.addRecord(gps_msg);
			io.sockets.emit('update-waypoint', gps_msg);
		};
    
	},
    getBody = function (req, res, next) {
        req.body = '';
        req.setEncoding('utf8');
        req.on('data', function(chunk) { 
           req.body += chunk;
        });
        req.on('end', function() {
            next();
        });
    };
/************************ Update tracking list ************************/
/* refresh tracked id list */
database.on('connected', function () {
	database.getModuleList({client: 'server'});
});
/* server tracked id list */
database.on('modulelist-server', function (response) {
	var list = response.list,
		length = list.length;
	console.log('[GPS]'.grey, 'updating tracked modules list:\n', list);
	if (!list) {return; }
	for (i = 0; i < length; i += 1) {
		isTracked[list[i].module_id] = true;
	}
});
/********************** HTTP server ***********************************/
/* start HTTP server */
ip = process.env.IP; /* process.env.OPENSHIFT_NODEJS_IP  || '127.0.0.1'; */
port = process.env.PORT /*process.env.OPENSHIFT_NODEJS_PORT || 80; */
server.listen(port, ip);
app.on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
        console.log("[express]".grey, "Address in use, trying again...");
        setTimeout(function () {
            app.close();
            app.listen(port, ip);
        }, 1000);
    } else if (err.code === 'EACCES') {
        console.log("[express".grey, "You don't have permissions to bind to this address. Try running via sudo.");
    } else {
        console.log("[express]".grey, err);
    }
});
app.use(express.compress());
/* app.use(express.logger()); */
app.use(express.static(__dirname));
app.get('/', function (req, res) {
  res.redirect('/app')
});
app.use('/pushq', getBody);
app.post('/pushq', function (req, res) {
    console.log('[IronMQ]'.white, req.body);
    res.send(200);
})
app.use(function (req, res, next) {
	/* res.send(404, 'Sorry cant find that!'); */
	res.status(404).sendfile('/notfound.html');
});

/*********************** Event pool with Socket.IO ****************************/
io.enable('browser client minification');  /*  send minified client */
io.enable('browser client etag');          /*  apply etag caching logic based on version number */
io.enable('browser client gzip');          /*  gzip the file */
io.set('log level', 1);                    /*  reduce logging */

/* enable all transports (optional if you want flashsocket support, please note that some hosting
 * providers do not allow you to create servers that listen on a port different than 80 or their
 * default port) */
io.set('transports', [
    'websocket'
  /*, 'htmlfile'
   *, 'xhr-polling'
   *, 'jsonp-polling' */
]);
/********************/
/* clock */
setInterval(function () {
	io.sockets.emit('clock', (new Date()).valueOf());
}, 60000);

io.sockets.on('connection', function (socket) {
	if (socket_session[socket.id]) {
		return;
	}
	var global_socket = socket;
	socket_session[socket.id] = socket;
	global_socket.emit('handshake', { welcome: 'GPS Tracker 0.1' });
	global_socket.on('handshake', function (message) {
		console.log('[socket]'.grey, message.welcome, 'connected'.green);
	});
	global_socket.on('disconnect', function () {
		console.log('[socket]'.grey, 'socket disconnected');
		delete socket_session[this.id];
	});
/* received trackdata */
	global_socket.on('gps-message', function (message) {
		processor(message);
	});
/* query */
	global_socket.on('query', function (data) {
		var request = {
			'socket_id': socket.id,
			'module_id': data.module_id,
			'begin': data.start,
			'end': data.end
		};
		database.query(request);
	});

/* update tracklist */
	global_socket.on('update-modulelist', function (changes) {
		if (changes.hash === auth.hash) {
			console.log('[socket]'.grey, 'update accepted'.green);
			database.updateModuleList(changes);
		}
	});
/* get tracklist */
	global_socket.on('get-modulelist', function () {
		var request = {
			'socket_id': socket.id,
			'client': 'client'
		};
		database.getModuleList(request);
	});
/* lookup address */
	global_socket.on('get-address', function (coords) {
		var request = {
			'socket_id': socket.id,
			'coords': coords
		};
		database.getAddress(request);
	});
});

database.on('result', function (response) {
	client_socket = socket_session[response.socket_id];
	client_socket.emit('query-waypoint', response.result);
});
database.on('end', function (response) {
	client_socket = socket_session[response.socket_id];
	client_socket.emit('query-end', response.count);
});
database.on('send-address', function (response) {
	client_socket = socket_session[response.socket_id];
	client_socket.emit('result-address', response.coords);
});
database.on('modulelist-client', function (response) {
	client_socket = socket_session[response.socket_id];
	client_socket.emit('modulelist', response.list);
});
