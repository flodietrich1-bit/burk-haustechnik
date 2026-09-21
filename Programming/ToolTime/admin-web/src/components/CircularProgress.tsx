import React from 'react';

interface CircularProgressProps {
  percentage: number; // 0 to 100
  size?: number; // default 100
  strokeWidth?: number; // default 10
  showText?: boolean;
  sublabel?: string;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  percentage,
  size = 100,
  strokeWidth = 10,
  showText = true,
  sublabel = 'Fortschritt',
  className = ''
}) => {
  const clamped = Math.min(100, Math.max(0, Math.round(percentage)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  // Unique ID for the SVG gradient
  const gradientId = React.useId().replace(/:/g, '_');

  // Dynamic text color matching the current stage
  const getTextColor = (val: number) => {
    if (val >= 80) return 'text-emerald-600';
    if (val >= 40) return 'text-amber-600';
    return 'text-red-500';
  };

  return (
    <div 
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        <defs>
          {/* Gradient: 0% Rot -> 50% Gelb/Orange -> 100% Grün */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="45%" stopColor="#F59E0B" />
            <stop offset="75%" stopColor="#3B82C4" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Animated Progress Circle with 0% Rot -> 100% Grün Gradient */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Centered Percentage Label */}
      {showText && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <span className={`font-black tracking-tight leading-none ${size < 60 ? 'text-xs' : 'text-xl sm:text-2xl'} ${getTextColor(clamped)}`}>
            {clamped}%
          </span>
          {size >= 80 && sublabel && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
