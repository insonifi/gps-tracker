#!/usr/bina/env node
var net = require('net');
//var track = require('./kml_track');
var colors = require('colors'),
	queue = require('./queue'),
	database = require('./database'),
	express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	socket_session = {},
	client_socket,
	vId = null;

/************************ Update tracking list ************************/
//refresh tracked id list
database.on('connected', function () {
	database.getModuleList({client: 'server'});
});
//server tracked id list
database.on('modulelist-server', function (response) {
	var list = response.list
	queue.isTracked = {};
	console.log('[GPS]'.grey, 'updating tracked modules list:', list);
	if (list == undefined) return;
	for (var i = 0; i < list.length; i++) {
		queue.isTracked[list[i].id] = true;
	}
});
/********************** HTTP server ***********************************/
//start HTTP server
server.listen(process.env.OPENSHIFT_NODEJS_PORT, process.env.OPENSHIFT_NODEJS_IP);
app.on('error', function (err) {
    if (err.code == 'EADDRINUSE') {
        logger("[express]".grey, "Address in use, trying again...");
        setTimeout(function () {
            app.close();
            app.listen(process.env.OPENSHIFT_NODEJS_PORT, process.env.OPENSHIFT_NODEJS_IP);
        }, 1000);
    } else if (e.code == 'EACCES') {
        console.log("[express".grey, "You don't have permissions to bind to this address. Try running via sudo.");
    } else {
        console.log("[express]".grey, err);
    }
});
app.use(express.compress());
app.use(express.static(__dirname));
app.use(function (req, res, next) {
	console.log('[HTTP]'.grey, req.url);
	next();
  //res.sendfile(__dirname + '/index.html');
});
app.use(function(req, res, next){
	//res.send(404, 'Sorry cant find that!');
	res.status(404).sendfile('notfound.html');
});
app.get('/', function(req, res){
  res.sendfile(__dirname + '/index.html');
});
/*********************** Event pool with Socket.IO ****************************/
io.enable('browser client minification');  // send minified client
io.enable('browser client etag');          // apply etag caching logic based on version number
io.enable('browser client gzip');          // gzip the file
io.set('log level', 1);                    // reduce logging

// enable all transports (optional if you want flashsocket support, please note that some hosting
// providers do not allow you to create servers that listen on a port different than 80 or their
// default port)
io.set('transports', [
    'websocket'
  , 'flashsocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
]);
/********************/
//clock
setInterval(function () {
	io.sockets.emit('clock', (new Date).valueOf());
}, 60000);
queue.on('send-update', function (data) {
	io.sockets.emit('update-waypoint', data);
});
io.sockets.on('connection', function (socket) {
	console.log('[socket]'.grey, 'new socket connected');
	if (socket.id in socket_session) {
		return
	}
	var global_socket = socket;
	socket_session[socket.id] = socket;
	global_socket.emit('handshake', { welcome: 'GPS Tracker 0.1' });
	global_socket.on('disconnect', function () {
		console.log('[socket]'.grey, 'socket disconnected');
		delete socket_session[this.id];
});
//received trackdata
	global_socket.on('gps-message', function (message) {
		queue.add(message);
	});
//query
	global_socket.on('query', function (data) {
		database.query({'socket_id': socket.id, 'module_id': data.module_id, 'begin': data.start, 'end': data.end});
	});

//update tracklist
	global_socket.on('update-modulelist', function (changes) {
		database.updateModuleList(changes);
	});
//get tracklist
	global_socket.on('get-modulelist', function () {
		database.getModuleList({'client': 'client', 'socket_id': socket.id});
	});

});

database.on('result', function(response) {
	client_socket = socket_session[response.socket_id];
	client_socket.emit('query-waypoint', response.result);
});
database.on('count', function(response) {
	client_socket = socket_session[response.socket_id];
	client_socket.emit('count', response.count);
});
database.on('modulelist-client', function (response) {
	client_socket = socket_session[response.socket_id];
	client_socket.emit('modulelist', response.list);
});
