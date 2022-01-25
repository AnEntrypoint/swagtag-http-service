const Web3 = require("web3");
const nets = [];
const NodeCache = require("node-cache");

const ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_name",
        "type": "string"
      }
    ],
    "name": "getAddress",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function",
    "constant": true
  },
];

module.exports = async (outname, question, net, contract, prefix, any) => {
  if (!net) return;
  if (!nets[net]) {
    nets[net] = [];
    const web3 = nets[net].web3 = new Web3(net);
    nets[net].contract = new web3.eth.Contract(ABI, contract);
    nets[net].cache = new NodeCache({ stdTTL: 60 * 60 * 10, checkperiod: 120 });
  }

  const update = async () => {
    let address = await nets[net].contract.methods.getAddress(outname.toLowerCase()).call();
    try {
      address = JSON.parse(address);
    } catch (e) { }
    if (address && any) return address;
    return address || '{}';
  };
  const cache = nets[net].cache.get(question);
  if (cache) return cache;
  return update() || '';
};
