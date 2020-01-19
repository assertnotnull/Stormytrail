const path = require('path')
const fastify = require('fastify')({
    logger: true
})
const Docker = require('dockerode')
const docker = new Docker({socketPath: '/var/run/docker.sock'});
const io = require('socket.io')(fastify.server);
const Rx = require('rxjs');
const {Subject, generate, interval, timer, from, Observable, defer, of} = require('rxjs');
const {filter, takeUntil, finalize, mergeMap, switchMap, tap, repeat, delay, startWith, concatMap} = require('rxjs/operators');
const sparser = require('./simpleparser')

let mySocket
let Logs = {}
let listeningContainers = {}
let containers = []

async function start() {
    const host = process.env.HOST || 'localhost'
    const port = process.env.PORT || 3000

    const source = timer(0, 5000)
        .pipe(
            concatMap(_ => from(docker.listContainers({all: true})))
        )
    
    io.on('connection', async socket => {
        fastify.log.info('connected')

        mySocket = socket;
        Logs[mySocket.id] = {};

        let mySubs = [];

        source.subscribe(allContainers => {
            let runningContainers = allContainers.filter(container => container.State === 'running')
                .map(c => { return {Id: c.Id, Names: c.Names, NetworkSettings: c.NetworkSettings}})
            console.log(`${runningContainers.length} containers running`)
            if (JSON.stringify(containers) !== JSON.stringify(runningContainers)) {
                console.log('containers updated');
                containers = runningContainers;
                socket.emit('initialize', {
                    containers: containers.map(container => ({
                        name: container.Names[0].substr(1),
                        networkSettings: container.NetworkSettings
                    }))
                });
            }
        });        

        socket.on(`getLogs`, async (containerName) => {
            console.log(`got listen-${containerName}`);
            let [thisContainer] = containers.filter(container => container.Names[0].substr(1) == containerName)
            // console.log(thisContainer)
            if (thisContainer) {
                if (!mySubs[containerName]) {
                    console.log('found container '+ thisContainer.Id)
                    let logStream = await docker.getContainer(thisContainer.Id).logs({
                        follow: true,
                        stdout: true,
                        stderr: true,
                        tail: 0
                    })

                    mySubs[containerName] = Rx.fromEvent(logStream.pipe(sparser), 'data') 
                }
                console.log(mySubs)
                mySubs[containerName]
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
