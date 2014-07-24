/*jshint node:true, couch: true */
'use strict';
// couchdb constants

/**
 * Default connection parameters
 */
exports.defaultsConnectionParams = {
  host: 'localhost',
  port: '5984',
  ssl: false,
  cache: false,
  user: '',
  password: '',
  database: 'unstore'
};

exports.validate_doc_update = function (newDoc, oldDoc) {
  log('validate');
  if (!oldDoc) { return true; }
  if (!oldDoc.acl) { return true; }
  if (!newDoc.unstore_tmp_writers) {
    log('no unstore_tmp_writers => ok to proceed');
    return true;
  }
  var isOk = false;
  for (var w in newDoc.unstore_tmp_writers) {
    if (oldDoc.acl.writers.hasOwnProperty(w)) {
      isOk = true;
      break;
    }
  }
  if (!isOk) {
    throw {forbidden: 'You dont have permission to update this DataObject.'};
  } else {
    delete newDoc.unstore_tmp_writers;
  }
};

exports.views = {
  view_summary: {    // view to fetch summary (views)
    map: function (doc) {
      if (doc.type === '_unstore_summary' && doc.partition === '_unstore' && doc.obj !== null) {
        emit([doc.partition, doc.obj.name], doc);
      }
    },
    columns: [
      
    ]
  },

  objid: {      // view to fetch dataobject by objid
    map: function (doc) {
      if (doc.type !== null && doc.partition !== null) {
        if (doc.type.indexOf('.') >= 0) {
          var arrKey = doc.type.split('.');
          for (var i = 0; i < arrKey.length; i = i + 1) {
            var keys = [
              doc.partition,
              arrKey.slice(0, i + 1).join('.'),
              doc.id
            ];
            emit(keys, [doc.acl.readers]);
          }
        } else {
          emit([doc.partition, doc.type, doc.id], [doc.acl.readers,doc.id,doc.type,doc.id]);
        }
      }
    },
    columns: [
      {key: 'type', ordered: true},
      {key: 'id', ordered: true}
    ]
  },
  
  view_fetch_all: {
    map: function (doc) {
      if (doc.type !== 'unstore_summary') {
        emit([doc.partition], [doc.acl.readers, doc.id, doc.partition, doc.type, doc.id, doc._rev]);
      }
    },
    columns: [
      {key: 'partition', ordered: false},
      {key: 'type', ordered: false},
      {key: 'id', ordered: false},
      {key: 'rev', ordered: false}
    ]
  },

  view_fetch_all_by_type: {
    map: function (doc) {
      if (doc.type !== 'unstore_summary') {
        emit([doc.partition, doc.type], [doc.acl.readers, doc.id, doc.partition, doc.type, doc.id, doc._rev]);
      }
    },
    columns: [
      {key: 'partition', ordered: false},
      {key: 'type', ordered: true},
      {key: 'id', ordered: false},
      {key: 'rev', ordered: false}
    ]
  }
};

exports.buildView = function(selectTypes, selectSelect, emits, results) {
  return {
    map:  'function(doc) {\n' +
          '  if ('  + selectTypes + ' && ' + selectSelect + '){\n' +
          '    var columns = ' + emits + ',\n' +
          '    values = ' + results + ',\n' +
          '    outValues = [doc.acl.readers, doc.id],\n' +
          '    colExpand,\n' +
          '    colArr,\n' +
          '    indexArray = null,\n' +
          '    col,\n' +
          '    n,\n' +
          '    i,\n' +
          '    c,\n' +
          '    keybase = [doc.partition],\n' +
          '    key;\n' +
          '    for (col = 0; col < columns.length; col += 1) {\n' +
          '      if ( columns[col].push instanceof Array ) {\n' +
          '        indexArray = col;\n' +
          '        break;\n' +
          '      }\n' +
          '    }\n' +
          '    if( indexArray !== null ) {\n' +
          '      colArr = columns[indexArray];\n' +
          '      for(n = 0; n < colArr.length; n += 1) {\n' +
          '        colExpand = [];\n' +
          '        for(col = 0; col < columns.length; col += 1) {\n' +
          '          if( indexArray === col ) {\n' +
          '            colExpand[col] = columns[col][n];\n' +
          '          } else {\n' +
          '            colExpand[col] = columns[col];\n' +
          '          }\n' +
          '        }\n' +
          '        key = keybase.concat(colExpand);\n' +
          '        emit(key, outValues.concat(colExpand.concat(values)));\n' +
          '      }\n' +
          '    } else {\n' +
          '      key = keybase.concat(columns);\n' +
          '      emit(key, outValues.concat(columns.concat(values)));\n' +
          '    }\n' +
          '  }\n' +
          '}'
  };
};
