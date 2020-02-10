
let con

function log_(str){
    console.log(str)
}

function init(connection){
    con = connection

    log_("Database conectado!")		    
    log_("Aguardando conexões ...")	

    agenda.startInterface(con)
}

module.exports = {

/**
 * Inicia os modulos
 * @param {*} connection - Con criado no app
 */
initInterface: function initInterface(con){
    init(con)
},

/**
 * Admin - Função para incrementar total de trabalhos realizados pelo profissional. 
 * @param {*} id - Id do profissional
 */
incrementTotalWork: function incrementTotalWork(id){

    let sql = "UPDATE users SET total_works = total_works + 1 WHERE id = " + id + " ORDER BY id LIMIT 1;"
    log_(sql)

    con.query(sql, function (err1, result) {  
        if (err1) throw err1;                          
    });
},

};

