var iron_mq = require('iron_mq'),
    imq = new iron_mq.Client(),
    queue = imq.queue('gps-messages'),
    queue_cb = function (err, body) {
        if (err) { console.log('[IronMQ]'.grey, err); }
        console.log('[IronMQ]'.grey, body);
    };

queue.update({
    push_type: 'multicast',
    retries: 100,
    retries_delay: 90,
}, queue_cb);

queue.add_subscribers({url: 'http://' + process.env.OPENSHIFT_APP_DNS + '/pushq'}, queue_cb);