import { GoogleGenAI } from "@google/genai";
import { SearchResult, MapResult, AnalysisResult, EventDetail } from "../types";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY is not defined in process.env");
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export const searchTradeEvents = async (
  productQuery: string,
  location?: string
): Promise<SearchResult> => {
  const model = "gemini-3-flash-preview";
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  // Stronger location constraint
  const locationInstruction = location && location.trim() !== ""
    ? `CRITICAL INSTRUCTION: The user is ONLY interested in events taking place in or near "${location}". FILTER OUT ALL events that are not in this location.`
    : "Search for events globally.";
  
  const prompt = `
    Current Date: ${today}.
    I am an exporter dealing in: "${productQuery}".
    
    1. First, identify the specific Export Promotion Council (EPC) in India relevant to this product. Start response with "Relevant EPC: [EPC Name]".
    2. Then, find UPCOMING trade events, exhibitions, buyer-seller meets, and delegation meetings relevant to this product sector.
    
    STRICT TIME CONSTRAINT:
    - ONLY list events happening AFTER ${today}.
    - DO NOT list events that have already passed.
    
    ${locationInstruction}
    
    Please provide the output in two distinct parts separated by the delimiter "___JSON_START___".
    
    PART 1: Descriptive List
    Provide a structured list of at least 5 relevant upcoming events.
    For each event, include:
    1. Event Name
    2. Date & Location (Be specific about the city/country)
    3. Brief Description (Focus on why it matters for this specific product)
    4. Key link/website (if available)

    DO NOT include any JSON code blocks in PART 1.

    ___JSON_START___

    PART 2: JSON Data
    Strictly output a JSON array of the found events.
    Structure: [{"eventName": "...", "date": "...", "location": "...", "type": "Exhibition/Delegation/etc", "description": "...", "url": "..."}]
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseModalities: ["TEXT"],
      },
    });

    const fullText = response.text || "No results found.";
    
    const parts = fullText.split("___JSON_START___");
    const displayText = parts[0].trim();
    const jsonPart = parts.length > 1 ? parts[1].trim() : "";

    // Extract JSON block from the second part
    let structuredEvents: EventDetail[] = [];
    const jsonMatch = jsonPart.match(/\[\s*\{[\s\S]*\}\s*\]/); // Look for array pattern
    
    if (jsonMatch) {
      try {
        structuredEvents = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("Failed to parse event JSON", e);
      }
    } else {
         // Fallback: try to find json code block if delimiter logic was slightly ignored but block exists
         const codeBlockMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/);
         if (codeBlockMatch && codeBlockMatch[1]) {
             try { structuredEvents = JSON.parse(codeBlockMatch[1]); } catch(e) {}
         }
    }
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { text: displayText, structuredEvents, groundingChunks };
  } catch (error) {
    console.error("Error searching trade events:", error);
    throw error;
  }
};

export const analyzeStrategicFit = async (
  eventsText: string,
  userProfile: string
): Promise<AnalysisResult> => {
  const model = "gemini-3-pro-preview";

  const prompt = `
    You are a Senior Trade Consultant for Kinetick International.
    
    Context (List of found events and identified EPC):
    ${eventsText}
    
    User Profile/Goal:
    ${userProfile}
    
    Task:
    Analyze the events listed above.
    1. Recommend the top 2-3 events that strongly align with the User Profile.
    2. Explain the "Strategic Value" of attending these specific events (e.g., networking, market entry, competitor analysis).
    3. **Actionable Calendar Plan**: Create a strategic timeline for the top recommended events.
       - Work backwards from the event date.
       - Suggest specific dates/windows for: 
         * Booth Booking (Early bird deadlines)
         * Visa Application (Based on location processing times)
         * Sample Shipment & Customs paperwork
         * Flight/Hotel bookings
    4. Provide a brief preparation tip for the selected events.
    
    Use a professional, analytical tone.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    return { text: response.text || "Could not generate analysis." };
  } catch (error) {
    console.error("Error analyzing events:", error);
    throw error;
  }
};

export const findEventLocation = async (
  eventName: string,
  userLat?: number,
  userLng?: number
): Promise<MapResult> => {
  const model = "gemini-2.5-flash"; 
  
  const prompt = `Where is the "${eventName}" taking place? Provide the address and venue details.`;

  try {
    const config: any = {
      tools: [{ googleMaps: {} }],
    };

    if (userLat && userLng) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: userLat,
            longitude: userLng
          }
        }
      };
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    const text = response.text || "Location not found.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { text, groundingChunks };
  } catch (error) {
    console.error("Error finding location:", error);
    throw error;
  }
};