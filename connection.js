const ElectrumCli = require('electrum-client')

var eclreuse = null
var curHost = ""
var curPort = ""

var serverpool = [
    'electrumx.bitcoinsv.io:50002',
    'sv.satoshi.io:50002',
    'sv2.satoshi.io:50002',
    //'sv.electrumx.cash:50002'
]

function Connection(){}

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

async function fetchTX(txid){
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
            return ecl.blockchainTransaction_get(txid, false).then(tx=>{
                if(!tx.code){
                    tx = bsv.Transaction(tx)
                    //console.log(tx.id)
                    setCache(tx.id,tx.toString())
                }
                return tx
            })
        })
    }
    return fetchedTX
}


module.exports = Connections