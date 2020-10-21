import { rejects } from "assert";

const Email = require('email-templates');
const nodemailer = require('nodemailer');
var ejs = require('ejs');
const logger = require("./logger").logger;
const utils = require("util");
let user, pass = null;
let ibcpTransporter;
let authorBot = 'cstb@ibcp.fr';
const support_mail = 'cstb-support@ibcp.fr'

export type job_status = "complete" | "error"

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

function generateText(jobKey:string, status:job_status): string{
  let text = `Dear user, \n\n Your job ${jobKey} `
  if(status == "complete"){
    logger.info("generateText status complete")
    text = text + `is completed. \n You can access your results by following this link : http://crispr-dev.ibcp.fr:/results/${jobKey}`
  }
  else if(status == "error"){
    logger.info("generateText status error")
    text = text + "ends with error. An email has automatically been send to support."
  }

  text = text + "\n\n\t\t\tThe CSTB Service.\n***This is an automatically generated email, please do not reply***"
  return text
}

export function sendSupport(jobKey:string, user_mail:string|undefined){
  const data = { key : jobKey};
  const subject = ejs.render('[SUPPORT] CSTB job <%= key %> error', data);
  const text = `The job ${jobKey} ends with an error.\nUser email : ${user_mail ? user_mail : "not provided"}\n\n**Automatic email***`
  const options = {
    from: authorBot,
    replyTo: authorBot,
    to: support_mail,
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
      }
    );
  })

}

export function send(address:string, jobKey:string, status:job_status){
    let data = { key : jobKey};
                
    let subject = ejs.render('CSTB job <%= key %> ' + status, data);

    const text = generateText(jobKey, status); 
  
    let options = {
      from: authorBot,
      replyTo: authorBot,
      to: address,
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


    