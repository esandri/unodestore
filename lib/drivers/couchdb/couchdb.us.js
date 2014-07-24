/*jshint node:true, couch: true, trailing: false*/
'use strict';
var base = require('../driver.js');
var _ = require('underscore');
var collections = require('../../common/Collections.js');
var us = require('../../unstore.js');
var async = require('async');


var CouchDb = function () {
	this._name = 'CouchDb';
	this._connectionParams = null;
};
CouchDb.prototype = new base.Driver();
CouchDb.prototype.constructor = CouchDb;
CouchDb.prototype.constants = require('./couchdb.constants.js');

/**
 * DESIGN_PREFIX is the prefix for all design documents
 **/
CouchDb.prototype.DESIGN_PREFIX = '_design';
/**
 * DESIGNID is the id of the Master DesignDocument.
 */
CouchDb.prototype.DESIGNID = '_unstore';
/**
 * VIEW_FETCH_ALL is the view name of the View that fetch all the
 * elements.
 */
CouchDb.prototype.VIEW_FETCH_ALL = 'view_fetch_all';
CouchDb.prototype.VIEW_FETCH_ALL_BY_TYPE = 'view_fetch_all_by_type';

/**
 * The minimum elements fetched
 * @type {Number}
 */
CouchDb.prototype.VIEW_FETCH_MINBLOCK = 100;

/**
 * TMP_WRITERS is the name of the tag used in the documents for
 * the validation of VALIDATE_DOC_UPDATE.
 */
CouchDb.prototype.TMP_WRITERS = 'unstore_tmp_writers';

/**
 * SECURITYTOKEN_GODS is the name of SecurityToken God.
 */
CouchDb.prototype.SECURITYTOKEN_GODS = '_GODS';

CouchDb.prototype.openConnection = function (connectionParams, callback) {
	if (connectionParams !== undefined) {
		this._connectionParams = _.defaults(connectionParams, this.constants.defaultsParams);
	}
	// create server connection
	this._server = require('nano')(
		'http://' +
		this._connectionParams.user + ':' +
		this._connectionParams.password + '@' +
		this._connectionParams.host + ':' +
		this._connectionParams.port
	);
	var me = this;
	// 1 - create database
	// 2 - get unstore design document
	// 3 - update unstore design document
	async.waterfall([
		function (nextfunction) {
			// console.log ('get/create database: ' + me._connectionParams.database);
			me._server.db.get(me._connectionParams.database, function(err,dbinfo) {
				if(err) {
					// create database if don't exist
					console.log('database does not exists: ' + me._connectionParams.database);
					me._server.db.create(me._connectionParams.database,function(err, obj) {
						nextfunction(err, obj);
					});
				} else {
					nextfunction(null, dbinfo);
				}
			});
			
			
		},
		function (dbinfo, nextfunction) {
			me._db = me._server.db.use(me._connectionParams.database);
			// get design document
			me._db.get(
				me.DESIGN_PREFIX + '/' + me.DESIGNID,
				{ revs_info: true },
				function(err, ddoc) {
					if(err) {
						// design document does'nt exists, create a new one
						console.log('design document does\'nt exists, create a new one');
						nextfunction(null, {'views':{}});
					} else {
						nextfunction(null, ddoc);
					}
				}
			);
		},
		function (ddoc, nextfunction) {
			// set language
			ddoc.language = 'javascript';
			// set the update documents validator
			ddoc.validate_doc_update = me.constants.validate_doc_update;
			// set defaults view
			ddoc.views = _.defaults(ddoc.views, me.constants.views);
			me._db.insert(ddoc, me.DESIGN_PREFIX + '/' + me.DESIGNID, nextfunction);
		}
	], function (err, results) {
		if (err) {
			console.dir(err.message);
		}
		callback(err, results);
	});
};

CouchDb.prototype.closeConnection = function (callback) {
	// TODO: we should do something? clear variables? If someone invoke a fetch after this noop close?
	setTimeout(callback(), 0);
};

/**
 * _makeIfFromDo create the couchdb id 
 * @param dataobject
 * @returns the _id for couchdb
 */
CouchDb._makeIdFromDo = function(dataobject) {
	return dataobject.partition + ':' + dataobject.type + ':' + dataobject.id;
};

/**
 * _do2couchobj return an object to store into couchdb
 * @param dataobject
 * @returns
 */
CouchDb._do2couchobj = function(dataobject) {
	var couchobj =  _.clone(dataobject);

	couchobj._id = CouchDb._makeIdFromDo(dataobject);
	if (couchobj.rev) {
		couchobj._rev = couchobj.rev;
	}
	delete couchobj.rev;
	return couchobj;
};

/**
 * _couchobj2do return a dataobject from the couchdb object
 * @param couchobj
 * @returns
 */
