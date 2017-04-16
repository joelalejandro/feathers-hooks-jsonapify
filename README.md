# feathers-hooks-jsonapify
Feathers hook for outputting data in a JSON-API-compliant way.

## Installing

Simply run `npm install --save feathers-hooks-jsonapify` and you're good to go!

## Usage

> **Important:** As of version 0.1.0, this hook is intended to use with Sequelize. Further versions will move the coupling code to hook configurations.

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

`feathers-hooks-jsonapify` will automatically detect metadata for relationships in the model. It'll create an `included` top-level array in the document when the hook is called via `find`.

> Currently working and tested with `belongsTo` and `hasMany` associations.

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

## TODOs

Check out the [issues](https://github.com/joelalejandro/feathers-hooks-jsonapify/issues).

## Feel like contributing?

Knock yourself out! Fork the repo and make a PR.

## Licence

MIT

