module.exports.addressLookup = function (long, lat) {
	var http = require('http');
	var data = {};
	var options = {
		hostname: 'maps.googleapis.com',
		port: 80,
		path: '/maps/api/geocode/json?latlng=' + lat + ',' + long + '&sensor=false',
		method: 'GET'
	}
	
	var request= http.request(options, function(res) {
		if (res.statusCode == 200) {
			res.on('data', function(chunk) {
				address = JSON.parse(chunk).results;
			});
		} else {
			return 'HTTP connection error'
		}
	}
	return address[0].formatted_address;
}
