const mssql = require('mssql');
const jwt = require('jsonwebtoken');
const randtoken = require('rand-token');
const sha1 = require('sha1');
const verifyToken = require('./tokenverified')
const unirest = require('unirest')
const moment = require('moment');
const auth = require('basic-auth');
const compare = require('tsscmp')


module.exports = function (app, db) {

    let refreshTokens = {}

    function check(name, pass) {
        var valid = true

        // Simple method to prevent short-circut and use timing-safe compare
        valid = compare(name, 'jtrustbank') && valid
        valid = compare(pass, '123456') && valid

        return valid
    }

    app.get('/getApp', (req, res) => {
        mssql.connect(db, function (err) {
            if (err) console.log(err);
            console.log(req.query)
            var request = new mssql.Request();
            request.query("select * from msg_app ", function (err, recordset) {
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

    app.get('/getLogSMS', (req, res) => {
        mssql.connect(db, function (err) {
            if (err) console.log(err);
            console.log(req.query)
            var request = new mssql.Request();
            request.query("select * from msg_history order by id asc ", function (err, recordset) {
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

    app.post('/audit', (req, res) => {
        mssql.close()
        let action = req.body.action
        let userid = req.body.userid
        let user = req.body.username
        let note = req.ip
        let dt = new Date()
        dt.setHours(dt.getHours() + 7)
        let trans_id = req.body.trans_id
        //let dt = date.format('m/d/Y H:M:S:N');

        mssql.connect(db, function (err) {
            if (err) {
                console.log(err);
            }
            else {
                const insertStatement = 'insert into  [audit_trail] values (@action,@userid,@user,@note,@dt,@trans_id)';
                const ps = new mssql.PreparedStatement;
                ps.input('action', mssql.VarChar)
                ps.input('userid', mssql.VarChar)
                ps.input('user', mssql.VarChar)
                ps.input('note', mssql.VarChar)
                ps.input('dt', mssql.DateTime)
                ps.input('trans_id', mssql.VarChar)
                ps.prepare(insertStatement, function (err) {
                    if (err) {
                        console.log(err)
                    }
                    else {
                        ps.execute({ action: action, userid: userid, user: user, note: note, dt: dt, trans_id: trans_id }, (err, result) => {
                            if (err) {
                                console.log(err)
                                res.send(JSON.stringify(err))
                                mssql.close()
                            }
                            else {
                                res.send({
                                    "message": "sucess",
                                    "data": result,
                                })
                                mssql.close()
                            }
                        })
                    }
                })
            }
        })
    });

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
        var credentials = auth(req);
        if (!credentials || !check(credentials.name, credentials.pass)) {
            res.statusCode = 401
            res.setHeader('WWW-Authenticate', 'Basic realm="example"')
            res.end('Access denied')
        }
        else {
            mssql.close();
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
                                        responseCode: "13",
                                        message: "app not registered yet"
                                    })
                                    mssql.close();
                                }
                                else {
                                    //console.log("masuk sini")
                                    let endpoint = result.recordset[0].endpoint
                                    unirest.get(endpoint)
                                        .query({
                                            'msisdn': req.query.msisdn,
                                            'trx_time': req.query.trx_time,
                                            'trx_id': req.query.trx_id,
                                            'sms': req.query.sms,
                                            'oprator_code': req.query.operator_code
                                        })
                                        .end(function (rsp) {
                                            if (rsp.error) {
                                                console.log('GET error', rsp)
                                                res.send({
                                                    "responseCode": "01",
                                                    "response": "rsp"
                                                })
                                            }
                                            else {
                                                let respo = rsp

                                                let phone = req.query.msisdn
                                                let sms = req.query.sms
                                                let req_from = "SMS gateway"
                                                let req_to = endpoint

                                                let dateres = req.query.trx_date
                                                let trx_date = new Date(dateres.substring(0, 4) + "-" + dateres.substring(4, 6) + "-" + dateres.substring(6, 8) + " " + dateres.substring(8, 10) + ":" + dateres.substring(10, 12) + ":" + dateres.substring(12, 14) + ".000")
                                                trx_date.setHours(trx_date.getHours() + 7)

                                                //console.log("ssss " + trx_date)
                                                //mssql.close();
                                                let logstatement = 'insert into msg_history values (@phone,@sms,@req_from,@req_to,@trx_date)';
                                                let pstm = new mssql.PreparedStatement;
                                                pstm.input('phone', mssql.VarChar)
                                                pstm.input('sms', mssql.VarChar)
                                                pstm.input('req_from', mssql.VarChar)
                                                pstm.input('req_to', mssql.VarChar)
                                                pstm.input('trx_date', mssql.DateTime)
                                                pstm.prepare(logstatement, function (err) {
                                                    if (err) {
                                                        console.log(err)
                                                        //mssql.close();
                                                    }
                                                    else {
                                                        //console.log("asss " + trx_date)
                                                        pstm.execute({ phone: phone, sms: sms, req_from: req_from, req_to: req_to, trx_date: trx_date }, (err, result) => {
                                                            if (err) {
                                                                console.log(err)
                                                                res.send({
                                                                    "responseCode": "39",
                                                                    "reponse": err
                                                                })
                                                                mssql.close()
                                                            }
                                                            else {
                                                                res.send({
                                                                    "responseCode": 00,
                                                                    "response": respo.body.response
                                                                })
                                                                mssql.close()
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
        }
    });


    app.post("/toGateway", (req, res) => {
        var credentials = auth(req);
        if (!credentials || !check(credentials.name, credentials.pass)) {
            res.statusCode = 401
            res.setHeader('WWW-Authenticate', 'Basic realm="example"')
            res.end('Access denied')
        }
        else {
            mssql.close()
            let id = req.body.id
            let pwd = req.body.pwd
            let msisdn = req.body.msisdn
            let trx_date = req.body.trx_date
            let chargingCode = req.body.chargingCode
            let requestId = req.body.requestId
            let requestContent = req.body.requestContent
            let operatorCode = req.body.operatorCode
            let sms = req.body.sms
            let format = req.body.format
            let channel = req.body.channel
            let bankId = req.body.bankId

            unirest.get("http://localhost:5024/")
                .query({
                    'id': id,
                    'pwd': pwd,
                    'msisdn': msisdn,
                    'trx_date': trx_date,
                    'chargingCode': chargingCode,
                    'requestId': requestId,
                    'requestContent': requestContent,
                    'operatorCode': operatorCode,
                    'sms': sms,
                    'format': format,
                    'channel': channel,
                    'bankId': bankId
                }).end(function (rsp) {
                    if (rsp.error) {
                        res.send({
                            "responseCode":"4",
                            "response":rsp
                        })
                        //console.log('GET error', rsp.error)
                    } else {
                        mssql.connect(db, function (err) {
                            if (err) {
                                console.log(err)
                            }
                            else {
                                let phone = msisdn
                                let req_from = bankId
                                let req_to = "SMS gateway"
                                let logstatement = 'insert into msg_history values (@phone,@sms,@req_from,@req_to,@trx_date)';
                                let pstm = new mssql.PreparedStatement;
                                trx_date = new Date(trx_date)
                                trx_date.setHours(trx_date.getHours() + 7)
                                pstm.input('phone', mssql.VarChar)
                                pstm.input('sms', mssql.VarChar)
                                pstm.input('req_from', mssql.VarChar)
                                pstm.input('req_to', mssql.VarChar)
                                pstm.input('trx_date', mssql.DateTime)
                                pstm.prepare(logstatement, function (err) {
                                    if (err) {
                                        console.log(err)
                                        //mssql.close();
                                    }
                                    else {
                                        //console.log("asss " + trx_date)
                                        pstm.execute({ phone: phone, sms: sms, req_from: req_from, req_to: req_to, trx_date: trx_date }, (err, result) => {
                                            if (err) {
                                                console.log(err)
                                                res.send({
                                                    "responseCode": "39",
                                                    "reponse": err
                                                })
                                                mssql.close()
                                            }
                                            else {
                                                res.send({
                                                    "responseCode": 00,
                                                    "response": rsp.body
                                                })
                                                mssql.close()
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