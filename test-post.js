const http = require('http');
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/catalog',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(`STATUS: ${res.statusCode}\nBODY: ${data}`));
});
req.write(JSON.stringify({sku:"SVC-003",name:"Test Managed Service",type:"MANAGED_SERVICE",pricing:[{pricingModel:"FLAT",costMrc:0,costNrc:0}]}));
req.end();
