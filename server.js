var http = require('http'),
    httpProxy = require('http-proxy');//const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const DHT = require("@hyperswarm/dht");
var net = require("net");
var pump = require("pump");

var b32 = require("hi-base32");
let mod = 0;
const tunnels = {};

//
// Create a proxy server with custom application logic
//
var proxy = httpProxy.createProxyServer({});

//proxy.on('proxyReq', function(proxyReq, req, res, options) {
  //proxyReq.setHeader('X-Special-Proxy-Header', 'foobar');
//});

const node = new DHT({});
var server = http.createServer(function(req, res) {
  try {
  const split = req.headers.host.split('.');
  const publicKey = Buffer.from(b32.decode.asBytes(split[0].toUpperCase()));
  if (!tunnels[publicKey]) {
    const port = 1337 + ((mod++) % 1000);
    var server = net.createServer(function (servsock) {
      console.log('connecting', publicKey.toString('hex'))
      const socket = node.connect(publicKey);
      const local = servsock;
      let open = { local:true, remote:true };
      /*local.on('data', (d)=>{socket.write(d)});
      socket.on('data', (d)=>{local.write(d)});
    
      const remoteend = () => {
        if(open.remote) socket.end();
        open.remote = false;
      }
      const localend = () => {
        if(open.local) local.end();
        open.local = false;
      }
      local.on('error', remoteend)
      local.on('finish', remoteend)
      local.on('end', remoteend)
      socket.on('finish', localend)
      socket.on('error', localend)
      socket.on('end', localend)*/
   
      pump(servsock, socket, servsock);
    });
    server.listen(port, "127.0.0.1");
    tunnels[publicKey] = port;
    proxy.web(req, res, {
      target: 'http://127.0.0.1:' + port
    }, function(e) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Cannot reach node');
      console.error(e); 
    });
    return  // protocol + host
  } else {
    console.log(tunnels[publicKey]);
    proxy.web(req, res, {
      target: 'http://127.0.0.1:' + tunnels[publicKey]
    }, function(e) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Cannot reach node');
      console.error(e); 
    });
  }
  }catch(e) {
    console.error(e);
  }
});

console.log("listening on port 8081")
server.listen(8081);
