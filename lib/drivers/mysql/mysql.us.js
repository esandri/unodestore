var base = require('../driver.js');

/**
 *	Unstore driver for mysql - use mysql-native
 *	Required conneciton params are:
 *		host: host of the database server
 *		port: port of the database server
 *		db:   database name
 *		user: user for authentication
 *		password: password for authentication
 */

MySql = function() {
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
	this._db = require('mysql').createConnection({
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

MySql.prototype.fetchByTypeId = function(type, id, partition, readers, callback) {
	var sql = "SELECT * FROM dataobject WHERE `partition` = ? AND `type` = ? AND objId = ?";
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
						if (countDO == count) {
							callback(null, rows[0]);
						}
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
			me.insertDataObjectKvs(dataObject,callback);
		} else {
			callback(err,dataObject);
		}
	};
	if (dataObject.isPersisted()) {
		this.canWrite(dataObject, writers, function(err, result) {
			if (err !== null) {
				saveKVS(err, result);
			} else {
				if (result) {
					this.insertDataObject(dataObject, saveKVS);
				}
			}
		});
	} else {
		this.insertDataObject(dataObject, saveKVS);
	}
};

MySql.prototype.insertDataObject = function (dataObject, callback) {
	var cmd = this._db.execute("INSERT INTO dataobject (type, partition, objId) VALUES (?,?,?)",
					[dataObject.getType(), dataObject.getPartition(), dataObject.getObjId()]);
	cmd.on("error", function(err) {
		callback(err, dataObject);
	});
	cmd.on("result", function() {
		dataObject.setId(this.result.insert_id);
		callback(null, dataObject);
	});
};

MySql.prototype.insertDataObjectKvs = function(dataObject, callback) {
	var strKvPartial = "INSERT INTO kvpartial (uuid,keyname,val) VALUES (?,?,?)";
	var strKvs = "INSERT INTO kvs (uuid,keyname,val) VALUES (?,?,?)";
	var objKVS = {},
		count = 0,
		path = '';
	this.obj2KVS(dataObject.getObject(), path, objKVS, count);
	
	var onError = function (err) {
		callback(err, dataObject);
	};
	var onResult = function() {
		count--;
		if (count === 0) {
			callback(null, dataObject);
		}
	};



	for (var k in objKVS) {
		var originalK = k.slice(1);
		var strCmd = '';
		if (k[0] === 'p') {
			strCmd = strKvPartial;
		} else {
			strCmd = strKvs;
		}

		this._db.execute(strCmd, [dataObject.getId(),originalK,objKVS[k]])
			.on("error", onError)
			.on("result", onResult);
	}
};


MySql.prototype.canRead = function (dataObject, readers, callback) {
	this.canDo(dataObject, readers, 1, callback);
};

MySql.prototype.canWrite = function (dataObject, writers, callback) {
	this.canDo(dataObject, writers, 2, callback);
};

MySql.prototype.canDo = function (dataObject, accessList, type, callback) {
	var id = (typeof dataObject === 'object')?dataObject.getId():dataObject;
	this.getAccess(id, type, function (err, rows) {
		if (err !== null) {
			callback(err, rows);
		} else {
			var canDo = false;
			for (var a in accessList) {
				if (accessList.hasOwnProperty(a)) {
					if (rows[a] !== 'undefined') {
						canDo = true;
						break;
					}
				}
			}
			callback(canDo);
		}
	});
};

MySql.prototype.getAccess = function(id, type, callback) {
	var cmd = this._db.execute("SELECT  a.identity " +
					"FROM `aclidentity` as a " +
					"where a.uuid = ? and a.kind = ?",
					[id,type]);

	var rows = {};
	cmd.addListener("row", function (r) {
		rows[r[0]] = r[0];
	});
	cmd.addListener("end", function () {
		callback(null, rows);
	});
	cmd.addListener("error", function(err) {
		callback(err, rows);
	});
};


MySql.prototype.summarySave = function(summary) {
	throw new Error('Driver.dataobjectPersist isn\'t implemented');
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

exports.create = function() {
	return new MySql();
};