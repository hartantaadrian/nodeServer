const mssql = require('mssql');
const jwt = require('jsonwebtoken');
const randtoken = require('rand-token');
const sha1 = require('sha1');
const verifyToken = require('./tokenverified')


module.exports = function(app,db){
    
let refreshTokens = {} 

app.get('/get',(req,res)=>{
    mssql.connect(db,function(err){
    if (err) console.log(err);
        console.log(req.query)
        var request = new mssql.Request();
        request.query("select * from [user] " , function (err, recordset) {
            if (err){
                res.send(JSON.stringify(err));
            }
            else{
                res.send({
                    "message":"sucess",
                    "data": recordset.recordset
                })
            }
                mssql.close()
        })
    })
})


app.post('/loginportal',(req,res)=>{
    mssql.close()
    let user =req.body.username
    let pass = sha1(req.body.password)
    console.log(pass)
    var token = jwt.sign({'id':user},'secretkey123',{expiresIn:60})
    var refreshToken = randtoken.uid(256) 
    refreshTokens[refreshToken] = user 
    mssql.connect(db,function(err){
        if(err){
            console.log(err);
        }
        else{
            const insertStatement = 'select * from [User] where username = @user and password = @pass';
            const ps = new mssql.PreparedStatement;
            ps.input('user',mssql.VarChar)
            ps.input('pass',mssql.VarChar)
            ps.prepare(insertStatement,function(err){
            if(err){
                console.log(err)
            }
            else{
                ps.execute({user : user, pass: pass },(err,result)=>{
                    if(err){
                        console.log(err)
                        res.send(JSON.stringify(err))
                        mssql.close()
                    }
                    if(result.recordsets == 0){
                        res.send({
                        "message":"username or password wrong"
                        })
                    }
                    else{
                        res.send({
                            "message":"sucess",
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


app.post('/regis',verifyToken,(req,res)=>{
        mssql.close()
        let user =req.body.username
        let pass = sha1(req.body.password)
        let role = req.body.role
        let db
        var rf = req.headers.refreshtoken
        console.log(req.headers.refreshtoken)
        console.log(req.headers.authorization)
        jwt.verify(req.headers.authorization,'secretkey123',(err,authData)=>{
            if(err){
                res.send({ 
                    "responseCode": "01",
                    err})
            }else{
                if((rf in refreshTokens) && (refreshTokens[rf] == req.body.usernameloggin)){
                    var token = jwt.sign({'id':user},'secretkey123',{expiresIn:60})
                    mssql.connect(configmssql,function(err){
                        if(err){
                            console.log(err);
                        }
                        else{
                            const insertStatement = 'insert into  [User] values (@user,@pass,@role)';
                            const ps = new mssql.PreparedStatement;
                            ps.input('user',mssql.VarChar)
                            ps.input('pass',mssql.VarChar)
                            ps.input('role',mssql.VarChar)
                            ps.prepare(insertStatement,function(err){
                            if(err){
                                console.log(err)
                            }
                            else{
                                ps.execute({user : user, pass: pass, role: role },(err,result)=>{
                                    if(err){
                                            console.log(err)
                                            res.send(JSON.stringify(err))
                                            mssql.close()
                                        }
                                    else{
                                        res.send({
                                            "message":"sucess",
                                            "data": result,
                                            "token" : token
                                        })
                                        mssql.close()
                                        }
                                     })
                            }
                            })
                        }
                    })
                }
                else{
                    res.send({
                        "err":"ini error"
                    })
                }
            }
    
        })
    
    });
    

}