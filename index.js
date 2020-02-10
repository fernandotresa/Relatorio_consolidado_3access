let mysql = require('mysql');
let express =  require('express');
let app = express();
let bodyParser = require('body-parser');
let logger = require('morgan');
let methodOverride = require('method-override')
let cors = require('cors');
let http = require('http').Server(app);
var moment = require('moment');
//var momenttz = require('moment-timezone');
var qr = require('qr-image');  
let shell = require('shelljs');

const util = require('util');
const exec = util.promisify(require('child_process').exec);

var os = require('os');
var ifaces = os.networkInterfaces();
var ipAddressLocal = "localhost"

const synctime = 10000;
let clientName = 'All'

let clientItensOnline = []
let errorOnSelling = []

const nodemailer = require('nodemailer');
var msgEmail = 'Olá! Obrigado por adquirir o ingresso. Segue em anexo o qrcode. <strong>https://www.megaticket.com.br</strong>'
var emailFrom = 'myrestaurantwebapp@gmail.com'
var emailSubject = 'Qr Code ingresso'
var pathQRCode = './qrcodes/'

var worksOnline = 1
var idUserOnline = 1

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(cors());

var db_config_remote = {
    host: "rds001.cacasorqzf2r.sa-east-1.rds.amazonaws.com",
    user: "bilheteria",
    password: "c4d3Oc0ntr4t0",
    database: "vendas_online"
};

/*var db_config_local = {    
    host: "rds001.cacasorqzf2r.sa-east-1.rds.amazonaws.com",    
    user: "bilheteria",
    password: "c4d3Oc0ntr4t0",
    database: "bilheteria"
};*/

var db_config_local = {
    host: "10.0.2.243",
    user: "root",
    password: "Mudaragora00",
    database: "3access"
};

/*var db_config_local = {
    host: "10.9.0.8",
    user: "root",
    password: "Mudaragora00",
    database: "3access"
};*/

let con;
let conLocal;

function handleDisconnectRemote() {

    con = mysql.createConnection(db_config_remote);
   
    con.connect(function(err) {
       if (err){
        setTimeout(handleDisconnectRemote, 2000);
       }

       con.on('error', function(err) {

        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnectRemote();  

        } else 
            throw err;  
        
    });

    log_("Database conectado!")		    
    log_("Aguardando conexões ...")	
   });
}

function handleDisconnectRemote() {

    con = mysql.createConnection(db_config_remote);
   
    con.connect(function(err) {
       if (err){
        setTimeout(handleDisconnectRemote, 2000);
       }

       con.on('error', function(err) {

        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnectRemote();  

        } else 
            throw err;  
        
    });

    log_("Database remoto conectado!")		    
    log_("Aguardando conexões ...")	
   });
}

function handleDisconnectLocal() {

    conLocal = mysql.createConnection(db_config_local);
   
    conLocal.connect(function(err) {
       if (err){
        setTimeout(handleDisconnectLocal, 2000);
       }

       conLocal.on('error', function(err) {

        if(err.code === 'PROTOCOL_CONNECTION_LOST')
            handleDisconnectLocal();  
        else 
            throw err;  
        
    });

    log_("Database local conectado!")		    
    log_("Aguardando conexões ...")	
   });
}

function startInterface(){

    if(worksOnline === 1){
        
        handleDisconnectRemote();    

        if(clientName === 'All')
            getAllProductsClient()
        else
            getProductsClient()

        setInterval(function(){ 
        syncDatabases()
     }, synctime);
    }    

    handleDisconnectLocal();        
    startIpAddress()    
}

function startIpAddress(){
    Object.keys(ifaces).forEach(function (ifname) {
      
        ifaces[ifname].forEach(function (iface) {
          
          if ('IPv4' !== iface.family || iface.internal !== false)
            return;          

          ipAddressLocal = iface.address

          if(ipAddressLocal.indexOf("10.8.0.") > -1)
              return;        
        })
    })
}

startInterface();

function log_(str){
    let now = moment().format("DD/MM/YYYY hh:mm:ss")
    let msg = "[" + now + "] " + str
    console.log(msg)
}

var transporte = nodemailer.createTransport({
    service: 'Gmail', 
    auth: {
      user: 'myrestaurantwebapp', 
      pass: ''
    } 
});


function printFile(tipoIngresso, valorIngresso, operador, dataHora, idTicket, totalVenda, reprint){
    
    return new Promise((resolve) => {

        let cmd = 'sh /home/pi/PDVi_Server/impressao.sh "' + tipoIngresso + '" ' + valorIngresso + ' ' + operador + ' "' 
            + dataHora + '" ' + idTicket + ' ' + totalVenda

        if(reprint === 1){
                cmd = 'sh /home/pi/PDVi_Server/reimpressao.sh "' + tipoIngresso + '" ' + valorIngresso + ' ' + operador + ' "' 
                        + dataHora + '" ' + idTicket + ' ' + totalVenda
        }
        
        console.log(cmd)

        shell.exec(cmd, {async: true}, function(code, stdout, stderr) {     

        console.log("Realizando impressão do ingresso ", idTicket)
        console.log('Exit code:', code);
        console.log('Program output:', stdout);
        console.log('Program stderr:', stderr)

        resolve()        
     });
           
  });
}

function sendEmail(files, emailAddr){
    
    let array = []        

    files.forEach(file => {
        let filename_ = file + '.png'
        let path_ = './qrcodes/' + filename_
        array.push({filename: filename_, path: path_})
    });
 
    let emailRecipe = {
        from: emailFrom, 
        to: emailAddr, 
        subject: emailSubject, 
        html:  msgEmail,
        attachments: array
    };

    transporte.sendMail(emailRecipe, function(err, info){
        if(err)
            throw err;    
        console.log('Email enviado! Leia as informações adicionais: ', info);
    });
}

function coord2offset(x, y, size) {
    return (size + 1) * y + x + 1;
}

function customize(bitmap) {
    const size = bitmap.size;
    const data = bitmap.data;

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < x; y++) {
            const offset = coord2offset(x, y, size);
            if (data[offset]) {
                data[offset] = 255 - Math.abs(x - y);
            }
        }
    }
}

function generateQrCode(ticket){

    let file = pathQRCode + ticket + '.png'
    
    return qr.image(ticket, {
        type: 'png',
        customize
    }).pipe(
        require('fs').createWriteStream(file)
    );
}

/**
 * Get all itens avaiable for the client on store - All categories
 */
function getAllProductsClient(){

    let sql = "SELECT wp_term_relationships.object_id \
            FROM wp_term_relationships \
            LEFT JOIN wp_posts  ON wp_term_relationships.object_id = wp_posts.ID \
            LEFT JOIN wp_term_taxonomy ON wp_term_taxonomy.term_taxonomy_id = wp_term_relationships.term_taxonomy_id \
            LEFT JOIN wp_terms ON wp_terms.term_id = wp_term_relationships.term_taxonomy_id \
                WHERE post_type = 'product' \
                AND taxonomy = 'product_cat'"; 

    log_(sql)

    con.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
                
        populateProductClientArray(result)
    });   
}


/**
 * Get all itens avaiable for the client on store - By category
 */
function getProductsClient(){

    let sql = "SELECT wp_term_relationships.object_id \
            FROM wp_term_relationships \
            LEFT JOIN wp_posts  ON wp_term_relationships.object_id = wp_posts.ID \
            LEFT JOIN wp_term_taxonomy ON wp_term_taxonomy.term_taxonomy_id = wp_term_relationships.term_taxonomy_id \
            LEFT JOIN wp_terms ON wp_terms.term_id = wp_term_relationships.term_taxonomy_id \
                WHERE post_type = 'product' \
                AND taxonomy = 'product_cat' \
                AND name = '" + clientName + "'"; 

    log_(sql)

    con.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
                
        populateProductClientArray(result)
    });   
}

