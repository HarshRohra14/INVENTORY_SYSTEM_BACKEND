'use client';

import React, { useState } from 'react';
import { notificationSound } from '@/utils/notificationSound';

interface NotificationSoundSettingsProps {
  onClose?: () => void;
}

export default function NotificationSoundSettings({ onClose }: NotificationSoundSettingsProps) {
  const [enabled, setEnabled] = useState(notificationSound.isSoundEnabled());
  const [volume, setVolume] = useState(notificationSound.getVolume());

  const handleToggleSound = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    notificationSound.setEnabled(newEnabled);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    notificationSound.setVolume(newVolume);
  };

  const handleTestSound = () => {
    notificationSound.test();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Notification Sound Settings</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Enable/Disable Sound */}
      <div className="mb-6">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-gray-700">Enable notification sound</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggleSound}
              className="sr-only"
            />
            <div className={`block w-14 h-8 rounded-full transition-colors ${
              enabled ? 'bg-orange-500' : 'bg-gray-300'
            }`}></div>
            <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-0'
            }`}></div>
          </div>
        </label>
      </div>

      {/* Volume Control */}
      <div className={`mb-6 transition-opacity ${enabled ? 'opacity-100' : 'opacity-50'}`}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Volume: {Math.round(volume * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={handleVolumeChange}
          disabled={!enabled}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
          style={{
            background: enabled 
              ? `linear-gradient(to right, #f97316 0%, #f97316 ${volume * 100}%, #e5e7eb ${volume * 100}%, #e5e7eb 100%)`
              : '#e5e7eb'
          }}
        />
      </div>

      {/* Test Sound Button */}
      <div className="mb-4">
        <button
          onClick={handleTestSound}
          disabled={!enabled}
          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
            enabled
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          🔊 Test Sound
        </button>
      </div>

      {/* Info Text */}
      <div className="text-xs text-gray-500 text-center">
        Sound will play when new notifications arrive
      </div>
    </div>
  );
}
