import React, { useState, useEffect } from 'react';
import { Product, UserProfile } from '../types';
import { generateInterestEmail } from '../services/geminiService';
import { updateUserProfile, getUserProfile } from '../services/firebaseService';

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
    email: currentUser.email || '',
    firstName: '',
    lastName: '',
    phone: '',
    businessName: '',
    street: '',
    city: '',
    state: '',
    zipcode: ''
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [draftEmailForMe, setDraftEmailForMe] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('draftEmailForMe');
      return v === null ? true : v === 'true';
    } catch (e) {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('draftEmailForMe', draftEmailForMe.toString());
    } catch (e) {
      // ignore storage errors
    }
  }, [draftEmailForMe]);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        email: currentUser.email || '',
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        phone: currentUser.phone || '',
        businessName: (currentUser as any).businessName || '',
        street: (currentUser as any).businessAddress?.street || '',
        city: (currentUser as any).businessAddress?.city || '',
        state: (currentUser as any).businessAddress?.state || '',
        zipcode: (currentUser as any).businessAddress?.zipcode || ''
      });
      setStep('form');
    }
  }, [isOpen, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Update User Profile in Firestore
      const profileUpdate: any = {
        email: (formData as any).email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        businessName: (formData as any).businessName,
        businessAddress: {
          street: (formData as any).street,
          city: (formData as any).city,
          state: (formData as any).state,
          zipcode: (formData as any).zipcode
        }
      };
      // Use email as document id when available to update the existing user document
      const userKey = currentUser.email ? currentUser.email : currentUser.uid;
      await updateUserProfile(userKey, profileUpdate);
      // Fetch the saved profile and notify the app so it can update its in-memory user.
      try {
        const saved = await getUserProfile(userKey);
        if (saved) {
          // Dispatch a global event so App can update its user state
          window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: saved }));
        }
      } catch (err) {
        console.warn('Failed to reload saved profile', err);
      }
      const updatedUser = { ...currentUser, ...profileUpdate, uid: userKey };

      // 2. Generate Email Content using Gemini
      const emailContent = await generateInterestEmail(updatedUser, selectedProducts, adminEmail);

      // 3. Open Mail Client (simulating "Send")
      const mailtoLink = `mailto:${adminEmail}?subject=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.body)}`;

      // Open mail client only if the user has asked to draft the email for them
      if (draftEmailForMe) {
        // We open this in a new tab/window to not disrupt the app state too much
        window.open(mailtoLink, '_blank');
      }

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


              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none transition"
                      value={formData.firstName}
                      onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none transition"
                      value={formData.lastName}
                      onChange={e => setFormData({ ...formData, lastName: e.target.value })}
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
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none transition"
                    value={(formData as any).email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Business Name</label>
                  <input
                    type="text"
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none transition"
                    value={(formData as any).businessName}
                    onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Street Address</label>
                    <input
                      type="text"
                      required
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none transition"
                      value={(formData as any).street}
                      onChange={e => setFormData({ ...formData, street: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">City</label>
                      <input
                        type="text"
                        required
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none transition"
                        value={(formData as any).city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">State</label>
                      <select
                        required
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none transition"
                        value={(formData as any).state}
                        onChange={e => setFormData({ ...formData, state: e.target.value })}
                      >
                        <option value="">Select state</option>
                        <option value="AL">Alabama</option>
                        <option value="AK">Alaska</option>
                        <option value="AZ">Arizona</option>
                        <option value="AR">Arkansas</option>
                        <option value="CA">California</option>
                        <option value="CO">Colorado</option>
                        <option value="CT">Connecticut</option>
                        <option value="DE">Delaware</option>
                        <option value="FL">Florida</option>
                        <option value="GA">Georgia</option>
                        <option value="HI">Hawaii</option>
                        <option value="ID">Idaho</option>
                        <option value="IL">Illinois</option>
                        <option value="IN">Indiana</option>
                        <option value="IA">Iowa</option>
                        <option value="KS">Kansas</option>
                        <option value="KY">Kentucky</option>
                        <option value="LA">Louisiana</option>
                        <option value="ME">Maine</option>
                        <option value="MD">Maryland</option>
                        <option value="MA">Massachusetts</option>
                        <option value="MI">Michigan</option>
                        <option value="MN">Minnesota</option>
                        <option value="MS">Mississippi</option>
                        <option value="MO">Missouri</option>
                        <option value="MT">Montana</option>
                        <option value="NE">Nebraska</option>
                        <option value="NV">Nevada</option>
                        <option value="NH">New Hampshire</option>
                        <option value="NJ">New Jersey</option>
                        <option value="NM">New Mexico</option>
                        <option value="NY">New York</option>
                        <option value="NC">North Carolina</option>
                        <option value="ND">North Dakota</option>
                        <option value="OH">Ohio</option>
                        <option value="OK">Oklahoma</option>
                        <option value="OR">Oregon</option>
                        <option value="PA">Pennsylvania</option>
                        <option value="RI">Rhode Island</option>
                        <option value="SC">South Carolina</option>
                        <option value="SD">South Dakota</option>
                        <option value="TN">Tennessee</option>
                        <option value="TX">Texas</option>
                        <option value="UT">Utah</option>
                        <option value="VT">Vermont</option>
                        <option value="VA">Virginia</option>
                        <option value="WA">Washington</option>
                        <option value="WV">West Virginia</option>
                        <option value="WI">Wisconsin</option>
                        <option value="WY">Wyoming</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ZIP</label>
                      <input
                        type="text"
                        required
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none transition"
                        value={(formData as any).zipcode}
                        onChange={e => setFormData({ ...formData, zipcode: e.target.value })}
                      />
                    </div>
                  </div>
                </div>





                <div className="mb-3">
                  <label className="inline-flex items-center">
                    <input
                      id="draftEmail"
                      type="checkbox"
                      checked={draftEmailForMe}
                      onChange={e => setDraftEmailForMe(e.target.checked)}
                      className="form-checkbox h-4 w-4 text-blue-600 mr-2"
                    />
                    <span className="text-sm text-slate-700">Draft email for me.</span>
                  </label>
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
            {draftEmailForMe && (
              <p className="text-slate-600 mb-6 text-sm">
                Your email client should have opened with the drafted inquiry.
              </p>
            )}
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