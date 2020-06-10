CSTB server and part of the web interface (interrogation page) 


### Initialization 
```
npm i
tsc
```

### Launch server 
```
node build/index.js -p 1234 -c config.json
Options:
  -V, --version               output the version number
  -v, --verbosity [logLevel]  Set log level (default: "info")
  -p, --port [TCP_PORT]       Job Manager socket
  -c, --conf [JSON_PARAM]     web service configuration file
  -h, --help                  output usage information
```

`config.json` example : 
```
{
	"author" : "GL",
	"revision" : "23/07/2019",
	"comments" : "These are variables required by the webservice, which cant be included in modules",
	"blastdb" : "/data/databases/mobi/crispr_rc02/blast/blast",
	"dataFolder" : "/data/databases/mobi/crispr_rc02/index_twobits",
	"motif_broker_endpoint" : "http://192.168.117.151:2346",
	"name_taxondb" : "rc02_taxon",
	"name_treedb" : "rc02_tree",
	"couch_endpoint" : "http://arwen-cdb.ibcp.fr:5984/",
	"coreScriptsFolder" : "/data/software/mobi/crispr-prod/2.0.0/CSTB/scripts",
	"name_genomedb" : "rc02_genome"
}
```

This server serve a static interrogation page (data/static/) and a [result page](https://github.com/MMSB-MOBI/result_page_crispr) which is a Stencil component.   
It configures the [job manager](https://github.com/glaunay/ms-jobmanager) and launch jobs on cluster from client request, and then display jobs results.  
It has to have access to CSTB couch database. See [CSTB_database_manager](https://github.com/MMSB-MOBI/CSTB_database_manager) for database description and creation.   
