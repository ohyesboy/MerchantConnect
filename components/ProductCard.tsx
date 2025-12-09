
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
  const [modalIndex, setModalIndex] = React.useState<number | null>(null);
  const [quantity, setQuantity] = React.useState<number>(1);
  const touchStartX = React.useRef<number | null>(null);
  const SWIPE_THRESHOLD = 50; // px

  React.useEffect(() => {
    // Clamp quantity if stock changes and is lower than current quantity
    if (product.stock !== undefined && product.stock > 0 && quantity > product.stock) {
      setQuantity(30); //Math.min(30, product.stock)
    }
    if ((product.stock === 0 || product.stock === undefined) && quantity !== 1) {
      setQuantity(1);
    }
  }, [product.stock]);

  // Keyboard handler for modal: ESC to close, arrows to navigate
  React.useEffect(() => {
    if (!modalOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
        setModalIndex(null);
        return;
      }
      if (!product.images || product.images.length === 0) return;
      if (e.key === 'ArrowLeft') {
        setModalIndex((idx) => {
          if (idx === null) return 0;
          return (idx - 1 + product.images.length) % product.images.length;
        });
      } else if (e.key === 'ArrowRight') {
        setModalIndex((idx) => {
          if (idx === null) return 0;
          return (idx + 1) % product.images.length;
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modalOpen, product.images]);

  const selectable = !isAdmin && (product.stock ?? 0) > 0;

  return (
    <div 
      className={`relative group bg-white rounded-xl shadow-sm ${selectable ? 'hover:shadow-md' : ''} transition-all duration-300 overflow-hidden border-2 ${isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-transparent'} ${selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-95'}`}
      onClick={() => selectable && onToggleSelect(product)}
    >

      {/* Image Section */}
      <div className="aspect-square bg-slate-100 relative overflow-hidden">
        {product.images && product.images.length > 0 ? (
          <img 
            src={product.images[0].urls.medium || product.images[0].urls.big} 
            alt={product.name} 
            className={`w-full h-full object-cover cursor-pointer`}
            onClick={e => {
              if (!isAdmin) {
                e.stopPropagation();
                setModalIndex(0);
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
          <div className={`absolute top-3 right-3 w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 text-white' : (selectable ? 'bg-white/80 text-slate-400 hover:bg-white' : 'bg-white/20 text-slate-300')}`}> 
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
                className={`w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white shadow cursor-pointer`}
                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}
                onClick={e => {
                  e.stopPropagation();
                  setModalIndex(idx);
                  setModalOpen(true);
                }}
              />
            ) : null
          ))}
        </div>
      )}
      {/* Full Size Image Modal */}
      {modalOpen && modalIndex !== null && product.images && product.images[modalIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setModalOpen(false); setModalIndex(null); }}>
          <div
            className="relative flex items-center justify-center"
            style={{ width: '100%', height: '100%' }}
            onClick={e => e.stopPropagation()}
            onTouchStart={(e) => {
              if (e.touches && e.touches.length > 0) {
                touchStartX.current = e.touches[0].clientX;
              }
            }}
            onTouchEnd={(e) => {
              if (!touchStartX.current) return;
              const touch = e.changedTouches && e.changedTouches[0];
              if (!touch) {
                touchStartX.current = null;
                return;
              }
              const dx = touch.clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(dx) < SWIPE_THRESHOLD) return;
              // swipe right -> previous, swipe left -> next
              if (dx > 0) {
                setModalIndex(prev => {
                  const n = product.images.length;
                  const cur = prev === null ? 0 : prev;
                  return (cur - 1 + n) % n;
                });
              } else {
                setModalIndex(prev => {
                  const n = product.images.length;
                  const cur = prev === null ? 0 : prev;
                  return (cur + 1) % n;
                });
              }
            }}
          >
            {/* Adaptive nav buttons at image edge */}
            {product.images.length > 1 && (
              <>

                <button
                  onClick={(e) => { e.stopPropagation(); setModalIndex(prev => {
                    const n = product.images.length;
                    const cur = prev === null ? 0 : prev;
                    return (cur - 1 + n) % n;
                  }); }}
                  aria-label="Previous image"
                    className="absolute left-10 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white/30 hover:bg-white/50 text-slate-700 rounded-full w-12 h-12 flex items-center justify-center shadow-2xl "
                  style={{ zIndex: 2 }}
                >
                  <i className="fas fa-chevron-left text-2xl"></i>
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); setModalIndex(prev => {
                    const n = product.images.length;
                    const cur = prev === null ? 0 : prev;
                    return (cur + 1) % n;
                  }); }}
                  aria-label="Next image"
                    className="absolute right-10 top-1/2 -translate-y-1/2 translate-x-1/2 bg-white/30 hover:bg-white/50 text-slate-700 rounded-full w-12 h-12 flex items-center justify-center shadow-2xl "
                  style={{ zIndex: 2 }}
                >
                  <i className="fas fa-chevron-right text-2xl"></i>
                </button>
              </>
            )}
            <img
              src={product.images[modalIndex].urls.big}
              alt="Full Size"
              onClick={(e) => { e.stopPropagation(); setModalOpen(false); setModalIndex(null); }}
              className="max-w-[95vw] max-h-[90vh] rounded-xl shadow-2xl"
              style={{ display: 'block', margin: '0 auto', position: 'relative', zIndex: 1 }}
            />
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-slate-800 text-lg leading-tight">{product.name}</h3> 
   
        </div>
        <div className="flex items-center gap-3">
          {!product.stock && (
            <span className="text-sm text-amber-600/70 font-semibold">Restocking</span>
          )}
          {!!product.stock && (
            <>
              <span className="text-sm text-green-600/70 font-semibold">In Stock</span>
              <label className="sr-only" htmlFor={`qty-${product.id}`}>Quantity</label>
              <select
                id={`qty-${product.id}`}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                className="text-sm border border-slate-200 rounded px-2 py-1 bg-white"
                title="Quantity"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </>
          )}
        </div>

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