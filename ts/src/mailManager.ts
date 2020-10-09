const Email = require('email-templates');
const nodemailer = require('nodemailer');
var ejs = require('ejs');
const logger = require("./logger").logger;
const utils = require("util");
let user, pass = null;
let ibcpTransporter;
let authorBot = 'cstb@ibcp.fr';

export function configure(opt):void{
    ibcpTransporter = nodemailer.createTransport({
        host: 'smtp.ibcp.fr',
        port: 587,
        secure: false // true for 465, false for other ports
       /* ,auth: {
          user: user,
          pass: pass 
        }*/,
        tls: {
        // do not fail on invalid certs
          rejectUnauthorized: false
        }
      });
}

export function send(adress:string, jobKey:string){
    let data = { key : jobKey};

  
    let text = 'Dear user,\n\nYour job ' + jobKey + ' is completed.\n'
              + 'You can access your results by following this link : http://crispr-dev.ibcp.fr:/results/' + jobKey + '\n\n\t\t\tThe CSTB Service.\n'
              + '***This is an automatically generated email, please do not reply';
    let subject = ejs.render('CSTB job <%= key %> completed', data);
  
  
    let options = {
      from: authorBot,
      replyTo: authorBot,
      to: adress,
      subject: subject,
      text: text
    };
  
    return new Promise((resolve, reject) => {
      ibcpTransporter.sendMail(options, 
        (err, info)=> {
          if(err){
            reject(err)
          }
          else resolve(); 
          //console.log(info.envelope);
          //console.log(info.message.Id);
        }
      );
    })
    
        
  }


    