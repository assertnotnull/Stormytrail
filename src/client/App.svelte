<div class="flex flex-row bg-gray-200 h-screen">
	<div class="w-3/12 p-2 flex flex-col overflow-y-auto">
	{#each Array.from(Object.entries(networks)) as [network, containers]}
		<div class="border border-gray-500 rounded truncate">
			<h2 class="bg-gray-500 px-2">{network}</h2>
			{#each containers as container}
			<div>
				<input class="m-2" type="checkbox" id="{container.name}" bind:checked={container.selected} on:change={() => {emit(container)}} value={container.id}>
				<label for="{container.name}" class="align-text-bottom">{container.name}</label>
			</div>
			{/each}
		</div>
	{/each}
	</div>
	<div class="w-9/12 bg-black text-white overflow-y-auto p-4">
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
	
</style>
