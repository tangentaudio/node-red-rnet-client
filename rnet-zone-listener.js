'use strict';

module.exports = function (RED) {

    function RNetZoneListener(config) {
        var node = this;
	
	RED.nodes.createNode(this, config);

	var controller = config.controller;
	var zone = config.zone;

	node.on('input', function(msg, send, done) {
	    const path = msg.topic.split('/');


	    if (msg.topic.startsWith('rnet/status/Zone') && path.length == 5) {
		var msgController = 0;
		var msgZone = 0;
		
		if (path[3].includes(':')) {
		    var zc = path[3].split(':');
		    
		    msgController = zc[0];
		    msgZone = zc[1];
		}

		if (msgController == controller && msgZone == zone) {
		    if (path[4] === 'Name') {
			send([msg, null, null, null]);
		    } else if (path[4] === 'Power') {
			send([null, msg, null, null]);
		    }

		    else if (path[4] === 'Volume') {
			var max = Number(node.context().global.get('rnet.zone.' + controller + '.' + zone + '.maxVolume'));
			msg.ui_control = {
			    'min': 0,
			    'max': isNaN(max) ? 0 : max
			};
			
			msg.payload = Number(msg.payload);
			
			send([null, null, msg, null]);
		    } else if (path[4] === 'MaxVolume') {
			var vol = Number(node.context().global.get('rnet.zone.' + controller + '.' + zone + '.volume'));

			msg.payload = isNaN(vol) ? 0 : Number(vol);

			msg.ui_control = {
			    'min': 0,
			    'max': Number(msg.payload)
			};
            
			send([null, null, msg, null]);
		    } else if (path[4] === 'Source') {
			
			var options = [];

			for (var i=0; i<6;i++) {
			    var sname = node.context().global.get('rnet.source.' + i + '.name');
			    if (sname != undefined) {
				options.push({'label' : sname, 'value': i, 'type': 'str'});
			    }
			}
			
			msg.ui_control = {
			    'options': options
			};

			msg.payload = Number(msg.payload);
			
			send([null, null, null, msg]);
		    }

		}
	    }

	});

	
    };

    RED.nodes.registerType("rnet-zone-listener", RNetZoneListener);
};
