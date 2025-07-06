interface IconProps {
  className?: string;
}

export const CameraIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    className={`h-6 w-6 ${className}`}
    fill='none'
    viewBox='0 0 24 24'
    stroke='currentColor'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M15 10l4.55a1 1 0 01.55.89V14a1 1 0 01-1.55.89L15 14M5 9a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2V9z'
    />
  </svg>
);

export const ScanIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    className={`h-6 w-6 ${className}`}
    fill='none'
    viewBox='0 0 24 24'
    stroke='currentColor'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M12 4v1m0 14v1m8-9h-1M5 12H4m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'
    />
  </svg>
);

export const StopIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    className={`h-6 w-6 ${className}`}
    fill='none'
    viewBox='0 0 24 24'
    stroke='currentColor'
  >
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 10h6' />
  </svg>
);
