import React, { useContext } from 'react';
import { LanguageContext } from '../contexts/LanguageContext';
import { CheckCircleIcon, PhotoIcon, PencilSquareIcon, PlayIcon } from './icons';

interface GenerationProgressProps {
  currentStep: number;
  progress: { current: number; total: number } | null;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({ currentStep, progress }) => {
  const langContext = useContext(LanguageContext);
  if (!langContext) {
    throw new Error('LanguageContext is not available');
  }
  const { t } = langContext;

  const steps = [
    { id: 1, name: t('progressStep1'), icon: PlayIcon },
    { id: 2, name: t('progressStep2'), icon: PencilSquareIcon },
    { id: 3, name: t('progressStep3'), icon: PhotoIcon },
    { id: 4, name: t('progressStep4'), icon: CheckCircleIcon },
  ];

  return (
    <div className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 sm:p-8 border border-gray-700">
      <nav aria-label="Progress">
        <ol role="list" className="flex items-center">
          {steps.map((step, stepIdx) => (
            <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20 flex-1' : ''}`}>
              {currentStep > step.id ? (
                // Completed Step
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-indigo-600" />
                  </div>
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600">
                    <CheckCircleIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                </>
              ) : currentStep === step.id ? (
                // Current Step
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-gray-600" />
                  </div>
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-indigo-600 bg-gray-800">
                    <step.icon className="h-5 w-5 text-indigo-500 animate-pulse" aria-hidden="true" />
                  </div>
                </>
              ) : (
                // Upcoming Step
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-gray-600" />
                  </div>
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-600 bg-gray-800">
                    <step.icon className="h-5 w-5 text-gray-500" aria-hidden="true" />
                  </div>
                </>
              )}
               <div className="absolute -bottom-8 w-max text-center -translate-x-1/2 left-1/2 sm:left-auto sm:translate-x-0 sm:right-0 sm:w-auto sm:bottom-auto sm:top-1/2 sm:transform-none sm:-right-2 sm:translate-x-full sm:pl-4">
                  <span className={`text-sm font-medium ${currentStep >= step.id ? 'text-gray-200' : 'text-gray-500'}`}>
                    {step.name}
                    </span>
               </div>
            </li>
          ))}
        </ol>
      </nav>
      {currentStep === 3 && progress && progress.total > 0 && (
          <div className="mt-8 pt-4">
            <div className="flex justify-between mb-1">
                <span className="text-base font-medium text-indigo-400">{t('loadingMessage3', progress.current, progress.total)}</span>
                <span className="text-sm font-medium text-indigo-400">{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{width: `${(progress.current / progress.total) * 100}%`}}></div>
            </div>
          </div>
      )}
    </div>
  );
};
