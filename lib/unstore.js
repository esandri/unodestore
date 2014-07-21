/*jshint node:true*/
'use strict';
// UnStore Universal Storage library
// =================================

var core = require('./core/core.js');
	
var UnStore = function() {
	this._name = 'UnStore';
	this._driver = null;
};


/**
 * Set the required driver
 * @function setDriver
 */
UnStore.prototype.setDriver = function(driverName) {
	this._driver = require('./drivers/' + driverName + '/' + driverName + '.us.js').create();
};

UnStore.prototype.openConnection = function(connectionParams, callback) {
	return this._driver.openConnection(connectionParams, callback);
};

UnStore.prototype.closeConnection = function(callback) {
	return this._driver.closeConnection(callback);
};


UnStore.prototype.fetchByTypeId = function(type, id, partition, readers, callback) {
	this._driver.fetchByTypeId(type, id, partition, readers, callback);
};

UnStore.prototype.fetchAllByType = function( type, start, count, partition, readers, callback) {
	this._driver.fetchAllByType(type, start, count, partition, readers, callback);
};

UnStore.prototype.fetchAll = function( start, count, partition, readers, callback) {
	this._driver.fetchAll(start, count, partition, readers, callback);
};

UnStore.prototype.summaryFetch = function(summaryname, query, partition, readers, callback) {
	return this._driver.summaryFetch(summaryname, query, partition, readers, callback);
};

UnStore.prototype.dataObjectSave = function(dataobject, writers, callback) {
	return this._driver.dataObjectSave(dataobject, writers, callback);
};

UnStore.prototype.dataObjectDelete = function(dataobject, writers, callback) {
	return this._driver.dataObjectDelete(dataobject, writers, callback);
};

UnStore.prototype.summarySave = function(summary, callback) {
	return this._driver.summarySave(summary, callback);
};


UnStore.prototype.dataObjectUpdate = function(dataobject, writers, callback) {
	var me = this;
	this._driver.fetchByTypeId(dataobject.type, dataobject.id, dataobject.partition, writers, function(err, doc) {
		if (err) {
			if (err.error === 'not_found') {
				doc = {ver: '0'};
			} else {
				callback(err,doc);
				return;
			}
		}

		if (dataobject.ver === false || doc.ver < dataobject.ver) {
			if (doc.rev) {
				dataobject.rev = doc.rev;
			}
			me._driver.dataObjectSave(dataobject, writers, callback);
		} else {
			callback(null, doc);
		}

	});
};

/**
 * the value of F_TRANSACTIONAL.
 */
UnStore.prototype.F_TRANSACTIONAL = 'transactional';
/**
 * the value of TYPE_SUMMARY.
 */
UnStore.prototype.TYPE_SUMMARY = '_unstore_summary';
/**
 * the value of PARTITION_SUMMARY.
 */
UnStore.prototype.PARTITION_SUMMARY = '_unstore';
/**
 * The prefix that identify un UnStore id.
 */
UnStore.prototype.ID_PREFIX = '$';

exports.core = core;
exports.UnStore = UnStore;