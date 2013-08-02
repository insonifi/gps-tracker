(function () {
	var mapCenter = new google.maps.LatLng(56.9496,24.1040);//Riga
	var mapProp = {
		center: mapCenter,
		zoom: 12,
		mapTypeId: google.maps.MapTypeId.ROADMAP
	};
	//var symbol = 'M -0.3,0 -0.3,5 M 0.3,0 0.3,5 M 0.3,5 2,1 M -0.3,5 -2,1 M 0.3,0 2,1 M -0.3,0 -2,1';
	//var symbol = 'M -0.3,-2 -0.3,2 M 0.3,-2 0.3,2 M 0.3,2 2,-1.5 M -0.3,2 -2,-1.5 M 0.3,-2 2,-1.5 M -0.3,-2 -2,-1.5';
	var symbol = google.maps.SymbolPath.FORWARD_CLOSED_ARROW;
	var marker_color = '#992200';
	var path_color = '#ef5611';
	var trails = {};
	var map;
	var hpath = new google.maps.Polyline({
		strokeColor: marker_color,
		strokeWeight: 3,
		strokeOpacity: 0.8
	});
	var markers = {};
	var active = new google.maps.Marker();
	
	mapctl = {
		initMap: function () {
			map = new google.maps.Map(document.getElementById("map"),mapProp);
			active.setMap(map);
			hpath.setMap(map)
		},
		updateMapSize: function () {
			var mapElement = document.getElementById('map');
			var divMap = mapElement.parentNode;
			divMap.style.height = window.innerHeight - divMap.offsetTop;
		},
		showActiveMarker: function (lat, lng) {
			var latlong = new google.maps.LatLng(lat, lng);
			active.setPosition(latlong);
			active.setVisible(true);
		},
		hideActiveMarker: function () {
			active.setVisible(false);
		},
		showTripHistory: function (start, stop) {
			var path = [],
				waypoint = document.getElementById(start.toISOString());
	
			do {
				time = new Date(waypoint.getAttribute('timestamp'))
				path.push(new google.maps.LatLng(waypoint.getAttribute('lat'), waypoint.getAttribute('long')))
				waypoint = waypoint.nextSibling;
			} while(time <= stop)
			hpath.setPath(path);
			hpath.setVisible(true);
		},
		hideTripHistory: function () {
			hpath.setVisible(false);
		},
		updateMarker: function (gps_msg) {
			var latlong = new google.maps.LatLng(gps_msg.lat, gps_msg.long);
			//update trail
			var module_id = gps_msg.module_id;
			if(!trails[module_id]) {
				trails[module_id] = {};
				trails[module_id].trip = [];
				trails[module_id].trail = new google.maps.Polyline({
					strokeColor: path_color,
					strokeWeight: 3,
					strokeOpacity: 0.8
				});
				trails[module_id].trail.setMap(map);
			}
			trails[module_id].trip.push(latlong)
			if (trails[module_id].trip.length > 10) {
				trails[module_id].trip.shift();
			}
			trails[module_id].trail.setPath(trails[module_id].trip);
			//update marker
			if(!markers[module_id]) {
				markers[module_id] = new google.maps.Marker();
				markers[module_id].setMap(map);
			}
			markers[module_id].setIcon({
				path: symbol,
				strokeColor: marker_color,
				strokeWeight: 2,
				scale: 5,
				rotation: gps_msg.track - gps_msg.magv + 90
			});
			markers[module_id].setPosition(latlong);
			map.setCenter(latlong);
		}
	}
	google.maps.event.addDomListener(window, 'load', mapctl.initMap);
})();
