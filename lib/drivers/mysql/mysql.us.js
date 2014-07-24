/*jshint node:true, trailing: false*/
'use strict';
var base = require('../driver.js');
var _ = require('underscore');
var async = require('async');
var mysql = require('mysql2');
/**
 *	Unstore driver for mysql - use mysql-native
 *	Required conneciton params are:
 *		host: host of the database server
 *		port: port of the database server
 *		db:   database name
 *		user: user for authentication
 *		password: password for authentication
 */

var MySql = function() {
	this._name = 'MySql';
	this._connectionParams = null;
};

/* inherit from Driver */
MySql.prototype = new base.Driver();
MySql.prototype.constructor = MySql;

MySql.prototype.ACL_JOIN = "JOIN aclidentity on (aclidentity.`uuid` = dataobject.`uuid`)";
MySql.prototype.ACL_JOIN_READ = "JOIN aclidentity on (aclidentity.`uuid` = dataobject.`uuid` AND aclidentity.kind = 1)";
MySql.prototype.ACL_JOIN_WRITE = "JOIN aclidentity on (aclidentity.`uuid` = dataobject.`uuid` AND aclidentity.kind = 2)";
MySql.prototype.VIEW_PREFIX = "cv_";
MySql.prototype.VIEW_BASE_FIELDS = ['dataobject.`uuid` as _id', 'dataobject.`partition`', 'dataobject.`type`', 'dataobject.`id`'];
MySql.prototype.DEFAULT_FETCH_COUNT = 1000;
MySql.prototype.INTERNAL_TYPE_VIEW = '$int_view';
MySql.prototype.GLOBAL_PARTITION = '$global';
MySql.prototype.GOD = "GOD";
MySql.prototype.GOD_ACL = {
	readers: {"GOD": "GOD"},
	writers: {"GOD": "GOD"}
};

MySql.prototype.CompareOperatorSQL = {
	EQ:   '=',
	LT:   '<',
	GT:   '>',
	LTEQ: '<=',
	GTEQ: '>=',
	NEQ:  '!='
};

MySql.prototype.LogicalOperator = {
	NOT: '!',
	OR:  'OR',
	AND: 'AND'
};

/**
 * openConnection override the Driver default implemantation
 * @param connectionParams: the connection params are
 *			{
 *				host: host of the database server
 *				port: port of the database server
 *				db:   database name
 *				user: user for authentication
 *				password: password for authentication
 *			}
 **/
MySql.prototype.openConnection = function(connectionParams, callback) {
	if (connectionParams !== undefined) {
		this._connectionParams = connectionParams;
	}
	var me = this;
	
	this._db = mysql.createConnection({
		host: this._connectionParams.host,
		port: this._connectionParams.port,
		user: this._connectionParams.user,
		password: this._connectionParams.password,
		database: this._connectionParams.db,
		multipleStatements: true
	});

	this._db.connect(function (err) {
		if (err) {
			console.error('error connecting: ' + err.stack);
			callback(err, null);
			return;
		}

		me._initDb("INNODB", callback);
	});
};

/**
 * Initialize db for unstore usage
 **/
MySql.prototype._initDb = function (storageEngine, callback) {
	var me = this;
	var fs = require('fs');
	fs.readFile(__dirname + '/schema.sql', 'utf8', function (err, data) {
		if (err) {
			console.log('error loading schema: ' + err);
			callback(err, null);
		} else {
			data = data.replace(/\{\{storageEngine\}\}/g, storageEngine);
			
			me._db.query(data, function(err, result) {
				if (err) {
					console.log('error creating schema: ' + err);
					callback(err, null);
				} else {
					callback(null, null);
				}
			});
		}
	});
};

MySql.prototype.closeConnection = function (callback) {
	this._db.end(function(err) {
		callback(err,null);
	});
};

MySql.prototype._executeMultiQuery = function (arrQueries, callback) {
	var me = this;
	var transactQueries = [{query: 'START TRANSACTION;', values: []}];
	transactQueries = transactQueries.concat(arrQueries);
	async.mapSeries(
		transactQueries,
		function (q, doneFunc) {
			me._db.query(q.query, q.values, doneFunc);
		},
		function (err, results) {
			if (err) {
				me._db.query("ROLLBACK;", [], function(rollback_err, obj) {
					if (rollback_err) {
						callback(rollback_err, obj);
					} else {
						callback(err, results);
					}
				});
			} else {
				me._db.query("COMMIT;", [], function(commit_err, obj) {
					if (commit_err) {
						callback(commit_err, obj);
					} else {
						callback(err, results);
					}
				});
			}
		}
	);
};

