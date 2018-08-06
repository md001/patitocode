/**
 * Required dependencies
 */
var express      = require('express')
var cookieParser = require('cookie-parser')
var exphbs       = require('express-handlebars')
var emfp         = require('express-multipart-file-parser')
var request      = require('request')
var paypal       = require('paypal-rest-sdk')
var dal          = require('./dal')


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
 * Firebase utilities for db stored content, all return a Promise
 */
function getProducts() {
    const ref = admin.database().ref('manualesdigitales')
    return new Promise((res, rej) => {
        ref.once('value')
        .then(snap => {
            return res(snapToArray(snap.val()))
        })
        .catch(err => {
            return rej(err)
        })
    })
}

function getBestSellers() {
    const ref = admin.database().ref('manualesdigitales')
    return new Promise((res, rej) => {
        ref.orderByChild('ventas').limitToLast(4).once('value')
        .then(snap => {
            return res(snapToArray(snap.val()))
        })
        .catch(err => {
            return rej(err)
        })
    })
}

function borrarManual(key) {
    return admin.database().ref('manualesdigitales').child(key).remove()
}

/**
 * App utility to convert Firebase.Snapshot to Array[]
 * @param {*} manuales 
 */
function snapToArray(manuales) {
    var returnArr = [];

    for (let index in manuales) {
        manuales[index].key = index;
        var manual = manuales[index];
        returnArr.push(manual);
    }

    return returnArr;
};

/**
 * MIddlewares
 */
/**
 * Middleware para verificar el Firebase ID Token
 * @param {*} req EL objeto request
 * @param {*} res EL objeto response
 * @param {*} next La siguiente función a ejecutarse
 */
function authenticate(req, res, next) {
    "__session = <Firebase ID Token>"
    if (req.cookies && req.cookies.__session) {
        // console.log('auth()', admin.auth());
        admin.auth().verifyIdToken(req.cookies.__session)
        .then(user => {
            // console.log('user', user);
            req.user = user;
            next();
        })
        .catch(error => {
            console.error('Error while verifying Firebase ID token:', error);
            res.redirect(401, 'admin-login');
        });
    } else {
        // Firebase ID Token not found
        console.log('Cookie "__session" not found');
        // next();
        res.redirect('/admin-login');
    }
}

/**
 * Sube una imagen al Firebase Storage
 * @param {*} file El archivo a subir
 */
function uploadImageToStorage(file) {
    let prom = new Promise((resolve, reject) => {
        if (!file) {
            reject('No image file');
        }
        let newFileName = `${file.originalname}_${Date.now()}`;

        let fileUpload = admin.storage().bucket().file(newFileName);

        const blobStream = fileUpload.createWriteStream({
            metadata: {
                contentType: file.mimetype
            }
        });

        blobStream.on('error', (error) => {
            reject('Something is wrong! Unable to upload at the moment.');
        });

        blobStream.on('finish', () => {
            // The public URL can be used to directly access the file via HTTP.
            const url = `https://storage.googleapis.com/${admin.storage().bucket().name}/${fileUpload.name}`
            resolve(url);
        });

        blobStream.end(file.buffer);
    });
    return prom;
}

function uploadFileToStorage(file) {
    let prom = new Promise((resolve, reject) => {
        if (!file) {
            reject('No image file');
        }
        let newFileName = `${file.originalname}_${Date.now()}`;

        let fileUpload = admin.storage().bucket().file(newFileName);

        const blobStream = fileUpload.createWriteStream({
            metadata: {
                contentType: file.mimetype
            }
        });

        blobStream.on('error', (error) => {
            reject('Something is wrong! Unable to upload at the moment.');
        });

        blobStream.on('finish', () => {
            // The public URL can be used to directly access the file via HTTP.
            const url = `https://storage.googleapis.com/${admin.storage().bucket().name}/${fileUpload.name}`
            resolve(url);
        });

        blobStream.end(file.buffer);
    });
    return prom;
}


/**
 * Web
 */
app.get('/', function(req, res) {
    getBestSellers()
    .then(manuales => {
        res.render('home', { manuales })
    });

});

app.get('/sobrenosotros', (req, res) => {
    admin.database().ref('about').once('value')
    .then((about) => {
        res.render('about', { about });
    })
    .catch((err) => {
        console.log('/sobrenosotros error firebase db', error)
        res.render('about', {
            about: {
                historia: '',
                mision: '',
                vision: ''} 
            })
    })
})

app.get('/contacto', (req, res) => {
    res.render('contact');
});


/**
 * Store
 */
app.get('/manualesdigitales', (req, res) => {
    getProducts()
    .then(manuales => {
        res.render('products', { manuales })
    });
})

