const fs = require('fs')
const path = require('path')
const minimist = require('minimist-string')
const chalk = require('chalk')
const EventEmitter = require('events').EventEmitter

class MetadocPlugin extends EventEmitter {
  constructor () {
    super(...arguments)

    this.SOURCE = ''
    this.OUTPUT = ''
    this.NAME = require(require('path').join(__dirname, 'package.json')).name
    this.OUTPUT_WAS_WRITTEN = false

    this.on('start', () => console.log(`Started ${this.name}`))

    process.on('exit', () => console.log(this.exitMessage))

    process.on('beforeExit', (exitCode = 0) => {
      this.pipeOutput()
      process.exit(exitCode)
    })
  }

  get exitMessage () {
    return `${this.name} processing complete.`
  }

  get baseVersion () {
    return require(path.join(__dirname, 'package.json')).version
  }

  get name () {
    return this.NAME.split('/').pop()
  }

  set name (value) {
    this.NAME = value
  }

  get output () {
    return (this.OUTPUT || '').trim().length > 0 ? this.OUTPUT : this.identifyOutputDirectory()
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
      data = /(\{[^}].*[^]*\})/gim.exec(data)

      try {
        this.SOURCE = JSON.parse(data[1])
      } catch (e) {
        if (data === null || data === undefined) {
          console.log(chalk.red.bold('No source code (null).'))
          console.log(chalk.red.bold(`Output from ${this.name}`))
          console.log(chalk.gray(value))
          process.emit('SIGINT')
          process.exit(1)
        }

        fs.writeFileSync('./error.output.log', data.toString(), 'utf8')
        console.error(chalk.red.bold(e.message))
        console.log('\n' + chalk.yellow.bold('Problem within:\n') + chalk.gray(`${data.toString().substr(0, 75)}\n...clipped...\n${data.toString().substr(data.toString().length - 75)}`))

        if (e.message.toLowerCase().indexOf('json at position') >= 0) {
          let match = /position\s([0-9]+)/gi.exec(e.message)

          if (match !== null) {
            let index = parseInt(match[1], 10)
            const size = index

            if ((index - 10) <= 0) {
              index = 0
            } else {
              index -= 10
            }

            let position = size - index
            let output = data.toString().substr(index, 75)

            output = `${position === 0 ? chalk.bgYellow.black(output.substr(0, 1)) : (output.substr(0, position - 1) + chalk.bgYellow.black(output.substr(position, 1)) + output.substr(position + 1))}`

            console.log(`\n${chalk.yellow.bold('Relevant code snippet:')}\n${chalk.gray('(around index ' + match[1] + ')')}\n${output}`)
          }
        }

        console.log(e.stack)

        process.emit('SIGINT')
        process.exit(1)
      }
    }

    this.emit('source', this.SOURCE)
  }

  get data () {
    return this.SOURCE
  }

  mkdirp (dir) {
    try {
      fs.accessSync(dir, fs.W_OK)
    } catch (e) {
      try {
        fs.mkdirSync(dir)
      } catch (ee) {
        this.mkdirp(path.dirname(dir))
        fs.mkdirSync(dir)
      }
    }

    return dir
  }

  walk (directory) {
    let paths = new Set()

    fs.readdirSync(directory, { withFileTypes: true }).forEach(dir => {
      if (dir.isDirectory()) {
        let relativePath = path.join('./', dir.name)
        let absolutePath = path.join(directory, relativePath)

        paths.add(relativePath)

        this.walk(absolutePath).forEach(value => paths.add(path.join(relativePath, value)))
      }
    })

    return paths
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
    let content = ''
    let timer = setTimeout(() => {
      console.log(chalk.red.bold(`No input supplied to ${this.name}.`))
      process.exit(1)
    }, 1000)

    process.stdin.on('data', d => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }

      content += d.toString()
    })

    process.stdin.on('end', () => {
      this.source = content
      this.process()
    })

    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    this.emit('monitor.stdin')
  }

  process () {
    console.log(`The ${this.name} (v${this.version}) plugin should override the process() method with its own implementation.`)
  }

  // Pipe the output to the next CLI tool
  pipeOutput () {
    if (this.piped) {
      console.log(JSON.stringify(this.source))
    }
  }

  identifyOutputDirectory () {
    if (this.OUTPUT !== undefined && this.OUTPUT !== null && this.OUTPUT.trim().length > 0) {
      return this.OUTPUT
    }

    let output = this.getCLIArg('--output')

    if (!output) {
      let args = minimist(process.env.npm_lifecycle_script)

      if (!output && args.hasOwnProperty('output')) {
        output = path.resolve(args.output)
      }
    }

    return output || null
  }

  writeOutput (content = null) {
    this.OUTPUT_WAS_WRITTEN = true

    let source = this.getCLIArg('--source')

    content = content || this.source
    content = JSON.stringify(content, null, 2)

    let output = this.identifyOutputDirectory()

    if (output) {
      if (!output.endsWith('.json')) {
        output = path.join(output, 'api.json')
      }

      fs.writeFileSync(output, content)
    } else if (source) {
      fs.writeFileSync(source, content)
    }
  }

  get piped () {
    return process.env.npm_lifecycle_script.indexOf(`| ${this.name}`) >= 0 && process.env.npm_lifecycle_script.split('|').pop().indexOf(this.name) < 0
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
