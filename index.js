const express = require('express');
const cors = require('cors');
const bodyparser = require('body-parser');
const auth = require('basic-auth')
const https = require('https');
const fs = require('fs');
const xmlparser = require('express-xml-bodyparser');


const dbconf = require('./app/config/config.json');

const app = express()
app.use(cors())
app.use(bodyparser.json());
app.use(xmlparser());


const port = 1996;

const configmssql = {
    user: dbconf.db.user,
    password: dbconf.db.password,
    server: dbconf.db.server, // You can use 'localhost\\instance' to connect to named instance
    database: dbconf.db.database
};

require('./app/routes')(app, configmssql)
app.listen(port, () => {
    console.log(configmssql)
    console.log("server start at port : " + port)
})

var server = https.createServer({
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert')
}, app);
server.listen(8001, function () {
    console.log("server running at https://IP_ADDRESS:8001/")
});
