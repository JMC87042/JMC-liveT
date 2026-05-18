# JMC Global Live Translation - 배포 문제 리포트

## 🔴 현재 문제
```
GET https://jmc-livet-production.up.railway.app/?host=@jiyeon
→ 404 Not Found
```

---

## 📊 시스템 구조

### 프로젝트 정보
- **프로젝트명**: JMC Global Live Translation
- **GitHub**: https://github.com/JMC87042/JMC-liveT
- **배포 플랫폼**: Railway
- **배포 URL**: https://jmc-livet-production.up.railway.app
- **런타임**: Node.js 18.x
- **PORT**: process.env.PORT (기본값: 3000)

### 파일 구조
```
/tmp/jmc-global-live-translation/
├── server-v2.js (메인 서버)
├── public/
│   ├── index.html (새로 추가)
│   └── index-final.html (원본)
├── package.json (Express, cors, dotenv, express-fileupload)
├── Procfile (web: node server-v2.js)
├── runtime.txt (node-18.17.1)
├── .gitignore
└── README.md
```

---

## 📋 최근 배포 커밋 히스토리

```
89100ec - Fix: Use index.html instead of index-final.html
027d476 - Add index.html for root path serving
c9746ce - Force redeploy
984bf9b - Fix: Reorder routes - API routes before catch-all route
2f7d4e0 - Fix: Improve static file serving with absolute path and catch-all route
149fe14 - Fix: Simplify static file serving configuration
79c7c5e - Fix: Remove Python dependency, implement voice similarity in Node.js
37b1455 - Fix: Add runtime.txt to specify Node.js version for Railway
e19e6da - Feat: Auto-detect host from URL parameter, display host info in control panel
3345f91 - Feat: Add device-specific notices displayed automatically in translation window
```

---

## 🔍 Railway 로그 (확인됨)

### 마지막 배포 로그
```
May 18 2026 28:33:36 - 🌍 JMC Global Live Translation
May 18 2026 28:33:36 - 서버 실행: http://localhost:8000
May 18 2026 28:33:36 - 포트: 8000
May 18 2026 28:33:36 - 공개 폴더: /app/public
May 18 2026 28:33:36 - Starting Container
```

✅ **서버는 정상 실행 중**

---

## 📝 현재 server-v2.js 구조

```javascript
// 라우트 순서:
1. app.use(express.static(...)) - 정적 파일 제공
2. app.get('/api/health', ...) - API 라우트
3. app.post('/api/start-sample-recording', ...) - API 라우트
4. app.post('/api/record-sample-chunk', ...) - API 라우트
5. app.post('/api/finalize-sample-recording', ...) - API 라우트
6. app.post('/api/translate', ...) - API 라우트
7. app.get('/', (req, res) => res.sendFile(...)) - Root 라우트
8. app.get('/*', (req, res) => res.sendFile(...)) - Catch-all 라우트
9. app.listen(PORT, ...)
```

---

## ✅ git 상태

```
public/index.html - ✅ Git에 추가됨
public/index-final.html - ✅ Git에 추가됨
server-v2.js - ✅ 최신 버전 커밋됨
package.json - ✅ 올바름 (Express 포함)
Procfile - ✅ 올바름 (web: node server-v2.js)
runtime.txt - ✅ 올바름 (node-18.17.1)
```

---

## 🧪 테스트 결과

### 서버 상태
- ✅ Railway에서 서버 실행 중
- ✅ 로그에 "Starting Container" 메시지 보임
- ✅ PORT 설정 올바름
- ✅ 정적 파일 경로 설정 올바름

### 문제 현상
- ❌ `GET /?host=@jiyeon` → 404 Not Found
- ❌ 서버가 index.html을 제공하지 않음
- ❌ express.static이 public 폴더를 찾지 못함

---

## 🔧 시도한 해결책들

1. ✅ Python 의존성 제거 (requirements.txt, compare_voices.py 삭제)
2. ✅ runtime.txt 추가 (node-18.17.1 지정)
3. ✅ express.static 설정 변경
4. ✅ 라우트 순서 재정렬 (API 라우트 → catch-all)
5. ✅ index-final.html → index.html 복사 및 변경

---

## 📦 package.json 의존성

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express-fileupload": "^1.4.0"
  }
}
```

---

## 🎯 가능한 원인들

1. **Railway 빌드 캐시 문제**
   - 이전 빌드가 남아있음
   - public 폴더가 배포되지 않음

2. **경로 문제**
   - Railway 환경에서 실제 경로가 다를 수 있음
   - `/app/public`이 실제로는 다른 경로일 수 있음

3. **express.static 미작동**
   - Middleware 순서 문제
   - 경로 절대값 문제

4. **파일 권한 문제**
   - public/index.html 읽기 권한 없음

---

## 📞 문의 정보

- **Railway 토큰**: 8e475e9b-8018-49ea-9bf2-e0e6a2281aae (제공됨)
- **GitHub**: JMC87042/JMC-liveT
- **최근 배포 시간**: May 18, 2026 20:36-20:37
- **배포 상태**: ✅ Success (로그상)

---

## 🔗 관련 URL

- Railway Dashboard: https://railway.app/dashboard
- App URL: https://jmc-livet-production.up.railway.app/
- GitHub: https://github.com/JMC87042/JMC-liveT

