// src/hooks/useGame.js
// High-level hook that wires gameService events into the Zustand store.
// Use this in top-level components (App, GamePage, etc.)

import { useEffect, useRef } from 'react';
import useGameStore from '../store/gameStore';
import {
  onPlayerJoined, onPlayerLeft, onRoleAssigned,
  onPhaseChange, onChat, onTimerTick, onRoundResult, onGameEnd,
} from '../services/gameService';

export function useGameEvents() {
  const store = useGameStore();
  const storeRef = useRef(useGameStore.getState);

  useEffect(() => {
    const unsubs = [
      onPlayerJoined(({ player }) => {
        useGameStore.getState().addPlayer(player);
      }),
      onPlayerLeft(({ playerId }) => {
        useGameStore.getState().removePlayer(playerId);
        useGameStore.getState().addMessage({
          senderId: 'system',
          senderName: 'System',
          text: 'A player left the game.',
          type: 'system',
          timestamp: Date.now(),
        });
      }),
      onRoleAssigned(({ role }) => {
        useGameStore.getState().setMyRole(role);
      }),
      onPhaseChange(({ phase, policePlayerId }) => {
        useGameStore.getState().setPhase(phase);
        if (policePlayerId) {
          useGameStore.getState().setPolicePlayerId(policePlayerId);
        }
      }),
      onChat((msg) => {
        useGameStore.getState().addMessage({ ...msg, timestamp: Date.now() });
      }),
      onTimerTick(({ seconds }) => {
        useGameStore.getState().setTimerSeconds(seconds);
      }),
      onRoundResult((result) => {
        useGameStore.getState().setRoundResult(result);
      }),
      onGameEnd(() => {
        // Phase already set to final-leaderboard by phaseChange event
      }),
    ];

    return () => unsubs.forEach((u) => u && u());
  }, []);
}

export default useGameEvents;
