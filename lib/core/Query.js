/////////////////////////////// Query module /////////////////////////////////
// The query object:
//	this is only intended for describe a query, not for it execution
////////////////////////////////////////////////////////////////////////////
/*jslint node: true */
/*globals exports*/
"use strict";

var CompareOperator = {
	EQ:   '==',
	LT:   '<',
	GT:   '>',
	LTEQ: '<=',
	GTEQ: '>=',
	NEQ:  '!='
};

var LogicalOperator = {
	NOT: '!',
	OR:  '||',
	AND: '&&'
};

var BaseElement = function(obj) {
	if (obj === undefined) {
		this._bool = true;
	} else {
		this._bool = obj.bool||true;
	}
};

BaseElement.prototype = {
	getBool: function() { return this._bool; },
	setBool: function(bool) { this._bool = bool; }
};

/////////////////////////////// CompareElement ///////////////////////////////
// A query element to describe compare operation
var CompareElement = {};
CompareElement.prototype = new BaseElement();
CompareElement.prototype.constructor = CompareElement;

/**
 *
 **/
CompareElement = function(obj) {
	if (obj === undefined) {
		this._key = null;
		this._value = null;
		this._operator = null;
	} else {
		this._key = obj.key || null;
		this._value = obj.value || null;
		this._operator = obj.operator || null;
	}
};

CompareElement.prototype = {
	getKey: function() { return this._key; },
	setKey: function(key) { this._key = key; },
	getValue: function() { return this._value; },
	setValue: function(value) { this._value = value; },
	getOperator: function() { return this._operator; },
	setOperator: function(operator) { this._operator = operator; }
};

/////////////////////////////// LogicalElement ///////////////////////////////
// A query element to describe logical operation
var LogicalElement = {};
LogicalElement.prototype = new BaseElement();
LogicalElement.prototype.constructor = LogicalElement;
LogicalElement = function(obj) {
	if (obj === undefined) {
		this._operator = null;
		this._elements = [];
	} else {
		this._operator = obj.operator || null;
		if (obj.elements) {
			this._elements = [];
			for(var ielem = 0; ielem < obj.elements.length; ielem++) {
				if (obj.elements[ielem].key) {
					// create a new CompareElement
					this._elements.push(new CompareElement(obj.elements[ielem]));
				} else {
					// create a new LogicalElement
					this._elements.push(new LogicalElement(obj.elements[ielem]));
				}
			}
		}
	}
};

LogicalElement.prototype = {
	getElements: function() {	return this._elements; },
	setElements: function(elements) {	this._elements = elements; },

	item: function(index) { return this._elements[index]; },
	addElement: function(element) { this._elements.push(element); },

	getOperator: function() { return this._elements; },
	setOperator: function(operator) { this._operator = operator; }
};

/////////////////////////////// Query ////////////////////////////////////////
// The query. The element can be
var Query = function(obj) {
	if (obj) {
		if (obj.element.key) {
			// create a new CompareElement
			this._element = new CompareElement(obj.element);
		} else {
			// create a new LogicalElement
			this._element = new LogicalElement(obj.element);
		}
	} else {
		this._element = null;
	}
};

Query.prototype = {
	getElement: function(element) { return this._element; },
	setElement: function(element) {this._element = element; }
};

exports.CompareOperator = CompareOperator;
exports.LogicalOperator = LogicalOperator;
exports.BaseElement = BaseElement;
exports.CompareElement = CompareElement;
exports.LogicalElement = LogicalElement;
exports.Query = Query;