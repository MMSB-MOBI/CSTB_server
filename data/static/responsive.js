let final_sequence = ''

// last modif at 17 Jul 2019 10:59
socket.on("resultsAllGenomes", function (data) {
	treatResults(data, false);
});

/*socket.on("submitted", function (data) {
	console.log("Submitted");
	console.dir(data);
});*/


socket.on("resultsSpecific", function (data) {
	treatResults(data, true);
});

socket.on("workflowError", function(msg) {
	treatError(msg);
}) 

// *********************************************
//              *  TREE FEATURES *
// *********************************************
function displayTree(suffix, searchType, treeType) {


	var to = false;
	$(searchType + suffix).keyup(function () {
		if (to) { clearTimeout(to); }
		to = setTimeout(function () {
			var v = $(searchType + suffix).val();
			$(treeType + suffix).jstree().search(v);
		}, 250);
	});
	$.jstree.defaults.search.show_only_matches = true;

	// tree building

	$(treeType + suffix).jstree({
		"core": {
			'data': { "url": "http://crispr-dev.ibcp.fr:80/tree", "dataType": "json", "error": function(e) {
				//console.log("error database", e.status, e.statusText, e);
				$(treeType + suffix).html(`Error while try to reach database (${e.status} : ${e.statusText})`)
			}},
			'themes': [
				{ "dots": true }
			],
			'animation': false
		},
		"checkbox": {
			"keep_selected_style": false
		},
		"plugins": ["wholerow", "checkbox", "search", "dnd", "types"]
	});

	$(treeType + suffix).jstree().show_dots();

}

function selectOntree(treeName, reverseTree, j1, j2) {
	// Enable all nodes in reverse Tree
	$(reverseTree).jstree(true).get_json('#', { flat: true }).forEach(node => { $(reverseTree).jstree("enable_node", node.id) })
	// Disable selected node in reverse Tree
	$(treeName).jstree('get_selected').forEach(node => { $(reverseTree).jstree().disable_node(node.replace(j1, j2)) })
	// Remove check disable boxes for beauty
	$(reverseTree).jstree('get_selected').forEach(node => { $(treeName).jstree(true).uncheck_node(node.replace(j2, j1)) })
}

function resetTree(suffix) {
	$('#tree_include' + suffix).jstree().close_all();
	$('#tree_include' + suffix).jstree().deselect_all();
	$('#tree_exclude' + suffix).jstree().close_all();
	$('#tree_exclude' + suffix).jstree().deselect_all();
	$('#tree_include' + suffix).jstree().search('');
	$('#tree_exclude' + suffix).jstree().search('');
	$('#search_in' + suffix).val('')
	$('#search_notin' + suffix).val('')
}

function submitTree(treeName, isSG) {
	if ($(treeName).jstree('get_selected').length == 0) {
		window.alert('You have to choose at least one included genome')
		return
	}
	// let bla =
	// console.dir(bla)
	let suffix = (isSG) ? "_sg" : "";

	$('#tree' + suffix).hide()
	$("#submit_trees" + suffix).hide();
	$("#reset_trees" + suffix).hide();
	$('#list_selection' + suffix).show();
	$('#confirm_y' + suffix).show()
	$('#confirm_n' + suffix).show()
	$('#ShowIN' + suffix).show()
	$('#ShowNOTIN' + suffix).show()
	if (isSG) {
		$('#ShowSeq').hide()
		displaySelection("#InView_sg", "#NotInView_sg", '#tree_include_sg', '#tree_exclude_sg')
	} else {
		displaySelection("#InView", "#NotInView", '#tree_include', '#tree_exclude')
	}
}


// *********************************************
//            *  TREAT RESULTS *
// *********************************************
function display_download(tag) {
	onDownload(tag)
	return;
}

function onDownload(data) {
	$('#result-file').html('<a href="download/' + data + '" >Download results</a>')
}

function writeResults(obj) {
	let out = '';

	for (const sgrna of obj) {
		const seq = sgrna.sequence;
		let nb_coords_of_sgnra = 0;

		for (const genome of sgrna.occurences) {
			const organism = genome.org;
			const subsequences = genome.all_ref;
			let nb_coords_of_genome = 0;

			for (const subsequence of subsequences) {
				const title = subsequence.ref;
				const coords = subsequence.coords;

				nb_coords_of_genome += coords.length;
				nb_coords_of_sgnra += coords.length;

				for (const coord of coords) {
					out = `<td>${coord}</td></tr>` + out;
				}

				out = `<td rowspan="${coords.length}">${title}</td>` + out;
			} 
			out = `<td rowspan="${nb_coords_of_genome}">${organism}</td>` + out;
		}
		out = `<td rowspan="${nb_coords_of_sgnra}">${seq}</td>` + out;
	}

	const header = '<tr class="w3-light-grey"> <th> sgRNA sequence </th> <th> Organism(s) </th> <th colspan=2> Coordinates </th> </tr>';
	out = header + out;

	return out;
}

