const fs = require('fs')
const os = require('os')
var Cache = {}

var cacheDir = os.tmpdir()+"\/minigate"

Cache.loadDTree = function (addr){
    if(!fs.existsSync(`${cacheDir}\/${addr}.d.json`))return {}
    else return JSON.parse(fs.readFileSync(`${cacheDir}\/${addr}.d.json`).toString())
}

Cache.saveDTree = function (addr, dTree){
    fs.writeFileSync(`${cacheDir}\/${addr}.d.json`,JSON.stringify(dTree,null,2))
}

Cache.updateDTree = function (dTree, dRecord){
    // Update if D Record is newer
    if( !dTree[dRecord.key] || dTree[dRecord.key].sequence < dRecord.sequence ){
        console.log(dRecord.key + ' Updated.')
        dTree[dRecord.key] = dRecord
    }
}

Cache.cleanCache = function (){
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

Cache.getCache = function getCache(txid){
    if(fs.existsSync(cacheDir)){
        if(fs.existsSync(cacheDir+'\/'+txid))return fs.readFileSync(cacheDir+'\/'+txid).toString()
        else return null
    }else return null
}

Cache.setCache = function (txid, tx){
    if(!fs.existsSync(cacheDir))fs.mkdirSync(cacheDir)
    fs.writeFileSync(cacheDir+"\/"+txid, tx)
}


module.exports = Cache