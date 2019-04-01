#!/usr/bin/env node

const program = require('commander')
const express = require('express')
const app = express()
const bsv = require('bsv')
const ElectrumCli = require('electrum-client')
const MimeLookup = require('mime-lookup')
const mime = new MimeLookup(require('mime-db'))
const txidReg = new RegExp('^[0-9a-fA-F]{64}$')
const version = require('./package.json').version

program
    .command('test')
    .description('Test if MiniGate is working on ElectrumX')
    .action(test)

program
    .command('start')
    .description('Start MiniGate.')
    .action(test)

program
    .version(version)
    .option('-e, --electrumX [electrumXServer]', 'Specify a ElectrumX Server', 'electrumx.bitcoinsv.io:50002')
    .option('-p, --port [port]', 'Specify port minigate should listen on', 8000)

program
    .parse(process.argv);

var esAddr = program.electrumX.split(':')[0]
var esPort = parseInt(program.electrumX.split(':')[1])
var eclreuse = null

function getCli(port, host, protocol){
    if(eclreuse!=null)return eclreuse
    else {
        eclreuse = new ElectrumCli(port, host, protocol)
        eclreuse.onClose = ()=>{
            console.log("Presisted Connection to ElectrumX Server Closed.")
            eclreuse = null
        }
        return eclreuse
    }
}

function test(){
    var esAddr = program.electrumX.split(':')[0]
    var esPort = parseInt(program.electrumX.split(':')[1])
    console.log("Testing if minigate can connect " + program.electrumX)
    var ecl = new ElectrumCli(esPort, esAddr, 'tls')
    ecl.connect().then(()=>{
            return ecl.server_version("0", "1.2")
    }).then(r=>{
        console.log("Nice! MiniGate is working on " + program.electrumX)
        ecl.close()
    }).catch(e=>{
        console.log(e)
        console.log("Cannot connect to " + esAddr + ":" + esPort)
        console.log("Please try another ElectrumX Server")
        console.log("  minigate [start|test] -e [ElectrumX Server Address:Port]")
        ecl.close()
    })
}
function start(){
    var esAddr = program.electrumX.split(':')[0]
    var esPort = parseInt(program.electrumX.split(':')[1])
    app.get('/', (req, res) => res.send('MiniGate Online'))
    app.get('/:txid', (req, res) => {
        var txid = req.params.txid.split('.')[0]
        if(!txidReg.test(txid))return res.send("MiniGate Error: Not A Valid TXID")
        var ecl = getCli(esPort, esAddr, 'tls')
        ecl.connect().then(()=>{
            return ecl.server_version("0", "1.2")
        }).then(r=>{
            console.log("Getting " + txid + " from " + esAddr + ":" + esPort)
            return ecl.blockchainTransaction_get(txid, false)
        }).then(tx=>{
            if(tx.code){
                // If code is not undefined, something must be wrong.
                res.send(JSON.stringify(tx))
            }else{
                tx = bsv.Transaction(tx)
                var Bscript = tx.outputs.filter(output=>output.script.isDataOut())[0].script
                var content = Bscript.chunks[2].buf
                var contentType = Bscript.chunks[3].buf
                if(req.params.txid.split('.').length > 1)res.set('Content-Type',mime.lookup(req.params.txid));
                else res.set('Content-Type',contentType.toString());
                res.send(content)
            }
        }).catch(e=>{
            console.log(`Failed to Get ${ txid } from ${ esAddr + ":" + esPort }...`)
            ecl.close()
            res.send(JSON.stringify(e))
        })
    })
    app.listen(program.port, () => console.log(`MiniGate Listening on ${ program.port } ...\n  Version: ${ version }\n  Electrum Server: ${ program.electrumX }`))
}

if(program.args.length==0)start()