/**
 * Keep the results on clientItensOnline
 */
function populateProductClientArray(data){

    for (var i = 0; i < data.length; i++) {
        object_id = data[i].object_id
        clientItensOnline.push(object_id)        
    }

    console.log("Ids dos produtos do cliente: ", clientName, clientItensOnline)
}

/**
 * Search for new products to synchonize. 
 * Use the specific WHERE In combination with the clientItensOline array
 */
function syncDatabases(){
	
    let sql = "SELECT \
        p.ID as order_id,\
        p.post_date,\
        max( CASE WHEN pm.meta_key = '_billing_email' and p.ID = pm.post_id THEN pm.meta_value END ) as billing_email,\
        max( CASE WHEN pm.meta_key = '_billing_first_name' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_first_name,\
        max( CASE WHEN pm.meta_key = '_billing_last_name' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_last_name,\
        max( CASE WHEN pm.meta_key = '_billing_cpf' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_cpf,\
        max( CASE WHEN pm.meta_key = '_billing_address_1' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_address_1,\
        max( CASE WHEN pm.meta_key = '_billing_address_2' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_address_2,\
        max( CASE WHEN pm.meta_key = '_billing_city' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_city,\
        max( CASE WHEN pm.meta_key = '_billing_state' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_state,\
        max( CASE WHEN pm.meta_key = '_billing_postcode' and p.ID = pm.post_id THEN pm.meta_value END ) as _billing_postcode,\
        max( CASE WHEN pm.meta_key = '_shipping_first_name' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_first_name,\
        max( CASE WHEN pm.meta_key = '_shipping_last_name' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_last_name,\
        max( CASE WHEN pm.meta_key = '_shipping_address_1' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_address_1,\
        max( CASE WHEN pm.meta_key = '_shipping_address_2' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_address_2,\
        max( CASE WHEN pm.meta_key = '_shipping_city' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_city,\
        max( CASE WHEN pm.meta_key = '_shipping_state' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_state,\
        max( CASE WHEN pm.meta_key = '_shipping_postcode' and p.ID = pm.post_id THEN pm.meta_value END ) as _shipping_postcode,\
        max( CASE WHEN pm.meta_key = '_order_total' and p.ID = pm.post_id THEN pm.meta_value END ) as order_total,\
        max( CASE WHEN pm.meta_key = '_order_tax' and p.ID = pm.post_id THEN pm.meta_value END ) as order_tax,\
        max( CASE WHEN pm.meta_key = '_paid_date' and p.ID = pm.post_id THEN pm.meta_value END ) as paid_date,\
        ( select group_concat( order_item_name separator '|' ) from wp_woocommerce_order_items where order_id = p.ID ) as order_items \
    FROM \
        wp_posts p \
        JOIN wp_postmeta pm on p.ID = pm.post_id \
        JOIN wp_woocommerce_order_items oi on p.ID = oi.order_id \
        INNER JOIN wp_woocommerce_order_items as woi on ( woi.order_id = p.ID ) \
        INNER JOIN wp_woocommerce_order_itemmeta as woim on ( woim.order_item_id = woi.order_item_id ) \
        INNER JOIN wp_term_relationships as wtr on ( wtr.object_id = woim.meta_value ) \
    WHERE \
        post_type = 'shop_order' \
		AND sync = 0 \
        AND post_status = 'wc-completed' \
        AND wtr.object_id IN (" + clientItensOnline + ") \
    GROUP BY \
        p.ID"
        
    //log_(sql)

    con.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        
        if(result.length > 0)
            syncDatabaseContinue(result)
    });
}

/**
 * Separate the order products and create on the local base the specifics itens  
 */
function syncDatabaseContinue(data){
    
    log_("Sincronizando novas compras")

    let sqlCashier = "INSERT INTO 3a_caixa_registrado (fk_id_usuario, data_caixa_registrado, obs_log_venda) \
        VALUES (" + idUserOnline + ", NOW(), 'Gerado pelo sistema PDVi Web');"

    log_(sqlCashier)        

    conLocal.query(sqlCashier, function (err1, result) {        
        if (err1) throw err1;

        let sql = "SELECT 3a_caixa_registrado.id_caixa_registrado \
            FROM 3a_caixa_registrado \
            WHERE 3a_caixa_registrado.fk_id_usuario = " + idUserOnline + " \
            ORDER BY data_caixa_registrado DESC LIMIT 1"
    
        log_(sql)

        conLocal.query(sql, function (err, result) {        
            if (err) throw err;           

            syncDatabaseFinish(data, result)
        });
    });                   
}

function syncDatabaseFinish(data, caixa){

    let id_caixa_registrado = caixa[0].id_caixa_registrado

    log_("Último caixa registrado: " + id_caixa_registrado)

    for (var i = 0; i < data.length; i++) {                

        let itens = data[i]
        let order_items = itens.order_items
        let arr = order_items.toString().split("|");                                        

        for (var k = 0; k < arr.length; k++) {

            let produto = arr[k]                                                                              
            createTicketBaseLocal(produto, itens, i, id_caixa_registrado)
        }                  
    }    
}

/**
 * Search information about the product on local base
 */
function createTicketBaseLocal(productName, itens, k, id_caixa_registrado){

    let sql = "SELECT * FROM 3a_produto WHERE nome_produto = '" + productName + "';";
    log_(sql)
    
    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                                                
    
        let product = result[0]

        if(product){

            let prefixo = product.prefixo_produto
            let prefixo_ini=prefixo*1000000;
            let prefixo_fim=prefixo_ini+999999;

            product.fk_id_caixa_venda = id_caixa_registrado
        
            let sqlPrefix = "SELECT IFNULL(MAX(id_estoque_utilizavel) + 1, " + prefixo_ini + ") AS id_estoque_utilizavel \
                FROM 3a_estoque_utilizavel \
                WHERE id_estoque_utilizavel \
                BETWEEN " + prefixo_ini + " \
                AND " + prefixo_fim + ";"        

            conLocal.query(sqlPrefix, function (err1, result1) {  
                if (err1) throw err1;                    

                let id_estoque_utilizavel = result1[0].id_estoque_utilizavel    
                let id_estoque =  id_estoque_utilizavel + k    
                
                createTicketDatabaseLocal(product, id_estoque)                
                createTicketBaseLocalContinue(result1, itens, product)    
                //decrementStock(product)            
            });        
        }                
    }); 
}

