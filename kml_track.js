time = [];
coords = [];
dir = [];
speed = [];
module.exports.add = function (gps_msg) {
	time.push(new Date(gps_msg.gps_timestamp).toISOString());
	coords.push(gps_msg.long + ',' + gps_msg.lat + ',0');
	dir.push(gps_msg.track + ' 0 0');
	speed.push(gps_msg.kph);
}
module.exports.kml = function () {
	var XML = require('xml');
	var gmaps = require('./google_api');
	var Id = new Date().toISOString().slice(0,10);
	var kml = [{'kml': [
		{'_attr': {'xmlns': 'http://www.opengis.net/kml/2.2',
			'xmlns:gx': 'http://www.google.com/kml/ext/2.2'},
		},
		{'Document': [{'Folder': [{'name': new Date().toLocaleDateString()},
				{'Placemark': [
					{'LineString': [{'coordinates': ''}]},
				]}
			]}
			]}
	]}];
	for (var i = 0; i < coords.length; i++) {
		var k = kml[0].kml;
		var coords_tmp = coords[i].split(',');
		var long = coords_tmp[0];
		var lat = coords_tmp[1];
		var address = 'no address' //gmaps.addressLookup(long, lat);
		k[k.length - 1].Document[0].Folder.unshift({
			'Placemark' : [
				{'name': new Date(time[i]).toLocaleTimeString()},
				{'description': address},
				{'IcobStyle': [{'Icon':[{'href': {['http://maps.google.com/mapfiles/kml/shapes/placemark_square.png']}]}]}]},
				//{'description': new Date(time[i]).toLocaleTimeString() + ' (' + speed[i] + 'km/h)'},
				{'TimeStamp': [
					{'when': [time[i]]},
				]},
				{'Point': [
					{'coordinates': [coords[i]]}]
				}
			]
		});
		var d = k[k.length - 1].Document[0].Folder;
		d[d.length - 1].Placemark[0].LineString[0].coordinates += coords[i] + '\n';
	}
	return '<?xml version="1.0" encoding="UTF-8"?>\n' + XML(kml, false);
}
/*
module.exports.kml_gx = function () {
	var XML = require('xml');
	var Id = new Date().toISOString().slice(0,10);
	var kml = [{'kml': [
		{'_attr': {'xmlns': 'http://www.opengis.net/kml/2.2',
			'xmlns:gx': 'http://www.google.com/kml/ext/2.2'},
		},
		{'Schema': [{'_attr': {'id': 'schema'}},
			{'gx:SimpleArrayField': [{'_attr': {'name': 'kph', 'type': 'float'}},
				{'displayName': 'K/h'}]}
		]},
		{'Folder': [
			{'Placemark': [
				{'gx:Track': [{'_attr': {'ID': Id}}, 
					{'ExtendedData': [
						{'SchemaData': [{'_attr': {'schemaUrl': '#schema'}},
							{'gx:SimpleArrayData': [{'_attr': {'name': 'kph'}}]}
						]}
					]}
				]}
			]}
		]}
	]}];

	var item = coords.shift();
	while (item = coords.shift()) {
		var k = kml[0].kml;
		k[k.length - 1].Folder[0].Placemark[0]['gx:Track'].unshift(item);
	}

	item = speed.shift();
	while (item = speed.shift()) {
		var k = kml[0].kml;
		var track = k[k.length - 1].Folder[0].Placemark[0]['gx:Track'];
		var extData =  track[track.length - 1].ExtendedData[0].SchemaData;
		extData[extData.length - 1]['gx:SimpleArrayData'].unshift(item);
	}
		
	return '<?xml version="1.0" encoding="UTF-8"?>\n' + XML(kml, true);
}
*/
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
