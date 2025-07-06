import { useState, useEffect, useRef } from 'react';
import type { Route } from './+types/home';
import Layout from '../../components/Layout';
import { CameraIcon, ScanIcon, StopIcon } from '../../components/icons';

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

interface ProductInfo {
  id: string;
  name: string;
  price: number;
  formattedPrice: string;
  category: string;
  stock: number;
  description: string;
  manufacturer: string;
  scannedAt?: string;
}

// --- 메인 컴포넌트 ---
export default function Home() {
  const [scannerState, setScannerState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [scannedCode, setScannedCode] = useState('');
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const scannerRef = useRef<HTMLDivElement>(null);
  const successTimer = useRef<NodeJS.Timeout | null>(null);

  // --- 제품 정보 조회 함수 ---
  const fetchProductInfo = async (barcode: string) => {
    setIsLoadingProduct(true);
    setProductInfo(null);

    try {
      const response = await fetch(`/server/products/${barcode}`);
      const result = await response.json();

      if (result.success) {
        setProductInfo(result.data);
        setError(''); // 에러 클리어
      } else {
        setError(`제품 조회 실패: ${result.error}`);
        setScannerState('error');
      }
    } catch (err) {
      console.error('API 호출 오류:', err);
      setError('서버와의 통신 중 오류가 발생했습니다.');
      setScannerState('error');
    } finally {
      setIsLoadingProduct(false);
    }
  };

  // --- 재고 관리 함수 ---
  const updateStock = async (barcode: string, action: 'increase_stock' | 'decrease_stock', quantity: number) => {
    try {
      const response = await fetch(`/server/products/${barcode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, quantity }),
      });

      const result = await response.json();

      if (result.success) {
        setProductInfo(result.data);
        return { success: true, message: result.message };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('재고 업데이트 오류:', err);
      return { success: false, error: '재고 업데이트 중 오류가 발생했습니다.' };
    }
  };

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
    setProductInfo(null);
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

  const handleDetection = async (result: any) => {
    if (result?.codeResult?.code) {
      const code = result.codeResult.code;
      setScannedCode(code);
      setScannerState('success');

      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      stopScanning();

      // 제품 정보 조회
      await fetchProductInfo(code);

      successTimer.current = setTimeout(() => {
        if (scannerState === 'success') {
          setScannerState('idle');
        }
      }, 8000); // 8초로 연장 (재고 관리 시간 포함)
    }
  };

  const handleCameraChange = (deviceId: string) => {
    stopScanning();
    setSelectedCamera(deviceId);
    setTimeout(startScanning, 100);
  };

  const handleReset = () => {
    setScannedCode('');
    setProductInfo(null);
    setError('');
    setScannerState('idle');
  };

  // --- UI 렌더링 ---
  if (isLoading) return <LoadingScreen />;

  return (
    <Layout>
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
            onReset={handleReset}
          />
          {scannedCode && (
            <ScanResultUI
              scannedCode={scannedCode}
              productInfo={productInfo}
              isLoading={isLoadingProduct}
              onClear={() => {
                setScannedCode('');
                setProductInfo(null);
              }}
              onUpdateStock={updateStock}
            />
          )}
          <InfoPanel />
        </div>
      </div>
    </Layout>
  );
}

// --- UI 컴포넌트들 ---
const Header = () => (
  <header className='text-center'>
    <h1 className='text-3xl sm:text-4xl font-bold text-indigo-600 dark:text-indigo-400'>CODE39 바코드 스캐너</h1>
    <p className='text-slate-600 dark:text-slate-400 mt-2'>실시간 제품 정보 조회 & 재고 관리</p>
  </header>
);

const LoadingScreen = () => (
  <div className='min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900'>
    <ScanIcon className='w-16 h-16 text-indigo-500 dark:text-indigo-400 animate-pulse' />
    <h1 className='text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-4'>스캐너 로딩 중...</h1>
    <p className='text-slate-500 dark:text-slate-400'>카메라 권한을 확인하고 있습니다.</p>
  </div>
);

const ScannerUI = ({ scannerRef, scannerState, error, cameras, selectedCamera, onCameraChange, isScanning }: any) => (
  <div className='bg-white dark:bg-slate-800/50 p-4 rounded-2xl shadow-lg flex flex-col space-y-4'>
    <div
      ref={scannerRef}
      className='relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-inner [&>video]:w-full [&>video]:h-full [&>video]:object-cover'
    >
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          scannerState === 'success' ? 'bg-green-500/30' : ''
        }`}
      />
      {scannerState === 'idle' && <ScannerOverlay text='카메라 준비 완료' />}
      {scannerState === 'error' && <ScannerOverlay text={error || '오류 발생'} error />}
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

// --- 재고 관리 기능이 포함된 제품 정보 표시 컴포넌트 ---
const ScanResultUI = ({ scannedCode, productInfo, isLoading, onClear, onUpdateStock }: any) => {
  const [stockUpdateLoading, setStockUpdateLoading] = useState(false);
  const [stockMessage, setStockMessage] = useState('');

  const handleStockUpdate = async (action: 'increase_stock' | 'decrease_stock', quantity: number) => {
    if (!productInfo) return;

    setStockUpdateLoading(true);
    setStockMessage('');

    const result = await onUpdateStock(productInfo.id, action, quantity);

    if (result.success) {
      setStockMessage(result.message);
      setTimeout(() => setStockMessage(''), 3000);
    } else {
      setStockMessage(`오류: ${result.error}`);
      setTimeout(() => setStockMessage(''), 5000);
    }

    setStockUpdateLoading(false);
  };

  return (
    <div className='space-y-4'>
      {/* 바코드 결과 */}
      <div className='bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4 rounded-r-lg shadow-sm'>
        <div className='flex justify-between items-start'>
          <div>
            <p className='font-semibold text-green-800 dark:text-green-300'>✅ 스캔 성공</p>
            <p className='text-lg font-mono font-bold text-slate-800 dark:text-slate-100 break-all mt-1'>
              {scannedCode}
            </p>
          </div>
          <button onClick={onClear} className='text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xl'>
            &times;
          </button>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(scannedCode)}
          className='mt-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline'
        >
          바코드 복사
        </button>
      </div>

      {/* 제품 정보 */}
      {isLoading && (
        <div className='bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded-r-lg'>
          <p className='text-blue-800 dark:text-blue-300'>🔍 제품 정보를 조회하고 있습니다...</p>
        </div>
      )}

      {productInfo && (
        <div className='bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-lg'>
          <div className='flex justify-between items-start mb-4'>
            <h3 className='text-xl font-bold text-slate-800 dark:text-slate-100'>{productInfo.name}</h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                productInfo.stock > 10
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : productInfo.stock > 0
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              }`}
            >
              재고: {productInfo.stock}개
            </span>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
            <div>
              <p className='text-sm text-slate-600 dark:text-slate-400'>가격</p>
              <p className='text-2xl font-bold text-indigo-600 dark:text-indigo-400'>{productInfo.formattedPrice}</p>
            </div>
            <div>
              <p className='text-sm text-slate-600 dark:text-slate-400'>카테고리</p>
              <p className='text-lg font-semibold text-slate-800 dark:text-slate-200'>{productInfo.category}</p>
            </div>
          </div>

          <div className='mb-4'>
            <p className='text-sm text-slate-600 dark:text-slate-400'>제조사</p>
            <p className='text-base font-medium text-slate-700 dark:text-slate-300'>{productInfo.manufacturer}</p>
          </div>

          <div className='mb-6'>
            <p className='text-sm text-slate-600 dark:text-slate-400'>제품 설명</p>
            <p className='text-base text-slate-700 dark:text-slate-300'>{productInfo.description}</p>
          </div>

          {/* 재고 관리 버튼 */}
          <div className='border-t border-slate-200 dark:border-slate-700 pt-4'>
            <p className='text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3'>📦 재고 관리</p>
            <div className='grid grid-cols-2 gap-3'>
              <button
                onClick={() => handleStockUpdate('decrease_stock', 1)}
                disabled={stockUpdateLoading || productInfo.stock === 0}
                className='flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed'
              >
                {stockUpdateLoading ? '⏳' : '➖'} 출고 (-1)
              </button>
              <button
                onClick={() => handleStockUpdate('increase_stock', 1)}
                disabled={stockUpdateLoading}
                className='flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed'
              >
                {stockUpdateLoading ? '⏳' : '➕'} 입고 (+1)
              </button>
            </div>

            {/* 대량 재고 관리 */}
            <div className='grid grid-cols-2 gap-3 mt-2'>
              <button
                onClick={() => handleStockUpdate('decrease_stock', 5)}
                disabled={stockUpdateLoading || productInfo.stock < 5}
                className='flex items-center justify-center gap-2 px-4 py-2 bg-red-400 hover:bg-red-500 disabled:bg-red-200 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed text-sm'
              >
                {stockUpdateLoading ? '⏳' : '📦'} 대량출고 (-5)
              </button>
              <button
                onClick={() => handleStockUpdate('increase_stock', 10)}
                disabled={stockUpdateLoading}
                className='flex items-center justify-center gap-2 px-4 py-2 bg-green-400 hover:bg-green-500 disabled:bg-green-200 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed text-sm'
              >
                {stockUpdateLoading ? '⏳' : '📦'} 대량입고 (+10)
              </button>
            </div>

            {/* 재고 관리 메시지 */}
            {stockMessage && (
              <div
                className={`mt-3 p-2 rounded-lg text-sm font-medium ${
                  stockMessage.includes('오류')
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                }`}
              >
                {stockMessage}
              </div>
            )}
          </div>

          {productInfo.scannedAt && (
            <p className='text-xs text-slate-500 dark:text-slate-500 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700'>
              조회 시간: {new Date(productInfo.scannedAt).toLocaleString('ko-KR')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const InfoPanel = () => (
  <div className='bg-white dark:bg-slate-800/50 p-5 rounded-2xl shadow-lg'>
    <h3 className='font-bold text-lg text-slate-800 dark:text-slate-100'>💡 사용 가이드</h3>
    <ul className='mt-3 space-y-2 text-slate-600 dark:text-slate-400'>
      <li className='flex items-start'>
        <span className='mr-2'>•</span>
        <span>바코드를 화면 중앙에 맞춰주세요.</span>
      </li>
      <li className='flex items-start'>
        <span className='mr-2'>•</span>
        <span>바코드와 10-20cm 거리를 유지하세요.</span>
      </li>
      <li className='flex items-start'>
        <span className='mr-2'>•</span>
        <span>스캔 후 자동으로 제품 정보가 조회됩니다.</span>
      </li>
      <li className='flex items-start'>
        <span className='mr-2'>•</span>
        <span>재고 관리 버튼으로 입출고를 관리할 수 있습니다.</span>
      </li>
      <li className='flex items-start'>
        <span className='mr-2'>•</span>
        <span>테스트 바코드: 123456789, 987654321, CODE39TEST</span>
      </li>
    </ul>
  </div>
);
