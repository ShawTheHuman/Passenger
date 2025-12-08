import { GoogleGenAI, Type } from "@google/genai";
import { GroundingLink, LocationData, TurnResponse, Item } from "../types";

// Helper to get API key
const getApiKey = () => {
  const key = process.env.API_KEY;
  if (!key) {
    console.error("API Key not found in environment variables");
  }
  return key || '';
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

/**
 * GENERATE START SCENARIO
 * Selects a random location and generates a noir opening.
 */
export const generateStartScenario = async (): Promise<{
  lat: number;
  lng: number;
  locationName: string;
  introText: string;
}> => {
  // Curated list of atmospheric driving locations
  const scenarios = [
    { lat: 36.2383, lng: -121.7766, locationName: "Big Sur Coast, CA" },
    { lat: 35.0844, lng: -106.6504, locationName: "Route 66, New Mexico" },
    { lat: 47.6062, lng: -122.3321, locationName: "Rainy Seattle Highway" },
    { lat: 25.7617, lng: -80.1918, locationName: "Miami Causeway" },
    { lat: 43.6615, lng: -70.2553, locationName: "Maine Coastal Road" },
    { lat: 36.1699, lng: -115.1398, locationName: "Las Vegas Outskirts" },
    { lat: 30.2672, lng: -97.7431, locationName: "Texas Hill Country" }
  ];

  const selected = scenarios[Math.floor(Math.random() * scenarios.length)];
  const model = 'gemini-2.5-flash';

  const prompt = `
    Write a short, gripping noir-style opening paragraph (2-3 sentences) for a text-based thriller game.
    The player has just realized they are trapped in a car with a dangerous stranger.
    Location: ${selected.locationName}.
    Atmosphere: Tense, claustrophobic, dark.
    End with the stranger saying something ambiguous and unsettling.
    Do not include "Game Start" or meta text.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return {
      ...selected,
      introText: response.text?.trim() || "The engine hums. The driver smiles. 'Long way to go,' he says."
    };
  } catch (error) {
    console.error("Start scenario error", error);
    return {
      ...selected,
      introText: "The lock clicks down. The engine growls. You are trapped."
    };
  }
};

/**
 * FAST AI RESPONSE
 * Uses gemini-2.5-flash for immediate reaction.
 */
export const getPlayerIntuition = async (
  lastPlayerInput: string,
  currentSuspicion: number,
  currentAttention: number,
  isObservation: boolean = false
): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
      You are the inner voice of a kidnapped victim in a car.
      Current Situation: Suspicion Level: ${currentSuspicion}%, Attention/Escape Progress: ${currentAttention}%.
      The player just did/said: "${lastPlayerInput}" (Intent: ${isObservation ? 'OBSERVATION/INSPECTION' : 'ACTION/DIALOGUE'}).
      
      Give a very brief, visceral, internal reaction (1 sentence). 
      
      INSTRUCTION FOR TELLS:
      - If Suspicion is HIGH (>60): Mention sensing the stranger's physical tension (e.g., "You catch his knuckles whitening," "He's breathing too fast").
      - If Suspicion is LOW (<30): Mention his eerie calm.
      - If it was a Risky Move: Highlight the immediate danger.
      
      Do not describe the outcome, just the feeling/observation of the stranger's demeanor.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text?.trim() || "You hold your breath...";
  } catch (error) {
    console.error("Intuition error", error);
    return "Your heart races.";
  }
};

/**
 * MAPS GROUNDING
 * Uses gemini-2.5-flash with googleMaps tool to get real-world context.
 */
export const getLocationContext = async (
  lat: number,
  lng: number
): Promise<{ description: string; places: GroundingLink[] }> => {
  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
      We are driving at coordinates ${lat}, ${lng}.
      Provide a very short, vague visual description of the outside (e.g. "Blur of neon," "Endless cornfields," "Industrial shapes in fog").
      Then add a rough, uncertain guess of the general area.
      Do not be specific about street names. Keep it under 25 words. Noir style.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        }
      }
    });

    const text = response.text || "The road stretches on, dark and indistinct.";
    
    // Extract grounding chunks
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const places: GroundingLink[] = [];

    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri && chunk.web?.title) {
        places.push({ title: chunk.web.title, uri: chunk.web.uri });
      }
      // Maps grounding specific structure often differs, checking common paths
      if (chunk.maps?.placeId && chunk.maps?.title) {
          // Construct a maps link if URI isn't direct
          places.push({ 
              title: chunk.maps.title, 
              uri: `https://www.google.com/maps/place/?q=place_id:${chunk.maps.placeId}` 
          });
      }
    });

    return { description: text, places };
  } catch (error) {
    console.error("Location context error", error);
    return { 
      description: "GPS signal lost. You see only the passing blur of the highway.", 
      places: [] 
    };
  }
};

/**
 * GAME MASTER / STRANGER LOGIC
 * Uses gemini-2.5-flash with Thinking Mode for reliable complex narrative control.
 */