CouchDb._couchobj2do = function(couchobj) {
	var dataobject = _.clone(couchobj);
	dataobject.rev = couchobj._rev;
	delete dataobject._id;
	delete dataobject._rev;
	return dataobject;
};

CouchDb.prototype.dataObjectSave = function(dataobject, writers, callback, deletedoc) {
	var couchobj = CouchDb._do2couchobj(dataobject);
	couchobj.updated = new Date();
	if (dataobject.rev) {
		/*if (typeof writers[this.SECURITYTOKEN_GODS] !== 'undefined') {
			delete couchobj[this.TMP_WRITERS];
		} else*/ 
		if (writers === 'GOD') {
			delete couchobj[this.TMP_WRITERS];
		} else {
			couchobj[this.TMP_WRITERS] = writers;
		}
	} else {
		couchobj.created = new Date();
	}
	
	if (deletedoc) {
		couchobj._deleted = true;
	}

	this._db.insert(couchobj, function(err, doc) {
		if (err) {
			callback(err, null);
		} else {
			dataobject.rev = doc.rev;
			if (deletedoc) {
				dataobject._deleted = true;
			}			
			callback(null, dataobject);
		}
	});
};

CouchDb.prototype.fetchByTypeId = function(type, id, partition, readers, callback) {
	var couchid = CouchDb._makeIdFromDo({id: id, type: type, partition: partition});
	this._db.get( couchid, {rev_info: true}, function(err, doc){
		if(err) {
			if (err.status_code === 404) {
				err = new Error('Not found');
				err.error = 'not_found';
				callback(err, null);				
			} else {
				callback(err, doc);
			}
		} else {
			if (collections.canAccess(doc.acl.readers,readers)) {
				callback(null, CouchDb._couchobj2do(doc));
			} else {
				err = new Error('Forbidden');
				err.error = 'forbidden';
				callback(err, null);
			}
		}
	});
};

CouchDb.prototype.fetchAll = function (start, count, partition, readers, callback) {
	this.summaryFetch(
		{
			dname: '_unstore',
			sname: this.VIEW_FETCH_ALL 
		},
		{
			start: start,
			count: count
		},
		partition, 
		readers, 
		callback
	);
};

CouchDb.prototype.fetchAllByType = function (type, start, count, partition, readers, callback) {
	this.summaryFetch(
		{
			dname: '_unstore',
			sname: this.VIEW_FETCH_ALL_BY_TYPE 
		},
		{
			values: [type],
			start: start,
			count: count
		},
		partition, 
		readers, 
		callback
	);
};

CouchDb.prototype._buildJSSelectFromType = function(type) {
	return '((doc.type.substr(0,' + type.length + ') + ".") === "' + type + '.")';
};

CouchDb.prototype._buildJSSelectFromTypes = function(types) {
    var result = null;
    if (types.length === 0) {
        result = '(true)';
    } else if (types.length === 1) {
        result = this._buildJSSelectFromType(types[0]);
    } else {
        // types = ["cane","gatto"];
        // ((doc.type.substr(0,'cane'.length)+'.') == 'cane.' || (doc.type.substr(0,'gatto'.length)+'.') == 'gatto.')
        var arrConditions = [];
        for (var i = 0; i < types.length; i++ ) {
            arrConditions[i] = this._buildJSSelectFromType(types[i]);
        }
        result = '(' + arrConditions.join(' || ') + ')';
                        
    }
    return result;	
};

CouchDb.prototype._buildJSSelectFromCompareElement = function(ce) {
	return '(doc.obj.' +
		ce.key +
		us.core.CompareOperator[ce.operator] +
		'"' + ce.value + '")';
};

CouchDb.prototype._buildJSSelectFromLogicalElement = function(le) {
	var arrQuery = [];
	var subElem = null;
	var result = '';
	for (var index = 0; index < le.elements.length; index++) {
		subElem = this.buildJSSelectFromSelect(le.elements[index]);
		arrQuery.push(subElem);
	}

	if (le.operator === 'NOT') {
		if (arrQuery.length > 1) {
			console.warn('NOT Operator applied to multiple elements. MUST be only one!');
		}
		result = us.core.LogicalOperator[le.operator] + arrQuery[0];
	} else {
		result = arrQuery.join(us.core.LogicalOperator[le.operator]);
	}
	return '(' + result + ')';
};

CouchDb.prototype._buildJSSelectFromSelect = function(select) {
	if (select) {
		if (select.type === 'compare' || select.key) {
			return this._buildJSSelectFromCompareElement(select);
		} else {
			return this._buildJSSelectFromLogicalElement(select);
		}
	} else {
		return 'true';
	}
};

