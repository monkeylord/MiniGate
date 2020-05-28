const bsv = require('bsv')

var Protocol = {}

Protocol.resolveD = function (tx){
    var tx = bsv.Transaction(tx)
    var DataOut = tx.outputs.filter(output=>output.script.isDataOut()||output.script.isSafeDataOut())[0]
    // Not Data transaction
    if(!DataOut)return null
    var script = DataOut.script
    // Malformed
    if(script.chunks.length<6)return null
    if(script.chunks[1].buf && script.chunks[1].buf.toString() === '19iG3WTYSsbyos3uJ733yK4zEioi1FesNU'){
        return {
            key: script.chunks[2].buf.toString('utf-8'),
            value: script.chunks[3].buf.toString('utf-8'),
            type: script.chunks[4].buf.toString(),
            sequence: parseInt(script.chunks[5].buf)||1
        }
    } else if(script.chunks[2].buf && script.chunks[2].buf.toString() === '19iG3WTYSsbyos3uJ733yK4zEioi1FesNU'){
        return {
            key: script.chunks[3].buf.toString('utf-8'),
            value: script.chunks[4].buf.toString('utf-8'),
            type: script.chunks[5].buf.toString(),
            sequence: parseInt(script.chunks[6].buf)||1
        }
    } else {
        // Not D transaction
        return null
    }
}

Protocol.resolveB = function (tx){
    var tx = bsv.Transaction(tx)
    var Bscript = tx.outputs.filter(output=>output.script.isDataOut()||output.script.isSafeDataOut())[0].script
    if(Bscript.chunks[1].buf && Bscript.chunks[1].buf.toString() === '19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut'){
        return {
            data: Bscript.chunks[2].buf,
            media_type: Bscript.chunks[3].buf.toString(),
            encoding: (Bscript.chunks[4])?Bscript.chunks[4].buf.toString():"",
            filename: (Bscript.chunks[5])?Bscript.chunks[5].buf.toString():""
        }    
    } else if(Bscript.chunks[2].buf && Bscript.chunks[2].buf.toString() === '19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut'){
        return {
            data: Bscript.chunks[3].buf,
            media_type: Bscript.chunks[4].buf.toString(),
            encoding: (Bscript.chunks[5])?Bscript.chunks[4].buf.toString():"",
            filename: (Bscript.chunks[6])?Bscript.chunks[5].buf.toString():""
        }    
    } else {
        // Not B transaction
        return null
    }
}

Protocol.resolveBcat = function (tx){
    var tx = bsv.Transaction(tx)
    var Bscript = tx.outputs.filter(output=>output.script.isDataOut()||output.script.isSafeDataOut())[0].script
    if(Bscript.chunks[1].buf && Bscript.chunks[1].buf.toString() === '15DHFxWZJT58f9nhyGnsRBqrgwK4W6h4Up'){
        return {
            info: Bscript.chunks[2].buf,
            media_type: Bscript.chunks[3].buf.toString(),
            encoding: (Bscript.chunks[4])?Bscript.chunks[4].buf.toString():"",
            filename: (Bscript.chunks[5])?Bscript.chunks[5].buf.toString():"",
            flag: (Bscript.chunks[6])?Bscript.chunks[6].buf.toString():"",
            data:Bscript.chunks.slice(7).map(chunk=>chunk.buf.toString('hex'))
        }    
    } else if(Bscript.chunks[2].buf && Bscript.chunks[2].buf.toString() === '15DHFxWZJT58f9nhyGnsRBqrgwK4W6h4Up'){
        return {
            info: Bscript.chunks[3].buf,
            media_type: Bscript.chunks[4].buf.toString(),
            encoding: (Bscript.chunks[5])?Bscript.chunks[5].buf.toString():"",
            filename: (Bscript.chunks[6])?Bscript.chunks[6].buf.toString():"",
            flag: (Bscript.chunks[6])?Bscript.chunks[7].buf.toString():"",
            data:Bscript.chunks.slice(8).map(chunk=>chunk.buf.toString('hex'))
        }    
    } else {
        // Not Bcat transaction
        return null
    }
}
Protocol.resolveBcatPart = function (tx){
    var tx = bsv.Transaction(tx)
    var Bscript = tx.outputs.filter(output=>output.script.isDataOut()||output.script.isSafeDataOut())[0].script
    if(Bscript.chunks[1].buf && Bscript.chunks[1].buf.toString() === '1ChDHzdd1H4wSjgGMHyndZm6qxEDGjqpJL'){
        return {
            data: Bscript.chunks[2].buf
        }    
    } else if(Bscript.chunks[2].buf && Bscript.chunks[2].buf.toString() === '1ChDHzdd1H4wSjgGMHyndZm6qxEDGjqpJL'){
        return {
            data: Bscript.chunks[3].buf
        }    
    } else {
        // Not BcatPart transaction, try B
        return Protocol.resolveB(tx)
    }
}

module.exports = Protocol