function createTicketBaseLocalContinue(data, itens, product){    
    
    let order_id = itens.order_id
    updateTicketsSyncIds(order_id)

    let order_items = itens.order_items
    let post_date = itens.post_date
    let billing_email = itens.billing_email
    let _billing_first_name = itens._billing_first_name
    let _billing_last_name = itens._billing_last_name
    let _billing_address_1 = itens._billing_address_1
    let _billing_address_2 = itens._billing_address_2
    let _billing_city = itens._billing_city
    let _billing_cpf = itens._billing_cpf
    let _billing_state = itens._billing_state
    let _billing_postcode = itens._billing_postcode
    let _shipping_first_name = itens._shipping_first_name
    let _shipping_last_name = itens._shipping_last_name
    let _shipping_address_1 = itens._shipping_address_1
    let _shipping_address_2 = itens._shipping_address_2
    let _shipping_city = itens._shipping_city
    let _shipping_state = itens._shipping_state
    let _shipping_postcode = itens._shipping_postcode
    let order_total = itens.order_total
    let order_tax = itens.order_tax
    let paid_date = itens.paid_date 

    let id_estoque_utilizavel = data[0].id_estoque_utilizavel
                       
    let sql = "INSERT INTO vendas_online (order_id, post_date, billing_email, _billing_first_name, _billing_last_name, _billing_address_1,\
        _billing_address_2, _billing_city, _billing_state, _billing_postcode, _shipping_first_name, _shipping_last_name, _shipping_address_1, _shipping_address_2, _shipping_city, _shipping_state,\
        _shipping_postcode, order_total, order_tax, paid_date, order_items, id_estoque_utilizavel, _billing_cpf) VALUES \
            (" + order_id + ", '" + post_date + "', '" + billing_email + "', '" + _billing_first_name + "', '" + _billing_last_name + "', '" + _billing_address_1 + "', '" + _billing_address_2 + "', '" + _billing_city + "', '" +
            _billing_state + "', '" + _billing_postcode + "', '" + _shipping_first_name + "', '" + _shipping_last_name + "', '" + _shipping_address_1 + "', '" + _shipping_address_2 + "', '" +
            _shipping_city + "', '" + _shipping_state + "', '" + _shipping_postcode + "', " + order_total + ", " + order_tax + ", '" + paid_date + "', '"  + order_items + "', " + 
            id_estoque_utilizavel + ", '" + _billing_cpf + "');";

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                              
    });
}

function createTicketDatabaseLocal(product, id_estoque_utilizavel){

    let id_produto = product.id_produto
    let userId = 1

    let sql = "INSERT INTO 3a_estoque_utilizavel (id_estoque_utilizavel,fk_id_produto,fk_id_tipo_estoque,fk_id_usuarios_inclusao,data_inclusao_utilizavel, impresso) \
        VALUES(" + id_estoque_utilizavel + ", " + id_produto + ", 1," + userId + ", NOW(), 1);"                       

    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;  

        soldTicket(product, "ONLINE", id_estoque_utilizavel, userId)                            
    });    
}

function soldTicket(produto, tipoPagamento, last, userId){
    
    let user = userId
    let obs = "Vendido pelo sistema online"
    let ip = "localhost"
    let validade = 1
    let id_estoque_utilizavel = last
    let fk_id_subtipo_produto = produto.fk_id_subtipo_produto
    let valor = produto.valor_produto
    let id_produto = produto.id_produto
    let fk_id_caixa_venda = produto.fk_id_caixa_venda

    let sql = "INSERT INTO 3a_log_vendas (\
        fk_id_estoque_utilizavel,\
        fk_id_usuarios,\
        fk_id_produto,\
        fk_id_subtipo_produto,\
        fk_id_caixa_registrado,\
        valor_log_venda,\
        data_log_venda,\
        obs_log_venda,\
        ip_maquina_venda,\
        nome_maquina_venda,\
        fk_id_tipo_pagamento,\
        fk_id_validade) \
    VALUES("
     + id_estoque_utilizavel + ", " 
     + user + ", "
     + id_produto + ", "
     + fk_id_subtipo_produto + ", "
     + fk_id_caixa_venda + ", " +
     + valor + ", " +
     "NOW(), '" 
     + obs + "', '" 
     + ip + "'," 
     + "'PDVi',"
     + "(SELECT 3a_tipo_pagamento.id_tipo_pagamento FROM 3a_tipo_pagamento WHERE 3a_tipo_pagamento.nome_tipo_pagamento = '" + tipoPagamento + "'),"
     + validade + ");"    

    conLocal.query(sql, function (err2, result2) {          
        if (err2) throw err2;                       

        log_(sql)
    });
}

function updateTicketsSyncIds(id_order){    

    let sql = "UPDATE wp_posts SET sync = 1 WHERE ID = " + id_order + ";"; 
    //log_(sql)

    con.query(sql, function (err1, result) {  
        if (err1) throw err1;                    
    });    
}

async function payProduct(req, res){

    let products = req.body.products    

    errorOnSelling = []
    var promiseArray = [];
    let isPrePrinted = req.body.isPrePrinted

    let queuePrePrinted = []

    for (var i = 0, len = products.length; i < len; i++) {
        
        promiseArray.push(new Promise((resolve) => {

            let product = products[i]        
            let isParking = product.parking
                    
            if(isParking)
                payParking(req, product)

            else if(isPrePrinted){                
      
                if(! queuePrePrinted.includes(product.id_estoque_utilizavel)){

                    console.log('Vendendo ingresso pré impresso:', product.id_estoque_utilizavel)
                    
                    queuePrePrinted.push(product.id_estoque_utilizavel)                        
                    payProductPrePrinted(req, product)        
                }             
            }
            else
                payProductNormal(req, product)
                
            resolve({"success": product})
        })
      )         
    }
    
    res.json(await Promise.all(promiseArray) ); 
}

function payProductPrePrinted(req, product){
    
    let promise = new Promise((resolve) => {

        let quantity = product.quantity
        let selectedsIds = product.selectedsIds

        for(var j = 0; j < quantity; j++){
                             
            let idSubtypeChanged = selectedsIds[j]    
        
            if(idSubtypeChanged > 0)   
                product.fk_id_subtipo_produto = idSubtypeChanged                                
                        
            soldAndPrint(req, product, product.id_estoque_utilizavel)                                                            
        } 
        
        resolve(true)

    });

    return promise
}


async function payProductNormal(req, product){

    let promise = new Promise((resolve, reject) => {

        let prefixo = product.prefixo_produto
        let prefixo_ini=prefixo*1000000;
        let prefixo_fim=prefixo_ini+999999;
        
        let sql = "SELECT IFNULL(MAX(id_estoque_utilizavel), " + prefixo_ini + ") AS TOTAL \
            FROM 3a_estoque_utilizavel \
            WHERE id_estoque_utilizavel \
            BETWEEN " + prefixo_ini + " \
            AND " + prefixo_fim + ";"               

        conLocal.query(sql, function (err1, result) {  
            if (err1) reject(err1);  

            log_(sql) 
            
            payProductContinue(req, product, result)
            resolve()
        });
    })

    return promise
}

function payParking(req, product){
    
    let userId = req.body.userId    
    let idPayment = req.body.idPayment    
    let quantity = product.quantity
    let last = product.id_estoque_utilizavel

    for(var j = 0; j < quantity; j++){               
        soldTicket(product, idPayment, last, userId)         
    }    
}

async function payProductContinue(req, product, data){            

    
    let promise = new Promise((resolve, reject) => {

        let id_estoque_utilizavel = data[0].TOTAL           
        let userId = req.body.userId    
        let id_produto = product.id_produto            
        let quantity = product.quantity
        let selectedsIds = product.selectedsIds
        let urls = product.urls

        console.log(id_estoque_utilizavel, quantity)                

	if(!urls){
        urls = []
    }
		

    for(var j = 0; j < quantity; j++){
                
        let last = ++id_estoque_utilizavel
        let idSubtypeChanged = selectedsIds[j]    
        let url =  urls[j]                              

        if(!url)
            url = ""
                            
        let sql = "INSERT INTO 3a_estoque_utilizavel (id_estoque_utilizavel,fk_id_produto,fk_id_tipo_estoque,fk_id_usuarios_inclusao,data_inclusao_utilizavel, impresso, url) \
        VALUES(" + last + ", " + id_produto + ", 1," + userId + ", NOW(), 1, '" + url + "');"  
        
        log_(sql)   

    
        conLocal.query(sql, function (err1, result) {  
            if (err1) reject(err1);  


            if(idSubtypeChanged > 0)   
                product.fk_id_subtipo_produto = idSubtypeChanged                                
            
            resolve()
            soldAndPrint(req, product, last)
            
        });    
    }

    });

    return promise
}

