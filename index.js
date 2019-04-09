#!/usr/bin/env node

const os = require('os')
const fs = require('fs')
const program = require('commander')
const express = require('express')
const app = express()
const bsv = require('bsv')
const ElectrumCli = require('electrum-client')
const MimeLookup = require('mime-lookup')
const mime = new MimeLookup(require('mime-db'))
const txidReg = new RegExp('^[0-9a-fA-F]{64}$')
const version = require('./package.json').version

var serverpool = [
    'electrumx.bitcoinsv.io:50002',
    'sv.satoshi.io:50002',
    'sv2.satoshi.io:50002',
    'sv.electrumx.cash:50002'
]

program
    .command('test')
    .description('Test if MiniGate is working on ElectrumX')
    .action(test)

program
    .command('start')
    .description('Start MiniGate.')
    .action(test)

program
    .command('clean')
    .description('Clean cache.')
    .action(cleanCache)

program
    .version(version)
    .option('-e, --electrumX [electrumXServer]', 'Specify a ElectrumX Server')
    .option('-p, --port [port]', 'Specify port minigate should listen on', 8000)
    .option('-c, --cache [true/false]', 'Enable local TX cache', true)

program
    .parse(process.argv);

var eclreuse = null
var curHost = ""
var curPort = ""

function getCliFromPool(){
    if(eclreuse!=null)return (async()=>{return eclreuse})()
    // get the fastest server
    else return Promise.race(serverpool.map(server=>{
        var esHost = server.split(':')[0]
        var esPort = parseInt(server.split(':')[1])
        var ecl = new ElectrumCli(esPort, esHost, 'tls')
        return ecl.connect().then(()=>{
            return ecl
        })
    })).then((ecl)=>{
        curHost = ecl.host
        curPort = ecl.port
        eclreuse = ecl
        ecl.onClose = ()=>{
            console.log("Presisted Connection to ElectrumX Server Closed.")
            eclreuse = null
        }
        return ecl.server_version(`MiniGate v${version}`, "1.4").then(()=>{
            return ecl.serverDonation_address().then(address=>{
                console.log("Presisted Connection to ElectrumX Server Established.")
                console.log(`  ElectrumX Server Connected: ${curHost + ":" + curPort}`)
                console.log(`  ElectrumX Server Donations: ${ address }`)
                console.log(`You can help electrumX server staying alive by making a donation to it.\n`)
            })
        }).then(()=>{
            return ecl
        })
    })
}

function test(){
    if(program.electrumX){
        serverpool = [ program.electrumX ]
    }
    console.log("Testing if minigate can connect to electrumX server...")
    var ecl = null
    getCliFromPool().then(result=>{
        ecl = result
        return ecl.connect()
    }).then(()=>{
        console.log(`  ElectrumX Server Connected: ${curHost + ":" + curPort}`)
        console.log("Nice! MiniGate is working.")
        ecl.close()
    }).catch(e=>{
        console.log(e)
        console.log("Cannot connect to electrumX server.")
        console.log("You should specify a electrumX server.")
        console.log("  minigate [start|test] -e [ElectrumX Server Address:Port]")
        if(ecl)ecl.close()
    }).then(()=>{
        process.exit()
    })
}

function start(){
    if(program.electrumX){
        serverpool = [ program.electrumX ]
    }
    app.get('/', (req, res) => res.send('MiniGate Online'))
    app.get('/:txid', (req, res) => {
        var txid = req.params.txid.split('.')[0]
        if(!txidReg.test(txid)) {
            res.status(404)
            return res.send("MiniGate Error: Not A Valid TXID")
        }

        var fetchedTX = null
        var ecl = null
        
        // check if tx cached
        if(program.cache){
            var cachedTX = getCache(txid)
            if(cachedTX){
                console.log("Cache matched " + txid)
                fetchedTX = (async()=>{return cachedTX})()
            }
        }
        
        // fetch TX from electrumX server
        if(fetchedTX == null){
            fetchedTX = getCliFromPool().then(result=>{
                ecl = result
                return ecl.connect()
            }).then(r=>{
                console.log("Getting " + txid)
                return ecl.blockchainTransaction_get(txid, false)
            })
        }
        
        // handle tx
        fetchedTX.then(tx=>{
            if(tx.code){
                // If code is not undefined, something must be wrong.
                res.status(500)
                res.send(JSON.stringify(tx))
            }else{
                tx = bsv.Transaction(tx)
                var Bscript = tx.outputs.filter(output=>output.script.isDataOut())[0].script
                var content = Bscript.chunks[2].buf
                var contentType = Bscript.chunks[3].buf
                if(req.params.txid.split('.').length > 1)res.set('Content-Type',mime.lookup(req.params.txid));
                else res.set('Content-Type',contentType.toString());
                res.send(content)
                setCache(tx.id,tx.toString())
            }
        }).catch(e=>{
            console.log(`Failed to Get ${ txid } ...`)
            if(ecl)ecl.close()
            res.status(500)
            res.send(e)
        })
    })
    app.listen(program.port, () => console.log(`MiniGate Listening on ${ program.port } ...\n  Version: ${ version }`))
    getCliFromPool()
}

function cleanCache(){
    var cacheDir = os.tmpdir()+"\\minigate"
    var count = 0
    if(fs.existsSync(cacheDir)){
        var txFiles = fs.readdirSync(cacheDir)
        count = txFiles.length
        txFiles.forEach(function(file) {
            var cachedTXFile = cacheDir + "/" + file
            fs.unlinkSync(cachedTXFile)
        })
        fs.rmdirSync(cacheDir);
    }
    console.log(`MiniGate: ${ count } cached TX(s) cleaned`)
}

function getCache(txid){
    var cacheDir = os.tmpdir()+"\\minigate"
    if(fs.existsSync(cacheDir)){
        if(fs.existsSync(cacheDir+'\\'+txid))return fs.readFileSync(cacheDir+'\\'+txid).toString()
        else return null
    }else return null
}

function setCache(txid, tx){
    var cacheDir = os.tmpdir()+"\\minigate"
    if(!fs.existsSync(cacheDir))fs.mkdirSync(cacheDir)
    fs.writeFileSync(cacheDir+"\\"+txid, tx)
}

if(program.args.length==0)start()