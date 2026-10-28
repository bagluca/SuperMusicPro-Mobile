import React, { useState, useEffect, useRef } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import HomeView from './components/HomeView';
import SearchView from './components/SearchView';
import PlaylistView from './components/PlaylistView';
import LyricsView from './components/LyricsView';
import DownloadsView from './components/DownloadsView';
import SleepTimerModal from './components/SleepTimerModal';
import SettingsModal from './components/SettingsModal';
import InfoModal from './components/InfoModal';
import CreatePlaylistModal from './components/CreatePlaylistModal';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import PlaylistsOverviewView from './components/PlaylistsOverviewView';
import QueueView from './components/QueueView';
import GlitchEasterEgg from './components/GlitchEasterEgg';
import MobileNavBar from './components/MobileNavBar';
import SongRecognitionModal from './components/SongRecognitionModal';

import { musicService, FULL_CATALOG } from './services/musicService';
import { storageService } from './services/storageService';
import { audioEngine } from './services/audioEngine';

const isSameTrack = (a, b) => {