async function soldAndPrint(req, product, last){        

    let promise = new Promise((resolve, reject) => {

        let userId = req.body.userId
        let userName = req.body.userName
        let finalValue = req.body.finalValue
        let idPayment = req.body.idPayment
        
        let valor_produto = product.valor_produto            

        product.userName = userName
        product.finalValue = finalValue    

        let user = userId
        let obs = "Vendido pelo sistema"
        let ip = "localhost"
        let validade = 1
        let id_estoque_utilizavel = last
        let fk_id_subtipo_produto = product.fk_id_subtipo_produto
        let id_produto = product.id_produto
        let fk_id_caixa_venda = product.id_caixa_registrado  
        
        product.id_estoque_utilizavel = last
        id_estoque_utilizavel = product.id_estoque_utilizavel
        
        if(fk_id_caixa_venda === undefined)
            fk_id_caixa_venda = product.fk_id_caixa_venda

        let sql = "INSERT INTO 3a_log_vendas (\
            fk_id_estoque_utilizavel,\
            fk_id_usuarios,\
            fk_id_produto,\
            fk_id_subtipo_produto,\
            fk_id_caixa_registrado,\
            valor_log_venda,\
            data_log_venda,\
            obs_log_venda,\
            ip_maquina_venda,\
            nome_maquina_venda,\
            fk_id_tipo_pagamento,\
            fk_id_validade) \
        VALUES("
        + id_estoque_utilizavel + ", " 
        + user + ", "
        + id_produto + ", "
        + fk_id_subtipo_produto + ", "
        + fk_id_caixa_venda + ", " +
        + valor_produto + ", " +
        "NOW(), '" 
        + obs + "', '" 
        + ip + "'," 
        + "'PDVi',"
        + "(SELECT 3a_tipo_pagamento.id_tipo_pagamento FROM 3a_tipo_pagamento WHERE 3a_tipo_pagamento.nome_tipo_pagamento = '" + idPayment + "'),"
        + validade + ");"    

        //log_(sql)
        
        conLocal.query(sql, function (err, result) {          
            if (err){
                errorOnSelling.push(id_estoque_utilizavel)
                if (err) reject(err);
            }
            else{
                                
                checkTicketSold(id_estoque_utilizavel, product.nome_produto, valor_produto, userName, finalValue)
                resolve()                
            }                                        
                                
        });         
    });

    return promise
}

async function decrementStock(id_produto){        

    let promise = new Promise((resolve, reject) => {
        
        let sql = "UPDATE 3a_produto SET stock = (stock - 1) WHERE id_produto = " + id_produto + ";"

        log_(sql)
        
        conLocal.query(sql, function (err, result) {          
            if (err){
                errorOnSelling.push(id_estoque_utilizavel)
                if (err) reject(err);
            }
            else                                                
                resolve(true)                               
        });         
    });

    return promise
}

async function decrementStockOnline(nome_produto){        

    let promise = new Promise((resolve, reject) => {
        
        let sql = "UPDATE vendas_online.wp_postmeta SET meta_value = (meta_value - 1) WHERE meta_key = '_stock' AND post_id = \
            (SELECT wp_posts.ID FROM wp_posts WHERE wp_posts.post_title = '" + nome_produto + "' LIMIT 1);"        

        log_(sql)
        
        con.query(sql, function (err, result) {          
            if (err) 
                reject(err);                                            
            else                                                
                resolve(true)                               
        });         
    });

    return promise
}

function checkTicketSold(id_estoque_utilizavel, nome_produto, valor_produto, userName, finalValue){
    
    let promise = new Promise((resolve, reject) => {
        
        //let data_log_venda = momenttz().tz('America/Sao_Paulo').format("DD.MM.YYYY hh:mm:ss")
        let data_log_venda = moment().format("DD.MM.YYYY hh:mm:ss")
        
        let sql = "SELECT fk_id_estoque_utilizavel FROM 3a_log_vendas WHERE fk_id_estoque_utilizavel = " + id_estoque_utilizavel + " ORDER BY fk_id_estoque_utilizavel LIMIT 1;"
        log_(sql)

        conLocal.query(sql, function (err, result) {          
            if (err) {
                if (err) reject(err);
            }
            
            if(result.length > 0){

                //decrementStock(id_estoque_utilizavel)

                //if(worksOnline)
                    //decrementStockOnline(nome_produto)

                printFile(nome_produto, valor_produto, userName, data_log_venda, id_estoque_utilizavel, finalValue, 0)
                .then(() => {

                    resolve()                
                })
                
            }
                

            else {
                errorOnSelling.push(id_estoque_utilizavel)
            }            
        }); 

    });

    return promise
}

