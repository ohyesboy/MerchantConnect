import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  onSnapshot,
  getDocs,
  query,
  orderBy,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject 
} from 'firebase/storage';
import { UserProfile, Product } from '../types';

let app: FirebaseApp | undefined;
let db: any;
let auth: any;
let storage: any;

export const initFirebase = (configJson: string) => {
  try {
    const config = JSON.parse(configJson);
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    return true;
  } catch (e) {
    console.error("Invalid Firebase Config", e);
    return false;
  }
};

export const getFirebaseAuth = () => {
  if (!auth) throw new Error("Firebase not initialized");
  return auth;
};

export const getAdminEmails = async (): Promise<string[]> => {
  if (!db) throw new Error("Database not initialized");
  try {
    // Fetch from configs/adminEmails
    const docRef = doc(db, "configs", "adminEmails");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const emails = data.emails || [];
      return emails;
    }

    return [];
  } catch (error) {
    console.error("Error fetching admin emails:", error);
    return [];
  }
};

export const loginWithGoogle = async () => {
  if (!auth) throw new Error("Firebase not initialized");
  const provider = new GoogleAuthProvider();
  // Force account selection popup to appear every time
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
};

export const loginWithMicrosoft = async () => {
  if (!auth) throw new Error("Firebase not initialized");
  const provider = new OAuthProvider('microsoft.com');
  // Force account selection popup to appear every time
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
};

export const logoutUser = async () => {
  if (!auth) throw new Error("Firebase not initialized");
  return signOut(auth);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  if (!db) throw new Error("Database not initialized");
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
  if (!db) throw new Error("Database not initialized");
  const docRef = doc(db, "users", uid);
  // Do not inject or overwrite an internal `uid` field; write only provided profile fields.

  await setDoc(docRef, data, { merge: true });
};

export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  if (!db) {
    console.error("Database not initialized");
    return () => {};
  }

  // Try without orderBy first to see if products exist
  const productsRef = collection(db, "products");
  return onSnapshot(productsRef, (snapshot) => {
    console.log("Products snapshot received:", snapshot.docs.length, "documents");
    const products = snapshot.docs.map(doc => {
      return { id: doc.id, ...doc.data() } as Product;
    });
    // Sort client-side instead
    products.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(products);
  }, (error) => {
    console.error("Error subscribing to products:", error);
  });
};

export const addProduct = async (product: Omit<Product, 'id'>) => {
  if (!db) throw new Error("Database not initialized");
  await addDoc(collection(db, "products"), product);
};

export const addProductWithRef = async (product: Omit<Product, 'id'>) => {
  if (!db) throw new Error("Database not initialized");
  const docRef = await addDoc(collection(db, "products"), product);
  return docRef;
};

export const deleteProduct = async (id: string) => {
  if (!db) throw new Error("Database not initialized");
  const docRef = doc(db, "products", id);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete product', id, err);
    throw err;
  }
};

// Simple server-side search: fetch products once and filter by tokens in name/description.
// Note: Firestore doesn't support full-text contains queries natively; this performs
// a client-side filter after fetching documents. For large collections, consider
// integrating Algolia/Elastic or Firebase Extensions (Full-Text Search).
export const searchProducts = async (queryStr: string): Promise<Product[]> => {
  if (!db) throw new Error("Database not initialized");
  const q = queryStr.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const productsRef = collection(db, 'products');
  const snap = await getDocs(productsRef);
  const results: Product[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))
    .filter(p => {
      const hay = ((p.name || '') + ' ' + (p.description || '')).toLowerCase();
      return tokens.some(t => hay.includes(t));
    });

  // Sort by createdAt desc
  results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return results;
};

export const updateProduct = async (id: string, product: Partial<Omit<Product, 'id'>>) => {
  if (!db) throw new Error("Database not initialized");
  const docRef = doc(db, "products", id);
  await updateDoc(docRef, product);
};

export const uploadProductImage = async (file: File, productId?: string): Promise<string> => {
  if (!storage) throw new Error("Storage not initialized");
  
  const timestamp = Date.now();
  const fileName = `${timestamp}_${file.name}`;
  const path = productId 
    ? `products/${productId}/${fileName}` 
    : `products/temp/${fileName}`;
  
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
};

export const deleteProductImage = async (imageUrl: string): Promise<void> => {
  if (!storage) throw new Error("Storage not initialized");

  try {
    // Create a reference from the URL
    const storageRef = ref(storage, imageUrl);
    await deleteObject(storageRef);
    console.log("Image deleted from storage:", imageUrl);
  } catch (err) {
    console.error("Failed to delete image from storage:", err);
    // Don't throw - image might already be deleted or URL might be invalid
  }
};

export const uploadFilesToStorage = async (
  files: File[],
  onProgress?: (fileName: string, progress: number) => void
): Promise<string[]> => {
  if (!storage) throw new Error("Storage not initialized");

  const uploadedUrls: string[] = [];

  for (const file of files) {
    try {
      // Create a unique filename with timestamp
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `newupload/${fileName}`);

      // Upload the file
      const snapshot = await uploadBytes(storageRef, file);

      // Get the download URL
      const downloadUrl = await getDownloadURL(snapshot.ref);
      uploadedUrls.push(downloadUrl);

      // Report progress
      if (onProgress) {
        onProgress(file.name, 100);
      }

      console.log(`File uploaded: ${file.name}`);
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      throw error;
    }
  }

  return uploadedUrls;
};

export const getConfig = async (docId: string): Promise<any> => {
  if (!db) throw new Error("Database not initialized");
  const docRef = doc(db, "configs", docId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    // Return the entire document directly
    return docSnap.data();
  }
  throw new Error("Config document not found");
};

export const updateConfig = async (docId: string, data: any): Promise<void> => {
  if (!db) throw new Error("Database not initialized");
  const docRef = doc(db, "configs", docId);
  // Save the data directly without wrapping
  await setDoc(docRef, data, { merge: false });
};