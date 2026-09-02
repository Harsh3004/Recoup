import React from 'react';
import { 
  LayoutDashboard, 
  FolderKanban, 
  BrainCircuit, 
  ShieldAlert, 
  Blocks, 
  FlaskConical, 
  CreditCard,
  Cpu,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export type RouteId = 'dashboard' | 'cases' | 'ai-studio' | 'compliance' | 'audit-ledger' | 'ablation-lab' | 'razorpay-rail';

interface NavigationProps {
  currentRoute: RouteId;
  onRouteChange: (route: RouteId) => void;
  activeModel: string;
  auditEventsCount: number;
  onOpenAiSettings: () => void;
  onOpenVerifyModal: () => void;
  onOpenTamperModal: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentRoute,
  onRouteChange,
  activeModel,
  auditEventsCount,
  onOpenAiSettings,
  onOpenVerifyModal,
  onOpenTamperModal,
}) => {
  const navItems: Array<{ id: RouteId; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'cases', label: 'Case Explorer', icon: <FolderKanban className="w-4 h-4" /> },
    { id: 'ai-studio', label: 'AI Intelligence Studio', icon: <BrainCircuit className="w-4 h-4" /> },
    { id: 'compliance', label: 'Compliance & Gate Rails', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'audit-ledger', label: 'Cryptographic Ledger', icon: <Blocks className="w-4 h-4" /> },
    { id: 'ablation-lab', label: 'Causal Ablation Lab', icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'razorpay-rail', label: 'Razorpay Live Rail', icon: <CreditCard className="w-4 h-4" /> },
  ];

  return (
    <header className="mb-8 space-y-4">
      {/* Top Banner Row */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-white/[0.08]">
        {/* Brand */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center font-extrabold text-2xl text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white">Recoup</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-md">
                Autonomous Recovery
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Razorpay AI Buildathon · Track 03: AI Revenue Recovery Platform
            </p>
          </div>
        </div>

        {/* Global Quick Actions & Status Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active AI Model Badge */}
          <button
            onClick={onOpenAiSettings}
            className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 px-3 py-1.5 rounded-full text-xs text-indigo-300 transition-all duration-200"
            title="Configure active AI model"
          >
            <div className="w-2 h-2 rounded-full bg-indigo-400 radar-pulse-indigo"></div>
            <span>
              AI: <strong className="text-white font-semibold">{activeModel || 'minimax/minimax-m3:free'}</strong>
            </span>
          </button>

          {/* Audit Chain Status Badge */}
          <button
            onClick={onOpenVerifyModal}
            className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 px-3 py-1.5 rounded-full text-xs text-emerald-300 transition-all duration-200"
            title="Verify SHA-256 hash chain"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 radar-pulse"></div>
            <span>
              Chain: <strong className="text-white font-semibold">{auditEventsCount.toLocaleString()}</strong> Verified
            </span>
          </button>

          {/* AI Settings Modal Trigger */}
          <button
            onClick={onOpenAiSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/[0.08] transition-all"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Settings</span>
          </button>

          {/* Tamper Proof Test Trigger */}
          <button
            onClick={onOpenTamperModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-rose-500/15 text-slate-300 hover:text-rose-300 border border-white/[0.08] transition-all"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Tamper Test</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-slate-950/70 p-1.5 rounded-2xl border border-white/[0.08] overflow-x-auto shadow-inner">
        {navItems.map((item) => {
          const isActive = currentRoute === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onRouteChange(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