function confirmCashDrain(req, res){

    let idUser = req.body.idUser
    let idSupervisor = req.body.idSupervisor
    let drainValue = req.body.drainValue
                
    let sql = "INSERT INTO 3a_sangria (fk_id_usuario, fk_id_supervisor, data_sangria, valor_sangria) \
        VALUES (" + idUser + ", " + idSupervisor + ", NOW(), " + drainValue + ")";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function confirmCashChange(req, res){

    let idUser = req.body.idUser
    let idSupervisor = req.body.idSupervisor
    let changeValue = req.body.changeValue
                
    let sql = "INSERT INTO 3a_troco (fk_id_usuario, fk_id_supervisor, data_inclusao, valor_inclusao) \
        VALUES (" + idUser + ", " + idSupervisor + ", NOW(), " + changeValue + ")";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getLastCashierId(req, res){

    let idUser = req.body.idUser     

    let sqlCashier = "INSERT INTO 3a_caixa_registrado (fk_id_usuario, data_caixa_registrado, obs_log_venda) \
        VALUES (" + idUser + ", NOW(), 'Gerado pelo sistema PDVi Web');"

    log_(sqlCashier)        

    conLocal.query(sqlCashier, function (err1, result) {        
        if (err1) throw err1;

        let sql = "SELECT 3a_caixa_registrado.id_caixa_registrado \
            FROM 3a_caixa_registrado \
            WHERE 3a_caixa_registrado.fk_id_usuario = " + idUser + " \
            ORDER BY data_caixa_registrado DESC LIMIT 1"
    
        log_(sql)

        conLocal.query(sql, function (err2, resultEnd) {        
            if (err2) throw err2;           
            res.json({"success": resultEnd}); 
        });
    });                       
}

function getTicketOperator(req, res){

    let idUser = req.body.idUser
    let start = req.body.start
    let end = req.body.end    

    let sql = "SELECT *, false AS checked \
            FROM 3a_estoque_utilizavel \
        INNER JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
        INNER JOIN 3a_caixa_registrado ON 3a_caixa_registrado.id_caixa_registrado = 3a_log_vendas.fk_id_caixa_registrado \
        INNER join 3a_produto ON 3a_produto.id_produto = 3a_estoque_utilizavel.fk_id_produto \
        INNER join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_log_vendas.fk_id_subtipo_produto \
        WHERE 3a_log_vendas.fk_id_usuarios = " + idUser + " \
        AND 3a_log_vendas.data_log_venda BETWEEN '" + start + "' AND  '" + end + "' \
        ORDER BY 3a_log_vendas.data_log_venda DESC;"

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getTicketOperatorStr(req, res){

    let idUser = req.body.idUser
    let start = req.body.start
    let end = req.body.end    
    let str = req.body.str

    let sql = "SELECT *, false AS checked \
            FROM 3a_estoque_utilizavel \
        INNER JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
        INNER JOIN 3a_caixa_registrado ON 3a_caixa_registrado.id_caixa_registrado = 3a_log_vendas.fk_id_caixa_registrado \
        INNER join 3a_produto ON 3a_produto.id_produto = 3a_estoque_utilizavel.fk_id_produto \
        INNER join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_log_vendas.fk_id_subtipo_produto \
        WHERE 3a_log_vendas.fk_id_usuarios = " + idUser + " \
        AND 3a_log_vendas.data_log_venda BETWEEN '" + start + "' AND  '" + end + "' \
        AND 3a_estoque_utilizavel.id_estoque_utilizavel = " + str + " \
        ORDER BY 3a_log_vendas.data_log_venda DESC;"

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getTicketsCashier(req, res){

    let idCashier = req.body.idCashier    

    let sql = "SELECT *, false AS checked \
            FROM 3a_estoque_utilizavel \
        INNER JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
        INNER JOIN 3a_caixa_registrado ON 3a_caixa_registrado.id_caixa_registrado = 3a_log_vendas.fk_id_caixa_registrado \
        INNER join 3a_produto ON 3a_produto.id_produto = 3a_estoque_utilizavel.fk_id_produto \
        INNER join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_log_vendas.fk_id_subtipo_produto \
        WHERE 3a_caixa_registrado.id_caixa_registrado = " + idCashier + " \
        ORDER BY 3a_estoque_utilizavel.id_estoque_utilizavel DESC;"

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getTicketParking(req, res){

    let id_estoque_utilizavel = req.body.idTicket
                
    let sql = "SELECT 3a_produto.nome_produto,\
                3a_produto.prefixo_produto,\
                3a_produto.id_produto,\
                3a_produto.valor_produto,\
                3a_log_vendas.data_log_venda,\
                3a_ponto_acesso.nome_ponto_acesso,\
                3a_produto.fk_id_subtipo_produto,\
                3a_estoque_utilizavel.id_estoque_utilizavel,\
                3a_estoque_utilizavel.data_inclusao_utilizavel \
            FROM 3a_estoque_utilizavel \
            LEFT JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
            INNER join 3a_produto ON 3a_produto.id_produto = 3a_estoque_utilizavel.fk_id_produto \
            INNER join 3a_ponto_acesso ON 3a_ponto_acesso.id_ponto_acesso = 3a_estoque_utilizavel.fk_id_ponto_acesso_gerado \
            WHERE id_estoque_utilizavel = " + id_estoque_utilizavel + ";";

    log_(sql)

    
    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getCashDrain(req, res){
    let idUser = req.body.idUser  
    let start = req.body.start
    let end = req.body.end
                
    let sql = "SELECT SUM(valor_sangria)  AS TOTAL \
            FROM 3a_sangria where fk_id_usuario = " + idUser + " \
            AND data_sangria BETWEEN '" + start + "' AND '" + end + "';";
    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getUsers(req, res){
    let sql = "SELECT * FROM 3a_usuarios;";
    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getUsersByName(req, res){

    let name = req.body.name

    let sql = "SELECT * FROM 3a_usuarios WHERE login_usuarios LIKE '%" + name + "%';";
    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function getErros(req, res){
    res.json({"errorOnSelling": errorOnSelling}); 
}

function recoverPaymentErros(req, res){

 let tickets = req.body.tickets

   tickets.forEach(element => {
        
        let sql1 = "DELETE FROM 3a_estoque_utilizavel WHERE id_estoque_utilizavel = " + element + " LIMIT 1;";
        let sql2 = "DELETE FROM 3a_log_vendas WHERE fk_id_estoque_utilizavel = " + element + " LIMIT 1;";
    
        conLocal.query(sql1, function (err1, result) {        
            //if (err1) throw err1;                       
            log_(sql1)
        });

        conLocal.query(sql2, function (err1, result) {        
            //if (err1) throw err1;                       
            log_(sql2)
        });

    });
   
    res.json({"success": 1}); 
}

function getAllReceptors(req, res){

    let sql = "SELECT * FROM 3a_ponto_acesso;";
    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

function systemCommand(req, res){

    console.log(req.body)

    let cmd = req.body.cmd
    let idUser = req.body.idUser
    let ipPonto = req.body.ipPonto

    let sql = "INSERT INTO comando_sistema (id_comando, id_user, ip_ponto) \
        VALUES (" + cmd + "," + idUser + ",'" + ipPonto + "');";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
}

async function systemCommandLocal(req, res) {
    console.log("Executando comando...")
    
    const { stdout, stderr } = await exec('xdotool key ctrl+Tab');
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);

    res.json({"success": stdout}); 
}

function useTicketMultiple(req, res){

    let idTotem = req.body.id
    let idArea = req.body.idArea
    let ticket = req.body.ticket

    log_('Totem: '+ idTotem + ' - Marcando ticket como utilizado:', ticket, idArea)

    let sql1 = "INSERT INTO 3a_log_utilizacao \
            (3a_log_utilizacao.fk_id_estoque_utilizavel,\
             3a_log_utilizacao.fk_id_ponto_acesso,\
             3a_log_utilizacao.fk_id_area_acesso,\
             3a_log_utilizacao.fk_id_usuario,data_log_utilizacao) \
            VALUES (" + ticket + "," + idTotem + "," + idArea + ", 1, NOW());";        

        conLocal.query(sql1, function (err1, result) {        

            if (err1) throw err1;          
            
            let sql_utilizacao = "UPDATE 3a_estoque_utilizavel \
                    SET 3a_estoque_utilizavel.utilizado = 1 \
                    WHERE id_estoque_utilizavel = " + ticket + " LIMIT 1;"

            log_(sql_utilizacao)

            con.query(sql_utilizacao, function (err2, result2) {        
                if (err2) throw err2;          

                let sql = "UPDATE \
                    3a_area_acesso \
                    SET 3a_area_acesso.lotacao_area_acesso = 3a_area_acesso.lotacao_area_acesso + 1 \
                    WHERE 3a_area_acesso.id_area_acesso = " + idArea + ";"

                    conLocal.query(sql, function (err3, result3) {                                
                        res.json({"success": result}); 
                    });
                });        
        }); 
}

function getSessions(req, res){

    let sql = "SELECT *, 0 AS lotacaoAtual FROM sessoes;"
    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
}


function getSessionsName(req, res){

    let sql = "SELECT *, 0 AS lotacaoAtual FROM sessoes WHERE nome LIKE '%" + req.body.name + "%'; "
    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
}

function getSessionsProducts(req, res){
    
    let idSessao = req.body.idSessao

    let sql = "SELECT 3a_produto.nome_produto \
        FROM sessoes \
        INNER JOIN sessoes_produtos ON sessoes_produtos.id_sessao = sessoes.id \
        INNER JOIN 3a_produto ON 3a_produto.id_produto = sessoes_produtos.id_produto \
        WHERE sessoes_produtos.id_sessao = " + idSessao + ";"

    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
}

function getProductsTypes(req, res){

    let sql = "SELECT * FROM 3a_tipo_produto;"
    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
}

function getProducts(req, res){

    let sql = "SELECT * FROM 3a_produto ORDER BY posicao_produto_imprimivel;"
    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
}

function addUsers(req, res){

    let info = req.body
    let name = info.username
    //let status = info.status === "Ativo" ? 1 : 0
    let status = 1
    let password = info.password
    let acl = info.acl
 
    let sql = "INSERT INTO 3a_usuarios (login_usuarios, fk_id_nivel_acesso, ativo_usuarios, senha_usuarios, senha_usuarios_pdvi) \
        VALUES('" + name + "', (SELECT id_nivel_acesso FROM 3a_nivel_acesso WHERE nome_nivel_acesso = '" + acl + "' LIMIT 1), " + status + ", '" + password + "', '" + password + "');"                       

    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
}

function addSession(req, res){

    let info = req.body.info
    let nome = info.nome
    let status = info.status === "Ativo" ? 1 : 0
    let obs = info.obs
    let lotacao = info.lotacao
 
    let sql = "INSERT INTO sessoes (nome, status, lotacao, obs) \
        VALUES('" + nome + "', " + status + ", " + lotacao + ", '" + obs + "');"                       

    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;  

        addSessionContinue(req, res)        
    });  
}

function addSessionContinue(req, res){

    delSessionTipos(req, res)

        .then(() => {

            addSessionTipos(req, res)                                
            .then(() => {

                res.json({"success": true});  
            })
            .catch(error => {
                res.json({"success": false});  
            })
            
        })
        .catch(error => {
            res.json({"success": false});  
        })
}

function addSessionTipos(req, res){

    return new Promise(function(resolve, reject){        
        
        let info = req.body.info
        let tipos = info.tipos
        let nome = info.nome
        let promises  = []

        tipos.forEach(element => {

            let sql = "INSERT INTO sessoes_produtos (id_produto, id_sessao) \
                VALUES (\
                (SELECT id_produto FROM 3a_produto WHERE nome_produto = '" + element + "' LIMIT 1), \
                (SELECT id FROM sessoes WHERE nome = '" + nome + "' LIMIT 1));"

            log_(sql)

            let dbquery = conLocal.query(sql, function (err1, result) {  
                if (err1) reject(err1);
            });
        
            promises.push(dbquery)
        })

        Promise.all(promises).then(() => {
            resolve()

        });

    });    
}

function delSessionTipos(req, res){

    return new Promise(function(resolve, reject){        
        
        let info = req.body.info
        let nome = info.nome
        
        let sql = "DELETE FROM sessoes_produtos WHERE id_sessao = \
            (SELECT id FROM sessoes WHERE nome = '" + nome + "' LIMIT 1);"

        conLocal.query(sql, function (err1, result) {  
            if (err1) {
                reject(err1);
            }

            resolve()
        });
    });    
}

function updateSession(req, res){

    let info = req.body.info
    let nome = info.nome
    let status = info.status === "Ativo" ? 1 : 0
    let obs = info.obs
    let lotacao = info.lotacao
 
    let sql = "UPDATE sessoes SET \
                nome = '" + nome + "', \
                status = " + status + ",\
                lotacao = " + lotacao + ",\
                obs = '" + obs + "' \
                WHERE id = " + info.id + ";"

    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;  

        addSessionContinue(req, res)                            
    });

}

function removeSession(req, res){

    let idSession = req.body.idSession

    let promises = []

    let sql1 = "DELETE FROM sessoes WHERE id = " + idSession + " LIMIT 1;";
    let sql2 = "DELETE FROM sessoes_produtos WHERE id_sessao = " + idSession + ";";

    let dbquery1 = conLocal.query(sql1, function (err1, result) {  
        if (err1) throw err1;
    });

    let dbquery2 = conLocal.query(sql2, function (err1, result) {  
        if (err1) throw err1;
    });

    promises.push(dbquery1)
    promises.push(dbquery2)

    Promise.all(promises).then(() => {
        res.json({"success": 1});         
    });        
}

function getSessionsTicket(req, res){

    let sql = "SELECT *  FROM sessoes \
        INNER JOIN sessoes_produtos ON sessoes_produtos.id_sessao = sessoes.id \
            WHERE sessoes_produtos.id_produto = " + req.body.idProduto + ";"
        
    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
}

function getSessionsTicketTotal(req, res){

    let nowstr = moment().format('YYYY-MM-DD')
    let endstr = moment().format('YYYY-MM-DD')

    nowstr += 'T00:00:00'
    endstr += 'T23:59:59'

    let sql = "SELECT COUNT(fk_id_estoque_utilizavel) AS lotacaoAtual \
        FROM 3a_log_vendas \
        INNER join 3a_produto ON 3a_produto.id_produto = 3a_log_vendas.fk_id_produto \
        INNER join 3a_tipo_produto ON 3a_tipo_produto.id_tipo_produto = 3a_produto.fk_id_tipo_produto \
            WHERE 3a_tipo_produto.id_tipo_produto = " + req.body.idTipoProduto + " \
            AND data_log_venda BETWEEN '" + nowstr + "' AND '" + endstr  + "';"
        
    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
}

app.post('/getAllOrders', function(req, res) {    

    let start = req.body.start
    let end = req.body.end

    let sql = "SELECT * FROM vendas_online WHERE datetime BETWEEN '" + start + "' AND '" + end + "';"
    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
});

app.post('/getAllOrdersByName', function(req, res) {

    let name = req.body.name
    let start = req.body.start
    let end = req.body.end

    let sql = "SELECT * \
        FROM vendas_online \
        WHERE _billing_first_name LIKE '%" + name + "%' \
        AND datetime BETWEEN '" + start + "' AND '" + end + "';"

    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
        res.json({"success": result});  
    });
});

app.post('/getAllOrdersByCPF', function(req, res) {

    let name = req.body.name
    let start = req.body.start
    let end = req.body.end

    let sql = "SELECT * \
        FROM vendas_online \
        WHERE _billing_cpf LIKE '%" + name + "%' \
        AND datetime BETWEEN '" + start + "' AND '" + end + "';"

    log_(sql)

    conLocal.query(sql, function (err1, result) {  
        if (err1) throw err1;
        res.json({"success": result});  
    });
});

app.post('/sendEmail', function(req, res) {    

    let idTicket = req.body.idTicket
    let filename_ = idTicket + '.png'
    let path_ = './qrcodes/' + filename_
    
    generateQrCode(idTicket)

    let emailAddr = req.body.email

    let email = {
        from: emailFrom, 
        to: emailAddr, 
        subject: emailSubject, 
        html:  msgEmail,
        attachments: {filename: filename_, path: path_}
    };

    transporte.sendMail(email, function(err, info){
        if(err)
            throw err;    

        console.log('Email enviado! Leia as informações adicionais: ', info);
        res.json({"success": "true"});
    });    
});

app.post('/printTicket', function(req, res) {    
       
    let userName = req.body.userName
    let finalValue = req.body.finalValue        
    let ticket = req.body.ticket    

    let nome_produto = ticket.nome_produto
    let valor_produto = ticket.valor_produto
    let data_log_venda = ticket.data_log_venda
    let fk_id_estoque_utilizavel = ticket.fk_id_estoque_utilizavel
    
    printFile(nome_produto, valor_produto, userName, data_log_venda, fk_id_estoque_utilizavel, finalValue, 0)
    res.json({"success": "true"});  
});

app.post('/printTicketMultiple', function(req, res) {    
    let tickets = req.body.tickets
    let userName = req.body.userName
    let reprint = req.body.reprint
    let promises = []

    for (var i = 0, len = tickets.length; i < len; ++i) {
        
        let promise =  new Promise((resolve) => {

            let ticket = tickets[i]         
            let nome_produto = ticket.nome_produto
            let valor_produto = ticket.valor_produto
            let data_log_venda = ticket.data_log_venda
            let fk_id_estoque_utilizavel = ticket.fk_id_estoque_utilizavel
            let valor_log_venda = ticket.valor_log_venda

            printFile(nome_produto, valor_produto, userName, data_log_venda, fk_id_estoque_utilizavel, valor_log_venda, reprint)
            resolve()

        });

        promises.push(promise)
        
    }
    
    Promise.all(promises).then(() => {
        res.json({"success": "true"});  
        resolve(console.log(promises.length + ' Todas impressões enviadas com sucesso'))
      });

    
});

app.post('/printTicketOnline', function(req, res) {    
       
    let userName = req.body.userName
    let finalValue = req.body.finalValue        
    let ticket = req.body.ticket    

    let nome_produto = ticket.nome_produto
    let valor_produto = ticket.valor_produto
    let data_log_venda = ticket.data_log_venda
    let fk_id_estoque_utilizavel = ticket.fk_id_estoque_utilizavel
    
    printFile(nome_produto, valor_produto, userName, data_log_venda, fk_id_estoque_utilizavel, finalValue, 0)
    res.json({"success": "true"});  
});

app.post('/printTicketMultipleOnline', function(req, res) {    
    
    let tickets = req.body.tickets
    let userName = req.body.userName
    let reprint = req.body.reprint

    for (var i = 0, len = tickets.length; i < len; ++i) {
        
        let ticket = tickets[i]         

        let nome_produto = ticket.nome_produto
        let valor_produto = ticket.valor_produto
        let data_log_venda = ticket.data_log_venda
        let fk_id_estoque_utilizavel = ticket.fk_id_estoque_utilizavel
        let valor_log_venda = ticket.valor_log_venda

        printFile(nome_produto, valor_produto, userName, data_log_venda, fk_id_estoque_utilizavel, valor_log_venda, reprint)
    }
    
    res.json({"success": "true"});  
});

app.post('/getAreas', function(req, res) {

    let idTotem = req.body.id

    log_('Totem: '+ idTotem + ' - Verificando informações da areas: ')
            
    let sql = "SELECT 3a_area_venda.* FROM 3a_area_venda;";
    //log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getPaymentsMethods', function(req, res) {

    let idTotem = req.body.id

    log_('Totem: '+ idTotem + ' - Verificando metodos de pagamento: ')
        
    
    let sql = "SELECT 3a_tipo_pagamento.* FROM 3a_tipo_pagamento;";
    //log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getAreasByName', function(req, res) {

    let idTotem = req.body.id
    let name = req.body.name

    log_('Totem: '+ idTotem + ' - Verificando informações da areas por nome: ' + name)
            
    let sql = "SELECT 3a_area_venda.* FROM 3a_area_venda WHERE nome_area_venda LIKE '%" + name + "%';";
    //log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/syncStock', function(req, res) {

    let idTotem = req.body.id    

    log_('Administrador: ' + idTotem + ' - Sincronizando com estoque online do cliente')
            
    let sql = "SELECT p.ID,\
    p.post_title 'nome',\
    MAX(CASE WHEN meta.meta_key = '_stock' THEN meta.meta_value END) 'Stock' \
    FROM wp_posts AS p \
    JOIN wp_postmeta AS meta ON p.ID = meta.post_ID \
    LEFT JOIN \
    ( \
    SELECT pp.id, \
    GROUP_CONCAT(t.name SEPARATOR ' > ') AS name \
    FROM wp_posts AS pp \
    JOIN wp_term_relationships tr ON pp.id = tr.object_id \
    JOIN wp_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id \
    JOIN wp_terms t ON tt.term_id = t.term_id \
    || tt.parent = t.term_id \
    WHERE tt.taxonomy = 'product_cat' \
    GROUP BY pp.id, tt.term_id \
    ) cat ON p.id = cat.id \
    WHERE (p.post_type = 'product' OR p.post_type = 'product_variation') \
    AND meta.meta_key IN ('_stock') \
    AND meta.meta_value is not null \
    GROUP BY p.ID";

    log_(sql)

    con.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getAllProducts', function(req, res) {

    let idTotem = req.body.id    

    log_('Administrador: ' + idTotem + ' - Verificando todos os produtos do cliente')
            
    let sql = "SELECT 3a_produto.*, \
        3a_subtipo_produto.* \
        FROM 3a_produto \
        INNER JOIN 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_produto.fk_id_subtipo_produto \
        INNER JOIN 3a_area_venda_produtos ON 3a_area_venda_produtos.fk_id_produto = 3a_produto.id_produto \
        ORDER BY posicao_produto_imprimivel;";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getProductsAttachments', function(req, res) {

    let idTotem = req.body.id    

    log_('Administrador: ' + idTotem + ' - Verificando todos os produtos com anexo do cliente')
            
    let idUser = req.body.idUser
    let start = req.body.start
    let end = req.body.end    

    let sql = "SELECT *, false AS checked \
            FROM 3a_estoque_utilizavel \
        INNER JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
        INNER JOIN 3a_caixa_registrado ON 3a_caixa_registrado.id_caixa_registrado = 3a_log_vendas.fk_id_caixa_registrado \
        INNER join 3a_produto ON 3a_produto.id_produto = 3a_estoque_utilizavel.fk_id_produto \
        INNER join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_log_vendas.fk_id_subtipo_produto \
        WHERE 3a_log_vendas.fk_id_usuarios = " + idUser + " \
        AND 3a_log_vendas.data_log_venda BETWEEN '" + start + "' AND  '" + end + "' \
        ORDER BY 3a_log_vendas.data_log_venda DESC;"

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });   
});

app.post('/getProductsAreaByName', function(req, res) {

   
    let name = req.body.name
    let idUser = req.body.idUser
    let start = req.body.start
    let end = req.body.end    
    let idTotem = req.body.id    

    log_('Administrador: ' + idTotem + ' - Verificando todos os produtos com anexo do cliente por ticket')                

    let sql = "SELECT *, false AS checked \
            FROM 3a_estoque_utilizavel \
        INNER JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
        INNER JOIN 3a_caixa_registrado ON 3a_caixa_registrado.id_caixa_registrado = 3a_log_vendas.fk_id_caixa_registrado \
        INNER join 3a_produto ON 3a_produto.id_produto = 3a_estoque_utilizavel.fk_id_produto \
        INNER join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_log_vendas.fk_id_subtipo_produto \
        WHERE 3a_log_vendas.fk_id_usuarios = " + idUser + " \
        AND 3a_log_vendas.data_log_venda BETWEEN '" + start + "' AND  '" + end + "' \
        AND 3a_estoque_utilizavel = " + name + "\
        ORDER BY 3a_log_vendas.data_log_venda DESC;"

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });   
});

