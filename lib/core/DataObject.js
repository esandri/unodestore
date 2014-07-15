// DataObject

/*jshint node:true, couch: true, trailing: false*/
'use strict';

var DataObject = function (obj) {
	if(obj === undefined) {
		this.id = null;
		this.rev = null;
		this.type = null;
		this.obj = null;
		this.acl = null;
		this.objId = null;
		this.partition = null;
	} else {
		this.id = obj.id || null;
		this.rev = obj.rev || null;
		this.type = obj.type || null;
		this.obj = obj.obj || {};
		this.setACL(obj.acl);
		this.objId = obj.objId || null;
		this.partition = obj.partition || null;	
	}
};

DataObject.prototype = {
	getId: function () { return this.id; },
	setId: function (id) { this.id = id; },

	getRev: function () { return this.rev; },
	setRev: function (rev) { this.rev = rev; },

	getType: function () { return this.type; },
	setType: function (doType) { this.type = doType; },

	getObject: function () { return this.obj; },
	setObject: function (obj) { this.obj = obj; },

	getACL: function () { return this.acl; },
	setACL: function (acl) { 
		if (acl instanceof ACL) {
			this.acl = acl;
		} else {
			this.acl = new ACL(acl);
		}
	},

	getObjId: function () { return this.objId; },
	setObjId: function (objId) { this.objId = objId; },

	getPartition: function () { return this.partition; },
	setPartition: function (partition) { this.partition = partition; },

	isPersisted: function () { return (this.id !== null); },

	getPlainObject: function() {
		return {
			id: this.getId(),
			rev: this.getRev(),
			type: this.getType(),
			obj: this.getObject(),
			acl: this.getACL().getPlainObject(),
			objId: this.getObjId(),
			partition: this.getPartition()
		};
	}
};

var ACL = function (obj) {
	if (obj === undefined) {
		this.readers = {};
		this.writers = {};
	} else {
		this.readers = obj.readers || {};
		this.writers = obj.writers || {};
	}
};

ACL.prototype = {
	getReaders: function () { return this.readers; },
	setReaders: function (readers) { this.readers = readers; },

	getWriters: function () { return this.writers; },
	setWriters: function (writers) { this.writers = writers; },

	addReader: function (securityToken) { this.readers[securityToken] = securityToken; },
	addWriter: function (securityToken) { this.writers[securityToken] = securityToken; },

	removeReader: function (securityToken) { delete this.readers[securityToken]; },
	removeWriter: function (securityToken) { delete this.writers[securityToken]; },

	canRead:  function (securityToken) { return (typeof(this.readers[securityToken]) !== 'undefined'); },
	canWrite: function (securityToken) { return (typeof(this.writers[securityToken]) !== 'undefined'); },

	getPlainObject: function() {
		return {
			readers: this.getReaders(),
			writers: this.getWriters()
		};
	}
};

var Relation = function () {
	this.doFrom = null;
	this.doTo = null;
	this.qualifier = null;
};

Relation.prototype = {
	getFrom: function () { return this.doFrom; },
	setFrom: function (doFrom) { this.doFrom = doFrom; },

	getTo: function () { return this.doTo; },
	setTo: function (doTo) { this.doTo = doTo; },

	getQualifier: function () { return this.qualifier; },
	setQualifier: function (qualifier) { this.qualifier = qualifier; }
};

exports.DataObject = DataObject;
exports.ACL = ACL;
exports.Relation = Relation;