const os = require('os');

const getLanIPv4 = () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
};

const getPublicBaseUrl = (req, port) => {
  const lan = getLanIPv4();
  const host = req?.get?.('host');
  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    const proto = req.protocol || 'http';
    return `${proto}://${host}`;
  }
  return `http://${lan}:${port}`;
};

module.exports = { getLanIPv4, getPublicBaseUrl };
