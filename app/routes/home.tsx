import { useState, useEffect, useRef } from 'react';
import type { Route } from './+types/home';

// --- 아이콘 SVG 컴포넌트 ---
const CameraIcon = () => (
  <svg xmlns='http://www.w3.org/2000/svg' className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M15 10l4.55a1 1 0 01.55.89V14a1 1 0 01-1.55.89L15 14M5 9a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2V9z'
    />
  </svg>
);

const ScanIcon = () => (
  <svg xmlns='http://www.w3.org/2000/svg' className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M12 4v1m0 14v1m8-9h-1M5 12H4m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'
    />
  </svg>
);

const StopIcon = () => (
  <svg xmlns='http://www.w3.org/2000/svg' className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 10h6' />
  </svg>
);

// --- 메타 데이터 ---
export function meta({}: Route.MetaArgs) {
  return [
    { title: 'CODE39 바코드 스캐너' },
    { name: 'description', content: 'React Router v7 + Quagga2 바코드 스캐너' },
  ];
}

// --- 타입 정의 ---
let Quagga: any = null;
interface CameraDevice {
  deviceId: string;
  label: string;
}

// --- 메인 컴포넌트 ---
export default function Home() {
  const [scannerState, setScannerState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [scannedCode, setScannedCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const scannerRef = useRef<HTMLDivElement>(null);
  const successTimer = useRef<NodeJS.Timeout | null>(null);

  // --- 라이프사이클 및 초기화 ---
  useEffect(() => {
    const init = async () => {
      if (typeof window === 'undefined') return;
      try {
        const QuaggaModule = await import('@ericblade/quagga2');
        Quagga = QuaggaModule.default;
        await loadCameras();
      } catch (err) {
        console.error('초기화 실패:', err);
        setError('라이브러리 로드에 실패했습니다.');
        setScannerState('error');
      } finally {
        setIsLoading(false);
      }
    };
    init();

    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
      stopScanning();
    };
  }, []);

  // --- 카메라 로직 ---
  const loadCameras = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, i) => ({ deviceId: device.deviceId, label: device.label || `카메라 ${i + 1}` }));

      setCameras(videoDevices);

      if (videoDevices.length > 0) {
        const backCamera = videoDevices.find((c) => c.label.toLowerCase().includes('back')) || videoDevices[0];
        setSelectedCamera(backCamera.deviceId);
      }
    } catch (err) {
      console.error('카메라 로드 실패:', err);
      setError('카메라 접근 권한이 필요합니다. 페이지를 새로고침하거나 권한을 허용해주세요.');
      setScannerState('error');
    }
  };

  // --- 스캐너 제어 ---
  const startScanning = () => {
    if (!Quagga || !scannerRef.current || !selectedCamera) return;

    setError('');
    setScannedCode('');
    setScannerState('scanning');

    Quagga.init(
      {
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: scannerRef.current,
          constraints: {
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            frameRate: { ideal: 30, min: 15 },
            deviceId: { exact: selectedCamera },
            focusMode: 'continuous',
          },
        },
        locator: { patchSize: 'medium', halfSample: true },
        decoder: { readers: ['code_39_reader'] },
        locate: true,
        frequency: 10,
      },
      (err: any) => {
        if (err) {
          console.error('Quagga 초기화 실패:', err);
          setError('카메라 시작에 실패했습니다. 다른 카메라를 선택하거나 새로고침 해보세요.');
          setScannerState('error');
          return;
        }
        Quagga.start();
      },
    );

    Quagga.onDetected(handleDetection);
  };

  const stopScanning = () => {
    if (Quagga?.initialized) {
      Quagga.offDetected(handleDetection);
      Quagga.stop();
    }
    if (scannerState === 'scanning') {
      setScannerState('idle');
    }
  };

  const handleDetection = (result: any) => {
    if (result?.codeResult?.code) {
      setScannedCode(result.codeResult.code);
      setScannerState('success');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      stopScanning();

      successTimer.current = setTimeout(() => {
        if (scannerState === 'success') {
          setScannerState('idle');
        }
      }, 3000);
    }
  };

  const handleCameraChange = (deviceId: string) => {
    stopScanning();
    setSelectedCamera(deviceId);
    // 잠시 후 스캔 다시 시작
    setTimeout(startScanning, 100);
  };

  // --- UI 렌더링 ---
  if (isLoading) return <LoadingScreen />;

  return (
    <div className='min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200'>
      <main className='max-w-6xl mx-auto p-4 lg:p-8'>
        <Header />
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8'>
          <ScannerUI
            scannerRef={scannerRef}
            scannerState={scannerState}
            error={error}
            cameras={cameras}
            selectedCamera={selectedCamera}
            onCameraChange={handleCameraChange}
            isScanning={scannerState === 'scanning'}
          />
          <div className='flex flex-col space-y-6'>
            <ActionButtons
              scannerState={scannerState}
              onStartScan={startScanning}
              onStopScan={stopScanning}
              onReset={() => {
                setScannedCode('');
                setError('');
                setScannerState('idle');
              }}
            />
            {scannedCode && <ResultUI scannedCode={scannedCode} onClear={() => setScannedCode('')} />}
            <InfoPanel />
          </div>
        </div>
      </main>
    </div>
  );
}

