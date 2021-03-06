// test-functions.js
/*jshint node:true, trailing: false*/
'use strict';

var unstore = require('../lib/unstore.js');
var async = require('async');

var step_fetchByTypeIdNoAccess = function (test) {
	var me = this;
	if (!this.us) {
		console.log('execute fetchByTypeIdNoAccess this.us is null');
		test.ok(false);
		test.done();
		return;
	}

	this.us.fetchByTypeId(
		'test.type',
		'ematest1',
		'testpartition',
		{'noone':'noone'},
		function(err, dobj) {
			if (err) {
				if (err.error === 'not_found') {
					console.log('dataobject testpartition:test.type:ematest1 not found => untested');
				} else if (err.error === 'forbidden') {
					test.ok(true);
				} else {
					console.log(err);
				}
			} else {
				test.ok(false);
				me.testdo = dobj;
				console.warn('dataobject testpartition:test.type:ematest1 access ok => fail');
				console.dir(dobj);
			}
			test.done();
		}
	);
};
var step_fetchByTypeId = function (test) {
	var me = this;			
	me.us.fetchByTypeId(
		'test.type',
		'ematest1',
		'testpartition',
		{'ema':'ema'},
		function (err, dobj) {
			if(err) {
				if (err.error === 'not_found') {
					console.log('dataobject testpartition:test.type:ematest1 not found => untested');
				} else {
					test.ok(false);
				}
			} else {
				test.ok(true);
			}
			test.done();
		}
	);
};
var step_saveDataObjectNoAccess = function (test) {
	var me = this;	
	me.us.fetchByTypeId(
		'test.type',
		'ematest1',
		'testpartition',
		{'ema':'ema'}, 
		function (err, testdo) {
			if (!testdo) {
				console.log('test save no access skipped: dataobject not found');
				test.done();
			} else {
				testdo.obj.inc = testdo.obj.inc + 1;
				me.us.dataObjectSave(testdo, {'noone':'noone', 'dante':'dante'}, function (err, dobj) {
					if (err) {
						if (err.error == 'forbidden') {
							test.ok(true);
						} else {
							test.ok(false);
						}
					} else {
						test.ok(false);
						testdo = dobj;
						console.warn('dataobject testpartition:test.type:ematest1 access to write => fail!');
						console.dir(dobj);
					}
					test.done();
				});
			}
		}
	);
};
var step_saveDataObject = function (test) {
	var me = this;
	this.us.fetchByTypeId(
		'test.type',
		'ematest1',
		'testpartition',
		{'ema':'ema'}, 
		function (err, testdo) {
			if (err) {
				if (err.error === 'forbidden') {
					test.ok(false);							
				}
			}					
			if (!testdo) {
				var obj = require('./testobject.json');
				testdo = {
					type: 'test.type',
					id: 'ematest1',
					acl: {
						readers: {'ema':'ema', 'simo':'simo'},
						writers: {'ema':'ema', 'simo':'simo'}
					},
					partition: 'testpartition',
					obj: obj
				};
				testdo.obj.inc = 0;
			} else {
				testdo.obj.inc = testdo.obj.inc + 1;
			}
			me.us.dataObjectSave( testdo, {'ema':'ema', 'dante':'dante'}, function (err, obj) {
				if (err) {
					console.log(err.error);
					test.ok(false);
				} else {
					test.ok(true);
				}
				test.done();
			});
		}
	);
};
var step_createView = function (test) {
	var me = this;
	
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
	me.us.summarySave(summary, function (err, obj) {
		if (err) {
			test.ok(false);
		} else {
			test.ok(true);
		}
		test.done();
	});
};
var step_createViewPlayerState = function (test) {
	var me = this;
	
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
	me.us.summarySave(summary,  function (err, obj) {
		if (err) {
			test.ok(false);
		} else {
			test.ok(true);
		}
		test.done();
	});
};
var step_createViewPlayerName = function (test) {
	var me = this;
	
	var summary = {
		name: 'playerbyname',
		types: ['player'],				
		columns: [
			{key: 'nameLast', ordered: true},
			{key: 'nameFirst', ordered: true},
			{key: 'birthCountry', ordered: false}
		]
	};
	me.us.summarySave(summary,  function (err, obj) {
		if (err) {
			test.ok(false);
		} else {
			test.ok(true);
		}
		test.done();
	});
};	
var step_deletePlayers = function (test) {
	var me = this;
	// fetch first 100 players by type and delete it! 
	var delFunc = function(obj, callback) {
		me.us.dataObjectDelete(obj, {'ema':'ema'}, callback);
	};
	try {
	me.us.fetchAllByType(
		'player.basket',
		0, 3000,
		'playerspartition',
		['ema'],
		function(err, obj) {
			if (err) {
				test.ok(false);
				test.done();
			} else {
				async.eachSeries(obj.rows, delFunc, function (err, obj) {
					if (err) {
						test.ok(false);
					} else {
						test.ok(true);
					}
					test.done();
				});
			}
		}
	);
	} catch (e) {
		console.log(e);
	} 
};
var step_createPlayers = function (test) {
	var me = this;
	
	var doc,
		arrPlayers = require('./players.json');
	
	var aclOdd = {
		readers: {'ema':'ema', 'simo':'simo'},
		writers: {'ema':'ema', 'simo':'simo'}
	};
	var aclEven = {
		readers: {'ema':'ema'},
		writers: {'ema':'ema'}
	};
	var countPlayer = 1;

	var insFunc = function(obj, callback) {
		doc = {
			type: 'player.basket',
			id: '' + obj.lahmanID,
			acl: ((countPlayer % 2 === 0)?aclEven:aclOdd),
			partition: 'playerspartition',
			obj: obj
		};
		countPlayer++;
		me.us.dataObjectSave(doc, {'ema':'ema'}, callback);
	};
	
	async.eachSeries(arrPlayers, insFunc, function (err, obj) {
		if (err) {
			test.ok(false);
		} else {
			test.ok(true);
		}
		test.done();
	});
};
var step_fetchAll = function (test) {
	var me = this;

	me.us.fetchAll(
		0, 100,
		'playerspartition',
		{'simo':'simo'},
		function(err, obj) {
			if (err) {
				test.ok(false);
				test.done();
			} else {
				test.equal(obj.rows.length, 60, 'fetched rows are: ' + obj.rows.length);
				test.done();
			}
		}
	);			
};		
var step_searchPlayer = function (test) {
	var me = this;
	me.us.summaryFetch(
		'playerbystate', 
		{
			values: ['USA','CA'],
			count: 25
		},
		'playerspartition',
		['simo'],
		function(err, obj) {
			if (err) {
				test.ok(false);
				test.done();
			} else {
				test.equal(obj.rows.length, 10, 'fetched rows are: ' + obj.rows.length);
				test.done();
			}
		}
	);
};


module.exports = {
	fetchByTypeIdNoAccess: step_fetchByTypeIdNoAccess,
	fetchByTypeId: step_fetchByTypeId,
	saveDataObjectNoAccess: step_saveDataObjectNoAccess,
	saveDataObject: step_saveDataObject,
	createView: step_createView,
	createViewPlayerState: step_createViewPlayerState,
	createViewPlayerName: step_createViewPlayerName,
	deletePlayers: step_deletePlayers,
	createPlayers: step_createPlayers,
	fetchAll: step_fetchAll,
	searchPlayer: step_searchPlayer
};