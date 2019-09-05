// const { Nuxt, Builder } = require('nuxt')
const serveStatic = require('serve-static')
const fastify = require('fastify')({
  logger: true
})
const Docker = require('dockerode')
const docker = new Docker({socketPath: '/var/run/docker.sock'});
const io = require('socket.io')(fastify.server)
// const cors = require('cors')
const bluebird = require('bluebird')

// Import and Set Nuxt.js options
// const config = require('../nuxt.config.js')
const config = {}
config.dev = !(process.env.NODE_ENV === 'production')

let mySocket
let Logs = {}

const sparser = require('./simpleparser')

let watchedContainers = {}

async function start() {
  // Instantiate nuxt.js
  // const nuxt = new Nuxt(config)

  const host = process.env.HOST || 'localhost'
  const port = process.env.PORT || 3000

  // Build only in dev mode
  if (config.dev) {
    // fastify.options('*', cors())
    // fastify.use(cors({origin: '*'}))
    // const builder = new Builder(nuxt)
    // await builder.build()
  } else {
    // await nuxt.ready()
  }

  // fastify.use(nuxt.render)

  io.on('connection', async socket => {
    fastify.log.info('connected')

    mySocket = socket;
    Logs[mySocket.id] = {};
    socket.on('subscribe', data => {
      console.log(`subscribing ${data}`)
    })
    let containers = await docker.listContainers({all: true});
    containers.forEach(function(container){
      let containerName = container.Names[0];
      Logs[mySocket.id][containerName] = [];
      
      socket.on(`listen-${containerName}`, async () => {
        //TODO: use stream.pause on socket quiet-container
        //TODO: use stream.resume on socket listen-container
        watchedContainers[containerName] = docker.getContainer(container.Id);
        // watchedContainers[containerName].logs({
        //   follow: true,  
        //   stdout: true, 
        //   stderr: true, 
        //   tail: 10
        // }, function (err, stream) {
        //     // var filter = parser(data, {
        //     //   json: false,
        //     //   newline: true
        //     // })
        //   stream
        //   .pipe(sparser)
        //   .on('data', function(line){
        //     // socket.emit("logs", `${container.Names[0]} - ${line}`) 
        //     Logs[mySocket.id][containerName].push(line);
        //   });
        // });

        let stream = await watchedContainers[containerName].logs({
          follow: true,  
          stdout: true, 
          stderr: true, 
          tail: 10
        })
        stream
        .pipe(sparser)
        .on('data', function(line){
          // socket.emit("logs", `${container.Names[0]} - ${line}`) 
          Logs[mySocket.id][containerName].push(line);
        });
      })
      socket.emit('initialize', {containers});
    });

  

    setInterval(function(){
      if(mySocket == null || !Logs[mySocket.id]) return;
      for (var containerId in Logs[mySocket.id]) {
        if (Logs[mySocket.id][containerId].length > 0) {
          console.log(`found log ${containerId}`)
          // sendLogs(containerId, Logs[mySocket.id][containerId])
          mySocket.emit(containerId, {
            id: containerId,
            logs: Logs[mySocket.id][containerId]
          });
          Logs[mySocket.id][containerId] = [];
        }
      }
    }, 500);


    function toEmit(container) {
      return {
          id: container.Id,
          image: container.Image,
          name: container.Names[0].replace(/^\//, '')
      }
    }
  })

  const path = require('path')
  
  fastify.register(require('fastify-static'), {
    root: path.join(__dirname, '../../public'),
    prefix: '/', // optional: default '/'
  })
  fastify.get('/', (req, res) => {
    // res.sendFile(path.join(__dirname, 'public', 'index.html'))
    res.sendFile('index.html')
    // res.send
  })

  fastify.listen(port, host, (err, address) => {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }
  })
}

start()
