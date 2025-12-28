import React, { useState } from 'react';
import { Product } from '../types';
import { analyzeProductImage } from '../services/geminiService';
import { addProduct, updateProduct, uploadProductImage, deleteProductImage } from '../services/firebaseService';
import { useEffect, useRef } from 'react';

interface AdminProductFormProps {
  onClose: (saved?: boolean) => void;
  product?: Product;
  onSave?: () => void;
}

export const AdminProductForm: React.FC<AdminProductFormProps> = ({ onClose, product }) => {
  // ...existing code...
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [wholesalePrice, setWholesalePrice] = useState(product?.wholesalePrice?.toString() || '');
  const [retailPrice, setRetailPrice] = useState(product?.retailPrice?.toString() || '');
  const [images, setImages] = useState<any[]>(product?.images || []);
  const [hidden, setHidden] = useState<boolean>(!!product?.hidden);
  const [stock, setStock] = useState(product?.stock?.toString() || '1');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose(false);
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [onClose]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploading(true);
      try {
        // Helper to generate resized blob by short edge (will not upscale)
        const createResizedBlob = (file: File, SHORT_EDGE: number): Promise<Blob> => {
          return new Promise((resolve, reject) => {
            const img = new window.Image();
            const reader = new FileReader();
            reader.onload = (ev) => {
              img.onload = async () => {
                try {
                  // Do not upscale: use the smaller of requested SHORT_EDGE and the image's short edge
                  const imgShort = Math.min(img.width, img.height);
                  const useEdge = Math.min(SHORT_EDGE, imgShort);
                  const scale = useEdge / imgShort;
                  const targetW = Math.round(img.width * scale);
                  const targetH = Math.round(img.height * scale);

                  const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
                  const hiW = Math.round(targetW * ratio);
                  const hiH = Math.round(targetH * ratio);

                  const hiCanvas = document.createElement('canvas');
                  hiCanvas.width = hiW;
                  hiCanvas.height = hiH;
                  const hiCtx = hiCanvas.getContext('2d');
                  if (!hiCtx) return reject(new Error('Canvas context error'));
                  hiCtx.imageSmoothingEnabled = true;
                  hiCtx.imageSmoothingQuality = 'high';
                  hiCtx.drawImage(img, 0, 0, hiW, hiH);

                  const finalCanvas = document.createElement('canvas');
                  finalCanvas.width = targetW;
                  finalCanvas.height = targetH;
                  const fctx = finalCanvas.getContext('2d');
                  if (!fctx) return reject(new Error('Canvas context error'));
                  fctx.imageSmoothingEnabled = true;
                  fctx.imageSmoothingQuality = 'high';
                  fctx.drawImage(hiCanvas, 0, 0, targetW, targetH);

                  finalCanvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Resizing generation failed'));
                  }, 'image/jpeg', 0.95);
                } catch (err) {
                  reject(err);
                }
              };
              img.onerror = reject;
              img.src = ev.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        };

        // Generate medium (short edge ~600), small (~200), and big (short edge up to 2000 but not upscaled)
        const MEDIUM_EDGE = 600;
        const SMALL_EDGE = 200;
        const BIG_EDGE = 2000;

        // Generate blobs
        const mediumBlob = await createResizedBlob(file, MEDIUM_EDGE);
        const smallBlob = await createResizedBlob(file, SMALL_EDGE);
        const bigBlob = await createResizedBlob(file, BIG_EDGE);

        // Create files with suffixes
        const mediumFile = new File([mediumBlob], file.name.replace(/(\.[^.]+)$/, '_medium$1'), { type: 'image/jpeg' });
        const thumbFile = new File([smallBlob], file.name.replace(/(\.[^.]+)$/, '_small$1'), { type: 'image/jpeg' });
        const bigFile = new File([bigBlob], file.name.replace(/(\.[^.]+)$/, '_big$1'), { type: 'image/jpeg' });

        // Upload medium first (hero), then small (thumbnails), then big (full-size)
        const mediumURL = await uploadProductImage(mediumFile, product?.id);
        const smallURL = await uploadProductImage(thumbFile, product?.id);
        const bigURL = await uploadProductImage(bigFile, product?.id);

        const imageObj = {
          name: file.name,
          urls: {
            small: smallURL,
            medium: mediumURL,
            big: bigURL
          }
        };

        setImages(prev => {
          const newImages = [...prev, imageObj];
          if (product) {
            updateProduct(product.id, { images: newImages });
          }
          return newImages;
        });

        // Trigger Gemini Analysis using base64 for analysis only
        if (name === '' && !analyzing) {
          setAnalyzing(true);
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64 = reader.result as string;
              const pureBase64 = base64.split(',')[1];
              const analysis = await analyzeProductImage(pureBase64);
              if (analysis.name) setName(analysis.name);
              if (analysis.description) setDescription(analysis.description);
              if (analysis.retailPriceEstimate) setRetailPrice(analysis.retailPriceEstimate.toString());
            } finally {
              setAnalyzing(false);
            }
          };
          reader.readAsDataURL(file);
        }
      } catch (err) {
        console.error("Failed to upload image:", err);
        alert("Failed to upload image. Please try again.");
      } finally {
        setUploading(false);
      }
    }
  };

  const handleMoveImage = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return;

    const newImages = [...images];
    const [movedImage] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, movedImage);

    setImages(newImages);

    // Update in Firestore immediately if editing
    if (product) {
      await updateProduct(product.id, { images: newImages });
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }
    
    await handleMoveImage(draggedIndex, dropIndex);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const productData: any = {
        name,
        description,
        wholesalePrice: parseFloat(wholesalePrice),
        retailPrice: parseFloat(retailPrice),
        stock: Number.parseInt(stock) || 1,
        images,
        createdAt: product?.createdAt || Date.now(),
        hidden: !!hidden,
      };


      if (product) {
        console.log("Updating product:", product.id);
        await updateProduct(product.id, productData);
      }

      onClose(true);
    } catch (err) {
      console.error("Failed to save product:", err);
      alert("Failed to save product: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={() => onClose(false)} className="text-slate-400 hover:text-slate-600">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Product ID (readonly) */}
            {product && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Product ID</p>
                  <p className="text-sm text-slate-700 font-mono break-all">{product.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(product.id);
                  }}
                  className="flex-shrink-0 p-2 hover:bg-slate-200 rounded-lg transition text-slate-600 hover:text-slate-800"
                  title="Copy Product ID"
                >
                  <i className="fas fa-copy text-lg"></i>
                </button>
              </div>
            )}

            {/* Image Upload Section */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Product Images</label>
              <div className="flex flex-wrap gap-3">
                {images.map((imgObj, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 relative group cursor-move ${
                      draggedIndex === idx ? 'opacity-50 border-blue-500' : 'border-slate-200'
                    }`}
                  >
                    {/* Image number badge */}
                    <div className="absolute top-1 left-1 bg-black/70 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold z-10">
                      {idx + 1}
                    </div>
                    
                    <img
                      src={imgObj.urls?.small || imgObj.urls?.big || imgObj.small || imgObj.big || imgObj}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Reorder buttons */}
                    <div className="absolute bottom-1 left-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleMoveImage(idx, idx - 1)}
                          className="flex-1 bg-blue-500 text-white rounded text-xs py-0.5 hover:bg-blue-600"
                          title="Move left"
                        >
                          <i className="fas fa-chevron-left"></i>
                        </button>
                      )}
                      {idx < images.length - 1 && (
                        <button
                          type="button"
                          onClick={() => handleMoveImage(idx, idx + 1)}
                          className="flex-1 bg-blue-500 text-white rounded text-xs py-0.5 hover:bg-blue-600"
                          title="Move right"
                        >
                          <i className="fas fa-chevron-right"></i>
                        </button>
                      )}
                    </div>
                    
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmIndex(idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10 hover:bg-red-600"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
                <label className={`w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition text-slate-400 hover:text-blue-500 ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                  {uploading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mb-1"></i>
                      <span className="text-[10px] font-bold">Uploading</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-camera mb-1"></i>
                      <span className="text-[10px] font-bold">Add</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
              </div>
              {images.length > 1 && (
                <p className="mt-2 text-xs text-slate-500">
                  <i className="fas fa-arrows-alt mr-1"></i>
                  Drag thumbnails to reorder, or use arrow buttons on hover
                </p>
              )}
              {uploading && (
                <div className="mt-2 text-blue-600 text-sm flex items-center animate-pulse">
                  <i className="fas fa-cloud-upload-alt mr-2"></i> Uploading image...
                </div>
              )}
              {analyzing && (
                <div className="mt-2 text-blue-600 text-sm flex items-center animate-pulse">
                  <i className="fas fa-magic mr-2"></i> Gemini is analyzing image...
                </div>
              )}
            </div>

            {/* Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Wholesale Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Retail Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                />
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Amount</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                  />
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                />
              </div>
            </div>

            <div className="mt-2">
              <label className="inline-flex items-center">
                <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="mr-2" />
                <span className="text-sm text-slate-700">Hide from public feed</span>
              </label>
              <p className="text-xs text-slate-400 mt-1">Hidden products are not visible in the public feed but remain visible in Admin view.</p>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="mr-3 px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md transition"
              >
                {saving ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <i className="fas fa-exclamation-triangle text-red-600 text-xl"></i>
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
                Delete Image?
              </h3>
              <p className="text-slate-600 text-center mb-6">
                This will permanently delete the image and all its sizes from storage. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmIndex(null)}
                  className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      const imgObj = images[deleteConfirmIndex];
                      // Delete all 3 sizes from Storage if they're Firebase URLs
                      if (product && imgObj.urls) {
                        const urlsToDelete = [imgObj.urls.small, imgObj.urls.medium, imgObj.urls.big].filter(
                          url => url && url.includes('firebasestorage.googleapis.com')
                        );
                        for (const url of urlsToDelete) {
                          await deleteProductImage(url);
                        }
                      }
                      const newImages = images.filter((_, i) => i !== deleteConfirmIndex);
                      setImages(newImages);
                      // If editing an existing product, update images in Firestore immediately
                      if (product) {
                        await updateProduct(product.id, { images: newImages });
                      }
                      setDeleteConfirmIndex(null);
                    } catch (err) {
                      console.error('Failed to delete image:', err);
                      alert('Failed to delete image. Please try again.');
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};