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
	},
	addressLookup = function (temp) {
		var lat = temp.coords.lat,
			lng = temp.coords.lng,
			options = {
				hostname: 'maps.googleapis.com',
				port: 80,
				path: '/maps/api/geocode/json?latlng=' + lat + ',' + lng
					+ '&sensor=false',
				method: 'GET'
			},
			data = '',
			request = http.request(options, function (res) {
				res.on('data', function (chunk) {
					data += chunk;
				});
				res.on('end', function () {
					var response = JSON.parse(data.toString());
					switch (response.status) {
                        case 'OK':
                            temp.coords.address = getAddressString(response);
                            Proto.emit('got-address', temp); /* return address */
                            console.error('[google]'.grey, response.status.green, temp.coords.address);
                            return;
                        case 'ZERO_RESULTS':
                            Proto.emit('got-address', ''); /* return empty string */
                            return;
                        default:
                            setTimeout(function () {
                                Proto.emit('lookup-address', temp); /* retry */
                            }, delay);
                            console.error('[google]'.grey, response.status.red, 'retry in', delay);
                            return;
					}
				});
			});
		console.log('[google]'.grey, (options.hostname + options.path).grey);
		request.on('error', function (err) {console.log('[google]'.grey, err.red); });
		request.end();
	};

Proto.on('lookup-address', addressLookup);

module.exports = Proto;
