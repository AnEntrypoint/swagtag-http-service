const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const DHT = require("@hyperswarm/dht");
const net = require("net");
const axios = require('axios');
require('dotenv').config();

const validateSubdomain = (subdomain) => {
  const MIN_LENGTH = 1;
  const MAX_LENGTH = 63;
  const ALPHA_NUMERIC_REGEX = /^[a-z][a-z-]*[a-z0-9]*$/;
  const START_END_HYPHEN_REGEX = /A[^-].*[^-]z/i;
  const reservedNames = [
    "www",
    "ftp",
    "mail",
    "pop",
    "smtp",
    "admin",
    "ssl",
    "sftp"
  ];
  //if is reserved...
  if (reservedNames.includes(subdomain))
    throw new Error("cannot be a reserved name");

  //if is too small or too big...
  if (subdomain.length < MIN_LENGTH || subdomain.length > MAX_LENGTH)
    throw new Error(
      `must have between ${MIN_LENGTH} and ${MAX_LENGTH} characters`
    );

  //if subdomain is started/ended with hyphen or is not alpha numeric
  if (!ALPHA_NUMERIC_REGEX.test(subdomain) || START_END_HYPHEN_REGEX.test(subdomain))
    throw new Error(
      subdomain.indexOf("-") === 0 ||
      subdomain.indexOf("-") === subdomain.length - 1
        ? "cannot start or end with a hyphen"
        : "must be alphanumeric (or hyphen)"
    );

  return true;
};

const nets = {
  'fuji': {
    host: "https://api.avax-test.network/ext/bc/C/rpc",
    prefix: 'https://domains.fujiavax.ga/',
    contract: "0x171344b5C75a6F20b7db20F6F1d1Ab039C0bf85F",
  },
  'avax': {
    host: "https://api.avax.network/ext/bc/C/rpc",
    prefix: 'https://domains.avax.ga/',
    contract: "0xD78b1732aBc4A25C17824Ea9510D7a66a4a09A75",
  }
}

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
const getListings = async (serverUrl, appId, netHost, host) => {
  const Moralis = require("moralis/node");
  Moralis.initialize(appId);
  Moralis.serverURL = serverUrl;
  Moralis.start({ appId, serverUrl });
  const doneTrades = [];
  const Trades = Moralis.Object.extend("Trades");
  const query = new Moralis.Query(Trades);
  query.descending("createdAt");
  const results = await query.find();
  const outTrades = [];
  for (let i = 0; i < results.length; i++) {
    const object = results[i];
    const name = object.get('name').replace(host.prefix, '');
    try {
      if(doneTrades[name]) continue;
      doneTrades.push(name);
      validateSubdomain(name);
      const output = Object.assign({},await lookup(name, name, host.host,host.contract, host.prefix));
      output.uri = object.get('name');
      output.token_id = object.get('item');
      output.trade_id = object.get('ad');
      output.price = object.get('price');
      outTrades.push(output)
    } catch(e) {
      console.log(e);
    }
  }
  for (x of Object.keys(nets)) {
    if (nets[x].host === netHost) nets[x].trades = outTrades;
  }

  Moralis.Cloud.run("List", JSON.stringify({})).then(
    async listings => {
      console.log('listings');
      const out = [];
      const done = [];
      for (listing of listings) {
        if(done.includes(listing.name)) {
          continue
        } else {
          done.push(listing.name);
        }
        /*try {
          lookup = lookup.join('/');
          console.log('checking', lookup);
          await axios.get(lookup+'/', {timeout:1000});
          console.log('passed');
        } catch (e) {
          console.error('failed ', lookup);
          try {
            lookup = lookup.replace('https', 'http');
            console.log('checking', lookup);
            await axios.get(lookup+'/', {timeout:1000});
            listing.enableHttp = true;
          } catch(e) {
          }
          listing.disableLink = true;
        }*/
        try {
          //console.log('checking image', listing.address.image);
          await axios.get(listing.address.image);
          out.push(listing);
        } catch (e) {
          console.error('failed image', lookup)
          console.error('failed');
        }
      }
      for (x of Object.keys(nets)) {
        if (nets[x].host === netHost) nets[x].listings = out;
      }
      console.log('done');
    }
  );
}
const getAllListings = async () => {
  await getListings(process.env.REACT_APP_MORALIS_TESTNET_SERVER_URL, process.env.REACT_APP_MORALIS_TESTNET_APPLICATION_ID, 'https://api.avax-test.network/ext/bc/C/rpc', nets['fuji']);
  await getListings(process.env.REACT_APP_MORALIS_SERVER_URL, process.env.REACT_APP_MORALIS_APPLICATION_ID, 'https://api.avax.network/ext/bc/C/rpc', nets['avax']);
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

const getKey = async (name, question, host, contract, prefix) => {
  let publicKey;
  let decoded = '';
  if(name === 'www') return Buffer.from(b32.decode.asBytes('4eytcu72vmojkgkjxvgpkpl76qg5gh23bxca7flwqpxovtkrbhdq'.toUpperCase()))
  try { decoded = b32.decode.asBytes(name.toUpperCase()) } catch (e) { }
  
  if (decoded.length == 32) {
    publicKey = Buffer.from(decoded);
  } else {
    const lookupRes = await lookup(name, question, host, contract, prefix) || '';
    if (lookupRes.tunnel) publicKey = Buffer.from(b32.decode.asBytes(lookupRes.tunnel.toUpperCase()));
  }
  return publicKey;
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
  if (name === 'fujiavax') name = 'www';
  if (name.length != 32) {
    if (name === 'bumps') {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      });
      console.log(host);
      res.end(JSON.stringify(host.listings));
    }
    if (name === 'trades') {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      });
      console.log(host);
      res.end(JSON.stringify(host.trades));
    }
    if (name === 'balance') {
      let lookupRes = false;
      try {
        const paramsplit = req.url.split('?');
        lookupRes = await lookup(req.url.split('/')[1].split('?')[0], req.headers.host, host.host, host.contract, host.prefix, true, (paramsplit.length>1)?paramsplit[1]:null);
      } catch (e) { console.error(e) }
      if (lookupRes) {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        console.log('looking up balance');
        res.end(JSON.stringify(lookupRes));
      } else {
        res.writeHead(404, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify([]));
      }
      return;
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
  console.log(req.headers);
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
  if (name === 'fujiavax') name = 'www';

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
