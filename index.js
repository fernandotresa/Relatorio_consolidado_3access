let mysql = require('mysql');
let express =  require('express');
let app = express();
var moment = require('moment');
const xl = require('excel4node');

var poolDatabases = []

var diretorioArquivos = "/tmp/"
var rowGeral = 2    
//var dataInicio = moment().add(-1, 'month').format()
//var dataFinal = moment().add(1, 'month').format()

var dataInicio = moment("2020-01-15T00:00:00").format()
var dataFinal = moment("2020-01-31T23:59:59").format()

var workbook = new xl.Workbook();
var worksheet = workbook.addWorksheet('Relatorio');

var styleHeader = workbook.createStyle({
    alignment: {
        horizontal: 'center'
    },
    font: {
        name: 'Arial',
        bold: true,
        color: '000000',
        size: 11
    },
  }); 

var style = workbook.createStyle({
    alignment: {
        horizontal: 'center'
    },
    font: {
        name: 'Arial',
        color: '000000',
        size: 11
    },    
  }); 
  
  
 var styleDinheiro = workbook.createStyle({
    alignment: {
        horizontal: 'center'
    },
    font: {
        name: 'Arial',
        color: '000000',
        size: 11
    },
    numberFormat: 'R$#,##0.00; (R$#,##0.00); -',
  });  

  

