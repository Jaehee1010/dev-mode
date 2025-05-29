const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');
const sdk = require('./sdk');
const PORT = 8001;
const HOST = 'localhost';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 간단한 관리자 인증 (실제 환경에서는 더 강력한 인증 시스템 필요)
const ADMIN_PASSWORD = 'admin123'; // 실제 환경에서는 더 보안적으로 강화된 방법사용

// 관리자 인증 미들웨어
function authenticateAdmin(req, res, next) {
    const adminKey = req.headers['admin-key'] || req.query.adminKey;
    if (adminKey !== ADMIN_PASSWORD) {
        return res.status(401).json({ 
            error: '관리자 권한이 필요합니다.',
            message: 'Admin authentication required' 
        });
    }
    next();
}

// ============ 관리자 전용 API ============

// Initialize the voting system (Admin only)
app.get('/admin/init', authenticateAdmin, function (req, res) {
    let args = [];
    sdk.send(false, 'initializeVotingSystem', args, res);
});

// Register a candidate (Admin only)
app.get('/admin/registerCandidate', authenticateAdmin, function (req, res) {
    let candidateId = req.query.candidateId;
    let name = req.query.name;
    let partyName = req.query.partyName;
    
    if (!candidateId || !name || !partyName) {
        return res.status(400).json({ error: 'candidateId, name, partyName는 필수입니다.' });
    }
    
    let args = [candidateId, partyName, name];
    sdk.send(false, 'registerCandidate', args, res);
});

// End the voting process (Admin only)
app.get('/admin/endVoting', authenticateAdmin, function (req, res) {
    let args = [];
    sdk.send(false, 'endVoting', args, res);
});

// Get voting results (Admin only)
app.get('/admin/getVotingResults', authenticateAdmin, function (req, res) {
    let args = [];
    sdk.send(true, 'getVotingResults', args, res);
});

// Get all candidates (Admin only)
app.get('/admin/getAllCandidates', authenticateAdmin, function (req, res) {
    let args = [];
    sdk.send(true, 'getAllCandidates', args, res);
});

// Get candidate information (Admin only)
app.get('/admin/getCandidateInfo', authenticateAdmin, function (req, res) {
    let candidateId = req.query.candidateId;
    if (!candidateId) {
        return res.status(400).json({ error: 'candidateId는 필수입니다.' });
    }
    let args = [candidateId];
    sdk.send(true, 'getCandidateInfo', args, res);
});

// ============ 투표자 전용 API ============

// Register a voter
app.get('/voter/registerVoter', function (req, res) {
    let name = req.query.name;
    let rrnSuffix = req.query.rrnSuffix;
    
    if (!name || !rrnSuffix) {
        return res.status(400).json({ error: 'name과 rrnSuffix는 필수입니다.' });
    }
    
    const args = [name, rrnSuffix];
    sdk.send(false, 'registerVoter', args, res);
});

// Cast a vote
app.get('/voter/vote', function (req, res) {
    const voterName = req.query.voterName;
    const rrnSuffix = req.query.rrnSuffix;
    const candidateName = req.query.candidateName;
    
    if (!voterName || !rrnSuffix || !candidateName) {
        return res.status(400).json({ error: 'voterName, rrnSuffix, candidateName는 필수입니다.' });
    }
    
    const args = [voterName, rrnSuffix, candidateName];
    sdk.send(false, 'vote', args, res);
});

// Get voter information
app.get('/voter/getVoterInfo', function (req, res) {
    const voterName = req.query.voterName;
    const rrnSuffix = req.query.rrnSuffix;
    
    if (!voterName || !rrnSuffix) {
        return res.status(400).json({ error: 'voterName과 rrnSuffix는 필수입니다.' });
    }
    
    const args = [voterName, rrnSuffix];
    sdk.send(true, 'getVoterInfo', args, res);
});

// Get available candidates for voting (투표자가 볼 수 있는 후보자 목록)
app.get('/voter/getCandidates', function (req, res) {
    let args = [];
    sdk.send(true, 'getAllCandidates', args, res);
});

// ============ 공통 API ============

// Check voting status (공개 정보)
app.get('/public/votingStatus', function (req, res) {
    let args = [];
    // 전체 투표 결과를 가져와서 클라이언트에서 필요한 정보만 사용하도록 함
    sdk.send(true, 'getVotingResults', args, res);
});

// ============ 정적 파일 서빙 ============

// 관리자 페이지
app.get('/admin', function (req, res) {
    res.sendFile(path.join(__dirname, '../client/admin.html'));
});

// 투표자 페이지
app.get('/voter', function (req, res) {
    res.sendFile(path.join(__dirname, '../client/voter.html'));
});

// 기본 페이지 (선택 화면)
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// 정적 파일들
app.use(express.static(path.join(__dirname, '../client')));

// ============ 에러 핸들링 ============

// 404 에러 처리
app.use(function(req, res, next) {
    res.status(404).json({ error: 'API 엔드포인트를 찾을 수 없습니다.' });
});

// 일반 에러 처리
app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
console.log(`관리자 페이지: http://${HOST}:${PORT}/admin`);
console.log(`투표자 페이지: http://${HOST}:${PORT}/voter`);
console.log(`관리자 비밀번호: ${ADMIN_PASSWORD}`);