app.get('/carritodecompras', (req, res) => {
    res.render('cart');
})

app.get('/productdetail', (req, res) => {
    admin.database().ref("manualesdigitales").child(req.query.key).once('value')
    .then((snap) =>  {
        res.render('productdetail', snap.val())
    });
});

/**
 * CRUD
 */
 /**
  *  Add product - View
  */
app.get('/nuevoproducto', authenticate, (req, res) => {
    res.render('newproduct', {
         admin: true,
         action: 'nuevoproducto',
         label: 'Agregar',
         newprod: true,
         user: req.user });
});

/**
 * Add product - backend
 */
app.post('/nuevoproducto', authenticate, emfp, (req, res) => {
    let file = req.files[0];
    if (file) {
        // dos Promise: subir imagen y subir PDF
        uploadImageToStorage(file)
        .then((success) => {
            const manualdigital = {
                titulo: req.body.titulo,
                autor: req.body.autor,
                descripcion: req.body.descripcion,
                precio: req.body.precio,
                tecnologia: req.body.tecnologia,
                imagen: success
            };
            admin.database().ref('manualesdigitales').push(manualdigital, (error) => {
                if (error) {
                    // error en la db
                    console.error('/nuevoproducto firebasedb error', error);
                } else {
                    //res.render('newproduct', { admin: true, requestType: 'nuevoproducto', user: req.user });
                    res.redirect('/manualesdigitalesadmin');
                }
            })
        }).catch((error) => {
            console.error('/nuevoproducto uploadImage error', error);
            res.redirect('/manualesdigitalesadmin');
        });
    }
});

/**
 * Delete product - backend
 */
app.post('/eliminarmanual', authenticate, (req, res) => {
    var key = req.body.key;
    borrarManual(key)
    .then(() => {
        console.log('/eliminarmanual Manual borrado', key)
        res.redirect('/manualesdigitalesadmin')
    });
});

/**
 * Edit product - View
 */
app.get('/editarmanual', authenticate, (req, res) => {
    if( !req.query.key ) {
        console.error('Propiedad "key" no está definida');
        res.redirect('/manualesdigitalesadmin')
    }
    
    var key = req.query.key;
    var ref = admin.database().ref('manualesdigitales');
    if( !ref.child(key) ) {
        console.log('Error en child(' + key + ')');
        res.redirect('/manualesdigitalesadmin');
    }

    ref.child(key).once('value').then(snap => {
        if( snap.exists() ) {
            var manual = snap.val();
            console.log('Título: ' + manual.titulo);
            res.render('newproduct', { admin: true, action: 'editar', label: 'Guardar', key: key, manual, newprod: false, user: req.user });
        } else {
            console.error('El nodo <' + key + '> no existe');
            res.redirect('/manualesdigitalesadmin');
        }
    }).catch(error => {
        console.error('Error en child(key).once(value)' , error);
        res.redirect('/manualesdigitalesadmin');
    });
});

function modManual(key, manual) {
    let ref = admin.database().ref('manualesdigitales').child(key);
    console.log('modManual key = ', key);
    if( ref ) {
        ref.update(manual, (error) => {
            if( error ) {
                console.error('modManual Manual no editado', error);
            } else {
                console.log('modManual Manual editado', manual.titulo);
            }
        });
    } else {
        console.error('modManual Error en child(' + key + ')');
    }
}

/**
 * Edit product - backend
 */
app.post('/editar', authenticate, emfp, (req, res) => {
    // fieldname, originalname, encoding, mimetype, buffer
    console.log('/editar req.body.titulo ', req.body.titulo);
    // console.log('/editar req.file ', req.file);
    // console.log('/editar req.files', req.files);
    // console.log('/editar req.files.length', Object.keys(req.files).length)
    // Object.keys(req.files).forEach((key) => {
    //     console.log('/editar req.files[i]', key)
    // });

    if( req.body.modImagen !== undefined ) {
        let file = req.files[0]; // file: fieldname, originalname, encoding, mimetype, buffer,
        console.log('/editar Subiendo imagen a Firebase Storage: ', file.originalname);
        uploadImageToStorage(file)
        .then(url => {
            console.log('/editar uploadImage ', url);
            const manual = {
                titulo:      req.body.titulo,
                autor:       req.body.autor,
                descripcion: req.body.descripcion,
                precio:      req.body.precio,
                tecnologia:  req.body.tecnologia,
                imagen:      url,
                archivo:     req.body.archivo
            };
            console.log('/editar manual', manual);
            modManual(req.body.key, manual);
            res.redirect('/manualesdigitalesadmin');
        })
        .catch((error) => {
            console.error('Imagen no subida', error);
            res.redirect('/manualesdigitalesadmin');
        });
    } else {
        console.log('/editar Usando la misma imagen');
        const manual = {
            titulo:      req.body.titulo,
            autor:       req.body.autor,
            descripcion: req.body.descripcion,
            precio:      req.body.precio,
            tecnologia:  req.body.tecnologia,
            imagen:      req.body.imagen,
            archivo:     req.body.archivo
        };
        console.log('/editar manual', manual);
        modManual(req.body.key, manual);
        res.redirect('/manualesdigitalesadmin');
        // res.send(req.rawBody);
    }
});


