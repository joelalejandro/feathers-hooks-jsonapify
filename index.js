'use strict';
const JSONAPISerializer = require('jsonapi-serializer').Serializer;

function jsonapify(data, model, selfUrl) {
  const idAttribute = Object.keys(model.attributes).filter(function(attribute) {
    return model.attributes[attribute].primaryKey;
  })[0];

  const attributes = Object.keys(model.attributes).filter(function(attribute) { return attribute !== idAttribute; });

  const idParameter = !Array.isArray(data) ? ('/' + data[idAttribute]) : '';

  return new JSONAPISerializer(model.name, data, {
    topLevelLinks: {
      self: '/' + selfUrl + idParameter
    },
    attributes: attributes
  });
}

module.exports = function (options = {}) { // eslint-disable-line no-unused-vars
  return function (hook) {
    if (hook.method === 'find') {
      hook.result = jsonapify(hook.result.data, hook.service.Model, hook.path);
    } else if (hook.method === 'get') {
      hook.result = jsonapify(hook.result.toJSON(), hook.service.Model, hook.path);
    }
    return Promise.resolve(hook);
  };
};
