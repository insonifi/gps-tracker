#!/usr/bin/env node
'use strict';
var net = require('net');
var colors = require('colors'),
	express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	socket_session = {},
	client_socket,
	hash = null,
	vId = null,
	i;
/********************** HTTP server ***********************************/
//start HTTP server
var ip = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var port = process.env.OPENSHIFT_NODEJS_PORT || 80;
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
app.use(express.static(__dirname));
app.use(function (req, res, next) {
	console.log('[HTTP]'.grey, req.url);
	next();
  //res.sendfile(__dirname + '/index.html');
});
app.use(function (req, res, next) {
	//res.send(404, 'Sorry cant find that!');
	res.status(404).sendfile(__dirname + '/notfound.html');
});
app.get('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
});

