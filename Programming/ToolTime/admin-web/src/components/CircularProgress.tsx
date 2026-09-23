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
  const is100 = clamped === 100;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = is100 ? 0 : circumference - (clamped / 100) * circumference;

  // Unique ID for the SVG gradient
  const gradientId = React.useId().replace(/:/g, '_');

  // Interpolate Hue: 0° (Red #EF4444) -> 35° (Orange) -> 48° (Amber) -> 85° (Lime) -> 142° (Green #10B981)
  const currentHue = Math.min(142, Math.max(0, Math.round((clamped / 100) * 142)));
  const currentColor = is100 ? '#10B981' : `hsl(${currentHue}, 85%, 44%)`;

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
          {/* 
            Der Bogen beginnt bei 12 Uhr und läuft im Uhrzeigersinn (durch -rotate-90):
            12 Uhr (Start) entspricht lokal x=0.5, y=0.
            Mit gradientTransform="rotate(90 0.5 0.5)" verläuft der Gradient exakt:
            Start (12 Uhr): ROT (#EF4444)
            Verlauf im Uhrzeigersinn nach rechts/unten: GELB -> GRÜN (#10B981)
          */}
          <linearGradient 
            id={gradientId} 
            x1="0%" 
            y1="0%" 
            x2="100%" 
            y2="100%"
            gradientTransform="rotate(90, 0.5, 0.5)"
          >
            <stop offset="0%" stopColor={is100 ? "#10B981" : "#EF4444"} />
            <stop offset="100%" stopColor={currentColor} />
          </linearGradient>
        </defs>

        {/* Background Track Circle: Bei 100% wird der gesamte Ring grün */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={is100 ? "#10B981" : "#E2E8F0"}
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Animated Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={is100 ? "#10B981" : `url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Centered Percentage Label: schwarze Prozentzahl */}
      {showText && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <span className={`font-black text-slate-900 tracking-tight leading-none ${size < 60 ? 'text-xs' : 'text-xl sm:text-2xl'}`}>
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
