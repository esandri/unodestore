///*jshint node:true, couch: true*/
//'use strict';
//var base = require('../driver.js');
//var _ = require('underscore');
//var collections = require('../../common/Collections.js');
//var us = require('../../unstore.js');
//var async = require('async');
//
//
//var CouchDb = function () {
//	this._name = 'CouchDb';
//	this._connectionParams = null;
//};
//CouchDb.prototype = new base.Driver();
//CouchDb.prototype.constructor = CouchDb;
//CouchDb.prototype.constants = require('./couchdb.constants.js');
//
///**
// * DESIGN_PREFIX is the prefix for all design documents
// **/
//CouchDb.prototype.DESIGN_PREFIX = '_design';
///**
// * DESIGNID is the id of the Master DesignDocument.
// */
//CouchDb.prototype.DESIGNID = '_unstore';
///**
// * VIEW_FETCH_ALL is the view name of the View that fetch all the
// * elements.
// */
//CouchDb.prototype.VIEW_FETCH_ALL = 'fetch_all';
//CouchDb.prototype.VIEW_FETCH_ALL_BY_TYPE = 'fetch_all_by_type';
///**
// * TMP_WRITERS is the name of the tag used in the documents for
// * the validation of VALIDATE_DOC_UPDATE.
// */
//CouchDb.prototype.TMP_WRITERS = 'unstore_tmp_writers';
//
///**
// * SECURITYTOKEN_GODS is the name of SecurityToken God.
// */
//CouchDb.prototype.SECURITYTOKEN_GODS = '_GODS';
//
//CouchDb.prototype.openConnection = function (connectionParams, callback) {
//	if (connectionParams !== undefined) {
//		this._connectionParams = _.defaults(connectionParams, this.constants.defaultsParams);
//	}
//	// create server connection
//	this._server = require('nano')(
//		'http://' +
//		this._connectionParams.user + ':' +
//		this._connectionParams.password + '@' +
//		this._connectionParams.host + ':' +
//		this._connectionParams.port
//	);
//	var me = this;
//	async.waterfall([
//		function (nextfunction) {
//			console.log ('get/create database: ' + me._connectionParams.database);
//			me._server.db.get(me._connectionParams.database, function(err,dbinfo) {
//				if(err) {
//					// create database if don't exist
//					console.log('database does not exists: ' + me._connectionParams.database);
//					me._server.db.create(me._connectionParams.database,nextfunction);
//				} else {
//					nextfunction(null, dbinfo);
//				}
//			});
//			
//			
//		},
//		function (dbinfo, nextfunction) {
//			me._db = me._server.db.use(me._connectionParams.database);
//			console.log ('get design document');
//			// get design document
//			me._db.get(
//				me.DESIGN_PREFIX + '/' + me.DESIGNID,
//				{ revs_info: true },
//				function(err, ddoc) {
//					if(err) {
//						// design document does'nt exists, create a new one
//						console.log('design document does\'nt exists, create a new one');
//						nextfunction(null, {'views':{}});
//					} else {
//						nextfunction(null, ddoc);
//					}
//				}
//			);
//		},
//		function (ddoc, nextfunction) {
//			console.log ('update design document');
//			// set language
//			ddoc.language = 'javascript';
//			// set the update documents validator
//			ddoc.validate_doc_update = me.constants.validate_doc_update;
//			// set defaults view
//			ddoc.views = _.defaults(ddoc.views, me.constants.views);
//			me._db.insert(ddoc, me.DESIGN_PREFIX + '/' + me.DESIGNID, nextfunction);
//		}
//	], function (err, results) {
//		// initial callback in closure
//		if (err) {
//			console.dir(err.message);
//		}
//		callback(err, results);
//	});
//	//setTimeout(callback(), 0);
//};
//
//CouchDb.prototype.closeConnection = function (callback) {
//	// TODO: we should do something? clear variables? If someone invoke a fetch after this noop close?
//	setTimeout(callback(), 0);
//};
//
//CouchDb._do2couchobj = function(dataobject) {	
//	var couchobj = dataobject.getPlainObject();
//	couchobj._id = couchobj.id;
//	if (couchobj.rev) {
//		couchobj._rev = couchobj.rev;
//	}
//	delete couchobj.id;
//	delete couchobj.rev;
//	return couchobj;
//};
//
//CouchDb._couchobj2do = function(couchobj) {
//	couchobj.id = couchobj._id;
//	couchobj.rev = couchobj._rev;
//	delete couchobj._id;
//	delete couchobj._rev;
//	var dataobject = new us.core.DataObject(couchobj);
//	return dataobject;
//};
//
//CouchDb.prototype.dataObjectSave = function(dataobject, writers, callback) {
//	var couchobj = CouchDb._do2couchobj(dataobject);
//	if (dataobject.isPersisted()) {
//		couchobj.unstore_tmp_writers = writers;
//	} else {
//		couchobj.id = dataobject.partition + ':' + dataobject.type + ':' + dataobject.objId;
//	}
//	
//	this._db.insert(couchobj, function(err, doc) {
//		if (err) {
//			callback(err, null);
//		} else {
//			dataobject.id = doc.id;
//			dataobject.rev = doc.rev;
//			callback(null, dataobject);
//		}
//	});
//};
//
//CouchDb.prototype.fetchById = function(id, readers, callback) {
//	this._db.get(id, {rev_info: true}, function(err, doc){
//		if(err) {
//			callback(err, doc);
//		} else {
//			if (collections.canAccess(doc.acl.readers,readers)) {
//				callback(null, CouchDb._couchobj2do(doc));
//			} else {
//				err = new Error("Forbidden");
//				err.error = "forbidden";
//				callback(err, null);
//			}
//		}
//	});
//};
//
//CouchDb.prototype._buildJSSelectFromType = function(type) {
//	return '((doc.type.substr(0,' + type.length() + ') + ".") === "' + type + '.")';
//};
//
//CouchDb.prototype._buildJSSelectFromTypes = function(types) {
//    var result = null;
//    if (types.length === 0) {
//        result = '(true)';
//    } else if (types.length === 1) {
//        result = this._buildJSSelectFromType(types[0]);
//    } else {
//        // types = ["cane","gatto"];
//        // ((doc.type.substr(0,'cane'.length)+'.') == 'cane.' || (doc.type.substr(0,'gatto'.length)+'.') == 'gatto.')
//        var arrConditions = [];
//        for (var i = 0; i < types.length; i++ ) {
//            arrConditions[i] = this._buildJSSelectFromType(types[i]);
//        }
//        result = '(' + arrConditions.join(' || ') + ')';
//                        
//    }
//    return result;	
//};
//
//CouchDb.prototype._buildJSSelectFromCompareElement = function(ce) {
//	return '(doc.obj.' + 
//		ce.getKey() + 
//		us.core.CompareOperator[ce.getOperator()] + 
//		'"' + ce.getValue() + '")';
//};
//
//CouchDb.prototype._buildJSSelectFromLogicalElement = function(le) {
//	var arrQuery = [];
//	var subElem = null;
//	var result = '';
//	for (var index = 0; index < le.getCount(); index++) {
//		subElem = this.buildJSSelectFromSelect(le.getItem(index));
//		arrQuery.push(subElem);
//	}
//
//	if (le.getOperator() === 'NOT') {
//		if (arrQuery.length > 1) {
//			console.warn('NOT Operator applied to multiple elements. MUST be only one!');
//		}
//		result = us.core.LogicalOperator[le.getOperator()] + arrQuery[0];
//	} else {
//		result = arrQuery.join(us.core.LogicalOperator[le.getOperator()]);
//	}
//	return '(' + result + ')';
//};
//
//CouchDb.prototype._buildJSSelectFromSelect = function(select) {
//	if (select) {
//		if (select instanceof us.core.CompareElement) {
//			return this._buildJSSelectFromCompareElement(select);
//		} else {
//			return this._buildJSSelectFromLogicalElement(select);
//		}
//	} else {
//		return 'true';
//	}
//};
//
//CouchDb.prototype.summarySave = function(summary, callback) {
//	// save the summary as a view in couchdatabase
//
//	var selectTypes = this._buildJSSelectFromTypes(summary.getSelectTypes());
//	var selectSelect = this._buildJSSelectFromSelect(summary.getSelectQuery());
//
//	var emitList = [];
//	var resultList = [];
//
//	var emits = '';
//	var results = '';
//
//	var columns = summary.getColumns();
//	for (var cindex = 0; cindex < columns.length; cindex++) {
//		var colvalue = 'doc.obj.' + columns[cindex].getKey();
//		if (columns[cindex].isOrdered()) {
//			emitList.push(colvalue);
//		} else {
//			resultList.push(colvalue);
//		}
//	}
//
//	emits = '[' + emitList.join(',') + ']';
//	results = '[' + resultList.join(',') + ']';
//
//	var me = this;
//	async.waterfall([		
//		function (nextfunction) {
//			console.log ('get design document');
//			// get design document
//			me._db.get(
//				me.DESIGN_PREFIX + '/' + summary.getName(),
//				{ revs_info: true },
//				function(err, ddoc) {
//					if(err) {
//						// design document does'nt exists, create a new one
//						console.log('design document does\'nt exists, create a new one');
//						nextfunction(null, {
//							'language': 'javascript',
//							'views':{}
//						});
//					} else {
//						nextfunction(null, ddoc);
//					}
//				}
//			);
//		},
//		function (ddoc, nextfunction) {
//			console.log ('update design document');
//			// set defaults view
//			ddoc.views[summary.getName()] = me.constants.buildView(
//				selectTypes,
//				selectSelect,
//				emits,
//				results
//			);
//			me._db.insert(ddoc, me.DESIGN_PREFIX + '/' + summary.getName(), nextfunction);
//		}
//	], function (err, results) {
//		// initial callback in closure
//		if (err) {
//			console.dir(err.message);
//		}
//		callback(err, results);
//	});
//
//
//};
//
//exports.create = function () {
//	return new CouchDb();
//};