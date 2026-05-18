#!/usr/bin/env python3
import json
import sys
import numpy as np
import librosa
import base64
from scipy.spatial.distance import cosine
from scipy import signal

def remove_noise(audio_data, sr=22050):
    """배경음 제거 (Spectral Subtraction)"""
    try:
        # Spectral Subtraction으로 노이즈 감소
        D = librosa.stft(audio_data)
        magnitude = np.abs(D)
        phase = np.angle(D)
        
        # 노이즈 프로필 추정 (처음 0.5초)
        noise_duration = int(0.5 * sr)
        noise_profile = np.mean(magnitude[:, :noise_duration], axis=1, keepdims=True)
        
        # 노이즈 빼기
        noise_reduced = magnitude - 2 * noise_profile
        noise_reduced = np.maximum(noise_reduced, 0.1 * magnitude)
        
        # ISTFT로 복원
        D_reduced = noise_reduced * np.exp(1j * phase)
        audio_denoised = librosa.istft(D_reduced)
        
        return audio_denoised
    except Exception as e:
        print(f"노이즈 제거 오류: {e}", file=sys.stderr)
        return audio_data

def detect_voice_activity(audio_data, sr=22050, threshold=0.02):
    """음성 감지 (Voice Activity Detection)"""
    try:
        # RMS 에너지 계산
        S = librosa.feature.melspectrogram(y=audio_data, sr=sr)
        energy = np.mean(S, axis=0)
        
        # 정규화
        energy = (energy - np.min(energy)) / (np.max(energy) - np.min(energy) + 1e-8)
        
        # 임계값으로 음성 부분 검출
        voice_frames = energy > threshold
        
        # 연속된 음성 프레임만 유지 (노이즈 제거)
        voice_frames = signal.medfilt(voice_frames.astype(float), kernel_size=5) > 0.5
        
        return voice_frames, energy
    except Exception as e:
        print(f"음성 감지 오류: {e}", file=sys.stderr)
        return None, None

def extract_voice_segments(audio_data, sr=22050):
    """음성 세그먼트만 추출"""
    try:
        voice_frames, _ = detect_voice_activity(audio_data, sr)
        
        if voice_frames is None:
            return audio_data
        
        # 프레임을 샘플로 변환
        hop_length = 512
        voice_samples = np.zeros_like(audio_data)
        
        for i, is_voice in enumerate(voice_frames):
            start = i * hop_length
            end = min((i + 1) * hop_length, len(audio_data))
            if is_voice:
                voice_samples[start:end] = audio_data[start:end]
        
        return voice_samples
    except Exception as e:
        print(f"음성 세그먼트 추출 오류: {e}", file=sys.stderr)
        return audio_data

def extract_features(audio_data, sr=22050):
    """음성 특징 추출"""
    try:
        # 배경음 제거
        audio_data = remove_noise(audio_data, sr)
        
        # 음성 세그먼트만 추출
        audio_data = extract_voice_segments(audio_data, sr)
        
        # MFCC 추출
        mfccs = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfccs, axis=1)
        
        # 에너지
        energy = np.mean(librosa.feature.melspectrogram(y=audio_data, sr=sr))
        
        # 스펙트럼 중심주파수
        spec_centroid = librosa.feature.spectral_centroid(y=audio_data, sr=sr)[0]
        spec_centroid_mean = np.mean(spec_centroid)
        
        return np.concatenate([mfcc_mean, [energy, spec_centroid_mean]])
    except Exception as e:
        print(f"특징 추출 오류: {e}", file=sys.stderr)
        return np.zeros(15)

def compare_voices(current_audio, host_sample, sr=22050):
    """두 음성의 유사도 계산"""
    try:
        # Base64 디코드
        current_data = base64.b64decode(current_audio)
        host_data = base64.b64decode(host_sample)
        
        # 바이트를 numpy 배열로 변환
        current_audio_array = np.frombuffer(current_data, dtype=np.int16).astype(float) / 32768.0
        host_audio_array = np.frombuffer(host_data, dtype=np.int16).astype(float) / 32768.0
        
        # 특징 추출
        current_features = extract_features(current_audio_array, sr)
        host_features = extract_features(host_audio_array, sr)
        
        # 정규화
        current_features = current_features / (np.linalg.norm(current_features) + 1e-8)
        host_features = host_features / (np.linalg.norm(host_features) + 1e-8)
        
        # 코사인 유사도 계산 (0~1)
        similarity = 1 - cosine(current_features, host_features)
        similarity = max(0.0, min(1.0, similarity))
        
        return similarity
        
    except Exception as e:
        print(f"오류: {e}", file=sys.stderr)
        return 0.0

if __name__ == '__main__':
    try:
        input_str = sys.stdin.read()
        input_data = json.loads(input_str)
        
        current_audio = input_data['currentAudio']
        host_sample = input_data['hostSample']
        
        similarity = compare_voices(current_audio, host_sample)
        
        print(similarity)
        sys.stdout.flush()
        
    except Exception as e:
        print(f"메인 오류: {e}", file=sys.stderr)
        print("0.0")
        sys.exit(1)
