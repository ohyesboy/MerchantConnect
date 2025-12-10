
import React from 'react';
import { createPortal } from 'react-dom';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onToggleSelect: (product: Product, qty?: number) => void;
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
  const [quantity, setQuantity] = React.useState<number>(0);
  const thumbsRef = React.useRef<HTMLDivElement | null>(null);
  const isDownRef = React.useRef(false);
  const startXRef = React.useRef(0);
  const startScrollRef = React.useRef(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);
  const SWIPE_THRESHOLD = 50; // px

  // Attach a non-passive wheel listener so we can call preventDefault()
  React.useEffect(() => {
    const el = thumbsRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      // only intercept when there's horizontal overflow
      if (el.scrollWidth > el.clientWidth) {
        el.scrollLeft += ev.deltaY;
        ev.preventDefault();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel as EventListener);
  }, []);

  // Prevent background page scrolling when modal is open
  React.useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev || '';
    };
  }, [modalOpen]);

  React.useEffect(() => {
    // Ensure quantity never exceeds 10 (we always show 0-10 dropdown)
    if (quantity > 10) {
      setQuantity(10);
    }
  }, [product.stock]);

  // When selection changes: if selected -> ensure quantity at least 1; if unselected -> reset to 0
  React.useEffect(() => {
    if (isSelected) {
      setQuantity(prev => (prev === 0 ? 1 : prev));
    } else {
      setQuantity(0);
    }
  }, [isSelected]);

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
      className={`relative group bg-white rounded-xl shadow-sm ${selectable ? 'hover:shadow-md' : ''} transition-all duration-300 overflow-hidden border-2 ${isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-transparent'} ${selectable ? '' : 'cursor-not-allowed opacity-95'}`}
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
        {/* Selection Indicator Overlay (click only on this button toggles selection) */}
        {!isAdmin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!selectable) return;
              if (isSelected) {
                onToggleSelect(product, 0);
              } else {
                const qtyToSet = quantity > 0 ? quantity : 1;
                onToggleSelect(product, qtyToSet);
              }
            }}
            aria-pressed={isSelected}
            aria-label={isSelected ? 'Deselect product' : 'Select product'}
            className={`absolute top-3 right-3 w-14 h-14 rounded-full flex items-center justify-center transition-colors focus:outline-none ${isSelected ? 'bg-blue-500 text-white' : (selectable ? 'bg-white/80 text-slate-400 hover:bg-white cursor-pointer' : 'bg-white/20 text-slate-300 cursor-not-allowed')}`}
          >
            <i className={`fas ${isSelected ? 'fa-check' : 'fa-plus'} text-lg`}></i>
          </button>
        )}
      </div>
      {/* Thumbnails Row (non-admin mode) - horizontally scrollable and draggable */}
      {product.images && (
        <div
          ref={thumbsRef}
          className={`flex gap-2 px-4 py-2 bg-transparent overflow-x-auto`} 
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', cursor: isDragging ? 'grabbing' : 'grab' }}
          onPointerDown={(e) => {
            const el = thumbsRef.current;
            if (!el) return;
            isDownRef.current = true;
            setIsDragging(true);
            startXRef.current = e.clientX;
            startScrollRef.current = el.scrollLeft;
            (e.target as Element).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            const el = thumbsRef.current;
            if (!el || !isDownRef.current) return;
            const dx = e.clientX - startXRef.current;
            el.scrollLeft = startScrollRef.current - dx;
          }}
          onPointerUp={(e) => {
            isDownRef.current = false;
            setIsDragging(false);
            try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch { }
          }}
          onPointerCancel={() => { isDownRef.current = false; setIsDragging(false); }}
          onPointerLeave={() => { /* don't clear here - keep dragging if pointer is down */ }}
        >
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
      {/* Full Size Image Modal (rendered in a portal so it overlays the whole page) */}
      {modalOpen && modalIndex !== null && product.images && product.images[modalIndex] && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setModalOpen(false); setModalIndex(null); }}>
          <div
            className="relative flex items-center justify-center p-6"
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
                  className="absolute left-10 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white/30 hover:bg-white/50 text-slate-700 rounded-full w-12 h-12 flex items-center justify-center shadow-2xl"
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
                  className="absolute right-10 top-1/2 -translate-y-1/2 translate-x-1/2 bg-white/30 hover:bg-white/50 text-slate-700 rounded-full w-12 h-12 flex items-center justify-center shadow-2xl"
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
      , document.body)}

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-slate-800 text-lg leading-tight">{product.name}</h3> 
   
        </div>
        <div className="flex items-center gap-3">
           {product.hidden && (
            <span className="text-sm text-red-600/70 font-semibold">Hidden</span>
          )}
          {/* Show status label */}
          {product.stock ? (
            <span className="text-sm text-green-600/70 font-semibold">In Stock</span>
          ) : (
            <span className="text-sm text-amber-600/70 font-semibold">Restocking</span>
          )}

          {/* Quantity dropdown: always show 0-10 regardless of stock */}
          <label className="sr-only" htmlFor={`qty-${product.id}`}>Quantity</label>
          <select
            id={`qty-${product.id}`}
            value={quantity}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setQuantity(n);
              // Always inform parent of new quantity (0 will remove selection)
              onToggleSelect(product, n);
            }}
            className="text-sm border border-slate-200 rounded px-2 py-1 bg-white"
            title="Quantity"
          >
            {Array.from({ length: 11 }, (_, i) => i).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
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