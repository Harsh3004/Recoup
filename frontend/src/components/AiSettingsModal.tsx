import React, { useState, useEffect } from 'react';
import { X, Cpu, Zap, Eye, EyeOff, Check, AlertCircle, Play, Sparkles } from 'lucide-react';
import { AiConfigData, ModelOption } from '../types';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onConfigSaved: (modelName: string) => void;
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({
  isOpen,
  onClose,
  showToast,
  onConfigSaved,
}) => {
  const [config, setConfig] = useState<AiConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState<string>('openrouter');
  const [activeModel, setActiveModel] = useState<string>('minimax/minimax-m3:free');
  const [temperature, setTemperature] = useState<number>(0.1);
  const [openRouterKey, setOpenRouterKey] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [openaiKey, setOpenaiKey] = useState<string>('');
  
  const [showOrKey, setShowOrKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/ai');
      const data = await res.json();
      setConfig(data);
      setActiveProvider(data.activeProvider);
      setActiveModel(data.activeModel);
      setTemperature(data.temperature ?? 0.1);
      setOpenRouterKey(data.openRouterApiKeyMasked || '');
      setGeminiKey(data.geminiApiKeyMasked || '');
      setOpenaiKey(data.openaiApiKeyMasked || '');
    } catch (err: any) {
      showToast('Failed to load AI configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        activeProvider,
        activeModel,
        temperature,
      };

      if (openRouterKey && !openRouterKey.includes('••••')) {
        payload.openRouterApiKey = openRouterKey;
      }
      if (geminiKey && !geminiKey.includes('••••')) {
        payload.geminiApiKey = geminiKey;
      }
      if (openaiKey && !openaiKey.includes('••••')) {
        payload.openaiApiKey = openaiKey;
      }

      const res = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration');

      showToast('AI model settings saved & active!', 'success');
      onConfigSaved(data.config.activeModel);
      onClose();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload: any = {
        provider: activeProvider,
        model: activeModel,
        temperature,
      };
      if (openRouterKey && !openRouterKey.includes('••••')) payload.apiKey = openRouterKey;
      else if (geminiKey && !geminiKey.includes('••••')) payload.apiKey = geminiKey;
      else if (openaiKey && !openaiKey.includes('••••')) payload.apiKey = openaiKey;

      const res = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        showToast(`Model responded successfully in ${data.latencyMs}ms`, 'success');
      } else {
        showToast(`Test error: ${data.error || 'Model request failed'}`, 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#0d1322] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">AI Engine &amp; Model Configuration</h3>
              <p className="text-xs text-slate-400">Configure live reasoning models, API credentials, and inference parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="space-y-4">
              <div className="h-32 rounded-xl skeleton-shimmer"></div>
              <div className="h-32 rounded-xl skeleton-shimmer"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: Provider & Model Selector */}
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active AI Provider
                </div>

                <div className="space-y-2">
                  {/* OpenRouter */}
                  <label
                    onClick={() => { setActiveProvider('openrouter'); setActiveModel('minimax/minimax-m3:free'); }}
                    className={`block p-3.5 rounded-xl border cursor-pointer transition-all ${
                      activeProvider === 'openrouter'
                        ? 'bg-indigo-600/15 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                        : 'glass-card hover:border-white/[0.2]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="provider"
                          checked={activeProvider === 'openrouter'}
                          onChange={() => {}}
                          className="text-indigo-600 focus:ring-0"
                        />
                        <span className="text-sm font-bold text-white">OpenRouter</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Free Tier</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Recommended</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 pl-5">MiniMax M3, Gemini 2.0 Flash, Llama 3.3 70B, DeepSeek R1</p>
                  </label>

                  {/* Google Gemini */}
                  <label
                    onClick={() => { setActiveProvider('gemini'); setActiveModel('gemini-2.5-flash'); }}
                    className={`block p-3.5 rounded-xl border cursor-pointer transition-all ${
                      activeProvider === 'gemini'
                        ? 'bg-indigo-600/15 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                        : 'glass-card hover:border-white/[0.2]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="provider"
                          checked={activeProvider === 'gemini'}
                          onChange={() => {}}
                          className="text-indigo-600 focus:ring-0"
                        />
                        <span className="text-sm font-bold text-white">Google Gemini</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">Direct API</span>
                    </div>
                    <p className="text-[11px] text-slate-400 pl-5">Google AI Studio API key (Gemini 2.5 Flash / 2.0 Flash)</p>
                  </label>

                  {/* OpenAI */}
                  <label
                    onClick={() => { setActiveProvider('openai'); setActiveModel('gpt-4o-mini'); }}
                    className={`block p-3.5 rounded-xl border cursor-pointer transition-all ${
                      activeProvider === 'openai'
                        ? 'bg-indigo-600/15 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                        : 'glass-card hover:border-white/[0.2]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="provider"
                          checked={activeProvider === 'openai'}
                          onChange={() => {}}
                          className="text-indigo-600 focus:ring-0"
                        />
                        <span className="text-sm font-bold text-white">OpenAI</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">Direct API</span>
                    </div>
                    <p className="text-[11px] text-slate-400 pl-5">GPT-4o Mini structured JSON completions</p>
                  </label>

                  {/* Offline Rules */}
                  <label
                    onClick={() => { setActiveProvider('offline'); setActiveModel('recoup-offline-rules-v1'); }}
                    className={`block p-3.5 rounded-xl border cursor-pointer transition-all ${
                      activeProvider === 'offline'
                        ? 'bg-indigo-600/15 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                        : 'glass-card hover:border-white/[0.2]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="provider"
                          checked={activeProvider === 'offline'}
                          onChange={() => {}}
                          className="text-indigo-600 focus:ring-0"
                        />
                        <span className="text-sm font-bold text-white">Offline Rule Classifier</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-500/20 text-slate-300">Zero Cost</span>
                    </div>
                    <p className="text-[11px] text-slate-400 pl-5">Deterministic domain regex heuristics with zero network calls</p>
                  </label>
                </div>

                {/* Model Catalog Dropdown */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Primary Reasoning Model</label>
                  <select
                    value={activeModel}
                    onChange={(e) => setActiveModel(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    {config?.availableModels?.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.isFree ? '⚡ Free' : ''} {m.isRecommended ? '★ Recommended' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Temperature Slider */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-300">Sampling Temperature</span>
                    <span className="font-mono text-indigo-300 font-bold bg-indigo-500/15 px-2 py-0.5 rounded">{temperature.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Low temperature (0.05–0.15) produces deterministic root-cause diagnosis.</p>
                </div>
              </div>

              {/* Right Column: Credentials & Live Tester */}
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  API Credentials &amp; Live Test
                </div>

                <div className="glass-card p-4 rounded-xl space-y-3">
                  {/* OpenRouter Key */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">OpenRouter API Key</label>
                    <div className="relative">
                      <input
                        type={showOrKey ? 'text' : 'password'}
                        value={openRouterKey}
                        onChange={(e) => setOpenRouterKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                        className="w-full bg-slate-900 border border-white/[0.1] rounded-xl pl-3 pr-10 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOrKey(!showOrKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showOrKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Gemini Key */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Google Gemini API Key</label>
                    <div className="relative">
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-slate-900 border border-white/[0.1] rounded-xl pl-3 pr-10 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* OpenAI Key */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">OpenAI API Key (Optional)</label>
                    <div className="relative">
                      <input
                        type={showOpenaiKey ? 'text' : 'password'}
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-slate-900 border border-white/[0.1] rounded-xl pl-3 pr-10 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showOpenaiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Diagnostic Tester */}
                <div className="glass-card p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Live Benchmark Test</h4>
                      <p className="text-[11px] text-slate-400">Sends sample dispute text to verify API &amp; JSON schema</p>
                    </div>
                    <button
                      onClick={handleTestConnection}
                      disabled={testing}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />
                      <span>{testing ? 'Testing…' : '⚡ Test Model'}</span>
                    </button>
                  </div>

                  <div className="bg-slate-950/80 rounded-lg p-3 border border-white/[0.06] text-xs font-mono max-h-36 overflow-y-auto">
                    {testResult ? (
                      <div className="space-y-1 text-[11px]">
                        <div className={testResult.success ? 'text-emerald-400' : 'text-rose-400'}>
                          Status: {testResult.success ? '✓ 200 OK (Inference Succeeded)' : `✗ Error: ${testResult.error}`}
                        </div>
                        {testResult.model && <div>Model: <strong className="text-indigo-300">{testResult.model}</strong></div>}
                        {testResult.latencyMs && <div>Roundtrip Latency: <strong>{testResult.latencyMs}ms</strong></div>}
                        {testResult.sampleDiagnosis && (
                          <div className="text-slate-300 pt-1 text-[10px]">
                            Diagnosis: <strong>{testResult.sampleDiagnosis.root_cause}</strong> (Conf: {testResult.sampleDiagnosis.confidence_bps})
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-500 text-[11px] italic">
                        Click "⚡ Test Model" to verify live reasoning, roundtrip API latency, and JSON output schema.
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/[0.08] flex items-center justify-end gap-3 bg-slate-900/60">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/30"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Saving…' : 'Save & Apply Model'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
