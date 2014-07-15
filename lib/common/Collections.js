// Collection object
//
//	interface Collection {
//		
//  }
//
//	interface List {
//		readonly attribute unsigned long index;
//		Object item(unsigned long index);
//		add(Obejct obj);
//		remove(unsigned long index);
//	}
//  
//  C A N   B E   U N U S E F U L !!!!!!!!!!

// search list2 into list1, return true if list1 cotains at least 
// one member of list2
var hasMember = function(list1, list2) {
	if (list2 instanceof Array) {
		for(var i = 0; i < list2.length; i++) {
			if(list1.hasOwnProperty(list2[i])) {
				return true;
			}
		}
	} else {
		for(var l in list2) {
			if (list1.hasOwnProperty(l)) {
				return true;
			}
		}
	}
};

var canAccess = function(docSecurityTokens, securityTokens) {
	if (securityTokens === 'GOD') {
		return true;
	} else {
		return hasMember(docSecurityTokens, securityTokens);
	}
};

exports.hasMember = hasMember;
exports.canAccess = canAccess;