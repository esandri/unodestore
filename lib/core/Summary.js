//  interface SummaryColumn {
//      attribute string key;       // the name of the column
//      attribute string keySelect; // the key in DataObject to report in Summary
//  };
  
//  interface Summary {
//      attribute string name;
//      attribute SummaryColumnCollection columns;
//      attribute SelectOptions selectOptions;
//      SummaryResultCollection fetchSummary(SelectOptions selectOptions);
//      DataObject fetchDataObject(SummaryResult summaryResult);
//  };

//  interface SummaryResult {
//      readonly attribute KVCollection colums;
//      readonly attribute DataObjectId;
//  };
/*jshint globalstrict: true*/
/*globals exports,require*/
"use strict";
//var core = require('./DataObject.js');

/////////////////////////////// SummaryColumn ////////////////////////////////
// A column in a summary table
var SummaryColumn = function(key, value, ordered) {
    this._key = key || null;
    this._value = value || null;
    this._ordered = ordered || false;
};

SummaryColumn.prototype = {
    getKey: function() { return this._key; },
    setKey: function(key) { this._key = key; },

    getValue: function() { return this._value; },
    setValue: function(value) { this._value = value; },

    isOrdered: function () { return this._ordered; },
    setOrdered: function (ordered) { this._ordered = ordered; }
};

/////////////////////////////// Summary //////////////////////////////////////
// The summary object (something like a table or a view)
var Summary = function() {
    this._name = null;
    this._columns = null;
    this._select = null;
    this._fiterTypes = null;
};

Summary.prototype = {
    getName: function () { return this._name; },
    setName: function (name) { this._name = name; },

    getColumns: function () { return this._columns; },
    setColumns: function (columns) { this._columns = columns; },

    getSelectQuery: function () { return this._select; },
    setSelectQuery: function (query) { this._select = query; },

    getSelectTypes: function() { return this._selectTypes; },
    setSelectTypes: function(types) { this._filterTypes = types; },

    save: function () {
        throw new Error('Summary.save not implemented');
    },

    fetch: function (query) {
        throw new Error('Summary.fetch not implemented');
    }
};

/////////////////////////////// SummaryResult ////////////////////////////////
// The result of a fetch operatin is an array of summary results
var SummaryResult = function() {
    this._columns = null;
    this._doId = null;
};

SummaryResult.prototype = {
    getColumns: function() { return this._columns; },
    setColumns: function(columns) { this._columns = columns; },

    getDoId: function() { return this._doId; },
    setDoId: function(doid) { this._doId = doid; }
};

exports.SummaryColumn = SummaryColumn;
exports.Summary = Summary;
exports.SummaryResult = SummaryResult;