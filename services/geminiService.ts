
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { StoryResult, StoryGenerationResponse, Scene } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const parseAndValidateStoryResponse = (responseText: string): StoryGenerationResponse => {
  try {
    const jsonText = responseText.trim();
    const parsed = JSON.parse(jsonText);
    
    if (!parsed.storyParagraphs || !Array.isArray(parsed.storyParagraphs) || !parsed.imagePrompts || !Array.isArray(parsed.imagePrompts)) {
        throw new Error("AI response was malformed and is missing required story data.");
    }
    
    const paragraphsCount = parsed.storyParagraphs.length;
    const promptsCount = parsed.imagePrompts.length;

    if (paragraphsCount === 0 || promptsCount === 0) {
        throw new Error("AI generated an empty story. Please try again.");
    }

    if (paragraphsCount !== promptsCount) {
        console.warn(`Mismatch in generated content: ${paragraphsCount} paragraphs and ${promptsCount} prompts. Trimming to the smaller count.`);
        const minCount = Math.min(paragraphsCount, promptsCount);
        parsed.storyParagraphs = parsed.storyParagraphs.slice(0, minCount);
        parsed.imagePrompts = parsed.imagePrompts.slice(0, minCount);
    }
    
    return parsed;
  } catch (e) {
    console.error("Failed to parse JSON response:", responseText, e);
    if (e instanceof Error) {
        if (e.message.startsWith("AI response was malformed") || e.message.startsWith("AI generated an empty story")) {
            throw e;
        }
        throw new Error("Could not understand the story structure from the AI. Please check the console for details.");
    }
    throw new Error("An unknown error occurred while processing the story. Please try again.");
  }
};


