/**
 * This script help me in debug with the command: node-debug .\test\debug-main.js
 */

var mytest = require('./test.mysql.us').case_couchdb;
//var mytest = require('./test.mysql.us').case_mysql;
var async = require('async');


var test = {
	done: function() {
		console.log('missing callback??');
	},
	ok: function(value) {
		if (value) {
			console.log('PASS');
		} else {
			console.log('FAIL');
		}
	},
	equal: function(value, expected, message) {
		if (value == expected) {
			console.log('PASS');
		} else {
			console.log(message);
		}
	}
};
var baseobj = {
	
};
async.eachSeries([
	mytest.fetchByTypeIdNoAccess,
	mytest.fetchByTypeId,
	mytest.saveDataObjectNoAccess,
	mytest.saveDataObject,
	mytest.createView,
	mytest.createViewPlayerState,
	mytest.createViewPlayerName,
	//mytest.deletePlayers,
	//mytest.createPlayers,
	mytest.fetchAll,
	mytest.searchPlayer
],
function(item, callback) {
	var testfunc = function () {
		test.done = function() {
			mytest.tearDown.apply(baseobj,[callback]);
		};
		item.apply(baseobj, [test]);	
	} 
	mytest.setUp.apply(baseobj, [testfunc] );
},
function(err, obj) {
	if (err) console.log('error: ' + err);
	console.log('******* END DEBUG TEST ********');
});

