let express = require('express');
let app = express();
let utils = require('util');
let http = require('http').Server(app);

let _io = require('socket.io')(http);

const program = require("commander");
const logger = require("./logger").logger;
const setLogLevel = require("./logger").setLogLevel;
const setLogFile = require("./logger").setLogFile;

import jsonfile = require('jsonfile');

let APP_PORT = 3002;
//let OLD_CACHE = "/data/dev/crispr/tmp";
//let DATA_FOLDER = "/data/databases/mobi/crispr/reference_genomes";

let jobManager = require('ms-jobmanager');

let JM_ADRESS = "127.0.0.1";
let JM_PORT = undefined;



program
.version('0.1.0')
.option('-v, --verbosity [logLevel]', 'Set log level', setLogLevel, 'info')
.option('-p, --port [TCP_PORT]', 'Job Manager socket')
.option('-c, --conf [JSON_PARAM]', 'web service configuration file')
.parse(process.argv);

if (!program.port)
    throw (`Please specify a port`);
if (!program.conf)
    throw (`Please specify a conf`);

let param = jsonfile.readFileSync(program.conf);

JM_PORT = parseInt(program.port);
jobManager.start({ 'port': JM_PORT, 'TCPip': JM_ADRESS })
    .on('ready', () => {
        logger.info("Starting web server");
app.use(express.static('data/static'));
app.use(express.static('node_modules'));

app.get('/kill/:jobid',  (req, res) => {
    let jobOptTest = {
        "jobProfile" : "crispr-dev",
        "cmd" : `scancel ${req.params.jobid}`
    };
    logger.info(`Trying to execute ${utils.format(jobOptTest)}`);

    let jobTest = jobManager.push(jobOptTest);
    jobTest.on("completed",(stdout, stderr) => {
        logger.info(`JOB completed\n${utils.format()}`);
        stdout.on('data',(d)=>{
            logger.info(`${ d.toString() }`);
            res.send(d.toString());
        });
    });
});

app.get('/tree', (req, res) => {
  var nano= require('nano')(param.couch_endpoint);
  nano.request({db:param.name_treedb, doc:"maxi_tree"}, (err, data) => {
   

    try {
        res.json(data.tree);
    } catch (e) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
  })
})

app.get('/test', function (req, res) {
    res.send('Performing test');
   // logger.info(__dirname);
    let jobOptTest = {
        "exportVar" : {
            "rfg" : param.dataFolder,
            "gi" : "Candidatus Blochmannia vafer str. BVAF GCF_000185985.2&Enterobacter sp. 638 GCF_000016325.1",
            "gni" : "\"\"",
            "pam" : "NGG",
            "sl" : "20",
            "URL_CRISPR" : param.url_vService
            /*,
            "HTTP_PROXY" : "",
            "https_proxy" : "",
            "HTTPS_PROXY" : ""*/
        },
        "modules" : ["crispr-tools", "pycouch"],
        "jobProfile" : "crispr-dev",
        "script" : `${param.coreScriptsFolder}/crispr_workflow.sh`
    };
    logger.info(`Trying to push ${utils.format(jobOptTest)}`);

    let jobTest = jobManager.push(jobOptTest);
    jobTest.on("completed",(stdout, stderr) => {
        logger.info(`JOB completed\n${utils.format()}`);

        stdout.on('data',(d)=>{logger.info(`${ d.toString() }`);});

    });
})


app.get('/download/:job_id', (req, res) => {
    logger.info(`==>tmp/${req.params.job_id}`);
    let _path = `/data/dev/crispr/tmp/${req.params.job_id}/${req.params.job_id}_results.tsv`;
    res.download(_path);
});

app.get('/test_pycouch', (req,res) => {
        let jobOpt = {
            "exportVar" : {
                "COUCH_ENDPOINT": param.couch_endpoint
            },
            "modules" : ["crispr-prod"],
            "jobProfile" : "crispr-dev",
            "script" : `${param.coreScriptsFolder}/test_pycouch.sh`
        };
        logger.info(`Trying to push ${utils.format(jobOpt)}`);

        let job = jobManager.push(jobOpt);
        job.on("ready", () => {
            res.send(job.id);
            logger.info(`JOB ${job.id} sumitted`);

        });
})


/*
    Socket management
*/
http.listen(APP_PORT,()=>{
    logger.info(`Listening on port ${APP_PORT}`);
});
_io.on('connection', (socket)=>{
    logger.info('connection')

    socket.on("submitSpecific", (data) =>{
       // let x = data.seq;
        logger.info(`socket:submitSpecificGene\n${utils.format(data)}`);

        logger.info(`included genomes:\n${utils.format(data.gi)}`);
        logger.info(`excluded genomes:\n${utils.format(data.gni)}`);
        logger.info(`${utils.format(data.pam)}`);
        logger.info(`Length of motif: ${utils.format(data.sgrna_length)}`);
        logger.info(`Query : ${utils.format(data.seq)}`);

        let jobOpt = {
            "exportVar" : {
		        "blastdb" : param.blastdb,
                "rfg" : param.dataFolder,
                "gi" : data.gi.join('&'),
                "gni" : data.gni.join('&'),
                "pam" : data.pam,
                "sl" : data.sgrna_length,
                "MOTIF_BROKER_ENDPOINT" : param.motif_broker_endpoint,
                "NAME_TAXON" : param.name_taxondb,
                "NAME_GENOME" : param.name_genomedb,
                "seq" : data.seq,
                "n"   : data.n,
                "pid" : data.pid, 
                "COUCH_ENDPOINT": param.couch_endpoint

            },
            "modules" : ["crispr-prod/3.0.0", "blast+"],
            "jobProfile" : "crispr-dev",
            "script" : `${param.coreScriptsFolder}/crispr_workflow_specific.sh`,
            "sysSettingsKey" : "crispr-dev"
        };

        logger.info(`Trying to push ${utils.format(jobOpt)}`);

        let job = jobManager.push(jobOpt);
        job.on("completed",(stdout, stderr) => {
            
            let _buffer = "";
            stdout.on('data',(d)=>{_buffer += d.toString();})
            .on('end',() => {
                let ans = {"data" : undefined};
                let buffer:any
                try {
                    buffer = JSON.parse(_buffer);
                } catch (e) {
                    socket.emit('workflowError', "Can't parse sbatch output");
                    return;
                }

                if (buffer.hasOwnProperty("emptySearch")) {
                    logger.info(`JOB completed-- empty search\n${utils.format(buffer.emptySearch)}`);
                    ans.data = ["Search yielded no results.", buffer.emptySearch];
                    socket.emit('resultsSpecific', ans);
                }
                else if (buffer.hasOwnProperty("error")){
                    logger.info(`JOB completed-- handled error\n${utils.format(buffer.error)}`)
                    socket.emit('workflowError', buffer.error)
                } else {
                    logger.info(`JOB completed-- Found stuff`);
                    logger.info(`${utils.inspect(buffer, false, null)}`);
                    let res = buffer;
                    ans.data = [res.data, res.not_in,  res.tag, res.number_hits, res.data_card, res.gi, res.number_treated_hits, res.fasta_metadata, res.gene];
                    socket.emit('resultsSpecific', ans);
                }
                
            });
        });
        job.on("lostJob", ()=> socket.emit('workflowError', 'Job has been lost'));
    });

    socket.on('submitAllGenomes', (data)=> {
        logger.info(`socket:submitAllGenomes\n${utils.format(data)}`);

        logger.info(`included genomes:\n${utils.format(data.gi)}`);
        logger.info(`excluded genomes:\n${utils.format(data.gni)}`);
        logger.info(`${utils.format(data.pam)}`);
        logger.info(`Length of motif: ${utils.format(data.sgrna_length)}`);

        let jobOpt = {
            "exportVar" : {
                "rfg" : param.dataFolder,
                "gi" : data.gi.join('&'),
                "gni" : data.gni.join('&'),
                "pam" : data.pam,
                "sl" : data.sgrna_length,
                "MOTIF_BROKER_ENDPOINT" : param.motif_broker_endpoint,
                "NAME_TAXON" : param.name_taxondb,
                "NAME_GENOME" : param.name_genomedb,
                "COUCH_ENDPOINT": param.couch_endpoint
            },
            "modules" : ["crispr-prod/3.0.0"],
            "jobProfile" : "crispr-dev",
            "script" : `${param.coreScriptsFolder}/crispr_workflow.sh`,
            "sysSettingsKey" : "crispr-dev"
        };
        logger.info(`Trying to push ${utils.format(jobOpt)}`);

        let job = jobManager.push(jobOpt);
        job.on("ready", () => {
            logger.info(`JOB ${job.id} sumitted`);
            socket.emit("submitted", { "id" : job.id });
        });

        job.on("completed",(stdout, stderr) => {
            let _buffer = "";
            stdout.on('data',(d)=>{_buffer += d.toString();})
                    .on('end',() => {
                        let buffer:any;
                        try {
                            buffer = JSON.parse(_buffer);
                        } catch (e) {
                            socket.emit('resultsAllGenomes', {"data": ["An error occured", "Please contact sys admin"]});
                            return;
                        }
                        // JSON Parsing successfull
                        let ans = {"data" : undefined};
                        if (buffer.hasOwnProperty("emptySearch")) {
                            logger.info(`JOB completed-- empty search\n${utils.format(buffer.emptySearch)}`);
                            ans.data = ["Search yielded no results.", buffer.emptySearch];
                            socket.emit('resultsAllGenomes', ans);
                        }
                        else if (buffer.hasOwnProperty("error")){
                            logger.info(`JOB completed-- handled error\n${utils.format(buffer.error)}`)
                            socket.emit('workflowError', buffer.error)
                        } else {
                            let res = buffer;
                            logger.info(`JOB completed\n${utils.format(buffer)}`);
                        //   ans.data = [res.data, res.not_int,  res.tag, res.number_hits];
                            ans.data = [res.data, res.not_in,  res.tag, res.number_hits, res.data_card, res.gi, res.number_treated_hits, res.fasta_metadata];
                            socket.emit('resultsAllGenomes', ans);
                        }
                        
                    });
        
        });
        job.on("lostJob", ()=> socket.emit('workflowError', 'Job has been lost'));
        
    });

    }); // io closure

}); // jm closure