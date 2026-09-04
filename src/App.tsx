import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from './ui/useGame';
import { GameHUD } from './ui/GameHUD';
import { BetSelector } from './ui/BetSelector';
import { AutoSpin } from './ui/AutoSpin';
import { Settings } from './ui/Settings';
import { Paytable } from './ui/Paytable';
import { GameHistory } from './ui/GameHistory';
import { audioManager } from './audio/AudioManager';
import { GAME_CONFIG } from './game/config/game-config';

// Dev-only bundle. `import.meta.env.DEV` folds to `false` in a production build,
// so Rollup drops both the branch and the whole DebugPanel chunk.
const DEV_TOOLS = import.meta.env.DEV;
const DebugPanel = DEV_TOOLS
  ? lazy(() => import('./dev/DebugPanel').then((module) => ({ default: module.DebugPanel })))
  : null;

type Panel = 'paytable' | 'history' | 'settings' | 'autoplay' | 'bet' | null;

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const { engine, renderer, snapshot, ready, progress } = useGame(hostRef);

  const [panel, setPanel] = useState<Panel>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  /* audio can only start from a user gesture */
  useEffect(() => {
    const unlock = () => {
      void audioManager.unlock().then(() => {
        audioManager.startMusic('BASE');
        setAudioReady(true);
      });
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  /* free spins change the whole atmosphere, music included */
  const inBonus = Boolean(snapshot?.freeSpins.active) || snapshot?.state === 'FREE_SPINS';
  useEffect(() => {
    if (!audioReady) return;
    audioManager.switchMusic(inBonus ? 'FREE' : 'BASE');
  }, [inBonus, audioReady]);

  useEffect(() => {
    document.documentElement.dataset.mode = inBonus ? 'free' : 'base';
  }, [inBonus]);


  /* keyboard shortcuts */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyD') {
        event.preventDefault();
        if (DEV_TOOLS) setDebugOpen((v) => !v);
        return;
      }
      if (panel) return;
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        engine?.requestSpin();
      }
      if (event.code === 'KeyI') setPanel('paytable');
      if (event.code === 'KeyH') setPanel('history');
      if (event.code === 'KeyT') engine?.setTurbo(!engine.snapshot().turbo);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, panel]);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      audioManager.setMusicEnabled(next);
      audioManager.setSfxEnabled(next);
      return next;
    });
  }, []);

  return (
    <div className="game-root">
      <div className="stage" ref={hostRef} />

      {engine && snapshot && (
        <GameHUD
          engine={engine}
          snapshot={snapshot}
          soundOn={soundOn}
          onToggleSound={toggleSound}
          onOpen={setPanel}
        />
      )}

      {engine && snapshot && panel === 'bet' && (
        <BetSelector engine={engine} snapshot={snapshot} onClose={() => setPanel(null)} />
      )}
      {engine && panel === 'autoplay' && <AutoSpin engine={engine} onClose={() => setPanel(null)} />}
      {engine && snapshot && panel === 'settings' && (
        <Settings engine={engine} snapshot={snapshot} onClose={() => setPanel(null)} />
      )}
      {panel === 'paytable' && (
        <Paytable
          renderer={renderer}
          bet={snapshot?.bet ?? GAME_CONFIG.betLevels[GAME_CONFIG.defaultBetIndex]}
          onClose={() => setPanel(null)}
        />
      )}
      {engine && panel === 'history' && <GameHistory engine={engine} onClose={() => setPanel(null)} />}

      {DEV_TOOLS && DebugPanel && debugOpen && engine && snapshot && (
        <Suspense fallback={null}>
          <DebugPanel engine={engine} snapshot={snapshot} onClose={() => setDebugOpen(false)} />
        </Suspense>
      )}

      <div className="rotate-hint">↻ Turn your phone for the full cabinet</div>

      <div className={`loading-screen${ready ? ' is-hidden' : ''}`}>
        <div className="loading-screen__inner">
          <img className="logo-img" src="assets/lucky-bandits/logo/lucky-bandits-logo.webp" alt="Lucky Bandits" />
          <div className="loader-bar">
            <span style={{ width: `${Math.round(Math.max(6, progress * 100))}%` }} />
          </div>
          <div className="press-hint">{ready ? 'Ready' : 'Cracking the vault…'}</div>
        </div>
      </div>
    </div>
  );
}
