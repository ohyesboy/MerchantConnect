export interface Product {
  id: string; // Firestore document ID (not stored in document, added on read)
  name: string;
  description: string;
  wholesalePrice: number;
  retailPrice: number;
  images: {
    name: string;
    urls: {
      small?: string; // thumbnail (may be missing for old items)
      medium?: string; // medium-size image for hero (short edge ~600)
      big: string;    // full-size URL
    };
  }[];
  stock?: number;
  hidden?: boolean;
  createdAt?: number; // Timestamp in milliseconds

}

export interface UserProfile {
  uid: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  businessName?: string;
  businessAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipcode?: string;
  };
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