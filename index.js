/**
 * Required dependencies
 */
var express      = require('express')
var cookieParser = require('cookie-parser')
var exphbs       = require('express-handlebars')
var emfp         = require('express-multipart-file-parser')
var request      = require('request')
var paypal       = require('paypal-rest-sdk')
// var dal          = require('./dal')
var mongo    = require('mongodb').MongoClient
var uri      = 'mongodb://localhost:27017/'
var patito   = 'patitocode'
var manuales = 'manuales'


/**
 * App init
 */
const app = express();

app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.set('views', './views');
app.set('view engine', 'handlebars');
app.use(cookieParser());
app.use(express.static('public'));


/**
 * Paypal config
 */
paypal.configure({
    'mode': 'sandbox', //sandbox or live
    'client_id': 'AQk_4uusYlTMcupWUThFtRfeFsFkSBWAAM-X90oMs_zvxYkEyItp1DVLIr2vnOSlgy-CMaBqdnPV_Vs6',
    'client_secret': 'EEUN6irLSRMzIZu-M09RssGRhD5H822nPv1n6gRZN7qLBANH8ziiKp_KJdcP4bxLtFZtvgK41_P-8roi'
})


/**
 * Utilities for db stored content, all return a Promise
 */
function getProducts() {
    return new Promise((res, rej) => {
        mongo.connect(uri, { useNewUrlParser: true }, (err, cli) => {
            if(err) {
                rej(err)
            } else {
                cli.db(patito).collection(manuales).find({}).toArray((err, arr) => {
                    if(err) rej(err)
                    res(arr)
                })
            }
        })
    })
}

function getBestSellers() {
    return new Promise((res, rej) => {
        mongo.connect(uri, { useNewUrlParser: true }, (err, cli) => {
            if(err) {
                rej(err)
            } else {
                cli.db(patito).collection(manuales).find({}).limit(4).toArray((err, arr) => {
                    if(err) rej(err)
                    res(arr)
                })
            }
        })
    })
}

function borrarManual(key) {
    
}


/**
 * MIddlewares
 */
/**
 * Middleware para verificar el Firebase ID Token
 */
function authenticate(req, res, next) {
}



/**
 * Web
 */
app.get('/', function(req, res) { 
    getBestSellers()
    .then(manuales => {
        res.render('home', { manuales })
    })
    .catch(err => {
        res.render('home', {})
    })
 })

app.get('/sobrenosotros', (req, res) => {  })

app.get('/contacto', (req, res) => {
    res.render('contact')
});


/**
 * Store
 */
app.get('/manualesdigitales', (req, res) => { 
    getProducts()
    .then(manuales => {
        res.render('products', { manuales })
    })
 })

app.get('/carritodecompras', (req, res) => {
    res.render('cart')
})

app.get('/productdetail', (req, res) => {  })

/**
 * CRUD
 */
 /**
  *  Add product - View
  */
app.get('/nuevoproducto', authenticate, (req, res) => { })

/**
 * Add product - backend
 */
app.post('/nuevoproducto', authenticate, emfp, (req, res) => {  })

/**
 * Delete product - backend
 */
app.post('/eliminarmanual', authenticate, (req, res) => {  })

/**
 * Edit product - View
 */
app.get('/editarmanual', authenticate, (req, res) => {  })

function modManual(key, manual) {  }

/**
 * Edit product - backend
 */
app.post('/editar', authenticate, emfp, (req, res) => {  })


/** 
 * Admin login
 * */
app.get('/admin-login', (req, res) => {  })

/**
 * Admin page for products
 */
app.get('/manualesdigitalesadmin', authenticate, (req, res) => {  })


/**
 * Dashboard
 */
app.get('/dashboard', authenticate, (req, res) => {
    res.render('dashboard', { admin: true, user: req.user })
})


/**
 * PTD
 */
