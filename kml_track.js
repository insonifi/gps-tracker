time = [];
coords = [];
dir = [];
speed = [];
module.exports.add = function (gps_msg) {
	time.push(new Date(gps_msg.gps_timestamp).toISOString());
	coords.push(gps_msg.long + ',' + gps_msg.lat);
	dir.push(gps_msg.track + ' 0 0');
	speed.push(gps_msg.kph);
}
module.exports.kml = function () {
	//var gmaps = require('./google_api');
	var Id = new Date().toISOString().slice(0,10);
	//KML root node
	var Doc = require('xmlbuilder').create('kml',
		{'version': '1.0', 'encoding': 'UTF-8', 'standalone': true})
		.att('xmlns', 'http://www.opengis.net/kml/2.2')
		.att('xmlns:gx', 'http://www.google.com/kml/ext/2.2')
		.ele('Document');
	//Document and Folder with style and names
	Doc.ele('name').text('Track');
	Doc.ele('Style', {'id': 'point'})
		.ele('IconStyle')
		.ele('color').text('ff0c6dff')
		.insertAfter('Icon')
		.ele('href').text('http://maps.google.com/mapfiles/kml/shapes/placemark_square.png');
	
	var Folder = Doc.ele('Folder').att('name', Id);
	var coordsLine = '';
	//Placemark with points
	for (var i = 0; i < coords.length; i++) {
		var coords_tmp = coords[i].split(',');
		var long = coords_tmp[0];
		var lat = coords_tmp[1];
		var address = 'no address' //gmaps.addressLookup(long, lat);
		var pmark = Folder.ele('Placemark');
		pmark.ele('name').text(new Date(time[i]).toLocaleTimeString());
		pmark.ele('description').text(address);
		pmark.ele('styleUrl').text('#point');
		pmark.ele('TimeStamp').ele('when').text(time[i]);
		pmark.ele('Point').ele('coordinates').text(coords[i]);
		coordsLine += coords[i] + ' ';
	}
	//LineString
	pmark.ele('LineString').ele('coordinates').text(coordsLine);
	return Doc.end({'pretty': false});
}

module.exports.kmz = function () {
	var zlib = require('zlib');
	var kml = module.exports.kml();
	var kmz = 'empty';

	zlib.deflate(kml, function (err, buff) {
		return err;
		kmz = err;
		if (!err) {
			kmz = buff.toString();
			return kmz;
		}
	});
	return kmz;
}
module.exports.maplink = function () {
	var link = 'http://maps.googleapis.com/maps/api/staticmap?size=800x600&';
	var coo = [];
	for (i = 0; i < coords.length; i++) {
		if (coords[i]['gx:coord']) {
			tmp = coords[i]['gx:coord'].split(' ');
			coo.unshift(tmp[0] + ',' + tmp[1]);
		}
	}
	link += '&center=' + coo[0] + '&path=' + coo.join('|').toString();
	return link + '&sensor=false';
}
