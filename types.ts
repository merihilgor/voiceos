import React from 'react';

export type ThemeMode = 'light' | 'dark';

export interface WindowState {
  id: string;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

export interface OSContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  volume: number;
  setVolume: (vol: number) => void;
  brightness: number;
  setBrightness: (level: number) => void;
  windows: WindowState[];
  openApp: (appId: string) => void;
  closeApp: (appId: string) => void;
  focusWindow: (appId: string) => void;
  toggleMinimize: (appId: string) => void;
  activeWindowId: string | null;
}

export interface AppDefinition {
  id: string;
  name: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}