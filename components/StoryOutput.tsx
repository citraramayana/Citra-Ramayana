

import React, { useContext, useCallback } from 'react';
import JSZip from 'jszip';
import { StoryResult } from '../types';
import { LanguageContext } from '../contexts/LanguageContext';
import { DownloadIcon, SparklesIcon, PencilIcon, XCircleIcon, WandIcon, PhotoIcon, CheckCircleIcon } from './icons';

interface StoryOutputProps {
  result: StoryResult | null;
  aspectRatio: string;
  onGenerateVideoPrompt: (sceneIndex: number) => void;
  onOpenEditModal: (sceneIndex: number) => void;
  onContinueStory: (mode: 'extend' | 'conclude') => void;
  onRegenerateImage: (sceneIndex: number) => void;
  continuationMode: 'extend' | 'conclude' | null;
  isGenerationDisabled: boolean;
}

export const StoryOutput: React.FC<StoryOutputProps> = ({ result, aspectRatio, onGenerateVideoPrompt, onOpenEditModal, onContinueStory, onRegenerateImage, continuationMode, isGenerationDisabled }) => {
  const langContext = useContext(LanguageContext);
  if (!langContext) {
    throw new Error('LanguageContext is not available');
  }
  const { t } = langContext;

  const handleDownloadSingle = useCallback((imageSrc: string | null, baseFileName: string) => {
    if (!imageSrc) return;
    
    const mimeTypeMatch = imageSrc.match(/data:(.*);/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    const fileName = `${baseFileName}.${extension}`;

    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (!result) return;

    const zip = new JSZip();

    // Add video prompts text file instead of story
    let promptsText = `${result.title}\n\n`;
    result.scenes.forEach((scene, index) => {
      promptsText += `${t('videoPromptFileTitle', index + 1)}\n`;
      if (scene.videoPrompt) {
        promptsText += `${scene.videoPrompt}\n\n`;
      } else {
        promptsText += `${t('promptNotGenerated')}\n\n`;
      }
    });
    zip.file("video_prompts.txt", promptsText);

    // Add images
    for (let i = 0; i < result.scenes.length; i++) {
      const scene = result.scenes[i];
      if (scene.image) {
        const base64Data = scene.image.split(',')[1];
        const mimeType = scene.image.match(/data:(.*);/)?.[1];
        const extension = mimeType?.split('/')[1] || 'png';
        zip.file(`scene_${i + 1}.${extension}`, base64Data, { base64: true });
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${result.title.replace(/\s+/g, '_')}_story_assets.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

  }, [result, t]);

  if (!result) {
    return null;
  }

  const aspectConfig = {
    '16:9': {
      containerClass: 'md:w-2/5',
      aspectClass: 'aspect-video',
    },
    '9:16': {
      containerClass: 'md:w-1/4',
      aspectClass: 'aspect-[9/16]',
    },
  }[aspectRatio] || { containerClass: 'md:w-2/5', aspectClass: 'aspect-video' };

  return (
    <div className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 sm:p-8 border border-gray-700 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-center text-center gap-4 mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-500">
          {result.title}
        </h2>
        <div className="flex items-center gap-4">
          {result.storyMode === 'extend' && (
            <>
              <button
                onClick={() => onContinueStory('extend')}
                disabled={isGenerationDisabled}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                aria-label={t('addScenes')}
              >
                {continuationMode === 'extend' ? (
                   <>
                    <svg className="animate-spin -ml-1 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('addingScenes')}
                  </>
                ) : (
                  <>
                    <WandIcon className="w-5 h-5" />
                    {t('addScenes')}
                  </>
                )}
              </button>
              <button
                onClick={() => onContinueStory('conclude')}
                disabled={isGenerationDisabled}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                aria-label={t('addAndConclude')}
              >
                {continuationMode === 'conclude' ? (
                   <>
                    <svg className="animate-spin -ml-1 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('addingAndConcluding')}
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5" />
                    {t('addAndConclude')}
                  </>
                )}
              </button>
            </>
          )}
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            aria-label={t('downloadAll')}
          >
            <DownloadIcon className="w-5 h-5" />
            {t('downloadAll')}
          </button>
        </div>
      </div>


      <div className="bg-gray-900/50 p-6 rounded-lg mb-12 border border-gray-700">
        <div className="space-y-4">
          {result.scenes.map((scene, index) => (
            <p key={`text-${index}`} className="text-gray-300 leading-relaxed text-lg">
              <span className="font-bold text-indigo-400">{t('panel', index + 1)}</span> {scene.paragraph}
            </p>
          ))}
        </div>
      </div>

      <div className="space-y-12">
        {result.scenes.map((scene, index) => (
          <div
            key={index}
            className="flex flex-col md:flex-row gap-6 items-start animate-slide-up"
            style={{ animationDelay: `${index * 150}ms`, opacity: 0, animationFillMode: 'forwards' }}
          >
            <div className={`relative w-full ${aspectConfig.containerClass} flex-shrink-0`}>
             {scene.image === undefined || scene.isRegenerating ? (
                <div className={`rounded-lg shadow-xl w-full ${aspectConfig.aspectClass} border-2 border-gray-700 bg-gray-900 flex flex-col items-center justify-center text-center p-4`}>
                    <div className="animate-pulse flex flex-col items-center justify-center">
                        <PhotoIcon className="w-12 h-12 text-gray-600 mb-2" />
                        <p className="text-gray-500 font-semibold">{scene.isRegenerating ? t('regeneratingImage') : t('illustratingScene')}</p>
                    </div>
                </div>
             ) : scene.image ? (
                <>
                    <img
                        src={scene.image}
                        alt={t('sceneIllustrationAlt', index + 1)}
                        className={`rounded-lg shadow-xl w-full ${aspectConfig.aspectClass} object-cover border-2 border-gray-700`}
                    />
                    <button
                        onClick={() => handleDownloadSingle(scene.image, `scene_${index + 1}`)}
                        className="absolute top-2 right-2 p-2 bg-gray-900/60 rounded-full text-white transition-colors duration-300 hover:bg-indigo-600"
                        aria-label={t('downloadImage')}
                    >
                        <DownloadIcon className="w-5 h-5" />
                    </button>
                </>
             ) : (
                <div className={`rounded-lg shadow-xl w-full ${aspectConfig.aspectClass} border-2 border-red-700/50 bg-gray-900 flex flex-col items-center justify-center text-center p-4`}>
                    <XCircleIcon className="w-10 h-10 text-red-500 mb-2" />
                    <p className="text-red-400 font-semibold">{t('imageGenFailedTitle')}</p>
                    <p className="text-red-500 text-sm mt-1">{t('imageGenFailedBody')}</p>
                    <button 
                      onClick={() => onRegenerateImage(index)}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    >
                      <WandIcon className="w-4 h-4" />
                      {t('regenerateImage')}
                    </button>
                </div>
             )}
            </div>
            <div className="w-full flex-1">
              <p className="text-gray-300 leading-relaxed text-lg">
                {scene.paragraph}
              </p>
               <div className="mt-4 flex flex-wrap items-start gap-4">
                <div className="flex-grow">
                  {!scene.videoPrompt && !scene.isVideoPromptLoading && (
                      <button
                          onClick={() => onGenerateVideoPrompt(index)}
                          disabled={!scene.image}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:bg-purple-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                          <SparklesIcon className="w-5 h-5" />
                          {t('generateVideoPrompt')}
                      </button>
                  )}
                  {scene.isVideoPromptLoading && (
                      <div className="flex items-center gap-2 text-gray-400 px-4 py-2">
                          <svg className="animate-spin h-5 w-5 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('generatingVideoPrompt')}
                      </div>
                  )}
                  {scene.videoPrompt && (
                      <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-700 max-w-md">
                          <p className="text-sm font-semibold text-purple-300 mb-2">{t('videoPromptTitle')}</p>
                          <p className="text-gray-300 font-mono text-sm leading-6">{scene.videoPrompt}</p>
                      </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <button
                    onClick={() => onOpenEditModal(index)}
                    disabled={!scene.image}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400/50 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                  >
                    <PencilIcon className="w-5 h-5" />
                    {t('editImage')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
       <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
          }
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-up {
            animation: slide-up 0.6s ease-out;
          }
        `}</style>
    </div>
  );
};
