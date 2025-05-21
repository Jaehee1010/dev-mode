/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const shim = require('fabric-shim');

console.log('Starting VotingSystem.js...');

class VotingSystem {
  async Init(stub) {
    console.info('========= VotingSystem Init =========');
    try {
      console.info('Node version:', process.version);
      console.info('Current directory:', process.cwd());
      console.info('Initializing votingActive state...');
      const votingActive = {
        isActive: true,
        totalVoters: 0,
        totalVotes: 0
      };
      await stub.putState('votingActive', Buffer.from(JSON.stringify(votingActive)));
      // 상태 저장 확인
      const savedState = await stub.getState('votingActive');
      console.info('Saved votingActive state:', savedState.toString());
      console.info('========= VotingSystem Init Complete =========');
      return shim.success(Buffer.from(JSON.stringify({ message: '투표 시스템이 성공적으로 초기화 되었습니다.' })));
    } catch (error) {
      console.error('Init error:', error);
      return shim.error(`Failed to initialize ledger: ${error.message}`);
    }
  }

  async initLedger(stub, args) {
    console.info('========= VotingSystem initLedger =========');
    return this.Init(stub);
  }

  async Invoke(stub) {
    let ret = stub.getFunctionAndParameters();
    console.info('Invoke called with:', ret);
    let method = this[ret.fcn];
    if (!method) {
      console.error('No method of name:' + ret.fcn + ' found');
      return shim.error(`No function named ${ret.fcn} found`);
    }
    try {
      let payload = await method(stub, ret.params);
      return shim.success(payload);
    } catch (err) {
      console.error('Invoke error:', err);
      return shim.error(err.message);
    }
  }

  async registerCandidate(stub, args) {
    console.info('========= Register Candidate Start =========');
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting 2 (candidateId, name)');
    }
    const candidateId = args[0];
    const name = args[1];
    
