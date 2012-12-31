var net = require('net');
var nmea = require('./nmea.js');
var track = require('./kml_track.js');

var server = net.createServer(function(c) { //'connection' listener
	console.log('---');
	c.on('end', function() {
			console.log('##');
		});
	c.write('GpsTsc v3.2.15\r\n');
	c.on('data', function(chunk) {
		var string = chunk.toString();
		var lines = string.split('\n');
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			console.info('> ' + line);
			if (line[0] == '$') {
				var gps_msg = nmea.parse(line);
				if (gps_msg.isValid) {
					track.add(gps_msg);
					//console.log(JSON.stringify(gps_msg));
				}
			}
			if (line == 'kml') {
				console.log('<' + track.kml());
			}
			if (line == 'maplink') {
				console.log('<' + track.maplink());
			}
			if (line == 'dump_kmz') {
				dump_kmz();
			}
		}
		c.write('0\r\n');
	});
});
server.listen(process.env.VCAP_APP_PORT || 920, function() { //'listening' listener
  console.log('++');
});

function dump_kmz() {
	var zip = require('node-zip')();
	var fs = require('fs');
	var kml = track.kml();
	var name = new Date().toISOString().slice(0,10);

	zip.file(name + '.kml', kml);
	var data = zip.generate({base64:false,compression:'DEFLATE'});
	fs.writeFile(name + '.kmz', data, 'binary');
}
