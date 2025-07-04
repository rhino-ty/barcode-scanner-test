import { useState, useEffect, useRef } from 'react';
import type { Route } from './+types/home';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'CODE39 바코드 스캐너' },
    { name: 'description', content: 'React Router v7 + Quagga2 바코드 스캐너' },
  ];
}

// Quagga2 동적 임포트
let Quagga: any = null;

interface CameraDevice {
  deviceId: string;
  label: string;
  kind: string;
}

export default function Home() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>(''); // 초기 선택 없음
  const scannerRef = useRef<HTMLDivElement>(null);

  // Quagga2 로드
  useEffect(() => {
    const loadQuagga = async () => {
      if (typeof window === 'undefined') return;

      try {
        const QuaggaModule = await import('@ericblade/quagga2');
        Quagga = QuaggaModule.default;
        await loadCameras();
        setIsLoading(false);
      } catch (err) {
        console.error('Quagga2 로드 실패:', err);
        setError('바코드 라이브러리를 로드할 수 없습니다.');
        setIsLoading(false);
      }
    };

    loadQuagga();
  }, []);

  // 사용 가능한 카메라 목록 로드
  const loadCameras = async () => {
    try {
      // 카메라 권한 요청 및 스트림 즉시 중지 (목록만 가져오기 위함)
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());

      // 사용 가능한 기기 목록 가져오기
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `카메라 ${index + 1}`,
          kind: device.kind,
        }));

      setCameras(videoDevices);

      // 후면 카메라가 있으면 기본 선택
      const backCamera = videoDevices.find(
        (camera) =>
          camera.label.toLowerCase().includes('back') ||
          camera.label.toLowerCase().includes('rear') ||
          camera.label.toLowerCase().includes('environment'),
      );

      if (backCamera) {
        setSelectedCamera(backCamera.deviceId);
      } else if (videoDevices.length > 0) {
        // 후면 카메라가 없으면 첫 번째 카메라를 기본값으로
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('카메라 목록 로드 실패:', err);
      setError('카메라 접근 권한이 필요합니다.');
    }
  };

  // 스캔 시작
  const startScanning = async () => {
    if (!Quagga || !scannerRef.current || !selectedCamera) return;

    setError('');

    try {
      // 카메라 제약 조건 설정 (deviceId만 사용)
      const constraints: any = {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        frameRate: { ideal: 30, min: 15 },
        deviceId: { exact: selectedCamera },
        focusMode: 'continuous',
        exposureMode: 'continuous',
        whiteBalanceMode: 'continuous',
      };

      const config = {
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: scannerRef.current,
          constraints,
        },
        locator: {
          halfSample: false,
          patchSize: 'medium',
          debug: {
            showCanvas: false,
            showPatches: false,
            showFoundPatches: false,
            showSkeleton: false,
            showLabels: false,
            showPatchLabels: false,
            showGrids: false,
            showRemainingPatchLabels: false,
          },
        },
        decoder: {
          readers: ['code_39_reader'],
          debug: {
            drawBoundingBox: false,
            showFrequency: false,
            drawScanline: false,
            showPattern: false,
          },
          multiple: false,
        },
        locate: true,
        frequency: 10,
      };

      Quagga.init(config, (err: any) => {
        if (err) {
          console.error('초기화 실패:', err);
          setError('선택한 카메라를 시작할 수 없습니다.');
          return;
        }

        Quagga.start();
        setIsScanning(true);
      });

      // 바코드 감지
      Quagga.onDetected((result: any) => {
        const code = result.codeResult.code;
        console.log('바코드 감지:', code);
        setScannedCode(code);

        // 진동 피드백
        if (navigator.vibrate) {
          navigator.vibrate(200);
        }

        // 스캔 중지 후 수동 재시작
        stopScanning();
      });
    } catch (err) {
      console.error('스캔 시작 실패:', err);
      setError('스캔을 시작할 수 없습니다: ' + err);
    }
  };

  // 스캔 중지
  const stopScanning = () => {
    if (!Quagga) return;

    try {
      Quagga.stop();
      Quagga.offDetected();
      Quagga.offProcessed();
      setIsScanning(false);
    } catch (err) {
      console.error('스캔 중지 실패:', err);
    }
  };

  // 카메라 변경 시 재시작
  const handleCameraChange = async (newCameraId: string) => {
    setSelectedCamera(newCameraId);

    if (isScanning) {
      stopScanning();
      // 잠깐 기다린 후 새 카메라로 재시작
      setTimeout(() => {
        startScanning();
      }, 500);
    }
  };

  // 정리
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  // 로딩 중
  if (isLoading) {
    return (
      <div className='p-8 text-center'>
        <h1 className='text-2xl font-bold mb-4'>📱 바코드 스캐너</h1>
        <p>카메라를 준비하는 중...</p>
      </div>
    );
  }

  return (
    <div className='p-4 max-w-md mx-auto'>
      <h1 className='text-2xl font-bold text-center mb-6'>📱 CODE39 스캐너</h1>

      {/* 카메라 선택 */}
      {cameras.length >= 1 && ( //  선택 UI 표시
        <div className='mb-4'>
          <label className='block text-sm font-medium text-gray-700 mb-2'>📷 카메라 선택</label>
          <select
            value={selectedCamera}
            onChange={(e) => handleCameraChange(e.target.value)}
            disabled={isScanning}
            className='w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100'
          >
            {/* 실제 감지된 카메라 목록만 표시 */}
            {cameras.map((camera) => (
              <option key={camera.deviceId} value={camera.deviceId}>
                📹 {camera.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 카메라 영역 */}
      <div className='mb-4'>
        <div ref={scannerRef} className='w-full h-64 bg-black rounded-lg relative overflow-hidden'>
          {!isScanning && (
            <div className='absolute inset-0 flex items-center justify-center text-white'>
              <div className='text-center'>
                <div className='text-4xl mb-2'>📷</div>
                <p className='text-sm'>카메라 준비 완료</p>
                {selectedCamera && ( // 선택된 카메라가 있을 때만 표시
                  <p className='text-xs mt-1 opacity-75'>
                    {/* 현재 선택된 카메라 이름 표시 */}
                    {cameras.find((c) => c.deviceId === selectedCamera)?.label}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && <div className='mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded'>{error}</div>}

      {/* 버튼 */}
      <div className='mb-4'>
        {!isScanning ? (
          <button
            onClick={startScanning}
            disabled={!Quagga || !selectedCamera}
            className='w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400'
          >
            📸 스캔 시작
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className='w-full bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700'
          >
            ⏹️ 스캔 중지
          </button>
        )}
      </div>

      {/* 스캔 결과 */}
      {scannedCode && (
        <div className='p-4 bg-green-100 border border-green-400 rounded-lg'>
          <h3 className='font-semibold text-green-800 mb-2'>✅ 스캔 성공!</h3>
          <p className='font-mono text-lg font-bold text-green-900 break-all'>{scannedCode}</p>
          <div className='mt-2 flex gap-2'>
            <button
              onClick={() => navigator.clipboard?.writeText(scannedCode)}
              className='bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700'
            >
              📋 복사
            </button>
            <button
              onClick={() => setScannedCode('')}
              className='bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600'
            >
              🗑️ 지우기
            </button>
          </div>
        </div>
      )}

      {/* 도움말 */}
      <div className='mt-6 p-3 bg-blue-50 rounded-lg'>
        <h4 className='font-semibold text-blue-800 mb-1'>💡 사용법</h4>
        <ul className='text-blue-700 text-sm space-y-1'>
          <li>• CODE39 바코드를 빨간 테두리에 맞춰주세요</li>
          <li>
            • 바코드 스캔에는 <strong>후면 카메라</strong>가 더 좋습니다
          </li>
          <li>• 충분한 조명 환경에서 사용하세요</li>
          <li>• HTTPS 환경에서만 카메라가 작동합니다</li>
        </ul>
      </div>

      {/* 카메라 정보 */}
      {cameras.length > 0 && (
        <div className='mt-4 p-2 bg-gray-50 rounded text-xs text-gray-600'>💡 감지된 카메라: {cameras.length}개</div>
      )}
    </div>
  );
}