function treatError(msg) {
	$('#Waiting').hide()
	$("#NoResult").show();
	infos = '<p> An error occured </p> <p> ' + msg + '</p>'
	$("#no_result").html(infos);
}

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
			infos += '. The first ' + number_treated_hits + ' have been treated';
		}
		
		if (parseInt(number_hits) > 100) {
			infos += '. Only the best 100 are written below. Download the result file to get more hits.'
		}
		if (parseInt(number_hits) > 10000) {
			infos += ' (only the best 10 000 are written to this file).</p>'
		}
		infos += '</br><i class="material-icons" id="drop_not_in off" class="drop" onclick="clickDrop(this)">arrow_drop_down</i>'
		if (not_in != '') {
			infos += '<p> All hits are absent from excluded genome(s) : ' + not_in;
		}
		else {
			infos += '<p> No excluded genomes selected.</p>'
		}
		let out = writeResults(res)
		$('#infos').html(infos)
		display_download(tag)

	}
	else { // Check it works properly
		$("#NoResult").show();
		infos = '<p>' + data[0] + '</p> <p> ' + data[1] + '</p>'
		$("#no_result").html(infos);
	}
}


// display or not organisms excluded
function clickDrop(d) {
	if (d.id.split(' ')[1] == "off") {
		d.id = "drop_not_in on";
		document.querySelector("#infos>p:nth-child(2)").style.display = "block";
		d.innerHTML = "arrow_drop_up";

	} else {
		d.id = "drop_not_in off";
		document.querySelector("#infos>p:nth-child(2)").style.display = "none";
		d.innerHTML = "arrow_drop_down";
	}
}

// *********************************************
//            *  TREAT FASTA FILE *
// *********************************************
function verifyFasta(seq) {
	var error = 'no error'
	var authorized = ['A', 'T', 'C', 'G', 'a', 't', 'c', 'g']
	var nbre_seq = 0
	var seq_finale = ''
	var sequence_split = seq.split('\n')
	for (let i = 0; i < sequence_split.length; i++) {
		if (sequence_split[i][0] == '>') {
			nbre_seq += 1
			if (nbre_seq > 1) {
				error = 'More than 1 sequence'
				return [error, 0]
			} // if
		} // if
		else {
			for (let j = 0; j < sequence_split[i].length; j++) {
				if (!(authorized.includes(sequence_split[i][j]))) {
					error = "Wrong sequence. Only nucleotide characters authorized"
					return [error, 0]
				}
				else {
					seq_finale += sequence_split[i][j]
				} // if 2
			} // for 2
		}// else
	}// for
	return [error, seq_finale]
}

function loadFile(id) {
	if (!window.FileReader) {
		return alert('FileReader API is not supported by your browser.');
	}
	var $i = $(id), // Put file input ID here
		input = $i[0];
	if (input.files && input.files[0]) {
		file = input.files[0]; // The file
		fr = new FileReader(); // FileReader instance

		fr.readAsText(file);
		fr.onload = function () {
			// Do stuff on onload, use fr.result for contents of file
			sequence = fr.result
			$('#seq').val(sequence)
		};
	}
	else {
		// Handle errors here
		alert("File not selected or browser incompatible.")
	}
}

function treatFastaFile() {
	$('a[name=error-load]').hide()
	fastaname = $("#fasta-file").val()

	if (fastaname == '') {
		$('a[name=error-load]').show()
		$('a[name=error-load]').html('No file selected')
		return
	}
	else {
		loadFile('#fasta-file')
	}
}

