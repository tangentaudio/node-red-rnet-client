'use strict';

module.exports = function (RED) {

    function RNetControl(config) {
        var node = this;
        var net = require('net');
        var crypto = require('crypto');
	
	RED.nodes.createNode(this, config);
	
	this.rnet = RED.nodes.getNode(config.rnet);

	if (this.rnet) {
            this.host = this.rnet.host;
            this.port = Number(this.rnet.port);
	    this.ignore = this.rnet.ignore;
	    this.debug = this.rnet.debug;
	} else {
	    this.host = 'localhost';
	    this.port = 3000;
	    this.ignore = true;
	    this.debug = 'all';
	}
	
	var parseRNetC2S = (msg, socket) => {
	    const path = msg.topic.split('/');
	    if (msg.topic.startsWith('rnet/control/') && path.length >= 3) {
		const dest = path[2];
		var buf = null;

		switch(dest) {
		case "Zone":
		    {
			const zone = path[3];
			const cmd = path[4];
			var controllerID = 0;
			var zoneID = 0;

			if (zone.includes(':')) {
			    controllerID = Number(zone.split(':')[0]);
			    zoneID = Number(zone.split(':')[1]);
			} else {
			    zoneID = Number(zone);
			}

			switch(cmd) {
			case "Power":
                            buf = Buffer.alloc(2 + 3);
                            buf.writeUInt8(0x08, 0);
                            buf.writeUInt8(3, 1);
                            buf.writeUInt8(controllerID, 2);
                            buf.writeUInt8(zoneID, 3);
                            buf.writeUInt8(msg.payload ? 1 : 0, 4);
                            break;
			case "Volume":
                            buf = Buffer.alloc(2 + 3);
                            buf.writeUInt8(0x09, 0);
                            buf.writeUInt8(3, 1);
                            buf.writeUInt8(controllerID, 2);
                            buf.writeUInt8(zoneID, 3);
                            buf.writeUInt8(msg.payload, 4);
                            break;
			case "Source":
                            buf = Buffer.alloc(2 + 3);
                            buf.writeUInt8(0x0A, 0);
                            buf.writeUInt8(3, 1);
                            buf.writeUInt8(controllerID, 2);
                            buf.writeUInt8(zoneID, 3);
                            buf.writeUInt8(msg.payload, 4);
                            break;
			default:
                            node.warn("unknown zone cmd: " + cmd);
			}
		    }
		    break;
		default:
		    node.warn("unknown pkt: " + dest);
		}

		socket.write(buf);
	    }
	}
	
	
        node.on('input', function (msg, send, done) {
	    node.warn("input: " + msg.topic + "=>" + msg.payload);

	    var id = this.rnet.id;
	    var socket = this.rnet.connectionPool[id].socket;
	    parseRNetC2S(msg, socket);
	    
        });

	var configure = () => {
	    var id = this.rnet.id;

	    if (this.rnet.connectionPool[id] === undefined) {
		node.warn(`configure for id=${id}; connection does not exist yet`);
		setTimeout(configure, 1000, 'configure');
		return;
	    }

            var socket = this.rnet.connectionPool[id].socket;

            socket.on('end', function () {
		node.status({fill:"red", shape:"dot",text:"end"});
            });

            socket.on('timeout', function () {
		node.status({fill:"red", shape:"dot",text:"timeout"});
            });

            socket.on('close', function () {
		node.status({fill:"red", shape:"dot",text:"closed"});
            });

            socket.on('error', function (err) {
		node.status({fill:"red", shape:"dot",text:"error: " + err});
            });

	    socket.on('connect', function() {
		node.status({fill:"green", shape:"ring",text:"connected"});
	    });

	    socket.on('ready', function() {
		node.status({fill:"green", shape:"ring",text:"connected and ready"});
	    });
	};

	configure();
	
    };
    RED.nodes.registerType("rnet-control", RNetControl);
};
