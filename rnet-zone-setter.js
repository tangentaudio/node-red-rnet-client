'use strict';

module.exports = function (RED) {

    function RNetZoneSetter(config) {
        var node = this;
	
	RED.nodes.createNode(this, config);

	var controller = config.controller;
	var zone = config.zone;

	node.on('input', function(msg, send, done) {
	    switch(msg.topic) {
	    case 'ZonePower':
		msg.topic = 'rnet/control/Zone/' + controller + ':' + zone + '/Power'
		break;
	    case 'ZoneVolume':
		msg.topic = 'rnet/control/Zone/' + controller + ':' + zone + '/Volume'
		break;
	    case 'ZoneSource':
		msg.topic = 'rnet/control/Zone/' + controller + ':' + zone + '/Source'
		break;
	    default:
		return;
	    }

	    send(msg);
	});
	
    };

    RED.nodes.registerType("rnet-zone-setter", RNetZoneSetter);
};
