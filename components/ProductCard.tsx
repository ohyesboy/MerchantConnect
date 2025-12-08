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
  return (
    <div 
      className={`relative group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border-2 ${isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-transparent'}`}
      onClick={() => !isAdmin && onToggleSelect(product)}
    >
      {/* Image Carousel / Hero Image */}
      <div className="aspect-square bg-slate-100 relative overflow-hidden">
        {product.images && product.images.length > 0 ? (
          <img 
            src={product.images[0]} 
            alt={product.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <i className="fas fa-image text-4xl"></i>
          </div>
        )}
        
        {/* Selection Indicator Overlay */}
        {!isAdmin && (
          <div className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 text-white' : 'bg-white/80 text-slate-400 hover:bg-white'}`}>
            <i className={`fas ${isSelected ? 'fa-check' : 'fa-plus'}`}></i>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-slate-800 text-lg leading-tight">{product.name}</h3>
        </div>
        
        <p className="text-slate-500 text-sm line-clamp-2 mb-4 h-10">{product.description}</p>

        <div className="flex justify-between items-end border-t pt-3 border-slate-100">
          <div>
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Retail</p>
            <p className="text-slate-600 font-medium">${product.retailPrice.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-600 uppercase font-bold tracking-wider">Wholesale</p>
            <p className="text-xl text-blue-700 font-bold">${product.wholesalePrice.toFixed(2)}</p>
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