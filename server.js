const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const DHT = require("@hyperswarm/dht");
const net = require("net");
const axios = require('axios');
require('dotenv').config();
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
const getListings = async (serverUrl, appId, netHost) => {
  const Moralis = require("moralis/node");
  Moralis.initialize(appId);
  Moralis.serverURL = serverUrl;
  Moralis.start({ appId, serverUrl });
  Moralis.Cloud.run("List", JSON.stringify({})).then(
    async listings => {
      const out = [];
      for (listing of listings) {
        response = await axios.get(listing.address.image);
        console.log(listing.address.image)
        try {
          await axios.get(listing.address.image);
          try {
            await axios.get('https://'+listing.address.uri);
          } catch(e) {
            listing.disableLink = true;
          }
          out.push(listing);
          console.log({ listing });
        } catch (e) {
          console.error(e)
        }
      }
      for (x of Object.keys(nets)) {
        if (nets[x].host === netHost) nets[x].listings = out;
      }

    }
  );
}
const getAllListings = async () => {
  await getListings(process.env.REACT_APP_MORALIS_TESTNET_SERVER_URL, process.env.REACT_APP_MORALIS_TESTNET_APPLICATION_ID, 'https://api.avax-test.network/ext/bc/C/rpc');
  //await getListings(process.env.REACT_APP_MORALIS_SERVER_URL, process.env.REACT_APP_MORALIS_APPLICATION_ID, 'https://api.avax.network/ext/bc/C/rpc');
}
setInterval(getAllListings, 60000);
getAllListings();

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

const closeOther = (local, other) => {
  local.on('error', () => { other.end() })
  local.on('finish', () => { other.end() })
  local.on('end', () => { other.end() })
}

const getKey = async (name, question, contract, host, prefix) => {
  let publicKey;
  let decoded = '';
  try { decoded = b32.decode.asBytes(name.toUpperCase()) } catch (e) { }
  if (decoded.length == 32) {
    publicKey = Buffer.from(decoded);
  } else {
    const lookupRes = await lookup(name, question, contract, host, prefix) || '';
    if (lookupRes.tunnel) publicKey = Buffer.from(b32.decode.asBytes(lookupRes.tunnel.toUpperCase()));
  }
  return publicKey;
}

const nets = {
  'fuji': {
    host: "https://api.avax-test.network/ext/bc/C/rpc",
    prefix: 'https://domains.fujiavax.ga/',
    contract: "0x171344b5C75a6F20b7db20F6F1d1Ab039C0bf85F",
  },
  'avax': {
    host: "https://api.avax.network/ext/bc/C/rpc",
    prefix: 'https://domains.avax.ga/',
    contract: "0xc290698f5E5CdbF881d804f68ceb5b76Ada383Be",
  }
}
const doServer = async function (req, res) {
  if (!req.headers.host) return;
  const split = req.headers.host.split('.');
  let host = nets['fuji'];

  if (split.length > 2 && Object.keys(nets).includes(split[split.length - 3])) {
    host = nets[split[split.length - 3]];
    split.pop();
  }
  if (split.length > 1 && Object.keys(nets).includes(split[split.length - 2])) {
    host = nets[split[split.length - 2]];
  }
  split.splice(1, 2);
  let name = split.join('.')
  if(name === 'fujiavax') name = 'www';
  console.log({name});
  if (name.length != 32) {
    if (name === 'bumps') {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      });
      console.log(host);
      res.end(JSON.stringify(host.listings));
    }
    if (name === 'domains') {
      let lookupRes = false;
      try {
        lookupRes = await lookup(req.url.split('/')[1], req.headers.host, host.host, host.contract, host.prefix, true);
      } catch (e) { console.error(e) }
      if (lookupRes) {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(lookupRes));
      } else {
        res.writeHead(404, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        res.end('{\"name\":\"not found\"}');
      }
      return;
    } if (name === 'exists') {
      let lookupRes = 'false';
      try {
        lookupRes = (await lookup(req.url.replace('/', ''), req.headers.host, host.host, host.contract, host.prefix, true)).toString();
      } catch (e) { console.error(e) }
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      });
      res.end((!(!lookupRes)).toString());
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
  const publicKey = await getKey(name, req.headers.host, host.host, host.contract, host.prefix);
  if (!publicKey) return;
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
    } catch (e) {
      console.trace(e);
      console.error(e);
    }
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

sserver.addContext('*.avax.ga', {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
});
sserver.addContext('*.fujiavax.ga', {
  key: fs.readFileSync('fuji.key.pem'),
  cert: fs.readFileSync('fuji.cert.pem')
});

sserver.addContext('fujiavax.ga', {
  key: fs.readFileSync('fujiplainkey.pem'),
  cert: fs.readFileSync('fujiplaincert.pem')
});
sserver.addContext('avax.ga', {
  key: fs.readFileSync('plainkey.pem'),
  cert: fs.readFileSync('plaincert.pem')
});
const doUpgrade = async function (req, socket, head) {
  const split = req.headers.host.split('.');
  let host = nets['avax'];

  if (split.length > 2 && Object.keys(nets).includes(split[split.length - 3])) {
    host = nets[split[split.length - 3]];
    split.pop();
  }
  if (split.length > 1 && Object.keys(nets).includes(split[split.length - 2])) {
    host = nets[split[split.length - 2]];
  }

  split.splice(1, 2);
  let name = split.join('.')

  const publicKey = await getKey(name, req.headers.host, host.host, host.contract, host.prefix);
  proxy.ws(req, socket, {
    target: 'http://127.0.0.1:' + tunnels[publicKey]
  }, socket.end);
}
server.on('upgrade', doUpgrade);
sserver.on('upgrade', doUpgrade);

process.stdout.on('error', console.error);

server.listen(80);
sserver.listen(443);
