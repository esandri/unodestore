// testcouch.js
/*jshint node:true, trailing: false*/
'use strict';

var unstore = require('../lib/unstore.js');
var async = require('async');
var testfunctions = require('./base-test-functions.js');

module.exports = {
    case_mysql: {
		setUp: function (callback) {
			try {
			this.us = new unstore.UnStore();
			this.us.setDriver('mysql');
			this.us.openConnection({
				host: 'localhost',
				port: '3306',
				user: 'teststore',
				password: 'secret',
				db: 'teststore'
			}, function(err, obj) {
				if (err) {
					callback();
					console.log(err.error);
				} else {
					callback();
				}
			});
			} catch (e) {
				console.log(e);
			}
	    },
	    tearDown: function (callback) {
			this.us.closeConnection(callback);
	    },    	
    	fetchByTypeIdNoAccess:	testfunctions.fetchByTypeIdNoAccess,
		fetchByTypeId:			testfunctions.fetchByTypeId,
		saveDataObjectNoAccess:	testfunctions.saveDataObjectNoAccess,
		saveDataObject:			testfunctions.saveDataObject,
		createView:				testfunctions.createView,
		createViewPlayerState:	testfunctions.createViewPlayerState,
		createViewPlayerName:	testfunctions.createViewPlayerName,
		deletePlayers:			testfunctions.deletePlayers,
		createPlayers:			testfunctions.createPlayers,
		fetchAll:				testfunctions.fetchAll,
		searchPlayer:			testfunctions.searchPlayer
	}, 
    case_couchdb: {
		setUp: function (callback) {
			try {
				this.us = new unstore.UnStore();
				this.us.setDriver('couchdb');
				this.us.openConnection({
					host: 'localhost',
					port: '5984',
					ssl: false,
					cache: false,
					user: 'teststore',
					password: 'teststore',
					database: 'teststore'
				}, function(err, obj) {
					if (err) {
						callback();
						console.log(err.error);
					} else {
						callback();
					}
				});
			} catch (e) {
				console.log(e);
			}
	    },
	    tearDown: function (callback) {
			this.us.closeConnection(callback);
	    },    	
    	fetchByTypeIdNoAccess:	testfunctions.fetchByTypeIdNoAccess,
		fetchByTypeId:			testfunctions.fetchByTypeId,
		saveDataObjectNoAccess:	testfunctions.saveDataObjectNoAccess,
		saveDataObject:			testfunctions.saveDataObject,
		createView:				testfunctions.createView,
		createViewPlayerState:	testfunctions.createViewPlayerState,
		createViewPlayerName:	testfunctions.createViewPlayerName,
		deletePlayers:			testfunctions.deletePlayers,
		createPlayers:			testfunctions.createPlayers,
		fetchAll:				testfunctions.fetchAll,
		searchPlayer:			testfunctions.searchPlayer
	}
	
};