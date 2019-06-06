// cache last result //
'use strict';

const FileSystem = require('fs');
const Path = require('path');
const OS = require('os');
const Logger = require('./logger');

const path = Path.join(OS.homedir(), '.pluggit');
let cache = reload();

function reload() {
	if (FileSystem.existsSync(path)) {
		try {
			let data = FileSystem.readFileSync(path);
			return JSON.parse(data);
		} catch (err) {
			Logger.error(err);
		}
	}
	return {};
}

FileSystem.watchFile(path, (prev, fsStatsNow) => {
	if (fsStatsNow.ctimeMs > this.lastRead) {
		Logger.verbose(`file ${this.path} changed, reloading`);
		this.lastRead = fsStatsNow.ctimeMs;
		cache = reload();
	}
});

function flush() {
	try {
		FileSystem.writeFileSync(path, JSON.stringify(cache));
	} catch (err) {
		Logger.error('could not write cache file', err);
	}
}

function getEntry(id) {
	if(id in cache)
		return cache[id];
	else
		return null;
}

function setEntry(id, value) {
	if(typeof value === 'object') {
		value = Object.assign({}, value);
	}

	cache[id] = value;
	flush();
}

module.exports = {
	get: getEntry,
	set: setEntry
};