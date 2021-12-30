const Web3 = require("web3");
const web3 = new Web3("https://api.avax-test.network/ext/bc/C/rpc");
const NodeCache = require("node-cache");
const myCache = new NodeCache({ stdTTL: 60 * 60 * 10, checkperiod: 120 });
const DHT = require("@hyperswarm/dht");
var base32 = require("hi-base32");
const node = new DHT();
const { Packet } = require('dns2');

const ABI = [
  {
    constant: true,
    inputs: [
      {
        internalType: "string",
        name: "_name",
        type: "string",
      },
    ],
    name: "viewNamesIPAddress",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

const ips = {};
const contract = new web3.eth.Contract(
  ABI,
  "0x997963C5c90d39C1E6f96Ea088eF5109f8dc8de1"
);
module.exports = async (outname) => {
    console.log({outname});
  const cache = myCache.get(outname);

  const update = async () => {
    let address = await contract.methods
    .viewNamesIPAddress(outname.toLowerCase())
    .call();
    if (address.startsWith("tun:")) {
      let addressout = address.split(':');
      const out = addressout.pop();
      myCache.set(outname, out);
      return out;
    } 
    console.log('not found', address)
    return;
  };
  console.log({cache})
  if (cache) return cache;
  return update();
};
