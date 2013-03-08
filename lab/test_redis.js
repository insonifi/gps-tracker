var redis = require('../redis_db');

redis.on('result', function(result) {
	if (result)	console.log(result.timestamp + ', ' + result.address);
});

redis.on('record', function(err) {
	console.log('recorded ' + err);
});
/*
redis.addRecord({
	gps_timestamp: 123454,
	lat: 1,
	long: 0,
	kph: 25,
	address: 'addr1'
});
redis.addRecord({
	gps_timestamp: 123450,
	lat: 2,
	long: 1,
	kph: 20,
	address: 'addr2'
});
*/


redis.query(1356283836000, 1356286966000);
