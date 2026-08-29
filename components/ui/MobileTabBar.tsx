import React from 'react';
import { List, Edit3, Layers } from 'lucide-react';

export type TabId = 'leads' | 'compose' | 'summary';

interface MobileTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
  const tabs = [
    { id: 'leads' as TabId, label: 'Leads', icon: List },
    { id: 'compose' as TabId, label: 'Compose', icon: Edit3 },
    { id: 'summary' as TabId, label: 'Summary', icon: Layers },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-[90] pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-black' : 'text-slate-400 hover:text-slate-600'
              }`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-primary/20 text-black' : ''}`}>
                 <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-bold ${isActive ? 'text-black' : ''}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
