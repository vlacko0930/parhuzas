const { exit } = require('process');

/*check the envvars*/
let envvarsCorrect = true;
["SMTP_USER", "SMTP_FROM", "SMTP_HOST", "SMTP_PORT", "SMTP_PASS", "FILENAME", "GROUPSIZE"]
    .forEach((envvar) => {
        if (process.env[envvar] === undefined) {
            console.log(envvar + " missing!");
            envvarsCorrect = false;
        }
    })
if (!envvarsCorrect) {
    console.log("MISSING ENVVARS! TERMINATING!");
    process.exit(1);
}
if (isNaN(process.env.GROUPSIZE) || process.env.GROUPSIZE % 1 != 0) {
    console.log("GROUPSIZE IS NOT INT! TERMINATING")
    exit(1);
}

const events = require('events');
const fs = require('fs');
const readline = require('readline');

/*email*/
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    pool: true,
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: !(Boolean(process.env.SMTP_TLS_SELFSIGNED) || false)
    }
});
/*main*/
processLineByLine();

function processLineByLine() {

    return new Promise(async (success, failed) => {
        try {
            const people = [];  //array of people
            const rl = readline.createInterface({ //filereader
                input: fs.createReadStream(process.env["FILENAME"]),
                crlfDelay: Infinity
            });
            var firstline = true;
            rl.on('line', async (line) => {
                if (firstline) { //slip the first (header) line
                    firstline = false;
                    return;
                }
                const separatedLine = line.split(';'); //separate the columns
                people.push({ //add person to the array
                    name: separatedLine[0], //first attribute is name
                    email: separatedLine[1], //second attrubite is email
                    isGrouped: false //default person is not in a group
                })
            });
            await events.once(rl, 'close'); //wait for read all people

            if (people.length % process.env["GROUPSIZE"] != 0) { //remainder check
                console.log("People cannot be grouped without a remainder!");
                exit(1);
                return;
            }
            var groups = []; //array of groups
            for (var i = 0; i < people.length / process.env["GROUPSIZE"]; i++) { //set all of group
                groups[i] = []; //a group is an array of people
                for (var s = 0; s < process.env["GROUPSIZE"]; s++) {
                    var random = Math.floor(Math.random() * people.length); //choose a person
                    while (people[random].isGrouped) { //while person is in a group
                        random = Math.floor(Math.random() * people.length); //choose other person
                    }
                    people[random].isGrouped = true; //person is in a group
                    groups[i].push(people[random]); //put person to the group
                }
            }
            for (var i=0; i < groups.length; i++) { //iterate on all of the group and send the email
                await new Promise((ok, notOk) => {
                transporter.sendMail({
                    from: process.env["SMTP_FROM"],
                    to: groups[i].map(e => {return `"${e.name}" <${e.email}>`}).join(', '),
                    subject: "Your group",
                    text: 
`Hello,
The members of your team: ${groups[i].map(e => {return e.name}).join(', ')}
`
                }
                    , (error, info) => {
                        console.log("EMAIL SENT!")
                        if (error) {
                            console.error(error);
                            notOk();
                        }
                        else ok();
                    })});
            }
            success();
            exit(0)
            return;
        } catch (err) {
            failed(err);
        }
    })
}
