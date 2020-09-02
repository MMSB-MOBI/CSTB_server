
const socket = io.connect('http://crispr-dev.ibcp.fr:80'); //3002
socket.on('connect', function() {
    console.log('restore connected');
    const jobKey = document.URL.split("/").pop(); 
    socket.emit('restoreResults', jobKey);
});

socket.on('displayResults', (data) => {
    console.log("displayResults client")
    treatResults(data, false); 
})

socket.on("restoreNotFound", (key) => {
	console.log("not found")
	$("#Waiting").hide();
	const html = `<h4>Results not available</h4> 
	<p> Your results for job ${key} are not available. Relaunch your search. </p>`
	$("#not_found").html(html);
	$("#not_found").show();

	
})

socket.on("unknownError", (key) => {
	$("#Waiting").hide();
	const html = `<h4> Error </h4> <p> An unknown error occured during results restoration for job ${key}. Contact us at cecile.hilpert@ibcp.fr </p>`
	$("#error").html(html);
	$("#error").show();
})

function treatResults(results, isSg) {
	$("#Waiting").hide();
	var data = results.data;
	var infos;

	if (results.data.length >= 8) {

		$('#Result').show()
		let res = data[0];
		let not_in = data[1] ? data[1] : '';
		let tag = data[2];
		let number_hits = data[3];
		let data_card = data[4];
		let gi = data[5];
		let number_treated_hits = data[6];
		let fasta_metadata = data[7]; 
		let node = document.createElement("result-page");
		let resDiv = document.querySelector("#ResGraph");
		resDiv.appendChild(node);
		node.style.display = "inline-block"

		if (isSg) {
			let gene = data[8];
			node.setAttribute("gene", JSON.stringify(gene));
		}

		node.setAttribute("complete_data", JSON.stringify(res));
		node.setAttribute("all_data", JSON.stringify(data_card));
		node.setAttribute("org_names", gi);
		node.setAttribute("fasta_metadata", JSON.stringify(fasta_metadata));

		infos = '<p>' + number_hits + ' hits have been found for this research';
		if (parseInt(number_hits) > parseInt(number_treated_hits)){
			infos += '. Only the first ' + number_treated_hits + ' are shown on the graphical interface. All hits can be found in downloadable raw results file. ';
		}
		
		infos += '</br><i class="material-icons" id="drop_not_in off" class="drop" onclick="clickDrop(this)">arrow_drop_down</i>'
		if (not_in != '') {
			infos += '<p> All hits are absent from excluded genome(s) : ' + not_in;
		}
		else {
			infos += '<p> No excluded genomes selected.</p>'
		}
		$('#infos').html(infos)
		onDownload(tag); 

	}
	else { // Check it works properly
		$("#NoResult").show();
		infos = '<p>' + data[0] + '</p> <p> ' + data[1] + '</p>'
		$("#no_result").html(infos);
	}
}

function onDownload(data) {
	$('#result-file').html('<a href="http://crispr-dev.ibcp.fr/download/' + data + '" >Download results</a>')
}