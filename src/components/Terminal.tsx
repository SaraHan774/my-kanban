import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';
import './Terminal.css';

interface TerminalProps {
  workspacePath: string;
}

export function Terminal({ workspacePath }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Fira Code, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
      },
      rows: 30,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Open terminal in DOM
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Initialize terminal session
    const initTerminal = async () => {
      try {
        const sessionId = await invoke<string>('spawn_terminal', {
          workingDir: workspacePath,
        });
        sessionIdRef.current = sessionId;

        // Listen for terminal output
        const unlisten = await listen<string>(`terminal-output-${sessionId}`, (event) => {
          xterm.write(event.payload);
        });

        // Handle terminal input
        xterm.onData((data) => {
          if (sessionIdRef.current) {
            invoke('write_terminal', {
              sessionId: sessionIdRef.current,
              data,
            });
          }
        });

        return unlisten;
      } catch (error) {
        console.error('Failed to initialize terminal:', error);
        xterm.write('\r\n\x1b[31mFailed to initialize terminal. Make sure you are running the desktop app.\x1b[0m\r\n');
      }
    };

    const unlistenPromise = initTerminal();

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
      if (sessionIdRef.current) {
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          invoke('resize_terminal', {
            sessionId: sessionIdRef.current,
            cols: dims.cols,
            rows: dims.rows,
          });
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      unlistenPromise.then((unlisten) => {
        if (unlisten) unlisten();
      });
      if (sessionIdRef.current) {
        invoke('close_terminal', { sessionId: sessionIdRef.current });
      }
      xterm.dispose();
    };
  }, [workspacePath]);

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span className="terminal-title">Terminal</span>
        <span className="terminal-path">{workspacePath}</span>
      </div>
      <div ref={terminalRef} className="terminal" />
    </div>
  );
}