function displaySequence() {
	let sequence = $('#seq').val()
	let error_fasta = verifyFasta(sequence)
	if (error_fasta[0] != "no error") {
		window.alert('Sequence not in fasta format')
		return false
	}
	final_sequence = error_fasta[1];
	if (final_sequence == '') {
		window.alert('Empty sequence')
		return false
	}
	$('#ShowSeq').show()
	$('#ShowSeq').html("<h5 class='w3-container w3-light-green'>Your query:</h5><div class='w3-margin'>" + sequence + "</div>")
	$('#spec_tips').hide()
	$('a[name=error-fasta]').hide()
	$("#Sequenceupload").hide()
	$('#next').hide()
	$('#list').hide()
	$('#changeSeq').show()
	$('#tree_sg').show()
	$('#reset_trees_sg').show()
	$('#submit_trees_sg').show()
	resetTree('_sg')

}

// *********************************************
//        *  DISPLAY & TREAT SELECTIONS  *
// *********************************************
function displaySelection(divView, divNotView, treeIn, treeEx) {
	$(treeIn).jstree('get_bottom_selected', true).forEach(node => {
		let n = new Option(node.text);
		$(n).html(node.text);
		$(divView).append(n);
	})
	$(treeEx).jstree('get_bottom_selected', true).forEach(node => {
		let n = new Option(node.text);
		$(n).html(node.text);
		$(divNotView).append(n);
	})
}

function confirmSelection(suffix) {
	$('#confirm_y' + suffix).hide()
	$('#confirm_n' + suffix).hide()
	$('#other_parameters' + suffix).show()
	$('#submitbtn' + suffix).show()
}

function resetSelection(suffix) {
	$('#list_selection' + suffix).hide()
	$("#ShowIN" + suffix).hide();
	$("#ShowNOTIN" + suffix).hide();
	$('#tree').show();
	$("#submit_trees" + suffix).show();
	$("#reset_trees" + suffix).show();
	clearListView(suffix)
}

function clearListView(suffix) {
	let length_in = document.getElementById('InView' + suffix).options.length
	let length_notin = document.getElementById('NotInView' + suffix).options.length
	for (i = 0; i < length_in; i++) {
		document.getElementById('InView' + suffix).options[0].remove()
	}
	for (j = 0; j < length_notin; j++) {
		document.getElementById('NotInView' + suffix).options[0].remove()
	}
}

// *********************************************
//            *  SUBMIT PARAMETERS *
// *********************************************
function submitSetupAllGenome() {
	$('#Tabselection').hide()
	$('#allg_tips').hide()
	$('#list_selection').hide()
	$('#other_parameters').hide()

	$('#Waiting').show()
	socket.emit('submitAllGenomes', {
		"gi": $("#tree_include").jstree('get_bottom_selected', true).map(node => node.original.genome_uuid),
		"gni": $("#tree_exclude").jstree('get_bottom_selected', true).map(node => node.original.genome_uuid),
		"pam": $("select[name='pam_AllG'] > option:selected").val(),
		"sgrna_length": $("select[name='sgrna-length_AllG'] > option:selected").val()
	});

}

function submitSpecificGene(n_gene, percent_id, pam, sgrna_length) {
	$("#Tabselection").hide();

	$('#spec_tips').hide();
	$('#ShowSeq').hide();
	$('#tree_sg').hide()
	$('#list_selection_sg').hide();
	$('#other_parameters_sg').hide();
	$('#Waiting').show();


	socket.emit("submitSpecific", {
		"seq": final_sequence,
		"gi": $("#tree_include_sg").jstree('get_bottom_selected', true).map(node => node.original.genome_uuid),
		"gni": $("#tree_exclude_sg").jstree('get_bottom_selected', true).map(node => node.original.genome_uuid),
		"n": n_gene,
		"pid": percent_id,
		"pam": pam,
		"sgrna_length": sgrna_length
	});

}

function error_gestion(n_gene, percent_id, pam, sgrna_length) {
	var errors = false
	try {
		if (n_gene == '') throw "format error";
		else if (n_gene < 0) throw "can't be negative";
		else if (n_gene > 0 && n_gene <= parseInt(sgrna_length) + parseInt(pam.length)) throw "can't be smaller than sgRNA length"
		else if (n_gene >= final_sequence.length) throw "can't be larger than sequence length"
	}
	catch (err) {
		$('a[name=error-n]').show()
		$('a[name=error-n]').html(err)
		errors = true
	}

	try {
		if (percent_id == '') throw "format error";
		else if (percent_id < 0 || percent_id > 100) throw "must be between 0 and 100";
	}
	catch (err) {
		$('a[name=error-pid]').show()
		$('a[name=error-pid]').html(err)
		errors = true
	}
	return errors
}

