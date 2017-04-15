# feathers-hooks-jsonapify
Feathers hook for outputting data in a JSON-API-compliant way.

## Installing

Simply run `npm install --save feathers-hooks-jsonapify` and you're good to go!

## Usage

> **Important:** As of version 0.1.0, this hook is intended to use with Sequelize. Further versions will move the coupling code to hook configurations.

Require the hook:

```js
const jsonapify = require('feathers-hooks-jsonapify');
```

Thee choose how to implement it.

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

## TODOs

Check out the [issues](https://github.com/joelalejandro/feathers-hooks-jsonapify/issues).

## Feel like contributing?

Knock yourself out! Fork the repo and make a PR.

## Licence

MIT

