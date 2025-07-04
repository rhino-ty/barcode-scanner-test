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

export default function Home() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scannerRef = useRef<HTMLDivElement>(null);

  // Quagga2 로드
  useEffect(() => {
    const loadQuagga = async () => {
      if (typeof window === 'undefined') return;

      try {
        const QuaggaModule = await import('@ericblade/quagga2');
        Quagga = QuaggaModule.default;
        setIsLoading(false);
      } catch (err) {
        console.error('Quagga2 로드 실패:', err);
        setError('바코드 라이브러리를 로드할 수 없습니다.');
        setIsLoading(false);
      }
    };

    loadQuagga();
  }, []);

  // 스캔 시작
  const startScanning = async () => {
    if (!Quagga || !scannerRef.current) return;

    setError('');

    try {
      const config = {
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: scannerRef.current,
          constraints: {
            width: 1280,
            height: 720,
            facingMode: 'environment',
            frameRate: 30,
          },
        },
        locator: {
          halfSample: true,
          patchSize: 'small',
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
        frequency: 5,
      };

      Quagga.init(config, (err: any) => {
        if (err) {
          console.error('초기화 실패:', err);
          setError('카메라를 시작할 수 없습니다.');
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

        // 중복 감지 방지를 위한 일시 중지
        setTimeout(() => {
          if (Quagga && isScanning) {
            Quagga.stop();
            setTimeout(() => {
              if (scannerRef.current) {
                startScanning();
              }
            }, 1000);
          }
        }, 500);
      });
    } catch (err) {
      console.error('스캔 시작 실패:', err);
      setError('스캔을 시작할 수 없습니다.');
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
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className='p-4 max-w-md mx-auto'>
      <h1 className='text-2xl font-bold text-center mb-6'>📱 CODE39 스캐너</h1>

      {/* 카메라 영역 */}
      <div className='mb-4'>
        <div ref={scannerRef} className='w-full h-64 bg-black rounded-lg relative overflow-hidden'>
          {!isScanning && (
            <div className='absolute inset-0 flex items-center justify-center text-white'>
              <div className='text-center'>
                <div className='text-4xl mb-2'>📷</div>
                <p className='text-sm'>카메라 준비 완료</p>
              </div>
            </div>
          )}

          {isScanning && (
            <div className='absolute inset-0 flex items-center justify-center'>
              <div className='border-2 border-red-500 border-dashed w-48 h-16 rounded'></div>
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
            disabled={!Quagga}
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
          <button
            onClick={() => navigator.clipboard?.writeText(scannedCode)}
            className='mt-2 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700'
          >
            📋 복사
          </button>
        </div>
      )}

      {/* 도움말 */}
      <div className='mt-6 p-3 bg-blue-50 rounded-lg'>
        <h4 className='font-semibold text-blue-800 mb-1'>💡 사용법</h4>
        <ul className='text-blue-700 text-sm'>
          <li>• CODE39 바코드를 빨간 테두리에 맞춰주세요</li>
          <li>• 충분한 조명 환경에서 사용하세요</li>
          <li>• HTTPS 환경에서만 카메라가 작동합니다</li>
        </ul>
      </div>
    </div>
  );
}
