const path = require('path')
const fastify = require('fastify')({
    logger: true
})
const Docker = require('dockerode')
const docker = new Docker({socketPath: '/var/run/docker.sock'});
const io = require('socket.io')(fastify.server);
const Rx = require('rxjs');
const {filter, takeUntil, finalize, merge} = require('rxjs/operators');
const sparser = require('./simpleparser')

let mySocket
let Logs = {}
let listeningContainers = {}


async function start() {
    const host = process.env.HOST || 'localhost'
    const port = process.env.PORT || 3000

    let containers = await docker.listContainers({all: true})
    containers = containers.filter(container => container.State === 'running')

    io.on('connection', async socket => {
        fastify.log.info('connected')

        mySocket = socket;
        Logs[mySocket.id] = {};

        let mySubs = [];

        socket.emit('initialize', {
            containers: containers.map(container => ({
                name: container.Names[0].substr(1),
                networkSettings: container.NetworkSettings
            }))
        });

        socket.on(`getLogs`, async (containerName) => {
            console.log(`got listen-${containerName}`);
            let [thisContainer] = containers.filter(container => container.Names[0].substr(1) == containerName)
            console.log(thisContainer)
            if (thisContainer) {
                console.log('found container '+ thisContainer.Id)
                let logStream = await docker.getContainer(thisContainer.Id).logs({
                    follow: true,
                    stdout: true,
                    stderr: true,
                    tail: 10
                })

                
                mySubs[containerName] = Rx.fromEvent(logStream.pipe(sparser), 'data')
                    .pipe(
                        takeUntil(Rx.fromEvent(socket, 'disconnect')),
                        takeUntil(Rx.fromEvent(socket, `pause-${containerName}`)),
                        finalize(() => console.log('stream stopped'))
                    )
                    .subscribe(line => socket.emit('log', {containerName, line: `${containerName} - ${line}`}))
            }
        });
    })

    fastify.register(require('fastify-static'), {
        root: path.join(__dirname, '../../public'),
        prefix: '/', // optional: default '/'
    })

    fastify.get('/', (req, res) => {
        res.sendFile('index.html')
    })

    fastify.listen(port, host, (err, address) => {
        if (err) {
            fastify.log.error(err)
            process.exit(1)
        }
    })
}

start()
