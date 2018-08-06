/**
 * MongoDB proxy module
 */
var mongo    = require('mongodb').MongoClient
var uri      = 'mongodb://localhost:27017/'
var patito   = 'patitocode'
var manuales = 'manualesdigitales'

var manual = {
    titulo: String,
    descripcion: String,
    autor: String,
    tecnologia: String,
    archivo: String,
    portada: String,
    precio: Number,
    stock: Number,
    ventas: Number
}


// Makes connection asynchronously.  Mongoose will queue up database
// operations and release them when the connection is complete.
// mongo.connect(uri, (err, res) => {
//     if( err !== undefined ) {
//         console.log ('Conectado con: ' + uristring)
//     } else {
//         console.log ('ERROR conectando con: ' + uristring, err)
//     }
// })

exports.getAll = () => {
    return new Promise((res, rej) => {
        mongo.connect(uri, (err, cli) => {
            if( err ) {
                rej(err)
            } else {
                var col = client.db(patito).collection(manuales)
                col.find( {  } ).limit(10).toArray((err, arr) => {
                    if (err) rej(err)
                    res(arr)
                })
            }
        })
    })    
}