// --- UI 컴포넌트 ---
const Header = () => (
  <header className='text-center'>
    <h1 className='text-3xl sm:text-4xl font-bold text-indigo-600 dark:text-indigo-400'>CODE39 바코드 스캐너</h1>
    <p className='mt-2 text-lg text-slate-600 dark:text-slate-400'>웹 기반의 빠르고 정확한 스캐너</p>
  </header>
);

const LoadingScreen = () => (
  <div className='min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900'>
    <ScanIcon />
    <h1 className='text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-4'>스캐너 로딩 중...</h1>
    <p className='text-slate-500 dark:text-slate-400'>카메라 권한을 확인하고 있습니다.</p>
  </div>
);

const ScannerUI = ({ scannerRef, scannerState, error, cameras, selectedCamera, onCameraChange, isScanning }: any) => (
  <div className='bg-white dark:bg-slate-800/50 p-4 rounded-2xl shadow-lg flex flex-col space-y-4'>
    <div ref={scannerRef} className='relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden shadow-inner'>
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          scannerState === 'success' ? 'bg-green-500/30' : ''
        }`}
      />
      {scannerState === 'idle' && <ScannerOverlay text='카메라 준비 완료' />}
      {scannerState === 'error' && <ScannerOverlay text={error || '오류 발생'} error />}
      {/* {isScanning && <ScanAnimation />} */}
    </div>
    {cameras.length >= 1 && (
      <CameraSelect cameras={cameras} selectedCamera={selectedCamera} onChange={onCameraChange} disabled={isScanning} />
    )}
  </div>
);

const ScannerOverlay = ({ text, error = false }: { text: string; error?: boolean }) => (
  <div
    className={`absolute inset-0 flex flex-col items-center justify-center text-white text-center p-4 ${
      error ? 'bg-red-500/50' : 'bg-black/50'
    }`}
  >
    <p className={`text-lg font-semibold ${error ? 'text-red-100' : 'text-white'}`}>{text}</p>
  </div>
);

const ScanAnimation = () => (
  <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
    <div className='w-3/4 h-1/3 border-4 border-red-500 rounded-2xl shadow-2xl animate-pulse' />
    <div className='absolute top-1/2 left-0 w-full h-1 bg-red-400/70 animate-scan-line' />
    <style>{`
      @keyframes scan-line {
        0% { transform: translateY(-80px); }
        100% { transform: translateY(80px); }
      }
      .animate-scan-line { animation: scan-line 1.5s ease-in-out infinite alternate; }
    `}</style>
  </div>
);

const CameraSelect = ({ cameras, selectedCamera, onChange, disabled }: any) => (
  <div className='relative'>
    <select
      value={selectedCamera}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className='w-full pl-10 pr-4 py-2.5 text-base bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg appearance-none focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'
    >
      {cameras.map((cam: CameraDevice) => (
        <option key={cam.deviceId} value={cam.deviceId}>
          {cam.label}
        </option>
      ))}
    </select>
    <div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none'>
      <CameraIcon />
    </div>
  </div>
);

const ActionButtons = ({ scannerState, onStartScan, onStopScan, onReset }: any) => {
  const isScanning = scannerState === 'scanning';
  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
      <button
        onClick={isScanning ? onStopScan : onStartScan}
        disabled={scannerState === 'success'}
        className={`flex items-center justify-center gap-2 w-full px-6 py-4 text-lg font-bold text-white rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 ${
          isScanning
            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-300'
            : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-300'
        } disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed`}
      >
        {isScanning ? <StopIcon /> : <ScanIcon />}
        {isScanning ? '스캔 중지' : '스캔 시작'}
      </button>
      <button
        onClick={onReset}
        className='flex items-center justify-center gap-2 w-full px-6 py-4 text-lg font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-slate-300 dark:focus:ring-slate-500'
      >
        초기화
      </button>
    </div>
  );
};

const ResultUI = ({ scannedCode, onClear }: { scannedCode: string; onClear: () => void }) => (
  <div className='bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4 rounded-r-lg shadow-sm'>
    <div className='flex justify-between items-start'>
      <div>
        <p className='font-semibold text-green-800 dark:text-green-300'>✅ 스캔 성공</p>
        <p className='text-2xl font-mono font-bold text-slate-800 dark:text-slate-100 break-all mt-1'>{scannedCode}</p>
      </div>
      <button onClick={onClear} className='text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'>
        &times;
      </button>
    </div>
    <button
      onClick={() => navigator.clipboard.writeText(scannedCode)}
      className='mt-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline'
    >
      결과 복사하기
    </button>
  </div>
);

const InfoPanel = () => (
  <div className='bg-white dark:bg-slate-800/50 p-5 rounded-2xl shadow-lg'>
    <h3 className='font-bold text-lg text-slate-800 dark:text-slate-100'>💡 스캔 팁</h3>
    <ul className='mt-3 space-y-2 text-slate-600 dark:text-slate-400'>
      <li className='flex items-start'>
        <span className='mr-2'>•</span>
        <span>바코드를 화면 중앙의 가이드 라인에 맞춰주세요.</span>
      </li>
      <li className='flex items-start'>
        <span className='mr-2'>•</span>
        <span>선명한 초점을 위해 바코드와 10-20cm 거리를 유지하세요.</span>
      </li>
      <li className='flex items-start'>
        <span className='mr-2'>•</span>
        <span>흔들림을 최소화하고, 조명이 밝은 곳에서 시도해보세요.</span>
      </li>
    </ul>
  </div>
);
