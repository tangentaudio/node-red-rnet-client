'use strict';

module.exports = function(RED) {

    var socketTimeout = RED.settings.socketTimeout||null;

    function RNetNode(n) {
        var node = this;

        var net = require('net');
        var crypto = require('crypto');

        this.connectionPool = {};
	
	
	RED.nodes.createNode(this, n);
	this.host = n.host;
	this.port = n.port;
	this.ignore = n.ignore;
	this.debug = n.debug;

	var id = crypto.createHash('md5').update(`${node.host}${node.port}`).digest("hex");
	this.id = id;
	
	if (node.debug === 'all') node.warn(`RNet host and port ${node.host}:${node.port} debug=${node.debug} id=${id}`);

	var close = function() {
            if (node.debug === 'all') node.warn(`Closed socket ${node.host}:${node.port}`);
	};

	
	node.on("close",function() {
            for (var c in this.connectionPool) {
		if (this.connectionPool.hasOwnProperty(c)) {
                    var socket = this.connectionPool[c].socket;
                    socket.end();
                    socket.destroy();
                    socket.unref();
		}
            }

            this.connectionPool = {};
	});

	var connect = () => {
	    if (typeof this.connectionPool[id] === 'undefined') {
		if (node.debug === 'all') node.warn(`Creating connection in pool for ${node.host}:${node.port} id=${id}...`);

		this.connectionPool[id] = {
		    socket: net.connect(node.port, node.host),
		    buffer: Buffer.alloc(0)
		};

		var socket = this.connectionPool[id].socket;

		socket.setKeepAlive(true, 120000);

		if (socketTimeout !== null) {
		    socket.setTimeout(socketTimeout);
		}

		socket.on('end', function () {
		    if (node.debug === 'all') node.warn(`on end, socket ${node.host}:${node.port}`);
		});

		socket.on('timeout', function () {
		    if (node.debug === 'all') node.warn(`on timeout, socket ${node.host}:${node.port}`);
		    socket.end();
		});

		socket.on('close', function () {
		    if (this.connectionPool !== undefined && this.connectionPool[id] !== undefined)
			delete this.connectionPool[id];

		    if (node.debug === 'all') node.warn(`on close, socket ${node.host}:${node.port}`);
		    
		    setTimeout(connect, 5000, 'reconnect');
		});

		socket.on('error', function (err) {
		    node.log(err);
		    if (node.debug === 'all') node.warn(`on error, socket ${node.host}:${node.port}`);
		});

		socket.on('connect', function() {
		    if (node.debug === 'all') node.warn(`on connect, socket ${node.host}:${node.port}`);
		});

		socket.on('ready', function() {
		    if (node.debug === 'all') node.warn(`on ready, socket ${node.host}:${node.port}`);

		});
	    }
	    else {
		if (node.debug !== 'none') node.error(`Already connected`);
	    }
	};

	
	connect();
    };
    
    RED.nodes.registerType("rnet", RNetNode);
}
