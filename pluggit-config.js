const FileSystem = require('fs');
const Path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function questionString(question, defaultValue) {
	let choice = '';
	if(defaultValue) {
		choice = `[${defaultValue}] `;
	}
	// eslint-disable-next-line no-unused-vars
	return new Promise((resolve, reject) => { 
		rl.question(question + ' ' + choice, (answer) => {
			if(!answer) {
				resolve( defaultValue );
				return;
			}
			resolve( answer );
		});
	});
}

function questionBoolean(question, defaultValue) {
	let choice;
	if(defaultValue === true) {
		choice = 'y/n [Y] ';
	} else {
		choice = 'y/n [N] ';
		defaultValue = false;
	}

	// eslint-disable-next-line no-unused-vars
	return new Promise((resolve, reject) => { 
		rl.question(question + ' ' + choice, (answer) => {
			if(!answer) {
				resolve( defaultValue );
				return;
			}
			resolve( (answer.toLocaleLowerCase() == 'y') );
		});
	});
}

function questionNumber(question, defaultValue) {
	if(!defaultValue) defaultValue = 0;
	return new Promise((resolve, reject) => { 
		rl.question(question + ` [${defaultValue}] `, (answer) => {
			if(!answer) {
				resolve( defaultValue );
				return;
			}

			try {
				resolve(Number.parseInt(answer));
			} catch (e) {
				reject(e);
			}
		});
	});
}

async function configure () {
	let cfg = {};

	cfg.polling = await questionNumber('Do you want to poll periodical? Enter polling interval in milliseconds (0=disabled):', 0);
	cfg.debug = await questionBoolean('Debug?', false);
	
	let host = await questionString('Pluggit IP', '192.168.178.50');
	let port = await questionNumber('Pluggit Port (modbus default=502)', 502);
	cfg.pluggit = {
		host: host,
		port: port
	};

	let mysql = await questionBoolean('Use MySQL to store Datapoints?', true);
	if(mysql) {
		cfg.mysql = {};

		cfg.mysql.host = await questionString('MySQL IP', '127.0.0.1');
		cfg.mysql.user = await questionNumber('Database User', 'pluggit');
		cfg.mysql.pass = await questionString('Database Password', null);
		cfg.mysql.database = await questionString('Database Name', 'pluggit');
	}
	rl.close();
	let path = Path.join(__dirname, 'settings.json' );
	process.stdout.write('generating file ' + path);
	FileSystem.writeFileSync( path, JSON.stringify(cfg) );
}
configure();