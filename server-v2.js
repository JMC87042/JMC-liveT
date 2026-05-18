const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin_key_default';

// ============ MIDDLEWARE ============

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload());

// Static 파일 제공
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// ============ MEMORY STORAGE ============

// 호스트별 음성 데이터 저장소
const hostAudioData = {};

// 시청자별 세션 저장소
const viewerSessions = {};

// ============ DEBUG ROUTE ============

app.get('/debug-files', (req, res) => {
  res.json({
    dirname: __dirname,
    cwd: process.cwd(),
    publicPath,
    publicExists: fs.existsSync(path.join(__dirname, 'public')),
    indexExists: fs.existsSync(path.join(__dirname, 'public', 'index.html')),
    files: fs.existsSync(__dirname) ? fs.readdirSync(__dirname) : []
  });
});

// ============ API ROUTES ============

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'JMC Global Live Translation is running',
    timestamp: new Date().toISOString()
  });
});

// 호스트 음성 데이터 수신
app.post('/api/host/stream', (req, res) => {
  const { hostName, audioData } = req.body;
  
  if (!hostName || !audioData) {
    return res.status(400).json({ error: '호스트명과 음성 데이터 필요' });
  }

  try {
    // 호스트 음성 데이터 임시 저장 (최신 데이터만)
    hostAudioData[hostName] = {
      data: audioData,
      timestamp: Date.now()
    };

    console.log(`🎤 호스트 ${hostName} 음성 데이터 수신 (${audioData.length} bytes)`);

    res.json({ 
      status: 'ok',
      message: '음성 데이터 수신됨',
      hostName: hostName
    });
  } catch (error) {
    console.error('음성 데이터 처리 오류:', error);
    res.status(500).json({ error: '처리 오류' });
  }
});

// 시청자가 호스트 음성 데이터 요청
app.get('/api/viewer/stream/:hostName', (req, res) => {
  const { hostName } = req.params;

  if (!hostName) {
    return res.status(400).json({ error: '호스트명 필요' });
  }

  const audioData = hostAudioData[hostName];

  if (!audioData) {
    return res.json({ 
      status: 'no_data',
      message: '아직 호스트 음성 없음'
    });
  }

  // 최신 음성 데이터 전송
  res.json({
    status: 'ok',
    hostName: hostName,
    audioData: audioData.data,
    timestamp: audioData.timestamp
  });
});

// 번역 API
app.post('/api/translate', (req, res) => {
  const { text, targetLang } = req.body;
  
  if (!text || !targetLang) {
    return res.status(400).json({ error: '텍스트와 대상 언어 필요' });
  }

  const sourceText = encodeURIComponent(text);
  const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${sourceText}&langpair=ko|${targetLang}`;

  fetch(myMemoryUrl)
    .then(response => response.json())
    .then(data => {
      const translation = data.responseData.translatedText;
      res.json({ 
        status: 'ok',
        translation: translation 
      });
    })
    .catch(error => {
      console.error('번역 오류:', error);
      res.status(500).json({ error: '번역 실패' });
    });
});

// ============ CATCH-ALL ROUTE (SPA) ============

app.get('/', (req, res) => {
  const filePath = path.join(publicPath, 'index.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('index.html not found');
  }
});

app.get('*', (req, res) => {
  const filePath = path.join(publicPath, 'index.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('index.html not found');
  }
});

// ============ START SERVER ============

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🌍 JMC Global Live Translation`);
  console.log(`📍 포트: ${PORT}`);
  console.log(`📁 공개 폴더: ${publicPath}`);
  console.log(`${'='.repeat(50)}\n`);
});

module.exports = app;
