export interface Product {
  id: string;
  name: string;
  description: string;
  wholesalePrice: number;
  retailPrice: number;
  images: string[]; // Base64 strings for simplicity in this demo

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