MySql.prototype.row2DO = function(row) {
	return {
		_id: row._id,
		partition: row.partition,
		type: row.type,
		id: row.id
	};
};

MySql.prototype._buildACLWhere = function (accessList) {
	if (accessList === "GOD" || accessList["GOD"]) {
		return "";
	}
	var arrValues = null;
	if (_.isArray(accessList)) {
		arrValues = accessList;
	} else if (_.isString(accessList)) {
		arrValues = [accessList];
	} else {
		arrValues = _.keys(accessList);
	}

	return mysql.format("AND aclidentity.`identity` IN (?)", [arrValues]);
};

MySql.prototype.fetchAllByType = function (type, start, count, partition, readers, callback) {
	var me = this;
	var where = mysql.format("WHERE `partition` = ?" + ((type)?" AND `type` = ?":""), [partition,type])
				+ " " + me._buildACLWhere(readers);
	var start = start || 0;
	var count = count || me.DEFAULT_FETCH_COUNT;
	var limit = mysql.format("LIMIT ?, ?", [start, count]);
	var from = "FROM dataobject " + me.ACL_JOIN_READ;
	var q = "SELECT count(*) " + from + " " + where + ";\n" + 
			"SELECT " + me.VIEW_BASE_FIELDS.join(',') + " " + from + " " + where + " " + limit + ";";

	this._db.query(q, [], function(err, results) {
		if (err) {
			callback(err, null);
		} else {
			var countResult = results[0];

			var obj = {
				rows: results[1],
				total: countResult[0].tot_rows						
			};
			callback(null, obj);
		}
	});	
};

MySql.prototype.fetchAll = function (start, count, partition, readers, callback) {
	return this.fetchAllByType(null, start, count, partition, readers, callback);
};

MySql.prototype.fetchByTypeId = function (type, id, partition, readers, callback) {
	var me = this;
	var sql = "SELECT " + me.VIEW_BASE_FIELDS.join(',') + " FROM dataobject WHERE `partition` = ? AND `type` = ? AND id = ?";
	var me = this;
	this._db.query(sql, [partition, type, id], function(err, rows) {
		if (err) {
			callback(err, null);
		} else {
			if (rows.length !== 1) {
				var error = new Error("Error quering dataobject with partition = " + partition + ", type = " + type + ", id = " + id + " - not_found");
				error.error = 'not_found';
				callback(error, null);
			} else {
				me._canRead(rows[0]._id, readers, function(err, result) {
					if (err !== null) {
						callback(err, null);
					} else if (result) {
						var dataObject = me.row2DO(rows[0]);
						me._fetchDataObjectKvs(dataObject, function(err, dataObject) {
							me._fetchDataObjectACL(dataObject, callback);
						});
					} else {
						var error = new Error("Error quering dataobject with partition = " + partition + ", type = " + type + ", id = " + id + " - forbidden");
						error.error = 'forbidden';
						callback(error, null);
					}
				});
			}
		}
	});	

};

MySql.prototype.summaryFetch = function(summaryname, query, partition, readers, callback) {
	var me = this;
	me._fetchSummaryDataObject(summaryname, function (err, doSummary) {
		if (err) {
			if (err.error === 'not_found') {
				var error = new Error("Error fetching summary. Unknow summary: " + summaryname );
				error.error = 'not_found';
				callback(error, doSummary);				
			} else {
				callback(err, doSummary);
			}
		} else {
			var orderedCols = _.filter(doSummary.obj.columns, function(col) {
				return (col.ordered == "1" || col.ordered == "true");
			});
			var strWhere = '';
			
			var start = query.start || 0;
			var count = query.count || me.DEFAULT_FETCH_COUNT;
			var limit = mysql.format("LIMIT ?, ?", [start, count]);

			if (query.values) {
				var where = [];
				for (var i = 0; i < query.values.length; i++) {
					where.push(mysql.format("`" + orderedCols[i].key + "` = ?",[query.values[i]]));
				};
				strWhere = "WHERE " + where.join(' AND '); 
			}

			strWhere = strWhere + " " + me._buildACLWhere(readers);

			var viewname = me.VIEW_PREFIX + summaryname;
			var from = "FROM " + viewname + " JOIN aclidentity on (aclidentity.`uuid` = " + viewname + ".`_id` AND aclidentity.kind = 1)";
			var q = "SELECT count(*) as tot_rows " + from + " " + strWhere + ";\n" + 
					"SELECT * " + from + " " + strWhere + " " + doSummary.obj.viewObj.orderby + " " + limit + ";"

			me._db.query(q, [], function(err, results) {
				if (err) {
					callback(err, null);
				} else {
					// var columns = doSummary.obj.columns; 
					// me.VIEW_BASE_FIELDS
					var countResult = results[0];

					var obj = {
						query: query,
						rows: results[1],
						total: countResult[0].tot_rows						
					};
					callback(null, obj);
				}
			})

		}
	});
};