export const processGameTurn = async (
  history: string[],
  playerInput: string,
  locationContext: string,
  currentStats: { suspicion: number; attention: number; lat: number; lng: number },
  currentInventory: Item[],
  isObservation: boolean = false
): Promise<TurnResponse> => {
  try {
    // Switched to gemini-2.5-flash for better stability with Thinking Config
    const model = 'gemini-2.5-flash';
    
    // Construct the context
    const context = `
      You are the Game Master for a text-based thriller game "The Passenger".
      The Player is a captive in a car driven by "The Stranger" (Antagonist).
      
      Current State:
      - Location Context: ${locationContext}
      - Coordinates: ${currentStats.lat}, ${currentStats.lng}
      - Stranger Suspicion: ${currentStats.suspicion} (0-100). If 100, Game Over (Player dies/captured).
      - External Attention: ${currentStats.attention} (0-100). If 100, Game Over (Player escapes/rescued).
      - Player Inventory: ${currentInventory.map(i => i.name).join(', ') || "None"}
      
      Recent History:
      ${history.slice(-3).join('\n')}
      
      Player Input: "${playerInput}"
      Input Mode: ${isObservation ? "OBSERVATION (Detailed Inspection)" : "NORMAL (Dialogue/Action)"}
      
      BEHAVIORAL TELLS (MANDATORY):
      The narrativeAction MUST describe the Stranger's physical state based on Suspicion level:
      - Suspicion 0-30 (Low): Relaxed, one hand on wheel, humming, casual eye contact, smooth driving.
      - Suspicion 31-60 (Medium): Tapping fingers on wheel, checking mirrors frequently, chewing lip, jaw clenching, turning up radio.
      - Suspicion 61-90 (High): Knuckles white on wheel, visible sweat on brow/neck, refusing eye contact, erratic speed, vein pulsing, twitching.
      - Suspicion 90+ (Critical): Reaching for glovebox/weapon, dead silence, sudden braking.
      
      If the player's move is RISKY, describe a sudden "micro-expression" or "tell" (e.g., a flinch, a sharp glance) immediately.

      Task:
      1. Analyze the player's input.
         - If OBSERVATION (General "Look Around"): Provide a cinematic description of the car interior and "Tells" of the stranger. HINT at 2-3 interactable objects.
         - If OBSERVATION (Specific Search): If they search a specific spot, consider giving an ITEM (newItem).
         - If NORMAL: React to dialogue or physical actions.
         - If they USE an item: Describe the effect.
         
      2. Determine "The Stranger's" reaction using the "Tells" logic above.
      3. Decide if the car moves to new coordinates.
      4. Update Suspicion and Attention meters.
      5. Select a Sound Cue if relevant.
      6. Provide 3 Recommendations for the player's next move.
      
      Output JSON ONLY with this schema:
      {
        "strangerDialogue": "What the stranger says.",
        "narrativeAction": "Description of what happens, INCLUDING PHYSICAL TELLS.",
        "recommendations": ["Option 1", "Option 2", "Option 3"],
        "suspicionChange": integer,
        "attentionChange": integer,
        "newItem": { "id": "unique_id", "name": "Item Name", "description": "Short description" } | null,
        "itemRemoved": "item_id_to_remove" | null,
        "newLocation": { "lat": number, "lng": number },
        "gameOver": boolean,
        "gameOverReason": "Reason if game over",
        "soundCue": "string enum"
      }
    `;

    const response = await ai.models.generateContent({
      model,
      contents: context,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingBudget: 15000 // Safe budget for Flash
        }
      }
    });

    const jsonText = response.text || "{}";
    
    // More robust JSON extraction
    let cleanJson = jsonText;
    const jsonBlockMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      cleanJson = jsonBlockMatch[1];
    } else {
       const startIndex = jsonText.indexOf('{');
       const endIndex = jsonText.lastIndexOf('}');
       if (startIndex !== -1 && endIndex !== -1) {
          cleanJson = jsonText.substring(startIndex, endIndex + 1);
       }
    }
    
    const data = JSON.parse(cleanJson);

    // Sanitize numeric inputs
    return {
        ...data,
        suspicionChange: typeof data.suspicionChange === 'number' ? data.suspicionChange : parseInt(data.suspicionChange || '0'),
        attentionChange: typeof data.attentionChange === 'number' ? data.attentionChange : parseInt(data.attentionChange || '0'),
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : []
    } as TurnResponse;

  } catch (error) {
    console.error("Game Master error", error);
    return {
      strangerDialogue: "Don't try anything stupid.",
      narrativeAction: "He grips the steering wheel tighter. The radio buzzes with static.",
      recommendations: ["Stay silent", "Look out the window", "Ask a question"],
      suspicionChange: 5,
      attentionChange: 0,
      soundCue: 'engine_rev'
    };
  }
};