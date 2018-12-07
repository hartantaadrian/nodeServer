const express = require ('express');

const cors = require('cors');

const bodyparser = require('body-parser');




const dbconf = require('./app/config/config.json');

const app = express()
app.use(cors())
app.use(bodyparser.json());


const port = 1996;

const configmssql = {
    user: dbconf.db.user,
    password: dbconf.db.password,
    server: dbconf.db.server, // You can use 'localhost\\instance' to connect to named instance
    database: dbconf.db.database
};

require('./app/routes')(app,configmssql)
app.listen( port,()=>{
    console.log(configmssql)
    console.log("server start at port : " +port)
})