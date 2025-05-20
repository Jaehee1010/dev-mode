'use strict';
console.log('Starting VotingSystem.js...');
console.log('Loading fabric-contract-api...');
try {
    const { Contract } = require('fabric-contract-api');
    console.log('fabric-contract-api loaded in VotingSystem.js, version:', require('fabric-contract-api/package.json').version);
    console.log('Contract class available:', !!Contract);
} catch (error) {
    console.error('Error loading fabric-contract-api in VotingSystem.js:', error);
    process.exit(1);
}

class VotingSystem extends Contract {
    async initLedger(ctx) {
        console.info('============= 체인코드 초기화 시작 =============');
        try {
            console.info('Node version:', process.version);
            console.info('Current directory:', process.cwd());
            console.info('Stub available:', !!ctx.stub);
            console.info('Initializing votingActive state...');
            await ctx.stub.putState('votingActive', Buffer.from(JSON.stringify({
                isActive: true,
                totalVoters: 0,
                totalVotes: 0
            })));
            console.info('============= 체인코드 초기화 완료 =============');
            return { message: '투표 시스템이 성공적으로 초기화 되었습니다.' };
        } catch (error) {
            console.error('InitLedger error:', error);
            throw new Error(`Failed to initialize ledger: ${error.message}`);
        }
    }
    // 나머지 함수 유지
    async registerCandidate(ctx, candidateId, name) {
        console.info('============= 후보자 등록 시작 =============');
        const candidate = {
            docType: 'candidate',
            id: candidateId,
            name: name,
            voteCount: 0,
            walletAddress: `candidate_${candidateId}`,
            registeredAt: new Date().toISOString()
        };
        await ctx.stub.putState(candidateId, Buffer.from(JSON.stringify(candidate)));
        console.info('============= 후보자 등록 완료 =============');
        return { message: `후보자 ${name}(ID: ${candidateId})가 성공적으로 등록되었습니다.` };
    }
    async registerVoter(ctx, voterId, name) {
        console.info('============= 유권자 등록 시작 =============');
        const voterAsBytes = await ctx.stub.getState(voterId);
        if (voterAsBytes && voterAsBytes.length > 0) {
            throw new Error(`${voterId} 아이디는 이미 등록되어 있습니다.`);
        }
        const votingStatusAsBytes = await ctx.stub.getState('votingActive');
        const votingStatus = JSON.parse(votingStatusAsBytes.toString());
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
        await ctx.stub.putState(voterId, Buffer.from(JSON.stringify(voter)));
        votingStatus.totalVoters += 1;
        await ctx.stub.putState('votingActive', Buffer.from(JSON.stringify(votingStatus)));
        console.info('============= 유권자 등록 완료 =============');
        return { 
            message: `유권자 ${name}(ID: ${voterId})가 성공적으로 등록되었습니다.`,
            walletAddress: walletAddress,
            voteToken: 1
        };
    }
    async vote(ctx, voterId, candidateId) {
        console.info('============= 투표 시작 =============');
        const votingStatusAsBytes = await ctx.stub.getState('votingActive');
        const votingStatus = JSON.parse(votingStatusAsBytes.toString());
        if (!votingStatus.isActive) {
            throw new Error('투표가 이미 종료되었습니다.');
        }
        const voterAsBytes = await ctx.stub.getState(voterId);
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
        const candidateAsBytes = await ctx.stub.getState(candidateId);
        if (!candidateAsBytes || candidateAsBytes.length === 0) {
            throw new Error(`${candidateId} 아이디는 등록되지 않은 후보자입니다.`);
        }
        const candidate = JSON.parse(candidateAsBytes.toString());
        candidate.voteCount += 1;
        await ctx.stub.putState(candidateId, Buffer.from(JSON.stringify(candidate)));
        voter.hasVoted = true;
        voter.voteToken = 0;
        voter.votedFor = candidateId;
        voter.votedAt = new Date().toISOString();
        await ctx.stub.putState(voterId, Buffer.from(JSON.stringify(voter)));
        votingStatus.totalVotes += 1;
        await ctx.stub.putState('votingActive', Buffer.from(JSON.stringify(votingStatus)));
        console.info('============= 투표 완료 =============');
        return { 
            message: `${voterId} 유권자가 ${candidate.name} 후보자에게 성공적으로 투표했습니다.`,
            candidateName: candidate.name,
            candidateVotes: candidate.voteCount
        };
    }
    async endVoting(ctx) {
        console.info('============= 투표 종료 시작 =============');
        const votingStatusAsBytes = await ctx.stub.getState('votingActive');
        const votingStatus = JSON.parse(votingStatusAsBytes.toString());
        if (!votingStatus.isActive) {
            throw new Error('투표가 이미 종료되었습니다.');
        }
        const queryString = {
            selector: {
                docType: 'voter'
            }
        };
        const votersIterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
        let voterRewardCount = 0;
        while (true) {
            const res = await votersIterator.next();
            if (res.value) {
                const voterKey = res.value.key;
                const voterAsBytes = res.value.value.toString('utf8');
                const voter = JSON.parse(voterAsBytes);
                voter.rewardToken = 10;
                await ctx.stub.putState(voterKey, Buffer.from(JSON.stringify(voter)));
                voterRewardCount++;
            }
            if (res.done) {
                await votersIterator.close();
                break;
            }
        }
        votingStatus.isActive = false;
        votingStatus.endedAt = new Date().toISOString();
        await ctx.stub.putState('votingActive', Buffer.from(JSON.stringify(votingStatus)));
        console.info('============= 투표 종료 완료 =============');
        return { 
            message: '투표가 성공적으로 종료되었습니다.',
            totalVoters: votingStatus.totalVoters,
            totalVotes: votingStatus.totalVotes,
            votersRewarded: voterRewardCount,
            participationRate: ((votingStatus.totalVotes / votingStatus.totalVoters) * 100).toFixed(2) + '%'
        };
    }
    async getVotingResults(ctx) {
        console.info('============= 투표 결과 조회 시작 =============');
        const votingStatusAsBytes = await ctx.stub.getState('votingActive');
        const votingStatus = JSON.parse(votingStatusAsBytes.toString());
        const queryString = {
            selector: {
                docType: 'candidate'
            }
        };
        const candidatesIterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
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
        console.info('============= 투표 결과 조회 완료 =============');
        return results;
    }
    async getVoterInfo(ctx, voterId) {
        console.info('============= 유권자 정보 조회 시작 =============');
        const voterAsBytes = await ctx.stub.getState(voterId);
        if (!voterAsBytes || voterAsBytes.length === 0) {
            throw new Error(`${voterId} 아이디는 등록되지 않은 유권자입니다.`);
        }
        const voter = JSON.parse(voterAsBytes.toString());
        console.info('============= 유권자 정보 조회 완료 =============');
        return voter;
    }
    async getCandidateInfo(ctx, candidateId) {
        console.info('============= 후보자 정보 조회 시작 =============');
        const candidateAsBytes = await ctx.stub.getState(candidateId);
        if (!candidateAsBytes || candidateAsBytes.length === 0) {
            throw new Error(`${candidateId} 아이디는 등록되지 않은 후보자입니다.`);
        }
        const candidate = JSON.parse(candidateAsBytes.toString());
        console.info('============= 후보자 정보 조회 완료 =============');
        return candidate;
    }
}

console.log('Exporting VotingSystem...');
module.exports = VotingSystem;