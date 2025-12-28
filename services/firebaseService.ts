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
  deleteObject,
  listAll
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

  // Store the path in sessionStorage so we can retrieve it later for deletion
  const urlToPathMap = JSON.parse(sessionStorage.getItem('urlToPathMap') || '{}');
  urlToPathMap[downloadURL] = path;
  sessionStorage.setItem('urlToPathMap', JSON.stringify(urlToPathMap));

  return downloadURL;
};

// Test function to debug URL extraction
export const testUrlExtraction = (imageUrl: string): string | null => {
  console.log("=== Testing URL extraction ===");
  console.log("URL:", imageUrl);

  const urlObj = new URL(imageUrl);
  const pathname = urlObj.pathname;
  const fullPath = pathname + urlObj.search;

  console.log("Pathname:", pathname);
  console.log("Full path:", fullPath);

  // Try Format 1: /v0/b/{bucket}/o/{path}
  let pathMatch = fullPath.match(/\/o\/([^?]+)/);
  if (pathMatch && pathMatch[1]) {
    const result = decodeURIComponent(pathMatch[1]);
    console.log("✓ Matched Format 1, extracted:", result);
    return result;
  }

  // Try Format 2 & 3: /{bucket}/products/{path} or /{bucket}/o/{path}
  pathMatch = pathname.match(/\/[^/]+\/((?:products|o).*)$/);
  if (pathMatch && pathMatch[1]) {
    const result = decodeURIComponent(pathMatch[1]);
    console.log("✓ Matched Format 2/3, extracted:", result);
    return result;
  }

  // Fallback
  if (pathname.includes('/products/')) {
    const idx = pathname.indexOf('/products/');
    const result = decodeURIComponent(pathname.substring(idx + 1));
    console.log("✓ Matched fallback (products/), extracted:", result);
    return result;
  }

  if (pathname.includes('/o/')) {
    const idx = pathname.indexOf('/o/');
    const result = decodeURIComponent(pathname.substring(idx + 1));
    console.log("✓ Matched fallback (o/), extracted:", result);
    return result;
  }

  console.warn("✗ Could not extract path");
  return null;
};

export const deleteProductImage = async (imageUrl: string): Promise<void> => {
  if (!storage) throw new Error("Storage not initialized");

  try {
    // First, try to get the path from our URL-to-path mapping
    const urlToPathMap = JSON.parse(sessionStorage.getItem('urlToPathMap') || '{}');
    let storagePath = urlToPathMap[imageUrl];

    // If not found in mapping, try to extract from URL
    if (!storagePath) {
      console.log("=== Attempting to extract path from URL ===");
      console.log("URL to delete:", imageUrl);

      const urlObj = new URL(imageUrl);
      const pathname = urlObj.pathname;
      const hostname = urlObj.hostname;
      const fullPath = pathname + urlObj.search;

      console.log("Hostname:", hostname);
      console.log("Pathname:", pathname);
      console.log("Full path with search:", fullPath);

      // Handle multiple Firebase URL formats:
      // Format 1: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded_path}?...
      //           pathname: /v0/b/merchantconnect-137b7.firebasestorage.app/o/products%2F...
      // Format 2: https://storage.googleapis.com/{bucket}/products/{path}
      //           pathname: /merchantconnect-137b7.firebasestorage.app/products/...
      // Format 3: https://storage.googleapis.com/{bucket}/o/{encoded_path}?...
      //           pathname: /merchantconnect-137b7.firebasestorage.app/o/products%2F...

      // Try Format 1: /v0/b/{bucket}/o/{path}
      let pathMatch = fullPath.match(/\/o\/([^?]+)/);
      if (pathMatch && pathMatch[1]) {
        console.log("Matched Format 1 (firebasestorage.googleapis.com with /o/)");
        storagePath = decodeURIComponent(pathMatch[1]);
      } else {
        // Try Format 2 & 3: /{bucket}/products/{path} or /{bucket}/o/{path}
        pathMatch = pathname.match(/\/[^/]+\/((?:products|o).*)$/);
        if (pathMatch && pathMatch[1]) {
          console.log("Matched Format 2/3 (storage.googleapis.com)");
          storagePath = decodeURIComponent(pathMatch[1]);
        } else {
          // Last resort: try to extract anything that looks like a storage path
          // Look for 'products/' or 'o/' anywhere in the pathname
          if (pathname.includes('/products/')) {
            const idx = pathname.indexOf('/products/');
            storagePath = decodeURIComponent(pathname.substring(idx + 1));
            console.log("Matched fallback pattern (products/)");
          } else if (pathname.includes('/o/')) {
            const idx = pathname.indexOf('/o/');
            storagePath = decodeURIComponent(pathname.substring(idx + 1));
            console.log("Matched fallback pattern (o/)");
          } else {
            console.warn("Could not extract path from image URL:", imageUrl);
            console.warn("Pathname:", pathname);
            console.warn("Tried patterns: /o/, /{bucket}/products/, /{bucket}/o/");
            return;
          }
        }
      }

      console.log("Extracted storage path:", storagePath);
    } else {
      console.log("Using stored path from mapping:", storagePath);
    }

    console.log("Attempting to delete image at path:", storagePath);

    // Create a reference from the path
    const storageRef = ref(storage, storagePath);
    console.log("Storage reference created, calling deleteObject...");

    await deleteObject(storageRef);
    console.log("✓ Image deleted from storage:", storagePath);
  } catch (err: any) {
    console.error("✗ Failed to delete image from storage");
    console.error("Error code:", err?.code);
    console.error("Error message:", err?.message);
    console.error("Full error:", err);
    // Don't throw - image might already be deleted or URL might be invalid
  }
};

