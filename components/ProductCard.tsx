import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onToggleSelect: (product: Product) => void;
  isAdmin: boolean;
  onEdit?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  isSelected, 
  onToggleSelect, 
  isAdmin,
  onEdit
}) => {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalImage, setModalImage] = React.useState<string | null>(null);

  // ESC key handler for modal
  React.useEffect(() => {
    if (!modalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [modalOpen]);

  return (
    <div 
      className={`relative group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border-2 ${isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-transparent'}`}
      onClick={() => !isAdmin && onToggleSelect(product)}
    >
      {/* Image Section */}
      <div className="aspect-square bg-slate-100 relative overflow-hidden">
        {product.images && product.images.length > 0 ? (
          <img 
            src={product.images[0].urls.big} 
            alt={product.name} 
            className="w-full h-full object-cover cursor-pointer"
            onClick={e => {
              if (!isAdmin) {
                e.stopPropagation();
                setModalImage(product.images[0].urls.big);
                setModalOpen(true);
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <i className="fas fa-image text-4xl"></i>
          </div>
        )}
        {/* Selection Indicator Overlay */}
        {!isAdmin && (
          <div className={`absolute top-3 right-3 w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 text-white' : 'bg-white/80 text-slate-400 hover:bg-white'}`}>
            <i className={`fas ${isSelected ? 'fa-check' : 'fa-plus'} text-lg`}></i>
          </div>
        )}
      </div>
      {/* Thumbnails Row (non-admin mode) */}
      {product.images && (
        <div className="flex gap-2 px-4 py-2 bg-transparent">
          {product.images.map((imgObj, idx) => (
            imgObj.urls.small ? (
              <img
                key={idx}
                src={imgObj.urls.small}
                alt={`Thumbnail ${idx + 1}`}
                className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white shadow cursor-pointer"
                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}
                onClick={e => {
                  e.stopPropagation();
                  setModalImage(imgObj.urls.big);
                  setModalOpen(true);
                }}
              />
            ) : null
          ))}
        </div>
      )}
      {/* Full Size Image Modal */}
      {modalOpen && modalImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <img src={modalImage} alt="Full Size" className="max-w-[90vw] max-h-[80vh] rounded-xl shadow-2xl" />
            <button
              className="absolute top-2 right-2 bg-white/80 hover:bg-white text-slate-700 rounded-full w-10 h-10 flex items-center justify-center shadow-lg"
              onClick={() => setModalOpen(false)}
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-slate-800 text-lg leading-tight">{product.name}</h3>
        </div>
        
        <p className="text-slate-500 text-sm line-clamp-2 mb-4 h-10">{product.description}</p>

        <div className="flex justify-between items-end border-t pt-3 border-slate-100">
          <div>
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Retail</p>
            <p className="text-slate-600 font-medium">${typeof product.retailPrice === 'number' ? product.retailPrice.toFixed(2) : '0.00'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-600 uppercase font-bold tracking-wider">Wholesale</p>
            <p className="text-xl text-blue-700 font-bold">${typeof product.wholesalePrice === 'number' ? product.wholesalePrice.toFixed(2) : '0.00'}</p>
          </div>
        </div>

        {isAdmin && onEdit && (
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(product); }}
            className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
          >
            <i className="fas fa-edit mr-2"></i> Edit Product
          </button>
        )}
      </div>
    </div>
  );
};