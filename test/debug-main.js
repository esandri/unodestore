
var mytest = require('./test.mysql.us');
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
	mytest.case1.step_fetchByTypeIdNoAccess,
	mytest.case1.step_fetchByTypeId,
	mytest.case1.step_saveDataObjectNoAccess,
	mytest.case1.step_saveDataObject,
	mytest.case1.step_createView,
	mytest.case1.step_createViewPlayerState,
	mytest.case1.step_createViewPlayerName,
	mytest.case1.step_deletePlayers,
	mytest.case1.step_createPlayers,
	mytest.case1.step_fetchAll,
	mytest.case1.step_searchPlayer
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

