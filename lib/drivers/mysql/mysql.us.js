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
MySql.prototype.openConnection = function(connectionParams) {
	if (connectionParams !== undefined) {
		this._connectionParams = connectionParams;
	}
	this._db = require('mysql-native').createTCPClient(this._connectionParams.host,this._connectionParams.port);
	this._db.auth(this._connectionParams.db, this._connectionParams.user, this._connectionParams.password);
	this._initDb("INNODB");
};

/**
 * Initialize db for unstore usage
 **/
MySql.prototype._initDb = function (storageEngine) {

        this._db.execute(" CREATE TABLE IF NOT EXISTS `dataobject` (" +
				" `uuid` int(11) NOT NULL AUTO_INCREMENT," +
				" `type` varchar(128) DEFAULT NULL," +
				" `partition` varchar(128) NOT NULL," +
				" `objId` varchar(128) NOT NULL," +
				" PRIMARY KEY (`uuid`)," +
				" UNIQUE KEY `uc_dataobject` (`type`,`partition`,`objId`)," +
				" KEY `type` (`type`)" +
				" ) ENGINE=" + storageEngine + " ;");

		this._db.execute("CREATE TABLE IF NOT EXISTS `aclidentity` (" +
				" `uuid` int(11) NOT NULL," +
				" `kind` smallint(6) NOT NULL," +
				" `identity` varchar(128) NOT NULL DEFAULT ''," +
				" PRIMARY KEY (`uuid`,`identity`,`kind`)," +
				" KEY `uuid` (`uuid`)," +
				" KEY `kind` (`kind`)," +
				" KEY `identity` (`identity`)" +
				" ) ENGINE=" + storageEngine + ";");

		this._db.execute("CREATE TABLE IF NOT EXISTS `kvs` (" +
				" `uuid` int(11) NOT NULL," +
				" `keyname` varchar(64) NOT NULL," +
				" `val` varchar(128) NOT NULL," +
				" PRIMARY KEY (`uuid`,`keyname`)," +
				" KEY `uuid` (`uuid`)," +
				" KEY `keyname` (`keyname`)," +
				" KEY `value` (`val`)" +
				" ) ENGINE=" + storageEngine + ";");

		this._db.execute("CREATE TABLE IF NOT EXISTS `kvpartial` (" +
				" `uuid` int(11) NOT NULL," +
				" `keyname` varchar(64) NOT NULL," +
				" `val` TEXT NOT NULL," +
				" PRIMARY KEY (`uuid`,`keyname`)," +
				" KEY `uuid` (`uuid`)," +
				" KEY `keyname` (`keyname`)" +
				") ENGINE = " + storageEngine + ";");

		this._db.execute("DROP VIEW IF EXISTS v_kvtotal;");

		this._db.execute("CREATE VIEW v_kvtotal" +
				" AS" +
				" SELECT * FROM kvs" +
				" UNION SELECT * FROM kvpartial" +
				" ORDER BY uuid, keyname;");
        
		this._db.execute("CREATE TABLE IF NOT EXISTS `relation` (" +
				" `id_relation` int(11) NOT NULL," +
				" `uuid_from` int(11) NOT NULL," +
				" `uuid_to` int(11) NOT NULL," +
				" `qualifier` varchar(45) NOT NULL," +
				" PRIMARY KEY (`id_relation`)," +
				" UNIQUE KEY `uc_relation` (`uuid_from`,`uuid_to`,`qualifier`)" +
				" ) ENGINE=" + storageEngine + ";");


};

MySql.prototype.closeConnection = function () {
	this._db.close();
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

MySql.prototype.dataobjectPersist = function(dataobject) {
	throw new Error('Driver.dataobjectPersist isn\'t implemented');
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