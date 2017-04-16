'use strict';
const JSONAPISerializer = require('jsonapi-serializer').Serializer;

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
  const relatedModelIdAttribute = include.association.sourceIdentifier; //Object.keys(include.model.attributes).filter(byPrimaryKey(include.model))[0];
  const associationValue = item[include.as];
  if (Array.isArray(associationValue)) {
    const results = [];
    associationValue.forEach(function(record) {
      const relatedItem = {};
      relatedItem.type = include.model.name;
      relatedItem[relatedModelIdAttribute] = record[relatedModelIdAttribute];
      results.push(relatedItem);
    });
    return results;
  } else if (typeof associationValue === 'object') {
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
      meta[key] = hook.result[key];
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
 * Creates a JSON API document with multiple records.
 *
 * @private
 * @method jsonapifyViaFind
 * @param {Hook} hook
 */
function jsonapifyViaFind(hook) {
  let serialized = {};
  hook.result.included = [];
  hook.result.data.forEach(function(data, index) {
    const jsonItem = data.toJSON();
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
}

/**
 * Creates a JSON API document for a single record.
 *
 * @private
 * @method jsonapifyViaGet
 * @param {Hook} hook
 */
function jsonapifyViaGet(hook) {
  let serialized = {};
  const jsonItem = hook.result.toJSON();
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
 */
module.exports = function (options = {}) { // eslint-disable-line no-unused-vars
  return function (hook) {
    if (hook.method === 'find' || hook.method === 'get') {
      entrypoints[hook.method](hook);
    }
    return Promise.resolve(hook);
  };
};
