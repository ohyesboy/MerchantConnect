import { GoogleGenAI, Type } from "@google/genai";

// Prefer Vite env var for front-end builds; fallback to Node env when available
const apiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_API_KEY) || process.env.API_KEY;

// Initialize the client if an API key is available. Note: keeping API keys in client bundles is discouraged.
// In environments without an API key (e.g., local dev without server-side proxy), we'll skip AI and use fallbacks.
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

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