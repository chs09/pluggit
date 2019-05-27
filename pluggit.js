/* eslint-disable no-console */
'use strict';

const FileSystem = require('fs');

// The Buffer class is within the global scope, making it unlikely that one would need to ever use require('buffer').Buffer.
// const Buffer = require('buffer').Buffer;

const Modbus = require('modbus-stack');
const ModbusClient = require('modbus-stack/client');
// 'RIR' contains the "Function Code" that we are going to invoke on the remote device
const FC = Modbus.FUNCTION_CODES;

if(ModbusClient.RESPONSES[3] === undefined)
	ModbusClient.RESPONSES[3] = ModbusClient.RESPONSES[4];

const Timestamp = require('./timestamp');

/* common code */
console.log('adapter pluggit: reading settings');
var settings = require(__dirname + '/settings.json');

/* set true for more debugging info */
var debug = settings.debug;

function stop() {
	dbgout('adapter pluggit: terminating');
	setTimeout( process.exit, 250 );
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

function dbgout(log) {
	if (debug) {
		console.log(log);
	}
}

let client;

async function main() {
	/* modbus data is stored here */
	let dp = new Array();

	// IP and port of the MODBUS slave, default port is 502
	client = ModbusClient.createClient(settings.pluggit.port, settings.pluggit.host);
	client.setTimeout(3000, () => {
		dbgout('socket idle timeout');
	});

	try {
		await requestBlock(0, dp);
	} catch (err) {
		console.error(err);
		return stop();
	} finally {
		client.end();
		client = null;
	}

	/* store all data in database */
	storeDatabase(dp);
}
main();
setInterval(() => {
	main();
}, 5000);

function readBlock(start, len) {
	return new Promise((resolve, reject) => {
		dbgout(`requesting block ${start},${len}`);
		client.request(FC.READ_HOLDING_REGISTERS, start, len, function(err, response) {
			if (err) { /* stop on error */
				dbgout(`error reading block ${start},${len}`);
				reject(err);
				return stop();
			}
			
			/* write modbus data array to buffer this is easier to handle/convert the data */
			var buf = Buffer.alloc(response.length*2);
			for (var i=0; i<response.length; i++) {
				buf.writeUInt16LE(response[i],i*2);
			}
			dbgout(`block ${start},${len}: ${buf.toString('hex')}`);
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
		dbgout(`sn: ${dp['serial']}, name: ${dp['name']}, fw: ${dp['version']}\r\n`);
		break;

	case 1: // 40101 prmHALTaho1, 40103 prmHALTaho2
		buf = await readBlock(100, 4);
		dp['fan1'] = buf.readFloatLE(0).toFixed(1);
		dp['fan2'] = buf.readFloatLE(4).toFixed(1);
		dbgout(`fan1: ${dp['fan1']} rpm, fan2: ${dp['fan2']} rpm\r\n`);
		break;

	case 2: // 40133 prmRamIdxT1, 40135 prmRamIdxT2, 40137 prmRamIdxT3, 40139 prmRamIdxT4, 40141 prmRamIdxT5
		buf = await readBlock(132, 20);
		dp['t1'] = buf.readFloatLE(0).toFixed(2);
		dp['t2'] = buf.readFloatLE(4).toFixed(2);
		dp['t3'] = buf.readFloatLE(8).toFixed(2);
		dp['t4'] = buf.readFloatLE(12).toFixed(2);
		dp['t5'] = buf.readFloatLE(16).toFixed(2);
		dbgout(`t1: ${dp['t1']} °C, t2: ${dp['t2']} °C, t3: ${dp['t3']} °C, t4: ${dp['t4']} °C, t5: ${dp['t5']} °C\r\n`);
		break;

	case 3: // 40197 prmRamIdxRh3Corrected, 40199 prmRamIdxBypassActualState
		buf = await readBlock(196, 4);
		dp['humidity'] = buf.readUInt32LE(0);
		dp['bypass'] = buf.readUInt32LE(4);
		switch (dp['bypass']) {
		case 0x0000: dp['bypassState'] = 'closed'; break;
		case 0x0001: dp['bypassState'] = 'in process'; break;
		case 0x0020: dp['bypassState'] = 'closing'; break;
		case 0x0040: dp['bypassState'] = 'opening'; break;
		case 0x00FF: dp['bypassState'] = 'opened'; break;
		default: dp['bypassState'] = 'unknown'; break;
		}
		dbgout(`RH: ${dp['humidity']}%\r\nBypass: ${dp['bypass']} (${dp['bypassState']})\r\n`);
		break;

	case 4: // 40325 prmRomIdxSpeedLevel
		buf = await readBlock(324, 1);
		dp['speed'] = buf.readUInt16LE(0);
		dbgout(`speed: ${dp['speed']}\r\n`);
		break;

	case 5: // 40473 prmCurrentBLState
		buf = await readBlock(472, 1);
		dp['state'] = buf.readUInt16LE(0);
		dp['stateText'] = STATES[dp['state']] || 'unknown';
		dbgout('state: ' + dp['state'] + ' (' + dp['stateText'] + ')\r\n');
		break;

	case 6: // 40517 prmLastActiveAlarm
		buf = await readBlock(516, 1);
		dp['alarm'] = buf.readUInt16LE(0);
		dp['alarmState'] = ALARMS[dp['alarm']] || 'unkown';
		dbgout('alarm: ' + dp['alarm'] + ' (' + dp['alarmState'] + ')\r\n');
		break;

	case 7: // 	40555 prmFilterRemainingTime (Remaining time of the Filter Lifetime (Days))
		buf = await readBlock(554, 1);
		dp['filterReset'] = buf.readUInt16LE(0);
		dbgout('filter reset: ' + dp['filterReset'] + ' days\r\n');
		break;

	case 8: // 	40625 prmWorkTime (Work time of system, in hours)
		buf = await readBlock(624, 2);
		dp['workTime'] = buf.readUInt32LE(0);
		dbgout('work time: ' + dp['workTime'] + ' hours\r\n');
		break;

	case 9:
		dbgout(`last block requested ${blockindex}`);
		dp['timestamp'] = Timestamp.now();
		/* last block, do not iterate further */
		return;

	default:
		/* should not happen */
		dbgout('block index out of range')
		return stop();
	}

	/* request next block be aware that this is a recursive call */
	await requestBlock(++blockindex, dp);
}

function checkModified(deviceId, dp) {
	let cache;
	try {
		let data = FileSystem.readFileSync(__dirname+'/cache.json');
		cache = JSON.parse(data);
	} catch (err) {
		dbgout('could not read cache file');
		cache = {};
	}

	let c;
	let modified = false;
	if(cache[deviceId]) {
		function distance(v1, v2) {
			return Math.abs( Number.parseFloat(v1) - Number.parseFloat(v2) );
		}

		c = cache[deviceId];
		if( Math.abs(Timestamp.parseSeconds(dp.timestamp) - Timestamp.parseSeconds(c.timestamp)) > 300 ) {
			dbgout('timeout, renew entry after 300 seconds');
			modified = true;
		}
		
		if(!modified) {
			let properties = ['t1', 't2', 't3', 't4', 't5'];
			for(let i=0; i<properties.length; i++) {
				let prop = properties[i];
				let delta = distance(dp[prop], c[prop]);
				if(delta > 0.1) {
					dbgout(`${prop}: delta(${dp[prop]}, ${c[prop]}) > 0.1`);
					modified = true;
					break;
				}
			}
		}
		
		if(!modified) {
			let properties = ['fan1', 'fan2']
			for(let i=0; i<properties.length; i++) {
				let prop = properties[i];
				let delta = distance(dp[prop], c[prop]);
				if(delta > 100) {
					dbgout(`${prop}: delta(${dp[prop]}, ${c[prop]}) > 100`);
					modified = true;
					break;
				}
			}
		}

		if(!modified) {
			let properties = ['humidity', 'bypass', 'speed', 'state', 'alarm'];
			for(let i=0; i<properties.length; i++) {
				let prop = properties[i];
				if(dp[prop] != c[prop]) {
					dbgout(`${prop}: ${dp[prop]} != ${c[prop]}`);
					modified = true;
					break;
				}
			}
		}
	} else {
		dbgout('no last value');
		modified = true;
	}

	if(modified) {
		cache[deviceId] = Object.assign({}, dp);
		try {
			FileSystem.writeFileSync(__dirname+'/cache.json', JSON.stringify(cache));
		} catch (err) {
			dbgout('could not write cache file');
		}
	} else {
		dbgout('state not modified since last check ' + (c ? Timestamp.parseDate(c.timestamp) : null));
	}
	return modified;
}

/* store data in database */
function storeDatabase(dp)
{
	if(!checkModified(dp.serial, dp))
		return;

	/* is mysql adapter defined? */
	if ((typeof settings.mysql) == 'undefined')
		return;

	/* connect to mysql database */
	const mysql = require('mysql');
	let connection = mysql.createConnection({
		host: settings.mysql.host,
		user: settings.mysql.user,
		password: settings.mysql.pass
	});

	connection.connect(function (err) {
		if (err) {
			dbgout('adapter pluggit can\'t connect to mysql-server ' + err);
			return stop();
		}
		dbgout('adapter pluggit connected to mysql-server on ' + settings.mysql.host);
	});

	/* select database and insert data */
	connection.query('USE ' + settings.mysql.database);

	function findDeviceId() {
		return new Promise(function (resolve, reject) {
			let sqlSelectDevice = connection.format('SELECT id FROM devices WHERE serial = ?', [dp['serial']]);
			dbgout(sqlSelectDevice);
			connection.query(sqlSelectDevice, (err, results) => {
				if (err) {
					reject(sqlSelectDevice + err);
					return;
				}
				if (results.length > 0) {
					resolve(results[0].id);
				} else {
					let sqlInsertDevice = connection.format('INSERT INTO devices(serial, name) VALUES ( ?, ? )', [dp['serial'], dp['name']]);
					dbgout(sqlInsertDevice);
					connection.query(sqlInsertDevice, function (err, results) {
						if (err) {
							reject(sqlInsertDevice + err);
						} else {
							// https://github.com/mysqljs/mysql#getting-the-id-of-an-inserted-row
							resolve(results.insertId);
						}
					});
				}
			});
		});
	}

	function updateDeviceStats(deviceId) {
		let values = [dp['name'], dp['filterReset'], dp['workTime'], dp['version'], deviceId];
		let sqlUpdateDevice = connection.format('UPDATE devices SET name = ?, filter_reset = ?, work_time = ?, version = ? WHERE id = ?', values);
		dbgout(sqlUpdateDevice);
		connection.query(sqlUpdateDevice);
	}

	function insertDataRow(deviceId) {
		let values = [deviceId, dp['timestamp'], dp['t1'], dp['t2'], dp['t3'], dp['t4'], dp['t5'], dp['fan1'], dp['fan2'], dp['humidity'], dp['bypassState'], dp['speed']];
		var sqlInsertValues = connection.format('INSERT INTO datapoints VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', values);
		dbgout(sqlInsertValues);
		connection.query(sqlInsertValues);
	}

	function updateState(deviceId) {
		let sqlInsertAlarm = 'INSERT INTO states (device, timestamp, state, alarm) '
			+ ` SELECT ${deviceId}, ${dp['timestamp']}, ${connection.escape(dp['stateText'])}, ${connection.escape(dp['alarmState'])}`
			+ ' WHERE NOT EXISTS(' // insert alarm if state changed since last time
			+ '   SELECT 1 FROM states '
			+ `   WHERE device = ${deviceId} `
			+ `   AND timestamp = (SELECT timestamp FROM states WHERE device = ${deviceId} ORDER BY timestamp DESC LIMIT 1)`
			+ `   AND alarm = ${connection.escape(dp['alarmState'])}`
			+ `   AND state = ${connection.escape(dp['stateText'])}`
			+ ');'; // end of WHERE NOT EXISTS

		dbgout(sqlInsertAlarm);
		connection.query(sqlInsertAlarm);
	}

	findDeviceId()
		.then((deviceId) => {
			updateDeviceStats(deviceId);
			insertDataRow(deviceId);
			updateState(deviceId);
		}, (err) => {
			dbgout('unable to find device id');
			throw err;
		})
		.finally(() => {
			/* close database */
			connection.end();
		});
}
