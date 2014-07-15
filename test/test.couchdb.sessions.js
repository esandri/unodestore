// testcouch.js
/*jshint node:true, trailing: false*/
'use strict';

var unstore = require('../lib/unstore.js');
var async = require('async');

var us = new unstore.UnStore();

us.setDriver('couchdb');
(function() {
	var testdo = null;
	async.series({
		step_openConnection: function(callback) {
			console.log('execute openConnection');
			us.openConnection({
				host: 'localhost',
				port: '5984',
				ssl: false,
				cache: false,
				user: 'admin',
				password: 'esan2000',
				database: 'session'
			}, callback);		
		},
		step_fetchByTypeIdNoAccess: function(callback) {
			console.log('execute fetchByTypeIdNoAccess');
			us.fetchByTypeId(
				'unapp',
				'acomplexuniqueid',
				'usession',
				{'noone':'noone'},
				function(err, dobj) {
					if(err) {
						if (err.error === 'not_found') {
							console.log('dataobject usession:unapp:acomplexuniqueid not found => untested');
							err = null;
						} else if (err.error === 'forbidden') {
							console.log('dataobject usession:unapp:acomplexuniqueid no access => ok');
							err = null;							
						} 
					} else {
						testdo = dobj;
						console.warn('dataobject usession:unapp:acomplexuniqueid access ok => fail');
						console.dir(dobj);
					}
					callback(err, dobj);
				}
			);
		},		
		step_fetchByTypeId: function(callback) {
			console.log('execute fetchByTypeId');
			us.fetchByTypeId(
				'unapp',
				'acomplexuniqueid',
				'usession',
				{'ema':'ema'},
				function(err, dobj) {
					if(err) {
						if (err.error === 'not_found') {
							console.log('dataobject usession:unapp:acomplexuniqueid not found => untested');
							err = null;
						}
					} else {
						testdo = dobj;
						console.log('dataobject usession:unapp:acomplexuniqueid found => ok');
						console.dir(dobj);
					}
					callback(err, dobj);
				}
			);
		},
		step_saveDataObjectNoAccess: function(callback) {
			console.log('execute saveDataObjectNoAccess');
			if (testdo === null) {
				console.log('test save no access skipped: dataobject not found');
				callback(null, null);
			} else {
				testdo.obj.inc = testdo.obj.inc + 1;
				us.dataObjectSave(testdo, {'noone':'noone', 'dante':'dante'}, function(err, dobj) {
					if (err) {
						if (err.error == 'forbidden') {
							console.log('dataobject usession:unapp:acomplexuniqueid no access to write => ok');
							err = null;
						}
					} else {
						testdo = dobj;
						console.warn('dataobject usession:unapp:acomplexuniqueid access to write => fail!');
						console.dir(dobj);
					}
					callback(err,dobj);
				});
			}
		},		
		step_saveDataObject: function(callback) {
			console.log('execute saveDataObject');
			if (testdo === null) {
				var obj = require('./testsession.json');
				testdo = {
					type: 'unapp',
					id: 'acomplexuniqueid',
					acl: {
						readers: {'ema':'ema', 'simo':'simo'},
						writers: {'ema':'ema', 'simo':'simo'}
					},
					partition: 'usession',
					obj: obj
				};
				testdo.obj.inc = 0;
			} else {
				testdo.obj.inc = testdo.obj.inc + 1;
				testdo.obj.cookie._expires = null;
			}
			us.dataObjectSave(testdo, {'ema':'ema', 'dante':'dante'}, callback);
		},
		step_closeConnection: function(callback) {
			us.closeConnection(callback);
		}
	},
	function(err, results) {
		if(err) {
			console.error(err);	
		} else {
			console.log('test finish: ' + results);
		}
	});
})();