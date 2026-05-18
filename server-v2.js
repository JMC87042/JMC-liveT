const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();

// 미들웨어
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*'
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin_key_default';

// 메모리 저장소
const hostVoiceSamples = {};
const validApiKeys = {
  'API_KEY_A': { hostName: 'Host A', plan: 'premium' },
  'API_KEY_B': { hostName: 'Host B', plan: 'basic' }
};
const tiktokSessions = {};
const hostSessionTimers = {};

// ============ REAL-TIME SAMPLE RECORDING API ============

// 실시간 샘플 녹음 세션 시작
app.post('/api/start-sample-recording', (req, res) => {
  const { apiKey } = req.body;
  
  if (!validApiKeys[apiKey]) {
    return res.status(401).json({ error: '유효하지 않은 API 키' });
  }
  
  const recordingSessionId = `REC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  if (!global.recordingSessions) {
    global.recordingSessions = {};
  }
  
  global.recordingSessions[recordingSessionId] = {
    apiKey: apiKey,
    audioChunks: [],
    createdAt: Date.now()
  };
  
  console.log(`🎤 샘플 녹음 시작: ${recordingSessionId}`);
  
  res.json({ 
    recordingSessionId: recordingSessionId,
    message: '30초 샘플 녹음 시작'
  });
});

// 샘플 오디오 데이터 수신
app.post('/api/record-sample-chunk', (req, res) => {
  const recordingSessionId = req.headers['x-recording-session-id'];
  const { audioChunk } = req.body;
  
  if (!global.recordingSessions || !global.recordingSessions[recordingSessionId]) {
    return res.status(401).json({ error: '녹음 세션 없음' });
  }
  
  const session = global.recordingSessions[recordingSessionId];
  session.audioChunks.push(audioChunk);
  
  const recordingDuration = Date.now() - session.createdAt;
  
  res.json({ 
    status: 'recording',
    duration: recordingDuration,
    chunks: session.audioChunks.length
  });
});

// 샘플 녹음 완료 및 처리
app.post('/api/finalize-sample-recording', (req, res) => {
  const recordingSessionId = req.headers['x-recording-session-id'];
  const { hostUsername } = req.body;
  
  if (!global.recordingSessions || !global.recordingSessions[recordingSessionId]) {
    return res.status(401).json({ error: '녹음 세션 없음' });
  }
  
  const session = global.recordingSessions[recordingSessionId];
  
  if (session.audioChunks.length === 0) {
    return res.status(400).json({ error: '오디오 데이터 없음' });
  }
  
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

// ============ SESSION API ============

// TikTok 세션 등록
app.post('/api/register-tiktok-session', (req, res) => {
  const { apiKey, clientIp, hostUsername } = req.body;
  
  if (!validApiKeys[apiKey]) {
    return res.status(401).json({ error: '유효하지 않은 API 키' });
  }
  
  const sessionId = `TIKTOK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  tiktokSessions[sessionId] = {
    apiKey: apiKey,
    hostUsername: hostUsername,
    registeredIp: clientIp,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    isActive: true,
    lastCheckIn: Date.now(),
    lastHostVoiceTime: Date.now(),
    sampleRecorded: false
  };
  
  // 10분 강제 종료 타이머 설정
  hostSessionTimers[sessionId] = setTimeout(() => {
    console.log(`⏱️ 세션 ${sessionId}: 10분 강제 종료`);
    const session = tiktokSessions[sessionId];
    if (session) {
      session.isActive = false;
      // 샘플 삭제
      delete hostVoiceSamples[session.hostUsername];
      console.log(`🗑️ 호스트 샘플 삭제됨: ${session.hostUsername}`);
    }
  }, 600000);  // 10분
  
  console.log(`✅ 세션 등록: ${sessionId}`);
  
  res.json({ 
    sessionId: sessionId,
    registeredIp: clientIp,
    message: 'TikTok 세션 등록됨 (10분 강제 종료 설정)'
  });
});

// 호스트 음성 검증
app.post('/api/verify-host-voice', async (req, res) => {
  const hostUsername = req.body.hostUsername;
  const sessionId = req.headers['x-session-id'];
  const audioBlob = req.files?.audio;
  
  if (!sessionId || !tiktokSessions[sessionId]) {
    return res.status(401).json({ error: '세션이 없습니다' });
  }
  
  const session = tiktokSessions[sessionId];
  if (!session.isActive) {
    return res.status(401).json({ error: '세션이 비활성화되었습니다' });
  }
  
  if (!audioBlob) {
    return res.status(400).json({ error: '음성 파일이 없습니다' });
  }
  
  const hostSample = hostVoiceSamples[hostUsername];
  if (!hostSample) {
    return res.status(404).json({ error: '호스트 샘플이 없습니다' });
  }
  
  try {
    // Python으로 음성 비교
    const similarity = await compareVoicesOnServer(
      audioBlob.data,
      hostSample
    );
    
    console.log(`🔊 호스트 ${hostUsername} 유사도: ${similarity.toFixed(2)}`);
    
    const isHostVoice = similarity > 0.75;
    
    if (isHostVoice) {
      // 호스트 음성 감지 → 10분 타이머 리셋
      if (hostSessionTimers[sessionId]) {
        clearTimeout(hostSessionTimers[sessionId]);
      }
      
      hostSessionTimers[sessionId] = setTimeout(() => {
        console.log(`⏱️ 세션 ${sessionId}: 10분 강제 종료`);
        const session = tiktokSessions[sessionId];
        if (session) {
          session.isActive = false;
          // 샘플 삭제
          delete hostVoiceSamples[session.hostUsername];
          console.log(`🗑️ 호스트 샘플 삭제됨: ${session.hostUsername}`);
        }
      }, 600000);
      
      session.lastHostVoiceTime = Date.now();
    }
    
    res.json({ 
      isHostVoice: isHostVoice,
      similarity: parseFloat(similarity.toFixed(2))
    });
    
  } catch (error) {
    console.error('음성 비교 오류:', error);
    res.status(500).json({ error: '음성 비교 실패' });
  }
});

// ============ TRANSLATION API ============

// 번역 API
app.post('/api/translate', (req, res) => {
  const { text, targetLang } = req.body;
  const sessionId = req.headers['x-session-id'];
  
  const session = tiktokSessions[sessionId];
  if (!session || !session.isActive) {
    return res.status(401).json({ error: '세션 비활성' });
  }
  
  // MyMemory API 사용 (무료)
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

// ============ HELPER FUNCTIONS ============

// Python으로 음성 비교
async function compareVoicesOnServer(currentAudio, hostSample) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [path.join(__dirname, 'compare_voices.py')]);
    
    let output = '';
    let errorOutput = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const similarity = parseFloat(output.trim());
          resolve(similarity);
        } catch (e) {
          console.error('파싱 오류:', output);
          resolve(0);
        }
      } else {
        console.error('Python 오류:', errorOutput);
        resolve(0);
      }
    });
    
    const inputData = {
      currentAudio: currentAudio.toString('base64'),
      hostSample: hostSample.toString('base64')
    };
    
    python.stdin.write(JSON.stringify(inputData));
    python.stdin.end();
  });
}

// ============ HEALTH CHECK ============

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'JMC Global Live Translation is running',
    timestamp: new Date().toISOString()
  });
});

// ============ ROOT ROUTE ============

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index-final.html'));
});

// ============ START SERVER ============

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🌍 JMC Global Live Translation`);
  console.log(`📍 서버 실행: http://localhost:${PORT}`);
  console.log(`🔌 포트: ${PORT}`);
  console.log(`${'='.repeat(50)}\n`);
});

module.exports = app;
