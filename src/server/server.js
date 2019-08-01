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
var showLogByLabel 	= process.env.SHOW_LOG_BY_LABEL || 'logio';
var showAllLogs 	= process.env.SHOW_ALL_LOGS || true;
// const parser = require('./parser')
const sparser = require('./simpleparser')

function sendLogs(containerId, logs){
	mySocket.emit('terminal:logs', {
		id: containerId,
		logs: logs
	});
}
setInterval(function(){
	if(mySocket == null || !Logs[mySocket.id]) return;
	for (var containerId in Logs[mySocket.id]) {
		if (Logs[mySocket.id][containerId].length > 0) {
			sendLogs(containerId, Logs[mySocket.id][containerId])
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


async function start() {
  // Instantiate nuxt.js
  // const nuxt = new Nuxt(config)

  const host = process.env.HOST || '127.0.0.1'
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

  io.on('connection', socket => {
    fastify.log.info('connected')

    mySocket = socket;
    Logs[mySocket.id] = {};
    docker.listContainers({all: true }, function(err, containers){
      console.log(containers)
      if(!showAllLogs){
        containers = containers.filter(function(container){
          return (container.Labels) && 
          (container.Labels.hasOwnProperty(showLogByLabel));
        });
      }
      // fetchLogs(containers, mySocket.id);
      containers.forEach(function(container){
        // Logs[mySocketId][container.Id] = '';
        socket.on(container.Names[0], () => {
          var data = toEmit(container);
          docker.getContainer(container.Id).logs({
            follow: true, 
            stdout: true, 
            stderr: true, 
            tail: 10
          }, function (err, stream) {
              // var filter = parser(data, {
              //   json: false,
              //   newline: true
              // })
            stream
            .pipe(sparser)
            .on('data', function(line){
              socket.emit(container.Names[0], `${container.Names[0]} - ${line}`) 
              // Logs[mySocketId][container.Id] += '<br>';
              // Logs[mySocketId][container.Id] += chunk.line;
            });
          });
        })
      });	
      socket.emit('initialize', {containers});
    });

    socket.on('log', containerId => {
      console.log('log event received')
      const container = docker.getContainer(containerId)
      const logs = bluebird.promisify(container.logs)
      // container.logs({
      //   follow: true, 
      //   stdout: true, 
      //   stderr: true, 
      //   tail: 50
      // }, function (err, stream) {
      //   console.log(err)
      //     var filter = parser(data, {
      //       json: false,
      //       newline: true
      //     })
      //   stream.pipe(filter);
      //   filter.on('data', function(chunk){
      //     Logs[mySocketId][container.Id] += '<br>';
      //     Logs[mySocketId][container.Id] += ansi_up.ansi_to_html(chunk.line);
      //   });
      // });
      logs({
        follow: true, 
        stdout: true, 
        stderr: true,
      }).then(stream => {
        // console.log(stream.pipe)
        stream.on('data', chunk => {
          console.log(`Received ${chunk.length} bytes of data.`);
        })
      }).catch(err => {
        console.error(err)
      })
    })

    function sendLogs(containerId, logs){
      mySocket.emit('logs', {
        id: containerId,
        logs: logs
      });
    }
    setInterval(function(){
      if(mySocket == null || !Logs[mySocket.id]) return;
      for (var containerId in Logs[mySocket.id]) {
        if (Logs[mySocket.id][containerId].length > 0) {
          sendLogs(containerId, Logs[mySocket.id][containerId])
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
