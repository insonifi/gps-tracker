socket = (function () {
	//var socket = io.connect('http://gpstracker-insonifi.rhcloud.com:8000');//' + document.domain + ':8000');
	var socket = io.connect('http://' + document.domain + ':8000');
	socket.on('handshake', function (data) {
		console.log('[connected]', data.welcome);
		$('#info').info('update', data.welcome, 'info');
		core.getList();
	});
	//query finished
	socket.on('query-end', function (count) {
		console.log('[query]', 'found ' + count);
		$('#info').info('update', 'found ' + count, 'info');
		setTimeout(function () {
			$('#tabs').tabs('refresh');
		}, 500);
	});
	//display server time
	socket.on('clock', function (time) {
		console.info('[clock]', time);
		$('#clock').text((new Date(time)).toLocaleTimeString());
	});
	//query
	socket.on('query-waypoint', function (data) {
		console.info('query', data);
		if(undefined != data) 
			core.showWaypoint(data, 'query-table');
	});
	//got new live waypoint
	socket.on('update-waypoint', function (data) {
		console.info('[waypoint]',data);
		if(undefined != data) {
			//update marker on map
			mapctl.updateMarker(data);
			//show in info box
			core.newWaypoint(data);
			//show new way point in table
			core.showWaypoint(data, 'updates-table');
			$('#tabs').tabs('refresh');
		}
	});
	//got tracked modules list
	socket.on('modulelist', function (list) {
		console.info('[list]', list);
		var select = document.getElementById('modules-id'),
			list_len = list.length;
		select.innerHTML = '';
		for (var i = 0; i < list_len; i++){
			var newid = document.createElement('option');
			newid.value = list[i].module_id;
			newid.textContent = list[i].name;
			select.appendChild(newid);
		}
		core.displayList(list);
	});
	return socket;
})();
