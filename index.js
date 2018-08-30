const fs = require('fs')
const path = require('path')
const minimist = require('minimist-string')
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

  getCLIArg (arg) {
    if (process.argv.indexOf(arg) >= 0) {
      let nextVal = process.argv[process.argv.indexOf(arg) + 1]

      if (!nextVal) {
        return true
      }

      if (nextVal.startsWith('--')) {
        return true
      }

      if (['true', '1'].indexOf(nextVal.trim().toLowerCase()) >= 0) {
        return true
      }

      if (['false', '0'].indexOf(nextVal.trim().toLowerCase()) >= 0) {
        return false
      }

      return nextVal
    }

    return undefined
  }

  // This should be implemented if the plugin
  // should accept piped output from metadoc or
  // another plugin. Example: metadoc --source ./src --output ./docs | metadoc-myplugin
  monitorStdin () {
    const stdin = process.openStdin()

    let content = ''
    let timer = setTimeout(() => {
      console.error('No input source available.')
      process.exit(1)
    }, 2000)

    stdin.on('data', d => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }

      content += d.toString()
    })

    stdin.on('end', () => {
      this.source = content
      this.process()
    })
  }

  process () {
    console.log('The plugin should override the process() method with its own implementation.')
  }

  writeOutput (content = null) {
    let source = this.getCLIArg('--source')

    content = content || this.source
    content = JSON.stringify(content, null, 2)

    let output = this.getCLIArg('--output')

    if (!output) {
      let args = minimist(process.env.npm_lifecycle_script)

      if (!output && args.hasOwnProperty('output')) {
        output = path.resolve(args.output)

        if (!output.endsWith('.json')) {
          output = path.join(output, 'api.json')
        }
      }
    }

    if (output) {
      fs.writeFileSync(output, content)
      process.exit(0)
    }

    if (source) {
      fs.writeFileSync(source, content)
      process.exit(0)
    }

    process.stdout.write(content)
    process.exit(0)
  }

  run () {
    let source = this.getCLIArg('--source')

    if (source) {
      this.source = fs.readFileSync(source).toString()
      this.process()
    } else {
      this.monitorStdin()
    }
  }
}

module.exports = MetadocPlugin
