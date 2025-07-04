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

// UX 상태 정의
type ScannerState = 'idle' | 'starting' | 'scanning' | 'success' | 'error';

export default function Home() {
  const [scannerState, setScannerState] = useState<ScannerState>('idle');
  const [scannedCode, setScannedCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [scanCount, setScanCount] = useState(0);
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
        setScannerState('error');
        setIsLoading(false);
      }
    };

    loadQuagga();
  }, []);

  // 사용 가능한 카메라 목록 로드
  const loadCameras = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop()); // 즉시 종료

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `카메라 ${index + 1}`,
          kind: device.kind,
        }));

      setCameras(videoDevices);

      // 후면 카메라 우선 선택
      const backCamera = videoDevices.find(
        (camera) =>
          camera.label.toLowerCase().includes('back') ||
          camera.label.toLowerCase().includes('rear') ||
          camera.label.toLowerCase().includes('environment'),
      );

      if (backCamera) {
        setSelectedCamera(backCamera.deviceId);
      } else if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('카메라 목록 로드 실패:', err);
      setError('카메라 접근 권한이 필요합니다.');
      setScannerState('error');
    }
  };

  // 스캔 시작
  const startScanning = async () => {
    if (!Quagga || !scannerRef.current || !selectedCamera) return;

    setScannerState('starting');
    setError('');
    setScannedCode('');
    setScanCount(0);

    try {
      const constraints: any = {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 15, max: 30 },
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
          area: {
            top: '25%',
            right: '75%',
            left: '25%',
            bottom: '75%',
          },
        },
        locator: {
          halfSample: true, // 성능 향상
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
        frequency: 8, // 적절한 빈도
      };

      Quagga.init(config, (err: any) => {
        if (err) {
          console.error('초기화 실패:', err);
          setError('카메라를 시작할 수 없습니다: ' + err.message);
          setScannerState('error');
          return;
        }

        Quagga.start();
        setScannerState('scanning');
      });

      // 바코드 감지 (개선된 로직)
      Quagga.onDetected((result: any) => {
        const code = result.codeResult.code;
        const confidence = result.codeResult.confidence || 0;

        console.log(`바코드 감지: ${code}, 신뢰도: ${confidence}`);

        // 신뢰도 체크
        if (confidence < 70) {
          console.log('신뢰도가 낮아 무시됨');
          return;
        }

        setScannedCode(code);
        setScannerState('success');

        // 진동 피드백
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }

        // 스캔 완전 중지 (자동 재시작 없음)
        stopScanning();
      });

      // 처리 상태 모니터링
      Quagga.onProcessed(() => {
        setScanCount((prev) => prev + 1);
      });
    } catch (err) {
      console.error('스캔 시작 실패:', err);
      setError('스캔을 시작할 수 없습니다: ' + err.message);
      setScannerState('error');
    }
  };

  // 스캔 중지
  const stopScanning = () => {
    if (!Quagga) return;

    try {
      Quagga.stop();
      Quagga.offDetected();
      Quagga.offProcessed();

      // scanning 상태에서만 idle로 변경 (success나 error 상태 유지)
      if (scannerState === 'scanning' || scannerState === 'starting') {
        setScannerState('idle');
      }
      setScanCount(0);
    } catch (err) {
      console.error('스캔 중지 실패:', err);
    }
  };

  // 새로운 스캔 시작 (결과 초기화)
  const startNewScan = () => {
    setScannedCode('');
    setScannerState('idle');
    // 잠깐 기다린 후 시작 (UI 업데이트 시간)
    setTimeout(() => {
      startScanning();
    }, 100);
  };

  // 카메라 변경
  const handleCameraChange = async (newCameraId: string) => {
    setSelectedCamera(newCameraId);

    if (scannerState === 'scanning') {
      stopScanning();
      setTimeout(() => {
        startScanning();
      }, 500);
    }
  };

  // 컴포넌트 정리
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  // 상태별 UI 렌더링
  const renderCameraArea = () => {
    switch (scannerState) {
      case 'starting':
        return (
          <div className='absolute inset-0 flex items-center justify-center text-white'>
            <div className='text-center'>
              <div className='animate-spin text-4xl mb-3'>📷</div>
              <p className='text-sm'>카메라 시작 중...</p>
            </div>
          </div>
        );

      case 'scanning':
        return (
          <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
            <div className='text-center'>
              <div className='border-2 border-red-500 border-dashed w-56 h-20 rounded animate-pulse mb-2'></div>
              <p className='text-white text-sm'>스캔 중... ({scanCount})</p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className='absolute inset-0 flex items-center justify-center text-white bg-green-900 bg-opacity-10'>
            <div className='text-center'>
              <div className='text-4xl mb-3'>✅</div>
              <p className='text-sm font-semibold'>스캔 성공!</p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className='absolute inset-0 flex items-center justify-center text-white bg-red-900 bg-opacity-10'>
            <div className='text-center'>
              <div className='text-4xl mb-3'>❌</div>
              <p className='text-sm'>오류 발생</p>
            </div>
          </div>
        );

      default: // idle
        return (
          <div className='absolute inset-0 flex items-center justify-center text-white'>
            <div className='text-center'>
              <div className='text-4xl mb-3'>📷</div>
              <p className='text-sm'>카메라 준비 완료</p>
              {selectedCamera && (
                <p className='text-xs mt-2 opacity-75'>{cameras.find((c) => c.deviceId === selectedCamera)?.label}</p>
              )}
            </div>
          </div>
        );
    }
  };

  const renderActionButton = () => {
    switch (scannerState) {
      case 'starting':
        return (
          <button
            disabled
            className='w-full bg-gray-400 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2'
          >
            <div className='animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full'></div>
            시작 중...
          </button>
        );

      case 'scanning':
        return (
          <button
            onClick={stopScanning}
            className='w-full bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700'
          >
            ⏹️ 스캔 중지
          </button>
        );

      case 'success':
        return (
          <button
            onClick={startNewScan}
            className='w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700'
          >
            🔄 새로운 스캔
          </button>
        );

      case 'error':
        return (
          <button
            onClick={() => {
              setError('');
              setScannerState('idle');
            }}
            className='w-full bg-orange-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-orange-700'
          >
            🔄 다시 시도
          </button>
        );

      default: // idle
        return (
          <button
            onClick={startScanning}
            disabled={!Quagga || cameras.length === 0 || !selectedCamera}
            className='w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400'
          >
            📸 스캔 시작
          </button>
        );
    }
  };

  // 로딩 중
  if (isLoading) {
    return (
      <div className='p-8 text-center'>
        <h1 className='text-2xl font-bold mb-4'>📱 바코드 스캐너</h1>
        <div className='flex items-center justify-center gap-2'>
          <div className='animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full'></div>
          <p>초기화 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='p-4 max-w-md mx-auto'>
      <h1 className='text-2xl font-bold text-center mb-6'>📱 CODE39 스캐너</h1>

      {/* 카메라 선택 */}
      {cameras.length > 1 && (
        <div className='mb-4'>
          <label className='block text-sm font-medium text-gray-700 mb-2'>📷 카메라 선택</label>
          <select
            value={selectedCamera}
            onChange={(e) => handleCameraChange(e.target.value)}
            disabled={scannerState === 'scanning' || scannerState === 'starting'}
            className='w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100'
          >
            {cameras.map((camera) => (
              <option key={camera.deviceId} value={camera.deviceId}>
                📹 {camera.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 상태 표시 */}
      {scannerState === 'scanning' && (
        <div className='mb-3 text-center'>
          <div className='inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm'>
            <div className='w-2 h-2 bg-red-500 rounded-full animate-pulse'></div>
            바코드를 빨간 영역에 맞춰주세요
          </div>
        </div>
      )}

      {/* 카메라 영역 */}
      <div className='mb-4'>
        <div ref={scannerRef} className='w-full h-80 bg-black rounded-lg relative overflow-hidden'>
          {renderCameraArea()}
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && scannerState === 'error' && (
        <div className='mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm'>⚠️ {error}</div>
      )}

      {/* 액션 버튼 */}
      <div className='mb-4'>{renderActionButton()}</div>

      {/* 스캔 결과 */}
      {scannedCode && scannerState === 'success' && (
        <div className='p-4 bg-green-100 border border-green-400 rounded-lg mb-4'>
          <h3 className='font-semibold text-green-800 mb-2'>✅ 스캔 성공!</h3>
          <p className='font-mono text-lg font-bold text-green-900 break-all mb-3'>{scannedCode}</p>
          <div className='flex gap-2'>
            <button
              onClick={() => navigator.clipboard?.writeText(scannedCode)}
              className='bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700'
            >
              📋 복사
            </button>
            <button
              onClick={() => {
                setScannedCode('');
                setScannerState('idle');
              }}
              className='bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600'
            >
              🗑️지우기
            </button>
          </div>
        </div>
      )}

      {/* 도움말 */}
      <div className='mt-6 p-3 bg-blue-50 rounded-lg'>
        <h4 className='font-semibold text-blue-800 mb-2'>💡 사용 팁</h4>
        <ul className='text-blue-700 text-sm space-y-1'>
          <li>
            • <strong>거리:</strong> 바코드와 10-15cm 유지
          </li>
          <li>
            • <strong>각도:</strong> 바코드가 수평이 되도록
          </li>
          <li>
            • <strong>조명:</strong> 밝은 환경에서 사용
          </li>
          <li>
            • <strong>흔들림:</strong> 손을 고정하고 천천히
          </li>
          <li>
            • <strong>품질:</strong> 바코드가 선명하고 손상되지 않았는지 확인
          </li>
        </ul>
      </div>

      {/* 상태 정보 */}
      {cameras.length > 0 && (
        <div className='mt-4 p-2 bg-gray-50 rounded text-xs text-gray-600 text-center'>
          💡 감지된 카메라: {cameras.length}개 | 상태:{' '}
          {scannerState === 'idle'
            ? '대기 중'
            : scannerState === 'starting'
            ? '시작 중'
            : scannerState === 'scanning'
            ? '스캔 중'
            : scannerState === 'success'
            ? '성공'
            : '오류'}
        </div>
      )}
    </div>
  );
}
