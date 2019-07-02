'use strict';
const JSONAPISerializer = require('jsonapi-serializer').Serializer;
const crypto = require('crypto');

/**
 * Converts a string to the `dasherized-key` format.
 *
 * @private
 * @function dasherize
 * @param {String} str - String to convert.
 * @return {String}
 */
function dasherize(str) {
  let newStr = str.substr(0, 1).toLowerCase() + str.substr(1);
  newStr = newStr.replace(/([A-Z])/g, '-$1').toLowerCase();
  return newStr;
}

/**
 * Creates a unique ID for a given object, using a SHA-256 hash.
 *
 * @private
 * @function generateFauxId
 * @param {Object} data
 * @return {String}
 */
function generateFauxId(data) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(data));
  return hash.digest('hex');
}

/**
 * Checks if Sequelize objects are available. If they're not, `serializePlainObject`
 * will be used to serialize the result. No relationships will be available.
 *
 * @private
 * @function mustParseAsSequelize
 * @param {Hook} hook
 * @return {Boolean}
 */
function mustParseAsSequelize(hook) {
  return hook.service.Model;
}

/**
 * Creates a filter helper to check if a given attribute name must be excluded or not.
 *
 * @private
 * @function byExcluded
 * @param {String[]} excluded
 * @returns {Function}
 */
function byExcluded(excluded) {
  return function(attribute) {
    return excluded.indexOf(attribute) === -1;
  };
}

/**
 * Creates a filter helper to detect primary keys in a model.
 *
 * @private
 * @function byPrimaryKey
 * @param {Model} model
 * @returns {Function}
 */
function byPrimaryKey(model) {
  return function(attribute) {
    return model.attributes[attribute].primaryKey;
  };
}

/**
 * Creates an object describing the relationship per JSON API specs.
 * A relationship object has the form `{ "type": "<model>", "id": "<id>" }`.
 *
 * @private
 * @function createRelationshipObject
 * @param {Association} include - The association description
 * @param {Object} item - The parent record.
 * @return {Object}
 */
function createRelationshipObject(include, item) {
  const relatedModelIdAttribute = include.association.targetKey;
  const associationValue = item[include.as];
  if (associationValue && Array.isArray(associationValue)) {
    const results = [];
    associationValue.forEach(function(record) {
      const relatedItem = {};
      relatedItem.type = include.model.name;
      relatedItem[relatedModelIdAttribute] = record[relatedModelIdAttribute];
      results.push(relatedItem);
    });
    return results;
  } else if (associationValue && typeof associationValue === 'object') {
    const relatedItem = {};
    relatedItem.type = include.model.name;
    relatedItem[relatedModelIdAttribute] = associationValue[relatedModelIdAttribute];
    return relatedItem;
  }
  return null;
}

/**
 * Returns a helper function that converts an embedded record to a related record per JSON API specs.
 *
 * @param {Object} data
 * @param {Object[]} includedData
 * @return {Function}
 */
function parseRelationships(data, includedData) {
  return function(include) {
    const relationship = {};
    const relationshipName = include.association.options.underscored ? include.as.replace(/_/g, '-') : include.as;
    relationship[relationshipName] = { data: createRelationshipObject(include, data) };
    if (data[include.as] !== null) {
      const serializedRelationship = jsonapify(data[include.as], include.model, include.model.name + '/' + data[include.as].id, { include: [] });
      if (Array.isArray(serializedRelationship.document)) {
        Array.prototype.push.apply(includedData, [...serializedRelationship.document.map(function(item) {
          return Object.assign(item, { links: { self: '/' + include.model.name + '/' + item.id }});
        })]);
      } else {
        includedData.push(Object.assign({}, serializedRelationship.document, { links: serializedRelationship.links }));
      }
      delete data[include.as][include.association.foreignKey];
    }
    delete data[include.association.foreignKey];
    delete data[include.as];
    if (relationship[relationshipName].data !== null) {
      data.relationships = Object.assign({}, data.relationships, relationship);
    }
  };
}

/**
 * Clears any array of records of duplicates by checking its `id`.
 *
 * @private
 * @function
 * @param {Object[]} collection
 * @return {Object[]}
 */
function removeDuplicateRecords(collection) {
  const newCollection = [];
  const uniqueRecords = {};

  collection.forEach(function(item) {
    uniqueRecords[item.id] = item;
  });

  Object.keys(uniqueRecords).forEach(function(uniqueKey) {
    newCollection.push(uniqueRecords[uniqueKey]);
  });

  return newCollection;
}

/**
 * Creates a JSON API document derived from the REST provider response.
 *
 * @private
 * @function jsonapify
 * @param {Object|Object[]} data - The original response.
 * @param {Model} model - The Sequelize model to work with.
 * @param {String} selfUrl - The hook's path to create the `self` link.
 * @param {Object} context - The contents of `result.$options`.
 * @return {Object}
 */
function jsonapify(data, model, selfUrl, context) {
  const includedData = [];
  const idAttribute = Object.keys(model.attributes).filter(byPrimaryKey(model))[0];
  const excluded = [idAttribute];

  if (context.include && context.include.length) {
    context.include.forEach(parseRelationships(data, includedData, model, selfUrl));
  }

  const attributes = Object.keys(model.attributes).filter(byExcluded(excluded)).concat(['relationships']);

  const json = new JSONAPISerializer(model.name, data, {
    topLevelLinks: {
      self: '/' + selfUrl
    },
    attributes: attributes
  });

  if (json.data.attributes && json.data.attributes.relationships) {
    json.data.relationships = json.data.attributes.relationships;
    delete json.data.attributes.relationships;
  }

  const result = { document: json.data, links: json.links };

  if (includedData.length) {
    result.related = includedData;
  }

  return result;
}

