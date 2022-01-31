const Web3 = require("web3");
const nets = [];
const NodeCache = require("node-cache");

const ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function",
    "constant": true
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      }
    ],
    "name": "tokenURI",
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
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      }
    ],
    "name": "tokenOfOwnerByIndex",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },

  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "getAddressForId",
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
  }
];

module.exports = async (outname, question, net, contract, prefix, any, invalidate) => {
  if (!net) return;
  if (!nets[net]) {
    nets[net] = [];
    const web3 = nets[net].web3 = new Web3(net);
    nets[net].contract = new web3.eth.Contract(ABI, contract);
    nets[net].cache = new NodeCache({ stdTTL: 300, checkperiod: 30 });
  }
  const update = async () => {
    console.log(outname);
    if(outname.startsWith('0x')) {
      if(invalidate) value = nets[net].cache.del( outname );
      else {
        const cached = nets[net].cache.get(outname);
        if(cached) return cached;
      }
      let balance = await nets[net].contract.methods.balanceOf(outname.toLowerCase()).call();
      console.log({balance, net, contract});
      const out = [];
      for(let index = 0; index < balance; index++) {
        let tokenIndex = await nets[net].contract.methods.tokenOfOwnerByIndex(outname, index).call();
        let address = await nets[net].contract.methods.getAddressForId(tokenIndex).call();
        try {
          address = JSON.parse(address);
          address.token_id = tokenIndex;
          out.push(address);
        } catch(e) {
          console.log(e);
          out.push({token_id:tokenIndex, uri:await nets[net].contract.methods.tokenURI(tokenIndex).call()});
        }
      }
      nets[net].cache.set(outname, out);
      return out;
    }
    console.log({net});
    const cache = nets[net].cache.get(question);
    if (cache) return cache;
    let address = nets[net].cache.get(outname.toLowerCase());
    if(!address) address = await nets[net].contract.methods.getAddress(outname.toLowerCase()).call();
    nets[net].cache.set(outname.toLowerCase(), address);
    try {
      address = JSON.parse(address);
      nets[net].cache.set(outname, address);
    } catch (e) { }
    if (address && any) return address;
    return address || {};
  };
  return update() || '';
};
