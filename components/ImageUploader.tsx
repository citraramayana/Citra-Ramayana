import React, { useState, useRef, ChangeEvent, useContext } from 'react';
import { UploadIcon, XCircleIcon } from './icons';
import { LanguageContext } from '../contexts/LanguageContext';

interface ImageUploaderProps {
  id: string;
  title: string;
  onFileChange: (file: File | null) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ id, title, onFileChange }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const langContext = useContext(LanguageContext);
  if (!langContext) {
    throw new Error('LanguageContext is not available');
  }
  const { t } = langContext;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      onFileChange(file);
    } else {
      setPreview(null);
      onFileChange(null);
    }
  };

  const handleRemoveImage = () => {
    setPreview(null);
    onFileChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <h3 className="text-lg font-semibold text-gray-300 mb-2">{title}</h3>
      <label
        htmlFor={id}
        className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700/50 hover:bg-gray-700 transition-colors"
      >
        {preview ? (
          <>
            <img src={preview} alt="Character preview" className="object-contain w-full h-full rounded-lg" />
            <button
              onClick={(e) => {
                e.preventDefault();
                handleRemoveImage();
              }}
              className="absolute top-2 right-2 p-1 bg-gray-800/80 rounded-full text-white hover:bg-red-600 transition-colors"
              aria-label="Remove image"
            >
              <XCircleIcon className="w-6 h-6" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-400 text-center">
            <UploadIcon className="w-10 h-10 mb-3" />
            <p className="mb-2 text-sm">
              <span className="font-semibold">{t('uploadClick')}</span> {t('uploadDrag')}
            </p>
            <p className="text-xs">{t('uploadFormats')}</p>
          </div>
        )}
        <input
          id={id}
          type="file"
          className="hidden"
          accept="image/png, image/jpeg, image/webp"
          onChange={handleFileChange}
          ref={fileInputRef}
        />
      </label>
    </div>
  );
};
