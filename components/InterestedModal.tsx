import React, { useState, useEffect } from 'react';
import { Product, UserProfile } from '../types';
import { generateInterestEmail } from '../services/geminiService';
import { updateUserProfile } from '../services/firebaseService';

interface InterestedModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Product[];
  currentUser: UserProfile;
  adminEmail: string;
}

export const InterestedModal: React.FC<InterestedModalProps> = ({
  isOpen,
  onClose,
  selectedProducts,
  currentUser,
  adminEmail
}) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');

  useEffect(() => {
    if (isOpen) {
      setFormData({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        phone: currentUser.phone || ''
      });
      setStep('form');
    }
  }, [isOpen, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Update User Profile in Firestore
      await updateUserProfile(currentUser.uid, formData);
      const updatedUser = { ...currentUser, ...formData };

      // 2. Generate Email Content using Gemini
      const emailContent = await generateInterestEmail(updatedUser, selectedProducts, adminEmail);

      // 3. Open Mail Client (simulating "Send")
      const mailtoLink = `mailto:${adminEmail}?subject=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.body)}`;
      
      // We open this in a new tab/window to not disrupt the app state too much
      window.open(mailtoLink, '_blank');

      setStep('success');
    } catch (error) {
      console.error("Process failed", error);
      alert("Something went wrong generating the inquiry.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
        
        {step === 'form' ? (
          <>
            <div className="bg-blue-600 p-6 text-white">
              <h2 className="text-xl font-bold flex items-center">
                <i className="fas fa-paper-plane mr-3"></i> 
                Send Inquiry
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                You selected {selectedProducts.length} products.
              </p>
            </div>
            
            <div className="p-6">
              <p className="text-slate-600 mb-4 text-sm">
                Please confirm your contact details so the supplier can reach you.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none transition"
                      value={formData.firstName}
                      onChange={e => setFormData({...formData, firstName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none transition"
                      value={formData.lastName}
                      onChange={e => setFormData({...formData, lastName: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="+1 (555) 000-0000"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none transition"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center"
                  >
                    {loading ? (
                      <i className="fas fa-circle-notch fa-spin"></i>
                    ) : (
                      <>
                        Notify Supplier <i className="fas fa-arrow-right ml-2"></i>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full mt-3 text-slate-500 text-sm font-medium hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              <i className="fas fa-check"></i>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Ready to Send!</h3>
            <p className="text-slate-600 mb-6 text-sm">
              Your email client should have opened with the drafted inquiry.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
            >
              Back to Products
            </button>
          </div>
        )}
      </div>
    </div>
  );
};