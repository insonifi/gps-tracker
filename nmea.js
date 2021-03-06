'use strict';
var validate_nmea = function (input) {
      var checksum = 0,
		  str = input.slice(1, -3),
		  sum = parseInt(input.slice(-2), 16),
		  length = str.length,
		  i;
      for (i = 0; i < length; i += 1) {
          checksum ^= str.charCodeAt(i);
      }
      if (checksum === sum) {
          return str;
      } else {
		  console.log('[NMEA]', 'invalid checksum');
          return false;
      }
  },
  convertToDecimal = function (gps_coords_str) {
    var minutes_regexp = /\d{2}\.\d+/,
  	  regexp_result,
  	  minutes,
  	  degrees,
  		one_min = 0.0166666666667;
    
    regexp_result = minutes_regexp.exec(gps_coords_str);
		degrees = +regexp_result.input.slice(0, regexp_result.index);
		minutes = +regexp_result[0];
		return (degrees + (minutes * one_min)).toFixed(6)
  };




exports.parse = function (input) {
	//validate string, return if invalid
	var validatedStr = validate_nmea(input),
		nmea = {},
		data = [],
		coord = [],
		knot_to_kph = 1.8519993258722454,
		code= '';
	if (!validatedStr) {return 'invalid checksum'; }

    //find code and appropriate parser
    data = validatedStr.split(',');
    code = data.shift();
    if (code === 'GPRMC') {
		nmea.timestamp = (new Date(Date.UTC(
			'20' + data[8].slice(4, 6),
			+data[8].slice(2, 4) - 1,
			data[8].slice(0, 2),
			data[0].slice(0, 2),
			data[0].slice(2, 4),
			data[0].slice(4, 6)
		))).valueOf()//store date as integer//.toISOString();//to store as ISO strings
		//nmea.isValid = data[1] == 'A';
		nmea.lat = convertToDecimal(data[2]);
		if (data[3] === 'S') {nmea.lat = -nmea.lat; }
		nmea.lng = convertToDecimal(data[4]);
		if (data[5] === 'W') {nmea.long = -nmea.long; }
		nmea.kph = (data[6] * knot_to_kph).toFixed(2);
		nmea.track = data[7];
		nmea.magv = data[9];
		nmea.isValid = true;
		//check that GPS time is valid
		if (data[0] === '000000' && data[8] === '000000') {
			nmea.isValid = false;
		}
		return nmea;
	}
	return {text: 'no parser for ' + code, isValid: false};
}
