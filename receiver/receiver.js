var net = require('net'),
	io = require('socket.io').listen(server),
	colors = require('colors');
/*************************** GPS server *******************************/					
var serverGPS = net.createServer(function(c) { //'connection' listener
	console.log('[GPS]'.grey, 'Connection established');
	//queue.notProcessing = true;
	c.on('end', function() {
			console.log('[GPS]'.grey, vId, 'disconnected'.grey);
			vId = null;
		});
	c.write('GpsTsc v3.2.15\r\n'); //greet client
	c.on('data', function(chunk) {
		var string = chunk.toString();
		var lines = string.split('\r\n');
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			//console.info('> %s', line);
			if (line[0] == 'I') { //id
				vId = line.slice(1);
				console.log('[GPS]'.grey, vId, 'connected'.green);
				continue
			}
			if (line[0] == 'D') { //expect to download batch of records//D####
				console.log('[GPS]'.grey, vId, 'uploads %s coordinates', line.slice(1));
				continue
			}
			if (line[0] == 'Q') {
				console.log('[GPS]'.grey, vId, 'seen at', (new Date).toISOString());
				continue
			}
			if (line[0] == 'M') {
				//not implemeted, don't what this is:
				//M98:000000,V,9900.000,N,00000.000,W,000.0,000,000000,010*47
				continue
			}
			if (line[0] == '$') {
				//queue.add(vId + line); //add to parse queue
				console.log(line);
				continue
			}
		}
		c.write('0\r\n'); //respond back
	});
});
serverGPS.listen(process.env.VCAP_APP_PORT || 920, function() { //'listening' listener
  console.log('[GPS]'.grey, 'Server listening'.green);
});

/******************** Interaction with server *************************/
io.enable('browser client minification');  // send minified client
io.enable('browser client etag');          // apply etag caching logic based on version number
io.enable('browser client gzip');          // gzip the file
io.set('log level', 2);                    // reduce logging

// enable all transports (optional if you want flashsocket support, please note that some hosting
// providers do not allow you to create servers that listen on a port different than 80 or their
// default port)
io.set('transports', [
    'websocket'
]);