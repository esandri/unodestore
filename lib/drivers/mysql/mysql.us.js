/*jshint node:true, trailing: false*/
'use strict';
var base = require('../driver.js');
var mysql = require('mysql');
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

MySql.prototype.row2DO = function(row) {
	return {
		_id: row.uuid,
		partition: row.partition,
		type: row.type,
		id: row.id
	};
};

MySql.prototype.fetchByTypeId = function(type, id, partition, readers, callback) {
	var me = this;
	var sql = "SELECT * FROM dataobject WHERE `partition` = ? AND `type` = ? AND id = ?";
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
				me.canRead(rows[0].uuid, readers, function(err, result) {
					if (err !== null) {
						callback(err, null);
					} else if (result) {
						var dataObject = me.row2DO(rows[0]);
						me.fetchDataObjectKvs(dataObject, function(err, dataObject) {
							me.fetchACL(dataObject, callback);
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

/*MySql.prototype.fetchById = function(doid, readers, callback) {
	var sql = "SELECT * FROM dataobject WHERE uuid = ?";
	var rows = [];
	var rowsDO = [];
	var me = this;
	var count;
	var countDO;

	this._db.execute(sql,[doid])
		.on('row', function(row) {
			rows.push(row);
		}).on('error', function(err) {
			callback(err, rows);
		}).on('result', function() {
			count = rows.length;
			countDO = 0;
			console.dir(rows);
			for (var i = 0; i < count; i++) {
				me.canRead(rows[i].uuid, readers, function(err, result) {
					countDO++;
					if (err !== null) {
						callback(err, null);
					} else if (result) {
						rowsDO.push(rows[i]);
						if (countDO == count) {
							callback(null, rowsDO);
						}
					} else {
						console.log('access violation');
					}
				});
			}
		});
};*/

MySql.prototype.summaryFetch = function(summary, query) {
	throw new Error('Driver.summaryFetch isn\'t implemented');
};

MySql.prototype.dataObjectSave = function (dataObject, writers, callback) {
	var me = this;
	var saveKVS = function (err, dataObject) {
		if (err === null) {
			me.insertDataObjectKvs(dataObject, function(err, obj) {
				if (err) {
					callback(err, obj);
				} else {
					me.insertACL(dataObject, callback);
				}
			});
		} else {
			callback(err,dataObject);
		}
	};
	if (dataObject._id) {
		me.canWrite(dataObject, writers, function(err, result) {
			if (err !== null) {
				saveKVS(err, result);
			} else {
				if (result) {
					me.updateDataObject(dataObject, saveKVS);
				} else {
					var error = new Error("Error writine dataobject with partition = " + dataObject.partition + ", type = " + dataObject.type + ", id = " + dataObject.id + " - forbidden");
					error.error = 'forbidden';
					saveKVS(error, result);
				}
			}
		});
	} else {
		me.insertDataObject(dataObject, saveKVS);
	}
};

MySql.prototype.insertDataObject = function (dataObject, callback) {
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
MySql.prototype.updateDataObject = function (dataObject, callback) {
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
 * fetch all kvs and put into dataObject.obj
 * @param  Object		dataObject the only required property is _id
 * @param  {Function}	callback   classic function(err, obj). obj is dataObject with populated obj
 */
MySql.prototype.fetchDataObjectKvs = function(dataObject, callback) {
	var me = this;
	var strKvsQuery = "SELECT keyname, val FROM kvs WHERE uuid = ? ORDER BY LENGTH( keyname ) ";
	this._db.query(strKvsQuery, [dataObject._id], function (err, rows) {
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

MySql.prototype.insertDataObjectKvs = function(dataObject, callback) {
	var strKvPartial = "INSERT INTO kvpartial (uuid,keyname,`val`) VALUES (?,?,?)";
	var strKvs = "INSERT INTO kvs (uuid,keyname,`val`) VALUES (?,?,?)";
	var objKVS = {},
		count = 0,
		path = '';
	this.obj2KVS(dataObject.obj, path, objKVS, count);
	var arrQueries = [];
	arrQueries.push(mysql.format("DELETE FROM kvpartial WHERE uuid = ?", [dataObject._id]));
	arrQueries.push(mysql.format("DELETE FROM kvs WHERE uuid = ?", [dataObject._id]));
	for (var k in objKVS) {
		var originalK = k.slice(1);
		var strCmd = '';
		if (k[0] === 'p') {
			strCmd = strKvPartial;
		} else {
			strCmd = strKvs;
		}

		arrQueries.push(mysql.format(strCmd, [dataObject._id, originalK, objKVS[k]]));

	}

	this._db.query(arrQueries.join(';'), [], callback);
};

/**
 * fetch the acl of a dataobject
 * @param  {Object}		dataObject the only required property is _id
 * @param  {Function}	callback   classic function(err, obj). obj is dataObject with populated obj
 */
MySql.prototype.fetchACL = function(dataObject, callback) {
	this._db.query("SELECT * FROM aclidentity WHERE uuid = ?", [dataObject._id], function (err, rows) {
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

MySql.prototype.insertACL = function(dataObject, callback) {
	if (!dataObject.acl) callback (null, null); 
	var strACL = "INSERT INTO aclidentity (uuid, kind, identity) VALUES (?,?,?)";
	var arrQueries = [];
	arrQueries.push(mysql.format("DELETE FROM aclidentity WHERE uuid = ?", [dataObject._id]));
	for(var r in dataObject.acl.readers) {
		arrQueries.push(mysql.format(strACL,[dataObject._id, 1, r]));
	}
	for(var w in dataObject.acl.writers) {
		arrQueries.push(mysql.format(strACL,[dataObject._id, 2, w]));
	}
	this._db.query(arrQueries.join(';'), [], callback);
};

MySql.prototype.canRead = function (dataObject, readers, callback) {
	this.canDo(dataObject, readers, 1, callback);
};

MySql.prototype.canWrite = function (dataObject, writers, callback) {
	this.canDo(dataObject, writers, 2, callback);
};

/**
 * Test if uers can do read or write operation
 * @param  DataObject|string	dataObject the data object requested to access
 * @param  Array   				accessList Array of access token (names)
 * @param  Number|String		type       Type of access requested (1 = read | 2 = write)
 * @param  Function 			callback   typical error - obj callback function
 */
MySql.prototype.canDo = function (dataObject, accessList, type, callback) {
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
	this._db.query(
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
		// TODO: translate le.operator for security concerns
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
	var fields = ['dataobject.`uuid`', 'dataobject.`partition`', 'dataobject.`type`', 'dataobject.`id`'];
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
					"\n  WHERE " + where.join("\n    AND ") + 
					(orderby.length > 0?("\n  ORDER BY " + orderby.join(', ')):"");
	return strSelect;

};

MySql.prototype.summarySave = function(summary, callback) {
	var strSelect = this.summaryToSelect(summary);
	var strCreteView = "CREATE OR REPLACE VIEW " + summary.name + " AS \n" + strSelect;
	this._db.query(strCreteView, [], callback );
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