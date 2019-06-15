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
const Protocol = require('./protocol')
const Cache = require('./cache')

var serverpool = [
    'electrumx.bitcoinsv.io:50002',
    'sv.satoshi.io:50002',
    'sv2.satoshi.io:50002',
    //'sv.electrumx.cash:50002'
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
    .action(Cache.cleanCache)

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

        var fetchedTX = fetchTX(txid)
        // handle tx
        fetchedTX.then(tx=>{
            if(tx.code){
                // If code is not undefined, something must be wrong.
                res.status(500)
                res.send(JSON.stringify(tx))
            }else{
                var bcatRecord = Protocol.resolveBcat(tx)
                if(bcatRecord!=null){
                    Promise.all(bcatRecord.data.map(txid=>fetchTX(txid))).then(txs=>{
                        var bPartRecords = txs.map(tx=>Protocol.resolveBcatPart(tx))
                        if(req.params.txid.split('.').length > 1)res.set('Content-Type',mime.lookup(req.params.txid));
                        else res.set('Content-Type',bcatRecord.media_type);
                        res.send(Buffer.concat(bPartRecords.map(bPart=>bPart.data)))
                    })
                }else{
                    var bRecord = Protocol.resolveB(tx)
                    if(req.params.txid.split('.').length > 1)res.set('Content-Type',mime.lookup(req.params.txid));
                    else res.set('Content-Type',bRecord.media_type);
                    res.send(bRecord.data)
                }
                Cache.setCache(tx.id,tx.toString())
            }
        }).catch(e=>{
            console.log(`Failed to Get ${ txid } ...`)
            //if(ecl)ecl.close()
            res.status(500)
            res.send(e)
        })
    })
    app.get('/:addr/[a-zA-Z0-9_~\/@!$&*+,\.:;=-]+', (req, res, next) => {
        if(!isAddress(req.params.addr))next()
        else{
            var key = req.url.replace(`/${req.params.addr}/`,'')
            var txs = getCliFromPool().then(ecl=>{
                return ecl.connect().then(()=>{
                    return ecl
                })
            }).then(ecl=>{
                return ecl.blockchainScripthash_getHistory(getScriptHash(req.params.addr))
            }).catch(e=>{
                console.log(`Fail to get ${req.params.addr}'s latest record.`)
                return []
            }).then(txs=>{
                //console.log(txs)
                var dTree = Cache.loadDTree(req.params.addr)
                return Promise.all(txs.map(txrecord=>{
                    return fetchTX(txrecord.tx_hash).then(tx=>{
                        var record = Protocol.resolveD(tx)
                        if(record)Cache.updateDTree(dTree,record)
                        //console.log(tx.id)
                        Cache.setCache(tx.id,tx.toString())
                    })
                    /*
                    .catch(e=>{
                        return
                    })
                    */
                })).then(()=>{
                    Cache.saveDTree(req.params.addr, dTree)
                    console.log(dTree)
                    console.log(dTree[key])
                    console.log(dTree[key].type == 'b')
                    if(dTree[key] && dTree[key].type == 'b')return fetchTX(dTree[key].value).then(tx=>{
                        var bRecord = Protocol.resolveB(tx)
                        if(bRecord){
                            if(key.split('.').length > 1)res.set('Content-Type',mime.lookup(key))
                            else res.set('Content-Type',bRecord.media_type)
                            res.send(bRecord.data)
                        }else if(bRecord = Protocol.resolveBcat(tx)){
                            Promise.all(bRecord.data.map(txid=>fetchTX(txid))).then(txs=>{
                                var bPartRecords = txs.map(tx=>Protocol.resolveBcatPart(tx))
                                if(key.split('.').length > 1)res.set('Content-Type',mime.lookup(key));
                                else res.set('Content-Type',bRecord.media_type);
                                res.send(Buffer.concat(bPartRecords.map(bPart=>bPart.data)))
                            })
                        }else res.send(`${key} not found`)
                    })
                    else res.send(`${key} not found`)
                })
            })
        }
    })
    app.listen(program.port, () => console.log(`MiniGate Listening on ${ program.port } ...\n  Version: ${ version }`))
    getCliFromPool()
}

async function fetchTX(txid){
    var fetchedTX = null
    var ecl = null
    
    // check if tx cached
    if(program.cache){
        var cachedTX = Cache.getCache(txid)
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
            return ecl.blockchainTransaction_get(txid, false).then(tx=>{
                if(!tx.code){
                    tx = bsv.Transaction(tx)
                    //console.log(tx.id)
                    Cache.setCache(tx.id,tx.toString())
                }
                return tx
            })
        })
    }
    return fetchedTX
}

function getScriptHash(address){
    var script = bsv.Script.fromAddress(address)
    var scriptHash = bsv.crypto.Hash.sha256(script.toBuffer()).reverse()
    return scriptHash.toString('hex')
}

function isAddress(address){
   return bsv.Address.isValid(address) 
}

if(program.args.length==0)start()