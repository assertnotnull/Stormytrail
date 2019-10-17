const serveStatic = require('serve-static')
const fastify = require('fastify')({
    logger: true
})
const Docker = require('dockerode')
const docker = new Docker({socketPath: '/var/run/docker.sock'});
const io = require('socket.io')(fastify.server)
const bluebird = require('bluebird')

let mySocket
let Logs = {}

const sparser = require('./simpleparser')

let streams = {}

async function start() {
    const host = process.env.HOST || 'localhost'
    const port = process.env.PORT || 3000

    io.on('connection', async socket => {
        fastify.log.info('connected')

        mySocket = socket;
        Logs[mySocket.id] = {};

        let containers = await docker.listContainers({all: true});
        containers.forEach(function (container) {
            let containerId = container.Names[0].substr(1);
            Logs[mySocket.id][containerId] = [];
            console.log(`listen-${containerId}`);
            socket.on(`listen-${containerId}`, async () => {
              console.log(`got listen-${containerId}`);
        
              //TODO: use stream.pause on socket quiet-container
                //TODO: use stream.resume on socket listen-container
                if (!streams[containerId]) {

                    console.log(`will watch ${containerId}`)
                    // streams[containerId] = docker.getContainer(container.Id);

                    streams[containerId] = await docker.getContainer(container.Id).logs({
                        follow: true,
                        stdout: true,
                        stderr: true,
                        tail: 10
                    })
                    streams[containerId]
                        .pipe(sparser)
                        .on('data', function (line) {
                            socket.emit("logs", `${container.Names[0]} - ${line}`)
                            Logs[mySocket.id][containerId].push(line);
                        });

                    socket.on(`pause-${containerId}`, async () => {
                        console.log(`pausing container ${containerId}`);
                        streams[containerId].pause();
                    })
                } else {
                    streams[containerId].resume()
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
