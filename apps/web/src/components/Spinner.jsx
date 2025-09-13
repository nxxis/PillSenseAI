import React from 'react';

export default function Spinner({ size = 32, color = 'var(--brand)' }) {
  return (
    <div className="spinner" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          stroke={color}
          strokeWidth="4"
          strokeDasharray="60 40"
          strokeLinecap="round"
          opacity="0.3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          stroke={color}
          strokeWidth="4"
          strokeDasharray="30 70"
          strokeLinecap="round"
          style={{
            transformOrigin: 'center',
            animation: 'spinner-rotate 1s linear infinite',
          }}
        />
      </svg>
    </div>
  );
}
