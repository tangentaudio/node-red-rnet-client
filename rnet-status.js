'use strict';

module.exports = function (RED) {

    function RNetStatus(config) {
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
			if (this.ignore) ignore_msg=true;
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
			
			node.context().global.set('rnet.zone.' + controller + '.' + zone + '.name', name);            
		    }
		    break;

		case 0x06:
		    {
			var source = buf.readUInt8(0);
			var name = buf.toString('utf8', 1, pkt_payload_len - 2);
			msg.topic = 'Source/' + source + '/Name';
			msg.payload = name;
			
			node.context().global.set('rnet.source.' + source + '.name', name);
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
			
			node.context().global.set('rnet.zone.' + controller + '.' + zone + '.volume', volume);
			
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
			    if (this.ignore) ignore_msg = true;
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
			
			node.context().global.set('rnet.source.' + sourceID + '.mediaPlayState', buf.readUInt8(1) ? true : false);
		    }
		    break;
		case 0x64:
		    {
			var controller = buf.readUInt8(0);
			var zone = buf.readUInt8(1);
			msg.topic = 'Zone/' + controller + ':' + zone + '/MaxVolume';
			msg.payload = buf.readUInt8(2);
			
			node.context().global.set('rnet.zone.' + controller + '.' + zone + '.maxVolume', buf.readUInt8(2));
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
		    if (this.ignore) ignore_msg = true;
		}
		
		msg.topic = 'rnet/status/' + msg.topic;

		if (!ignore_msg && msg !== undefined)
		    node.send(msg);
	    }

	    return buffer.subarray(ofs);
	}

	var subscribe = () => {
	    var id = this.rnet.id;
	    
	    if (this.rnet.connectionPool[id] == null) return;
	    node.warn(`Sending subscribe message to ${node.host}:${node.port}`);

	    var socket = this.rnet.connectionPool[id].socket;

	    const subscribeMsg = Buffer.from([0x01, 0x01, 0x02]);
	    socket.write(subscribeMsg);
	};

	
	var configure = () => {
	    var id = this.rnet.id;

	    if (this.rnet.connectionPool[id] === undefined) {
		node.warn(`configure for id=${id}; connection does not exist yet`);
		setTimeout(configure, 1000, 'configure');
		return;
	    }

            var socket = this.rnet.connectionPool[id].socket;

            socket.on('data', (data) => {
		if (node.debug === 'all') node.warn(`Data received from ${socket.remoteAddress}:${socket.remotePort}`);
		
		var buffer = Buffer.concat([this.rnet.connectionPool[id].buffer, Buffer.from(data)]);

		try {
		    buffer = parseRNetS2C(buffer, node.send);
		} catch (err) {
		    node.error("parse error " + err);
		}
		
		this.rnet.connectionPool[id].buffer = buffer;
            });

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
		subscribe();
	    });

	    socket.on('ready', function() {
		node.status({fill:"green", shape:"ring",text:"connected and ready"});
	    });
	};

	configure();
    };

    RED.nodes.registerType("rnet-status", RNetStatus);
};
