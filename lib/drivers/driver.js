/*jshint globalstrict: true*/
"use strict";
/*globals exports, require*/

var core = require('../core/core.js');

var Driver = function() {
    this._name = 'NoName';
    this._unstore = null;
};

Driver.prototype = {
    getUnStore: function () {
        return this._unstore;
    },

    setUnStore: function (unstore) {
        this._unstore = unstore;
    },

    /**
     * open the database connection
     * @param {object} connectionParams the parameters connections, see specific driver
     * @param {function} callback the function called at the end of the request
     *                            function (err)
     */
    openConnection: function (connectionParams, callback) {
        throw new Error('Driver.connect isn\'t implemented');
    },

    /**
     * close the database connection
     * @param {function} callback the function called at the end of the request
     *                            function (err)
     */
    closeConnection: function (callback) {
        throw new Error('Driver.close isn\'t implemented');
    },

    /**
     * clear the database CLEAR ALL DATA!
     * @param {function} callback the function called at the end of the request
     *                            function (err)
     */
    clearUnStore: function (callback) {
        throw new Error('Driver.clearUnStore isn\'t implemented');
    },

    /**
     * Fetch all the elements in the database given a partition, a start
     * and a count.
     * @param {String} partition the partition to be order.
     * @param {String[]} readers who is try to read
     * @param {int} start from that point may be the fetch
     * @param {int} count to that point may be the fetch
     * @param {function} callback the function called at the end of the request
     *                            function (err, summaryResultCollection)
     */
    fetchAll: function (start, count, partition, readers, callback) {
        throw new Error('Driver.fetchAll isn\'t implemented');
    },

    /**
     * Fetch all the elements in the database given a partition, a given type
     * a start and a count.
     * @param {String} partition the partition to be order.
     * @param {String[]} readers who is try to read
     * @param {String} type the type of {@link DataObject} to extract
     * @param {int} start from that point may be the fetch
     * @param {int} count to that point may be the fetch
     * @param {function} callback the function called at the end of the request
     *                            function (err, summaryResultCollection)
     */
    fetchAllByType: function (type, start, count, partition, readers, callback) {
        throw new Error('Driver.fetchAllByType isn\'t implemented');
    },

    /**
     * Fetch a Collection of {@link SummaryResult} with a given query.
     * @param {Summary} summary where you can make the query
     * @param {Query} query the {@link Query}
     * @param {String} partition the partition where you can make the query
     * @param {String[]} readers who can read the results
     * @param {function} callback the function called at the end of the request
     *                            function (err, summaryResultCollection)
     */
    summaryFetch: function (summaryname, query, partition, readers, callback) {
        throw new Error('Driver.summaryFetch isn\'t implemented');
    },

    /**
     * Fetch an object by id.
     * @param {String} id the identification
     * @param {String[]} readers who is try to read
     * @param {function} callback the function called at the end of the request
     *                            function (err, dataObject)
     */
    fetchById: function (id, readers, callback) {
        throw new Error('Driver.fetchById isn\'t implemented');
    },

    /**
     * Fetch a {@link DataObject} with a given objId.
     * @param {String} objId the objId for the search
     * @param {String} type the type of dataObject
     * @param {Stirng} partition the partition where you can make the fetch
     * @param {String[]} readers who can read the results
     * @param {function} callback the function called at the end of the request
     *                            function (err, dataObject)
     */
    fetchByObjId: function (objId, type, partition, readers, callback) {
        throw new Error('Driver.fetchByObjId isn\'t implemented');
    },

    /**
     * Save a {@link DataObject}.
     * @param {DataObject} dataObject the dataObject you want to save
     * @param {String[]} writers who can write the {@link DataObject}
     * @param {function} callback the function called at the end of the request
     *                            function (err, dataObject)
     */
    dataObjectSave: function (dataObject, writers, callback) {
        throw new Error('Driver.dataObjectSave isn\'t implemented');
    },
    
    dataObjectDelete: function (dataObject, writers, callback) {
        throw new Error('Driver.dataObjectDelete isn\'t implemented');
    },

    /**
     * Save a {@link Summary}.
     * @param {Summary} summary the summary you want to save
     * @param {function} callback the function called at the end of the request
     *                            function (err, summary)
     */
    summarySave: function (summary, callback) {
        throw new Error('Driver.summarySave isn\'t implemented');
    },

    /**
     * Save the {@link Relation}.
     * @param {Relation} relation the {@link Relation} you want to save
     * @param {String[]} writers who can write the relation
     * @param {function} callback the function called at the end of the request
     *                            function (err, relation)
     */
    saveRelation: function (relation, writers, callback) {
        throw new Error('Driver.saveRelation isn\'t implemented');
    },

    /**
     * Delete a given {@link DataObject}.
     * @param {DataObject} dataObject the {@link DataObject} you want to delete
     * @param {String[]} writers who can delete the {@link DataObject}
     * @param {function} callback the function called at the end of the request
     *                            function (err, dataObject)
     */
    deleteDataObject: function (dataObject, writers, callback) {
        throw new Error('Driver.deleteDataObject isn\'t implemented');
    },

    /**
     * Delete a given {@link Summary}.
     * @param {Summary} summary the {@link Summary} you want to delete
     * @param {function} callback the function called at the end of the request
     *                            function (err, summary)
     */
    deleteSummary: function (summary, callback) {
        throw new Error('Driver.deleteSummary isn\'t implemented');
    },

    /**
     * Delete a given {@link Relation}.
     * @param {Relation} relation the {@link Relation} you want to delete
     * @param {String[]} writers who can delete the {@link Relation}
     * @param {function} callback the function called at the end of the request
     *                            function (err, relation)
     */
    deleteRelation: function (relation, writers, callback) {
        throw new Error('Driver.deleteRelation isn\'t implemented');
    },

    /**
     * Begin the transaction.
     * @param {function} callback the function called at the end of the request
     *                            function (err)
     */
    beginTransaction: function (callback) {
        throw new Error('Driver.beginTransaction isn\'t implemented');
    },

    /**
     * End the transaction.
     * @param {boolean} commit is true if we want to commit, false otherwise
     * @param {function} callback the function called at the end of the request
     *                            function (err, commit)
     */
    endTransaction: function (commit, callback) {
        throw new Error('Driver.endTransaction isn\'t implemented');
    },

    /**
     * Get a {@link Summary} with a given Summary name.
     * @param {String} name the Summary name
     * @param {function} callback the function called at the end of the request
     *                            function (err, summary)
     */
    getSummary: function (name, callback) {
        throw new Error('Driver.getSummary isn\'t implemented');
    },

    /**
     * Return the list of supported features (returned by driver).
     * @return {String[]} list of supported features
     */
    getFeatures: function () {
        return [];
    }
};

exports.Driver = Driver;