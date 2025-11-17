

export interface Scene {
  paragraph: string;
  imagePrompt: string;
  image: string | null | undefined; // base64 image data, null if generation failed, undefined if loading
  videoPrompt?: string;
  isVideoPromptLoading?: boolean;
  isRegenerating?: boolean;
}

export interface StoryResult {
  id: number;
  title: string;
  scenes: Scene[];
  storyMode: 'conclude' | 'extend';
  isLoading?: boolean;
}

export interface StoryGenerationResponse {
  storyTitle: string;
  storyParagraphs: string[];
  imagePrompts: string[];
}