CouchDb.prototype.summarySave = function(summary, callback) {
	// save the summary as a view in couchdatabase

	var selectTypes = this._buildJSSelectFromTypes(summary.types);
	var selectSelect = this._buildJSSelectFromSelect(summary.select);

	var emitList = [];
	var resultList = [];

	var emits = '';
	var results = '';

	var columns = summary.columns;
	for (var cindex = 0; cindex < columns.length; cindex++) {
		var colvalue = (columns[cindex].value == undefined) ? ('doc.obj.' + columns[cindex].key):(columns[cindex].value);
		if (columns[cindex].ordered) {
			emitList.push(colvalue);
		} else {
			resultList.push(colvalue);
		}
	}

	emits = '[' + emitList.join(',') + ']';
	results = '[' + resultList.join(',') + ']';

	var me = this;
	async.waterfall([		
		function (nextfunction) {
			// get design document
			me._db.get(
				me.DESIGN_PREFIX + '/' + summary.name,
				{ revs_info: true },
				function(err, ddoc) {
					if(err) {
						// design document does'nt exists, create a new one
						nextfunction(null, {
							'language': 'javascript',
							'views':{}
						});
					} else {
						nextfunction(null, ddoc);
					}
				}
			);
		},
		function (ddoc, nextfunction) {
			// set defaults view
			ddoc.views[summary.name] = me.constants.buildView(
				selectTypes,
				selectSelect,
				emits,
				results
			);
			ddoc.views[summary.name].columns = columns;
			me._db.insert(ddoc, me.DESIGN_PREFIX + '/' + summary.name, nextfunction);
		}
	], function (err, results) {
		// initial callback in closure
		if (err) {
			console.dir(err.message);
		}
		callback(err, results);
	});
};

CouchDb.prototype.summaryFetch = function(summaryname, query, partition, readers, callback) {
	var me = this;
	var columns = null;
	var sname = null;
	var dname = null;
	if (summaryname.sname && summaryname.dname) {
		sname = summaryname.sname;
		dname = summaryname.dname;
	} else {
		sname = dname = summaryname;
	}
	async.series([		
		function (nextfunction) {
			// get design document
			me._db.get(
				me.DESIGN_PREFIX + '/' + dname,
				{ revs_info: false },
				function(err, ddoc) {
					if(err) {
						// design document does'nt exists, error
						console.log('design document ' + me.DESIGN_PREFIX + '/' + dname + ' does\'nt exists');
						nextfunction(err, null);
					} else {
						
						columns = ddoc.views[sname].columns;
						nextfunction(null, null);
					}
				}
			);
		},
		function (nextfunction) {
			// do search
			var view_params = {};
			var searchkeys = [partition];
			if (query && query.values) {
				view_params.startkey = searchkeys.concat(query.values);
				view_params.endkey = view_params.startkey.concat([{}]);
			} else {
				view_params.startkey = searchkeys;
				view_params.endkey = view_params.startkey.concat([{}]);				
			}
			
			var dofetch = function(start, count, result) {
				view_params.skip = start;
				view_params.limit = count;

				me._db.view(
					dname,
					sname,
					view_params,
					function(err, body) {
						if (err) {
							nextfunction(err, body);
						} else {
							if (result === null) {
								result  = { 
									query: query,
									rows: [],
									total: body.total_rows
								};
							}
							for (var i = 0; i < body.rows.length; i++) {
								var doc = body.rows[i];
								if (collections.canAccess(doc.value[0],readers)) {
									var obj = {};
									var arr_id = doc.id.split(':',3);
									obj.partition = arr_id[0];
									obj.type = arr_id[1];
									obj.id = arr_id[2];
									obj.readers = doc.value[0];
									for(var icol = 0; icol < columns.length; icol++) {
										obj[columns[icol].key] = doc.value[icol+2];
									}
									result.rows.push(obj);
								}
								if (query.count && result.rows.length >= query.count) {
									break;
								}
							};
							
							if (start + count >= result.total || (query.count && result.rows.length >= query.count)) {
								nextfunction(null, result);
							} else {
								dofetch(start+count, count, result);
							}
						}
					}
				);				
			};

			var start = 0;
			var count = me.VIEW_FETCH_MINBLOCK;

			if (query.start) {
				start = query.start;
			}

			/*
			 * if requested count (query.count) is less than count (VIEW_FETCH_MINBLOCK) don't use it to set fetch block 
			 */
			if (query.count && query.count > count) {
				count = query.count;
			}

			dofetch(start, count, null);

		}
	], function (err, results) {
		// initial callback in closure
		if (err) {
			callback(err, results);
		} else {
			callback(err, results[1]);
		}
	});
};

CouchDb.prototype.dataObjectDelete = function (dataObject, writers, callback) {
	this.dataObjectSave(dataObject, writers, callback, true);
};

exports.create = function () {
	return new CouchDb();
};