'use strict';

const Logger = require('./utils/logger');
const Store = require('./utils/datastore');
const Timestamp = require('./utils/timestamp');

var settings = require(__dirname + '/settings.json');

const Pluggit = require('./pluggit');
let interval = Number.parseInt(settings.period);

Pluggit.on('data', async (dp) => {
	if(checkModified(dp.serial, dp))
		await storeDatabase(dp);

	if(!interval) {
		stop();
	}
});

Pluggit.on('error', () => {
	stop();
});

Pluggit.once('stop', () => {
	stop();
});

if(interval > 1000) {
	Logger.info('data interval ' + interval);
	setInterval(() => {
		Pluggit.fetch();
	}, interval);
	Pluggit.fetch();
} else {
	Pluggit.fetch();
	interval = null;
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

function stop() {
	Logger.info('main: terminating process');
	setTimeout( process.exit, 250 );
}

function distance(v1, v2) {
	return Math.abs( Number.parseFloat(v1) - Number.parseFloat(v2) );
}

function checkModified(deviceId, dp) {
	let c = Store.get(deviceId);
	let modified = false;
	if(c) {
		if( Math.abs(Timestamp.parseSeconds(dp.timestamp) - Timestamp.parseSeconds(c.timestamp)) > 300 ) {
			Logger.info('timeout, renew entry after 300 seconds');
			modified = true;
		}
		
		if(!modified) {
			let properties = ['t1', 't2', 't3', 't4', 't5'];
			for(let i=0; i<properties.length; i++) {
				let prop = properties[i];
				let delta = distance(dp[prop], c[prop]);
				if(delta > 0.1) {
					Logger.info(`${prop}: delta(${dp[prop]}, ${c[prop]}) > 0.1`);
					modified = true;
					break;
				}
			}
		}
		
		if(!modified) {
			let properties = ['fan1', 'fan2'];
			for(let i=0; i<properties.length; i++) {
				let prop = properties[i];
				let delta = distance(dp[prop], c[prop]);
				if(delta > 100) {
					Logger.info(`${prop}: delta(${dp[prop]}, ${c[prop]}) > 100`);
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
					Logger.info(`${prop}: ${dp[prop]} != ${c[prop]}`);
					modified = true;
					break;
				}
			}
		}
	} else {
		Logger.debug('no last value');
		modified = true;
	}

	if(modified) {
		Store.set(deviceId, Object.assign({}, dp));
	} else {
		Logger.info('state not modified since last check ' + (c ? Timestamp.parseDate(c.timestamp) : null));
	}
	return modified;
}

/* store data in database */
function storeDatabase(dp)
{
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
			Logger.error('adapter pluggit can\'t connect to mysql-server ' + err);
			return stop();
		}
		Logger.info('adapter pluggit connected to mysql-server on ' + settings.mysql.host);
	});

	/* select database and insert data */
	connection.query('USE ' + settings.mysql.database);

	function findDeviceId() {
		return new Promise(function (resolve, reject) {
			let sqlSelectDevice = connection.format('SELECT id FROM devices WHERE serial = ?', [dp['serial']]);
			Logger.debug(sqlSelectDevice);
			connection.query(sqlSelectDevice, (err, results) => {
				if (err) {
					reject(sqlSelectDevice + err);
					return;
				}
				if (results.length > 0) {
					resolve(results[0].id);
				} else {
					let sqlInsertDevice = connection.format('INSERT INTO devices(serial, name) VALUES ( ?, ? )', [dp['serial'], dp['name']]);
					Logger.debug(sqlInsertDevice);
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
		Logger.debug(sqlUpdateDevice);
		connection.query(sqlUpdateDevice);
	}

	function insertDataRow(deviceId) {
		let values = [deviceId, dp['timestamp'], dp['t1'], dp['t2'], dp['t3'], dp['t4'], dp['t5'], dp['fan1'], dp['fan2'], dp['humidity'], dp['bypassState'], dp['speed']];
		var sqlInsertValues = connection.format('INSERT INTO datapoints VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', values);
		Logger.debug(sqlInsertValues);
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

		Logger.debug(sqlInsertAlarm);
		connection.query(sqlInsertAlarm);
	}

	return new Promise((resolve, reject) => {
		findDeviceId()
			.then((deviceId) => {
				updateDeviceStats(deviceId);
				insertDataRow(deviceId);
				updateState(deviceId);
				resolve(deviceId);
			}, (err) => {
				Logger.error('unable to find device id');
				reject(err);
				throw err;
			})
			.finally(() => {
				/* close database */
				connection.end();
			});
	});
}