MySql.prototype.dataObjectDelete = function (dataObject, writers, callback) {
	var me = this;
	if (dataObject._id) {
		me._canWrite(dataObject, writers, function (err, result) {
			if (err !== null) {
				callback(err, result);
			} else if (result) {
				me._deleteDataObject(dataObject, callback);
			} else {
				var error = new Error("Error deleting dataobject with partition = " + dataObject.partition + ", type = " + dataObject.type + ", id = " + dataObject.id + " - forbidden");
				error.error = 'forbidden';
				callback(error, dataObject);				
			}
		});
	} else {
		var error = new Error("Error deleting dataobject not persited = " + dataObject.partition + ", type = " + dataObject.type + ", id = " + dataObject.id + " - forbidden");
		error.error = 'generic';
		callback(error, dataObject);		
	}
};

MySql.prototype.dataObjectSave = function (dataObject, writers, callback) {
	var me = this;
	var saveKVS = function (err, dataObject) {
		if (err === null) {
			me._insertDataObjectKvs(dataObject, function(err, obj) {
				if (err) {
					callback(err, obj);
				} else {
					me._insertDataObjectACL(dataObject, callback);
				}
			});
		} else {
			callback(err,dataObject);
		}
	};
	if (dataObject._id) {
		me._canWrite(dataObject, writers, function(err, result) {
			if (err !== null) {
				saveKVS(err, result);
			} else {
				if (result) {
					me._updateDataObject(dataObject, saveKVS);
				} else {
					var error = new Error("Error writing dataobject with partition = " + dataObject.partition + ", type = " + dataObject.type + ", id = " + dataObject.id + " - forbidden");
					error.error = 'forbidden';
					saveKVS(error, result);
				}
			}
		});
	} else {
		me._insertDataObject(dataObject, saveKVS);
	}
};

MySql.prototype._insertDataObject = function (dataObject, callback) {
	this._db.query(
		"INSERT INTO dataobject (`type`, `partition`, id) VALUES (?,?,?)",
		[dataObject.type, dataObject.partition, dataObject.id],
		function(err, results) {
			if (err) {
				callback(err, null);
			} else {
				dataObject._id = results.insertId;
				callback(null, dataObject);
			}
		}
	);
};

/**
 * Update the dataobject record
 * @param  {DataObject}	dataObject The dataobjet to update with new data (_id is the key)
 * @param  {Function}	callback   Classical function(err, data) where data is the passed dataObject
 */
MySql.prototype._updateDataObject = function (dataObject, callback) {
	this._db.query(
		"UPDATE dataobject set `type` = ?, `partition` = ?, id = ? WHERE uuid = ?",
		[dataObject.type, dataObject.partition, dataObject.id, dataObject._id],
		function(err, result) {
			if (err) {
				callback(err, result);
			} else {
				callback(null, dataObject);
			}
		}
	);
};

/**
 * Delete the dataobject record
 * @param  {DataObject}	dataObject The dataobjet to delete (_id is the key)
 * @param  {Function}	callback   Classical function(err, data) where data is the passed dataObject
 */
MySql.prototype._deleteDataObject = function (dataObject, multiExecutor, callback) {
	multiExecutor = multiExecutor||new MySqlExecutor();
	multiExecutor.addQuery("DELETE FROM dataobject WHERE uuid = ?", [dataObject._id]);
	multiExecutor.addQuery("DELETE FROM kvs WHERE uuid = ?", [dataObject._id]);
	multiExecutor.addQuery("DELETE FROM kvpartial WHERE uuid = ?", [dataObject._id]);
	multiExecutor.addQuery("DELETE FROM aclidentity WHERE uuid = ?", [dataObject._id]);
	multiExecutor.executeMultiQuery(this._db, function (err, result) {
		if (err) {
			callback(err, result);
		} else {
			callback(null, dataObject);
		}
	});
	/*var arrQueries = [];
	arrQueries.push({ query: "DELETE FROM dataobject WHERE uuid = ?", values: [dataObject._id] });
	arrQueries.push({ query: "DELETE FROM kvs WHERE uuid = ?", values: [dataObject._id] });
	arrQueries.push({ query: "DELETE FROM kvpartial WHERE uuid = ?", values: [dataObject._id] });
	arrQueries.push({ query: "DELETE FROM aclidentity WHERE uuid = ?", values: [dataObject._id] });
	
	this._executeMultiQuery(arrQueries, function (err, result) {
			if (err) {
				callback(err, result);
			} else {
				callback(null, dataObject);
			}
		}
	);*/
};

