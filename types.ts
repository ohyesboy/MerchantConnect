export interface Product {
  id: string; // Firestore document ID (not stored in document, added on read)
  name: string;
  description: string;
  wholesalePrice: number;
  retailPrice: number;
  images: string[]; // Firebase Storage URLs

}

export interface UserProfile {
  uid: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  role?: 'admin' | 'merchant'; // Basic role handling
}

export interface AppConfig {
  adminEmail: string;
  firebaseConfig: any;
}

export enum ViewState {
  FEED,
  ADMIN_DASHBOARD,
  LOADING
}