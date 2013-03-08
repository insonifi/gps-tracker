var EventEmitter = require('events').EventEmitter;
var myEmitter = new EventEmitter;

myEmitter.on('tick', log);

myEmitter.emit('tick', new Date);

setInterval(function () {
	myEmitter.emit('tick', new Date);
}, 600);



function log(msg) {
	console.log('got tick: ' + msg);
}
