# 🌍 JMC Global Live Translation

Real-time TikTok live translation with **host voice verification** system.

## ✨ Features

✅ **Real-time Voice Translation** - 14 languages support  
✅ **Host Voice Verification** - Only host's voice triggers translation  
✅ **5-Minute Auto-Off** - Silence detection  
✅ **10-Minute Force Close** - Automatic session termination  
✅ **TTS Control** - On/Off toggle with volume & speed  
✅ **IP-Based Authentication** - Same network verification  
✅ **Responsive UI** - Mobile, tablet, desktop optimized  

## 🎯 How It Works

1. **Host Setup**: Host uploads 5-10 second voice sample
2. **Viewer Access**: Viewer clicks host's link with API key
3. **Voice Detection**: App verifies viewer is in same network (IP check)
4. **Real-time Recognition**: Voice recognized and compared with host sample
5. **Translation**: Only host's voice triggers translation (75%+ similarity)
6. **Auto-Off**: 5 minutes silence → app disabled
7. **Force Close**: 10 minutes without host voice → session terminated

## 🚀 Deployment

This app is deployed on **Railway** with automatic GitHub integration.

**Live URL**: `https://jmc-global-live-translation-production.up.railway.app`

### Host Link Format
```
https://jmc-global-live-translation-production.up.railway.app?host=@host_a
```

## 🔧 Setup (Local Development)

```bash
# Install Node dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Create .env file
echo "ADMIN_KEY=your_admin_key_here" > .env
echo "NODE_ENV=development" >> .env

# Start server
npm start
```

Server runs on `http://localhost:3000`

## 📝 API Endpoints

### Admin
- `POST /api/admin/upload-host-voice-sample` - Upload host voice sample (requires Admin-Key)

### Session
- `POST /api/register-tiktok-session` - Register new session
- `POST /api/verify-host-voice` - Verify host voice and trigger 10-min timer reset

### Translation
- `POST /api/translate` - Translate text (requires valid session)

### Health
- `GET /api/health` - Health check

## 🎤 Voice Sample Upload

```bash
curl -X POST https://jmc-global-live-translation-production.up.railway.app/api/admin/upload-host-voice-sample \
  -H "Admin-Key: your_admin_key" \
  -F "hostUsername=@host_a" \
  -F "voiceSample=@host_voice_sample.wav"
```

## 📱 Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Web Speech API)
- **Backend**: Node.js, Express.js
- **Voice Processing**: Python, librosa, scipy
- **Translation**: MyMemory API (free, 14 languages)
- **Hosting**: Railway.app
- **CI/CD**: GitHub Actions (auto-deploy on push)

## 📊 Supported Languages

- 🇺🇸 English
- 🇯🇵 日本語
- 🇨🇳 中文
- 🇪🇸 Español
- 🇫🇷 Français
- 🇩🇪 Deutsch
- 🇵🇹 Português
- 🇷🇺 Русский
- 🇮🇹 Italiano
- 🇹🇷 Türkçe
- 🇹🇭 ไทย
- 🇮🇩 Bahasa Indonesia
- 🇵🇭 Filipino
- 🇲🇾 Bahasa Melayu

## 🔐 Security

- **IP-Based Auth**: Viewer must be on same network as host
- **Voice Verification**: Only host's voice (75%+ similarity) triggers translation
- **Session Timeout**: Auto-close after 10 minutes without host voice
- **Admin Key**: Secure voice sample uploads
- **CORS**: Protected API endpoints

## 📞 Contact

- 🎵 **TikTok**: [@jemcymusic](https://www.tiktok.com/@jemcymusic)
- 💬 **Kakao**: [JMC Open Chat](https://open.kakao.com/o/sVLHFnui)

## 📄 License

MIT License - feel free to use and modify

---

**Made with ❤️ for TikTok Live Streaming**
