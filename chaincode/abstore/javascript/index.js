'use strict';
console.log('Starting index.js...');
console.log('Node version:', process.version);
console.log('Current directory:', process.cwd());
console.log('Loading VotingSystem.js...');
try {
    const VotingSystem = require('./VotingSystem.js');
    console.log('VotingSystem.js loaded successfully');
    module.exports.contracts = [VotingSystem];
} catch (error) {
    console.error('Error loading VotingSystem.js:', error);
    process.exit(1);
}
console.log('index.js initialization complete');