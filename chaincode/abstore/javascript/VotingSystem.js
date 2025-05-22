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
    let ret = stub.getFunctionAndParameters();
    console.info('Init function called with:', ret);
    
    try {
      // 투표 시스템 초기 상태 설정 (단순화)
      const votingActive = {
        isActive: true,
        totalVoters: 0,
        totalVotes: 0
      };
      
      await stub.putState('votingActive', Buffer.from(JSON.stringify(votingActive)));
      console.info('========= VotingSystem Init Complete =========');
      
      // ABstore 패턴처럼 단순하게 success() 반환
      return shim.success();
      
    } catch (error) {
      console.error('Init error:', error);
      return shim.error(error.toString());
    }
  }

  // initLedger는 Init와 동일하게 처리하거나 제거
  // async initLedger(stub, args) {
  //   console.info('========= VotingSystem initLedger =========');
  //   // Init 함수와 동일한 로직으로 처리
  //   return await this.Init(stub);
  // }

  async Invoke(stub) {
    let ret = stub.getFunctionAndParameters();
    console.info('Invoke called with:', ret);
    
    let method = this[ret.fcn];
    if (!method) {
      console.log('no method of name:' + ret.fcn + ' found');
      return shim.success(); // ABstore 패턴: 에러 대신 success 반환
    }
    
    try {
      let payload = await method(stub, ret.params);
      return shim.success(payload);
    } catch (err) {
      console.log('Invoke error:', err);
      return shim.error(err.toString()); // 문자열로 변환
    }
  }

  async registerCandidate(stub, args) {
    console.info('========= Register Candidate Start =========');
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting 2 (candidateId, name)');
    }
    
    const candidateId = args[0];
    const name = args[1];
    
    // 입력 검증
    if (!candidateId || !name) {
      throw new Error('candidateId and name cannot be empty');
    }
    
    const candidateAsBytes = await stub.getState(candidateId);
    if (candidateAsBytes && candidateAsBytes.length > 0) {
      throw new Error(`Candidate ${candidateId} is already registered`);
    }

    const candidate = {
      docType: 'candidate',
      id: candidateId,
      name: name,
      voteCount: 0,
      registeredAt: new Date().toISOString()
    };
    
    await stub.putState(candidateId, Buffer.from(JSON.stringify(candidate)));
    console.info('========= Register Candidate Complete =========');
    
    // 안전한 Buffer 반환
    const response = { 
      message: `후보자 ${name}(ID: ${candidateId})가 성공적으로 등록되었습니다.` 
    };
    return Buffer.from(JSON.stringify(response));
  }

  async registerVoter(stub, args) {
    console.info('========= Register Voter Start =========');
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting 2 (voterId, name)');
    }
    
    const voterId = args[0];
    const name = args[1];
    console.info('Received voterId:', voterId, 'name:', name);

    // 입력 검증
    if (!voterId || !name) {
      throw new Error('voterId and name cannot be empty');
    }

    try {
      const voterAsBytes = await stub.getState(voterId);
      if (voterAsBytes && voterAsBytes.length > 0) {
        throw new Error(`유권자 ${voterId} 아이디는 이미 등록되어 있습니다.`);
      }

      const votingStatusAsBytes = await stub.getState('votingActive');
      if (!votingStatusAsBytes || votingStatusAsBytes.length === 0) {
        throw new Error('votingActive state not found. Initialize the ledger first.');
      }

      let votingStatus;
      try {
        votingStatus = JSON.parse(votingStatusAsBytes.toString());
        console.info('Parsed votingStatus:', votingStatus);
      } catch (parseError) {
        console.error('Failed to parse votingActive:', parseError);
        throw new Error(`Failed to parse votingActive state: ${parseError.message}`);
      }

      if (!votingStatus.isActive) {
        throw new Error('투표가 종료되어 더 이상 유권자 등록이 불가능합니다.');
      }

      const voter = {
        docType: 'voter',
        id: voterId,
        name: name,
        hasVoted: false,
        registeredAt: new Date().toISOString()
      };
      
      await stub.putState(voterId, Buffer.from(JSON.stringify(voter)));

      votingStatus.totalVoters += 1;
      await stub.putState('votingActive', Buffer.from(JSON.stringify(votingStatus)));
      
      console.info('========= Register Voter Complete =========');
      return Buffer.from(JSON.stringify({
        message: `유권자 ${name}(ID: ${voterId})가 성공적으로 등록되었습니다.`
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

    // 입력 검증
    if (!voterId || !candidateId) {
      throw new Error('voterId and candidateId cannot be empty');
    }

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
      throw new Error(`유권자 ${voterId} 아이디는 등록되지 않은 유권자입니다.`);
    }
    
    const voter = JSON.parse(voterAsBytes.toString());
    if (voter.hasVoted) {
      throw new Error(`유권자 ${voterId}는 이미 투표를 완료했습니다.`);
    }

    const candidateAsBytes = await stub.getState(candidateId);
    if (!candidateAsBytes || candidateAsBytes.length === 0) {
      throw new Error(`후보자 ${candidateId} 아이디는 등록되지 않은 후보자입니다.`);
    }
    
    const candidate = JSON.parse(candidateAsBytes.toString());

    // 투표 처리
    candidate.voteCount += 1;
    await stub.putState(candidateId, Buffer.from(JSON.stringify(candidate)));

    voter.hasVoted = true;
    voter.votedFor = candidateId;
    voter.votedAt = new Date().toISOString();
    await stub.putState(voterId, Buffer.from(JSON.stringify(voter)));

    votingStatus.totalVotes += 1;
    await stub.putState('votingActive', Buffer.from(JSON.stringify(votingStatus)));

    console.info('========= Vote Complete =========');
    return Buffer.from(JSON.stringify({
      message: `유권자 ${voterId}가 ${candidate.name} 후보자에게 성공적으로 투표했습니다.`,
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

    votingStatus.isActive = false;
    votingStatus.endedAt = new Date().toISOString();
    await stub.putState('votingActive', Buffer.from(JSON.stringify(votingStatus)));
    
    console.info('========= End Voting Complete =========');
    const participationRate = votingStatus.totalVoters > 0 ? 
      ((votingStatus.totalVotes / votingStatus.totalVoters) * 100).toFixed(2) + '%' : '0.00%';
      
    return Buffer.from(JSON.stringify({
      message: '투표가 성공적으로 종료되었습니다.',
      totalVoters: votingStatus.totalVoters,
      totalVotes: votingStatus.totalVotes,
      participationRate: participationRate
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
    const participationRate = votingStatus.totalVoters > 0 ? 
      ((votingStatus.totalVotes / votingStatus.totalVoters) * 100).toFixed(2) + '%' : '0.00%';
      
    const results = {
      isActive: votingStatus.isActive,
      totalVoters: votingStatus.totalVoters,
      totalVotes: votingStatus.totalVotes,
      participationRate: participationRate,
      candidates: []
    };
    
    try {
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
          break;
        }
      }
    } finally {
      await candidatesIterator.close();
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
    if (!voterId) {
      throw new Error('voterId cannot be empty');
    }
    
    const voterAsBytes = await stub.getState(voterId);
    if (!voterAsBytes || voterAsBytes.length === 0) {
      throw new Error(`유권자 ${voterId} 아이디는 등록되지 않은 유권자입니다.`);
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
    if (!candidateId) {
      throw new Error('candidateId cannot be empty');
    }
    
    const candidateAsBytes = await stub.getState(candidateId);
    if (!candidateAsBytes || candidateAsBytes.length === 0) {
      throw new Error(`후보자 ${candidateId} 아이디는 등록되지 않은 후보자입니다.`);
    }
    
    console.info('========= Get Candidate Info Complete =========');
    return candidateAsBytes;
  }
}

console.log('Starting VotingSystem...');
shim.start(new VotingSystem());