CREATE TABLE IF NOT EXISTS `dataobject` (
	`uuid` int(11) NOT NULL AUTO_INCREMENT,
	`type` varchar(128) DEFAULT NULL,
	`partition` varchar(128) NOT NULL,
	`objId` varchar(128) NOT NULL,
	PRIMARY KEY (`uuid`),
	UNIQUE KEY `uc_dataobject` (`type`,`partition`,`objId`),
	KEY `type` (`type`)
) ENGINE={{storageEngine}};

CREATE TABLE IF NOT EXISTS `aclidentity` (
	`uuid` int(11) NOT NULL,
	`kind` smallint(6) NOT NULL,
	`identity` varchar(128) NOT NULL DEFAULT '',
	PRIMARY KEY (`uuid`,`identity`,`kind`),
	KEY `uuid` (`uuid`),
	KEY `kind` (`kind`),
	KEY `identity` (`identity`)
) ENGINE={{storageEngine}};

CREATE TABLE IF NOT EXISTS `kvs` (
	`uuid` int(11) NOT NULL,
	`keyname` varchar(64) NOT NULL,
	`val` varchar(128) NOT NULL,
	PRIMARY KEY (`uuid`,`keyname`),
	KEY `uuid` (`uuid`),
	KEY `keyname` (`keyname`),
	KEY `value` (`val`)
) ENGINE={{storageEngine}};

CREATE TABLE IF NOT EXISTS `kvpartial` (
	`uuid` int(11) NOT NULL,
	`keyname` varchar(64) NOT NULL,
	`val` TEXT NOT NULL,
	PRIMARY KEY (`uuid`,`keyname`),
	KEY `uuid` (`uuid`),
	KEY `keyname` (`keyname`)
) ENGINE = {{storageEngine}};

DROP VIEW IF EXISTS v_kvtotal;

CREATE VIEW v_kvtotal
	AS
	SELECT * FROM kvs
	UNION SELECT * FROM kvpartial
	ORDER BY uuid, keyname;
        
CREATE TABLE IF NOT EXISTS `relation` (
	`id_relation` int(11) NOT NULL,
	`uuid_from` int(11) NOT NULL,
	`uuid_to` int(11) NOT NULL,
	`qualifier` varchar(45) NOT NULL,
	PRIMARY KEY (`id_relation`),
	UNIQUE KEY `uc_relation` (`uuid_from`,`uuid_to`,`qualifier`)
) ENGINE={{storageEngine}};