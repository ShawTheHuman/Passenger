import React from 'react';
import { Briefcase, Package } from 'lucide-react';
import { Item } from '../types';

interface InventoryListProps {
  items: Item[];
  onUseItem: (itemName: string) => void;
  disabled: boolean;
}

export const InventoryList: React.FC<InventoryListProps> = ({ items, onUseItem, disabled }) => {
  return (
    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
      <div className="flex items-center gap-2 mb-3 text-gray-500 border-b border-gray-800 pb-2">
        <Briefcase size={14} />
        <span className="text-[10px] uppercase font-bold tracking-wider">Inventory</span>
        <span className="ml-auto text-[10px] font-mono bg-gray-800 px-1.5 rounded text-gray-400">
            {items.length}
        </span>
      </div>
      
      <div className="space-y-2 min-h-[60px] max-h-[150px] overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-1 py-2 opacity-50">
             <Package size={16} />
             <span className="text-[10px]">Empty</span>
          </div>
        ) : (
          items.map((item) => (
            <div 
              key={item.id} 
              className="group bg-black/40 border border-gray-800 rounded p-2 hover:border-gray-600 transition-colors flex justify-between items-center"
            >
              <div className="overflow-hidden">
                <div className="text-xs text-gray-300 font-bold truncate">{item.name}</div>
                <div className="text-[9px] text-gray-500 truncate">{item.description}</div>
              </div>
              <button
                onClick={() => onUseItem(item.name)}
                disabled={disabled}
                className="ml-2 px-2 py-1 bg-gray-800 hover:bg-emerald-900 text-[9px] text-gray-300 uppercase rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0"
              >
                Use
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};