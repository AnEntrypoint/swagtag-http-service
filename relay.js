const crypto = require("hypercore-crypto");

module.exports = () => {
  return {
    /* share a local port remotely */
    serve: (key, port,) => {
      const keyPair = crypto.keyPair(crypto.data(Buffer.from(key)));
      const server = node.createServer();
      server.on("connection", function (socket) {
        var local = net.connect(port, "localhost");
        pump(socket, local, socket);
      });
      server.listen(keyPair);
      return keyPair.publicKey;
    },
    /* reflect a remote port locally */
    client: (publicKey, port) => {
      var server = net.createServer(function (servsock) {
        console.log('connection');
        const socket = node.connect(publicKey);
        pump(servsock, socket, servsock);
        console.log('started pump');
      });
      server.listen(port, "127.0.0.1");
    }
  };
};