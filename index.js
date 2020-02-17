let mysql = require('mysql');
let express =  require('express');
let app = express();
var moment = require('moment');
const ExcelJS = require('exceljs');
let bodyParser = require('body-parser');
let logger = require('morgan');
let methodOverride = require('method-override')
let cors = require('cors');

let http = require('http').Server(app);

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(cors());

var workbook = new ExcelJS.Workbook();
var worksheet = workbook.addWorksheet('Relatório Consolidado');

var poolDatabases = []
var poolConnections = []
var diretorioArquivos = "/tmp/"

var conPrincipal

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

function iniciaDbPrincipal(){

    var db_config = {
        host: "3.212.93.86",                    
        user: "root",
        password: "Mudaragora00",
        database: "relatorios"
    };
    
    conPrincipal = mysql.createConnection(db_config);               
    
    conPrincipal.connect(function(err) {
        if(err){
            log_('Erro no banco de dados de relatórios: ' + err);
        }
    
        else {
            log_("Database relatórios conectado com sucesso")   
        }                                        
    });
    
}

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

        log_('Iniciando Pool de banco de dados: ' + poolDatabaseNames + '. Total: ' + poolDatabaseNames.length)

        let promises = []

        for(let i = 0; i < poolDatabaseNames.length; i++){
        
            let promise = new Promise(function(resolvePool){ 
        
                var db_config = {
                    host: "3.212.93.86",                    
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
                        log_("Database conectado: " + poolDatabaseNames[i])   
                        poolConnections.push(con)                                             
                        resolve()

                    }                                        
                });
                
            })


            promises.push(promise)
            
        }

        Promise.all(promises)
        .then(() => {

            log_("Todos os bancos foram consultados com sucesso!")     
            resolve()
            
        })
        .catch((error) => {
            console.log(error)
            reject(error)
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
    
    iniciaDbPrincipal()

    startExcel()

    startPool()

    .then(() => {

        log_("Banco de dados iniciados com sucesso. Escutando conexoes...")        
        http.listen(8085);  
    })    
}

function geraRelatorio(req, res){
        
    let promises = []

    salvaRelatorio(req)

    .then((datetime) => {

        log_("Identificação do relatório: " + datetime)

        for(let i = 0; i < poolConnections.length; i++){            
            let promise = iniciaRelatorio(i, req)
            promises.push(promise)
        }    
        
        Promise.all(promises)
    
            .then(() => {    
    
                salvaExcel()
                .then(() => {
    
                    finalizaRelatorio(datetime)

                    .then(() => {

                        res.json({"success": true});     
                    })
                    
                })
                
        }) 

    })       
}


function salvaRelatorio(req){

    return new Promise(function(resolve, reject){ 

        let datetime = moment().format("YYYY-MM-DDThh:mm:ss")

        var sql = "INSERT INTO consolidados (datetime, dataInicio, dataFim) \
                VALUES ('" + datetime + "', '" + req.body.dataInicial + "', '" + req.body.dataFinal + "')"

        log_(sql)
        
        conPrincipal.query(sql, function (err, result) {        
            if (err){
                reject(err);
            }

            resolve(datetime)

        });
    })

}

function finalizaRelatorio(datetime){

    return new Promise(function(resolve, reject){         

        var sql = "UPDATE consolidados SET \
                dataFim = '" + moment().format("YYYY-MM-DDThh:mm:ss") + "',\
                status = 'Finalizado' \
            WHERE datetime = '" + datetime + "'"

        log_(sql)
        
        conPrincipal.query(sql, function (err, result) {        
            if (err){
                reject(err);
            }

            resolve(datetime)

        });
    })

}


function iniciaRelatorio(index, req){

    return new Promise(function(resolve, reject){     
        
        let con = poolConnections[index]

        getInfoVendas(con, req)

        .then((result) => {        
            
            log_("Total da consulta do banco " + poolDatabaseNames[index] + '. Total: ' + result.length)
            
            if(result.length === 0){                                    
                log_("Resultado vazio para o banco " + poolDatabaseNames[index])
                resolve()
            }
            else {                                

                log_("Gerando relatório do banco " + poolDatabaseNames[index])

                popularExcel(result)

                .then(() => {
                    resolve()   
                })

            }                            
        })

        .catch((error => {            
            log_(error)    
        })) 

    })

    
}

function log_(str){
    let now = moment().format("DD/MM/YYYY hh:mm:ss")
    let msg = "[" + now + "] " + str
    console.log(msg)
}

function getInfoVendas(con, req){


    return new Promise(function(resolve, reject){

        var dataInicio = moment(req.body.dataInicial).format()
        var dataFinal = moment(req.body.dataFinal).format()   

        let sql = "SELECT * \
                FROM 3a_log_vendas \
                LEFT JOIN 3a_estoque_utilizavel ON 3a_estoque_utilizavel.id_estoque_utilizavel = 3a_log_vendas.fk_id_estoque_utilizavel \
                LEFT JOIN 3a_produto ON 3a_produto.id_produto = 3a_log_vendas.fk_id_produto \
                LEFT JOIN 3a_tipo_produto ON 3a_tipo_produto.id_tipo_produto = 3a_produto.fk_id_tipo_produto \
                LEFT join 3a_subtipo_produto ON 3a_subtipo_produto.id_subtipo_produto = 3a_log_vendas.fk_id_subtipo_produto \
                LEFT JOIN 3a_tipo_pagamento ON 3a_tipo_pagamento.id_tipo_pagamento = 3a_log_vendas.fk_id_tipo_pagamento \
                LEFT JOIN 3a_log_utilizacao ON 3a_log_utilizacao.fk_id_estoque_utilizavel = 3a_log_vendas.fk_id_estoque_utilizavel \
                WHERE 3a_log_vendas.data_log_venda BETWEEN '" + dataInicio + "' AND  '" + dataFinal + "';"


        log_(sql)

        con.query(sql, function (err, result) {        
            if (err){
                reject(err);
            }

            resolve(result)

        });

    })
}

async function popularExcel(result){

    return new Promise(function(resolve, reject){    
        
        let promises = []

        for(var i = 0; i < result.length; i++){  
            
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

             
                //console.log(id_estoque_utilizavel, tipoDeIngresso, nomeParque, centroCustoStr,  nucleoParque)                            

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
        .then(() => {    
            resolve()                    


            
        })
        .catch(() => {            
            resolve()
        })
        
    })    
}

app.post('/novoRelatorio', function(req, res) {
    geraRelatorio(req, res)                     
});

app.post('/pegaRelatorio', function(req, res) {
    getSessionsTicketTotal(req, res)                 
});

process.on('SIGINT', function() {
    console.log("Caught interrupt signal");
    process.exit();
});

startInterface()