/**
 * Moves any non-JSON-API top-level key as metadata.
 *
 * @private
 * @method createMetadata
 * @param {Hook} hook
 */
function createMetadata(hook) {
  const metaKeys = Object.keys(hook.result).filter(function(key) {
    return ['data', 'included', 'meta', 'links'].indexOf(key) === -1;
  });
  if (metaKeys.length) {
    const meta = {};
    metaKeys.forEach(function(key) {
      meta[dasherize(key)] = hook.result[key];
      delete hook.result[key];
    });
    hook.result.meta = meta;
  }
}

/**
 * Creates links to follow the pagination context included by the REST provider.
 *
 * @private
 * @method createPagination
 * @param {Hook} hook
 */
function createPagination(hook) {
  if (hook.result.skip !== undefined && hook.result.total !== undefined && hook.result.limit !== undefined) {
    hook.result.links = {};
    if (hook.result.skip >= hook.result.limit) {
      hook.result.links.first = '/' + hook.path;
    }
    if (hook.result.skip + hook.result.limit < hook.result.total) {
      hook.result.links.next = '/' + hook.path + '?$skip=' + (hook.result.skip + hook.result.limit);
    }
    if (hook.result.skip + hook.result.limit > hook.result.limit) {
      hook.result.links.prev = '/' + hook.path + '?$skip=' + (hook.result.skip - hook.result.limit);
    }
    if (hook.result.skip + hook.result.limit < hook.result.total) {
      hook.result.links.last = '/' + hook.path + '?$skip=' + (Math.floor(hook.result.total / hook.result.limit) * hook.result.limit);
    }
  }
}

/**
 * Converts a plain Object instance into a JSON-API-compliant object.
 *
 * @private
 * @function serializePlainObject
 * @param {Object} item
 * @param {Object} options
 * @param {Hook} hook
 * @return {Object}
 */
function serializePlainObject(item, options, hook) {
  const newItem = {};

  if (options.identifierKey) {
    newItem.id = item[options.identifierKey];
  } else {
    newItem.id = generateFauxId(item);
  }
  if (options.typeKey) {
    newItem.type = item[options.typeKey];
  } else {
    newItem.type = hook.service.options.name;
  }

  newItem.attributes = {};
  Object.keys(item).filter(function(key) {
    return key !== options.identifierKey && key !== options.typeKey;
  }).forEach(function(key) {
    newItem.attributes[dasherize(key)] = item[key];
  });

  newItem.links = {
    self: '/' + hook.path + '/' + newItem.id
  };

  return newItem;
}

/**
 * Creates a JSON API document with multiple records.
 *
 * @private
 * @method jsonapifyViaFind
 * @param {Hook} hook
 */
function jsonapifyViaFind(hook, options) {
  let serialized = {};
  if (mustParseAsSequelize(hook)) {
    hook.result.included = [];
    hook.result.data.forEach(function(data, index) {
      const jsonItem = JSON.stringify(data);
      serialized = jsonapify(jsonItem, hook.service.Model, hook.path + '/' + jsonItem.id, data.$options);
      hook.result.data[index] = serialized.document;
      if (serialized.related) {
        hook.result.included = hook.result.included.concat(serialized.related);
      }
      if (serialized.links) {
        hook.result.data[index].links = serialized.links;
        createPagination(hook);
      }
    });
    if (!hook.result.included.length) {
      delete hook.result.included;
    } else {
      hook.result.included = removeDuplicateRecords(hook.result.included);
    }
    createMetadata(hook);
  } else {
    const newResult = {};
    if (Array.isArray(hook.result) && hook.result.length > 1) {
      newResult.data = hook.result.map(function(item) {
        return serializePlainObject(item, options, hook);
      });
    } else if (!Array.isArray(hook.result) && Object.keys(hook.result).length) {
      newResult.data = [serializePlainObject(hook.result, options, hook)];
    } else {
      newResult.data = [];
    }
    hook.result = newResult;
  }
}

/**
 * Creates a JSON API document for a single record.
 *
 * @private
 * @method jsonapifyViaGet
 * @param {Hook} hook
 */
function jsonapifyViaGet(hook, options) {
  let serialized = {};
  if (mustParseAsSequelize(hook)) {
    const jsonItem = JSON.stringify(hook.result);
    serialized = jsonapify(jsonItem, hook.service.Model, hook.path + '/' + jsonItem.id, hook.result.$options);
    hook.result = { data: serialized.document, included: serialized.related };
    if (hook.result.included && !hook.result.included.length) {
      delete hook.result.included;
    }
    if (serialized.links) {
      hook.result.data.links = serialized.links;
      hook.result.data.links.parent = '/' + hook.service.Model.name;
    }
    createMetadata(hook);
  } else {
    hook.result.data = serializePlainObject(hook.result, options, hook);
  }
}

/**
 * Maps hook methods to jsonapify functions.
 *
 * @private
 * @constant entrypoints
 */
const entrypoints = { find: jsonapifyViaFind, get: jsonapifyViaGet };

/**
 * This hook allows to serialize the REST provider response as a JSON API response.
 * It is used as an `after` hook. Bindable with `find` and `get` hooks.
 *
 * @function jsonapify
 * @param {Object} options - Define settings for the JSONAPIficiation process.
 *                 Available options:
 *                 - identifierKey: (String) Used by `serializePlainObject` to determine
 *                   which key will be used as `id`.
 *                 - typeKey: (String) Used by `serializePlainObject` to determine
 *                   which key will be used as `type`.
 */
module.exports = function (options = {}) { // eslint-disable-line no-unused-vars
  return function (hook) {
    if (hook.method === 'find' || hook.method === 'get') {
      entrypoints[hook.method](hook, options);
    }
    return Promise.resolve(hook);
  };
};