/**
 * fetch all kvs and put into dataObject.obj
 * @param  Object		dataObject the only required property is _id
 * @param  {Function}	callback   classic function(err, obj). obj is dataObject with populated obj
 */
MySql.prototype._fetchDataObjectKvs = function(dataObject, callback) {
	var me = this;
	var strKvsQuery = "SELECT keyname, val FROM kvs WHERE uuid = ? ORDER BY LENGTH( keyname ) ";
	this._db.execute(strKvsQuery, [dataObject._id], function (err, rows) {
		if (err) {
			callback(err, rows);
		} else {
			var obj = {};
			for (var i = 0; i < rows.length; i++) {
				me.setObjPath(obj, rows[i].keyname, rows[i].val);
			};
			dataObject.obj = obj;
			callback(null, dataObject);
		}
	});
}

/**
 * Insert key-values of the dataobject
 * @param  {DataObject}   dataObject 
 * @param  {Function}     callback
 */
MySql.prototype._insertDataObjectKvs = function(dataObject, callback) {
	var strKvPartial = "INSERT INTO kvpartial (uuid,keyname,`val`) VALUES (?,?,?)";
	var strKvs = "INSERT INTO kvs (uuid,keyname,`val`) VALUES (?,?,?)";
	var objKVS = {},
		count = 0,
		path = '';
	this.obj2KVS(dataObject.obj, path, objKVS, count);
	var arrQueries = [];
	arrQueries.push({ query: "DELETE FROM kvpartial WHERE uuid = ?", values: [dataObject._id]});
	arrQueries.push({ query: "DELETE FROM kvs WHERE uuid = ?", values: [dataObject._id]});
	for (var k in objKVS) {
		var originalK = k.slice(1);
		var strCmd = '';
		if (k[0] === 'p') {
			strCmd = strKvPartial;
		} else {
			strCmd = strKvs;
		}

		arrQueries.push({ query: strCmd, values: [dataObject._id, originalK, objKVS[k]]});

	}

	this._executeMultiQuery(arrQueries, callback);
};

/**
 * fetch the acl of a dataobject
 * @param  {Object}		dataObject the only required property is _id
 * @param  {Function}	callback   classic function(err, obj). obj is dataObject with populated obj
 */
MySql.prototype._fetchDataObjectACL = function(dataObject, callback) {
	this._db.execute("SELECT * FROM aclidentity WHERE uuid = ?", [dataObject._id], function (err, rows) {
		if (err) {
			callback(err, rows);
		} else {
			var acl = {
				readers: {},
				writers: {}
			};
			for (var i = 0; i < rows.length; i++) {
				if (rows[i].kind === 1) {
					acl.readers[rows[i].identity] = rows[i].identity;
				} else {
					acl.writers[rows[i].identity] = rows[i].identity;
				}
			};
			dataObject.acl = acl;
			callback(null, dataObject);
		}
	});
};

MySql.prototype._insertDataObjectACL = function(dataObject, callback) {
	if (!dataObject.acl) callback (null, null); 
	var strACL = "INSERT INTO aclidentity (uuid, kind, identity) VALUES (?,?,?)";
	var arrQueries = [];
	arrQueries.push({ query: "DELETE FROM aclidentity WHERE uuid = ?", values: [dataObject._id]});
	for(var r in dataObject.acl.readers) {
		arrQueries.push({ query: strACL, values: [dataObject._id, 1, r]});
	}
	for(var w in dataObject.acl.writers) {
		arrQueries.push({ query: strACL, values: [dataObject._id, 2, w]});
	}
	this._executeMultiQuery(arrQueries, callback);
};

MySql.prototype._canRead = function (dataObject, readers, callback) {
	this._canDo(dataObject, readers, 1, callback);
};