app.get('/pp-return', (req, res) => {
    res.status(200).end
    .set({ 'return': JSON.stringify(req.params) })
    .catch(err => {
        console.log('/pp-return GET firebase error', err)
    })

    console.log('/pp-return GET tx', req.params.tx)
    var pp = 'https://www.sandbox.paypal.com/cgi-bin/webscr'
    var options = {
        form: {
            cmd: '_notify-synch',
            tx: req.query.tx,
            at: '7OGf5kKCStZCR7RVBqqqWy_TX4b0Fb7EsoDI0RATj_oXiHD3lq6wAhCsu54'
        },
        headers: {
            Accep: '*/*'
        }
    }
    request.post(pp, options, (err, res1, body) => {
        if (err)  console.log('/pp-return GET rerror:', err);
        if (res1) console.log('/pp-return GET rstatusCode:', res1 && res1.statusCode);
        if (body) console.log('/pp-return GET request.post body', body)
    })
    // 1) PP sends GET /ppreturn=tx=transactionId
    //      var req = '?cmd=_notify-synch'
    //      req += '&tx=' + transactionId
    //      req += '&at=' + PP auth_token
    //      var header = "POST /cgi-bin/webscr HTTP/1.0\r\n"
    //      header += "Content-Type: application/x-www-form-urlencoded\r\n"
    //      header += "Content-Length: " + req.length + "\r\n\r\n"
    // 2) server sends POST to 'https://www.sandbox.paypal.com/cgi-bin/webscr?' + req
})

/**
 * IPN
 */
// app.post('/pp-return', (req, res) => {
//    console.log('/pp-return POST')    
// })


app.get('/buy', (req, res) => {
    var paymentId = 'PAYMENT id will be created in paypal.payment.create'
    var payerId = 'payer id'

    // https://mercalo-b9e9f.firebaseapp.com/process
    var create_payment_json = {
        "intent": "sale",
        "payer": {
            "payment_method": "paypal"
        },
        "redirect_urls": {
            "return_url": "http://localhost:5000/process",
            "cancel_url": "http://localhost:5000/cancel"
        },
        "transactions": [{
            "item_list": {
                "items": [{
                    "name": "Crop de imágenes",
                    "sku": "CIMG",
                    "price": "200.00",
                    "currency": "MXN",
                    "quantity": 1
                }]
            },
            "amount": {
                "currency": "MXN",
                "total": "200.00"
            },
            "description": "Pago del manual Crop de imágenes"
        }]
    }
    
    
    paypal.payment.create(create_payment_json, function (error, payment) {
        var links = {}
        if (error) {
            console.log('/buy create error', error)
        } else {
            console.log('/buy create response')
            console.log(payment)
            // payment contains a links object with the approval_url (where the user accepts/cancel payment)
            payment.links.forEach(function(link){
                links[link.rel] = {
                    href: link.href,
                    method: link.method
                }
            })
            // If redirect url present, redirect user
            if( links.hasOwnProperty('approval_url') ) {
                res.redirect(links['approval_url'].href)
            } else {
                console.error('/buy create no redirect URI present')
            }
        }
    })

    // res.redirect('/')
    // var execute_payment_json = {
    //     "payer_id": payerId,
    //     "transactions": [{
    //         "amount": {
    //             "currency": "MXN",
    //             "total": "200.00"
    //         }
    //     }]
    // }

    // paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
    //     if (error) {
    //         console.log('/buy execute error', error.response)
    //     } else {
    //         console.log('/buy execute response')
    //         console.log(JSON.stringify(payment))
    //     }
    // })
})


//https://localhost:5000/process?paymentId=PAY-9FX324354L812053SLNTYE7I&token=EC-9TK62216A91503920&PayerID=QX7NVPQ266E5L
app.get('/process', (req, res) => {
    var paymentId = req.query.paymentId
    var payerId = { payer_id: req.query.PayerID }

    paypal.payment.execute(paymentId, payerId, (error, payment) => {
        if( error ) {
            console.log('/process execute error', error)
            // console.error(JSON.stringify(error))
        } else {
            if( payment.state == 'approved' ) {
                console.log('payment completed successfully')
                res.send('payment completed successfully with paymentId: ' + paymentId + ' and payerId: ' + JSON.stringify(payerId))
            } else {
                console.log('payment not successful')
                res.send('payment not successful with paymentId: ' + paymentId + ' and payerId: ' + JSON.stringify(payerId))
            }
        }
    })
    // var execute_payment_json = {
    //     "payer_id": req.query.payer_id,
    //     "transactions": [{
    //         "amount": {
    //             "currency": "MXN",
    //             "total": "200.00"
    //         }
    //     }]
    // }

    // paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
    //     if (error) {
    //         console.log('/buy execute error', error.response)
    //     } else {
    //         console.log('/buy execute response')
    //         console.log(JSON.stringify(payment))
    //     }
    // })
})


