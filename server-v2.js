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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// ============ ADMIN API ============

// 호스트 음성 샘플 업로드
app.post('/api/admin/upload-host-voice-sample', (req, res) => {
  const adminKey = req.headers['admin-key'];
  
  if (adminKey !== ADMIN_KEY) {
    return res.status(401).json({ error: '관리자 권한 필요' });
  }
  
  if (!req.files || !req.files.voiceSample) {
    return res.status(400).json({ error: '음성 파일이 없습니다' });
  }
  
  const hostUsername = req.body.hostUsername || '';
  const voiceSample = req.files.voiceSample;
  
  if (!hostUsername) {
    return res.status(400).json({ error: 'hostUsername이 필요합니다' });
  }
  
  // 저장
  hostVoiceSamples[hostUsername] = voiceSample.data;
  
  console.log(`✅ 호스트 음성 샘플 저장: ${hostUsername}`);
  
  res.json({ 
    message: '음성 샘플 업로드됨',
    hostUsername: hostUsername,
    size: voiceSample.size
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
    lastHostVoiceTime: Date.now()
  };
  
  // 10분 강제 종료 타이머 설정
  hostSessionTimers[sessionId] = setTimeout(() => {
    console.log(`⏱️ 세션 ${sessionId}: 10분 강제 종료`);
    const session = tiktokSessions[sessionId];
    if (session) {
      session.isActive = false;
    }
  }, 600000);
  
  console.log(`✅ 세션 등록: ${sessionId}`);
  
  res.json({ 
    sessionId: sessionId,
    registeredIp: clientIp,
    message: 'TikTok 세션 등록됨 (10분 강제 종료 설정)'
  });
});

// 호스트 음성 검증 (가장 중요한 API)
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
    
    // JSON으로 데이터 전송
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
