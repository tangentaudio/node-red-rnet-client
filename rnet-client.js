'use strict';

module.exports = function (RED) {

    var socketTimeout = RED.settings.socketTimeout||null;

    const IGNORE_UKNOWNS = true;
    
    function RNetClient(config) {
        var node = this;

        var net = require('net');
        var crypto = require('crypto');
	
	RED.nodes.createNode(this, config);
	
	this.rnet = RED.nodes.getNode(config.rnet);

	if (this.rnet) {
            this.host = this.rnet.host;
            this.port = Number(this.rnet.port);
	} else {
	    this.host = 'localhost';
	    this.port = 3000;
	}
        this.debug = config.debug || "all";
	
	var id = crypto.createHash('md5').update(`${node.host}${node.port}`).digest("hex");
	node.warn(`RNet host and port ${node.host}:${node.port} debug=${node.debug} id=${id}`);

        var connectionPool = {};
        var server;

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
	
	var parseRNetS2C = (buffer, send) => {
	    var ofs = 0;

	    if (buffer === undefined) throw 'buffer is undefined';
	    if (!Buffer.isBuffer(buffer)) throw 'buffer is not a Buffer type';
	    
	    while (ofs < buffer.length) {
		var prop, param, p, pv;
		var ignore_msg = false;
		var msg = {topic: "", payload: ""}
		
		// process input buffer stream one packet at a time
		var pkt_id = buffer.readUInt8(ofs);
		var pkt_payload_len = buffer.readUInt8(ofs + 1);
		
		var buf = buffer.subarray(ofs + 2, ofs + 2 + pkt_payload_len);
		
		ofs = ofs + 2 + pkt_payload_len;
		
		// process individual packet
		switch(pkt_id) {
		case 0x02:
		    msg.topic = 'Property';
		    
		    prop = buf.readUInt8(0);
		    switch(prop) {
		    case 0x01:
			p = 'SystemName';
			pv = buf.toString('utf8', 1, pkt_payload_len - 1);
			break;
		    case 0x02:
			p = 'Version';
			pv = buf.toString('utf8', 1, pkt_payload_len - 1);
			break;
		    case 0x03:
			p = 'SerialConnected';
			pv = buf.readUInt8() ? true : false;
			break;
		    case 0x04:
			p = 'WebServerEnabled';
			pv = buf.readUInt8(1) ? true : false;
			break;
		    default:
			p = 'ID-' + prop.toString(16);
			pv = buf.readUInt8(1);
			if (IGNORE_UKNOWNS) ignore_msg=true;
		    }
		    msg.topic = msg.topic + '/' + p;
		    msg.payload  = pv;
		    break;
		    
		case 0x03:
		    msg.topic = 'ZoneIndex';
		    msg.payload = [];
		    for (var i=0; i<buf.length; i += 2) {
			var v = buf.readUInt16BE(i);
			msg.payload.push(v);
		    }
		    break;
		    
		case 0x04:
		    {
			var controller = buf.readUInt8(0);
			var zone = buf.readUInt8(1);
			var name = buf.toString('utf8', 2, pkt_payload_len - 1);
			
			msg.topic = 'Zone/' + controller + ':' + zone + '/Name';
			msg.payload = name;
			
			//global.set('rnet.zone.' + controller + '.' + zone + '.name', name);            
		    }
		    break;

		case 0x06:
		    {
			var source = buf.readUInt8(0);
			var name = buf.toString('utf8', 1, pkt_payload_len - 2);
			msg.topic = 'Source/' + source + '/Name';
			msg.payload = name;
			
			//global.set('rnet.source.' + source + '.name', name);
		    }
		    break;
		    
		case 0x08:
		    {
			var controller = buf.readUInt8(0);
			var zone = buf.readUInt8(1);
			var power = buf.readUInt8(2) ? true : false;
			
			msg.topic = 'Zone/' + controller + ':' + zone + '/Power';
			msg.payload = power;
		    }
		    break;
		    
		case 0x09:
		    {
			var controller = buf.readUInt8(0);
			var zone = buf.readUInt8(1);
			var volume = buf.readUInt8(2);
			
			msg.topic = 'Zone/' + controller + ':' + zone + '/Volume';
			msg.payload = volume;
			
			//global.set('rnet.zone.' + controller + '.' + zone + '.volume', volume);
			
		    }
		    break;
		    
		case 0x0A:
		    {
			var controller = buf.readUInt8(0);
			var zone = buf.readUInt8(1);
			var source = buf.readUInt8(2);
			
			msg.topic = 'Zone/' + controller + ':' + zone + '/Source';
			msg.payload = source;
		    }
		    break;
		    
		case 0x0B:
		    {    
			var controller = buf.readUInt8(0);
			var zone = buf.readUInt8(1);
			msg.topic = 'Zone/' + controller + ':' + zone + '/Parameter';
			
			param = buf.readUInt8(2)
			switch (param) {
			case 0x02:
			    p = 'Loudness';
			    pv = buf.readUInt8(3) ? true : false;
			    break;
			case 0x06:
			    p = 'DoNotDisturb';
			    pv = buf.readUInt8(3) ? true : false;
			    break;
			case 0x07:
			    p = 'PartyModeEnable';
			    pv = buf.readUInt8(3) ? true : false;
			    break;
			case 0x08:
			    p = 'FrontAVEnable';
			    pv = buf.readUInt8(3) ? true : false;
			    break;
			default:
			    p = 'ID-' + param.toString(16);
			    pv = buf.readUInt8(3);
			    if (IGNORE_UKNOWNS) ignore_msg = true;
			}
			
			msg.topic = msg.topic + '/' + p;
			msg.payload = pv;
		    }
		    break;
		    
		case 0x37:
		    {
			var sourceID = buf.readUInt8(0);
			msg.topic = 'Source/' + sourceID + "/MediaPlayState";
			msg.payload = buf.readUint8(1) ? true : false;
			
			//global.set('rnet.source.' + sourceID + '.mediaPlayState', buf.readUInt8(1) ? true : false);
		    }
		    break;
		case 0x64:
		    {
			var controller = buf.readUInt8(0);
			var zone = buf.readUInt8(1);
			msg.topic = 'Zone/' + controller + ':' + zone + '/MaxVolume';
			msg.payload = buf.readUInt8(2);
			
			//global.set('rnet.zone.' + controller + '.' + zone + '.maxVolume', buf.readUInt8(2));
		    }
		    break;
		    
		case 0x65:
		    {
			var controller = buf.readUInt8(0);
			var zone = buf.readUInt8(1);
			msg.topic = 'Zone/' + controller + ':' + zone + '/Mute';
			msg.payload = buf.readUInt8(2) ? true : false;
		    }
		    break;
		    
		default:
		    msg.topic = 'UnknownPacket';
		    msg.payload = buf;
		    if (IGNORE_UKNOWNS) ignore_msg = true;
		}
		
		msg.topic = 'rnet/status/' + msg.topic;

		if (!ignore_msg && msg !== undefined)
		    node.send(msg);
	    }

	    return buffer.subarray(ofs);
	}

	
        var configure = (id) => {
	    node.warn(`configure for id=${id}`);
	    
            var socket = connectionPool[id].socket;

            socket.setKeepAlive(true, 120000);

            if (socketTimeout !== null) {
                socket.setTimeout(socketTimeout);
            }

            socket.on('data', (data) => {
                if (node.debug === 'all') node.warn(`Data received from ${socket.remoteAddress}:${socket.remotePort}`);
		
                var buffer = Buffer.concat([connectionPool[id].buffer, Buffer.from(data)]);

		try {
		    buffer = parseRNetS2C(buffer, node.send);
		} catch (err) {
		    node.error("parse error " + err);
		}
		
                connectionPool[id].buffer = buffer;
            });

            socket.on('end', function () {
		node.status({fill:"red", shape:"dot",text:"end"});
		if (node.debug === 'all') node.warn(`on end, socket ${node.host}:${node.port}`);
            });

            socket.on('timeout', function () {
		node.status({fill:"red", shape:"dot",text:"timeout"});
	
                socket.end();
		if (node.debug === 'all') node.warn(`on timeout, socket ${node.host}:${node.port}`);
            });

            socket.on('close', function () {
                delete connectionPool[id];
		node.status({fill:"red", shape:"dot",text:"closed"});
		if (node.debug === 'all') node.warn(`on close, socket ${node.host}:${node.port}`);

		setTimeout(listen, 5000, 'reconnect');
            });

            socket.on('error', function (err) {
                node.log(err);
		node.status({fill:"red", shape:"dot",text:"error: " + err});
		if (node.debug === 'all') node.warn(`on error, socket ${node.host}:${node.port}`);
            });

	    socket.on('connect', function() {
		node.status({fill:"green", shape:"ring",text:"connected"});
		subscribe();
	    });

	    socket.on('ready', function() {
		node.status({fill:"green", shape:"ring",text:"connected and ready"});
	    });

        };

        var close = function() {
            if (node.debug === 'all') node.warn(`Closed socket ${node.host}:${node.port}`);
        };

        var listen = function() {
	    if (typeof connectionPool[id] === 'undefined') {
		if (node.debug === 'all') node.warn(`Creating connection in pool for ${node.host}:${node.port} id=${id}...`);

                connectionPool[id] = {
		    socket: net.connect(node.port, node.host),
		    buffer: Buffer.alloc(0)
                };

                configure(id);
	    }
	    else {
                if (node.debug !== 'none') node.error(`Already connected`);
	    }

        };
	

        var subscribe = function() {
	    node.warn(`Sending subscribe message to ${node.host}:${node.port} id=${id}...`);
	    if (connectionPool[id] == null) return;
	    var socket = connectionPool[id].socket;

	    const subscribeMsg = Buffer.from([0x01, 0x01, 0x02]);
	    socket.write(subscribeMsg);

        };
	

	listen();
	
	
        node.on('input', function (msg, send, done) {
            node.host = RED.util.evaluateNodeProperty(config.host, config.hostType, this, msg);
            node.port = Number(RED.util.evaluateNodeProperty(config.port, config.portType, this, msg));
	    node.warn("input: " + msg.topic + "=>" + msg.payload);

	    var socket = connectionPool[id].socket;

	    parseRNetC2S(msg, socket);
        });

        node.on("close",function() {
            for (var c in connectionPool) {
                if (connectionPool.hasOwnProperty(c)) {
                    var socket = connectionPool[c].socket;
                    socket.end();
                    socket.destroy();
                    socket.unref();
                }
            }

            server.close();
            connectionPool = {};
            node.status({});

        });


    };

    RED.nodes.registerType("rnet-client", RNetClient);

    
};
