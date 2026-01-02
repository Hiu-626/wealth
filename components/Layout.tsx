import React from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, PenTool, PieChart } from 'lucide-react';

interface LayoutProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ currentView, onNavigate, children }) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'update', label: 'Update', icon: PenTool },
    { id: 'insights', label: 'Insights', icon: PieChart },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] max-w-md mx-auto relative shadow-2xl overflow-hidden">
      {/* Content Area */}
      <main className="h-screen overflow-y-auto scrollbar-hide">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between items-center max-w-md mx-auto z-40">
        {navItems.map(item => {
          const isActive = item.id === currentView || (item.id === 'overview' && currentView === 'fd-manager');
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ViewState)}
              className={`flex flex-col items-center space-y-1 transition-colors ${
                isActive ? 'text-[#0052CC]' : 'text-gray-400'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;