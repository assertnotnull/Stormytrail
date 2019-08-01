<div class="flex h-screen">
	<div class="flex w-1/6 bg-gray-200 h-12">
		{#each containerNames as name}
		<!-- <input class="" type="checkbox" id="{name}" name="{name}">
		<label class="text-sm" for="{name}">{name}</label> -->
		<label><input type="checkbox" bind:group={selectContainers} value={name}>{name}</label>
		{/each}
	</div>
	<div class="w-5/6 bg-black text-white ">
		{history}
	</div>
</div>


<script>
	import io from 'socket.io-client'
	const socket = io('http://localhost:3000')

	let containerNames = []
	let containers = []
	let history = []
	let selectContainers = []

	$: {
		socket.emit(selectContainers)
		io.subscribe(selectContainers, data => {
			console.log('got data in container')
            history.push(data)
		})
	}

	socket.on('initialize', data => {
		containers = data.containers.filter(container => container.State === 'running')
		containerNames = containers.map(container => container.Names[0])
	})
	socket.on('logs', data => {
		history[data.id] += data.logs
	})

	function showSelected() {
		console.log(selectContainers)
	}
</script>

<style>
	h1 {
		color: purple;
	}
</style>
