'use strict';
var http = require('http'),
	EventEmitter = require('events').EventEmitter,
	Proto = new EventEmitter(),
	i,
	delay = 1000, /*introduce some interval to avoid OVER_QUERY_LIMIT*/
	getAddressString = function (lookup) {
		var address = {},
			component,
			components = lookup.results[0].address_components,
			components_len = components.length;
		for (i = 0; i < components_len; i += 1) {
			component = components[i];
			if (component.types.indexOf('route') !== -1) {address.street = component.long_name; }
			if (component.types.indexOf('street_number') !== -1) {address.number = component.long_name; }
			if (component.types.indexOf('locality') !== -1) {address.locality = component.long_name; }
		}
		//return address string replacing undefined with empty string
		return (address.street === undefined ? '' : address.street)
			+ (address.number === undefined ? '' : ' ' + address.number)
			+ (address.locality === undefined ? '' : ', ' + address.locality);
	};

Proto.addressLookup = function (gps_msg) {
	var options = {
			hostname: 'maps.googleapis.com',
			port: 80,
			path: '/maps/api/geocode/json?latlng=' + gps_msg.lat + ',' + gps_msg.long
				+ '&sensor=false',
			method: 'GET'
		},
		data = '',
		response,
		request = http.request(options, function (res) {
			res.on('data', function (chunk) {
				data += chunk;
			});
			res.on('end', function () {
				response = JSON.parse(data.toString());
				if ('OK' === response.status) {
					gps_msg.address = getAddressString(response);
					console.error('[google]'.grey, response.status.green, gps_msg.address);
				} else {
					console.error('[google]'.grey, response.status.red);
					setTimeout(function () {
						Proto.addressLookup(gps_msg);
					}, delay)
				}
				Proto.emit('address', gps_msg);
			});
		});
	console.log('[google]'.grey, (options.hostname + options.path).grey);
	request.on('error', function (err) {console.log('[google]'.grey, err.red); });
	request.end();
};
module.exports = Proto;
