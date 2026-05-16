const { Command } = require('commander');
const http = require('http');
const fs = require('fs'); 
const fsPromises = require('fs').promises; 
const { XMLBuilder } = require('fast-xml-parser');

const program = new Command();

program
  .helpOption('-e, --help')
  .option('-i, --input <path>')
  .option('-h, --host <address>')
  .option('-p, --port <number>');

program.parse(process.argv);
const options = program.opts();

if (!options.input) {
  console.error("Please, specify the input file");
  process.exit(1);
}

if (!options.host) {
  console.error("Please, specify the server host");
  process.exit(1);
}

if (!options.port) {
  console.error("Please, specify the server port");
  process.exit(1);
}

if (!fs.existsSync(options.input)) {
  console.error("Cannot find input file");
  process.exit(1);
}

const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
});

const server = http.createServer(async (req, res) => {
    try {
        const rawData = await fsPromises.readFile(options.input, 'utf-8');
        const banks = JSON.parse(rawData);

        const reqUrl = new URL(req.url, `http://${options.host}:${options.port}`);
        const isMfoRequested = reqUrl.searchParams.get('mfo') === 'true';
        const isNormalRequested = reqUrl.searchParams.get('normal') === 'true';

        const resultItems = [];

        banks.forEach(bank => {
            if (isNormalRequested && bank.COD_STATE != 1) {
                return; 
            }

            let bankData = {};
            if (isMfoRequested && bank.MFO) {
                bankData.MFO = bank.MFO;
            }

            bankData.NAME = bank.N_K || bank.NAME || bank.SHORTNAME || "Unknown name";
            bankData.COD_STATE = bank.COD_STATE;

            resultItems.push(bankData);
        });

        const xmlObj = {
            root: {
                bank: resultItems
            }
        };

        const xmlContent = builder.build(xmlObj);

        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
        res.end(xmlContent);

    } catch (error) {
        console.error("Error processing request:", error.message);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end("Internal Server Error");
    }
});

server.listen(options.port, options.host, () => {
    console.log(`Server is listening on http://${options.host}:${options.port}`);
});