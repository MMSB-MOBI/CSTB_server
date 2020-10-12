
const socket = io.connect('http://crispr-dev.ibcp.fr:80'); //3002
socket.on('connect', function() {
    const jobKey = document.URL.split("/").pop(); 
    socket.emit('restoreResults', jobKey);
});

socket.on('displayResults', (data) => {
	if (data.data[8]) treatResults(data, true); //if gene given, specificGene treatment
	else treatResults(data, false); 

})

socket.on("restoreNotFound", (key) => {
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
		node.setAttribute("job_tag", tag)
		node.setAttribute("excluded_names", not_in)
		node.setAttribute("total_hits", number_hits)

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