MySql.prototype._canWrite = function (dataObject, writers, callback) {
	this._canDo(dataObject, writers, 2, callback);
};

/**
 * Test if uers can do read or write operation
 * @param  DataObject|string	dataObject the data object requested to access
 * @param  Object  				accessList Array of access token (names)
 * @param  Number|String		type       Type of access requested (1 = read | 2 = write)
 * @param  Function 			callback   typical error - obj callback function
 */
MySql.prototype._canDo = function (dataObject, accessList, type, callback) {
	if (accessList === 'GOD' || accessList["GOD"]) {
		callback(null, true);
		return;
	}
	var id = (typeof dataObject === 'object')?dataObject._id:dataObject;
	var typeCode = (type === 'read')?1:((type === 'write')?2:type);
	this.getAccess(id, typeCode, function (err, rows) {
		try {
		if (err !== null) {
			callback(err, rows);
		} else {
			if (rows.length === 0) {
				callback(null, true); // without acl anybody can read/write
			} else {
				var canDo = false;
				for(var r in rows) {
					if (accessList[rows[r].identity]) {
						canDo = true;
						break;						
					}
				}
				callback(null, canDo);
			}
		}
		} catch(e) {
			console.log(e);
		}
	});
};

MySql.prototype.getAccess = function(id, type, callback) {
	this._db.execute(
		"SELECT  a.identity " +
		"FROM `aclidentity` as a " +
		"where a.uuid = ? and a.kind = ?",
		[id,type],
		callback
	);
};


/**
 * add a join table from the requested path and return the field name
 * @param  {Array} columns	the columns to extract
 * @param  {Array} tables	the array of tables to join
 * @param  {Array} fields	the array of fields to extract
 * @param  {Array} orderby	the array of orderby to apply
 */
MySql.prototype._buildColumns = function(columns, tables, fields, orderby) {
	for(var iColumn = 0; iColumn < columns.length; iColumn = iColumn + 1) {
		var col = columns[iColumn];
		var fieldname = '';
		if (col.value) {
			fieldname = "dataobject.`" + col.value + "`";
			fields.push(fieldname + " as `" + col.key + "`");
		} else {
			var colname = "tcol_" + tables.length;
			tables.push("v_kvtotal " + colname + " on (" + colname + ".`uuid` = dataobject.`uuid` and " + colname + ".keyname = '" + col.key + "')");
			fieldname = colname + ".`val`";
			fields.push(fieldname + " as `" + col.key + "`");
		}
		if (col.ordered) {
			orderby.push("`" + col.key + "`");
		}
	}
};

MySql.prototype._buildWhereFromCompareElement = function(ce, tables) {
	var colname = "tcolw_" + tables.length;
	tables.push("v_kvtotal " + colname + " on (" + colname + ".`uuid` = dataobject.`uuid` and " + colname + ".keyname = '" + ce.key + "')");
	return mysql.format(colname + ".`val` " + this.CompareOperatorSQL[ce.operator] + " ?", [ce.value]);
};

MySql.prototype._buildWhereFromLogicalElement = function(le, tables) {
	var arrQuery = [];
	var subElem = null;
	var result = '';
	for (var index = 0; index < le.elements.length; index++) {
		subElem = this._buildWhereFromSelect(le.elements[index]);
		arrQuery.push(subElem);
	}

	if (le.operator === 'NOT') {
		if (arrQuery.length > 1) {
			console.warn('NOT Operator applied to multiple elements. MUST be only one!');
		}
		result = this.LogicalOperator[le.operator] + ' ' + arrQuery[0];
	} else {
		result = arrQuery.join(this.LogicalOperator[le.operator]);
	}
	return '(' + result + ')';
};

MySql.prototype._buildWhereFromSelect = function(select, tables) {
	if (select) {
		if (select.type === 'compare' || select.key) {
			return this._buildWhereFromCompareElement(select, tables);
		} else {
			return this._buildWhereFromLogicalElement(select, tables);
		}
	}
};

