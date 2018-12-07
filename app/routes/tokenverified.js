module.exports = function verifyToken(req,res,next){
    //get auth value on header
    const bearerHeader = req.headers['authorization'];
    //check bearer
    if(typeof bearerHeader !=='undefined'){
        // split the space
        const bearer = bearerHeader.split('Bearer ')
        //get token from auth array
        const bearerToken = bearer[1]
        //set token
        req.token = bearerToken
        next();
    }else{
        //forbidden
        res.send(403)
    }
}