import React, { useState, useEffect } from 'react';
import { ProductCard } from './components/ProductCard';
import { InterestedModal } from './components/InterestedModal';
import { AdminProductForm } from './components/AdminProductForm';
import { 
  initFirebase, 
  getFirebaseAuth, 
  loginWithGoogle, 
  logoutUser, 
  getUserProfile,
  subscribeToProducts,
  updateUserProfile,
  addProductWithRef,
  deleteProduct
} from './services/firebaseService';
import { Product, UserProfile, ViewState } from './types';
import { onAuthStateChanged } from 'firebase/auth';

const adminEmail = import.meta.env.VITE_AdminEmail || '';
const normalizedAdminEmail = adminEmail.trim().toLowerCase();

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>(ViewState.LOADING);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // Modals
  const [isInterestModalOpen, setIsInterestModalOpen] = useState(false);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [newProductId, setNewProductId] = useState<string | null>(null);
  const [newProductSaved, setNewProductSaved] = useState(false);

  // Initialize Firebase from env on mount
  useEffect(() => {
    const configStr = import.meta.env.VITE_FIREBASE_CONFIG;
    
    if (!configStr) {
      setConfigError('Missing VITE_FIREBASE_CONFIG environment variable');
      return;
    }
    
    if (!adminEmail) {
      setConfigError('Missing VITE_AdminEmail environment variable');
      return;
    }

    const success = initFirebase(configStr);
    if (!success) {
      setConfigError('Failed to initialize Firebase with provided config');
      return;
    }

    // Initialize Auth Listener
    const auth = getFirebaseAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch additional profile data from Firestore
        let profile = await getUserProfile(firebaseUser.uid);
        
        if (!profile) {
          // New user, save basic info
          profile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            firstName: firebaseUser.displayName?.split(' ')[0] || '',
            lastName: firebaseUser.displayName?.split(' ')[1] || '',
            phone: '',
            role: 'merchant' // Default
          };
          // In a real app we'd save this to Firestore immediately
        }
        
        setUser(profile);
        setViewState(ViewState.FEED);
      } else {
        setUser(null);
        setViewState(ViewState.FEED); // Show feed but maybe limit actions
      }
    });

    // Subscribe to Products
    let unsubscribeProducts: (() => void) | undefined;
    try {
      unsubscribeProducts = subscribeToProducts((data) => {
        setProducts(data);
      });
    } catch (err) {
      console.error("Failed to subscribe to products:", err);
    }

    return () => {
      unsubscribeAuth();
      if (unsubscribeProducts) unsubscribeProducts();
    };
  }, []);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Login failed", error);
      alert("Login failed. Check console.");
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
  };

  const toggleProductSelection = (product: Product) => {
    if (selectedProducts.find(p => p.id === product.id)) {
      setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
    } else {
      setSelectedProducts(prev => [...prev, product]);
    }
  };

  // Rendering

  if (configError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg text-center">
          <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Configuration Error</h2>
          <p className="text-slate-600">{configError}</p>
        </div>
      </div>
    );
  }

  if (viewState === ViewState.LOADING) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-blue-600 tracking-tight">Merchant<span className="text-slate-800">Connect</span></span>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <div className="hidden md:flex flex-col text-right mr-2">
                    <span className="text-sm font-medium text-slate-800">{user.firstName} {user.lastName}</span>
                    <span className="text-xs text-slate-500">{user.email}</span>
                  </div>
  
                   {user.email === adminEmail && (
                    <button 
                      onClick={() => setViewState(viewState === ViewState.FEED ? ViewState.ADMIN_DASHBOARD : ViewState.FEED)}
                      className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-sm font-medium hover:bg-indigo-200"
                    >
                      {viewState === ViewState.FEED ? 'Admin Mode' : 'View Feed'}
                    </button>
                  )}
                  <button onClick={handleLogout} className="text-slate-400 hover:text-slate-600">
                    <i className="fas fa-sign-out-alt text-lg"></i>
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
                >
                  <i className="fab fa-google mr-2"></i> Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {viewState === ViewState.ADMIN_DASHBOARD ? 'Product Management' : 'Available Inventory'}
            </h1>
            <p className="text-slate-500 mt-1">
              {viewState === ViewState.ADMIN_DASHBOARD 
                ? 'Manage your catalog and pricing.' 
                : 'Select products you want to stock for your store.'}
            </p>
          </div>
          
{viewState === ViewState.ADMIN_DASHBOARD && user?.email === adminEmail && (     
         <button 
              onClick={async () => {
                // Create product in Firestore and open form
                const defaultProduct = {
                  name: '',
                  description: '',
                  wholesalePrice: 0,
                  retailPrice: 0,
                  images: [],
                  createdAt: Date.now(),
                };
                const docRef = await addProductWithRef(defaultProduct);
                setEditingProduct({ id: docRef.id, ...defaultProduct });
                setNewProductId(docRef.id);
                setIsProductFormOpen(true);
              }}
              className="mt-4 md:mt-0 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md transition flex items-center"
            >
              <i className="fas fa-plus mr-2"></i> Add Product
            </button>
          )}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
          {products.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              isSelected={!!selectedProducts.find(p => p.id === product.id)}
              onToggleSelect={toggleProductSelection}
              isAdmin={viewState === ViewState.ADMIN_DASHBOARD && user?.email === adminEmail}
              onEdit={(p) => { setEditingProduct(p); setIsProductFormOpen(true); }}
              thumbnails={product.thumbnails}
            />
          ))}
          {products.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-400">
              <i className="fas fa-box-open text-6xl mb-4"></i>
              <p>No products available yet.</p>
            </div>
          )}
        </div>
      </main>

      {/* Sticky Action Bar for Merchants */}
      {viewState === ViewState.FEED && selectedProducts.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full text-sm mr-3">
                {selectedProducts.length}
              </div>
              <span className="text-slate-700 font-medium">Products Selected</span>
            </div>
            <button 
              onClick={() => {
                if (!user) {
                  handleLogin();
                } else {
                  setIsInterestModalOpen(true);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition transform hover:-translate-y-0.5"
            >
              I'm Interested
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {user && (
        <InterestedModal 
          isOpen={isInterestModalOpen}
          onClose={() => setIsInterestModalOpen(false)}
          selectedProducts={selectedProducts}
          currentUser={user}
          adminEmail={adminEmail}
        />
      )}

      {isProductFormOpen && (
        <AdminProductForm 
          onClose={async (saved?: boolean) => {
            // If new product and not saved, delete from Firestore
            const wasSaved = saved || newProductSaved;
            if (newProductId && !wasSaved) {
              try {
                await deleteProduct(newProductId);
              } catch (err) {
                console.error('Failed to delete new product on cancel:', err);
              }
            }
            setIsProductFormOpen(false);
            setEditingProduct(undefined);
            setNewProductId(null);
            setNewProductSaved(false);
          }}
          initialProduct={editingProduct}
          onSave={() => setNewProductSaved(true)}
        />
      )}
    </div>
  );
};

export default App;