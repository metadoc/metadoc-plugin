# metadoc-plugin

An extendable base class for building metadoc plugins.

## Usage

`npm install @author.io/metadoc-plugin -D`

_An example plugin:_

```js
const MetadocPlugin = require('@author.io/metadoc-plugin')

class MyPlugin extends MetadocPlugin {
  constructor () {
    super(...arguments)
  }

  process () {
    console.log('Do something with', this.data)
  }
}
```

The metadoc plugin base class is en extension of the Node.js [EventEmitter](https://nodejs.org/docs/latest/api/events.html#events_class_eventemitter) class, meaning it can fire events.

It's a pretty simplistic class, so it might be easier to just **read the code**.

The key elements are the `source` and `output` attributs and the helper methods.
