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

        let containers = await docker.listContainers({all: true});
        containers.forEach(function (container) {
            let containerId = container.Names[0].substr(1);
            Logs[mySocket.id][containerId] = [];
            socket.on(`listen-${containerId}`, async () => {
                //TODO: use stream.pause on socket quiet-container
                //TODO: use stream.resume on socket listen-container
                if (!watchedContainers[containerId]) {

                    console.log(`will watch ${containerId}`)
                    watchedContainers[containerId] = docker.getContainer(container.Id);

                    let stream = await watchedContainers[containerId].logs({
                        follow: true,
                        stdout: true,
                        stderr: true,
                        tail: 10
                    })
                    stream
                        .pipe(sparser)
                        .on('data', function (line) {
                            // socket.emit("logs", `${container.Names[0]} - ${line}`)
                            Logs[mySocket.id][containerId].push(line);
                        });

                    socket.on(`pause-${containerId}`, async () => {
                        console.log(`pausing container ${containerId}`);
                        stream.pause();
                    })
                }
            })
        });
        socket.emit('initialize', {containers});

        socket.on('disconnect', async () => {
            Logs[mySocket.id] = {};
        });

        setInterval(function () {
            if (mySocket == null || !Logs[mySocket.id]) return;
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
