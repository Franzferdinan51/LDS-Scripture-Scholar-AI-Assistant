import React, { useEffect, useState } from 'react';
import type { Skill, Message, ToolCall } from '../types';

interface SkillSaveOfferProps {
  chatId: string;
  messageId: string;
  chatHistory: Record<string, Message[]>;
  onSave: (skill: Skill) => void | Promise<void>;
  onDismiss: () => void;
}

const SkillSaveOffer: React.FC<SkillSaveOfferProps> = ({
  chatId,
  messageId,
  chatHistory,
  onSave,
  onDismiss
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [customName, setCustomName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const messages = chatHistory[chatId] || [];
  const botMessage = messages.find(m => m.id === messageId);
  const userMessages = messages.filter(m => m.sender === 'user');

  if (!botMessage) return null;

  const firstUserMsg = userMessages[0]?.text || 'Custom Study';
  const topic = firstUserMsg.length > 50 ? firstUserMsg.substring(0, 47) + '...' : firstUserMsg;

  const allToolCalls: ToolCall[] = messages.flatMap(m => m.toolCalls ?? []);
  const toolsUsed: string[] = [...new Set(allToolCalls.map(tc => tc.name))];

  const systemPromptAddition = `This skill was created from a complex study session on: ${topic}. ` +
    `The session involved ${messages.length} messages and ${allToolCalls.length} tool calls. ` +
    `Tools used: ${toolsUsed.join(', ') || 'none'}. ` +
    `Instructions: You are helping the user study "${topic}". ` +
    `Be thorough, provide scripture references, and encourage deep reflection.`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    const skillName = customName.trim() || topic;
    const skill: Skill = {
      id: `custom-${Date.now()}`,
      name: skillName,
      description: `Custom skill for studying: ${topic}`,
      icon: '✨',
      category: 'research',
      systemPromptAddition,
      requiredTools: toolsUsed,
      useCount: 0,
      lastUsed: null,
      successCount: 0,
      avgRating: 0,
      isCustom: true,
    };
    try {
      await onSave(skill);
    } catch (err) {
      console.error('Failed to save skill:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save skill. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-xl p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <span className="text-2xl">✨</span>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-white">Save as Skill?</h4>
            <p className="text-xs text-gray-300 mt-1">
              This was a complex study session. Would you like to save this pattern as a reusable skill?
            </p>

            <div className="mt-3">
              <input
                type="text"
                placeholder={topic}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-400 mb-2"
              />
              {saveError && (
                <p className="mb-2 text-xs text-red-300">{saveError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 rounded text-xs text-white"
                >
                  {isSaving ? 'Saving...' : 'Save Skill'}
                </button>
                <button
                  onClick={onDismiss}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
                >
                  Not Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillSaveOffer;
