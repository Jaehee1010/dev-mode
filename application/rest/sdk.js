'use strict';

const { Wallets, Gateway } = require('fabric-network');
const path = require('path');
const fs = require('fs');

const channelName = 'channel1';
const chaincodeName = 'abstore';

const walletPath = path.join(process.cwd(), '..', 'wallet');
const ccpPath = path.resolve(__dirname, '..', 'connection-org1.json');
const org1UserId = 'appUser';

async function send(type, func, args, res) { // 콜백 제거, res만 받음
    try {
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        const gateway = new Gateway();

        try {
            await gateway.connect(ccp, {
                wallet,
                identity: org1UserId,
                discovery: { enabled: true, asLocalhost: false }
            });
            console.log('Success to connect network');

            const network = await gateway.getNetwork(channelName);
            console.log('Success to connect channel1');
            const contract = network.getContract(chaincodeName);

            let result;
            if (type) {
                result = await contract.evaluateTransaction(func, ...args);
                res.json(JSON.parse(result.toString())); // JSON 파싱 후 응답
            } else {
                result = await contract.submitTransaction(func, ...args);
                res.json({ message: 'Transaction submitted successfully', result: JSON.parse(result.toString()) });
            }
        } catch (error) {
            console.error('Transaction error:', error);
            res.status(500).json({ error: `Transaction failed: ${error.message}` });
        } finally {
            gateway.disconnect();
        }
    } catch (error) {
        console.error('Connection error:', error);
        res.status(500).json({ error: `Connection failed: ${error.message}` });
    }
}

module.exports = {
    send: send
};