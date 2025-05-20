const express = require('express');
const path = require('path');
const sdk = require('./sdk');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*' })); // 모든 오리진 허용 (프로덕션에서는 제한 권장)

// 상태 변경 트랜잭션 처리
app.post('/invoke', async (req, res) => {
    const { function: fcn, args } = req.body;
    if (!fcn || !args || !Array.isArray(args)) {
        return res.status(400).json({ error: '함수 이름과 인자가 필요합니다.' });
    }

    console.log(`invoke 호출: ${fcn} with args: ${args}`);
    await sdk.send(false, fcn, args, res); // 콜백 대신 res 전달
});

// 조회 트랜잭션 처리
app.post('/query', async (req, res) => {
    const { function: fcn, args } = req.body;
    if (!fcn || !args || !Array.isArray(args)) {
        return res.status(400).json({ error: '함수 이름과 인자가 필요합니다.' });
    }

    console.log(`query 호출: ${fcn} with args: ${args}`);
    await sdk.send(true, fcn, args, res); // 콜백 대신 res 전달
});

// 정적 파일 제공 (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
const PORT = 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`서버가 http://${HOST}:${PORT}에서 실행 중입니다.`);
});