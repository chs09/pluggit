'use strict';

const EventEmitter = require('events');
class PluggitEventEmitter extends EventEmitter {
	fetch() {
		try {
			start();
		} catch (err)  {
			this.emit('error', err);
		}
	}
}

const events = new PluggitEventEmitter();
module.exports = events;

const Timestamp = require('./utils/timestamp');
const Logger = require('./utils/logger');

// The Buffer class is within the global scope, making it unlikely that one would need to ever use require('buffer').Buffer.
// const Buffer = require('buffer').Buffer;

const Modbus = require('modbus-stack');
const ModbusClient = require('modbus-stack/client');
// 'RIR' contains the "Function Code" that we are going to invoke on the remote device
const FC = Modbus.FUNCTION_CODES;

if(ModbusClient.RESPONSES[3] === undefined)
	ModbusClient.RESPONSES[3] = ModbusClient.RESPONSES[4];

/* common code */
Logger.info('adapter pluggit: reading settings');
var settings = require(__dirname + '/settings.json');

/* set true for more debugging info */
var debug = settings.debug;
if(debug) {
	Logger.setLevel('debug');
}

function stop() {
	Logger.debug('pluggit adapter: terminating');
	events.emit('stop');
}

let client;

async function start() {
	events.emit('start');

	/* modbus data is stored here */
	let dp = new Array();

	// IP and port of the MODBUS slave, default port is 502
	client = ModbusClient.createClient(settings.pluggit.port, settings.pluggit.host);
	client.setTimeout(10000, () => {
		Logger.debug('socket timeout...');
		stop();
	});

	try {
		await requestBlock(0, dp);
		events.emit('data', dp);
	} catch (err) {
		Logger.error(err);
		events.emit('error', err);
		return stop();
	} finally {
		client.end();
		client = null;
	}
}

function readBlock(start, len) {
	return new Promise((resolve, reject) => {
		Logger.debug(`requesting block ${start},${len}`);
		client.request(FC.READ_HOLDING_REGISTERS, start, len, function(err, response) {
			if (err) { /* stop on error */
				Logger.error(`error reading block ${start},${len}`);
				reject(err);
				return stop();
			}
			
			/* write modbus data array to buffer this is easier to handle/convert the data */
			var buf = Buffer.alloc(response.length*2);
			for (var i=0; i<response.length; i++) {
				buf.writeUInt16LE(response[i],i*2);
			}
			Logger.debug(`block ${start},${len}: ${buf.toString('hex')}`);
			resolve(buf);
		});
	});
}

const ALARMS = { // 40517 prmLastActiveAlarm
	0 : 'None',
	1 : 'Exhaust FAN Alarm',
	2 : 'Supply FAN Alarm',
	3 : 'Bypass Alarm',
	4 : 'T1 Alarm',
	5 : 'T2 Alarm',
	6 : 'T3 Alarm',
	7 : 'T4 Alarm',
	8 : 'T5 Alarm',
	9 : 'RH Alarm',
	10: 'Outdoor13 Alarm',
	11: 'Supply5 Alarm',
	12: 'Fire Alarm',
	13: 'Communication Alarm',
	14: 'FireTermostat Alarm',
	15: 'VOC Alarm'
};

const STATES = { // 40473 prmCurrentBLState
	0: 'Standby',
	1: 'Manual',
	2: 'Demand',
	3: 'Week program',
	4: 'Servo-flow',
	5: 'Away',
	6: 'Summer',
	7: 'DI Override',
	8: 'Hygrostat override',
	9: 'Fireplace',
	10: 'Installer',
	11: 'Fail Safe 1',
	12: 'Fail Safe 2',
	13: 'Fail Off',
	14: 'Defrost Off',
	15: 'Defrost',
	16: 'Night'
};

const BYPASSSTATES = { // 40199 prmRamIdxBypassActualState
	0x0000: 'closed',
	0x0001: 'in process',
	0x0020: 'closing',
	0x0040: 'opening',
	0x00FF: 'opened'
};

