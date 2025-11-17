import React, { useState, useContext } from 'react';
import { LanguageContext } from '../contexts/LanguageContext';
import { WandIcon, XCircleIcon } from './icons';

interface EditImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneImage: string | null;
  onGenerate: (prompt: string) => Promise<void>;
  isLoading: boolean;
}

export const EditImageModal: React.FC<EditImageModalProps> = ({
  isOpen,
  onClose,
  sceneImage,
  onGenerate,
  isLoading,
}) => {
  const [prompt, setPrompt] = useState('');

  const langContext = useContext(LanguageContext);
  if (!langContext) {
    throw new Error('LanguageContext is not available');
  }
  const { t } = langContext;

  if (!isOpen || !sceneImage) return null;
  
  const handleGenerateClick = () => {
      if (prompt.trim()) {
          onGenerate(prompt);
      }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-image-modal-title"
    >
      <div 
        className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-700 p-6 sm:p-8 relative transform transition-all animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 bg-gray-700/80 rounded-full text-white hover:bg-red-600 transition-colors"
          aria-label="Close"
        >
          <XCircleIcon className="w-8 h-8" />
        </button>

        <h2 id="edit-image-modal-title" className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600 mb-6">
          {t('editModalTitle')}
        </h2>

        <div className="mb-6 aspect-video w-full max-h-[50vh] flex items-center justify-center bg-gray-900 rounded-lg overflow-hidden">
             <img src={sceneImage} alt="Scene to edit" className="object-contain w-full h-full" />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('editPromptPlaceholder')}
            className="flex-grow bg-gray-700 text-white rounded-lg border-gray-600 focus:ring-indigo-500 focus:border-indigo-500 p-3"
            disabled={isLoading}
          />
          <button
            onClick={handleGenerateClick}
            disabled={isLoading || !prompt.trim()}
            className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white font-bold rounded-lg shadow-lg hover:bg-purple-700 disabled:bg-purple-900 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-500/50"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('editing')}
              </>
            ) : (
              <>
                <WandIcon className="w-5 h-5 mr-2" />
                {t('generateEdit')}
              </>
            )}
          </button>
        </div>
        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
          }
        `}</style>
      </div>
    </div>
  );
};