<div class="flex flex-row bg-gray-200 h-screen">
	<div class="flex flex-col">
	{#each Array.from(Object.entries(networks)) as [network, containers]}
		<p>{network}</p>
		{#each containers as container}
		<label><input type="checkbox" bind:checked={container.selected} on:change={() => {emit(container)}} value={container.id}>{container.name}</label>
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
	import io from 'socket.io-client';
	import * as Rx from 'rxjs';
	const socket = io('http://localhost:3000')

	let containersUp = []
	let networks = {}
	let history = []

	$: {}

	socket.on('initialize', data => {
	    console.log('initialized called');
		containersUp = data.containers
		networks = {}
		containersUp.forEach(container => {
			let network = Object.keys(container.networkSettings.Networks)[0].split("_")[0];
			
			let id, containerName = container.name;
			let containerNameSplit = containerName.match(/([a-z]+)_(\w+)_(\d+)_.*/);
			
			if (containerNameSplit) {
				id = containerNameSplit[0];
				containerName = containerNameSplit[2];
			} else {
				id = containerName;
			}
			
			history[containerName] = []
			if (!networks[network]) networks[network] = [];
			networks[network] = [...networks[network], {id, name: containerName, selected: false}]
		})
	})

	socket.on('log', data => {
		if (history[data.containerName].length > 50) {
			history[data.containerName] = history[data.containerName].slice(2);
		}
		history[data.containerName] = [...history[data.containerName], data.line]
	})

	function emit(container) {
		console.log('clicked', container)
		console.log("container is " + container.selected)
		if (container.selected) {
			console.log(`listen-${container.id}`)
		    socket.emit('getLogs', container.id)
		} else {
		    socket.emit(`pause-${container.id}`)
		    console.log(history[container.id])
		    history[container.id] = []
		}
	}
</script>

<style>
	h1 {
		color: purple;
	}
</style>
