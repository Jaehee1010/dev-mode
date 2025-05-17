const express = require('express');
const app = express();
let path = require('path');
let sdk = require('./sdk');

const PORT = 8001;
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/init', function (req, res) {
   const { WalletName, Username, Password } = req.body;
   const args = [WalletName, Username, Password];
   sdk.send(false, 'Init', args, res);
});

app.get('/add_balance', function (req, res) {
   const { WalletName, amount } = req.query;
   const args = [WalletName, amount.toString()];
   sdk.send(false, 'AddBalance', args, res);
});

app.post('/exchange_balance', function (req, res) {
   const { walletName1, walletName2, amount } = req.body;
   const args = [walletName1, walletName2, amount.toString()];
   sdk.send(false, 'ExchangeBalance', args, res);
});

app.get('/queryall', function (req, res) {
  // Modified to ensure we're always returning an array
  sdk.send(true, 'QueryAll', [], function(err, data) {
    if (err) {
      return res.status(500).json({ error: err.toString() });
    }
    
    // Ensure data is an array before sending the response
    try {
      let result = data;
      if (typeof result === 'string') {
        result = JSON.parse(result);
      }
      
      // If result is not an array, wrap it in an array
      if (!Array.isArray(result)) {
        if (result === null || result === undefined) {
          result = [];
        } else {
          result = [result];
        }
      }
      
      res.json(result);
    } catch (e) {
      console.error("Error processing query results:", e);
      res.status(500).json({ error: "Error processing query results" });
    }
  });
});
app.use(express.static(path.join(__dirname, '../client')));
app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);