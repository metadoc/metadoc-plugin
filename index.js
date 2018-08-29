const fs = require('fs')
const path = require('path')
const EventEmitter = require('events').EventEmitter

class MetadocPlugin extends EventEmitter {
  constructor () {
    super(...arguments)

    this.SOURCE = ''
    this.OUTPUT = ''
  }

  get output () {
    return this.OUTPUT
  }

  set output (value) {
    this.OUTPUT = path.resolve(value)
  }

  get source () {
    return this.SOURCE
  }

  set source (value) {
    let data = value

    try {
      data = require(require('path').resolve(value))
      this.SOURCE = data
    } catch (e) {
      data = data.split('{')
      data.shift()
      data = `{${data.join('{')}`

      try {
        this.SOURCE = JSON.parse(data)
      } catch (e) {
        console.error(e)
        process.exit(1)
      }
    }

    this.emit('source', data)
  }

  get data () {
    return this.SOURCE
  }

  mkdirp (dir) {
    try {
      fs.accessSync(dir, fs.W_OK)
    } catch (e) {
      try {
        fs.mkdir(dir)
      } catch (ee) {
        this.mkdirp(path.dirname(dir))
        fs.mkdir(dir)
      }
    }

    return dir
  }

  verifyOutputDirectory () {
    // Check output directory
    try {
      let stat = fs.statSync(this.OUTPUT)

      if (stat.isFile()) {
        console.error(`Cannot write output to a file. ${this.OUTPUT} is not a directory.`)
        process.exit(1)
      }
    } catch (e) {}
  }

  process () {
    console.log('The plugin should override the process() method with its own implementation.')
  }
}

module.exports = MetadocPlugin
