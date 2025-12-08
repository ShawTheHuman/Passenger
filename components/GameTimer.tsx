import React, { useMemo } from 'react';
import { Clock, Info } from 'lucide-react';

interface GameTimerProps {
  totalSeconds: number;
}

export const GameTimer: React.FC<GameTimerProps> = ({ totalSeconds }) => {
  // Format time as HH:MM:SS
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Determine which statistic to show based on time thresholds
  const currentStat = useMemo(() => {
    // Time thresholds in seconds
    const stats = [
      { t: 0, text: "The first few moments are chaos. Establish a baseline." },
      { t: 60, text: "Most abductions occur within 1/4 mile of the victim's home." },
      { t: 180, text: "Adrenaline is fading. Focus is critical." },
      { t: 300, text: "The abductor is likely moving you to a secondary location." },
      { t: 600, text: "Distance is your enemy. The search radius is expanding too slowly." },
      { t: 900, text: "Don't let them take you to a second location. Chances of survival drop by 50%." },
      { t: 1800, text: "74% of abducted children who are murdered are killed within the first 3 hours." },
      { t: 3600, text: "The 'Golden Hour' has passed. Investigation protocols shift." },
      { t: 7200, text: "Fatigue is setting in for both you and the driver." },
      { t: 86400, text: "After 24 hours, the chances of being found alive drop significantly." }
    ];

    // Find the latest stat that matches the current time
    return stats.slice().reverse().find(s => totalSeconds >= s.t) || stats[0];
  }, [totalSeconds]);

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-lg p-3 relative overflow-hidden group">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-gray-400">
          <Clock size={14} className={totalSeconds > 0 ? "text-red-500 animate-pulse" : ""} />
          <span className="text-[10px] uppercase font-bold tracking-wider">Elapsed Time</span>
        </div>
        <div className="font-mono text-xl font-bold text-gray-200 tracking-widest">
          {formatTime(totalSeconds)}
        </div>
      </div>
      
      <div className="border-t border-gray-800 pt-2 mt-1">
        <div className="flex gap-2 items-start">
            <Info size={12} className="text-gray-600 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-gray-500 italic leading-tight transition-all duration-500">
            {currentStat.text}
            </p>
        </div>
      </div>
      
      {/* Background visual flair */}
      <div className="absolute -right-4 -bottom-4 text-gray-800/20 pointer-events-none select-none">
        <Clock size={64} />
      </div>
    </div>
  );
};