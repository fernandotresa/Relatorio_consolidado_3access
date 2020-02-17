let mysql = require('mysql');
let express =  require('express');
let app = express();
var moment = require('moment');
const ExcelJS = require('exceljs');

var poolDatabases = []

var diretorioArquivos = "/tmp/"
var rowGeral = 2    
//var dataInicio = moment().add(-1, 'month').format()
//var dataFinal = moment().add(1, 'month').format()

var dataInicio = moment("2020-01-16T00:00:00").format()
var dataFinal = moment("2020-01-31T23:59:59").format()

var workbook = new ExcelJS.Workbook();
var worksheet = workbook.addWorksheet('Relatório Consolidado');

var poolDatabaseNames = [
        "intervales", 
        "aguapei", 
        "anchieta", 
        "carlosbotelho", 
        "cavernadodiabo", 
        "itatins", 
        "itingucu", 
        "morrododiabo", 
        "pesm_caminhosdomar",
        "pesm_caraguatatuba", 
        "pesm_cunha", 
        "pesm_picinguaba", 
        "pesm_santavirginia", 
        "petar_caboclos", 
        "petar_ouro_grosso", 
        "petar_santana"
    ]

function startExcel(){

    worksheet.columns = [
        { header: 'Data da Venda', key: 'data_log_venda', width: 25 },
        { header: 'Data do agendamento', key: 'data_utilizacao', width: 25 },
        { header: 'Número do Pedido', key: 'ip_maquina_venda', width: 25 },
        { header: 'Número de Ingresso', key: 'id_estoque_utilizavel', width: 25 },
        { header: 'Tipo de Ingresso / Hospedagem', key: 'tipoDeIngresso', width: 25 },
        { header: 'Tipo do Produto', key: 'nome_tipo_produto', width: 25 },
        { header: 'Subtipo de Ingresso', key: 'nome_subtipo_produto', width: 25 },
        { header: 'Valor', key: 'valor_produto', width: 25 },
        { header: 'Tipo de Pagamento', key: 'tipoPagamento', width: 25 },
        { header: 'Centro de Custo', key: 'centroCustoStr', width: 25 },
        { header: 'Nome do Parque', key: 'nomeParque', width: 25 },
        { header: 'Núcleo do Parque', key: 'nucleoParque', width: 35 },
        { header: 'Data de Utilização', key: 'data_log_utilizacao', width: 25 }        
      ];        
}

function startPool(){    

    return new Promise(function(resolve, reject){ 

        log_('Iniciando Pool de banco de dados: ' + poolDatabaseNames)

        let promises = []

        for(let i = 0; i < poolDatabaseNames.length; i++){
        
            let promise = new Promise(function(resolvePool){ 
        
                var db_config = {
                    //host: "34.192.13.231",
                    host: "3.212.93.86",                    
                    user: "root",
                    password: "Mudaragora00",
                    database: poolDatabaseNames[i]
                };
                            
                resolvePool(poolDatabases.push(db_config))
        
            })
        
            promises.push(promise)                   
            resolve()
            
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
                        log_("Database conectado: " + poolDatabaseNames[i])
                        
                        getInfoVendas(con)

                        .then((result) => {                                                        

                            log_("Resultado do database: " + poolDatabaseNames[i] + '. Total: ' + result.length)  

                            if(result.length === 0){                                    
                                resolve()
                            }
                            else {                                

                                popularExcel(result, i)
                                .then(() => {

                                    resolve()
                                })

                            }                            

                        })

                        .catch((error => {                
                            resolve(error)
                        }))

                    }
                    
                    
                });
                
            })


            promises.push(promise)
            
        }

        Promise.all(promises)
        .then(() => {

            log_("Todos os bancos foram consultados com sucesso!")     

            salvaExcel()

            .then( ()=>{

                log_("Finalizando o app. Tenha um ótimo dia!")     
                process.exit(0)       
            })
            
            

        })
        .catch((error) => {
            resolve(error)
        });

    })        
}


function salvaExcel(){

    return new Promise(function(resolve, reject){

        let filename = diretorioArquivos + 'Relatorio.xlsx'
        console.log('Escrevendo no arquivo: ' + filename)    
        
        workbook.xlsx.writeFile(filename)
        .then(() => {
            
            resolve()
        })            
        
    })    
}