MySql.prototype.summaryToSelect = function(summary) {
	var fields = _.clone(this.VIEW_BASE_FIELDS);
	var tables = ['`dataobject`'];
	var where = ['1=1'];
	var orderby = [];

	// filter by types
	if (summary.types && summary.types.length > 0) {
		var whereTypes = [];
		for (var iType = 0; iType < summary.types.length; iType = iType + 1 ) {
			whereTypes.push(mysql.format("CONCAT( SUBSTRING( dataobject.`type` , 1, LENGTH(?) ) ,  '.' ) = ?",[summary.types[iType], summary.types[iType] + '.'] ));
		}
		where.push( '(' + whereTypes.join('\n    OR ') + ')');
	}

	// apply select
	if (summary.select) {
		var whereSelect = this._buildWhereFromSelect(summary.select, tables);
		where.push(whereSelect);
	}

	// extact columns
	this._buildColumns(summary.columns, tables, fields, orderby);

	var strSelect = "SELECT " +	fields.join(',') + 
					"\n  FROM " + tables.join("\n    LEFT JOIN ") + 
					"\n  WHERE " + where.join("\n    AND ");

	return { select: strSelect, orderby: (orderby.length > 0?("\n  ORDER BY " + orderby.join(', ')):"") };

};

MySql.prototype.summarySave = function(summary, callback) {
	var me = this;
	var viewObj = this.summaryToSelect(summary);
	var strCreteView = "CREATE OR REPLACE VIEW " + me.VIEW_PREFIX + summary.name + " AS \n" + viewObj.select;
	summary.viewObj = viewObj;
	this._db.query(strCreteView, [], function(err, result) {
		if (err) {
			callback(err, result);
		} else {
			me.fetchByTypeId(me.INTERNAL_TYPE_VIEW, summary.name, me.GLOBAL_PARTITION, me.GOD, function(err, dobj) {
				if (err) {
					if (err.error === 'not_found') {
						var dataObject = {
							partition: me.GLOBAL_PARTITION,
							type: me.INTERNAL_TYPE_VIEW,
							id: summary.name,
							ver: false,
							acl: me.GOD_ACL,
							obj: summary
						};
						me.dataObjectSave(dataObject, me.GOD, callback);
					} else {
						callback(err, dobj);
					}
				} else {
					dobj.obj = summary;
					me._insertDataObjectKvs(dobj, callback);
				}
			});
		}
	});
};

/**
 * fetch the dataobject that persist the summary definition
 * @param  {String}   summaryname the name of the summary definition to fetch
 * @param  {Function} callback    classical function(err, obj) callback where obj is the dataobject of the summary definition
 */
MySql.prototype._fetchSummaryDataObject = function (summaryname, callback) {
	this.fetchByTypeId(this.INTERNAL_TYPE_VIEW, summaryname, this.GLOBAL_PARTITION, this.GOD, callback);
};

MySql.prototype.obj2KVS = function(obj, path, result, count) {
	for (var k in obj) {
		count++;
		var v = obj[k];
		var thisPath = null;
		if (path.length === 0) {
			thisPath = k;
		} else {
			thisPath = path + '.' + k;
		}
		if ( typeof v === 'string' ) {
			result['v' + thisPath] = v;
		} else if ( typeof v === 'object' ) {
			result['p' + thisPath] = JSON.stringify(v);
			this.obj2KVS(v, thisPath, result);
		} else {
			result['v' + thisPath] = v;
		}
	}
};

MySql.prototype.setObjPath = function (obj, path, value) {
	var currObj = obj;
	var pathElems = path.split('.');
	for (var i = 1; i < pathElems.length; i++) {
		if (!currObj[pathElems[i-1]]) {
			if (/^\d+$/.test(pathElems[i])) {
				currObj[pathElems[i-1]] = [];
			} else {
				currObj[pathElems[i-1]] = {};
			}
		}
		currObj = currObj[pathElems[i-1]];
	};
	currObj[pathElems[pathElems.length-1]] = value;
};

exports.create = function() {
	return new MySql();
};


var MySqlExecutor = function() {
	this.arrQueries = [];
};

MySqlExecutor.prototype.addQuery = function(query, params) {
	this.arrQueries.push({ query: query, values: params});
};

MySqlExecutor.prototype.executeMultiQuery = function (connection, callback) {
	var transactQueries = [{query: 'START TRANSACTION;', values: []}];
	transactQueries = transactQueries.concat(this.arrQueries);
	async.mapSeries(
		transactQueries,
		function (q, doneFunc) {
			connection.query(q.query, q.values, doneFunc);
		},
		function (err, results) {
			if (err) {
				connection.query("ROLLBACK;", [], function(rollback_err, obj) {
					if (rollback_err) {
						callback(rollback_err, obj);
					} else {
						callback(err, results);
					}
				});
			} else {
				connection.query("COMMIT;", [], function(commit_err, obj) {
					if (commit_err) {
						callback(commit_err, obj);
					} else {
						callback(err, results);
					}
				});
			}
		}
	);
};