export const uploadFilesToStorage = async (
  files: File[],
  onProgress?: (fileName: string, progress: number) => void
): Promise<string[]> => {
  if (!storage) throw new Error("Storage not initialized");
  if (files.length === 0) return [];

  const uploadedUrls: string[] = [];

  // Create a temp folder with the name of the first file (without extension)
  const firstFileName = files[0].name.split('.')[0];
  const tempFolderName = `newupload/${firstFileName}`;

  for (const file of files) {
    try {
      // Create a unique filename with timestamp
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `${tempFolderName}/${fileName}`);

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

export const getProductIds = async (): Promise<string[]> => {
  if (!db) throw new Error("Database not initialized");
  try {
    const productsRef = collection(db, "products");
    const snap = await getDocs(productsRef);
    return snap.docs.map(doc => doc.id);
  } catch (error) {
    console.error("Error fetching product IDs:", error);
    throw error;
  }
};

export const listStorageFolders = async (): Promise<string[]> => {
  if (!storage) throw new Error("Storage not initialized");
  try {
    const productsRef = ref(storage, 'products');
    const result = await listAll(productsRef);

    // Extract unique folder names from the prefixes (subdirectories)
    const folderNames = result.prefixes.map(prefix => prefix.name);
    return folderNames;
  } catch (error) {
    console.error("Error listing storage folders:", error);
    throw error;
  }
};

export const deleteStorageFolder = async (folderName: string): Promise<void> => {
  if (!storage) throw new Error("Storage not initialized");
  try {
    const folderRef = ref(storage, `products/${folderName}`);
    const result = await listAll(folderRef);

    // Delete all files in the folder
    for (const file of result.items) {
      await deleteObject(file);
    }

    // Recursively delete all subfolders
    for (const subfolder of result.prefixes) {
      await deleteStorageFolder(`${folderName}/${subfolder.name}`);
    }
  } catch (error) {
    console.error(`Error deleting folder ${folderName}:`, error);
    throw error;
  }
};

export const uploadPromptsJson = async (prompts: any, folderPath: string): Promise<void> => {
  if (!storage) throw new Error("Storage not initialized");
  try {
    const jsonData = JSON.stringify(prompts, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const file = new File([blob], 'prompts.json', { type: 'application/json' });

    const storageRef = ref(storage, `${folderPath}/prompts.json`);
    await uploadBytes(storageRef, file);
    console.log(`Prompts JSON uploaded to ${folderPath}/prompts.json`);
  } catch (error) {
    console.error(`Error uploading prompts JSON:`, error);
    throw error;
  }
};