/** 
 * Admin login
 * */
app.get('/admin-login', (req, res) => {
    // console.log('/admin-login req', req);
    if (req.cookies && req.cookies.__session) {
        admin.auth().verifyIdToken(req.cookies.__session)
        .then(user => {
            req.user = user;
            res.render('admin-login', { admin: true, user: user });
        })
        .catch(error => {
            console.log('/admin-login error: ', error);
            res.render('admin-login', { admin: true, user: false});
        })
    } else {
        res.render('admin-login', { admin: true, user: false});
    }

});

/**
 * Admin page for products
 */
app.get('/manualesdigitalesadmin', authenticate, (req, res) => {
    getProducts()
    .then(manuales => {
        res.render('productsadmin', { manuales, admin: true, user: req.user });
    });
});


/**
 * Firebase.Auth.User modify 
 */
{
// app.get('/user', authenticate, (req, res) => {
//     console.log('/user req.body', req.body);
//     console.log('/user req.cookies', req.cookies);
//     console.log('/user req.user', req.user);

//     https://firebase.google.com/docs/auth/admin/manage-users
//     admin.auth().updateUser(req.user.uid, {
//         photoURL: "https://storage.googleapis.com/mercalo-b9e9f.appspot.com/superadmin.png"
//     })
//     .then((record) => {
//         console.log('/user CRUD operation, record: ', record.toJSON());
//     })
//     .catch(error => {
//         console.log('/user CRUD operation error: ', error);
//     });
//     res.send("User " + req.user.name + " auth.");
// });
}

/**
 * Dashboard
 */
app.get('/dashboard', authenticate, (req, res) => {
    res.render('dashboard', { admin: true, user: req.user });
    // var firebaseID = null;
    // console.log('Looking for Firebase ID Token in Authrization HTTP header');
    // "Authorization: Bearer <Firebase ID Token>""
    // if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    //     console.log('Found "Authorization" header');
    //     // Read the ID Token from the Authorization header.
    //     firebaseID = req.headers.authorization.split('Bearer ')[1];
    // } else {
    // console.log('Looking for Firebase ID token in __session cookie');
    // "__session = <Firebase ID Token>"
    // if (req.cookies && req.cookies.__session) {
    //     // Read the ID Token from cookie.
    //     console.log('Found "__session" cookie');
    //     //firebaseID = req.cookies.__session;
    //     admin.auth().verifyIdToken(req.cookies.__session).then(decodedIdToken => {
    //         req.user = decodedIdToken;
    //         console.log('Firebase ID Token decoded: ', req.user);
    //         res.render('dashboard', { user: req.user, admin: true });
    //     }).catch(error => {
    //         console.error('Error while verifying Firebase ID token:', error);
    //     });
    // } else {
    //     // Firebase ID Token not found
    //     firebaseID = null;
    //     console.log('Firebase ID Token not found');
    //     res.redirect(401, 'admin-login');
    // }
    // }

    // if(firebaseID) {
    //     admin.auth().verifyIdToken(firebaseID).then(decodedIdToken => {
    //         req.user = decodedIdToken;
    //         console.log('Firebase ID Token decoded: ', req.user);
    //         res.render('dashboard', { user : req.user, admin : true });
    //     }).catch(error => {
    //         console.error('Error while verifying Firebase ID token:', error);
    //     });
    // } else {
    //     console.log('Firebase ID Token not decoded: ' + firebaseID);
    // }

    //console.log(req);
});


// app.get('/pp-return', (req, res) => {
//     console.log('/pp-return GET\n')
//     console.log('/pp-return req:\n')
//     Object.keys(req).forEach( (key, val) => {
//         console.log('  ' + key + ': ' + val + '\n')
//     })
//     console.log('Done...')
//     res.send()
// })

/**
 * PTD
 */
app.get('/pp-return', (req, res) => {
    res.status(200).end
    admin.database().ref('return')
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
//    console.log('/pp-return GET')    
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
        titulo: 'qwe',
        descripcion: 'asd',
        autor: 'zxc',
        tecnologia: 'qaaz',
        archivo: 'about:blank',
        portada: 'about:blank',
        precio: 300,
        stock: 98,
        ventas: 2
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
 *      Req     7/9
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