function setupAll() {
	$('#footer').hide()
	$('#allg_tips').hide()
	$('#AG_click').show()
	$('#AG_click2').hide()
	$('#tree').hide()
	$('#SG_click').show()
	$('#SG_click2').hide()
	$('#spec_tips').hide()

	$('#list_selection_sg').hide()
	$('#Sequenceupload').hide()
	$('#tree_sg').hide()
	$('#list_selection').hide()

	$('#next').hide()
	$('#other_parameters_sg').hide()
	$('#ShowSeq').hide()
	displayTree('', '#search_in', '#tree_include')
	displayTree('', '#search_notin', '#tree_exclude')
	displayTree('_sg', '#search_in', '#tree_include')
	displayTree('_sg', '#search_notin', '#tree_exclude')
}

function setupAllGenome() {
	$('#footer').show()
	$('#allg_tips').show()
	$('#AG_click').show()
	$('#AG_click2').hide()
	$('#tree').show()
	$('#SG_click').hide()
	$('#SG_click2').show()
	$('#spec_tips').hide()
	$('#other_parameters').hide()

	$('#submit_trees').show()
	$('#reset_trees').show()
	$('#search_in').val('')
	$('#search_notin').val('')
}

function setupSpecificGene() {
	$("#search-region").val('0')
	$("#percent-identity").val('70')
	$("select[name='pam'] > option:selected").val('NGG');
	$("select[name='sgrna-length'] > option:selected").val('20');

	$('#footer').show()
	$('#allg_tips').hide()
	$('#AG_click').hide()
	$('#AG_click2').show()
	$('#tree').hide()
	$('#SG_click').show()
	$('#SG_click2').hide()
	$('#spec_tips').show()
	$('#other_parameters').hide()

	$('#other_parameters_sg').hide()
	$('#Sequenceupload').show()
	$('#seq').val('')
	$('#next').show()
	$('a[name=error-n]').hide()
	$('a[name=error-pid]').hide()
}


// *********************************************
//                 *  MAIN *
// *********************************************
$(document).ready(function () {
	setupAll()

	$('#AG_click').click(function () {
		setupAll()
		setupAllGenome()
		resetTree('')
	})

	$('#AG_click2').click(function () {
		setupAll()
		setupAllGenome()
		resetTree('')
	})
	//  TREE
	$('#tree_include').on("changed.jstree", () => {
		selectOntree("#tree_include", "#tree_exclude", "j1", "j2")
	})

	$('#tree_exclude').on("changed.jstree", () => {	// replace changed for onclicked like below
		selectOntree("#tree_exclude", "#tree_include", "j2", "j1")
	})

	$('#tree_include_sg').on("changed.jstree", () => {
		selectOntree('#tree_include_sg', '#tree_exclude_sg', 'j3', 'j4')

	})

	$('#tree_exclude_sg').on("changed.jstree", () => {
		selectOntree('#tree_exclude_sg', '#tree_include_sg', 'j4', 'j3')

	})

	$('#reset_trees').click(function () {
		resetTree('')
	})

	$('#submit_trees').click(function () {
		submitTree("#tree_include", false)
	})

	$('#confirm_y').click(function () {
		confirmSelection('')
	})

	$('#confirm_n').click(function () {
		resetSelection('')
	})

	$('#submitbtn').click(function () {
		submitSetupAllGenome()
	})


	$('#SG_click').click(function () {
		setupAll()
		setupSpecificGene()
	})

	$('#SG_click2').click(function () {
		setupAll()
		setupSpecificGene()
	})

	$('#load-file').click(treatFastaFile)

	$('#next').click(function () {
		displaySequence()
	})

	$('#reset_trees_sg').click(function () {
		resetTree('_sg')
	})

	$('#submit_trees_sg').click(() => submitTree("#tree_include_sg", true))

	$('#confirm_y_sg').click(function () {
		confirmSelection('_sg')
	})

	$('#confirm_n_sg').click(function () {
		resetSelection('_sg')
	})


	$('#submitbtn_sg').click(function () {
		let n_gene = $("#search-region").val()
		let percent_id = $("#percent-identity").val()
		let pam = $("select[name='pam'] > option:selected").val();
		let sgrna_length = $("select[name='sgrna-length'] > option:selected").val();
		if (error_gestion(n_gene, percent_id, pam, sgrna_length) == true) {
			window.alert('Error(s) in parameters')
		}
		else {
			submitSpecificGene(n_gene, percent_id, pam, sgrna_length)
		}

	})
})

function reloadpage() {
	location.reload();
}
