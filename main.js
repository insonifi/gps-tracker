var net = require('net');
//var track = require('./kml_track');
var colors = require('colors'),
	queue = require('./queue'),
	redis = require('./redis_db'),
	express = require('express'),
	app = express(),
	socket_session = new Object,
	client_socket,
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	vId = null;

/************************ Update tracking list ************************/
//refresh tracked id list
redis.getList({client: 'server'});
//server tracked id list
redis.on('tracklist-server', function (response) {
	var list = response.list
	queue.isTracked = new Object;
	console.log('[GPS]'.grey, 'updating tracking list:', list);
	for (var i = 0; i < list.length; i++) {
		queue.isTracked[list[i]] = true;
	}
});
/********************** HTTP server ***********************************/
//start HTTP server
server.listen(80);
app.use(express.static(__dirname + '/'));
app.use(function(req, res, next){
	//res.send(404, 'Sorry cant find that!');
	res.status(404).sendfile('img/404.svg');
});
app.get('/', function (req, res) {
	console.log('[HTTP]'.grey, req.path);
  //res.sendfile(__dirname + '/index.html');
});
/******************** Interaction with client *************************/
io.enable('browser client minification');  // send minified client
io.enable('browser client etag');          // apply etag caching logic based on version number
io.enable('browser client gzip');          // gzip the file
io.set('log level', 3);                    // reduce logging

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
setInterval(function () {
	io.sockets.emit('clock', (new Date()).toISOString().slice(11,16));
}, 60000);
queue.on('send-update', function (data) {
	io.sockets.emit('update-waypoint', data);
});
io.sockets.on('connection', function (socket) {
	if (socket.id in socket_session) {
		return
	}
	var global_socket = socket;
	socket_session[socket.id] = socket;
	global_socket.emit('handshake', { welcome: 'GPS Tracker 0.1' });
	global_socket.on('disconnect', function () {
		delete socket_session[this.id];
	});
//query
	global_socket.on('query', function (data) {
		redis.query({'socket_id': socket.id, 'module_id': data.module_id, 'begin': data.start, 'end': data.end});
	});

//update tracklist
	global_socket.on('update-tracklist', function (changes) {
		redis.updateTracklist(changes);
	});
//get tracklist
	global_socket.on('get-tracklist', function () {
		redis.getList({'client': 'client', 'socket_id': socket.id});
	});

});

redis.on('result', function(response) {
	client_socket = socket_session[response.socket_id];
	client_socket.emit('query-waypoint', response.result);
});
redis.on('count', function(response) {
	client_socket = socket_session[response.socket_id];
	client_socket.emit('count', response.count);
});
redis.on('tracklist-client', function (response) {
	client_socket = socket_session[response.socket_id];
	client_socket.emit('tracklist', response.list);
});

/*************************** GPS server *******************************/					
var serverGPS = net.createServer(function(c) { //'connection' listener
	console.log('[GPS]'.grey, 'Connection established');
	queue.notProcessing = true;
	c.on('end', function() {
			console.log('[GPS]'.grey, vId, 'disconnected'.grey);
			vId = null;
		});
	c.write('GPS Tracker 0.1\r\n'); //greet client
	c.on('data', function(chunk) {
		var string = chunk.toString();
		var lines = string.split('\r\n');
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			//console.info('> %s', line);
			if (line[0] == 'I') { //id
				vId = line.slice(1);
				console.log('[GPS]'.grey, vId,'connected'.green);
			}
			if (line[0] == 'D') { //expect to download batch of records//D####
			}
			if (line[0] == '$') {
				queue.add(vId + line);
			}
		}
		c.write('0\r\n'); //respond back
	});
});
serverGPS.listen(process.env.VCAP_APP_PORT || 920, function() { //'listening' listener
  console.log('[GPS]'.grey, 'Server listening'.green);
});
/*
function dump_kmz() {
	var zip = require('node-zip')();
	var fs = require('fs');
	var kml = track.kml();
	var name = new Date().toISOString().slice(0,10);

	zip.file(name + '.kml', kml);
	var data = zip.generate({base64:false,compression:'DEFLATE'});
	fs.writeFile(name + '.kmz', data, 'binary');
}
*/