app.post('/getProductsArea', function(req, res) {

    let idTotem = req.body.id
    let idArea = req.body.idArea

    log_('Totem: '+ idTotem + ' - Verificando produtos da areas: ' + idArea)
            
    let sql = "SELECT 3a_produto.*, \
        0 AS quantity, \
        3a_subtipo_produto.nome_subtipo_produto,\
        0.00 AS valor_total \
        FROM 3a_produto \
        INNER JOIN 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_produto.fk_id_subtipo_produto \
        INNER JOIN 3a_area_venda_produtos ON 3a_area_venda_produtos.fk_id_produto = 3a_produto.id_produto \
        WHERE 3a_area_venda_produtos.fk_id_area_venda = " + idArea + " \
        ORDER BY posicao_produto_imprimivel ASC;";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getProductsAreaByName', function(req, res) {

    let idTotem = req.body.id
    let idArea = req.body.idArea
    let name = req.body.name

    log_('Totem: '+ idTotem + ' - Verificando produtos da areas: ' + idArea)
            
    let sql = "SELECT 3a_produto.*, 0 AS quantity, 0.00 AS valor_total \
        FROM 3a_produto \
        INNER JOIN 3a_area_venda_produtos ON 3a_area_venda_produtos.fk_id_produto = 3a_produto.id_produto \
        WHERE 3a_area_venda_produtos.fk_id_area_venda = " + idArea + " \
        AND 3a_produto.nome_produto LIKE '%" + name + "%' \
        ORDER BY 3a_produto.posicao_produto_imprimivel;";

    //log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getSubtypesProducts', function(req, res) {

    let idTotem = req.body.id
    let idProduct = req.body.idProduct

    log_('Totem: '+ idTotem + ' - Verificando subtipos do produto: ' + idProduct)
            
    let sql = "SELECT 3a_subtipo_produto.*, 0 as quantity \
        FROM 3a_subtipo_produto where fk_id_tipo_produto = " + idProduct + ";";

    //log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/payProducts', function(req, res) {    
    payProduct(req, res)
});

