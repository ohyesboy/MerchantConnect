import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
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
  query,
  orderBy,
  updateDoc
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

export const loginWithGoogle = async () => {
  if (!auth) throw new Error("Firebase not initialized");
  const provider = new GoogleAuthProvider();
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
  await setDoc(docRef, { ...data, uid }, { merge: true });
};

export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  if (!db) {
    console.error("Database not initialized");
    return () => {};
  }
  console.log("Subscribing to products collection...");
  // Try without orderBy first to see if products exist
  const productsRef = collection(db, "products");
  return onSnapshot(productsRef, (snapshot) => {
    console.log("Products snapshot received:", snapshot.docs.length, "documents");
    const products = snapshot.docs.map(doc => {
      console.log("Product doc:", doc.id, doc.data());
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