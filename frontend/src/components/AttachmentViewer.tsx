import React, { useState } from 'react';

interface AttachmentViewerProps {
  attachments: string[];
  title: string;
  stage: string;
}

export default function AttachmentViewer({ attachments, title, stage }: AttachmentViewerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const openImageModal = (imagePath: string) => {
    setSelectedImage(imagePath);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedImage(null);
  };

  const getFileType = (path: string) => {
    const extension = path.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return 'image';
    } else if (['mp4', 'webm', 'ogg'].includes(extension || '')) {
      return 'video';
    }
    return 'file';
  };

  const getFileName = (path: string) => {
    return path.split('/').pop() || path;
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {attachments.length} file{attachments.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {attachments.map((attachment, index) => {
          const fileType = getFileType(attachment);
          const fileName = getFileName(attachment);
          
          return (
            <div key={index} className="relative group">
              {fileType === 'image' ? (
                <div
                  className="aspect-square rounded-lg overflow-hidden cursor-pointer border-2 border-gray-200 hover:border-blue-400 transition-all duration-200"
                  onClick={() => openImageModal(attachment)}
                >
                  <img
                    src={`http://localhost:3001${attachment}`}
                    alt={fileName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/api/placeholder/image';
                    }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                </div>
              ) : fileType === 'video' ? (
                <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-all duration-200">
                  <video
                    className="w-full h-full object-cover"
                    controls
                    src={`http://localhost:3001${attachment}`}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : (
                <a
                  href={`http://localhost:3001${attachment}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all duration-200 flex flex-col items-center justify-center p-2 text-center"
                >
                  <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-xs text-gray-600 truncate w-full">{fileName}</span>
                </a>
              )}
              
              <div className="absolute top-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded">
                {fileType === 'image' ? 'IMG' : fileType === 'video' ? 'VID' : 'FILE'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Modal */}
      {isModalOpen && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={closeModal}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={`http://localhost:3001${selectedImage}`}
              alt="Preview"
              className="max-w-full max-h-full rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