app.post('/getAcls', function(req, res) {    
    
    let sql = "SELECT * FROM 3a_nivel_acesso;";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result, "ip": ipAddressLocal}); 
    });

});

app.post('/getAuth', function(req, res) {    
    let email = req.body.email
    let password = req.body.password    
                
    let sql = "SELECT * FROM 3a_usuarios where login_usuarios = '" + email + "' \
        AND senha_usuarios_pdvi = '" + password + "';";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result, "ip": ipAddressLocal}); 
    });
});

app.post('/getAuthSupervisor', function(req, res) {    
                
    let sql = "SELECT * FROM 3a_usuarios \
        INNER JOIN 3a_nivel_acesso ON  3a_nivel_acesso.id_nivel_acesso = 3a_usuarios.fk_id_nivel_acesso \
        where 3a_nivel_acesso.id_nivel_acesso <= 3;";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
});

app.post('/getTicketParking', function(req, res) {    
    getTicketParking(req, res)    
});

app.post('/getTicketOperator', function(req, res) {
    getTicketOperator(req, res)    
});

app.post('/getTicketOperatorStr', function(req, res) {
    getTicketOperatorStr(req, res)    
});

app.post('/getTicketsCashier', function(req, res) {
    getTicketsCashier(req, res)    
});

app.post('/confirmCashDrain', function(req, res) {    
    confirmCashDrain(req, res)
});

