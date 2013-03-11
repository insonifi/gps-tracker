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
	console.log('[google]'.grey, (options.hostname + options.path).grey);
	var request = http.request(options, function(res) {
		res.on('data', function(chunk) {
			data += chunk;
		});
		res.on('end', function () {
			response = JSON.parse(data.toString());
			if ('OK' == response.status) {
				gps_msg.address = getAddressString(response);
				console.error('[google]'.grey, response.status.green, gps_msg.address);
			} else {
				console.error('[google]'.grey, response.status.red);
			}
			Proto.emit('address', gps_msg);
		});
	});
	request.on('error', function (err) {console.log('[google]'.grey, err.red)});
	request.end();
}
module.exports = Proto

function getAddressString(lookup) {
	var address = new Object;
	var components = lookup.results[0].address_components;
	for (var i = 0; i < components.length; i++) {
		component = components[i];
		if(component.types.indexOf('route') != -1) address.street = component.long_name;
		if(component.types.indexOf('street_number') != -1) address.number = component.long_name;
		if(component.types.indexOf('locality') != -1) address.locality = component.long_name;
	}
	return address.street + ' ' + address.number + ', ' + address.locality;
}
