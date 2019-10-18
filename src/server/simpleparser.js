const {Transform} = require('stream')

const streamparser = new Transform({
    readableObjectMode: true,
    transform(chunk, encoding, cb) {
        // console.log(chunk.toString('utf8', 8))
        this.push(chunk.toString('utf8', 8))
        cb()
    }
})

module.exports = streamparser;