import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ProductCard } from './components/ProductCard';
import { InterestedModal } from './components/InterestedModal';
import { AdminProductForm } from './components/AdminProductForm';
import { BatchUploadDialog } from './components/BatchUploadDialog';
import { EditConfigDialog } from './components/EditConfigDialog';
import { FilesCleanupDialog } from './components/FilesCleanupDialog';
import { LoginPage } from './components/LoginPage';
import {
  initFirebase,
  getFirebaseAuth,
  loginWithGoogle,
  loginWithMicrosoft,
  logoutUser,
  getUserProfile,
  subscribeToProducts,
  updateUserProfile,
  addProductWithRef,
  deleteProduct,
  getAdminEmails
} from './services/firebaseService';
import { Product, UserProfile, ViewState } from './types';
import { searchProducts } from './services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>(ViewState.LOADING);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  // selectionMap: productId -> quantity
  const [selectionMap, setSelectionMap] = useState<Record<string, number>>({});
  const [configError, setConfigError] = useState<string | null>(null);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  // Optional HTML logo from environment. If provided, it will replace the text logo.
  const logoHtml = (import.meta.env.VITE_LOGOHTML as string) || '';
  
  // Modals
  const [isInterestModalOpen, setIsInterestModalOpen] = useState(false);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isBatchUploadOpen, setIsBatchUploadOpen] = useState(false);
  const [isEditConfigOpen, setIsEditConfigOpen] = useState(false);
  const [isFilesCleanupOpen, setIsFilesCleanupOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [newProductId, setNewProductId] = useState<string | null>(null);
  const [newProductSaved, setNewProductSaved] = useState(false);

  // Search
  const [searchTerm, setSearchTerm] = useState<string>('');




  const isAdmin = viewState === ViewState.ADMIN_DASHBOARD && user?.uid && adminEmails.includes(user.uid);
  const visibleSourceProducts = isAdmin ? products : products.filter(p => !(p as any).hidden);

  // Filtered products based on search. If search is empty, returns full products list.
  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return visibleSourceProducts;
    const tokens = q.split(/\s+/).filter(Boolean);
    // Match if any token exists in name or description (OR match)
    return visibleSourceProducts.filter(p => {
      const hay = ((p.name || '') + ' ' + (p.description || '')).toLowerCase();
      return tokens.some(t => hay.includes(t));
    });
  }, [visibleSourceProducts, searchTerm]);

  // Remote search results (from DB) when user presses Enter
  const [remoteResults, setRemoteResults] = useState<Product[] | null>(null);
  const [isRemoteSearching, setIsRemoteSearching] = useState(false);

  const displayedProducts = remoteResults !== null
    ? (isAdmin ? remoteResults : remoteResults.filter(p => !(p as any).hidden))
    : (searchTerm.trim() ? filteredProducts : visibleSourceProducts);

  // Track if we've already restored the viewState to avoid re-restoring
  const hasRestoredRef = useRef(false);
  // Track if we should save viewState to localStorage (not during initial restoration)
  const shouldSaveRef = useRef(false);

  // Save viewState to localStorage whenever it changes (but not LOADING state)
  useEffect(() => {
    if (viewState !== ViewState.LOADING && shouldSaveRef.current) {
      localStorage.setItem('viewState', String(viewState));
    }
  }, [viewState]);

  // Restore viewState from localStorage after user is loaded
  useEffect(() => {
    if (user && !hasRestoredRef.current) {
      hasRestoredRef.current = true;
      const savedViewStateStr = localStorage.getItem('viewState');
      const savedViewState = savedViewStateStr !== null ? parseInt(savedViewStateStr, 10) : null;
      if (savedViewState !== null && savedViewState !== ViewState.LOADING) {
        // Only restore ADMIN_DASHBOARD if user is actually an admin
        if (savedViewState === ViewState.ADMIN_DASHBOARD && user.uid && adminEmails.includes(user.uid)) {
          setViewState(ViewState.ADMIN_DASHBOARD);
        } else if (savedViewState !== ViewState.ADMIN_DASHBOARD) {
          // Restore non-admin states
          setViewState(savedViewState);
        }
      }
      // Enable saving after restoration is complete
      shouldSaveRef.current = true;
    }
  }, [user, adminEmails]);

  // If adminEmails load after user, check if we need to upgrade to ADMIN_DASHBOARD
  useEffect(() => {
    if (user && adminEmails.length > 0 && hasRestoredRef.current) {
      const savedViewStateStr = localStorage.getItem('viewState');
      const savedViewState = savedViewStateStr !== null ? parseInt(savedViewStateStr, 10) : null;
      // If we previously restored FEED but user is now an admin, upgrade to ADMIN_DASHBOARD
      if (savedViewState === ViewState.ADMIN_DASHBOARD && viewState === ViewState.FEED && user.uid && adminEmails.includes(user.uid)) {
        setViewState(ViewState.ADMIN_DASHBOARD);
      }
    }
  }, [adminEmails, user, viewState]);

  // Initialize Firebase from env on mount
  useEffect(() => {
    const configStr = import.meta.env.VITE_FIREBASE_CONFIG;

    if (!configStr) {
      setConfigError('Missing VITE_FIREBASE_CONFIG environment variable');
      return;
    }

    const success = initFirebase(configStr);
    if (!success) {
      setConfigError('Failed to initialize Firebase with provided config');
      return;
    }

    // Fetch admin emails from Firebase
    const fetchAdminEmails = async () => {
      try {
        const emails = await getAdminEmails();
        setAdminEmails(emails);
      } catch (error) {
        console.error("Failed to fetch admin emails:", error);
      }
    };
    fetchAdminEmails();

    // Initialize Auth Listener
    const auth = getFirebaseAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Use email as the user document ID when available
        const userKey = firebaseUser.email ;

        // Fetch additional profile data from Firestore (users collection keyed by email)
        let profile = await getUserProfile(userKey);

        if (!profile) {
          // New user, save basic info
          profile = {
            uid: userKey,
            firstName: firebaseUser.displayName?.split(' ')[0] || '',
            lastName: firebaseUser.displayName?.split(' ')[1] || '',
            phone: '',
            role: 'merchant' // Default
          };
          // In a real app we'd save this to Firestore immediately
        }
        profile.uid = userKey; // Ensure uid is set to email

        setUser(profile);
        // Set to FEED initially, will be restored by separate effect if needed
        setViewState(ViewState.FEED);
      } else {
        setUser(null);
        setViewState(ViewState.FEED); // Show feed but maybe limit actions
      }
    });

    // Listen for profile updates dispatched from modals/components
    const onProfileUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as any;
      if (detail) {
        setUser(detail as UserProfile);
      }
    };
    window.addEventListener('userProfileUpdated', onProfileUpdated as EventListener);

    return () => {
      unsubscribeAuth();
      window.removeEventListener('userProfileUpdated', onProfileUpdated as EventListener);
    };
  }, []);

  // Subscribe to products after Firebase is initialized
  useEffect(() => {
    let unsubscribeProducts: (() => void) | undefined;
    try {
      unsubscribeProducts = subscribeToProducts((data) => {
        // Normalize product objects: ensure `stock` is defined (default 0)
        const normalized = data.map(p => ({ ...p, stock: (p as any).stock ?? 0 }));
        setProducts(normalized);
      });
    } catch (err) {
      console.error("Failed to subscribe to products:", err);
    }

    return () => {
      if (unsubscribeProducts) unsubscribeProducts();
    };
  }, [user?.uid]);

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
    // Clear saved viewState when logging out
    localStorage.removeItem('viewState');
    setViewState(ViewState.FEED);
    // Reset the restoration flags so they can restore again on next login
    hasRestoredRef.current = false;
    shouldSaveRef.current = false;
  };

  const toggleProductSelection = (product: Product, qty?: number) => {
    setSelectionMap(prev => {
      const next = { ...prev };
      const id = product.id;
      if (typeof qty === 'number') {
        if (qty <= 0) {
          delete next[id];
        } else {
          next[id] = qty;
        }
      } else {
        // toggle: if present remove, else set to 1
        if (next[id]) delete next[id];
        else next[id] = 1;
      }
      return next;
    });
  };



  // Rendering

  // Selected summary: use quantities from selectionMap and wholesalePrice for totals
  const selectedCount = useMemo(() => Object.values(selectionMap).reduce((s, v) => s + v, 0), [selectionMap]);
  const selectedTotal = useMemo(() => {
    return Object.entries(selectionMap).reduce((sum, [id, qty]) => {
      const prod = products.find(p => p.id === id);
      if (!prod) return sum;
      return sum + ((typeof prod.wholesalePrice === 'number' ? prod.wholesalePrice : 0) * qty);
    }, 0);
  }, [selectionMap, products]);
  const fmtCurrency = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

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

  // Show login page if user is not logged in
  if (!user) {
    return <LoginPage logoHtml={logoHtml} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-4">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              {logoHtml ? (
                <div

                  dangerouslySetInnerHTML={{ __html: logoHtml }}
                ></div>
              ) : (
                <span className="text-xl font-bold text-blue-600 tracking-tight">Merchant<span className="text-slate-800">Connect</span></span>
              )}
            </div>

            {/* Search Bar */}
            <div className="flex-grow max-w-md">
              <div className="relative">
                <input
                  aria-label="Search products"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    // Clear any prior remote results when user edits the query
                    if (remoteResults !== null) setRemoteResults(null);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const q = searchTerm.trim();
                      if (!q) {
                        // If empty, clear remoteResults and do nothing
                        setRemoteResults(null);
                        setIsRemoteSearching(false);
                        return;
                      }
                      setIsRemoteSearching(true);
                      setRemoteResults(null);
                      try {
                        const results = await searchProducts(q);
                        setRemoteResults(results);
                      } catch (err) {
                        console.error('Search failed', err);
                      } finally {
                        setIsRemoteSearching(false);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white shadow-sm focus:outline-none text-sm"
                  placeholder="Search products..."
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-slate-500 font-medium pointer-events-none">
                  {displayedProducts.length}
                </div>
              </div>
            </div>

            {/* Admin buttons (visible only in admin mode) */}
            {viewState === ViewState.ADMIN_DASHBOARD && user?.uid && adminEmails.includes(user.uid) && (
              <div className="hidden lg:flex items-center space-x-2 flex-shrink-0">
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
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition"
                  title="Add Product"
                >
                  <i className="fas fa-plus mr-1"></i> Add
                </button>
                <button
                  onClick={() => setIsBatchUploadOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium transition"
                  title="Batch Upload"
                >
                  <i className="fas fa-cloud-upload-alt mr-1"></i> Upload
                </button>
                <button
                  onClick={() => setIsEditConfigOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-sm font-medium transition"
                  title="Edit Config"
                >
                  <i className="fas fa-cog mr-1"></i> Config
                </button>
                <button
                  onClick={() => setIsFilesCleanupOpen(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-medium transition"
                  title="Files Cleanup"
                >
                  <i className="fas fa-trash-alt mr-1"></i> Cleanup
                </button>
              </div>
            )}

            {/* Right side actions */}
            <div className="flex items-center space-x-4 flex-shrink-0">
              {user ? (
                <>
                  <div className="hidden md:flex flex-col text-right mr-2">
                    <span className="text-sm font-medium text-slate-800">{user.firstName} {user.lastName}</span>
                    <span className="text-xs text-slate-500">{user.uid}</span>
                  </div>

                  {(user.uid && adminEmails.includes(user.uid)) && (
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
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0 w-full">
        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
          {isRemoteSearching ? (
            <div className="col-span-full text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            displayedProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              isSelected={!!selectionMap[product.id]}
              onToggleSelect={toggleProductSelection}
              isAdmin={viewState === ViewState.ADMIN_DASHBOARD && user?.uid && adminEmails.includes(user.uid)}
              onEdit={(p) => { setEditingProduct(p); setIsProductFormOpen(true); }}
            />
            ))
          )}
          {displayedProducts.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-400">
              <i className="fas fa-box-open text-6xl mb-4"></i>
              <p>No products available yet.</p>
            </div>
          )}
        </div>
      </main>

      {/* Sticky Action Bar for Merchants */}
      {viewState === ViewState.FEED && selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-slate-700 font-medium">{selectedCount} {selectedCount === 1 ? 'item' : 'items'}, {fmtCurrency(selectedTotal)} total</span>
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
          selectedProducts={Object.keys(selectionMap).map(id => {
            const product = products.find(p => p && p.id === id);
            return product || null;
          }).filter((p): p is Product => p !== null && p !== undefined)}
          currentUser={user}
          adminEmails={adminEmails}
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
          product={editingProduct}
          onSave={() => setNewProductSaved(true)}
        />
      )}

      <BatchUploadDialog
        isOpen={isBatchUploadOpen}
        onClose={() => setIsBatchUploadOpen(false)}
      />

      <EditConfigDialog
        isOpen={isEditConfigOpen}
        onClose={() => setIsEditConfigOpen(false)}
      />

      <FilesCleanupDialog
        isOpen={isFilesCleanupOpen}
        onClose={() => setIsFilesCleanupOpen(false)}
      />
    </div>
  );
};

export default App;