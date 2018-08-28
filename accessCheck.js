function getClientIp(req) {
  var ipAddress;
  var forwardedIpsStr = req.headers['x-forwarded-for'];
  if (forwardedIpsStr) {
    var forwardedIps = forwardedIpsStr.split(',');
    ipAddress = forwardedIps[0];
  }
  if (!ipAddress) {
    ipAddress = req.connection.remoteAddress;
  }
  return ipAddress;
}

function checkIPs(req, res, next, ips) {
  const ipaddress = getClientIp(req);
  if (ips.indexOf(ipaddress) !== -1) return next();
  console.log(`deny ipaddress ${ipaddress}`);
  res.statusCode = 401;
  res.end('Unauthorized');
}

module.exports = {
  checkIPs,
}

/*
//使い方
const allowAddresses = [ '::1', ];
app.use( (req, res, next) => {
  return checkIPs(req, res, next, allowAddresses);
})
*/
