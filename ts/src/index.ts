const express = require('express');
const path = require('path');
const utils = require('util');
const app = express();
const http = require('http').Server(app);
const _io = require('socket.io')(http);
const program = require("commander");
const logger = require("./logger").logger;
const setLogLevel = require("./logger").setLogLevel;
const setLogFile = require("./logger").setLogFile;
const fs = require("fs")
const mailManager = require("./mailManager")
const jobManager = require('ms-jobmanager');
const jsonfile = require('jsonfile'); 
import {SearchFn} from 'fs-search-worker'; 

const APP_PORT = 3002;
const JM_ADRESS = "127.0.0.1";

export interface Config {
    couch_endpoint: string; 
    name_treedb: string; 
    name_taxondb: string; 
    name_genomedb : string; 
    coreScriptsFolder: string; 
    blastdb: string; 
    dataFolder: string; 
    motif_broker_endpoint: string;
    jm_cache_dir:string;  
    profile:string; 
}

function parseData(string_data:string) : [boolean, string | any] {
    let ans = {"data" : undefined};
    let buffer:any
    try {
        buffer = JSON.parse(string_data);
    } catch (e) {
        return [false, "Can't parse sbatch output"];
    }

    if (buffer.hasOwnProperty("emptySearch")) {
        logger.info(`JOB completed-- empty search\n${utils.format(buffer.emptySearch)}`);
        ans.data = ["Search yielded no results.", buffer.emptySearch];
        return [true, ans];
    }
    else if (buffer.hasOwnProperty("error")){
        logger.info(`JOB completed-- handled error\n${utils.format(buffer.error)}`)
        return [false, buffer.error];
    } else {
        logger.info(`JOB completed-- Found stuff`);
        //logger.info(`${utils.inspect(buffer, false, null)}`);
        let res = buffer;
        ans.data = [res.data, res.not_in,  res.tag, res.number_hits, res.data_card, res.gi, res.number_treated_hits, res.fasta_metadata, res.gene];
        return [true, ans]; 
    }
}


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

const JM_PORT:number = parseInt(program.port);
const param:Config = jsonfile.readFileSync(program.conf);
//TO DO : Some type checking

const CACHE:string = param.jm_cache_dir

mailManager.configure()
jobManager.start({ 'port': JM_PORT, 'TCPip': JM_ADRESS })
    .on('ready', () => {
        logger.info("Starting web server");
        
app.use(express.static( path.join(__dirname, '../data/static') ));
app.use(express.static( path.join(__dirname, '../node_modules') ));

//Still working ??? Don't think so
app.get('/kill/:jobid',  (req, res) => {
    let jobOptTest = {
        "jobProfile" : param.profile, 
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

app.get('/download/:job_id', (req, res) => {
    logger.info(`==>tmp/${req.params.job_id}`);
    let _path = `${CACHE}/${req.params.job_id}/${req.params.job_id}_results.tsv`;
    res.download(_path);
});

app.get('/results/download/:job_id', (req, res) => {
    let _path = `${CACHE}/${req.params.job_id}/${req.params.job_id}_results.tsv`;
    res.download(_path);
});

app.get('/results/:job_id', (req, res) => {
    logger.info("Restore results")
    res.sendFile(path.join(__dirname, "../data/static", "restore.html"));
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
        //const file = fs.readFileSync(`${CACHE}/${job_key}/${job_key}.out`)
        const searched_files = SearchFn(`${job_key}.out`, CACHE)
        searched_files.then((finded) => {
            //What to do if more than one file ? 
            const file = fs.readFileSync(finded[0][0])
            const [status, answer] = parseData(file); 
            if (status) socket.emit("displayResults", answer);
            else socket.emit("workflowError", answer);
        }, (error) => {
            if (error == "not found") socket.emit("restoreNotFound", job_key); 
            else socket.emit("unknownError"); 
        });
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
            "jobProfile" : param.profile,
            "script" : `${param.coreScriptsFolder}/crispr_workflow_specific.sh`,
            "sysSettingsKey" : param.profile
        };

        logger.info(`Trying to push ${utils.format(jobOpt)}`);

        let job = jobManager.push(jobOpt);

        job.on("completed",(stdout, stderr) => {
            //send email
            let _buffer = "";
            stdout.on('data',(d)=>{_buffer += d.toString();})
            .on('end',() => {
                const [status, answer] = parseData(_buffer)
                if(status) {
                    socket.emit("resultsSpecific", answer)
                    if (data.email){
                        mailManager.send(data.email, answer.data[2])
                            .then(() => logger.info("mail send"))
                            .catch((e) => logger.error("error while sending mail"))
                    }
                        
                }
                else socket.emit("workflowError", answer)                                      
            });
        });
        job.on("lostJob", ()=>  {
            logger.error(`Job lost ${job.id} replying to web client`);
            socket.emit('workflowError', 'Job has been lost') ;
        });
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
            "jobProfile" : param.profile,
            "script" : `${param.coreScriptsFolder}/crispr_workflow.sh`,
            "sysSettingsKey" : param.profile
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
                                mailManager.send(data.email, answer.data[2])
                                    .then(() => logger.info("mail send"))
                                    .catch((e) => {
                                        logger.error("error while sending mail")
                                        if (e.message === "No recipients defined"){
                                            //warn client
                                        }
                                        })
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