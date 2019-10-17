const start = process.hrtime.bigint();
setInterval(() => {
    console.log(`This is an echo message ${process.hrtime.bigint() - start}`)
}, 1000)