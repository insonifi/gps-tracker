function validate_nmea(input) {
    var checksum = 0;
    var re = /\$(.*)\*(.*)/;
    if (!re.test(input)) return
    var result = re.exec(input);
    var str = result[1];
    var sum = result[2];
    for (var i = 0; i < str.length; i++) {
        checksum = checksum ^ str.charCodeAt(i);
    }
    if (checksum.toString(16) == sum)
        return str;
    else {
		console.log('[NMEA]', 'invalid checksum');
        return false;
    }
}

/* nmea = {
 * 	timestamp
 * 	lat
 * 	long
 * 	kph
 * 	track
 * 	magv
 * 	isValid
 * }
 */ 


exports.parse = function (input) {
	//validate string, return if invalid
	validatedStr = validate_nmea(input)
	
	if (!validatedStr) return 'invalid checksum';

    //find code and appropriate parser
    var data = validatedStr.split(',')
    var code = data.shift();
    if (code == 'GPRMC') {
		var nmea = {}
		nmea.timestamp = (new Date(Date.UTC(
			'20' + data[8].slice(4,6),
			parseInt(data[8].slice(2,4)) - 1,
			data[8].slice(0,2),
			data[0].slice(0,2),
			data[0].slice(2,4),
			data[0].slice(4,6)
		))).toISOString();//.valueOf()//store date as integer	//.toUTCString();
		//nmea.isValid = data[1] == 'A';
		nmea.lat = ((((data[2] | 0) / 100) | 0) + (parseFloat(data[2]) % 100) * 0.0166666666667).toFixed(6);
		if (data[3] == 'S') nmea.lat = -nmea.lat;
		nmea.long = ((((data[4] | 0) / 100) | 0) + (parseFloat(data[4]) % 100) * 0.0166666666667).toFixed(6);
		if (data[5] == 'W') nmea.long = -nmea.long;
		nmea.kph = (data[6] * 1.8519993258722454).toFixed(2);
		nmea.track = data[7];
		//nmea.timestamp = new Date();
		nmea.magv = data[9];
		return nmea;
	}
	return {text: 'no parser for ' + code, valid: false}; 
}
