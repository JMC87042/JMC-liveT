#!/usr/bin/env python3
import json
import sys
import numpy as np
import librosa
import base64
from scipy.spatial.distance import cosine

def extract_features(audio_data):
    """음성 특징 추출"""
    try:
        # MFCC 추출
        mfccs = librosa.feature.mfcc(y=audio_data, sr=22050, n_mfcc=13)
        mfcc_mean = np.mean(mfccs, axis=1)
        
        # 에너지
        energy = np.mean(librosa.feature.melspectrogram(y=audio_data, sr=22050))
        
        return np.concatenate([mfcc_mean, [energy]])
    except Exception as e:
        print(f"특징 추출 오류: {e}", file=sys.stderr)
        return np.zeros(14)

def compare_voices(current_audio, host_sample):
    """두 음성의 유사도 계산"""
    try:
        # Base64 디코드
        current_data = base64.b64decode(current_audio)
        host_data = base64.b64decode(host_sample)
        
        # 바이트를 numpy 배열로 변환
        current_audio_array = np.frombuffer(current_data, dtype=np.int16).astype(float) / 32768.0
        host_audio_array = np.frombuffer(host_data, dtype=np.int16).astype(float) / 32768.0
        
        # 특징 추출
        current_features = extract_features(current_audio_array)
        host_features = extract_features(host_audio_array)
        
        # 정규화
        current_features = current_features / (np.linalg.norm(current_features) + 1e-8)
        host_features = host_features / (np.linalg.norm(host_features) + 1e-8)
        
        # 코사인 유사도 계산 (0~1)
        similarity = 1 - cosine(current_features, host_features)
        similarity = max(0.0, min(1.0, similarity))  # 0~1 범위로 제한
        
        return similarity
        
    except Exception as e:
        print(f"오류: {e}", file=sys.stderr)
        return 0.0

if __name__ == '__main__':
    try:
        # stdin에서 JSON 읽기
        input_str = sys.stdin.read()
        input_data = json.loads(input_str)
        
        current_audio = input_data['currentAudio']
        host_sample = input_data['hostSample']
        
        # 유사도 계산
        similarity = compare_voices(current_audio, host_sample)
        
        # 결과 출력
        print(similarity)
        sys.stdout.flush()
        
    except Exception as e:
        print(f"메인 오류: {e}", file=sys.stderr)
        print("0.0")
        sys.exit(1)
