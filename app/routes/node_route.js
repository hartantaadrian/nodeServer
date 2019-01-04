const mssql = require('mssql');
const jwt = require('jsonwebtoken');
const randtoken = require('rand-token');
const sha1 = require('sha1');
const verifyToken = require('./tokenverified')
const unirest = require('unirest')
const moment = require('moment');
const auth = require('basic-auth');
const compare = require('tsscmp');
const xml = require('xml');


module.exports = function (app, db) {

    let refreshTokens = {}

    app.get('/getApp', (req, res) => {
        mssql.connect(db, function (err) {
            if (err) console.log(err);
            console.log(req.query)
            var request = new mssql.Request();
            request.query("select * from sms_endpoint ", function (err, recordset) {
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
        mssql.close()
        mssql.connect(db, function (err) {
            if (err) console.log(err);
            console.log(req.query)
            var request = new mssql.Request();
            request.query("select * from sms_history order by id asc ", function (err, recordset) {
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

    async function validityuser(name, pass, ip) {
        async function founded(isfound) {
            console.log("ini isfound" + isfound.recordset.length)
            if (isfound.recordset.length === 1) {
                isfound = {
                    "app_name": isfound.recordset[0].app_name,
                    "status": true
                }
                console.log("ini isfound " + isfound)
                return isfound
            }
            else {
                isfound = {
                    "app_name": isfound.recordset[0].app_name,
                    "status": true
                }
                console.log("ini isfound " + isfound)
                return isfound
                isfound = false
                console.log("ini isfound " + isfound)
                return false
            }
        }
        try {
            let hasilcekdb

            mssql.close()
            let konekdb = await mssql.connect(db)
            console.log(name, pass, ip)
            hasilcekdb = await konekdb.request()
                .input('user', mssql.VarChar, name)
                .input('pass', mssql.VarChar, pass)
                .input('ipadd', mssql.VarChar, ip)
                .query('select * from sms_app2 where username = @user and password = @pass and wait_list_addres = @ipadd')
            let foundah = await founded(hasilcekdb)

            console.log("ini foundah " + foundah)
            return foundah
        }
        catch (err) {
            console.log(err)
        }

    }

    async function check(name, pass, ip) {
        let valid = await validityuser(name, pass, ip)
        console.log(JSON.stringify(valid) + "sasd")
        return valid
    }

    app.get('/', (req, res) => {
        res.send(req.ip)
        console.log(req.ip)
    })


    app.get("/MO", (req, res) => {
        mssql.close();
        var credentials = auth(req);
        let MO = async function () {
            if (!credentials) {
                res.statusCode = 401
                res.setHeader('WWW-Authenticate', 'Basic realm="example"')
                res.end('Access denied')
            }
            let hasilcheck = await check(credentials.name, credentials.pass, req.ip)
            console.log(hasilcheck + "sinSS")
            if (!hasilcheck) {
                res.statusCode = 401
                res.setHeader('WWW-Authenticate', 'Basic realm="example"')
                res.end('Access denied')
            }
            else {
                mssql.close();
                let sms = req.query.sms;
                let keyword = sms.substring(0, 6);
                let gateway_names = hasilcheck.app_name
                mssql.connect(db, function (err) {
                    if (err) {
                        console.log(err);
                    }
                    else {
                        const statement = 'select ep.app_name,endpoint_url,keyword ' +
                            'from sms_endpoint ep inner join sms_keyword kw ' +
                            'on ep.app_name = kw.app_name ' +
                            'where kw.app_name = @app_name';
                        const ps = new mssql.PreparedStatement;
                        ps.input('app_name', mssql.VarChar)
                        ps.prepare(statement, function (err) {
                            if (err) {
                                console.log(err)
                                mssql.close();
                            }
                            else {
                                ps.execute({ app_name: keyword }, (err, result) => {
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
                                        let endpoint = result.recordset[0].endpoint_url
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
                                                        "response": "cannot connect to endpoint"
                                                    })
                                                }
                                                else {
                                                    console.log("ini nama gateway " + gateway_names)
                                                    let respo = rsp
                                                    let phone_number = req.query.msisdn
                                                    let keyword = req.query.sms
                                                    let app_name = result.recordset[0].app_name
                                                    let dateres = req.query.trx_date
                                                    let trx_date = new Date(dateres.substring(0, 4) + "-" + dateres.substring(4, 6) + "-" + dateres.substring(6, 8) + " " + dateres.substring(8, 10) + ":" + dateres.substring(10, 12) + ":" + dateres.substring(12, 14) + ".000")
                                                    trx_date.setHours(trx_date.getHours() + 7)
                                                    let tran_type = "MO"
                                                    let trx_id = req.query.trx_id

                                                    let logstatement = 'insert into sms_history (phone_number,keyword,app_name,gateway_name,trx_date,tran_type,trx_id) values (@phone_number,@keyword,@app_name,@gateway_name,@trx_date,@tran_type,@trx_id)';
                                                    let pstm = new mssql.PreparedStatement;
                                                    pstm.input('phone_number', mssql.VarChar)
                                                    pstm.input('keyword', mssql.VarChar)
                                                    pstm.input('app_name', mssql.VarChar)
                                                    pstm.input('gateway_name', mssql.VarChar)
                                                    pstm.input('trx_date', mssql.DateTime)
                                                    pstm.input('tran_type', mssql.VarChar)
                                                    pstm.input('trx_id', mssql.VarChar)
                                                    pstm.prepare(logstatement, function (err) {
                                                        if (err) {
                                                            console.log(err)
                                                            //mssql.close();
                                                        }
                                                        else {
                                                            //console.log("asss " + trx_date)
                                                            pstm.execute({ phone_number: phone_number, keyword: keyword, app_name: app_name, gateway_name: gateway_names, trx_date: trx_date, tran_type: tran_type, trx_id: trx_id }, (err, result) => {
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
        }
        MO();
        //connecttodb(credentials.name, credentials.pass, req, res, validty)
    });

    app.post("/MTReply", (req, res) => {
        var credentials = auth(req);

        let MTReply = async function () {
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
            let provider = req.body.provider
            let keyword = req.body.gateway_destination

            if (!credentials) {
                res.statusCode = 401
                res.setHeader('WWW-Authenticate', 'Basic realm="example"')
                res.end('Access denied')
            }
            let hasilcheck = await check(credentials.name, credentials.pass, req.ip)
            console.log(hasilcheck + "sinSS")
            if (!hasilcheck) {
                res.statusCode = 401
                res.setHeader('WWW-Authenticate', 'Basic realm="example"')
                res.end('Access denied' + req.ip)
            }
            else {

                let gateway_names = hasilcheck.app_name
                const statement = 'select ep.app_name,endpoint_url,keyword ' +
                    'from sms_endpoint ep inner join sms_keyword kw ' +
                    'on ep.app_name = kw.app_name ' +
                    'where kw.app_name = @app_name';

                const ps = new mssql.PreparedStatement;
                ps.input('app_name', mssql.VarChar)
                ps.prepare(statement, function (err) {
                    if (err) {
                        console.log(err)
                        res.send(JSON.stringify(err))
                        mssql.close();
                    }
                    else {
                        ps.execute({ app_name: keyword }, (err, result) => {
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
                                let gettrx = 'select * ' +
                                    'from sms_history ' +
                                    'where trx_id = @trx_id';
                                let trx_id = req.body.requestId
                                const pstm = new mssql.PreparedStatement;
                                pstm.input('trx_id', mssql.VarChar)
                                pstm.prepare(gettrx, function (err) {
                                    if (err) {
                                        console.log(err)
                                        res.send(JSON.stringify(err))
                                        mssql.close();
                                    }
                                    else pstm.execute({ trx_id: trx_id }, (err, result) => {
                                        if (err) {
                                            console.log(err)
                                            res.send(JSON.stringify(err))
                                            mssql.close();
                                        }
                                        else if (result.recordset.length === 0) {
                                            res.send({
                                                "message": "trx id not found"
                                            })
                                        }
                                        else {
                                            let keyword = req.body.gateway_destination
                                            unirest.get("http://localhost:5024/")
                                                .query({
                                                    'id': id,
                                                    'pwd': pwd,
                                                    'msisdn': msisdn,
                                                    'provider': provider,
                                                    'trx_date': trx_date,
                                                    'chargingCode': chargingCode,
                                                    'requestId': requestId,
                                                    'requestContent': requestContent,
                                                    'operatorCode': operatorCode,
                                                    'sms': sms,
                                                    'format': format,
                                                    'channel': channel,
                                                    'provider': provider,
                                                    'bankId': bankId
                                                }).end(function (rsp) {
                                                    if (rsp.error) {
                                                        res.send({
                                                            "responseCode": "01",
                                                            "response": "cannot connect to gateway"
                                                        })
                                                    }
                                                    else {
                                                        mssql.close();
                                                        mssql.connect(db, function (err) {
                                                            if (err) {
                                                                console.log(err)
                                                            }
                                                            else {
                                                                let phone_number = msisdn
                                                                let app_name = result.recordset[0].app_name
                                                                let dateres = req.body.trx_date
                                                                let trx_date = new Date(dateres.substring(0, 4) + "-" + dateres.substring(4, 6) + "-" + dateres.substring(6, 8) + " " + dateres.substring(8, 10) + ":" + dateres.substring(10, 12) + ":" + dateres.substring(12, 14) + ".000")
                                                                trx_date.setHours(trx_date.getHours() + 7)
                                                                let tran_type = "MT Reply"
                                                                let trx_id = requestId


                                                                let logstatement = 'insert into sms_history (phone_number,keyword,app_name,gateway_name,trx_date,tran_type,trx_id) values (@phone_number,@keyword,@app_name,@gateway_name,@trx_date,@tran_type,@trx_id)';
                                                                let pstm = new mssql.PreparedStatement;
                                                                pstm.input('phone_number', mssql.VarChar)
                                                                pstm.input('keyword', mssql.VarChar)
                                                                pstm.input('app_name', mssql.VarChar)
                                                                pstm.input('gateway_name', mssql.VarChar)
                                                                pstm.input('trx_date', mssql.DateTime)
                                                                pstm.input('tran_type', mssql.VarChar)
                                                                pstm.input('trx_id', mssql.VarChar)
                                                                pstm.prepare(logstatement, function (err) {
                                                                    if (err) {
                                                                        console.log(err)
                                                                        //mssql.close();
                                                                    }
                                                                    else {
                                                                        //console.log("asss " + trx_date)
                                                                        pstm.execute({ phone_number: phone_number, keyword: keyword, app_name: gateway_names, gateway_name: app_name, trx_date: trx_date, tran_type: tran_type, trx_id: trx_id }, (err, result) => {
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
                                                                                    "response": rsp.body.response
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
                                })

                            }
                        })
                    }
                })
            }
        }
        MTReply();
    })

    app.post("/MTPush", (req, res) => {
        mssql.close();
        let MTPush = async function () {
            var credentials = auth(req);
            if (!credentials) {
                res.statusCode = 401
                res.setHeader('WWW-Authenticate', 'Basic realm="example"')
                res.end('Access denied')
            }
            let hasilcheck = await check(credentials.name, credentials.pass, req.ip)
            console.log(hasilcheck + "sinSS")
            if (!hasilcheck) {
                res.statusCode = 401
                res.setHeader('WWW-Authenticate', 'Basic realm="example"')
                res.end('Access denied' + req.ip)
            }
            else {
                try {
                    mssql.close();
                    
                    let gateway = await hasilcheck.app_name
                    let app_name = req.body.app_name
                    let phone_number = req.body.phone_number
                    let sms_content = req.body.sms_content
                    let trx_date = req.body.trx_date
                    let trx_id = req.body.trx_id
                    let keyword = req.body.keyword

                    console.log("aw " + JSON.stringify(hasilcheck.app_name))
                    let ps = await mssql.connect(db)
                    let result1 = await ps.request()
                        .input('app_name', mssql.VarChar, gateway)
                        .query('select sa.app_name,se.endpoint_url ' +
                            'from sms_app2 sa inner join sms_endpoint se ' +
                            'on sa.default_gateway = se.app_name ' +
                            'where sa.default_gateway = @app_name')
                    if (result1.recordset.length === 1) {
                        unirest.get(result1.recordset[0].endpoint_url)
                            .query({
                                'id': 'JTrustBank',
                                'pwd': 'P@ssw0rd',
                                'msisdn': phone_number,
                                'paidCode': 'S',
                                'sms': sms_content,
                                'format': '1',
                                'channel': 4,
                                'provider': 'pacomnetsc',
                                'bankId': 'jtrustbank'
                            }).end(function (rsp, err) {
                                if (err) {
                                    res.send({
                                        'err': err
                                    })
                                }
                                else {
                                    let insertlog = async function () {
                                        try {
                                            console.log("asd")
                                            let pst = await await mssql.connect(db)
                                            let rs = await pst.request()
                                                .input('phonenumber', mssql.VarChar, phone_number)
                                                .input('keyword', mssql.VarChar, keyword)
                                                .input('app_name', mssql.VarChar, app_name)
                                                .input('gateway_name', mssql.VarChar, gateway)
                                                .input('trx_date', mssql.VarChar, trx_date)
                                                .input('tran_type', mssql.VarChar, 'MT PUSH')
                                                .input('trx_id', mssql.VarChar, trx_id)
                                                .query('insert into sms_history (phone_number,keyword,app_name,gateway_name,trx_date,tran_type,trx_id)' +
                                                    'values (@phonenumber,@keyword,@app_name,@gateway_name,@trx_date,@tran_type,@trx_id) ')
                                            res.send({
                                                "responseCode": "00",
                                                "reponse": "success"
                                            })
                                        }
                                        catch (err) {
                                            console.log(err)
                                            res.send({
                                                "responseCode": "39",
                                                "err":err
                                            })
                                        }
                                
                                    }
                                    mssql.close();
                                    insertlog()   
                                }
                            })
                    }
                    else if(result1.recordset.length === 0){
                        unirest.get(req.body.endpoint_url)
                            .query({
                                'id': 'JTrustBank',
                                'pwd': 'P@ssw0rd',
                                'msisdn': phone_number,
                                'paidCode': 'S',
                                'sms': sms_content,
                                'format': '1',
                                'channel': 4,
                                'provider': 'pacomnetsc',
                                'bankId': 'jtrustbank'
                            }).end(function (rsp, err) {
                                if (err) {
                                    res.send({
                                        'err': err
                                    })
                                }
                                else {
                                    let insertlog = async function () {
                                        try {
                                            console.log("asd")
                                            let pst = await await mssql.connect(db)
                                            let rs = await pst.request()
                                                .input('phonenumber', mssql.VarChar, phone_number)
                                                .input('keyword', mssql.VarChar, keyword)
                                                .input('app_name', mssql.VarChar, app_name)
                                                .input('gateway_name', mssql.VarChar, gateway)
                                                .input('trx_date', mssql.VarChar, trx_date)
                                                .input('tran_type', mssql.VarChar, 'MT PUSH')
                                                .input('trx_id', mssql.VarChar, trx_id)
                                                .query('insert into sms_history (phone_number,keyword,app_name,gateway_name,trx_date,tran_type,trx_id)' +
                                                    'values (@phonenumber,@keyword,@app_name,@gateway_name,@trx_date,@tran_type,@trx_id) ')
                                            res.send({
                                                "responseCode": 00,
                                                "message": "Success"
                                            })
                                        }
                                        catch (err) {
                                            console.log(err)
                                            res.send({
                                                "responseCode": "39",
                                                "errormessage": err
                                            })
                                        }
                                
                                    }
                                    mssql.close();
                                    insertlog()   
                                }
                            })
                    }
                }
                catch (err) {
                    console.log(err)
                    res.send({
                        'err': err
                    })
                }
            }
        }
        MTPush()
    })
}