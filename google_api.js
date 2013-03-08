var http = require('http');
var EventEmitter = require('events').EventEmitter;
var Proto = new EventEmitter;

Proto.addressLookup = function (gps_msg) {
	var options = {
		hostname: 'maps.googleapis.com',
		port: 80,
		path: '/maps/api/geocode/json?latlng=' + gps_msg.lat + ',' + gps_msg.long
			+ '&sensor=false',
		method: 'GET'
	}
	var data = '';
	console.log('[google] ' + options.hostname + options.path);
	var request = http.request(options, function(res) {
		res.on('data', function(chunk) {
			data += chunk;
		});
		res.on('end', function () {
			response = JSON.parse(data.toString());
			if ('OK' == response.status) {
				gps_msg.address = response.results[0].formatted_address;
				console.error('[google] ' + response.status + ': ' + gps_msg.address);
			} else {
				console.error('[google] ' + response.status);
			}
			Proto.emit('address', gps_msg);
		});
	});
	request.on('error', function (err) {console.log(err)});
	request.end();
}
module.exports = Proto
