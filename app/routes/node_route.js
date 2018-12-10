const mssql = require('mssql');
const jwt = require('jsonwebtoken');
const randtoken = require('rand-token');
const sha1 = require('sha1');
const verifyToken = require('./tokenverified')
const unirest = require('unirest')


module.exports = function (app, db) {

    let refreshTokens = {}

    app.get('/get', (req, res) => {
        mssql.connect(db, function (err) {
            if (err) console.log(err);
            console.log(req.query)
            var request = new mssql.Request();
            request.query("select * from [user] ", function (err, recordset) {
                if (err) {
                    res.send(JSON.stringify(err));
                }
                else {
                    res.send({
                        "message": "sucess",
                        "data": recordset.recordset
                    })
                }
                mssql.close()
            })
        })
    })


    app.post('/loginportal', (req, res) => {
        mssql.close()
        let user = req.body.username
        let pass = sha1(req.body.password)
        console.log(pass)
        var token = jwt.sign({ 'id': user }, 'secretkey123', { expiresIn: 60 })
        var refreshToken = randtoken.uid(256)
        refreshTokens[refreshToken] = user
        mssql.connect(db, function (err) {
            if (err) {
                console.log(err);
            }
            else {
                const insertStatement = 'select * from app_user where username = @user and password = @pass';
                const ps = new mssql.PreparedStatement;
                ps.input('user', mssql.VarChar)
                ps.input('pass', mssql.VarChar)
                ps.prepare(insertStatement, function (err) {
                    if (err) {
                        console.log(err)
                    }
                    else {
                        ps.execute({ user: user, pass: pass }, (err, result) => {
                            if (err) {
                                console.log(err)
                                res.send(JSON.stringify(err))
                                mssql.close()
                            }
                            if (result.recordsets == 0) {
                                res.send({
                                    "message": "username or password wrong"
                                })
                            }
                            else {
                                res.send({
                                    "message": "sucess",
                                    "token": token,
                                    "refreshToken": refreshToken,
                                    "data": result.recordset
                                })
                                mssql.close()
                            }
                        })
                    }
                })
            }
        })
    });


    app.post('/regisapp', verifyToken, (req, res) => {
        mssql.close()
        let app_name = req.body.app_name
        let endpoint = req.body.endpoint
        var rf = req.headers.refreshtoken
        jwt.verify(req.headers.authorization, 'secretkey123', (err, authData) => {
            if (err) {
                res.send({
                    "responseCode": "01",
                    err
                })
            } else {
                if ((rf in refreshTokens) && (refreshTokens[rf] == req.body.usernameloggin)) {
                    var token = jwt.sign({ 'id': req.body.usernameloggin }, 'secretkey123', { expiresIn: 60 })
                    mssql.connect(db, function (err) {
                        if (err) {
                            console.log(err);
                        }
                        else {
                            const insertStatement = 'insert into  msg_app values (@app_name,@endpoint)';
                            const ps = new mssql.PreparedStatement;
                            ps.input('app_name', mssql.VarChar)
                            ps.input('endpoint', mssql.VarChar)
                            ps.prepare(insertStatement, function (err) {
                                if (err) {
                                    console.log(err)
                                }
                                else {
                                    ps.execute({ app_name: app_name, endpoint: endpoint }, (err, result) => {
                                        if (err) {
                                            console.log(err)
                                            res.send(JSON.stringify(err))
                                            mssql.close()
                                        }
                                        else {
                                            res.send({
                                                "message": "sucess",
                                                "data": result,
                                                "token": token
                                            })
                                            mssql.close()
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
                else {
                    res.send({
                        "err": "ini error"
                    })
                }
            }
        })
    });

    app.get("/getendpoint", (req, res) => {
        //mssql.close();
        let sms = req.query.sms;
        let app_name = sms.substring(0, 6);

        mssql.connect(db, function (err) {
            if (err) {
                console.log(err);
            }
            else {
                const statement = 'select * from msg_app where app_name = @app_name';
                const ps = new mssql.PreparedStatement;
                ps.input('app_name', mssql.VarChar)
                ps.prepare(statement, function (err) {
                    if (err) {
                        console.log(err)
                        mssql.close();
                    }
                    else {
                        ps.execute({ app_name: app_name }, (err, result) => {
                            console.log(result.recordset.length)
                            if (err) {
                                console.log(err)
                                res.send(JSON.stringify(err))
                                mssql.close();
                            }
                            else if (result.recordset.length === 0) {
                                res.send({
                                    message: "app not registered yet"
                                })
                                mssql.close();
                            }
                            else {
                                //console.log("masuk sini")
                                let endpoint = result.recordset[0].endpoint
                                unirest.get(endpoint).query({
                                    'msisdn': req.query.msisdn,
                                    'trx_time': req.query.trx_time,
                                    'trx_id': req.query.trx_id,
                                    'sms': req.query.sms,
                                    'oprator_code': req.query.operator_code
                                })
                                    .end(function (rsp) {
                                        if (res.error) {
                                            console.log('GET error', res.error)
                                        }
                                        else {
                                            //
                                            let phone = req.query.msisdn
                                            let sms = req.query.sms
                                            let req_from = "SMS gateway"
                                            let req_to = endpoint
                                            let trx_date = req.query.trx_date
                                            //mssql.close();
                                            let logstatement = 'insert into msg_history values (@phone,@sms,@req_from,@req_to,@trx_date)';
                                            let pstm = new mssql.PreparedStatement;
                                            pstm.input('phone', mssql.VarChar)
                                            pstm.input('sms', mssql.VarChar)
                                            pstm.input('req_from', mssql.VarChar)
                                            pstm.input('req_to', mssql.VarChar)
                                            pstm.input('trx_date', mssql.DateTime)
                                            pstm.prepare(logstatement,function(err) {
                                                if (err) {
                                                    console.log(err)
                                                    //mssql.close();
                                                }
                                                else{
                                                    pstm.execute({ phone: phone, sms: sms,req_from: req_from, req_to: req_to, trx_date:trx_date }, (err, result) => {
                                                        if (err) {
                                                            console.log(err)
                                                            res.send(JSON.stringify(err))
                                                            mssql.close()
                                                        }
                                                        else{
                                                            res.send(result)
                                                        }
                                                    })
                                                }
                                            })
                                          
                                        }
                                    })
                            }
                        })
                    }
                })
            }
        })
    });


}