import { GoogleGenAI, Type } from "@google/genai";
import { Product, UserProfile } from "../types";

const apiKey = process.env.API_KEY;

// Initialize the client securely
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Generates a professional email draft for the merchant to send to the admin.
 */
export const generateInterestEmail = async (
  user: UserProfile,
  products: Product[],
  adminEmail: string
): Promise<{ subject: string; body: string }> => {
  if (!ai) throw new Error("API Key not found");

  const productList = products.map(p => `- ${p.name} (Wholesale: $${p.wholesalePrice})`).join('\n');

  const prompt = `
    You are an AI assistant for a wholesale platform.
    Write a professional email from a merchant named "${user.firstName} ${user.lastName}" to the supplier.
    
    The merchant's contact info:
    Phone: ${user.phone}
    Email: ${user.email}

    They are interested in the following products:
    ${productList}

    The email should be polite, concise, and ask for next steps regarding ordering.
    Return the result as a JSON object with "subject" and "body" fields.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            body: { type: Type.STRING },
          },
          required: ["subject", "body"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating email:", error);
    // Fallback if AI fails
    return {
      subject: `Interest in ${products.length} products`,
      body: `Hi,\n\nI am interested in buying: \n${productList}\n\nPlease contact me at ${user.phone}.`
    };
  }
};

/**
 * Analyzes an image to suggest product details.
 */
export const analyzeProductImage = async (base64Image: string): Promise<{ name: string; description: string; retailPriceEstimate: number }> => {
  if (!ai) throw new Error("API Key not found");

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