app.get('/cancel', (req, res) => {
    res.send('Paypal payment cancelado')
})


app.get('/mongoose', (req, res) => {
    var manual = new dal({
        titulo: 'rty',
        descripcion: 'fgh',
        autor: 'vbn',
        tecnologia: 'fgyhrty',
        archivo: 'about:blank',
        portada: 'about:blank',
        precio: 400,
        stock: 50,
        ventas: 50
    })
    manual.save(err => {
        if(err) console.err('/mongoose save', err)
        else console.log('/mongoose manual save ok')
    })
})


/**
 * app.listen
 */
app.listen(3000, () => {
    console.log('PatitoCode escuchando en el puerto 3000')
})
/**
 * TODO
 * Criterios
 *  (1) Compra con PP (req),                                                                                                    1
 *  (2) Productos reales de la autoría del equipo (req),                                                                        1
 *  (3) Mostrar productos: título, descripción, precio, cantidad disponible, imagen o thumbnail, autor, tecnología (req),       1
 *  (4) Mostrar carrito (req),                                                                                                  -
 *  (5) Procesar notif PP ('grax x comprar' y disminuir stock/aumentar vendidos) (req),                                         -
 *  (6) Best sellers (req),                                                                                                     1
 *  (7) Secciones: Inicio, Productos, Login, Carrito de compras, Acerca de (req),                                               1
 *  (8) Comentarios en cada producto(req),                                                                                      -
 *  (9) Panel admin con login desde db,                                                                                         1
 * (10) Panel admin CRUD (req),                                                                                                 1
 * (11) Panel admin muestra las ventas realizadas durante un tiempo determinado (día, mes, año),                                -
 * (12) Panel admin muestra a los clientes que han realizado compras en la tienda,                                              -
 * (13) Panel admin muestra el stock de productos (vendidos y en existencia),                                                   -
 *      Req     6/9
 *      Total   7/13
 * 
 *  /manualesdigitales      botón 'Agregar' > agregar al carrito    (4)
 *  /carritodecompras       mostrar el carrito                      (4)
 *                          agregar item al carrito local
 *                          cuando el usr quiere comprar, va al carrito local
 *                          cuando el usuario da click en comprar, manda el carrito a PP
 *                          PP procesa el pago y regresa a la página grax x su compra
 *                              <input type="hidden" name="return" value="http://www.mysite.org/thank_you_kindly.html" />
 *                              <input type='hidden' name='rm' value='2'>
 *  /contacto               mandar el mensaje y guardarlo           (-)
 */


/**
 * PayPay PDT id token
 * Identity Token:7OGf5kKCStZCR7RVBqqqWy_TX4b0Fb7EsoDI0RATj_oXiHD3lq6wAhCsu54
 */


/**
 * Credentials
 * Sandbox Account
 * ctadmmy2018-facilitator@gmail.com
 * AccessToken
 * access_token$sandbox$d5397nzky3s9fw7t$7d4d2f4e6e9d92aa22135e2e60b250a4
 * ExpiryDate
 * 05 Aug 2028
 */

/**
 * Sandbox account
 * ctadmmy2018-facilitator@gmail.com
 * Client ID
 * AQk_4uusYlTMcupWUThFtRfeFsFkSBWAAM-X90oMs_zvxYkEyItp1DVLIr2vnOSlgy-CMaBqdnPV_Vs6
 * Secret
 * EEUN6irLSRMzIZu-M09RssGRhD5H822nPv1n6gRZN7qLBANH8ziiKp_KJdcP4bxLtFZtvgK41_P-8roi
 */
