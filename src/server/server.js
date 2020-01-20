const path = require('path')
const stream = require('stream')
const fastify = require('fastify')({
    logger: true
})
const Docker = require('dockerode')
const docker = new Docker({socketPath: '/var/run/docker.sock'});
const io = require('socket.io')(fastify.server);
const Rx = require('rxjs');
const {Subject, generate, interval, timer, from, Observable, defer, of} = require('rxjs');
const {filter, takeUntil, finalize, mergeMap, map, tap, repeat, delay, startWith, concatMap} = require('rxjs/operators');

const lineRegex = /^(\d\d)T(\d\d):(\d\d):(\d\d\.\d+)Z (.*)/
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
            
            if (thisContainer) {
                if (!mySubs[containerName]) {
                    console.log('found container '+ thisContainer.Id)
                    let logStream = await docker.getContainer(thisContainer.Id).logs({
                        follow: true,
                        stdout: true,
                        stderr: true,
                        timestamps: true,
                        tail: 20
                    })
                    const chunktoStringSteam = new stream.Transform({
                        readableObjectMode: true,
                        transform(chunk, encoding, cb) {
                            this.push(chunk.toString('utf8', 8))
                            cb()
                        }
                    });
                    mySubs[containerName] = Rx.fromEvent(logStream.pipe(chunktoStringSteam), 'data') 
                }

                mySubs[containerName]
                        .pipe(
                            takeUntil(Rx.fromEvent(socket, 'disconnect')),
                            takeUntil(Rx.fromEvent(socket, `pause-${containerName}`)),
                            finalize(() => console.log('stream stopped')),
                            // map(line => {
                            //     const matches = line.match(lineRegex)
                            //     return {}
                            // })
                        )
                        .subscribe(line => {
                            socket.emit('log', {containerName, line}
                        )})
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
