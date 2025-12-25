import React, { useState, useEffect } from 'react';
import { getConfig, updateConfig } from '../services/firebaseService';

interface Prompt {
  enabled: boolean;
  ratio: string;
  name: string;
  prompt: string;
  weight?: number; // 0-10
  modelName?: string;
}

interface ConfigData {
  lastBagNum: number;
  prompts: Prompt[];
  ratio: string;
  totalCost: number;
  totalImages: number;
  genImageCount: number;
  modelName: string;
  prompt_beforetext?: string;
  prompt_aftertext?: string;
}

interface EditConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODEL_OPTIONS = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];
const IMAGE_SIZE_OPTIONS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

export const EditConfigDialog: React.FC<EditConfigDialogProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPromptIndex, setExpandedPromptIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    } else {
      // Reset state when dialog closes
      setConfig(null);
      setError(null);
    }
  }, [isOpen]);

  // Handle ESC key to close dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      
      const data = await getConfig('function1');
      setConfig(data);
    } catch (err) {
      console.error('Error loading config:', err);
      setError('Failed to load config: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      await updateConfig('function1', config);
      alert('Config saved successfully!');
      // Don't close dialog on save
    } catch (err) {
      setError('Failed to save config: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const updatePrompt = (index: number, field: keyof Prompt, value: any) => {
    console.log("updatePrompt",index,field,value==='');
    if (!config) return;
    const newPrompts = [...config.prompts];
    newPrompts[index] = { ...newPrompts[index], [field]: value };
    setConfig({ ...config, prompts: newPrompts });
    console.log("Updated prompts:", newPrompts);
  };

  const removePrompt = (index: number) => {
    if (!config) return;
    setConfig({ ...config, prompts: config.prompts.filter((_, i) => i !== index) });
  };

  const addPrompt = () => {
    if (!config) return;
    const newPrompt: Prompt = {
      enabled: true,
      ratio: '',
      name: 'New Prompt',
      prompt: '',
      weight: 5,
      modelName: ''
    };
    setConfig({ ...config, prompts: [...config.prompts, newPrompt] });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
        <div className="bg-blue-600 p-6 text-white sticky top-0">
          <h2 className="text-xl font-bold flex items-center">
            <i className="fas fa-cog mr-3"></i>
            Edit Config - function1
          </h2>
        </div>

        <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-blue-600"></i>
            </div>
          ) : config ? (
            <div className="space-y-6">
              {/* Basic Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Last Bag Number
                  </label>
                  <input
                    type="number"
                    value={config.lastBagNum}
                    onChange={(e) => setConfig({ ...config, lastBagNum: parseInt(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Ratio
                  </label>
                  <select
                    value={config.ratio}
                    onChange={(e) => setConfig({ ...config, ratio: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {IMAGE_SIZE_OPTIONS.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Model Name
                  </label>
                  <select
                    value={config.modelName}
                    onChange={(e) => setConfig({ ...config, modelName: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {MODEL_OPTIONS.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Gen Image Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={config.genImageCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setConfig({ ...config, genImageCount: Math.min(Math.max(val, 1), 8) });
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Prompt Text Fields */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Prompt Before Text
                </label>
                <textarea
                  value={config.prompt_beforetext || ''}
                  onChange={(e) => setConfig({ ...config, prompt_beforetext: e.target.value })}
                  rows={3}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="Text to prepend to all prompts"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Prompt After Text
                </label>
                <textarea
                  value={config.prompt_aftertext || ''}
                  onChange={(e) => setConfig({ ...config, prompt_aftertext: e.target.value })}
                  rows={3}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="Text to append to all prompts"
                />
              </div>

              {/* Read-only Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Total Cost 
                  </label>
                  <p className="p-2 text-slate-700 font-medium">
                    ${config.totalCost.toFixed(6)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Total Images 
                  </label>
                  <p className="p-2 text-slate-700 font-medium">
                    {config.totalImages}
                  </p>
                </div>
              </div>

              {/* Prompts Section */}
              <div className="border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Prompts</h3>
                  <button
                    onClick={addPrompt}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition"
                  >
                    <i className="fas fa-plus mr-1"></i> Add Prompt
                  </button>
                </div>

                <div className="space-y-3">
                  {config.prompts.map((prompt, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedPromptIndex(expandedPromptIndex === index ? null : index)}
                        className="w-full p-4 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition"
                      >
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <input
                            type="checkbox"
                            checked={prompt.enabled}
                            onChange={(e) => updatePrompt(index, 'enabled', e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4"
                          />
                          <span className="font-medium text-slate-700">{prompt.name}</span>
           
                        </div>
                        <i className={`fas fa-chevron-${expandedPromptIndex === index ? 'up' : 'down'} text-slate-500`}></i>
                      </button>

                      {expandedPromptIndex === index && (
                        <div className="p-4 bg-white border-t border-slate-200 space-y-3">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                            <input
                              type="text"
                              value={prompt.name}
                              onChange={(e) => updatePrompt(index, 'name', e.target.value)}
                              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Ratio</label>
                            <select
                              value={prompt.ratio || ''}
                              onChange={(e) => updatePrompt(index, 'ratio', e.target.value)}
                              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            >
                              <option key='' value=''>Inherit</option>
                              {IMAGE_SIZE_OPTIONS.map(size => (
                                <option key={size} value={size}>{size}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Model Name</label>
                            <select
                              value={prompt.modelName ?? ''}
                              onChange={(e) => updatePrompt(index, 'modelName', e.target.value)}
                              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            >
                                 <option key='' value=''>Inherit</option>
                              {MODEL_OPTIONS.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Weight (0-10)</label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={prompt.weight ?? 1}
                              onChange={(e) => updatePrompt(index, 'weight', Math.min(Math.max(parseInt(e.target.value) || 0, 0), 10))}
                              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Prompt</label>
                            <textarea
                              value={prompt.prompt}
                              onChange={(e) => updatePrompt(index, 'prompt', e.target.value)}
                              rows={4}
                              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                          </div>
     
                          <button
                            onClick={() => removePrompt(index)}
                            className="w-20 bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 rounded-lg transition text-sm"
                          >
                            <i className="fas fa-trash-alt mr-2"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t p-6 flex gap-3 justify-end sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition"
          >
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-save mr-2"></i>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

