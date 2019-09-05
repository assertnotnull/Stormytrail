<div class="flex flex-row bg-gray-200 h-screen">
	<div class="flex flex-col">
	{#each networks as network}
		<p>{network}</p>
		{#each containerNames as container}				
		<label><input type="checkbox" bind:group={selectContainers} value={container.id}>{container.name}</label>
		{/each}
	{/each}
	</div>
	<div class="w-5/6 bg-black text-white">
		{#each Array.from(Object.entries(history)) as [name, logs] }
			{#each logs as log}
				<p>{name} - {log}</p>
			{/each}
		{/each}
	</div>
</div>


<script>
	import io from 'socket.io-client'
	const socket = io('http://localhost:3000')

	let containerNames = []
	let containersUp = []
	let networks = []
	let history = {}
	let selectContainers = []

	$: {
		emit(selectContainers)
	}

	socket.on('initialize', data => {
		containersUp = data.containers.filter(container => container.State === 'running')
		containerNames = containersUp.map(container => {
			let found = container.Names[0].match(/([a-z]+)_(\w+)_(\d+)_.*/)
			return found ? {id: found[0], name: found[2], network: found[1]} : {id: container.Names[0], name: container.Names[0].substring(1)}
		})
		networks = [...new Set(containerNames.map(container => {
			return container.network ? container.network : 'default'
		}))]
		containerNames.forEach(container => {
			socket.on(container.id, data => {
				history[data.id] = [...history[data.id], data.logs]
			})
		})
	})
	socket.on('logs', data => {
		history[data.id] = [...history[data.id], data.logs]
		console.log("history", history, data)
	})

	function emit(selectContainers) {
		console.log(selectContainers, containerNames)
		containerNames.forEach(container => {
			if(history.hasOwnProperty(container.id)) {
				history[container.id] = []
				socket.emit(`quiet-${container.name}`)
			}
		})
		selectContainers.forEach(container => {
			history[container] = []		
			socket.emit(`listen-${container}`)
		})
	}
	function showSelected() {
		console.log(selectContainers)
	}
</script>

<style>
	h1 {
		color: purple;
	}
</style>
