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
import { UserProfile, Product } from '../types';

let app: FirebaseApp | undefined;
let db: any;
let auth: any;

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
  if (!db) return () => {};
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    callback(products);
  });
};

export const addProduct = async (product: Omit<Product, 'id'>) => {
  if (!db) throw new Error("Database not initialized");
  await addDoc(collection(db, "products"), product);
};

export const updateProduct = async (id: string, product: Partial<Product>) => {
  if (!db) throw new Error("Database not initialized");
  const docRef = doc(db, "products", id);
  await updateDoc(docRef, product);
};