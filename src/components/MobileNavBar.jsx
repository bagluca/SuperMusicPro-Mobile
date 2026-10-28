import React from 'react';
import { Home, Search, Library, FolderDown, FileText } from 'lucide-react';

export default function MobileNavBar({
  currentView,
  setCurrentView,
  setSelectedPlaylistId,
  onOpenLyrics,
  isLyricsOpen
}) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Cerca', icon: Search },
    { id: 'playlists', label: 'Playlist', icon: Library },
    { id: 'downloads', label: 'Libreria', icon: FolderDown },
    { id: 'lyrics', label: 'Testi', icon: FileText },
  ];

  return (
    <nav 
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      className="md:hidden w-full theme-bg-secondary border-t theme-border shrink-0 z-40 select-none"
    >
      <div className="w-full h-12 flex items-center justify-around px-1">
        {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = 
          (item.id === 'lyrics' && isLyricsOpen) || 
          (item.id === 'playlists' && (currentView === 'playlists' || currentView === 'playlist' || currentView === 'liked')) ||
          (currentView === item.id && !isLyricsOpen);

        return (
          <button
            key={item.id}
            onClick={() => {
              if (setSelectedPlaylistId) {
                setSelectedPlaylistId(null);
              }
              if (item.id === 'lyrics') {
                onOpenLyrics();
              } else if (item.id === 'playlists') {
                setCurrentView('playlists');
              } else {
                setCurrentView(item.id);
              }
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all shrink-0 min-w-0 ${
              isActive
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className="text-[10px] mt-0.5 tracking-tight leading-tight shrink-0 max-w-full truncate">{item.label}</span>
          </button>
        );
      })}
      </div>
    </nav>
  );
}
