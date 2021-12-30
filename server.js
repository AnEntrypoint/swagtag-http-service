const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const DHT = require("@hyperswarm/dht");
const net = require("net");
const agent = new http.Agent(
  {
    maxSockets: Number.MAX_VALUE,
    keepAlive: true,
    keepAliveMsecs: 720000,
    timeout: 360000
  }
);
const b32 = require("hi-base32")
const fs = require('fs');



let mod = 0;
const tunnels = {};
/*const bootstrap = new DHT({
  ephemeral: true
})*/

var proxy = httpProxy.createProxyServer({
  ws: true,
  agent: agent,
  timeout: 360000
});
const lookup = require('./lookup.js');
const node = new DHT({/*bootstrap: ['code.southcoast.ga:49737']*/ });
const cache = {};

const closeOther = (local, other) => {
  local.on('error',  () => { other.end() })
  local.on('finish',  () => { other.end() })
  local.on('end',  () => { other.end() })
}

const getKey = async(name)=>{
  let publicKey;
  let decoded = '';
  try {decoded = b32.decode.asBytes(name.toUpperCase())} catch (e) { }
  if (decoded.length == 32) {
    publicKey = Buffer.from(decoded);
  } else {
    const lookupRes = await lookup(name);
    publicKey = Buffer.from(b32.decode.asBytes(lookupRes.toUpperCase()));
  }
  return publicKey;
}

const doServer = async function (req, res) {
  const split = req.headers.host.split('.')
  split.splice(1, 2);
  const name = split.join('.')
  if (name.length != 32) {
    if (name == 'exists') {
      console.log(req.url);
      let lookupRes = 'false';
      try {
        await lookup(req.url.replace('/', ''));
        lookupRes = 'true';
      } catch { }
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(lookupRes);
      return;
    } else if (name == 'txt') {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(fs.readFileSync('txt'));
      return;
    }
  }
  const publicKey = await getKey(name);
  console.log({publicKey})
  if (!tunnels[publicKey]) {
    const port = 1337 + ((mod++) % 1000);
    try {
        var server = net.createServer(function (local) {
          const socket = node.connect(publicKey);
          local.on('data', (d) => { socket.write(d) });
          socket.on('data', (d) => { local.write(d) });
          closeOther(socket, local)
          closeOther(local, socket)
        });
        server.listen(port, "127.0.0.1");
        tunnels[publicKey] = port;
        target = 'http://127.0.0.1:' + port;
      } catch(e) {
        console.trace(e);
        console.error(e);
      }
      console.log('connection');

  } else {
    target = 'http://127.0.0.1:' + tunnels[publicKey]
  }
  proxy.web(req, res, {
    target
  }, function (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Cannot reach node ' + e.message);
  });
}

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};
var server = http.createServer(doServer);
var sserver = https.createServer(options, doServer);

const doUpgrade = async function (req, socket, head) {
  const split = req.headers.host.split('.')
  split.splice(1, 2);
  const name = split.join('.')
  const publicKey = await getKey(name);
  proxy.ws(req, socket, {
    target: 'http://127.0.0.1:' + tunnels[publicKey]
  }, socket.end);
}
server.on('upgrade', doUpgrade);
sserver.on('upgrade', doUpgrade);

process.stdout.on('error', console.error);
console.log("listening on port 8081")
server.listen(80);
sserver.listen(443);
