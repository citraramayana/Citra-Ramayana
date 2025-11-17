
import React, { useState, useCallback, useContext } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { StoryOutput } from './components/StoryOutput';
import { generateStoryAndImages, continueStoryAndImages, generateVideoPrompt, editImage, fileToGenerativePart, generateImage } from './services/geminiService';
import { StoryResult, Scene } from './types';
import { WandIcon } from './components/icons';
import { LanguageContext } from './contexts/LanguageContext';
import { EditImageModal } from './components/EditImageModal';
import { GenerationProgress } from './components/GenerationProgress';

const App: React.FC = () => {
  const [character1, setCharacter1] = useState<File | null>(null);
  const [character2, setCharacter2] = useState<File | null>(null);
  const [storyHistory, setStoryHistory] = useState<StoryResult[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [continuationMode, setContinuationMode] = useState<'extend' | 'conclude' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [artStyle, setArtStyle] = useState('2d');
  const [sceneCount, setSceneCount] = useState<string>('6');
  const [storyMode, setStoryMode] = useState<'conclude' | 'extend'>('conclude');
  const [storyVersions, setStoryVersions] = useState(1);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);

  const [generationStep, setGenerationStep] = useState(0);
  const [illustrationProgress, setIllustrationProgress] = useState<{ current: number; total: number } | null>(null);

  const langContext = useContext(LanguageContext);
  if (!langContext) {
    throw new Error('LanguageContext is not available');
  }
  const { language, setLanguage, t } = langContext;

  const activeStory = activeStoryIndex !== null ? storyHistory[activeStoryIndex] : null;

  const handleProgressUpdate = useCallback((step: number, progress?: { current: number; total: number }) => {
    setGenerationStep(step);
    if (step === 3 && progress) {
      setIllustrationProgress(progress);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!character1) {
      setError(t('errorAtLeastOne'));
      return;
    }
    
    const sceneCountNum = parseInt(sceneCount, 10);
    if (isNaN(sceneCountNum) || sceneCountNum < 2 || sceneCountNum > 100) {
      setError(t('errorInvalidSceneCount'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setGenerationStep(0);
    setIllustrationProgress(null);
    
    const placeholders: StoryResult[] = [];
    const storyIds: number[] = [];

    for (let i = 0; i < storyVersions; i++) {
        const storyId = Date.now() + i;
        storyIds.push(storyId);
        placeholders.push({
            id: storyId,
            title: storyVersions > 1 ? `${t('generating')} #${i + 1}` : t('generating'),
            scenes: [],
            storyMode: storyMode,
            isLoading: true,
        });
    }

    setStoryHistory(prev => {
        const newHistory = [...prev, ...placeholders];
        setActiveStoryIndex(prev.length);
        return newHistory;
    });

    const generationPromises = storyIds.map((storyId, index) => {
        const onStoryGenerated = ({ title, paragraphs, imagePrompts }: { title: string; paragraphs: string[]; imagePrompts: string[] }) => {
            setStoryHistory(prev => prev.map(story => {
                if (story.id !== storyId) return story;
                return {
                    ...story,
                    title,
                    scenes: paragraphs.map((p, i) => ({ 
                        paragraph: p, 
                        imagePrompt: imagePrompts[i],
                        image: undefined,
                    })),
                };
            }));
        };

        const onImageGenerated = (image: string | null, imgIndex: number) => {
            setStoryHistory(prev => prev.map(story => {
                if (story.id !== storyId) return story;
                const newScenes = [...story.scenes];
                if (newScenes[imgIndex]) {
                    newScenes[imgIndex].image = image;
                }
                return { ...story, scenes: newScenes };
            }));
        };
        
        const progressHandler = index === 0 ? handleProgressUpdate : () => {};

        return generateStoryAndImages(
            character1,
            character2,
            progressHandler,
            language,
            aspectRatio,
            artStyle,
            sceneCountNum,
            storyMode,
            onStoryGenerated,
            onImageGenerated
        ).catch(err => {
            console.error(`Error generating story #${index + 1}:`, err);
            setStoryHistory(prev => prev.map(story =>
                story.id === storyId ? { 
                    ...story, 
                    title: t('errorTitle'), 
                    scenes: [{ paragraph: err instanceof Error ? err.message : t('errorUnknown'), imagePrompt: '', image: null }],
                    isLoading: false 
                } : story
            ));
            // re-throw to be caught by allSettled
            throw err;
        });
    });

    try {
        const results = await Promise.allSettled(generationPromises);
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                 setStoryHistory(prev => prev.map(story =>
                    story.id === storyIds[index] ? { ...story, isLoading: false } : story
                ));
            }
        });
    } finally {
        setIsLoading(false);
        setGenerationStep(0);
        setIllustrationProgress(null);
    }
  }, [character1, character2, language, aspectRatio, artStyle, sceneCount, t, handleProgressUpdate, storyMode, storyVersions]);
  
  const handleContinueStory = useCallback(async (mode: 'extend' | 'conclude') => {
    if (activeStoryIndex === null || !character1) return;
    const currentStory = storyHistory[activeStoryIndex];

    const sceneCountNum = parseInt(sceneCount, 10);
    if (isNaN(sceneCountNum) || sceneCountNum < 1 || sceneCountNum > 100) {
      setError(t('errorInvalidSceneCount'));
      return;
    }

    setContinuationMode(mode);
    setError(null);
    setGenerationStep(0);
    setIllustrationProgress(null);

    let newSceneCount = 0;

    const onNewStoryPartsGenerated = ({ paragraphs, imagePrompts }: { paragraphs: string[], imagePrompts: string[] }) => {
        newSceneCount = paragraphs.length;
        const newScenePlaceholders: Scene[] = paragraphs.map((p, i) => ({ 
          paragraph: p, 
          imagePrompt: imagePrompts[i],
          image: undefined 
        }));
        setStoryHistory(prev => prev.map((story, index) => {
            if (index !== activeStoryIndex) return story;
            return {
                ...story,
                scenes: [...story.scenes, ...newScenePlaceholders],
                storyMode: mode,
            };
        }));
    };
    
    const onNewImageGenerated = (image: string | null, index: number) => {
        setStoryHistory(prev => prev.map((story, i) => {
            if (i !== activeStoryIndex) return story;
            const absoluteIndex = story.scenes.length - newSceneCount + index;
            const newScenes = [...story.scenes];
            if (newScenes[absoluteIndex]) {
                newScenes[absoluteIndex].image = image;
            }
            return { ...story, scenes: newScenes };
        }));
    };


    try {
       await continueStoryAndImages(
        currentStory,
        character1,
        character2,
        handleProgressUpdate,
        language,
        aspectRatio,
        artStyle,
        sceneCountNum,
        mode,
        onNewStoryPartsGenerated,
        onNewImageGenerated
      );

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t('errorUnknown'));
    } finally {
      setContinuationMode(null);
      setGenerationStep(0);
      setIllustrationProgress(null);
    }
  }, [storyHistory, activeStoryIndex, character1, character2, handleProgressUpdate, language, aspectRatio, artStyle, sceneCount, t]);

  const handleRegenerateImage = async (sceneIndex: number) => {
    if (activeStoryIndex === null || !character1) return;
    const currentStory = storyHistory[activeStoryIndex];
    if (!currentStory || !currentStory.scenes[sceneIndex]) return;

    setError(null);

    setStoryHistory(prev => prev.map((story, index) => {
        if (index !== activeStoryIndex) return story;
        const newScenes = [...story.scenes];
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], isRegenerating: true };
        return { ...story, scenes: newScenes };
    }));

    try {
        const sceneToRegenerate = currentStory.scenes[sceneIndex];
        const character1Part = await fileToGenerativePart(character1);
        const character2Part = character2 ? await fileToGenerativePart(character2) : null;
        
        const newImage = await generateImage(
            sceneToRegenerate.imagePrompt,
            character1Part,
            character2Part,
            aspectRatio
        );
        
        setStoryHistory(prev => prev.map((story, index) => {
            if (index !== activeStoryIndex) return story;
            const newScenes = [...story.scenes];
            newScenes[sceneIndex] = { ...newScenes[sceneIndex], image: newImage };
            return { ...story, scenes: newScenes };
        }));

    } catch (err) {
        console.error(`Failed to regenerate image for scene ${sceneIndex}`, err);
        setError(err instanceof Error ? err.message : t('errorUnknown'));
    } finally {
        setStoryHistory(prev => prev.map((story, index) => {
            if (index !== activeStoryIndex) return story;
            const newScenes = [...story.scenes];
            newScenes[sceneIndex] = { ...newScenes[sceneIndex], isRegenerating: false };
            return { ...story, scenes: newScenes };
        }));
    }
  };

  const handleGenerateVideoPrompt = useCallback(async (sceneIndex: number) => {
    if (activeStoryIndex === null || !character1) return;
    const currentStory = storyHistory[activeStoryIndex];
    if (!currentStory || !currentStory.scenes[sceneIndex].image) return;

    setStoryHistory(prev => prev.map((story, index) => {
      if (index !== activeStoryIndex) return story;
      const newScenes = [...story.scenes];
      newScenes[sceneIndex] = { ...newScenes[sceneIndex], isVideoPromptLoading: true, videoPrompt: undefined };
      return { ...story, scenes: newScenes };
    }));
    setError(null);

    try {
      const scene = currentStory.scenes[sceneIndex];
      const videoPrompt = await generateVideoPrompt(
        scene.paragraph,
        scene.image,
        character1,
        character2,
        artStyle,
        language
      );
      
      setStoryHistory(prev => prev.map((story, index) => {
        if (index !== activeStoryIndex) return story;
        const newScenes = [...story.scenes];
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], videoPrompt, isVideoPromptLoading: false };
        return { ...story, scenes: newScenes };
      }));
    } catch (err) {
      console.error(err);
      setStoryHistory(prev => prev.map((story, index) => {
        if (index !== activeStoryIndex) return story;
        const newScenes = [...story.scenes];
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], isVideoPromptLoading: false };
        return { ...story, scenes: newScenes };
      }));
      setError(err instanceof Error ? err.message : t('errorVideoPrompt'));
    }
  }, [storyHistory, activeStoryIndex, character1, character2, artStyle, language, t]);

  const handleOpenEditModal = (sceneIndex: number) => {
    setEditingSceneIndex(sceneIndex);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingSceneIndex(null);
  };

  const handleEditImage = async (editPrompt: string) => {
    if (activeStoryIndex === null || editingSceneIndex === null || !character1 || !editPrompt) return;
    const currentStory = storyHistory[activeStoryIndex];
    if (!currentStory || !currentStory.scenes[editingSceneIndex].image) return;

    setIsEditingImage(true);
    setError(null);

    try {
      const sceneToEdit = currentStory.scenes[editingSceneIndex];
      const character1Part = await fileToGenerativePart(character1);
      const character2Part = character2 ? await fileToGenerativePart(character2) : null;

      const newImage = await editImage(
        sceneToEdit.image,
        editPrompt,
        character1Part,
        character2Part,
      );

      setStoryHistory(prev => prev.map((story, index) => {
        if (index !== activeStoryIndex) return story;
        const newScenes = [...story.scenes];
        newScenes[editingSceneIndex].image = newImage;
        return { ...story, scenes: newScenes };
      }));

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t('errorEditImage'));
    } finally {
      setIsEditingImage(false);
      handleCloseEditModal();
    }
  };


  const sceneCountNum = parseInt(sceneCount, 10);
  const isSceneCountInvalid = isNaN(sceneCountNum) || sceneCountNum < 2 || sceneCountNum > 100;
  
  const getLoadingMessage = () => {
    switch (generationStep) {
      case 1: return t('loadingMessage1');
      case 2: return t('loadingMessage2');
      case 3: return t('loadingMessage3', illustrationProgress?.current || 0, illustrationProgress?.total || 0);
      case 4: return t('loadingMessage4');
      default: return t('generating');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-6xl">
        <header className="relative text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            {t('appTitle')}
          </h1>
          <p className="text-lg text-gray-400 mt-2">
            {t('appSubtitle')}
          </p>
          <div className="absolute top-0 right-0 flex space-x-2">
            <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-sm rounded-md ${language === 'en' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}>EN</button>
            <button onClick={() => setLanguage('id')} className={`px-3 py-1 text-sm rounded-md ${language === 'id' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}>ID</button>
          </div>
        </header>

        <main>
          <div className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 sm:p-8 border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <ImageUploader
                id="char1"
                title={t('character1Title')}
                onFileChange={setCharacter1}
              />
              <ImageUploader
                id="char2"
                title={t('character2Title')}
                onFileChange={setCharacter2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8 mb-8">
               <div className="lg:col-span-1 xl:col-span-1">
                <h3 className="text-lg font-semibold text-gray-300 mb-3 text-center">{t('aspectRatioTitle')}</h3>
                <div className="flex justify-center gap-4 bg-gray-900/50 p-2 rounded-lg">
                  {[
                    { value: '16:9', label: t('landscape_wide') },
                    { value: '9:16', label: t('portrait_tall') },
                  ].map(ratio => (
                    <label key={ratio.value} className={`flex-1 text-center cursor-pointer px-4 py-2 text-sm font-medium rounded-md transition-colors ${aspectRatio === ratio.value ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-700 hover:bg-gray-600'}`}>
                      <input
                        type="radio"
                        name="aspect-ratio"
                        value={ratio.value}
                        checked={aspectRatio === ratio.value}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="sr-only"
                      />
                      {ratio.label}
                    </label>
                  ))}
                </div>
               </div>
              <div className="lg:col-span-1 xl:col-span-1">
                <h3 className="text-lg font-semibold text-gray-300 mb-3 text-center">{t('artStyleTitle')}</h3>
                <div className="flex justify-center gap-4 bg-gray-900/50 p-2 rounded-lg">
                  {[
                    { value: '2d', label: t('style2d') },
                    { value: '3d', label: t('style3d') },
                    { value: 'realistic', label: t('styleRealistic') },
                  ].map(style => (
                    <label key={style.value} className={`flex-1 text-center cursor-pointer px-4 py-2 text-sm font-medium rounded-md transition-colors ${artStyle === style.value ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-700 hover:bg-gray-600'}`}>
                      <input
                        type="radio"
                        name="art-style"
                        value={style.value}
                        checked={artStyle === style.value}
                        onChange={(e) => setArtStyle(e.target.value)}
                        className="sr-only"
                      />
                      {style.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-1 xl:col-span-1">
                <h3 className="text-lg font-semibold text-gray-300 mb-3 text-center">{t('sceneCountTitle')}</h3>
                <div className="flex justify-center bg-gray-900/50 p-2 rounded-lg h-[42px]">
                     <input
                        type="number"
                        min="2"
                        max="100"
                        value={sceneCount}
                        onChange={(e) => setSceneCount(e.target.value)}
                        onBlur={() => {
                          const num = parseInt(sceneCount, 10);
                          if (isNaN(num) || num < 2) {
                            setSceneCount('2');
                          } else if (num > 100) {
                            setSceneCount('100');
                          }
                        }}
                        className="w-full bg-gray-700 text-white text-center rounded-md border-gray-600 focus:ring-indigo-500 focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        aria-label={t('sceneCountTitle')}
                    />
                </div>
              </div>
               <div className="lg:col-span-1 xl:col-span-1">
                <h3 className="text-lg font-semibold text-gray-300 mb-3 text-center">{t('storyModeTitle')}</h3>
                <div className="flex justify-center gap-4 bg-gray-900/50 p-2 rounded-lg">
                  {[
                    { value: 'conclude', label: t('storyModeConclude') },
                    { value: 'extend', label: t('storyModeExtend') },
                  ].map(mode => (
                    <label key={mode.value} className={`flex-1 text-center cursor-pointer px-4 py-2 text-sm font-medium rounded-md transition-colors ${storyMode === mode.value ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-700 hover:bg-gray-600'}`}>
                      <input
                        type="radio"
                        name="story-mode"
                        value={mode.value}
                        checked={storyMode === mode.value}
                        onChange={(e) => setStoryMode(e.target.value as 'conclude' | 'extend')}
                        className="sr-only"
                      />
                      {mode.label}
                    </label>
                  ))}
                </div>
               </div>
               <div className="lg:col-span-2 xl:col-span-1">
                <h3 className="text-lg font-semibold text-gray-300 mb-3 text-center">{t('storyVersionsTitle')}</h3>
                <div className="flex justify-center bg-gray-900/50 p-2 rounded-lg h-[42px]">
                    <select
                        value={storyVersions}
                        onChange={(e) => setStoryVersions(Number(e.target.value))}
                        className="w-full bg-gray-700 text-white text-center rounded-md border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                        aria-label={t('storyVersionsTitle')}
                        disabled={isLoading || !!continuationMode}
                    >
                        <option value={1}>{t('oneVersion')}</option>
                        <option value={6}>{t('sixVersions')}</option>
                    </select>
                </div>
               </div>
            </div>
            
            <div className="text-center">
              <button
                onClick={handleGenerate}
                disabled={isLoading || !!continuationMode || !character1 || isSceneCountInvalid}
                className="inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 disabled:bg-indigo-900 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {getLoadingMessage()}
                  </>
                ) : (
                  <>
                    <WandIcon className="w-6 h-6 mr-2" />
                    {t('generateStory')}
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-8 bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center" role="alert">
              <strong className="font-bold">{t('errorTitle')} </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          
          {storyHistory.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2 border-b-2 border-gray-700 pb-4 mb-4">
              {storyHistory.map((story, index) => (
                <button
                  key={story.id}
                  onClick={() => setActiveStoryIndex(index)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                    index === activeStoryIndex
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {story.isLoading && story.scenes.length === 0 && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span className="truncate max-w-[200px] sm:max-w-xs">{story.title}</span>
                </button>
              ))}
            </div>
          )}

          {activeStory?.isLoading && activeStory?.scenes.length === 0 && (
            <div className="mt-12">
              <GenerationProgress
                currentStep={generationStep}
                progress={illustrationProgress}
              />
            </div>
          )}

          {activeStory && !(activeStory.isLoading && activeStory.scenes.length === 0) && (
            <div className="mt-4">
              <StoryOutput 
                result={activeStory} 
                aspectRatio={aspectRatio} 
                onGenerateVideoPrompt={handleGenerateVideoPrompt} 
                onOpenEditModal={handleOpenEditModal}
                onContinueStory={handleContinueStory}
                onRegenerateImage={handleRegenerateImage}
                continuationMode={continuationMode}
                isGenerationDisabled={isLoading || !!continuationMode || !character1}
              />
            </div>
          )}

           {isEditModalOpen && editingSceneIndex !== null && activeStory && (
            <EditImageModal
              isOpen={isEditModalOpen}
              onClose={handleCloseEditModal}
              sceneImage={activeStory.scenes[editingSceneIndex].image}
              onGenerate={handleEditImage}
              isLoading={isEditingImage}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
