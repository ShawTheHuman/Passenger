import React from 'react';

interface MeterProps {
  label: string;
  value: number;
  color: string;
  icon?: React.ReactNode;
}

export const Meter: React.FC<MeterProps> = ({ label, value, color, icon }) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between items-center text-xs uppercase tracking-widest text-gray-400 font-mono">
        <span className="flex items-center gap-2">{icon} {label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-700 ease-out ${color}`} 
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
};