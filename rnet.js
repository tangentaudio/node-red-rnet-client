module.exports = function(RED) {
    function RNetNode(n) {
	RED.nodes.createNode(this,n);
	this.host = n.host;
	this.port = n.port;
    }
    RED.nodes.registerType("rnet", RNetNode);
}