    const candidate = {
      docType: 'candidate',
      id: candidateId,
      name: name,
      voteCount: 0,
      walletAddress: `candidate_${candidateId}`,
      registeredAt: new Date().toISOString()
    };
    await stub.putState(candidateId, Buffer.from(JSON.stringify(candidate)));
    console.info('========= Register Candidate Complete =========');
    return Buffer.from(JSON.stringify({ 
      message: `후보자 ${name}(ID: ${candidateId})가 성공적으로 등록되었습니다.` 
    }));
  }

  async registerVoter(stub, args) {
    console.info('========= Register Voter Start =========');
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting 2 (voterId, name)');
    }
    const voterId = args[0];
    const name = args[1];
    console.info('Received voterId:', voterId, 'name:', name);

    try {
      const voterAsBytes = await stub.getState(voterId);
      if (voterAsBytes && voterAsBytes.length > 0) {
        throw new Error(`${voterId} 아이디는 이미 등록되어 있습니다.`);
      }
      let votingStatusAsBytes = await stub.getState('votingActive');
      console.info('votingActive raw:', votingStatusAsBytes ? votingStatusAsBytes.toString() : 'undefined');
      if (!votingStatusAsBytes || votingStatusAsBytes.length === 0) {
        console.info('votingActive not found, initializing...');
        const votingActive = {
          isActive: true,
          totalVoters: 0,
          totalVotes: 0
        };
        await stub.putState('votingActive', Buffer.from(JSON.stringify(votingActive)));
        votingStatusAsBytes = await stub.getState('votingActive');
        console.info('Re-fetched votingActive:', votingStatusAsBytes.toString());
      }
      let votingStatus;
      try {
        if (!votingStatusAsBytes || votingStatusAsBytes.length === 0) {
          throw new Error('votingActive state is empty after initialization');
        }
        votingStatus = JSON.parse(votingStatusAsBytes.toString());
        console.info('Parsed votingStatus:', votingStatus);
      } catch (parseError) {
        console.error('Failed to parse votingActive:', parseError);
        throw new Error(`Failed to parse votingActive state: ${parseError.message}`);
      }
      if (!votingStatus.isActive) {
        throw new Error('투표가 종료되어 더 이상 유권자 등록이 불가능합니다.');
      }
      const walletAddress = `voter_${voterId}_${Date.now()}`;
      const voter = {
        docType: 'voter',
        id: voterId,
        name: name,
        walletAddress: walletAddress,
        hasVoted: false,
        voteToken: 1,
        rewardToken: 0,
        registeredAt: new Date().toISOString()
      };
      await stub.putState(voterId, Buffer.from(JSON.stringify(voter)));
      votingStatus.totalVoters += 1;
      await stub.putState('votingActive', Buffer.from(JSON.stringify(votingStatus)));
      console.info('========= Register Voter Complete =========');
      return Buffer.from(JSON.stringify({
        message: `유권자 ${name}(ID: ${voterId})가 성공적으로 등록되었습니다.`,
        walletAddress: walletAddress,
        voteToken: 1
      }));
    } catch (error) {
      console.error('registerVoter error:', error);
      throw new Error(`Failed to register voter: ${error.message}`);
    }
  }

  async vote(stub, args) {
    console.info('========= Vote Start =========');
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting 2 (voterId, candidateId)');
    }
    const voterId = args[0];
    const candidateId = args[1];

    const votingStatusAsBytes = await stub.getState('votingActive');
    if (!votingStatusAsBytes || votingStatusAsBytes.length === 0) {
      throw new Error('votingActive state not found');
    }
    const votingStatus = JSON.parse(votingStatusAsBytes.toString());
    if (!votingStatus.isActive) {
      throw new Error('투표가 이미 종료되었습니다.');
    }
    const voterAsBytes = await stub.getState(voterId);
    if (!voterAsBytes || voterAsBytes.length === 0) {
      throw new Error(`${voterId} 아이디는 등록되지 않은 유권자입니다.`);
    }
    const voter = JSON.parse(voterAsBytes.toString());
    if (voter.hasVoted) {
      throw new Error(`${voterId} 유권자는 이미 투표를 완료했습니다.`);
    }
    if (voter.voteToken <= 0) {
      throw new Error('투표 토큰이 없습니다.');
    }
    const candidateAsBytes = await stub.getState(candidateId);
    if (!candidateAsBytes || candidateAsBytes.length === 0) {
      throw new Error(`${candidateId} 아이디는 등록되지 않은 후보자입니다.`);
    }
    const candidate = JSON.parse(candidateAsBytes.toString());
    candidate.voteCount += 1;
    await stub.putState(candidateId, Buffer.from(JSON.stringify(candidate)));
    voter.hasVoted = true;
    voter.voteToken = 0;
    voter.votedFor = candidateId;
    voter.votedAt = new Date().toISOString();
    await stub.putState(voterId, Buffer.from(JSON.stringify(voter)));
    votingStatus.totalVotes += 1;
    await stub.putState('votingActive', Buffer.from(JSON.stringify(votingStatus)));
    console.info('========= Vote Complete =========');
    return Buffer.from(JSON.stringify({
      message: `${voterId} 유권자가 ${candidate.name} 후보자에게 성공적으로 투표했습니다.`,
      candidateName: candidate.name,
      candidateVotes: candidate.voteCount
    }));
  }

  async endVoting(stub, args) {
    console.info('========= End Voting Start =========');
    if (args.length !== 0) {
      throw new Error('Incorrect number of arguments. Expecting 0');
    }
    const votingStatusAsBytes = await stub.getState('votingActive');
    if (!votingStatusAsBytes || votingStatusAsBytes.length === 0) {
      throw new Error('votingActive state not found');
    }
    const votingStatus = JSON.parse(votingStatusAsBytes.toString());
    if (!votingStatus.isActive) {
      throw new Error('투표가 이미 종료되었습니다.');
    }
    const queryString = {
      selector: {
        docType: 'voter'
      }
    };
    const votersIterator = await stub.getQueryResult(JSON.stringify(queryString));
    let voterRewardCount = 0;
    while (true) {
      const res = await votersIterator.next();
      if (res.value) {
        const voterKey = res.value.key;
        const voterAsBytes = res.value.value.toString('utf8');
        const voter = JSON.parse(voterAsBytes);
        voter.rewardToken = 10;
        await stub.putState(voterKey, Buffer.from(JSON.stringify(voter)));
        voterRewardCount++;
      }
      if (res.done) {
        await votersIterator.close();
        break;
      }
    }
    votingStatus.isActive = false;
    votingStatus.endedAt = new Date().toISOString();
    await stub.putState('votingActive', Buffer.from(JSON.stringify(votingStatus)));
    console.info('========= End Voting Complete =========');
    return Buffer.from(JSON.stringify({
      message: '투표가 성공적으로 종료되었습니다.',
      totalVoters: votingStatus.totalVoters,
      totalVotes: votingStatus.totalVotes,
      votersRewarded: voterRewardCount,
      participationRate: ((votingStatus.totalVotes / votingStatus.totalVoters) * 100).toFixed(2) + '%'
    }));
  }

  async getVotingResults(stub, args) {
    console.info('========= Get Voting Results Start =========');
    if (args.length !== 0) {
      throw new Error('Incorrect number of arguments. Expecting 0');
    }
    const votingStatusAsBytes = await stub.getState('votingActive');
    if (!votingStatusAsBytes || votingStatusAsBytes.length === 0) {
      throw new Error('votingActive state not found');
    }
    const votingStatus = JSON.parse(votingStatusAsBytes.toString());
    const queryString = {
      selector: {
        docType: 'candidate'
      }
    };
    const candidatesIterator = await stub.getQueryResult(JSON.stringify(queryString));
    const results = {
      isActive: votingStatus.isActive,
      totalVoters: votingStatus.totalVoters,
      totalVotes: votingStatus.totalVotes,
      participationRate: ((votingStatus.totalVotes / votingStatus.totalVoters) * 100).toFixed(2) + '%',
      candidates: []
    };
    while (true) {
      const res = await candidatesIterator.next();
      if (res.value) {
        const candidateAsBytes = res.value.value.toString('utf8');
        const candidate = JSON.parse(candidateAsBytes);
        const votePercentage = votingStatus.totalVotes > 0 ?
          ((candidate.voteCount / votingStatus.totalVotes) * 100).toFixed(2) + '%' : '0.00%';
        results.candidates.push({
          id: candidate.id,
          name: candidate.name,
          voteCount: candidate.voteCount,
          votePercentage: votePercentage
        });
      }
      if (res.done) {
        await candidatesIterator.close();
        break;
      }
    }
    results.candidates.sort((a, b) => b.voteCount - a.voteCount);
    console.info('========= Get Voting Results Complete =========');
    return Buffer.from(JSON.stringify(results));
  }

  async getVoterInfo(stub, args) {
    console.info('========= Get Voter Info Start =========');
    if (args.length !== 1) {
      throw new Error('Incorrect number of arguments. Expecting 1 (voterId)');
    }
    const voterId = args[0];
    const voterAsBytes = await stub.getState(voterId);
    if (!voterAsBytes || voterAsBytes.length === 0) {
      throw new Error(`${voterId} 아이디는 등록되지 않은 유권자입니다.`);
    }
    console.info('========= Get Voter Info Complete =========');
    return voterAsBytes;
  }

  async getCandidateInfo(stub, args) {
    console.info('========= Get Candidate Info Start =========');
    if (args.length !== 1) {
      throw new Error('Incorrect number of arguments. Expecting 1 (candidateId)');
    }
    const candidateId = args[0];
    const candidateAsBytes = await stub.getState(candidateId);
    if (!candidateAsBytes || candidateAsBytes.length === 0) {
      throw new Error(`${candidateId} 아이디는 등록되지 않은 후보자입니다.`);
    }
    console.info('========= Get Candidate Info Complete =========');
    return candidateAsBytes;
  }
}

console.log('Starting VotingSystem...');
shim.start(new VotingSystem());