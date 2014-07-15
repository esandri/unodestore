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
				password: '',
				database: 'unstore'
			}, callback);		
		},
		step_fetchByTypeIdNoAccess: function(callback) {
			console.log('execute fetchByTypeIdNoAccess');
			us.fetchByTypeId(
				'test.type',
				'ematest1',
				'testparition',
				{'noone':'noone'},
				function(err, dobj) {
					if(err) {
						if (err.error === 'not_found') {
							console.log('dataobject testparition:test.type:ematest1 not found => untested');
							err = null;
						} else if (err.error === 'forbidden') {
							console.log('dataobject testparition:test.type:ematest1 no access => ok');
							err = null;							
						} 
					} else {
						testdo = dobj;
						console.warn('dataobject testparition:test.type:ematest1 access ok => fail');
						console.dir(dobj);
					}
					callback(err, dobj);
				}
			);
		},		
		step_fetchByTypeId: function(callback) {
			console.log('execute fetchByTypeId');
			us.fetchByTypeId(
				'test.type',
				'ematest1',
				'testparition',
				{'ema':'ema'},
				function(err, dobj) {
					if(err) {
						if (err.error === 'not_found') {
							console.log('dataobject testparition:test.type:ematest1 not found => untested');
							err = null;
						}
					} else {
						testdo = dobj;
						console.log('dataobject testparition:test.type:ematest1 found => ok');
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
							console.log('dataobject testparition:test.type:ematest1 no access to write => ok');
							err = null;
						}
					} else {
						testdo = dobj;
						console.warn('dataobject testparition:test.type:ematest1 access to write => fail!');
						console.dir(dobj);
					}
					callback(err,dobj);
				});
			}
		},		
		step_saveDataObject: function(callback) {
			console.log('execute saveDataObject');
			if (testdo === null) {
				var obj = require('./testobject.json');
				testdo = {
					type: 'test.type',
					id: 'ematest1',
					acl: {
						readers: {'ema':'ema', 'simo':'simo'},
						writers: {'ema':'ema', 'simo':'simo'}
					},
					partition: 'testparition',
					obj: obj
				};
				testdo.obj.inc = 0;
			} else {
				testdo.obj.inc = testdo.obj.inc + 1;
			}
			us.dataObjectSave(testdo, {'ema':'ema', 'dante':'dante'}, callback);
		},
		step_createView: function(callback) {
			console.log('excute createView');
			
			var summary = {
				name: 'testview',
				types: ['test'],
				select: {
					type: 'compare',
					key: 'glossary.GlossDiv.GlossList.GlossEntry.SortAs',
					value: 'SGML',
					operator: 'EQ'
				},
				columns: [
					{key: 'glossary.GlossDiv.GlossList.GlossEntry.ID', ordered: true},
					{key: 'glossary.GlossDiv.GlossList.GlossEntry.GlossTerm', ordered: false}
				]
			};
			us.summarySave(summary, callback);
		},
		
		step_createViewPlayerState: function(callback) {
			console.log('excute createViewPlayerState');
			
			var summary = {
				name: 'playerbystate',
				types: ['player'],				
				columns: [
					{key: 'birthCountry', ordered: true},
					{key: 'birthState', ordered: true},
					{key: 'birthCity', ordered: true},
					{key: 'nameGiven', ordered: false},
					{key: 'height', ordered: false}
				]
			};
			us.summarySave(summary, callback);
		},
		step_createViewPlayerName: function(callback) {
			console.log('excute createViewPlayerName');
			
			var summary = {
				name: 'playerbyname',
				types: ['player'],				
				columns: [
					{key: 'nameLast', ordered: true},
					{key: 'nameFirst', ordered: true},
					{key: 'birthCountry', ordered: false}
				]
			};
			us.summarySave(summary, callback);
		},		
		step_deletePlayers: function(callback) {
			console.log('excute deletePlayers');
			// fetch first 100 players by type and delete it! 
			var delFunc = function(obj, callback) {
				console.log('delete ' + obj.partition + ':' + obj.type + ':' + obj.id);
				//console.dir(row);
				us.dataObjectDelete(obj, {'ema':'ema'}, callback);
			};
			us.fetchAllByType(
				'player.basket',
				0, 100,
				'testpartition',
				['ema'],
				function(err, obj) {
					if (err) {
						callback(err,obj);
					} else {
						async.eachSeries(obj.rows, delFunc, callback);
					}
				}
			);			
		},
		step_fetchAll: function(callback) {
			console.log('excute fetchAll');

			us.fetchAll(
				0, 100,
				'testpartition',
				{'ema':'ema'},
				function(err, obj) {
					if (err) {
						callback(err,obj);
					} else {
						obj.rows.forEach(function(row) {
							console.log('fetched: ' + row.partition + ':' + row.type + ':' + row.id);							
						});
						callback(null,null);
					}
				}
			);			
		},		
		step_createPlayers: function(callback) {
			console.log('excute createPlayers skip');
			callback(null, null);
			
			var doc,
				arrPlayers = require('./players.json');
			
			var insFunc = function(obj, callback) {
				doc = {
					type: 'player.basket',
					id: '' + obj.lahmanID,
					acl: {
						readers: {'ema':'ema', 'simo':'simo'},
						writers: {'ema':'ema', 'simo':'simo'}
					},
					partition: 'testpartition',
					obj: obj
				};
				console.log('save player: ' + obj.lahmanID);
				us.dataObjectSave(doc, {'ema':'ema'}, callback);
			};
			
			async.eachSeries(arrPlayers, insFunc, callback);
		},
		step_searchPlayer: function(callback) {
			console.log('execute searchPlayer');
			us.summaryFetch(
				'playerbystate', 
				{
					values: ['USA','CA'],
					count: 25
				},
				'testpartition',
				['ema'],
				function(err, obj) {
					if (err) {
						callback(err,obj);
					} else {
						obj.rows.forEach(function(row){
							console.dir(row);
						});						
					}
				}
			);
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
