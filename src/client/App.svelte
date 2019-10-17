<div class="flex flex-row bg-gray-200 h-screen">
	<div class="flex flex-col">
	{#each Array.from(Object.entries(networks)) as [network, containers]}
		<p>{network}</p>
		{#each containers as container}
		<label><input type="checkbox" on:change={() => {emit(container)}} bind:checked={container.selected} value={container.id}>{container.name}</label>
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

	let containersUp = []
	let networks = {}
	let history = {}

	$: {}

	socket.on('initialize', data => {
	    console.log('initialized called');
		containersUp = data.containers.filter(container => container.State === 'running')
		containersUp.forEach(container => {
			let network = Object.keys(container.NetworkSettings.Networks)[0].split("_")[0];
			console.log(container.Names[0].substr(1))
			let id, containerName = container.Names[0].substr(1);
			let containerNameSplit = containerName.match(/([a-z]+)_(\w+)_(\d+)_.*/);
			
			if (containerNameSplit) {
				id = containerNameSplit[0];
				containerName = containerNameSplit[2];
			} else {
				id = containerName;
			}
			socket.on(id, data => {
			    console.log(data)
                if (!history[data.id]) history[data.id] = [];
				history[data.id] = [...history[data.id], data.logs]
			});
			if (!networks[network]) networks[network] = [];
			networks[network] = [...networks[network], {id, name: containerName, selected: false}]
		})
	})

	function emit(container) {
	    console.log('clicked', container)
		if (container.selected) {
			console.log(`listen-${container.id}`)
		    socket.emit(`listen-${container.id}`)
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
