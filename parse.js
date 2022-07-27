const IGNORE_UKNOWNS = true;

var inbuf = msg.payload.subarray();
var ofs = 0;


while (ofs < inbuf.length) {
    var prop, param, p, pv;

    var ignore_msg = false;

    // process input buffer stream one packet at a time
    var pkt_id = inbuf.readUInt8(ofs);
    var pkt_payload_len = inbuf.readUInt8(ofs + 1);

    var buf = inbuf.subarray(ofs + 2, ofs + 2 + pkt_payload_len);

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
        msg.payload  = { 'value' : pv };
        break;

    case 0x03:
        msg.topic = 'ZoneIndex';
        msg.payload = { 'value': buf.toString('utf8', 1) }
        break;

    case 0x04:
        {
            var controller = buf.readUInt8(0);
            var zone = buf.readUInt8(1);
            var name = buf.toString('utf8', 2, pkt_payload_len - 1);

            msg.topic = 'Zone/' + controller + ':' + zone + '/Name';
            msg.payload = name;

            global.set('rnet.zone.' + controller + '.' + zone + '.name', name);            
        }
        break;

    case 0x06:
        {
            var source = buf.readUInt8(0);
            var name = buf.toString('utf8', 1, pkt_payload_len - 2);
            msg.topic = 'Source/' + source + '/Name';
            msg.payload = name;

            global.set('rnet.source.' + source + '.name', name);
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

            global.set('rnet.zone.' + controller + '.' + zone + '.volume', volume);

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

            global.set('rnet.source.' + sourceID + '.mediaPlayState', buf.readUInt8(1) ? true : false);
        }
        break;
    case 0x64:
        {
            var controller = buf.readUInt8(0);
            var zone = buf.readUInt8(1);
            msg.topic = 'Zone/' + controller + ':' + zone + '/MaxVolume';
            msg.payload = buf.readUInt8(2);

            global.set('rnet.zone.' + controller + '.' + zone + '.maxVolume', buf.readUInt8(2));
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

    if (!ignore_msg)
        node.send(msg);
}