const generateStoryAndPrompts = async (
  character1Part: { inlineData: { data: string; mimeType: string; } },
  character2Part: { inlineData: { data: string; mimeType: string; } } | null,
  language: string,
  artStyle: string,
  sceneCount: number,
  storyMode: 'conclude' | 'extend'
): Promise<StoryGenerationResponse> => {
  const characterPrompt = character2Part
    ? "There are two main characters in this story, based on the two images provided."
    : "There is one main character in this story, based on the image provided.";
  
  const languageInstruction = `Generate the entire JSON response (storyTitle, storyParagraphs, and imagePrompts) in ${language === 'id' ? 'Indonesian' : 'English'}.`;
  
  const artStyleDescriptionMap: { [key: string]: string } = {
    '2d': "vibrant and whimsical 2D digital illustration, children's storybook style, flat colors, clear outlines",
    '3d': "charming 3D render, Pixar-like animation style, soft lighting, detailed textures, cinematic",
    'realistic': "photorealistic, cinematic, dramatic lighting, high detail, 8k, like a still from a live-action movie",
  };
  const artStyleInstruction = artStyleDescriptionMap[artStyle] || artStyleDescriptionMap['2d'];

  const endingInstruction = storyMode === 'conclude'
    ? "The story must have a clear beginning, middle, and end."
    : "The story must end with an open-ended cliffhanger, suggesting the story is not over.";

  const prompt = `
    Based on the character(s) in the provided image(s), generate a short story suitable for a children's book. The story must consist of exactly ${sceneCount} paragraphs.
    ${endingInstruction}
    ${characterPrompt}
    Also, create a corresponding image prompt for each of the ${sceneCount} paragraphs. These prompts will be used to generate illustrations.
    The art style for the image prompts should be '${artStyleInstruction}'.
    ${languageInstruction}
    Return the result as a single JSON object. It is crucial that the 'storyParagraphs' and 'imagePrompts' arrays in your JSON response each contain exactly ${sceneCount} items. Do not include any markdown formatting like \`\`\`json.
  `;

  const contents: any[] = [{ text: prompt }, character1Part];
  if (character2Part) {
    contents.push(character2Part);
  }

  const systemInstruction = `You are a creative assistant that generates children's stories and corresponding image prompts based on user-provided character images. You must strictly follow all formatting and length requirements given in the user's prompt, especially the number of paragraphs and image prompts. Your output must be a single, valid JSON object without any markdown formatting.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [{ parts: contents }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          storyTitle: { type: Type.STRING },
          storyParagraphs: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          imagePrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["storyTitle", "storyParagraphs", "imagePrompts"],
      },
    },
  });

  return parseAndValidateStoryResponse(response.text);
};

const continueStoryAndPrompts = async (
  existingParagraphs: string[],
  character1Part: { inlineData: { data: string; mimeType: string; } },
  character2Part: { inlineData: { data: string; mimeType: string; } } | null,
  language: string,
  artStyle: string,
  sceneCount: number,
  storyMode: 'conclude' | 'extend'
): Promise<Omit<StoryGenerationResponse, 'storyTitle'>> => {
  const languageInstruction = `Generate the entire JSON response (storyParagraphs and imagePrompts) in ${language === 'id' ? 'Indonesian' : 'English'}.`;
  
  const artStyleDescriptionMap: { [key: string]: string } = {
    '2d': "vibrant and whimsical 2D digital illustration, children's storybook style, flat colors, clear outlines",
    '3d': "charming 3D render, Pixar-like animation style, soft lighting, detailed textures, cinematic",
    'realistic': "photorealistic, cinematic, dramatic lighting, high detail, 8k, like a still from a live-action movie",
  };
  const artStyleInstruction = artStyleDescriptionMap[artStyle] || artStyleDescriptionMap['2d'];

  const endingInstruction = storyMode === 'conclude'
    ? "This new part of the story must provide a definitive and satisfying conclusion to the entire narrative."
    : "This new part of the story must also end on an open-ended cliffhanger, continuing the suspense.";

  const storySoFar = existingParagraphs.map((p, i) => `Paragraph ${i+1}: ${p}`).join('\n');

  const prompt = `
    This is a continuation of an existing story.
    Here is the story so far:
    ---
    ${storySoFar}
    ---
    Based on the provided character(s) and the story so far, please continue the narrative by writing exactly ${sceneCount} new paragraphs.
    The new part of the story should seamlessly follow the previous events.
    ${endingInstruction}
    Also, create a corresponding image prompt for each of the ${sceneCount} new paragraphs. These prompts will be used to generate illustrations.
    The art style for the image prompts should be '${artStyleInstruction}'.
    ${languageInstruction}
    Return the result as a single JSON object with "storyParagraphs" and "imagePrompts" keys. It is crucial that both arrays in your JSON response each contain exactly ${sceneCount} items. Do not include any markdown formatting like \`\`\`json.
  `;
  
  const contents: any[] = [{ text: prompt }, character1Part];
  if (character2Part) {
    contents.push(character2Part);
  }

  const systemInstruction = `You are a creative assistant that continues children's stories based on the existing text and character images. You must strictly follow all formatting and length requirements given in the user's prompt. Your output must be a single, valid JSON object without any markdown formatting.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [{ parts: contents }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          storyParagraphs: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          imagePrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["storyParagraphs", "imagePrompts"],
      },
    },
  });

  // We don't need storyTitle from this response, but we can reuse the validation logic
  const parsed = parseAndValidateStoryResponse(response.text);
  return {
    storyParagraphs: parsed.storyParagraphs,
    imagePrompts: parsed.imagePrompts,
  };
};


export const generateImage = async (
  prompt: string,
  character1Part: { inlineData: { data: string; mimeType: string; } },
  character2Part: { inlineData: { data: string; mimeType: string; } } | null,
  aspectRatio: string,
): Promise<string> => {
    
  const ratioDescriptionMap: { [key: string]: string } = {
    '16:9': 'a landscape (16:9) aspect ratio',
    '9:16': 'a portrait (9:16) aspect ratio',
  };
  const ratioInstruction = ratioDescriptionMap[aspectRatio] || ratioDescriptionMap['16:9'];

  const characterReferencePrompt = `
    The character(s) in the image should be consistent with the character(s) in the provided reference image(s).
    The generated image must have ${ratioInstruction}.
  `;

  const fullPrompt = `${prompt}. ${characterReferencePrompt}`;

  const parts = [{ text: fullPrompt }, character1Part];
  if (character2Part) {
    parts.push(character2Part);
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Image generation failed, no image data received.");
};


export const generateStoryAndImages = async (
  character1File: File,
  character2File: File | null,
  updateProgress: (step: number, progress?: { current: number; total: number }) => void,
  language: string,
  aspectRatio: string,
  artStyle: string,
  sceneCount: number,
  storyMode: 'conclude' | 'extend',
  onStoryGenerated: (data: { title: string; paragraphs: string[]; imagePrompts: string[] }) => void,
  onImageGenerated: (image: string | null, index: number) => void,
): Promise<void> => {
    
  const character1Part = await fileToGenerativePart(character1File);
  const character2Part = character2File ? await fileToGenerativePart(character2File) : null;
  
  updateProgress(1);
  const { storyTitle, storyParagraphs, imagePrompts } = await generateStoryAndPrompts(character1Part, character2Part, language, artStyle, sceneCount, storyMode);
  
  onStoryGenerated({ title: storyTitle, paragraphs: storyParagraphs, imagePrompts });
  
  updateProgress(2);
  updateProgress(3, { current: 0, total: imagePrompts.length });

  let failedImageCount = 0;
  for (let i = 0; i < imagePrompts.length; i++) {
    const prompt = imagePrompts[i];
    let image: string | null = null;
    try {
      image = await generateImage(prompt, character1Part, character2Part, aspectRatio)
        .catch(async (err) => {
            console.warn(`Initial image generation failed for prompt "${prompt}". Retrying in 1s...`, err);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return generateImage(prompt, character1Part, character2Part, aspectRatio);
        });
    } catch (err) {
      console.error(`Error generating image for prompt "${prompt}" after retry.`, err);
      failedImageCount++;
    }
    onImageGenerated(image, i);
    updateProgress(3, { current: i + 1, total: imagePrompts.length });
  }

  if (failedImageCount > 0 && failedImageCount === imagePrompts.length) {
      throw new Error("Failed to generate any images. This could be due to API restrictions or a network issue. Please try again.");
  }

  updateProgress(4);
};

export const continueStoryAndImages = async (
  existingStory: StoryResult,
  character1File: File,
  character2File: File | null,
  updateProgress: (step: number, progress?: { current: number; total: number }) => void,
  language: string,
  aspectRatio: string,
  artStyle: string,
  sceneCount: number,
  newStoryMode: 'conclude' | 'extend',
  onNewStoryPartsGenerated: (data: { paragraphs: string[]; imagePrompts: string[] }) => void,
  onNewImageGenerated: (image: string | null, index: number) => void,
): Promise<void> => {
  const character1Part = await fileToGenerativePart(character1File);
  const character2Part = character2File ? await fileToGenerativePart(character2File) : null;
  
  updateProgress(1);
  const existingParagraphs = existingStory.scenes.map(s => s.paragraph);
  const { storyParagraphs, imagePrompts } = await continueStoryAndPrompts(
    existingParagraphs, 
    character1Part, 
    character2Part, 
    language, 
    artStyle, 
    sceneCount, 
    newStoryMode
  );
  
  onNewStoryPartsGenerated({ paragraphs: storyParagraphs, imagePrompts });
  
  updateProgress(2);
  updateProgress(3, { current: 0, total: imagePrompts.length });

  let failedImageCount = 0;
  for (let i = 0; i < imagePrompts.length; i++) {
    const prompt = imagePrompts[i];
    let image: string | null = null;
    try {
      image = await generateImage(prompt, character1Part, character2Part, aspectRatio)
        .catch(async (err) => {
            console.warn(`Initial image generation failed for prompt "${prompt}". Retrying in 1s...`, err);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return generateImage(prompt, character1Part, character2Part, aspectRatio);
        });
    } catch (err) {
      console.error(`Error generating image for prompt "${prompt}" after retry.`, err);
      failedImageCount++;
    }
    onNewImageGenerated(image, i);
    updateProgress(3, { current: i + 1, total: imagePrompts.length });
  }

  if (failedImageCount > 0 && failedImageCount === imagePrompts.length) {
      throw new Error("Failed to generate any new images. Please try again.");
  }
  
  updateProgress(4);
};

export const generateVideoPrompt = async (
  paragraph: string,
  image: string, // base64 data URL
  character1File: File,
  character2File: File | null,
  artStyle: string,
  language: string
): Promise<string> => {
  const character1Part = await fileToGenerativePart(character1File);
  const character2Part = character2File ? await fileToGenerativePart(character2File) : null;
  
  const imagePart = {
    inlineData: {
      data: image.split(',')[1],
      mimeType: image.match(/data:(.*);/)?.[1] || 'image/png',
    }
  };

  const artStyleDescriptionMap: { [key: string]: string } = {
    '2d': "vibrant and whimsical 2D animation",
    '3d': "charming 3D animation, Pixar-like style",
    'realistic': "photorealistic, cinematic, live-action style",
  };
  const artStyleInstruction = artStyleDescriptionMap[artStyle] || artStyleDescriptionMap['2d'];

  const languageInstruction = `The generated prompt must be in ${language === 'id' ? 'Indonesian' : 'English'}.`;

  const prompt = `
    Analyze the provided image and the story paragraph. Based on them, create a concise, dynamic, and descriptive text-to-video prompt.
    The prompt should describe a short video clip (around 3-5 seconds) that brings this scene to life.
    Focus on actions, camera movement, and character expressions.
    Do not just repeat the paragraph. Instead, translate the static scene into a moving picture.
    The video style should be: ${artStyleInstruction}.
    
    Story Paragraph: "${paragraph}"

    The final output should be only the video prompt text, nothing else.
    ${languageInstruction}
  `;

  const contents: any[] = [
      { text: prompt },
      imagePart,
      character1Part
  ];
  if (character2Part) {
      contents.push(character2Part);
  }

  const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: contents }],
  });

  return response.text.trim();
};

export const editImage = async (
  baseImage: string, // base64 data URL
  prompt: string,
  character1Part: { inlineData: { data: string; mimeType: string; } },
  character2Part: { inlineData: { data: string; mimeType: string; } } | null,
): Promise<string> => {
  const imagePart = {
    inlineData: {
      data: baseImage.split(',')[1],
      mimeType: baseImage.match(/data:(.*);/)?.[1] || 'image/png',
    }
  };

  const fullPrompt = `Based on the provided reference character image(s) and the scene image, edit the scene image according to this instruction: "${prompt}". Maintain the original art style and character designs as closely as possible, only applying the requested change.`;
  
  const parts = [
    { text: fullPrompt }, 
    imagePart,
    character1Part,
  ];
  if (character2Part) {
    parts.push(character2Part);
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Image editing failed, no image data received.");
};
