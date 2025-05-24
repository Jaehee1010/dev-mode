const express = require('express');
const cors = require('cors');
//const crypto = require('crypto');
const app = express();
const path = require('path');
const sdk = require('./sdk');

const PORT = 8001;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 뒷자리 해시 함수
// function hashRRNSuffix(rrnSuffix) {
//     return crypto.createHash('sha256').update(rrnSuffix).digest('hex');
// }

// Initialize the voting system
app.get('/init', function (req, res) {
    let args = [];
    sdk.send(false, 'initializeVotingSystem', args, res); // Init대신 initializeVotingSystem으로 변경
});

// Register a candidate
app.get('/registerCandidate', function (req, res) {
    let candidateId = req.query.candidateId;
    let name = req.query.name;
    let partyName = req.query.partyName;
    let args = [candidateId, partyName, name];
    sdk.send(false, 'registerCandidate', args, res);
});

// Register a voter and hash resident
app.get('/registerVoter', function (req, res) {
    let name = req.query.name;
    let rrnSuffix = req.query.rrnSuffix;

    if (!name || !rrnSuffix) {
        return res.status(400).json({ error: 'name과 rrnSuffix는 필수입니다.' });
    }
    
    //const hashedRrn = hashRRNSuffix(rrnSuffix);
    const args = [name, rrnSuffix];
    sdk.send(false, 'registerVoter', args, res);
});

// Cast a vote and hash resident
app.get('/vote', function (req, res) {
    const voterName = req.query.voterName;
    const rrnSuffix = req.query.rrnSuffix;
    const candidateName = req.query.candidateName;

    if (!voterName || !rrnSuffix || !candidateName) {
        return res.status(400).json({ error: 'voterName, rrnSuffix, candidateName는 필수입니다.' });
    }

    //const hashedRrn = hashRRNSuffix(rrnSuffix);
    const args = [voterName, rrnSuffix, candidateName];
    sdk.send(false, 'vote', args, res);
});

// End the voting process
app.get('/endVoting', function (req, res) {
    let args = [];
    sdk.send(false, 'endVoting', args, res);
});

// Get voting results
app.get('/getVotingResults', function (req, res) {
    let args = [];
    sdk.send(true, 'getVotingResults', args, res);
});

// Get voter information
app.get('/getVoterInfo', function (req, res) {
    const voterName = req.query.voterName;
    const rrnSuffix = req.query.rrnSuffix;
    
    if (!voterName || !rrnSuffix) {
        return res.status(400).json({ error: 'voterName과 rrnSuffix는 필수입니다.' });
    }

    //const hashedRrn = hashRRNSuffix(rrnSuffix);
    const args = [voterName, rrnSuffix];
    sdk.send(true, 'getVoterInfo', args, res);
});

// Get candidate information
app.get('/getCandidateInfo', function (req, res) {
    let candidateId = req.query.candidateId;
    let args = [candidateId];
    sdk.send(true, 'getCandidateInfo', args, res);
});

app.use(express.static(path.join(__dirname, '../client')));
app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);