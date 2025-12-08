import React, { useState } from 'react';
import { Product } from '../types';
import { analyzeProductImage } from '../services/geminiService';
import { addProduct, updateProduct, uploadProductImage } from '../services/firebaseService';

interface AdminProductFormProps {
  onClose: () => void;
  initialProduct?: Product;
}

export const AdminProductForm: React.FC<AdminProductFormProps> = ({ onClose, initialProduct }) => {
  const [name, setName] = useState(initialProduct?.name || '');
  const [description, setDescription] = useState(initialProduct?.description || '');
  const [wholesalePrice, setWholesalePrice] = useState(initialProduct?.wholesalePrice?.toString() || '');
  const [retailPrice, setRetailPrice] = useState(initialProduct?.retailPrice?.toString() || '');
  const [images, setImages] = useState<string[]>(initialProduct?.images || []);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploading(true);
      
      try {
        // Upload to Firebase Storage
        const downloadURL = await uploadProductImage(file, initialProduct?.id);
        setImages(prev => [...prev, downloadURL]);
        
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
      const productData = {
        name,
        description,
        wholesalePrice: parseFloat(wholesalePrice),
        retailPrice: parseFloat(retailPrice),
        images,
        createdAt: initialProduct ? initialProduct.createdAt : Date.now()
      };

      if (initialProduct) {
        await updateProduct(initialProduct.id, productData);
      } else {
        await addProduct(productData);
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save product");
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Image Upload Section */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Product Images</label>
              <div className="flex flex-wrap gap-3">
                {images.map((img, idx) => (
                  <div key={idx} className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 relative group">
                    <img src={img} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => setImages(images.filter((_, i) => i !== idx))}
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
                onClick={onClose}
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