function startInterface(){
    log_('Iniciando aplicativo. Preparando databases')
    startExcel()
    startPool()          
}

function log_(str){
    let now = moment().format("DD/MM/YYYY hh:mm:ss")
    let msg = "[" + now + "] " + str
    console.log(msg)
}

function getInfoVendas(con){


    return new Promise(function(resolve, reject){

        let sql = "SELECT * \
                FROM 3a_log_vendas \
                LEFT JOIN 3a_estoque_utilizavel ON 3a_estoque_utilizavel.id_estoque_utilizavel = 3a_log_vendas.fk_id_estoque_utilizavel \
                LEFT JOIN 3a_produto ON 3a_produto.id_produto = 3a_log_vendas.fk_id_produto \
                LEFT JOIN 3a_tipo_produto ON 3a_tipo_produto.id_tipo_produto = 3a_produto.fk_id_tipo_produto \
                LEFT join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_log_vendas.fk_id_subtipo_produto \
                LEFT JOIN 3a_tipo_pagamento ON 3a_tipo_pagamento.id_tipo_pagamento = 3a_log_vendas.fk_id_tipo_pagamento \
                LEFT JOIN 3a_log_utilizacao ON 3a_log_utilizacao.fk_id_estoque_utilizavel = 3a_log_vendas.fk_id_estoque_utilizavel \
                WHERE 3a_log_vendas.data_log_venda BETWEEN '" + dataInicio + "' AND  '" + dataFinal + "';"


        //log_(sql)

        con.query(sql, function (err, result) {        
            if (err){
                reject(err);
            }
            

            resolve(result)

        });

    })
}

async function popularExcel(result, index){

    return new Promise(function(resolve, reject){    
        
        let promises = []

        log_("Populando excel para: " + poolDatabaseNames[index] + '. Total: ' + result.length)  

        for(var i = 0; i < result.length; i++){  
            
            rowGeral++

            let promise = new Promise(function(resolveExcel){ 

                let element = result[i]
                
                let data_log_venda = element.data_log_venda
                let data_utilizacao = element.data_utilizacao
                let data_log_utilizacao = element.data_log_utilizacao
                let ip_maquina_venda = element.ip_maquina_venda                
                let id_estoque_utilizavel = element.id_estoque_utilizavel                            
                let nome_tipo_produto = element.nome_tipo_produto
                let nome_subtipo_produto = element.nome_subtipo_produto
                let valor_produto = element.valor_produto         
                let tipoPagamento = element.nome_tipo_pagamento
                let centroCustoStr = element.centro_de_custo
                let nomeParque = element.nome_do_parque
                let nucleoParque = element.nucleo_do_parque
                let nome_produto = element.nome_produto
                let tipoDeIngresso = nome_produto.includes("HOSPEDARIA") ? "Hospedaria" : "Ingressos"

                if(data_utilizacao.length === 0 || data_utilizacao === '0000-00-00 00:00:00')
                    data_utilizacao = data_log_venda

             
               // console.log(rowGeral, id_estoque_utilizavel, tipoDeIngresso, nomeParque, centroCustoStr,  nucleoParque)                            

                worksheet.addRow({
                        id: 1, 
                        data_log_venda: data_log_venda, 
                        data_utilizacao: data_utilizacao, 
                        ip_maquina_venda: ip_maquina_venda, 
                        id_estoque_utilizavel: id_estoque_utilizavel, 
                        tipoDeIngresso: tipoDeIngresso, 
                        nome_tipo_produto: nome_tipo_produto, 
                        nome_subtipo_produto: nome_subtipo_produto, 
                        valor_produto: valor_produto, 
                        tipoPagamento: tipoPagamento, 
                        centroCustoStr: centroCustoStr, 
                        nomeParque: nomeParque, 
                        nucleoParque: nucleoParque, 
                        data_log_utilizacao: data_log_utilizacao

                    })
                    
                        
                 resolveExcel()
            })
            

            promises.push(promise)
        }


     Promise.all(promises)
        .then((result) => {    


            resolve("Sucesso ao adicionar gerar excel do banco " + poolDatabaseNames[index])                    

            
        })
        .catch(() => {            
            resolve("Erro ao adicionar gerar excel do banco " + poolDatabaseNames[index])
        })
        
    })


    
}


startInterface();

