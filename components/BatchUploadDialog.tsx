import React, { useState, useRef } from 'react';
import { uploadFilesToStorage } from '../services/firebaseService';

interface BatchUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BatchUploadDialog: React.FC<BatchUploadDialogProps> = ({ isOpen, onClose }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragOverRef = useRef(false);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    
    const newFiles = Array.from(selectedFiles).filter(file => {
      const isValidType = ['image/png', 'image/jpeg'].includes(file.type);
      return isValidType;
    });
    
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = true;
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = false;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = false;
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setUploadedFiles([]);
    
    try {
      const urls = await uploadFilesToStorage(files, (fileName, progress) => {
        setUploadProgress(prev => ({ ...prev, [fileName]: progress }));
      });
      
      setUploadedFiles(urls);
      setFiles([]);
      setUploadProgress({});
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setUploadProgress({});
    setUploadedFiles([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        <div className="bg-blue-600 p-6 text-white">
          <h2 className="text-xl font-bold flex items-center">
            <i className="fas fa-cloud-upload-alt mr-3"></i>
            Batch Upload Images
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            Upload multiple PNG or JPG images to the newupload folder
          </p>
        </div>

        <div className="p-6">
          {uploadedFiles.length === 0 ? (
            <>
              {/* Drag and Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                  dragOverRef.current
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 hover:border-blue-400'
                }`}
              >
                <i className="fas fa-image text-4xl text-slate-400 mb-3 block"></i>
                <p className="text-slate-700 font-medium">Drag and drop images here</p>
                <p className="text-slate-500 text-sm">or click to select files</p>
                <p className="text-slate-400 text-xs mt-2">Supported: PNG, JPG</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />

              {/* File List */}
              {files.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-slate-700 mb-3">
                    Selected Files ({files.length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center flex-1 min-w-0">
                          <i className="fas fa-file-image text-blue-500 mr-3"></i>
                          <span className="text-sm text-slate-700 truncate">
                            {file.name}
                          </span>
                          <span className="text-xs text-slate-500 ml-2">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="ml-2 text-red-500 hover:text-red-700"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleUpload}
                  disabled={files.length === 0 || uploading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-lg transition"
                >
                  {uploading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-upload mr-2"></i>
                      Upload {files.length} File{files.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            /* Success State */
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                <i className="fas fa-check"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Upload Complete!
              </h3>
              <p className="text-slate-600 mb-6">
                {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} uploaded successfully
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