var poolDatabaseNames = [
        "3access", 
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

var centroCusto = [
        "540007", 
        "540007", 
        "540007", 
        "540007", 
        "540007", 
        "540007", 
        "540007", 
        "540007", 
        "540007",
        "540007", 
        "540007", 
        "540007", 
        "540007", 
        "540007", 
        "540007", 
        "540007"
]

var clientNames = [
    "3access", 
    "Aguapei", 
    "Anchieta", 
    "Carlos Botelho", 
    "Caverna Do Diabo", 
    "Itatins", 
    "Itingucu", 
    "Morro Do Diabo", 
    "Caminhos Do Mar",
    "Caraguatatuba", 
    "Cunha", 
    "Picinguaba", 
    "Santa Virginia", 
    "Caboclos", 
    "Ouro Grosso", 
    "Santana"
]

function startExcel(){
    
    worksheet.cell(1, 1).string('Data da Venda').style(styleHeader);
    worksheet.cell(1, 2).string('Data do agendamento').style(styleHeader);
    worksheet.cell(1, 3).string('Número do Pedido').style(styleHeader);
    worksheet.cell(1, 4).string('Número de Ingresso').style(styleHeader);
    worksheet.cell(1, 5).string('Tipo de Ingresso / Hospedagem').style(styleHeader);
    worksheet.cell(1, 6).string('Tipo do Produto').style(styleHeader);
    worksheet.cell(1, 7).string('Subtipo de Ingresso').style(styleHeader);
    worksheet.cell(1, 8).string('Valor').style(styleHeader);
    worksheet.cell(1, 9).string('Tipo de Pagamento').style(styleHeader); 
    worksheet.cell(1, 10).string('Centro de Custo').style(styleHeader); 
    worksheet.cell(1, 11).string('Nome do Parque').style(styleHeader); 
    worksheet.cell(1, 12).string('Núcleo do Parque').style(styleHeader); 
    worksheet.cell(1, 13).string('Data de Utilização').style(styleHeader);


    worksheet.column(1).setWidth(25);
    worksheet.column(2).setWidth(25);
    worksheet.column(3).setWidth(15);
    worksheet.column(4).setWidth(25);
    worksheet.column(5).setWidth(30);
    worksheet.column(6).setWidth(30);
    worksheet.column(7).setWidth(30);
    worksheet.column(8).setWidth(15);
    worksheet.column(9).setWidth(15);
    worksheet.column(10).setWidth(25);
    worksheet.column(11).setWidth(25);
    worksheet.column(12).setWidth(25);
    worksheet.column(13).setWidth(25);

    worksheet.row(1).setHeight(25); 
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
        
        workbook.write(filename, function(err, stats) {
            if (err) {
                reject(err);
            } else {
                resolve(stats);               
            }
          });
        
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

        for(var i = 0; i < result.length; i++){  
            
            rowGeral++

            let promise = new Promise(function(resolveExcel){ 

                let element = result[i]
                
                let data_log_venda = element.data_log_venda
                let data_utilizacao = element.data_utilizacao
                let data_log_utilizacao = element.data_log_utilizacao
                let ip_maquina_venda = element.ip_maquina_venda
                let tipoDeIngresso = "Ingressos"
                let id_estoque_utilizavel = element.id_estoque_utilizavel            
                let nome_tipo_produto = element.nome_tipo_produto
                let nome_subtipo_produto = element.nome_subtipo_produto
                let valor_produto = element.valor_produto         
                let tipoPagamento = "ONLINE"
                let centroCustoStr = centroCusto[index]
                let nomeParque = clientNames[index]
                let nucleoParque = clientNames[index]     
             
                console.log(nomeParque, rowGeral, id_estoque_utilizavel, data_log_venda, data_log_utilizacao, data_utilizacao, nome_tipo_produto, nome_subtipo_produto, valor_produto)                            

                let col = 1                

                if(! data_log_venda || data_log_venda.length === 0)
                    worksheet.cell(rowGeral, col++).string("").style(style);
                 else 
                    worksheet.cell(rowGeral, col++).date(data_log_venda).style(style);                

                if(! data_utilizacao || data_utilizacao.length === 0)
                    worksheet.cell(rowGeral, col++).string("").style(style);
                else 
                    worksheet.cell(rowGeral, col++).date(data_utilizacao).style(style);                
        
                if(! ip_maquina_venda || ip_maquina_venda.length === 0)
                    worksheet.cell(rowGeral, col++).string("").style(style);
                else 
                    worksheet.cell(rowGeral, col++).string(ip_maquina_venda).style(style);

                if(! id_estoque_utilizavel || id_estoque_utilizavel.length === 0)
                    worksheet.cell(rowGeral, col++).string("").style(style);
                else 
                    worksheet.cell(rowGeral, col++).number(id_estoque_utilizavel).style(style);

                worksheet.cell(rowGeral, col++).string(tipoDeIngresso).style(style);                    
                            
                if(! nome_tipo_produto || nome_tipo_produto.length === 0)
                    worksheet.cell(rowGeral, col++).string("").style(style);
                else 
                    worksheet.cell(rowGeral, col++).string(nome_tipo_produto).style(style);

                if(! nome_subtipo_produto || nome_subtipo_produto.length === 0)
                    worksheet.cell(rowGeral, col++).string("").style(style);
                else 
                    worksheet.cell(rowGeral, col++).string(nome_subtipo_produto).style(style);                                
                
                if(! valor_produto || valor_produto.length === 0)
                    worksheet.cell(rowGeral, col++).string("R$ 0").style(style);
                else 
                    worksheet.cell(rowGeral, col++).number(valor_produto).style(styleDinheiro);

                worksheet.cell(rowGeral, col++).string(tipoPagamento).style(style);

                if(! centroCustoStr || centroCustoStr.length === 0)
                    worksheet.cell(rowGeral, col++).string("").style(style);
                else 
                    worksheet.cell(rowGeral, col++).string(centroCustoStr).style(style);
                                                
                if(! nomeParque || nomeParque.length === 0)
                    worksheet.cell(rowGeral, col++).string("").style(style);
                else 
                    worksheet.cell(rowGeral, col++).string(nomeParque).style(style);             
                
                if(! nucleoParque || nucleoParque.length === 0)
                    worksheet.cell(rowGeral, col++).string("").style(style);
                else 
                    worksheet.cell(rowGeral, col++).string(nucleoParque).style(style);

                if(! data_log_utilizacao || nucleoParque.data_log_utilizacao === 0)
                    worksheet.cell(rowGeral, col++).string("").style(style);
                else 
                    worksheet.cell(rowGeral, col++).date(data_log_utilizacao).style(style);
                    
                        
                resolveExcel(result.length)
            })
            

            promises.push(promise)
        }


     Promise.all(promises)
        .then((result) => {    


            if(result.length > 0){
                                
                setTimeout(() => {
                    resolve("Sucesso ao adicionar gerar excel do banco " + poolDatabaseNames[index])                    
                }, 3000)
                
            }
            else {
                resolve()
            }

            
        })
        .catch(() => {            
            resolve("Erro ao adicionar gerar excel do banco " + poolDatabaseNames[index])
        })
        
    })


    
}


startInterface();

