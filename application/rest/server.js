const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');
const sdk = require('./sdk');

const PORT = 8001;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize the voting system
app.get('/init', function (req, res) {
    let args = [];
    sdk.send(false, 'initializeVotingSystem', args, res); // initLedger 대신 Init 호출
});

// Register a candidate
app.get('/registerCandidate', function (req, res) {
    let candidateId = req.query.candidateId;
    let name = req.query.name;
    let args = [candidateId, name];
    sdk.send(false, 'registerCandidate', args, res);
});

// Register a voter
app.get('/registerVoter', function (req, res) {
    let voterId = req.query.voterId;
    let name = req.query.name;
    let args = [voterId, name];
    sdk.send(false, 'registerVoter', args, res);
});

// Cast a vote
app.get('/vote', function (req, res) {
    let voterId = req.query.voterId;
    let candidateId = req.query.candidateId;
    let args = [voterId, candidateId];
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
    let voterId = req.query.voterId;
    let args = [voterId];
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