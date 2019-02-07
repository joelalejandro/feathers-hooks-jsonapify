# feathers-hooks-jsonapify
Feathers hook for outputting data in a JSON-API-compliant way.

_Currently works great with **Sequelize** as an adapter. There are plans to support more adapters in the future._

[![npm version](https://badge.fury.io/js/feathers-hooks-jsonapify.svg)](https://www.npmjs.com/package/feathers-hooks-jsonapify)
[![dependency status](https://david-dm.org/joelalejandro/feathers-hooks-jsonapify.svg)](https://david-dm.org/joelalejandro/feathers-hooks-jsonapify)

## Installing

Simply run `npm install --save feathers-hooks-jsonapify` and you're good to go!

## Usage

This hook is intended to use with `feathers-rest`, since it'll convert that provider's response to a JSON-API compliant document.

Require the hook:

```js
const jsonapify = require('feathers-hooks-jsonapify');
```

Then choose how to implement it.

### Tied up to a service

```js
app.service('messages').hooks({
  after: {
    find: [ jsonapify() ],
    get: [ jsonapify() ]
  }
});
```

### As a global hook

```js
app.hooks({
  after: {
    find: [ jsonapify() ],
    get: [ jsonapify() ]
  }
});
```

### Relationships

*Available since: `v0.1.4`*

`feathers-hooks-jsonapify` will automatically detect metadata for relationships in the model. It'll create an `included` top-level array in the document when the hook is called via `find`.

> Currently working and tested with `belongsTo` and `hasMany` associations. This feature works only with a Sequelize adapter.

#### Example document for a self-referencing model

```json
{
  "data": {
    "type": "topics",
    "id": "sports-cars",
    "attributes": {
      "name": "Cars",
      "created-at": "2017-04-14T22:22:03.000Z",
      "updated-at": null
    },
    "relationships": {
      "parent-topic": {
        "data": {
          "type": "topics",
          "id": "sports"
        }
      }
    },
    "links": {
      "self": "/topics/sports-cars",
      "parent": "/topics"
    }
  },
  "included": [
    {
      "type": "topics",
      "id": "sports",
      "attributes": {
        "name": "Sports",
        "parent-topic-id": null,
        "created-at": "2017-04-14T22:22:03.000Z",
        "updated-at": null
      },
      "links": {
        "self": "/topics/sports"
      }
    }
  ]
}
```

### Pagination

*Available since: `v0.1.4`*

The hook will also detect if `hook.result.skip`, `hook.result.limit` and `hook.result.total` are available as part of the `feathers-rest` provider. If available, it'll create `first`, `prev`, `next` and `last` links accordingly.

The raw pagination data is moved to a `meta` object.

#### Example document with pagination links

```json
{
  "data": [
    {
      "type": "topics",
      "id": "cinema",
      "attributes": {
        "name": "Cinema",
        "show-role-title": null,
        "created-at": "2017-04-14T22:22:03.000Z",
        "updated-at": null
      },
      "links": {
        "self": "/topics/cinema"
      }
    },
    {
      "type": "topics",
      "id": "comedy",
      "attributes": {
        "name": "Comedy",
        "show-role-title": null,
        "created-at": "2017-04-14T22:22:03.000Z",
        "updated-at": null
      },
      "links": {
        "self": "/topics/comedy"
      }
    }
  ],
  "links": {
    "next": "/topics?$skip=2",
    "last": "/topics?$skip=14"
  },
  "meta": {
    "total": 15,
    "limit": 2,
    "skip": 0
  }
}
```

## Plain Object Serialization (POS) :new:

*Available since: `v0.1.8`*

Common `Object` arrays can also be `jsonapified` for any custom service's `result`:

### Multiple objects

```js
// Sample hook result, with multiple objects, from a `person` custom service.
hook.result = [{
  firstName: 'Joel',
  lastName: 'Villarreal',
  isEnabled: true
}, {
  firstName: 'Alejandro',
  lastName: 'Bertoldi',
  isEnabled: false
}];
```

_JSONAPIfied_ result:

```json
{
  "data": [
    {
      "id": "2f1faeefc0edc081b012113e08cd9960773a70eb4d16626fade328adb9be4477",
      "type": "person",
      "attributes": {
        "first-name": "Joel",
        "last-name": "Villarreal",
        "isEnabled": true
      },
      "links": {
        "self": "/person/2f1faeefc0edc081b012113e08cd9960773a70eb4d16626fade328adb9be4477"
      }
    },
    {
      "id": "5ad0e862ce3db03640bb696d1ca77a0905ef4400070549622e577c4001f3e96d",
      "type": "person",
      "attributes": {
        "first-name": "Alejandro",
        "last-name": "Bertoldi",
        "isEnabled": false
      },
      "links": {
        "self": "/person/5ad0e862ce3db03640bb696d1ca77a0905ef4400070549622e577c4001f3e96d"
      }
    }
  ]
}
```

### Single object

```js
// Sample hook result, with a single object in an array, from a `person` custom service.
hook.result = [{
  firstName: 'Joel',
  lastName: 'Villarreal',
  isEnabled: true
}];

// same as:
hook.result = {
  firstName: 'Joel',
  lastName: 'Villarreal',
  isEnabled: true
};
```

_JSONAPIfied_ result:

```json
{
  "data": {
    "id": "2f1faeefc0edc081b012113e08cd9960773a70eb4d16626fade328adb9be4477",
    "type": "person",
    "attributes": {
      "first-name": "Joel",
      "last-name": "Villarreal",
      "isEnabled": true
    },
    "links": {
      "self": "/person/2f1faeefc0edc081b012113e08cd9960773a70eb4d16626fade328adb9be4477"
    }
  }
}
```

### Identifier and type mapping

The `jsonapify` hook receives an `options` object that accepts two settings for POS:

- `identifierKey`: the name of the property to convert into `id`
- `typeKey`: the name of the property to convert into `type`

#### What happens if I don't use `identifierKey`?

The hook's got your back. Using `crypto.createHash`, it creates a unique SHA-256 digest using the contents of the object.

#### What happens if I don't use `typeKey`?

The hook will use the service's name (`hook.service.options.name`) as each model's type.

## TODOs

Check out the [issues](https://github.com/joelalejandro/feathers-hooks-jsonapify/issues).

## Feel like contributing?

Knock yourself out! Fork the repo and make a PR.

## Licence

MIT

