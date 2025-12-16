import { GoogleGenAI, Type } from "@google/genai";
import { Product, UserProfile } from "../types";

// Prefer Vite env var for front-end builds; fallback to Node env when available
const apiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_API_KEY) || process.env.API_KEY;

// Initialize the client if an API key is available. Note: keeping API keys in client bundles is discouraged.
// In environments without an API key (e.g., local dev without server-side proxy), we'll skip AI and use fallbacks.
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Generates a professional email draft for the merchant to send to the admin.
 */
export const generateInterestEmail = async (
  user: UserProfile,
  products: Product[]
): Promise<{ subject: string; body: string }> => {


    console.warn('generateInterestEmail: AI client not available, using fallback content');
    const productListFallback = products.map(p => `- ${p.name} (Wholesale: $${p.wholesalePrice})`).join('\n');
    return {
      subject: `Interest in ${products.length} products`,
      body: `Hi,\n\nI am ${user.firstName} ${user.lastName} and am interested in the following products:
      
      ${productListFallback}

Please contact me at ${user.phone || user.email}.
My business name: ${user.businessName || 'N/A'}.
Email: ${user.email || 'N/A'}.
Phone: ${user.phone || 'N/A'}.
Address: ${user.businessAddress ? `${user.businessAddress.street || ''}, ${user.businessAddress.city || ''}, ${user.businessAddress.state || ''} ${user.businessAddress.zipcode || ''}` : 'N/A'}.
Thank you!
      `,
    };
  
};

/**
 * Analyzes an image to suggest product details.
 */
export const analyzeProductImage = async (base64Image: string): Promise<{ name: string; description: string; retailPriceEstimate: number }> => {
  if (!ai) {
    console.warn('analyzeProductImage: AI client not available, returning empty analysis');
    return { name: "", description: "", retailPriceEstimate: 0 };
  }

  const prompt = "Analyze this product image. Provide a catchy product name, a short sales description (max 2 sentences), and an estimated retail price in USD.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            retailPriceEstimate: { type: Type.NUMBER }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text);
  } catch (error) {
    console.error("Error analyzing image:", error);
    return { name: "", description: "", retailPriceEstimate: 0 };
  }
};