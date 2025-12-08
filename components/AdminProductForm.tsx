import React, { useState } from 'react';
import { Product } from '../types';
import { analyzeProductImage } from '../services/geminiService';
import { addProduct, updateProduct, uploadProductImage, deleteProductImage } from '../services/firebaseService';
import { useEffect, useRef } from 'react';

interface AdminProductFormProps {
  onClose: (saved?: boolean) => void;
  initialProduct?: Product;
  onSave?: () => void;
}

export const AdminProductForm: React.FC<AdminProductFormProps> = ({ onClose, initialProduct }) => {
  // ...existing code...
  const [name, setName] = useState(initialProduct?.name || '');
  const [description, setDescription] = useState(initialProduct?.description || '');
  const [wholesalePrice, setWholesalePrice] = useState(initialProduct?.wholesalePrice?.toString() || '');
  const [retailPrice, setRetailPrice] = useState(initialProduct?.retailPrice?.toString() || '');
  const [images, setImages] = useState<any[]>(initialProduct?.images || []);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploading(true);
      try {
        // Upload original image
        const bigURL = await uploadProductImage(file, initialProduct?.id);

        // Helper to generate resized blob by short edge
        const createResizedBlob = (file: File, SHORT_EDGE: number): Promise<Blob> => {
          return new Promise((resolve, reject) => {
            const img = new window.Image();
            const reader = new FileReader();
            reader.onload = (ev) => {
              img.onload = async () => {
                try {
                  const scale = SHORT_EDGE / Math.min(img.width, img.height);
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

        // Generate medium (short edge ~600) and small (~200)
        const MEDIUM_EDGE = 600;
        const SMALL_EDGE = 200;

        const mediumBlob = await createResizedBlob(file, MEDIUM_EDGE);
        const smallBlob = await createResizedBlob(file, SMALL_EDGE);

        const mediumFile = new File([mediumBlob], file.name.replace(/(\.[^.]+)$/, '_medium$1'), { type: 'image/jpeg' });
        const thumbFile = new File([smallBlob], file.name.replace(/(\.[^.]+)$/, '_small$1'), { type: 'image/jpeg' });

        const smallURL = await uploadProductImage(thumbFile, initialProduct?.id);
        const mediumURL = await uploadProductImage(mediumFile, initialProduct?.id);

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
          if (initialProduct) {
            updateProduct(initialProduct.id, { images: newImages });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const productData: any = {
        name,
        description,
        wholesalePrice: parseFloat(wholesalePrice),
        retailPrice: parseFloat(retailPrice),
        images,
        createdAt: initialProduct?.createdAt || Date.now(),
      };

      console.log("Saving product data:", productData);

      if (initialProduct) {
        console.log("Updating product:", initialProduct.id);
        await updateProduct(initialProduct.id, productData);
      }
      if (typeof onSave === 'function') onSave();
      console.log("Product saved successfully");
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
            {initialProduct ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={() => onClose(false)} className="text-slate-400 hover:text-slate-600">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Image Upload Section */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Product Images</label>
              <div className="flex flex-wrap gap-3">
                {images.map((imgObj, idx) => (
                  <div key={idx} className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 relative group">
                    <img src={imgObj.urls?.small || imgObj.urls?.big || imgObj.small || imgObj.big || imgObj} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={async () => {
                        // Delete from Storage if it's a Firebase URL (in edit mode)
                        const urlToDelete = imgObj.urls?.big || imgObj.urls?.small || imgObj.big || imgObj.small || imgObj;
                        if (initialProduct && urlToDelete && urlToDelete.includes('firebasestorage.googleapis.com')) {
                          await deleteProductImage(urlToDelete);
                        }
                        const newImages = images.filter((_, i) => i !== idx);
                        setImages(newImages);
                        // If editing an existing product, update images in Firestore immediately
                        if (initialProduct) {
                          await updateProduct(initialProduct.id, { images: newImages });
                        }
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
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
    </div>
  );
};