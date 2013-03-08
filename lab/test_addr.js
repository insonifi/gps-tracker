var lookup = require('../google_api');

lookup.on('address', function (addr) {
	console.log(addr);
});

lookup.addressLookup({lat: 56.891296, long: 24.078104});
