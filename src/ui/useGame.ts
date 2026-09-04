import { useEffect, useRef, useState, type RefObject } from 'react';
import { GameEngine, type GameSnapshot } from '../game/GameEngine';
import { RemoteGameAPI } from '../game/api/GameAPI';
import { GameRenderer } from '../render/GameRenderer';
import { audioManager } from '../audio/AudioManager';
import gsap from 'gsap';

export interface GameHandle {
  engine: GameEngine | null;
  renderer: GameRenderer | null;
  snapshot: GameSnapshot | null;
  ready: boolean;
  progress: number;
  plate: { x: number; y: number; width: number; height: number; scale: number };
}

/**
 * Boots the engine + PixiJS renderer once and keeps a React snapshot in sync.
 * The UI is a pure view of the engine state — it never mutates the balance itself.
 */
export function useGame(hostRef: RefObject<HTMLDivElement | null>): GameHandle {
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [plate, setPlate] = useState({ x: 0, y: 0, width: 0, height: 0, scale: 1 });

  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;

    // A server URL in the environment hands RNG, maths and the wallet to the casino
    // backend; without it the game runs the built-in demo engine in the browser.
    const apiUrl = import.meta.env.VITE_GAME_API_URL;
    const apiToken = import.meta.env.VITE_GAME_API_TOKEN;
    const engine = new GameEngine(
      apiUrl && apiToken ? { api: new RemoteGameAPI(apiUrl, apiToken) } : {},
    );
    const renderer = new GameRenderer({ audio: audioManager });
    engineRef.current = engine;
    rendererRef.current = renderer;

    const unsubscribe = engine.subscribe(setSnapshot);

    void (async () => {
      await renderer.init(host, setProgress);
      if (disposed) return;
      engine.attachPresenter(renderer);
      engine.attachAudio(audioManager);
      await engine.start();
      if (disposed) return;
      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__neon = { engine, renderer, gsap, audio: audioManager };
      }
      setReady(true);
    })();

    return () => {
      disposed = true;
      unsubscribe();
      renderer.destroy();
      engineRef.current = null;
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the reference plate defines the composition: publish where it landed so the DOM
  // controls can sit exactly on their painted counterparts
  useEffect(() => {
    if (!ready) return;
    const renderer = rendererRef.current;
    if (!renderer) return;
    const apply = (rect: { x: number; y: number; width: number; height: number; scale: number }) => {
      const root = document.documentElement;
      root.style.setProperty('--px', `${rect.x}px`);
      root.style.setProperty('--py', `${rect.y}px`);
      root.style.setProperty('--ps', `${rect.scale}`);
      setPlate(rect);
    };
    renderer.onPlateRect = apply;
    apply(renderer.plateRect);
    return () => {
      renderer.onPlateRect = null;
    };
  }, [ready]);

  return {
    engine: engineRef.current,
    renderer: rendererRef.current,
    snapshot,
    ready,
    progress,
    plate,
  };
}
