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
app.use(express.static(path.join(__dirname, 'public')));

// ============ MEMORY STORAGE ============

const hostVoiceSamples = {};
const validApiKeys = {
  'API_KEY_A': { hostName: 'Host A', plan: 'premium' },
  'API_KEY_B': { hostName: 'Host B', plan: 'basic' }
};
const tiktokSessions = {};
const hostSessionTimers = {};

// ============ API ROUTES ============

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'JMC Global Live Translation is running',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/start-sample-recording', (req, res) => {
  const recordingSessionId = `REC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  if (!global.recordingSessions) {
    global.recordingSessions = {};
  }
  
  global.recordingSessions[recordingSessionId] = {
    audioChunks: [],
    createdAt: Date.now()
  };
  
  console.log(`🎤 샘플 녹음 시작: ${recordingSessionId}`);
  res.json({ 
    recordingSessionId: recordingSessionId,
    message: '30초 샘플 녹음 시작'
  });
});

app.post('/api/record-sample-chunk', (req, res) => {
  const recordingSessionId = req.headers['x-recording-session-id'];
  const { audioChunk } = req.body;
  
  if (!global.recordingSessions || !global.recordingSessions[recordingSessionId]) {
    return res.status(401).json({ error: '녹음 세션 없음' });
  }
  
  global.recordingSessions[recordingSessionId].audioChunks.push(audioChunk);
  res.json({ 
    status: 'recording',
    duration: Date.now() - global.recordingSessions[recordingSessionId].createdAt
  });
});

app.post('/api/finalize-sample-recording', (req, res) => {
  const recordingSessionId = req.headers['x-recording-session-id'];
  const { hostUsername } = req.body;
  
  if (!global.recordingSessions || !global.recordingSessions[recordingSessionId]) {
    return res.status(401).json({ error: '녹음 세션 없음' });
  }
  
  const session = global.recordingSessions[recordingSessionId];
  const combinedAudio = Buffer.concat(
    session.audioChunks.map(chunk => {
      if (typeof chunk === 'string') {
        return Buffer.from(chunk, 'base64');
      }
      return chunk;
    })
  );
  
  hostVoiceSamples[hostUsername] = combinedAudio;
  delete global.recordingSessions[recordingSessionId];
  
  console.log(`✅ 호스트 샘플 저장됨: ${hostUsername}`);
  res.json({ 
    message: '샘플 녹음 완료 및 저장됨',
    hostUsername: hostUsername
  });
});

app.post('/api/translate', (req, res) => {
  const { text, targetLang } = req.body;
  const sourceText = encodeURIComponent(text);
  const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${sourceText}&langpair=ko|${targetLang}`;
  
  fetch(myMemoryUrl)
    .then(response => response.json())
    .then(data => {
      const translation = data.responseData.translatedText;
      res.json({ translation });
    })
    .catch(error => {
      console.error('번역 오류:', error);
      res.status(500).json({ error: '번역 실패' });
    });
});

// ============ STATIC FILE & CATCH-ALL ============

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ START SERVER ============

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🌍 JMC Global Live Translation`);
  console.log(`📍 포트: ${PORT}`);
  console.log(`📁 공개 폴더: ${path.join(__dirname, 'public')}`);
  console.log(`${'='.repeat(50)}\n`);
});

module.exports = app;
