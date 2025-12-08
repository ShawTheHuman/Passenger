import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send, AlertTriangle, Eye, Car, Play, Skull, Search, MessageSquare, Volume2, VolumeX, Binoculars, Loader2, Sparkles } from 'lucide-react';
import { GameState, Message, GameStatus, LocationData } from './types';
import { getPlayerIntuition, getLocationContext, processGameTurn, generateStartScenario } from './services/geminiService';
import { audioService } from './services/audioService';
import { ChatInterface } from './components/ChatInterface';
import { Meter } from './components/Meter';
import { LocationCard } from './components/LocationCard';
import { InventoryList } from './components/InventoryList';
import { GameTimer } from './components/GameTimer';

// Fallback initial coordinates
const START_LAT = 36.1699;
const START_LNG = -115.1398;
const STORAGE_KEY = 'passenger_game_save';

export default function App() {
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [input, setInput] = useState('');
  const [isObservationMode, setIsObservationMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  
  const [gameState, setGameState] = useState<GameState>({
    suspicion: 10,
    attention: 0,
    isGameOver: false,
    currentLocation: {
      latitude: START_LAT,
      longitude: START_LNG,
      locationName: "Unknown",
      description: "The road is dark.",
      nearbyPlaces: []
    },
    history: [],
    inventory: [],
    recommendations: ["Ask where we're going", "Look out the window", "Check the door lock"],
    isLoading: false,
    loadingStep: '',
    totalTimeSeconds: 0
  });

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && !parsed.isGameOver) {
          // Ensure totalTimeSeconds exists for backward compatibility
          if (typeof parsed.totalTimeSeconds === 'undefined') {
            parsed.totalTimeSeconds = 0;
          }
          setGameState(parsed);
          setStatus(GameStatus.PLAYING);
        }
      } catch (e) {
        console.error("Failed to load save", e);
      }
    }
  }, []);

  // Timer Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === GameStatus.PLAYING && !gameState.isGameOver && !gameState.isLoading) {
      interval = setInterval(() => {
        setGameState(prev => ({
          ...prev,
          totalTimeSeconds: (prev.totalTimeSeconds || 0) + 1
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, gameState.isGameOver, gameState.isLoading]);

  // Save to LocalStorage on state change
  useEffect(() => {
    if (status === GameStatus.PLAYING && !gameState.isGameOver) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    } else if (status === GameStatus.WON || status === GameStatus.LOST || gameState.isGameOver) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [gameState, status]);

  const startGame = async () => {
    setIsStarting(true);
    
    try {
      // 1. Generate Random Scenario
      const scenario = await generateStartScenario();
      
      // 2. Initialize Game State with Scenario
      const initialHistory: Message[] = [{ 
        role: 'model', 
        content: scenario.introText, 
        timestamp: Date.now(), 
        type: 'dialogue' 
      }];

      setGameState({
        suspicion: 15,
        attention: 0,
        isGameOver: false,
        currentLocation: {
          latitude: scenario.lat,
          longitude: scenario.lng,
          locationName: scenario.locationName,
          description: "The journey begins...",
          nearbyPlaces: []
        },
        history: initialHistory,
        inventory: [],
        recommendations: ["Ask where we're going", "Look out the window", "Stay silent"],
        isLoading: false,
        loadingStep: '',
        totalTimeSeconds: 0
      });

      setStatus(GameStatus.PLAYING);
      
      // 3. Start Audio & Fetch Details
      await audioService.startAmbience();
      updateLocationContext(scenario.lat, scenario.lng);
      
    } catch (e) {
      console.error("Failed to start game", e);
      // Fallback start if generation fails
      setStatus(GameStatus.PLAYING);
      setGameState(prev => ({
        ...prev,
        history: [{ 
            role: 'model', 
            content: "The engine hums. The driver smiles. 'Long way to go,' he says.", 
            timestamp: Date.now(), 
            type: 'dialogue' 
        }],
        totalTimeSeconds: 0
      }));
      await audioService.startAmbience();
    } finally {
      setIsStarting(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      audioService.startAmbience();
      setIsMuted(false);
    } else {
      audioService.stopAll();
      setIsMuted(true);
    }
  };

  const updateLocationContext = async (lat: number, lng: number) => {
    const context = await getLocationContext(lat, lng);
    setGameState(prev => ({
      ...prev,
      currentLocation: {
        ...prev.currentLocation,
        latitude: lat,
        longitude: lng,
        description: context.description,
        nearbyPlaces: context.places
      }
    }));
    return context;
  };

  const handleUseItem = (itemName: string) => {
      setInput(`Use ${itemName}`);
      const inputEl = document.querySelector('input');
      if (inputEl) inputEl.focus();
  };

  const executeTurn = async (turnInput: string, isObservation: boolean) => {
    if (!turnInput.trim() || gameState.isLoading || gameState.isGameOver) return;

    const userMsg: Message = { role: 'user', content: turnInput, timestamp: Date.now() };
    const newHistory = [...gameState.history, userMsg];
    
    setGameState(prev => ({
      ...prev,
      history: newHistory,
      isLoading: true,
      recommendations: [], // Clear recommendations while loading
      loadingStep: 'analyzing'
    }));
    // Only clear input if it matches what we sent (to avoid clearing partial typing if triggered by button)
    if (turnInput === input) setInput('');

    // 1. FAST RESPONSE: Intuition
    const intuitionPromise = getPlayerIntuition(
      turnInput, 
      gameState.suspicion, 
      gameState.attention, 
      isObservation
    );
    
    // 2. MAIN LOGIC
    const locString = `Lat: ${gameState.currentLocation.latitude}, Lng: ${gameState.currentLocation.longitude}. ${gameState.currentLocation.description}`;
    const historyText = newHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).slice(-10);

    try {
      setGameState(prev => ({ ...prev, loadingStep: 'thinking' }));
      
      const [intuitionText, turnResult] = await Promise.all([
        intuitionPromise,
        processGameTurn(
          historyText, 
          turnInput, 
          locString, 
          {
            suspicion: gameState.suspicion,
            attention: gameState.attention,
            lat: gameState.currentLocation.latitude,
            lng: gameState.currentLocation.longitude
          },
          gameState.inventory,
          isObservation
        )
      ]);

      // Calculate future stats
      const newSuspicion = Math.max(0, Math.min(100, gameState.suspicion + turnResult.suspicionChange));
      const newAttention = Math.max(0, Math.min(100, gameState.attention + turnResult.attentionChange));

      // Determine Game Over & Sounds
      let gameOver = turnResult.gameOver || false;
      let reason = turnResult.gameOverReason;
      let soundToPlay = turnResult.soundCue;

      if (newSuspicion >= 100) {
        gameOver = true;
        reason = reason || "The stranger realized your plan. He stops the car abruptly.";
        setStatus(GameStatus.LOST);
        soundToPlay = 'screech';
      } else if (newAttention >= 100) {
        gameOver = true;
        reason = reason || "A police cruiser lights up behind you. You've been spotted! The stranger panics.";
        setStatus(GameStatus.WON);
        soundToPlay = 'siren';
      }

      // Play determined sound
      if (!isMuted && soundToPlay && soundToPlay !== 'none') {
        audioService.playCue(soundToPlay);
      }
      
      // Update ambient engine pitch based on suspicion (tension)
      if (!isMuted) {
          audioService.updateEngine(newSuspicion / 100);
      }

      // Add intuition message
      const intuitionMsg: Message = {
        role: 'model',
        content: intuitionText,
        timestamp: Date.now(),
        type: 'intuition'
      };

      const modelMessages: Message[] = [];
      modelMessages.push(intuitionMsg);

      if (turnResult.newItem) {
        modelMessages.push({
          role: 'system',
          content: `You found: ${turnResult.newItem.name}`,
          timestamp: Date.now() + 0.5,
          type: 'narration'
        });
      }

      if (turnResult.narrativeAction) {
        modelMessages.push({
          role: 'model',
          content: turnResult.narrativeAction,
          timestamp: Date.now() + 1,
          type: 'narration'
        });
      }

      if (turnResult.strangerDialogue) {
        modelMessages.push({
          role: 'model',
          content: turnResult.strangerDialogue,
          timestamp: Date.now() + 2,
          type: 'dialogue'
        });
      }

      // 3. Update State
      let newLat = gameState.currentLocation.latitude;
      let newLng = gameState.currentLocation.longitude;
      
      if (turnResult.newLocation) {
        newLat = turnResult.newLocation.lat;
        newLng = turnResult.newLocation.lng;
        updateLocationContext(newLat, newLng);
      }

      // Inventory Management
      let updatedInventory = [...gameState.inventory];
      if (turnResult.newItem) {
        updatedInventory.push(turnResult.newItem);
      }
      if (turnResult.itemRemoved) {
        updatedInventory = updatedInventory.filter(i => i.id !== turnResult.itemRemoved);
      }

      setGameState(prev => ({
        ...prev,
        history: [...newHistory, ...modelMessages],
        suspicion: newSuspicion,
        attention: newAttention,
        isGameOver: gameOver,
        gameOverReason: reason,
        currentLocation: {
            ...prev.currentLocation,
            latitude: newLat,
            longitude: newLng
        },
        inventory: updatedInventory,
        recommendations: turnResult.recommendations || [],
        isLoading: false,
        loadingStep: ''
      }));

    } catch (e) {
      console.error(e);
      setGameState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleSend = () => {
      executeTurn(input, isObservationMode);
  };

  const handleLookAround = () => {
      executeTurn("I carefully look around the car interior and out the window for potential items or escape routes.", true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Start Screen
  if (status === GameStatus.START) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1495570689269-d883668a6196?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
        <div className="max-w-md z-10 space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-gray-100 to-gray-600">
              THE PASSENGER
            </h1>
            <p className="text-emerald-500 font-mono text-sm tracking-widest uppercase animate-pulse-slow">
              AI-Powered Survival Thriller
            </p>
          </div>
          <p className="text-gray-400 text-lg leading-relaxed">
            You accepted a ride from a stranger. Now you realize it was a mistake. 
            <br/><br/>
            Travel through <span className="text-gray-200">real-world locations</span>. 
            Manage your <span className="text-red-400">Suspicion</span>. 
            Gain <span className="text-blue-400">Attention</span> to escape.
          </p>
          <button 
            onClick={startGame}
            disabled={isStarting}
            className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-md bg-white px-8 font-medium text-black transition-all duration-300 hover:bg-gray-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isStarting ? (
              <span className="mr-2 flex items-center gap-2">
                 <Loader2 className="animate-spin" size={20} /> GENERATING...
              </span>
            ) : (
              <span className="mr-2">
                  {localStorage.getItem(STORAGE_KEY) ? "RESUME JOURNEY" : "ENTER VEHICLE"}
              </span>
            )}
            {!isStarting && <Car size={20} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </div>
      </div>
    );
  }

  // Game Over Screen
  if (gameState.isGameOver) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative">
        <div className={`absolute inset-0 opacity-10 ${status === GameStatus.WON ? 'bg-blue-900' : 'bg-red-900'}`} />
        <div className="max-w-lg z-10 text-center space-y-6 border border-gray-800 bg-black/80 p-10 rounded-xl backdrop-blur-sm">
          {status === GameStatus.WON ? (
            <div className="text-blue-500 mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-blue-500/10 mb-4">
              <Eye size={32} />
            </div>
          ) : (
            <div className="text-red-500 mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-red-500/10 mb-4">
              <Skull size={32} />
            </div>
          )}
          
          <h2 className="text-3xl font-bold uppercase tracking-widest">
            {status === GameStatus.WON ? "ESCAPED" : "LOST"}
          </h2>
          
          <p className="text-gray-300 font-mono text-sm border-t border-b border-gray-800 py-6">
            {gameState.gameOverReason}
          </p>

           <div className="flex flex-col gap-2 mb-6 text-gray-400 font-mono text-xs">
              <p>Duration: {new Date(gameState.totalTimeSeconds * 1000).toISOString().substr(11, 8)}</p>
           </div>

          <button 
            onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                window.location.reload();
            }}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors uppercase text-xs tracking-widest"
          >
            <Play size={14} /> Play Again
          </button>
        </div>
      </div>
    );
  }

  // Main Game UI
  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-[#050505] overflow-hidden text-gray-200">
      
      {/* Left Sidebar: Dashboard */}
      <div className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-[#0a0a0a] border-r border-gray-800 flex flex-col p-4 md:p-6 gap-6 z-20 shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-800 pb-4 flex-shrink-0">
          <h1 className="text-lg font-bold tracking-tighter text-gray-100">THE PASSENGER</h1>
          <div className="flex gap-4 items-center">
             <button onClick={toggleMute} className="text-gray-500 hover:text-gray-300">
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
             </button>
            <div className="flex gap-2 items-center">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-[10px] text-gray-500 font-mono">REC</span>
            </div>
          </div>
        </div>

        <GameTimer totalSeconds={gameState.totalTimeSeconds || 0} />

        <div className="space-y-6 flex-shrink-0">
          <Meter 
            label="Suspicion" 
            value={gameState.suspicion} 
            color="bg-gradient-to-r from-orange-600 to-red-600" 
            icon={<AlertTriangle size={14} className="text-orange-500" />}
          />
          <Meter 
            label="Attention (Escape)" 
            value={gameState.attention} 
            color="bg-gradient-to-r from-blue-600 to-cyan-500"
            icon={<Eye size={14} className="text-blue-500" />}
          />
        </div>

        <LocationCard location={gameState.currentLocation} />
        
        <InventoryList 
            items={gameState.inventory} 
            onUseItem={handleUseItem}
            disabled={gameState.isLoading}
        />
      </div>

      {/* Main Area: Chat & Input */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Header Overlay for Mobile */}
        <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />
        
        <ChatInterface 
          messages={gameState.history} 
          isLoading={gameState.isLoading}
          loadingMessage={
            gameState.loadingStep === 'thinking' ? "Stranger is reacting..." :
            gameState.loadingStep === 'analyzing' ? "Analyzing move..." : "Loading..."
          }
        />

        <div className="p-4 md:p-6 bg-[#050505] border-t border-gray-800">
          
          {/* Quick Actions / Recommendations */}
          <div className="mb-4 flex flex-wrap gap-2 justify-center md:justify-start">
             {!gameState.isLoading && gameState.recommendations && gameState.recommendations.map((rec, idx) => (
               <button
                 key={idx}
                 onClick={() => executeTurn(rec, false)}
                 className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 hover:bg-emerald-900 border border-gray-700 hover:border-emerald-700 transition-all text-xs text-gray-300 hover:text-emerald-100 group"
               >
                 <Sparkles size={12} className="text-gray-500 group-hover:text-emerald-400" />
                 {rec}
               </button>
             ))}
          </div>

          <div className="relative max-w-4xl mx-auto flex gap-3 items-end">
             {/* Observation Mode Toggle */}
            <div className="flex flex-col gap-2">
                <button
                    onClick={handleLookAround}
                    disabled={gameState.isLoading}
                    className="flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border bg-emerald-900/10 border-emerald-900/40 text-emerald-500 hover:bg-emerald-900/20"
                    title="Look Around carefully"
                >
                    <Binoculars size={20} />
                    <span className="text-[9px] uppercase font-bold tracking-wider">Look</span>
                </button>
             </div>

             <button
                onClick={() => setIsObservationMode(!isObservationMode)}
                disabled={gameState.isLoading}
                className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border ${
                  isObservationMode 
                    ? 'bg-blue-900/20 border-blue-500 text-blue-400' 
                    : 'bg-[#111] border-gray-800 text-gray-400 hover:bg-gray-800'
                }`}
                title={isObservationMode ? "Switch to Action/Talk" : "Switch to Observation Mode"}
              >
                {isObservationMode ? <Search size={20} /> : <MessageSquare size={20} />}
                <span className="text-[9px] uppercase font-bold tracking-wider">
                  {isObservationMode ? "Scan" : "Act"}
                </span>
              </button>

            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isObservationMode ? "What are you examining? (e.g. 'the glovebox')" : "What do you do? (e.g., 'Ask for water', 'Use pocket knife')"}
                disabled={gameState.isLoading}
                className={`w-full bg-[#111] text-gray-100 rounded-xl pl-4 pr-12 py-4 focus:outline-none focus:ring-2 border transition-all disabled:opacity-50 ${
                  isObservationMode 
                    ? 'border-blue-900/50 focus:ring-blue-500 placeholder-blue-300/30' 
                    : 'border-gray-800 focus:ring-emerald-900 placeholder-gray-600'
                }`}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || gameState.isLoading}
                className={`absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center rounded-lg transition-all disabled:bg-transparent disabled:text-gray-700 ${
                  isObservationMode
                   ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-800 hover:text-white'
                   : 'bg-gray-800 text-gray-300 hover:bg-emerald-700 hover:text-white'
                }`}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
          <div className="text-center mt-3">
             <span className="text-[10px] text-gray-600 uppercase tracking-widest font-mono">
               Powered by Gemini 2.5 Flash
             </span>
          </div>
        </div>
      </div>

    </div>
  );
}