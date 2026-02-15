export interface LocationData {
  latitude: number;
  longitude: number;
  locationName: string;
  description: string;
  nearbyPlaces: GroundingLink[];
}

export interface GroundingLink {
  title: string;
  uri: string;
}

export interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  type?: 'dialogue' | 'narration' | 'intuition';
}

export interface Item {
  id: string;
  name: string;
  description: string;
}

export interface Recommendation {
  text: string;
  type: 'risky' | 'safe' | 'observation';
}

export interface GameState {
  suspicion: number; // 0-100
  attention: number; // 0-100 (Goal: 100)
  isGameOver: boolean;
  gameOverReason?: string;
  currentLocation: LocationData;
  history: Message[];
  inventory: Item[];
  recommendations: Recommendation[];
  isLoading: boolean;
  loadingStep: string; // 'thinking' | 'scanning' | 'traveling'
  totalTimeSeconds: number;
}

export interface TurnResponse {
  strangerDialogue: string;
  narrativeAction: string;
  recommendations: Recommendation[];
  suspicionChange: number;
  attentionChange: number;
  newItem?: Item;
  itemRemoved?: string;
  newLocation?: { lat: number; lng: number };
  gameOver?: boolean;
  gameOverReason?: string;
  soundCue?: 'engine_rev' | 'heartbeat' | 'radio_static' | 'siren' | 'screech' | 'rain' | 'none';
}

export enum GameStatus {
  START,
  PLAYING,
  WON,
  LOST
}