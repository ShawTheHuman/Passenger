import React from 'react';
import { MapPin, ExternalLink, Navigation } from 'lucide-react';
import { LocationData } from '../types';

interface LocationCardProps {
  location: LocationData;
}

export const LocationCard: React.FC<LocationCardProps> = ({ location }) => {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3 font-mono text-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
        <Navigation size={64} />
      </div>
      
      <div className="flex items-start gap-3 relative z-10">
        <div className="bg-blue-900/30 p-2 rounded text-blue-400 mt-1 flex-shrink-0">
          <MapPin size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-gray-300 font-bold uppercase tracking-wider text-xs mb-1">Estimated Location</h3>
          
          <div className="max-h-32 overflow-y-auto pr-2">
            <p className="text-blue-200 leading-relaxed text-xs italic opacity-90">
              "{location.description}"
            </p>
          </div>
        </div>
      </div>

      {location.nearbyPlaces.length > 0 && (
        <div className="border-t border-gray-800 pt-3 relative z-10">
          <p className="text-[10px] uppercase text-gray-500 mb-2">Sign Posts / Landmarks</p>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
            {location.nearbyPlaces.map((place, idx) => (
              <a 
                key={idx} 
                href={place.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded text-[10px] transition-colors"
              >
                {place.title} <ExternalLink size={10} />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};