/* request modbus data block */
async function requestBlock(blockindex, dp)
{
	let buf;
	switch (blockindex) {
	case 0: // 40003 prmSystemID, 40005-40007 prmSystemSerialNum, 40009-40023 prmSystemName
		buf = await readBlock(2, 23);
		dp['serial'] = buf.readUInt32LE(4) + (buf.readUInt32LE(8) << 32);
		dp['name'] = buf.toString('utf-8', 12, 32).replace(/\0/g, '');
		dp['version'] = buf.readUInt8(45) + '.' + buf.readUInt8(44);
		Logger.info(`sn: ${dp['serial']}, name: ${dp['name']}, fw: ${dp['version']}\r\n`);
		break;

	case 1: // 40101 prmHALTaho1, 40103 prmHALTaho2
		buf = await readBlock(100, 4);
		dp['fan1'] = buf.readFloatLE(0).toFixed(1);
		dp['fan2'] = buf.readFloatLE(4).toFixed(1);
		Logger.info(`fan1: ${dp['fan1']} rpm, fan2: ${dp['fan2']} rpm\r\n`);
		break;

	case 2: // 40133 prmRamIdxT1, 40135 prmRamIdxT2, 40137 prmRamIdxT3, 40139 prmRamIdxT4, 40141 prmRamIdxT5
		buf = await readBlock(132, 20);
		dp['t1'] = buf.readFloatLE(0).toFixed(2);
		dp['t2'] = buf.readFloatLE(4).toFixed(2);
		dp['t3'] = buf.readFloatLE(8).toFixed(2);
		dp['t4'] = buf.readFloatLE(12).toFixed(2);
		dp['t5'] = buf.readFloatLE(16).toFixed(2);
		Logger.info(`t1: ${dp['t1']} °C, t2: ${dp['t2']} °C, t3: ${dp['t3']} °C, t4: ${dp['t4']} °C, t5: ${dp['t5']} °C\r\n`);
		break;

	case 3: // 40197 prmRamIdxRh3Corrected, 40199 prmRamIdxBypassActualState
		buf = await readBlock(196, 4);
		dp['humidity'] = buf.readUInt32LE(0);
		dp['bypass'] = buf.readUInt32LE(4);
		dp['bypassState'] = BYPASSSTATES[dp['bypass']] || 'unknown';
		Logger.info(`RH: ${dp['humidity']}%\r\nBypass: ${dp['bypass']} (${dp['bypassState']})\r\n`);
		break;

	case 4: // 40325 prmRomIdxSpeedLevel
		buf = await readBlock(324, 1);
		dp['speed'] = buf.readUInt16LE(0);
		Logger.info(`speed: ${dp['speed']}\r\n`);
		break;

	case 5: // 40473 prmCurrentBLState
		buf = await readBlock(472, 1);
		dp['state'] = buf.readUInt16LE(0);
		dp['stateText'] = STATES[dp['state']] || 'unknown';
		Logger.info('state: ' + dp['state'] + ' (' + dp['stateText'] + ')\r\n');
		break;

	case 6: // 40517 prmLastActiveAlarm
		buf = await readBlock(516, 1);
		dp['alarm'] = buf.readUInt16LE(0);
		dp['alarmState'] = ALARMS[dp['alarm']] || 'unkown';
		Logger.info('alarm: ' + dp['alarm'] + ' (' + dp['alarmState'] + ')\r\n');
		break;

	case 7: // 	40555 prmFilterRemainingTime (Remaining time of the Filter Lifetime (Days))
		buf = await readBlock(554, 1);
		dp['filterReset'] = buf.readUInt16LE(0);
		Logger.info('filter reset: ' + dp['filterReset'] + ' days\r\n');
		break;

	case 8: // 	40625 prmWorkTime (Work time of system, in hours)
		buf = await readBlock(624, 2);
		dp['workTime'] = buf.readUInt32LE(0);
		Logger.info('work time: ' + dp['workTime'] + ' hours\r\n');
		break;

	case 9:
		Logger.info(`last block requested ${blockindex}`);
		dp['timestamp'] = Timestamp.now();
		/* last block, do not iterate further */
		return;

	default:
		/* should not happen */
		Logger.error('block index out of range');
		return stop();
	}

	/* request next block be aware that this is a recursive call */
	await requestBlock(++blockindex, dp);
}
