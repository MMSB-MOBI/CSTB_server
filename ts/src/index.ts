let express = require('express');
const path = require('path');
let app = express();
let utils = require('util');
let http = require('http').Server(app);
let _io = require('socket.io')(http);

const program = require("commander");
const logger = require("./logger").logger;
const setLogLevel = require("./logger").setLogLevel;
const setLogFile = require("./logger").setLogFile;
const fs = require("fs")
let mailManager = require("./mailManager")

import jsonfile = require('jsonfile');
import { Socket } from 'dgram';

let APP_PORT = 3002;
let CACHE = "/data/dev/crispr/tmp";
//let DATA_FOLDER = "/data/databases/mobi/crispr/reference_genomes";

const STATICDIR = "/data/www_dev/crispr/lib/nCSTB/data/static"

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

function parseData(string_data:string) : [boolean, string | any] {
    let ans = {"data" : undefined};
    let buffer:any
    try {
        buffer = JSON.parse(string_data);
    } catch (e) {
        return [false, "Can't parse sbatch output"];
    }

    if (buffer.hasOwnProperty("emptySearch")) {
        logger.info(`JOB completed-- empty search\n${utils.format(buffer.emptySearch)}`);
        ans.data = ["Search yielded no results.", buffer.emptySearch];
        return [true, ans];
    }
    else if (buffer.hasOwnProperty("error")){
        logger.info(`JOB completed-- handled error\n${utils.format(buffer.error)}`)
        return [false, buffer.error];
    } else {
        logger.info(`JOB completed-- Found stuff`);
        logger.info(`${utils.inspect(buffer, false, null)}`);
        let res = buffer;
        ans.data = [res.data, res.not_in,  res.tag, res.number_hits, res.data_card, res.gi, res.number_treated_hits, res.fasta_metadata, res.gene];
        return [true, ans]; 
    }
}


mailManager.configure()
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

app.get('/results/:job_id', (req, res) => {
    logger.info("Restore results")
    //res.send(`${req.params.job_id} results`)
    res.sendFile(`${STATICDIR}/restore.html`);
   //emit restore (job_id, directory)
});


/*
    Socket management
*/
http.listen(APP_PORT,()=>{
    logger.info(`Listening on port ${APP_PORT}`);
});

_io.on('connection', (socket)=>{
    logger.info('connection')

    //socket on restored data (stdout)
    //emit results

    socket.on("restoreResults", (job_key) =>{
        logger.info("restoreResults server")
        const file = fs.readFileSync(`${CACHE}/${job_key}/${job_key}.out`)
        const [status, answer] = parseData(file); 
        if(status) {
            socket.emit("displayResults", answer)
        }
        else{
            socket.emit("workflowError", answer)
        }

    });

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
            //send email
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
                    logger.info(typeof _buffer)
                    logger.info(_buffer)
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
                        const [status, answer] = parseData(_buffer)
                        
                        if(status) {
                            socket.emit("resultsAllGenomes", answer)
                            
                            if (data.email){
                                logger.info("Send email")
                                mailManager.send(data.email, answer.data[2])
                            }
                            
                        }
                        else{
                            socket.emit("workflowError", answer)
                        }
                    });
        
        });
        job.on("lostJob", ()=> socket.emit('workflowError', 'Job has been lost'));
        
    });

    }); // io closure

}); // jm closure