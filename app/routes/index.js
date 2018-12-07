const nodeRoutes = require('./node_route');

module.exports = function(app,db){
    nodeRoutes(app,db);
}