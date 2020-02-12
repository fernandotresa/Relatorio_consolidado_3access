let mysql = require('mysql');
let express =  require('express');
let app = express();
var moment = require('moment');
const xl = require('excel4node');

var poolDatabaseNames = ["3access", "aguapei", "anchieta", "carlosbotelho", "cavernadodiabo", "itatins", "itingucu", "morrododiabo", "pesm_caminhosdomar", "pesm_caraguatatuba", "pesm_cunha", "pesm_picinguaba", "pesm_santavirginia", "petar_caboclos", "petar_ouro_grosso", "petar_santana"]
var poolDatabases = []
var poolDatabasesCon = []

var dataInicio = moment().add(-1, 'month').format()
var dataFinal = moment().add(1, 'month').format()
var workbook = new xl.Workbook();
var worksheet = workbook.addWorksheet('Sheet 1');

// Create a reusable style
var style = workbook.createStyle({
    font: {
      color: '#FF0800',
      size: 12
    },
  });   

function startPool(){    

    return new Promise(function(resolve, reject){ 

        log_('Iniciando Pool de banco de dados: ' + poolDatabaseNames)

        let promises = []

        for(var i = 0; i < poolDatabaseNames.length; i++){
        
            let promise = new Promise(function(resolvePool){ 
        
                var db_config = {
                    host: "34.192.13.231",
                    user: "root",
                    password: "Mudaragora00",
                    database: poolDatabaseNames[i]
                };
                            
                resolvePool(poolDatabases.push(db_config))
        
            })
        
            promises.push(promise)                   
            
        }

        Promise.all(promises)
        .then(() => {    

            handleDisconnects()

            .then(() => {                
                resolve("Conexões criadas com sucesso! Total de bancos conectados: " + poolDatabases.length)

            })
            .catch(() => {                

                reject("Erro ao criar conexões no pool")
            });                        
        })
        .catch(() => {            
            reject("Erro ao adicionar no poool")
        })

    })
}


function handleDisconnects() {

    return new Promise(function(resolve, reject){ 

        let promises = []

        for(let i = 0; i < poolDatabases.length; i++){

            let promise = new Promise(function(resolve, reject){ 

                let con = mysql.createConnection(poolDatabases[i]);               

                con.connect(function(err) {
                    if(err){
                        reject('Erro no banco de dados: ' + err);
                    }
                    else {
                        log_("Database conectado! Aguardando conexões: " + poolDatabaseNames[i])
                        resolve(poolDatabasesCon.push(con))
                    }
                    
                    
                });
                
            })


            promises.push(promise)
            
        }

        Promise.all(promises)
        .then(() => {

            log_("Todos os bancos foram conectados com sucesso!")

            iniciaRelatorio()

            .then(() => {
                resolve()
            })
            .catch((error) => {
                reject(error)
            });

        })
        .catch((error) => {
            reject(error)
        });

        })        
}

function startInterface(){
    log_('Iniciando aplicativo. Preparando databases')

    startPool()      

    .then(() => {        
        log_('Finalizado com sucesso')

    })
    .catch((error => {
        log_(error)
    }))
}

function log_(str){
    let now = moment().format("DD/MM/YYYY hh:mm:ss")
    let msg = "[" + now + "] " + str
    console.log(msg)
}

function iniciaRelatorio(){

    return new Promise(function(resolveFinal, rejectFinal){ 

        log_('Iniciando relatório')

        let promises = []

        for(let i = 0; i < poolDatabasesCon.length; i++){

            let promise = new Promise(function(resolve, reject){         

                let con = poolDatabasesCon[i]

                getInfoVendas(con)

                .then((result) => {

                    popularExcel(result)

                    .then(() => {
                        //workbook.write('Excel.xlsx');
                        resolve()
                    })
                    
                    .catch((error => {                
                        reject(error)
                    }))
                    
                })

                .catch((error => {                
                    reject(error)
                }))
                
            })

            promises.push(promise)        
        }
            
        
        Promise.all(promises)
        .then(() => {
            
            resolveFinal("Todos os relatórios emitidos com sucesso")

        })
        .catch((error) => {

            rejectFinal("Falha ao emitir relatório no banco de dados. Erro: " + error)
        }); 

        })

       
}

function getInfoVendas(con){


    return new Promise(function(resolve, reject){

        let sql = "SELECT * \
                FROM 3a_log_vendas \
                INNER JOIN 3a_produto ON 3a_produto.id_produto = 3a_log_vendas.fk_id_produto \
                INNER JOIN 3a_tipo_produto ON 3a_tipo_produto.id_tipo_produto = 3a_produto.fk_id_tipo_produto \
                INNER join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_log_vendas.fk_id_subtipo_produto \
                INNER JOIN 3a_log_utilizacao ON 3a_log_utilizacao.fk_id_estoque_utilizavel = 3a_log_vendas.fk_id_estoque_utilizavel \
                WHERE 3a_log_vendas.data_log_venda BETWEEN '" + dataInicio + "' AND  '" + dataFinal + "' \
                ORDER BY 3a_log_vendas.data_log_venda DESC;"


        log_(sql)

        con.query(sql, function (err, result) {        
            if (err){
                console.log(err)
                reject(err);
            }

            con.end()
            resolve(result)

        });

    })
}

function popularExcel(result){

    return new Promise(function(resolve, reject){    
        
        
        if(result[0]){

            let data_log_venda = result[0].data_log_venda
            let data_log_utilizacao = result[0].data_log_utilizacao
            let fk_id_estoque_utilizavel = result[0].fk_id_estoque_utilizavel            
            let nome_tipo_produto = result[0].nome_tipo_produto
            let nome_subtipo_produto = result[0].nome_subtipo_produto
            let valor_produto = result[0].valor_produto                      
            
            console.log(data_log_venda, data_log_utilizacao, fk_id_estoque_utilizavel, nome_tipo_produto, nome_subtipo_produto, valor_produto)            
    
           // worksheet.cell(1,1).string(data_log_venda).style(style);
           // worksheet.cell(1,2).number(fk_id_estoque_utilizavel).style(style);


            resolve()
        }

        else {
            reject("Não foi possível realizar consulta no banco")
        }
        
    })
    
}


startInterface();

