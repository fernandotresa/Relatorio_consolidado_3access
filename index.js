let mysql = require('mysql');
let express =  require('express');
let app = express();
var moment = require('moment');

var poolDatabaseNames = ["3access", "aguapei", "anchieta", "carlosbotelho", "cavernadodiabo", "itatins", "itingucu", "morrododiabo", "pesm_caminhosdomar", "pesm_caraguatatuba", "pesm_cunha", "pesm_picinguaba", "pesm_santavirginia", "petar_caboclos", "petar_ouro_grosso", "petar_santana"]
var poolDatabases = []
var poolDatabasesCon = []

var dataInicio = moment().format()
var dataFinal = moment().add(1, 'month').format()


function startPool(){

    console.log('Iniciando Pool: ' + poolDatabaseNames, poolDatabaseNames.length)

    return new Promise(function(resolve, reject){ 

        let promises = []

        for(var i = 0; i < poolDatabaseNames.length; i++){
        
            let promise = new Promise(function(resolvePool){ 
        
                var db_config = {
                    host: "34.192.13.231",
                    user: "root",
                    password: "Mudaragora00",
                    database: poolDatabaseNames[i]
                };
            
                console.log('Adicionando ', db_config)       

                resolvePool(poolDatabases.push(db_config))
        
            })
        
            promises.push(promise)                   
            
        }

        Promise.all(promises)
        .then(() => {
    
            console.log("Pool de bancos de dados criado com sucesso")            
            console.log(poolDatabases)

            handleDisconnects();        

            resolve()
    
        })

    })
}


function handleDisconnects() {

    let promises = []
    console.log('Criando conexoes', poolDatabases)

    for(let i = 0; i < poolDatabases.length; i++){

        let promise = new Promise(function(resolve, reject){ 

            let con = mysql.createConnection(poolDatabaseNames[i]);               

            con.connect(function(err) {
    
                con.on('error', function(err) {    
                    reject(err);                
                });
                
                log_("Database conectado! Aguardando conexões: " + poolDatabaseNames[i])
    
                resolve(poolDatabasesCon.push(con))
            });
            
        })


        promises.push(promise)
        
    }

    Promise.all(promises)
    .then(() => {

        console.log("Todos os bancos de dados conectados com sucesso")
        iniciaRelatorio()

    })
    .catch((error) => {

        console.log("Falha ao conectar no banco de dados. Erro: " + error)
    });

    
}

function startInterface(){
    console.log('Iniciando aplicativo')

    startPool()      
}

function log_(str){
    let now = moment().format("DD/MM/YYYY hh:mm:ss")
    let msg = "[" + now + "] " + str
    console.log(msg)
}

function iniciaRelatorio(){

    console.log('Iniciando relatório')
    let promises = []

    for(let i = 0; i < poolDatabasesCon.length; i++){

        let promise = new Promise(function(resolve, reject){         

            let con = poolDatabasesCon[i]
            getInfoVendas(con)
            resolve()
        })

        promises.push(promise)        
    }
        
    
    Promise.all(promises)
    .then(() => {

        console.log("Todos os relatórios emitidos com sucesso")

    })
    .catch((error) => {

        console.log("Falha ao emitir relatório no banco de dados. Erro: " + error)
    });

    

}

function getInfoVendas(con){
         
    let sql = "SELECT fk_id_estoque_utilizavel FROM 3a_log_vendas \
                WHERE 3a_log_vendas.data_log_venda BETWEEN '" + dataInicio + "' AND  '" + dataFinal + "' \
                ORDER BY 3a_log_vendas.data_log_venda DESC;"


    log_(sql)

    con.query(sql, function (err, result) {        

        console.log(err)
        if (err) throw err;

        console.log(result); 
    });
}


startInterface();

