let mysql = require('mysql');
let express =  require('express');
let app = express();
var moment = require('moment');
const xl = require('excel4node');

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


var poolDatabases = []

var diretorioArquivos = "/tmp/"
var rowGeral = 2    
var dataInicio = moment().add(-1, 'month').format()
var dataFinal = moment().add(1, 'month').format()
var workbook = new xl.Workbook();
var worksheet = workbook.addWorksheet('Relatorio');

worksheet.cell(1, 1).string('Data de Compra');
worksheet.cell(1, 2).string('Data de Uso');
worksheet.cell(1, 3).string('Número do Pedido');
worksheet.cell(1, 4).string('Número de Ingresso');
worksheet.cell(1, 5).string('Tipo de Ingresso / Hospedagem');
worksheet.cell(1, 6).string('Tipo do Produto');
worksheet.cell(1, 6).string('Subtipo de Ingresso');
worksheet.cell(1, 6).string('Valor');
worksheet.cell(1, 6).string('Tipo de Pagamento'); 
worksheet.cell(1, 6).string('Centro de Custo'); 
worksheet.cell(1, 6).string('Nome do Parque'); 
worksheet.cell(1, 6).string('Núcleo do Parque'); 

worksheet.column(1).setWidth(25);
worksheet.column(2).setWidth(25);
worksheet.column(3).setWidth(25);

worksheet.row(1).setHeight(25);

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

        for(let i = 0; i < poolDatabaseNames.length; i++){
        
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
                            
                            log_("Salvando o resultado do database: " + poolDatabaseNames[i])

                            popularExcel(result, poolDatabaseNames[i])
                            .then(() => {

                                resolve()
                            })

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

            log_("Todos os bancos foram conectados com sucesso!")     
            process.exit(0)       

        })
        .catch((error) => {
            resolve(error)
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


        //log_(sql)

        con.query(sql, function (err, result) {        
            if (err){
                reject(err);
            }
            
            resolve(result)

        });

    })
}

function popularExcel(result, poolDatabaseNames){

    return new Promise(function(resolve, reject){    
        
        let promises = []

        for(let i = 0; i < result.length; ++i){

            let promise = new Promise(function(resolveExcel){ 

                let data_log_venda = moment(result[i].data_log_venda).format("DD/MM/YYYY hh:mm:ss")
                let data_log_utilizacao = moment(result[i].data_log_utilizacao).format("DD/MM/YYYY hh:mm:ss")
                let ip_maquina_venda = result[i].ip_maquina_venda
                let tipoDeIngresso = "Ingressos"
                let fk_id_estoque_utilizavel = result[i].fk_id_estoque_utilizavel            
                let nome_tipo_produto = result[i].nome_tipo_produto
                let nome_subtipo_produto = result[i].nome_subtipo_produto
                let valor_produto = result[i].valor_produto         
                let tipoPagamento = "Online"
                let centroCusto = "540007"
                let nomeParque = "Núcleo Caminhos do Mar"
                let nucleoParque = "PESM - Caminhos do Mar"
                
                
                let col = 1                
        
                worksheet.cell(rowGeral, col++).string(data_log_venda).style(style);
                worksheet.cell(rowGeral, col++).string(data_log_utilizacao).style(style);
                worksheet.cell(rowGeral, col++).string(ip_maquina_venda).style(style);                
                worksheet.cell(rowGeral, col++).number(fk_id_estoque_utilizavel).style(style)
                worksheet.cell(rowGeral, col++).string(tipoDeIngresso);
                worksheet.cell(rowGeral, col++).string(nome_tipo_produto).style(style);
                worksheet.cell(rowGeral, col++).string(nome_subtipo_produto).style(style);
                worksheet.cell(rowGeral, col++).number(valor_produto).style(style);                                                                                
                worksheet.cell(rowGeral, col++).string(tipoPagamento).style(style);
                worksheet.cell(rowGeral, col++).string(centroCusto).style(style);
                worksheet.cell(rowGeral, col++).string(nomeParque).style(style);
                worksheet.cell(rowGeral, col++).string(nucleoParque).style(style);

                rowGeral++

                console.log(rowGeral, data_log_venda, data_log_utilizacao, fk_id_estoque_utilizavel, nome_tipo_produto, nome_subtipo_produto, valor_produto)                            

                resolveExcel(result.length)
            })
            

            promises.push(promise)
        }


        Promise.all(promises)
        .then((result) => {    


            if(result.length > 0){
                
                let datetime = moment().format("DDMMYYYYhhmmss")
                let filename = diretorioArquivos + "/" + poolDatabaseNames + '_' + datetime + '.xlsx'
                workbook.write(filename)
    
                console.log(filename)
    
                setTimeout(() => {
                    resolve("Sucesso ao adicionar gerar excel do banco " + poolDatabaseNames)
                    
                }, 3000)
                
            }
            else {
                resolve()
            }

            
        })
        .catch(() => {            
            reject("Erro ao adicionar gerar excel do banco " + poolDatabaseNames)
        })
        
    })


    
}


startInterface();

