wait = true;
address = 'no';

module.exports.addressLookup = function (lat, long) {
	wait = true;
	lookup(lat, long);
	
	
	return address;
}

function lookup(lat, long) {
	var http = require('http');
	var data = '';
	address = 'no'
	var options = {
		hostname: 'maps.googleapis.com',
		port: 80,
		path: '/maps/api/geocode/json?latlng=' + lat + ',' + long + '&sensor=false',
		method: 'GET'
	};

	var request= http.request(options, function(res) {
		res.on('data', function(chunk) {
			data += chunk;
		});
		res.on('end', function () {			
			address = JSON.parse(data.toString()).results[0].formatted_address;
			console.log(address);
			console.log('Got address');
			wait = false;
		});
	});
	request.on('error', function (err) {console.log(err)});
	request.end();
}
