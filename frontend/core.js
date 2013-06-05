core = {
	query: function () {
		core.flushTable('query-table');
		core.flushTable('trips-table');
		document.getElementById('trips-table').setAttribute('processed', false);
		var re = /(\d+):(\d+)\ (\d+)\.(\d+)\.(\d+)/;//m:H D.M.YYYYY
		//parse start date
		var strStartDate = document.querySelector('#start-date').value;
		var arStartDate = re.exec(strStartDate);
		var startDate = new Date(arStartDate[5], arStartDate[4] - 1,
			arStartDate[3],  arStartDate[1], arStartDate[2]);
		//parse end date
		var strEndDate = document.querySelector('#end-date').value;
		var arEndDate = re.exec(strEndDate);
		var endDate = new Date(arEndDate[5], arEndDate[4] - 1,
			arEndDate[3], arEndDate[1], arEndDate[2]);
		var module_id = document.querySelector('#modules-id').value;
		console.info('[query]', module_id, startDate, '...', endDate);
		socket.emit('query', {module_id: module_id, start: startDate.toISOString(), end: endDate.toISOString()});
	},
	//render way point in corresponding table
	showWaypoint: function (message, tableName) {
		var table = document.getElementById(tableName);
		var row = document.createElement('tr');
		row.classList.add('q-row');
		row.id = message.timestamp;
		for (property in message) {
			row.setAttribute(property, message[property]);
		}
		row.onmouseover = function () {
			mapctl.showActiveMarker(message.lat, message.long);
		}
		row.onmouseout = function () {
			mapctl.hideActiveMarker();
		}

		var time = row.insertCell(-1);
		var g_time = new Date(message.timestamp);
		if(tableName == 'updates-table') {
			if(table.childNodes.length > 10) { //limit to last 10 updates
				table.removeChild(table.firstChild);
			}
			time.textContent = g_time.getHours() + ':' + ("0" + g_time.getMinutes()).slice(-2);
		} else {
			time.innerHTML = 
				("0" + g_time.getDate()).slice(-2)
				+ '.'
				+ ("0" + (g_time.getMonth() + 1)).slice(-2)
				+ '.' + g_time.getFullYear()
				+ ' <b>'
				+ g_time.getHours()
				+ ':'
				+ ("0" + g_time.getMinutes()).slice(-2)
				+ '</b>';
		}
		time.classList.add('q-time');

		var address = row.insertCell(-1);
		address.textContent = message.address;
		address.classList.add('q-address');

		var speed = row.insertCell(-1);
		speed.textContent = message.kph + ' km/h';
		speed.classList.add('q-speed');

		table.appendChild(row);
	},
	newWaypoint: function (data) {
		var message = document.createElement('div');
		message.classList.add('q-row');
		//time
		var time = document.createElement('span');
		var g_time = new Date(data.timestamp);
		time.textContent = g_time.getHours() + ':' + ("0" + g_time.getMinutes()).slice(-2);
		time.classList.add('q-time-now');
		message.appendChild(time);
		//speed
		var kphArr = data.kph.split('.');
		var speed = document.createElement('span');
		speed.classList.add('q-speed-now');
		var integer = document.createElement('span');
		integer.style.fontSize = '1.2em';
		integer.textContent = kphArr[0];
		var fraction = document.createElement('span');
		fraction.style.fontSize = '0.6em';
		fraction.textContent = kphArr[1];
		speed.appendChild(integer);
		speed.appendChild(fraction);
		message.appendChild(speed);
		//address
		var address = document.createElement('span');
		address.textContent = data.address;
		address.classList.add('q-address-now');
		message.appendChild(address);
		//display message in info box
		$('#info').info('update', message.outerHTML, 'update');
	},
	flushTable: function (tableName) {
		var table = document.getElementById(tableName);
		table.innerHTML = '';
	},
	updateList: function () {
		var table = document.getElementById('modulelist-table');
		var pwdfield = document.getElementById('update-pwd');
		var pwdhash = CryptoJS.SHA512(pwdfield.value)
		var changes = {
			add: [],
			remove: [],
			hash: pwdhash.toString()
		}
		var id;
		for(var i = 0; i < table.childNodes.length; i++) {
			node = table.childNodes[i];
			id = node.querySelector('input.module-id').value;
			name = node.querySelector('input.module-name').value;
			if ('' === id||'' === name) continue;
			if('none' == node.style.display) {
				changes.remove.push({id: id});
			} else {
				changes.add.push({id: id, name: name});
			}
		}
		pwdfield.value = '';
		console.info('[updateList] update', 'add:',changes.add, 'remove', changes.remove);
		$('#info').info('update', 'Update modules list');
		socket.emit('update-modulelist', changes);
		core.getList();
	},
	getList: function () {
		socket.emit('get-modulelist');
	},
	displayList: function (list) {
		core.flushTable('modulelist-table');
		var list_len = list.length;
		for (var i = 0; i < list_len; i++) {
			core.addModuleId(list[i], readonly = true);
		}
	},
	addModuleId: function (item, readonly) {
		var table = document.getElementById('modulelist-table');
		var row = document.createElement('tr');
		var cell = row.insertCell(-1);
		//text field Module Id
		function markChange () {
			this.parentNode.classList.add('changed');
		}
		var inputId = document.createElement('input');
		inputId.value = (item.module_id == undefined ? '' : item.module_id);
		inputId.readOnly = readonly ? true : false;
		inputId.classList.add('module-id');
		inputId.type = 'tel';
		inputId.onchange = markChange;
		//text field Module Name
		var inputName = document.createElement('input');
		inputName.value = (item.name == undefined ? '' : item.name);
		inputName.classList.add('module-name');
		inputName.onchange = markChange;
		//remove button
		var button = document.createElement('input');
		button.type = 'button'; button.value = 'x';
		//assemble
		cell.appendChild(inputId);
		cell.appendChild(inputName);
		cell.appendChild(button);
		table.appendChild(row);
		$(function () {
			$('td > input[type=\'button\']').button().click(core.removeRow);
		});
	},
	removeRow: function () {
		var row = this.parentNode.parentNode;
		row.style.display = 'none';
	},
	toggleQuery: function () {
		var query = document.getElementById('query-table');
		var trips = document.getElementById('trips-table');
		//toggle
		if (query.style.display == 'none') {
			query.style.display = 'table';
			trips.style.display = 'none';
		} else {
			query.style.display = 'none';
			trips.style.display = 'table';
		}

		core.detectRoutes();

	},
	detectRoutes: function () {
		var threshold = 1000 * 60 * 5; /* 5min  -- threshold for trip detection */
		var routesCount = 0;
		var query = document.getElementById('query-table');
		var trips = document.getElementById('trips-table');
		//don't process repeatedly
		if (trips.getAttribute('processed') == 'true') {
			return;
		}
		
		var waypointHtml = query.firstChild;
		//do we have any waypoint?
		if (waypointHtml == undefined) return;

		var waypoint,
			start,
			last,
			calcTime,
			distance = 0,
			lastTime;

		do {
			waypoint =  {
				time: new Date(waypointHtml.getAttribute('timestamp')),
				address: waypointHtml.getAttribute('address'),
				lat: parseFloat(waypointHtml.getAttribute('lat')),
				lng: parseFloat(waypointHtml.getAttribute('long'))
			};
			//tripCoords.push([waypoint.lat, waypoint.lng]);
			if (!start) start = waypoint;
			if (!last) last = waypoint;
			//calculate
			curTime = waypoint.time;
			calcTime = curTime - last.time;
			distance += parseFloat(calculateDistance([start.lat, start.lng],
											[last.lat, last.lng]));
			if(calcTime > threshold) {
				if (start != last) {
					routesCount++
					trips.appendChild(core.tripRow(start, last, distance));
				};
				start = undefined;
				last = undefined;
				distance = 0;
				waypointHtml = waypointHtml.nextSibling;
				continue;
			}
			last = waypoint
			//next iteration
			waypointHtml = waypointHtml.nextSibling;
		} while (waypointHtml);
		trips.setAttribute('processed', 'true');
		console.info('[detectRoutes]', 'Detected', routesCount, 'routes');
		$('#info').info('update', 'Detected ' + routesCount + ' routes');
	},
	tripRow: function (start, stop, distance) {
		var trip = document.createElement('tr');
		trip.classList.add('q-row');
		var cell_startTime = trip.insertCell(-1);
		cell_startTime.classList.add('q-time');
		var bTime = new Date(start.time);
		cell_startTime.innerHTML = 
				("0" + bTime.getDate()).slice(-2)
				+ '.' + ("0" + (bTime.getMonth()) + 1).slice(-2)
				+ '.' + bTime.getFullYear()
				+ ' <b>' + bTime.getHours()
				+ ':' + ("0" + bTime.getMinutes()).slice(-2)
				+ '</b>';
		trip.setAttribute('starttime', start.time);

		var cell_startAddress = trip.insertCell(-1);
		cell_startAddress.textContent = start.address;
		cell_startAddress.classList.add('q-address');

		var cell_stopTime = trip.insertCell(-1);
		cell_stopTime.classList.add('q-time');
		var eTime = new Date(stop.time);
		cell_stopTime.textContent = eTime.getHours() + ':' + ("0" + eTime.getMinutes()).slice(-2);
		trip.setAttribute('stoptime', stop.time);

		var cell_stopAddress = trip.insertCell(-1);
		cell_stopAddress.classList.add('q-address');
		cell_stopAddress.textContent= stop.address;
		
		var cell_distance = trip.insertCell(-1);
		cell_distance.classList.add('q-time');
		cell_distance.textContent= (distance / 10000).toFixed(2) + 'km';
		
		trip.onmouseover = function () {
			core.showSelect(trip);
		}
		trip.onmouseout = core.hideSelect;
		trip.onclick = function() {
			mapctl.showTripHistory(start.time, stop.time);
		}
		return trip;
	},
	printReport: function () {
		var trips = document.getElementById('trips-table');
		var query = document.getElementById('query-table');
		var module_name = document.querySelector('#modules-id').name;
		var report;
		if (query.style.display == 'none') {
			report = trips;
		} else {
			report = query;
		}
		//var printFrame = document.createElement('iframe');
		var printFrame = document.getElementById('print-frame');
		with (printFrame) {
			contentDocument.write('<link type="text/css" href="./strike4/print.css" rel="stylesheet" />');
			contentDocument.write(module_name);
			contentDocument.write(report.outerHTML);
			contentWindow.print();
		}
		$('#info').info('update', 'Printing');
	},
	showSelect: function (parent) {
		var s = document.getElementById('select');
		s.style.visibility = 'visible';
		s.style.left = '80%';
		s.style.top = $(parent).offset().top + 'px';
	},
	hideSelect: function () {
		var s = document.getElementById('select');
		s.style.visibility = 'hidden';
	},
};
