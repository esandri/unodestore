# unodestore
Storage library for node. 
An unique api to use all databases (SQL and NOSQL)

*I don't want to design it, I want to use it.*

## Features
 - Unique interface for all databases (if someone write the dirver)
 - Integrated acl

Ok, ok... I know that the goal is very ambitious. But wait, my idea is that for many projects the 
requirements are not so complex, we just need for a storage of
 - objects  
 - relations between objects
 - permissions on objects
 - indexes and summaries

So, starting from this point of view, we can write some simple API that can work with all databases.
I already wrote the driver for couchdb, but I'm pretty sure I can write the same API for MySQL, mongodb, 
oracle, MsSql, Cassandra, orientdb etc.

## Fundamental Concepts
### Data object
The first concept is that all the data (you know entities?!?) are  encapsulated into *data objects*. 
Any *data object* contains a structured part:
 - id
 - type
 - partition
 - acl

and an unstructured one:
 - obj

Your data are into *obj*, whereas the structured part is to manage some non functional aspect of your application.   
A *data object* is managed by `DataObject` class.  
A *data object* is uniquely identified by `id, type, partition`.  
The `partition` is the way to manage mutitenancy or, if you want, to implements more that one application into a unique database.  
The `acl` is the Access Control List and mantains informations of who can read and who can write the *data object*.

An example of *data object* is:

    var dobj = {
        type: 'sample.test',
        id: 'sampleid1',
        partition: 'samplepartition',
        acl: {
            readers: { 'admin': 'admin', 'public': 'public' },
            writers: { 'admin': 'admin' }
        },
        obj: {
            firstname: 'Jon',
            lastname: 'Snow',
            age: 25,
            status: 'live',
            characteristics: [
                'you don\'t know nothing Jon Snow',
                'really, he\'s still alive'
            ]
        }
    };

### Base summaries
If we want to retrieve *data objects* we need summaries. A summary is like an index of a collection of *data objects*. So any summary are defined by:
 - name
 - types
 - select
 - columns

So, the following summary:

    var summary = {
        name: 'samplesummary',
        types: ['sample.test'],
        select: {
            type: 'compare',
            key: 'status',
            value: 'live',
            operator: 'EQ'
        },
        columns: [
            {key: 'lastname', ordered: true },
            {key: 'firstname', ordered: true },
            {key: 'status', orderd: false }
        ]
    };

is named `samplesummary` and list all *data objects* with type `sample.test` and where `status` field is equal to the string `'live'`
and then the summary report the columns `lastname`,`firstname`,`status`. 

This view has two ordered columns so, as you can expect, you can lookup for *data objects* using values that match only the fist column or both.

## Usage
To create a connection to the store, or create a new one

    var unstore = require('unodestore');
    var store = new unstore.UnStore();
    store.setDriver('couchdb');
    store.openConnection({
        host: 'localhost',
        port: '5984',
        ssl: false,
        cache: false,
        user: 'admin',
        password: 'yourpassswordhere',
        database: 'dbname'
    }, function (err, obj) {
        if (err) {
            console.log(err.message);
        }
        // do something with store
    });

The you can use the store. To save a data object:

    var dobj = {
        type: 'sample.test',
        id: 'sampleid1',
        partition: 'samplepartition',
        acl: {
            readers: { 'admin': 'admin', 'public': 'public' },
            writers: { 'admin': 'admin' }
        },
        obj: {
            firstname: 'Jon',
            lastname: 'Snow',
            age: 25,
            status: 'live',
            characteristics: [
                'you don\'t know nothing Jon Snow',
                'really, he\'s still alive'
            ]
        }
    };
    store.dataObjectSave( dobj, {'admin': 'admin'}, function (err, obj) {
        if (err) {
            console.log(err.message);
        } else {
            // do something with obj
        }
    });

To retrieve a data object:

    store.fetchByTypeId('sample.test', 'sampleid1', 'samplepartition', {'admin': 'admin'}, function (err, obj) {
        if (err) {
            console.log(err.message);
        } else {
            // do something with obj (the required dataobject)
        }
    });
    
To create a summary:

    var summary = {
        name: 'samplesummary',
        types: ['sample.test'],
        select: {
            type: 'compare',
            key: 'status',
            value: 'live',
            operator: 'EQ'
        },
        columns: [
            {key: 'lastname', ordered: true },
            {key: 'firstname', ordered: true },
            {key: 'status', orderd: false }
        ]
    };
    store.summarySave( summary, function (err, obj) {
        if (err) {
            console.log(err.message);
        } else {
            // do something with obj
        }
    }):
    
To fetch from a summary:

    store.summaryFetch(
        'samplesummary',
        {  
            values: ['Snow'],
            count: 25
        },
        'samplepartition',
        ['public':'public'],
        function (err, obj) {
            if (err) {
                console.log(err.message);
            } else {
                obj.rows.forEach(function(row){
                    console.dir(row);
                });	
            }
        }
    );


## Install
To install:

    $ npm install unodestore

To test:

    $ npm test unodestore

*testing require `nodeunit`*