app.post('/confirmCashChange', function(req, res) {    
    confirmCashChange(req, res)
});

app.post('/getCashDrain', function(req, res) {    
    getCashDrain(req, res)
})

app.post('/getCashChange', function(req, res) {    
    let idUser = req.body.idUser 
    let start = req.body.start
    let end = req.body.end   
                
    let sql = "SELECT SUM(valor_inclusao) AS TOTAL \
            FROM 3a_troco where fk_id_usuario = " + idUser + " \
            AND data_inclusao BETWEEN '" + start + "' AND '" + end + "';";
    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
})

app.post('/getTotalTickets', function(req, res) {    
    let idUser = req.body.idUser 
    let start = req.body.start
    let end = req.body.end   
                
    let sql = "SELECT SUM(valor_log_venda) AS TOTAL \
            FROM 3a_log_vendas where fk_id_usuarios = " + idUser + " \
            AND data_log_venda BETWEEN '" + start + "' AND '" + end + "';";
    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
})

app.post('/getLastCashier', function(req, res) {    
    getLastCashierId(req, res)
})

app.post('/getUsers', function(req, res) {    
    getUsers(req, res)    
})

app.post('/getUserByName', function(req, res) {    
    getUsersByName(req, res)    
})

app.post('/changePasswordUser', function(req, res) {    
    let user = req.body.user
    let password = req.body.password    
                
    let sql = "UPDATE 3a_usuarios SET senha_usuarios = '" + password + "', \
        senha_usuarios_pdvi ='" + password + "' WHERE id_usuarios = " + user.id_usuarios + ";";

    log_(sql)

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;           
        res.json({"success": result}); 
    });
})

app.post('/getErrors', function(req, res) {    
    getErros(req, res)    
})

app.post('/recoverPaymentErros', function(req, res) {    
    recoverPaymentErros(req, res)    
})

/**
 * COMANDOS RECEPTOR
 */

app.post('/getAllReceptors', function(req, res) {    
    getAllReceptors(req, res)    
})

app.post('/systemCommand', function(req, res) {    
    systemCommand(req, res)    
})


/**
 * COMANDOS TOTEM ACESSO
 */

app.post('/goAccessTotem', function(req, res) {    
    console.log("Comando recebido!!!!")
    
    systemCommandLocal(req, res)    
});

app.post('/systemCommandLocal', function(req, res) {    
    systemCommandLocal(req, res)    
})


/**********************
 * MULTIPLO - PRE VENDA
 ***************************/

app.post('/checkTicket', function(req, res) {

    let idTotem = req.body.id
    let ticket = req.body.ticket    

    log_('Totem: '+ idTotem + ' - Verificando ticket:', ticket)

    let sql = "SELECT * \
            FROM 3a_estoque_utilizavel \
        LEFT JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
        INNER join 3a_produto ON 3a_produto.id_produto = 3a_estoque_utilizavel.fk_id_produto \
        INNER join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_produto.fk_id_subtipo_produto \
        WHERE 3a_estoque_utilizavel.id_estoque_utilizavel = " + ticket + ";"

    log_(sql)   

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;   
        res.json({"success": result});  
    });              
});

app.post('/checkMultipleTickets', function(req, res) {

    let idTotem = req.body.id
    let ticketStart = req.body.ticketStart
    let ticketEnd = req.body.ticketEnd

    log_('Totem: '+ idTotem + ' - Verificando vários ticket:' + ticketStart + ' até ' + ticketEnd)

    let sql = "SELECT *, 0 AS quantity \
            FROM 3a_estoque_utilizavel \
        LEFT JOIN 3a_log_vendas ON 3a_log_vendas.fk_id_estoque_utilizavel = 3a_estoque_utilizavel.id_estoque_utilizavel \
        INNER join 3a_produto ON 3a_produto.id_produto = 3a_estoque_utilizavel.fk_id_produto \
        INNER join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_produto.fk_id_subtipo_produto \
        WHERE 3a_estoque_utilizavel.id_estoque_utilizavel BETWEEN " + ticketStart + " AND "+ ticketEnd + ";"

    log_(sql)   

    conLocal.query(sql, function (err1, result) {        
        if (err1) throw err1;   
        res.json({"success": result});  
    });              
});

app.post('/useTicketMultiple', function(req, res) {
    useTicketMultiple(req, res)                 
});

app.post('/getSessions', function(req, res) {
    getSessions(req, res)                 
});

app.post('/getSessionsName', function(req, res) {
    getSessionsName(req, res)                 
});

app.post('/getSessionsProducts', function(req, res) {
    getSessionsProducts(req, res)                 
});

app.post('/getProductsTypes', function(req, res) {
    getProductsTypes(req, res)                 
});

app.post('/getProducts', function(req, res) {
    getProducts(req, res)                 
});


app.post('/addSession', function(req, res) {
    addSession(req, res)                 
});

app.post('/addUsers', function(req, res) {
    addUsers(req, res)                 
});

app.post('/updateSession', function(req, res) {
    updateSession(req, res)                 
});

app.post('/removeSession', function(req, res) {
    removeSession(req, res)                 
});

app.post('/getSessionsTicket', function(req, res) {
    getSessionsTicket(req, res)                 
});

app.post('/getSessionsTicketTotal', function(req, res) {
    getSessionsTicketTotal(req, res)                 
});

http.listen(8086);