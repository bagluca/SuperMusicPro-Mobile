package com.supermusicpro.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.MediaBrowserServiceCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaButtonReceiver;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.ResolvingDataSource;
import androidx.media3.datasource.okhttp.OkHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.extractor.DefaultExtractorsFactory;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class MusicPlayerService extends MediaBrowserServiceCompat {
    private static final String TAG = "MusicPlayerService";

    public static final String MEDIA_ROOT_ID = "supermusic_root_id";
    public static final String TAB_ALL = "tab_all";
    public static final String TAB_MUSIC = "tab_music";
    public static final String TAB_TRENDING = "tab_trending";
    public static final String TAB_FAVORITES = "tab_favorites";

    public static final String MEDIA_ID_NOW_PLAYING = "supermusic_now_playing";
    public static final String MEDIA_ID_QUEUE = "supermusic_cat_queue";
    public static final String MEDIA_ID_FAVORITES = "supermusic_cat_favorites";
    public static final String MEDIA_ID_PLAYLISTS = "supermusic_cat_playlists";
    public static final String MEDIA_ID_TRENDING = "supermusic_cat_trending";
    public static final String MEDIA_ID_NEW_RELEASES = "supermusic_cat_new_releases";
    public static final String MEDIA_ID_MOST_PLAYED = "supermusic_cat_most_played";
    public static final String MEDIA_ID_DAILY_MIX = "supermusic_cat_daily_mix";
    public static final String MEDIA_ID_DJ = "supermusic_cat_dj";
    public static final String MEDIA_ID_GENRES = "supermusic_cat_genres";
    public static final String MEDIA_ID_SEARCH = "supermusic_cat_search";
    public static final String MEDIA_ID_LOCAL = "supermusic_local_library";

    public static final String CHANNEL_ID = "supermusic_media_channel";
    public static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_UPDATE = "com.supermusicpro.app.ACTION_UPDATE";
    public static final String ACTION_PLAY_URL = "com.supermusicpro.app.ACTION_PLAY_URL";
    public static final String ACTION_SEEK = "com.supermusicpro.app.ACTION_SEEK";
    public static final String ACTION_SET_VOLUME = "com.supermusicpro.app.ACTION_SET_VOLUME";
    public static final String ACTION_STOP = "com.supermusicpro.app.ACTION_STOP";
    public static final String ACTION_CLOSE_APP = "com.supermusicpro.app.ACTION_CLOSE_APP";
    public static final String ACTION_PLAY = "com.supermusicpro.app.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.supermusicpro.app.ACTION_PAUSE";
    public static final String ACTION_PREV = "com.supermusicpro.app.ACTION_PREV";
    public static final String ACTION_NEXT = "com.supermusicpro.app.ACTION_NEXT";

    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_ARTIST = "extra_artist";
    public static final String EXTRA_COVER = "extra_cover";
    public static final String EXTRA_PLAYING = "extra_playing";
    public static final String EXTRA_URL = "extra_url";
    public static final String EXTRA_VIDEO_ID = "extra_video_id";
    public static final String EXTRA_SEEK_MS = "extra_seek_ms";
    public static final String EXTRA_VOLUME = "extra_volume";

    private static volatile MusicPlayerService instance;

    public static MusicPlayerService getInstance() {
        return instance;
    }

    public static class NativeTrackItem {
        public String title;
        public String artist;
        public String cover;
        public String videoId;
        public String url;
    }

    public static class NativePlaylistItem {
        public String id;
        public String name;
        public String cover;
        public List<NativeTrackItem> tracks = new ArrayList<>();
    }

    private final List<NativeTrackItem> nativeQueue = new ArrayList<>();
    private int nativeQueueIndex = 0;
    private final List<NativeTrackItem> nativeFavorites = new ArrayList<>();
    private final List<NativePlaylistItem> nativePlaylists = new ArrayList<>();
    private final List<NativeTrackItem> nativeTrending = new ArrayList<>();
    private final List<NativeTrackItem> nativeNewReleases = new ArrayList<>();
    private final List<NativeTrackItem> nativeCatalog = new ArrayList<>();
    private final Map<String, List<NativeTrackItem>> categoryCache = new HashMap<>();
    private String lastSearchQuery = "";
    private int lastSearchLimit = 20;

    private MediaSessionCompat mediaSession;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private ExoPlayer exoPlayer;
    private OkHttpClient okHttpClient;

    private final ExecutorService executorService = Executors.newSingleThreadExecutor();
    private final ExecutorService coverExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private String currentTitle = "SuperMusic PRO";
    private String currentArtist = "In riproduzione";
    private String currentCover = "";
    private String currentVideoId = "";
    private volatile String currentStreamUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
    private volatile long currentRangeChunkBytes = 512L * 1024L;
    private volatile String cachedVisitorData = null;
    private boolean hasRetriedNatively = false;
    private boolean isPlaying = false;
    private boolean isInForeground = false;
    private Bitmap cachedCoverBitmap = null;
    private String cachedCoverUrl = null;
    private volatile String loadingCoverUrl = null;
    private long lastMediaSessionSyncMs = 0;

    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (exoPlayer != null && exoPlayer.isPlaying()) {
                long posMs = exoPlayer.getCurrentPosition();
                long durMs = exoPlayer.getDuration();
                long durSec = durMs > 0 ? durMs / 1000 : 180;

                if (MainActivity.isActivityResumed) {
                    MusicNotificationPlugin.dispatchPlaybackProgress((double) posMs / 1000.0, durSec);
                }

                // Sync MediaSession position with real ExoPlayer timestamp periodically (every 2.5s)
                // This guarantees Android Auto's progress bar never drifts and stays 100% in sync with audio!
                long now = android.os.SystemClock.elapsedRealtime();
                if (now - lastMediaSessionSyncMs >= 2500) {
                    lastMediaSessionSyncMs = now;
                    syncMediaSessionPosition(posMs);
                }
            }
            progressHandler.postDelayed(this, 350);
        }
    };

    public void syncMediaSessionPosition(long posMs) {
        if (mediaSession == null || exoPlayer == null) return;
        try {
            long actions = PlaybackStateCompat.ACTION_PLAY |
                    PlaybackStateCompat.ACTION_PAUSE |
                    PlaybackStateCompat.ACTION_PLAY_PAUSE |
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                    PlaybackStateCompat.ACTION_SEEK_TO |
                    PlaybackStateCompat.ACTION_STOP |
                    PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID |
                    PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH;

            int state = exoPlayer.isPlaying() ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
            if (exoPlayer.getPlaybackState() == Player.STATE_BUFFERING) {
                state = PlaybackStateCompat.STATE_BUFFERING;
            }

            mediaSession.setPlaybackState(
                    new PlaybackStateCompat.Builder()
                            .setActions(actions)
                            .setState(state, posMs, 1.0f)
                            .build()
            );

            long durMs = exoPlayer.getDuration();
            if (durMs > 0) {
                MediaMetadataCompat currentMeta = mediaSession.getController().getMetadata();
                long metaDur = currentMeta != null ? currentMeta.getLong(MediaMetadataCompat.METADATA_KEY_DURATION) : 0;
                if (metaDur <= 0 || Math.abs(metaDur - durMs) > 1000) {
                    MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
                            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "SuperMusic PRO")
                            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durMs);

                    if (cachedCoverBitmap != null) {
                        metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, cachedCoverBitmap);
                    }
                    mediaSession.setMetadata(metaBuilder.build());
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error syncing MediaSession position", e);
        }
    }

    public void syncWithUiNow() {
        mainHandler.post(() -> {
            if (exoPlayer != null) {
                long posMs = exoPlayer.getCurrentPosition();
                long durMs = exoPlayer.getDuration();
                long durSec = durMs > 0 ? durMs / 1000 : 180;
                MusicNotificationPlugin.dispatchPlaybackProgress((double) posMs / 1000.0, durSec);
                MusicNotificationPlugin.dispatchPlaybackState(exoPlayer.isPlaying());
            }
        });
    }

    public void pauseDirect() {
        mainHandler.post(() -> {
            if (exoPlayer != null) {
                exoPlayer.pause();
            }
        });
    }

    public void resumeDirect() {
        mainHandler.post(() -> {
            if (exoPlayer != null) {
                exoPlayer.play();
            }
        });
    }

    public void seekDirect(long seekMs) {
        mainHandler.post(() -> {
            if (exoPlayer != null) {
                exoPlayer.seekTo(seekMs);
            }
        });
    }

    public void setVolumeDirect(float volume) {
        mainHandler.post(() -> {
            if (exoPlayer != null) {
                exoPlayer.setVolume(volume);
            }
        });
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createNotificationChannel();

        initMediaSession();
        if (mediaSession != null) {
            setSessionToken(mediaSession.getSessionToken());
        }
        startForegroundSafely(buildNotification(null));

        initExoPlayer();

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SuperMusic:PlaybackWakeLock");
            wakeLock.setReferenceCounted(false);
        }

        try {
            WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null) {
                wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "SuperMusic:WifiLock");
                wifiLock.setReferenceCounted(false);
            }
        } catch (Exception ignored) {}

        loadFavoritesAndPlaylistsFromStorage();
        initDefaultCatalog();
        executorService.execute(() -> {
            try {
                List<InnerTubeTrack> liveTrending = fetchInnerTubeTracks("Hit del momento Italia", 25);
                if (liveTrending != null && !liveTrending.isEmpty()) {
                    synchronized (nativeTrending) {
                        nativeTrending.clear();
                        for (InnerTubeTrack tr : liveTrending) {
                            NativeTrackItem item = new NativeTrackItem();
                            item.title = tr.title;
                            item.artist = tr.artist;
                            item.cover = tr.thumbnail;
                            item.videoId = tr.videoId;
                            item.url = "";
                            nativeTrending.add(item);
                        }
                    }
                    mainHandler.post(() -> {
                        notifyChildrenChanged(TAB_ALL);
                        notifyChildrenChanged(TAB_TRENDING);
                        notifyChildrenChanged(MEDIA_ID_TRENDING);
                    });
                }

                List<InnerTubeTrack> liveNew = fetchInnerTubeTracks("Nuove Uscite Italia", 15);
                if (liveNew != null && !liveNew.isEmpty()) {
                    synchronized (nativeNewReleases) {
                        nativeNewReleases.clear();
                        for (InnerTubeTrack tr : liveNew) {
                            NativeTrackItem item = new NativeTrackItem();
                            item.title = tr.title;
                            item.artist = tr.artist;
                            item.cover = tr.thumbnail;
                            item.videoId = tr.videoId;
                            item.url = "";
                            nativeNewReleases.add(item);
                        }
                    }
                    mainHandler.post(() -> {
                        notifyChildrenChanged(TAB_ALL);
                        notifyChildrenChanged(MEDIA_ID_NEW_RELEASES);
                    });
                }
            } catch (Exception ignored) {}
        });

        progressHandler.post(progressRunnable);
    }

    private void initExoPlayer() {
        try {
            okHttpClient = new OkHttpClient.Builder()
                    .connectTimeout(5, TimeUnit.SECONDS)
                    .readTimeout(8, TimeUnit.SECONDS)
                    .followRedirects(true)
                    .followSslRedirects(true)
                    .retryOnConnectionFailure(true)
                    .build();

            OkHttpDataSource.Factory okHttpDataSourceFactory = new OkHttpDataSource.Factory(okHttpClient);

            DefaultDataSource.Factory baseDataSourceFactory = new DefaultDataSource.Factory(this, okHttpDataSourceFactory);

            // ResolvingDataSource architecture:
            // 1. Dynamically attaches the matching client User-Agent header to each HTTP request
            // 2. Converts unbounded Range requests (length == C.LENGTH_UNSET) on googlevideo.com into
            //    bounded range chunks (subrange(0, rangeChunkSizeBytes)) to prevent YouTube CDN HTTP 403!
            ResolvingDataSource.Factory resolvingDataSourceFactory = new ResolvingDataSource.Factory(
                    baseDataSourceFactory,
                    dataSpec -> {
                        String uriStr = dataSpec.uri != null ? dataSpec.uri.toString() : "";
                        Map<String, String> headers = new HashMap<>(dataSpec.httpRequestHeaders);
                        if (currentStreamUserAgent != null && !currentStreamUserAgent.isEmpty()) {
                            headers.put("User-Agent", currentStreamUserAgent);
                        }
                        DataSpec resolved = dataSpec.buildUpon()
                                .setHttpRequestHeaders(headers)
                                .build();

                        long chunkBytes = currentRangeChunkBytes;
                        if (chunkBytes > 0 && uriStr.contains("googlevideo.com") && !uriStr.contains("rbypass=yes")) {
                            long length = resolved.length;
                            long boundedLength = (length == C.LENGTH_UNSET)
                                    ? chunkBytes
                                    : Math.min(length, chunkBytes);
                            if (boundedLength > 0 && (length == C.LENGTH_UNSET || boundedLength < length)) {
                                return resolved.subrange(0, boundedLength);
                            }
                        }
                        return resolved;
                    }
            );

            DefaultExtractorsFactory extractorsFactory = new DefaultExtractorsFactory()
                    .setConstantBitrateSeekingEnabled(true);

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .setUsage(C.USAGE_MEDIA)
                    .build();

            exoPlayer = new ExoPlayer.Builder(this)
                    .setMediaSourceFactory(new DefaultMediaSourceFactory(resolvingDataSourceFactory, extractorsFactory))
                    .setAudioAttributes(audioAttributes, true)
                    .setHandleAudioBecomingNoisy(true)
                    .setWakeMode(C.WAKE_MODE_NETWORK)
                    .build();

            exoPlayer.setVolume(1.0f);

            exoPlayer.addListener(new Player.Listener() {
                @Override
                public void onIsPlayingChanged(boolean isPlayingNow) {
                    isPlaying = isPlayingNow;
                    if (isPlayingNow) {
                        try {
                            if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire(12 * 60 * 60 * 1000L);
                            if (wifiLock != null && !wifiLock.isHeld()) wifiLock.acquire();
                        } catch (Exception ignored) {}
                    } else {
                        try {
                            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                            if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
                        } catch (Exception ignored) {}
                    }
                    updateMediaSessionState();
                    startForegroundWithNotification();
                    MusicNotificationPlugin.dispatchPlaybackState(isPlayingNow);
                }

                @Override
                public void onPlaybackStateChanged(int playbackState) {
                    Log.d(TAG, "ExoPlayer onPlaybackStateChanged: " + playbackState);
                    if (playbackState == Player.STATE_READY) {
                        Log.d(TAG, "ExoPlayer is READY, duration=" + exoPlayer.getDuration());
                        updateMediaSessionState();
                        startForegroundWithNotification();
                    } else if (playbackState == Player.STATE_ENDED) {
                        Log.d(TAG, "ExoPlayer is ENDED");
                        handleAction(ACTION_NEXT);
                    } else if (playbackState == Player.STATE_BUFFERING) {
                        setMediaSessionBuffering();
                    }
                }

                @Override
                public void onPlayerError(PlaybackException error) {
                    Log.e(TAG, "ExoPlayer error: " + error.getMessage(), error);
                    if (!hasRetriedNatively) {
                        hasRetriedNatively = true;
                        Log.d(TAG, "ExoPlayer failed on stream URL, retrying with Qobuz fallback for: " + currentTitle);
                        executorService.execute(() -> {
                            String fallbackUrl = resolveQobuzStreamFallback(currentTitle, currentArtist);
                            if (fallbackUrl != null && !fallbackUrl.isEmpty()) {
                                mainHandler.post(() -> {
                                    if (exoPlayer != null) {
                                        try {
                                            Log.d(TAG, "Playing Qobuz fallback in ExoPlayer: " + fallbackUrl.substring(0, Math.min(60, fallbackUrl.length())) + "...");
                                            exoPlayer.setMediaItem(MediaItem.fromUri(fallbackUrl));
                                            exoPlayer.prepare();
                                            exoPlayer.play();
                                            isPlaying = true;
                                            updateMediaSessionState();
                                            startForegroundWithNotification();
                                            MusicNotificationPlugin.dispatchPlaybackState(true);
                                        } catch (Exception e) {
                                            Log.e(TAG, "Fallback play error", e);
                                        }
                                    }
                                });
                            } else {
                                MusicNotificationPlugin.dispatchPlaybackError(error.getMessage() != null ? error.getMessage() : "Errore riproduzione ExoPlayer");
                            }
                        });
                    } else {
                        MusicNotificationPlugin.dispatchPlaybackError(error.getMessage() != null ? error.getMessage() : "Errore riproduzione ExoPlayer");
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error initializing ExoPlayer", e);
        }
    }

    private void initMediaSession() {
        try {
            mediaSession = new MediaSessionCompat(this, "SuperMusicSession");
            mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);

            Intent mediaButtonIntent = new Intent(Intent.ACTION_MEDIA_BUTTON, null, this, androidx.media.session.MediaButtonReceiver.class);
            PendingIntent mediaButtonPendingIntent = PendingIntent.getBroadcast(
                    this,
                    0,
                    mediaButtonIntent,
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
            );
            mediaSession.setMediaButtonReceiver(mediaButtonPendingIntent);
            mediaSession.setActive(true);

            long initialActions = PlaybackStateCompat.ACTION_PLAY |
                    PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID |
                    PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH |
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;

            mediaSession.setPlaybackState(
                    new PlaybackStateCompat.Builder()
                            .setActions(initialActions)
                            .setState(PlaybackStateCompat.STATE_NONE, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f)
                            .build()
            );
            mediaSession.setMetadata(null);

            mediaSession.setCallback(new MediaSessionCompat.Callback() {
                @Override
                public void onPrepare() {
                    Log.d(TAG, "Android Auto onPrepare callback");
                }

                @Override
                public void onPlay() {
                    if (exoPlayer != null && exoPlayer.getPlaybackState() != Player.STATE_IDLE && exoPlayer.getPlaybackState() != Player.STATE_ENDED) {
                        exoPlayer.play();
                    } else {
                        playDjSmartMix();
                    }
                }

                @Override
                public void onPause() {
                    if (exoPlayer != null) exoPlayer.pause();
                }

                @Override
                public void onSkipToNext() {
                    handleAction(ACTION_NEXT);
                }

                @Override
                public void onSkipToPrevious() {
                    handleAction(ACTION_PREV);
                }

                @Override
                public void onStop() {
                    handleAction(ACTION_STOP);
                }

                @Override
                public void onSeekTo(long pos) {
                    if (exoPlayer != null) {
                        exoPlayer.seekTo(pos);
                        syncMediaSessionPosition(pos);
                    }
                }

                @Override
                public void onPlayFromMediaId(String mediaId, Bundle extras) {
                    Log.d(TAG, "Android Auto onPlayFromMediaId: " + mediaId);
                    if (mediaId == null) return;
                    setMediaSessionBuffering();

                    if (MEDIA_ID_NOW_PLAYING.equals(mediaId)) {
                        if (exoPlayer != null && exoPlayer.getPlaybackState() != Player.STATE_IDLE && exoPlayer.getPlaybackState() != Player.STATE_ENDED) {
                            exoPlayer.play();
                        } else {
                            playDjSmartMix();
                        }
                    } else if (MEDIA_ID_DJ.equals(mediaId)) {
                        playDjSmartMix();
                    } else if (mediaId.startsWith("queue_track:")) {
                        playQueueTrack(mediaId);
                    } else if (mediaId.startsWith("fav_track:")) {
                        playFavoriteTrack(mediaId);
                    } else if (mediaId.startsWith("pl_track:")) {
                        playPlaylistTrack(mediaId);
                    } else if (mediaId.startsWith("cat_track:")) {
                        playCategoryTrack(mediaId);
                    } else if (mediaId.startsWith("track:")) {
                        playAndroidAutoTrack(mediaId);
                    } else if (MEDIA_ID_LOCAL.equals(mediaId)) {
                        MusicNotificationPlugin.dispatchMediaAction("play_local");
                    }
                }

                @Override
                public void onPlayFromSearch(String query, Bundle extras) {
                    Log.d(TAG, "Android Auto onPlayFromSearch: " + query);
                    if (query == null || query.trim().isEmpty()) {
                        if (exoPlayer != null) exoPlayer.play();
                        return;
                    }
                    playAndroidAutoSearch(query);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error initializing MediaSession", e);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Riproduzione SuperMusic",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Controlli multimediali per SuperMusic PRO");
            channel.setShowBadge(false);
            channel.setSound(null, null);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!isInForeground) {
            startForegroundSafely(buildNotification(cachedCoverBitmap));
        }

        if (intent == null) return START_NOT_STICKY;

        // Forward media button clicks from steering wheel or Bluetooth headsets to MediaSession
        androidx.media.session.MediaButtonReceiver.handleIntent(mediaSession, intent);

        String action = intent.getAction();
        if (ACTION_STOP.equals(action) || ACTION_CLOSE_APP.equals(action)) {
            stopPlaybackService();
            return START_NOT_STICKY;
        }

        if (ACTION_PLAY_URL.equals(action)) {
            String url = intent.getStringExtra(EXTRA_URL);
            String videoId = intent.getStringExtra(EXTRA_VIDEO_ID);
            String title = intent.getStringExtra(EXTRA_TITLE);
            String artist = intent.getStringExtra(EXTRA_ARTIST);
            String cover = intent.getStringExtra(EXTRA_COVER);

            if (title != null && !title.isEmpty()) currentTitle = title;
            if (artist != null && !artist.isEmpty()) currentArtist = artist;
            currentCover = cover != null ? cover : "";
            currentVideoId = videoId != null ? videoId : "";
            hasRetriedNatively = false;
            isPlaying = true;

            setMediaSessionBuffering();
            startForegroundWithNotification();

            playTrackNatively(url, videoId);
            return START_NOT_STICKY;
        }

        if (ACTION_SEEK.equals(action)) {
            long seekMs = intent.getLongExtra(EXTRA_SEEK_MS, 0);
            if (exoPlayer != null) {
                exoPlayer.seekTo(seekMs);
                syncMediaSessionPosition(seekMs);
            }
            return START_NOT_STICKY;
        }

        if (ACTION_SET_VOLUME.equals(action)) {
            float volume = intent.getFloatExtra(EXTRA_VOLUME, 1.0f);
            if (exoPlayer != null) {
                exoPlayer.setVolume(volume);
            }
            return START_NOT_STICKY;
        }

        if (ACTION_PLAY.equals(action)) {
            if (exoPlayer != null) exoPlayer.play();
            return START_NOT_STICKY;
        }

        if (ACTION_PAUSE.equals(action)) {
            if (exoPlayer != null) exoPlayer.pause();
            return START_NOT_STICKY;
        }

        if (ACTION_PREV.equals(action) || ACTION_NEXT.equals(action)) {
            handleAction(action);
            return START_NOT_STICKY;
        }

        if (ACTION_UPDATE.equals(action)) {
            String title = intent.getStringExtra(EXTRA_TITLE);
            String artist = intent.getStringExtra(EXTRA_ARTIST);
            String cover = intent.getStringExtra(EXTRA_COVER);
            boolean playing = intent.getBooleanExtra(EXTRA_PLAYING, false);

            if (title != null && !title.isEmpty()) currentTitle = title;
            if (artist != null && !artist.isEmpty()) currentArtist = artist;
            currentCover = cover != null ? cover : "";
            isPlaying = playing;

            if (isPlaying && wakeLock != null && !wakeLock.isHeld()) {
                try { wakeLock.acquire(12 * 60 * 60 * 1000L); } catch (Exception ignored) {}
            } else if (!isPlaying && wakeLock != null && wakeLock.isHeld()) {
                try { wakeLock.release(); } catch (Exception ignored) {}
            }

            updateMediaSessionState();
            startForegroundWithNotification();
        }

        return START_NOT_STICKY;
    }

    private void playTrackNatively(String directUrl, String videoId) {
        executorService.execute(() -> {
            String playableUrl = directUrl;
            String resolvedVid = videoId;

            if ((playableUrl == null || playableUrl.trim().isEmpty()) && (resolvedVid == null || resolvedVid.trim().isEmpty())) {
                String searchQuery = (currentArtist + " " + currentTitle).trim();
                Log.d(TAG, "No videoId provided, searching InnerTube for: " + searchQuery);
                resolvedVid = searchInnerTubeVideoId(searchQuery);
                if (resolvedVid != null && !resolvedVid.isEmpty()) {
                    currentVideoId = resolvedVid;
                    Log.d(TAG, "Found videoId via native search: " + resolvedVid);
                }
            }

            // If directUrl is null, empty, or not resolving, resolve natively via InnerTube or Qobuz!
            if (playableUrl == null || playableUrl.trim().isEmpty()) {
                Log.d(TAG, "Direct URL empty, resolving videoId natively via InnerTube: " + resolvedVid);
                playableUrl = resolveInnerTubeStream(resolvedVid);
            }

            if (playableUrl == null || playableUrl.trim().isEmpty()) {
                Log.d(TAG, "InnerTube empty, trying Qobuz fallback for: " + currentTitle + " - " + currentArtist);
                playableUrl = resolveQobuzStreamFallback(currentTitle, currentArtist);
            }

            if (playableUrl == null || playableUrl.trim().isEmpty()) {
                Log.e(TAG, "Could not resolve stream URL for videoId: " + resolvedVid);
                mainHandler.post(() -> {
                    isPlaying = false;
                    updateMediaSessionState();
                });
                MusicNotificationPlugin.dispatchPlaybackError("Impossibile reperire lo stream audio");
                return;
            }

            final String streamToPlay = playableUrl;
            mainHandler.post(() -> {
                if (exoPlayer != null) {
                    try {
                        Log.d(TAG, "Playing in ExoPlayer natively: " + streamToPlay.substring(0, Math.min(60, streamToPlay.length())) + "...");
                        MediaItem mediaItem = MediaItem.fromUri(streamToPlay);
                        exoPlayer.setMediaItem(mediaItem);
                        exoPlayer.prepare();
                        exoPlayer.play();
                        isPlaying = true;

                        if (wakeLock != null && !wakeLock.isHeld()) {
                            try { wakeLock.acquire(12 * 60 * 60 * 1000L); } catch (Exception ignored) {}
                        }

                        updateMediaSessionState();
                        startForegroundWithNotification();
                        MusicNotificationPlugin.dispatchPlaybackState(true);
                    } catch (Exception e) {
                        Log.e(TAG, "Error starting ExoPlayer stream", e);
                        MusicNotificationPlugin.dispatchPlaybackError("Errore riproduzione: " + e.getMessage());
                    }
                }
            });
        });
    }

    private String searchInnerTubeVideoId(String query) {
        if (query == null || query.trim().isEmpty()) return null;
        try {
            JSONObject clientObj = new JSONObject();
            clientObj.put("clientName", "WEB_REMIX");
            clientObj.put("clientVersion", "1.20240901.01.00");
            clientObj.put("hl", "it");
            clientObj.put("gl", "IT");

            JSONObject payload = new JSONObject();
            payload.put("context", new JSONObject().put("client", clientObj));
            payload.put("query", query);

            MediaType jsonMediaType = MediaType.parse("application/json; charset=utf-8");
            RequestBody body = RequestBody.create(payload.toString(), jsonMediaType);

            Request request = new Request.Builder()
                    .url("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
                    .post(body)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
                    .header("X-YouTube-Client-Name", "67")
                    .header("X-YouTube-Client-Version", "1.20240901.01.00")
                    .header("Origin", "https://music.youtube.com")
                    .header("Referer", "https://music.youtube.com/")
                    .build();

            try (Response response = okHttpClient.newCall(request).execute()) {
                if (response.isSuccessful() && response.body() != null) {
                    String respStr = response.body().string();
                    java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("\"videoId\"\\s*:\\s*\"([a-zA-Z0-9_-]{11})\"").matcher(respStr);
                    if (matcher.find()) {
                        return matcher.group(1);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error searching InnerTube videoId", e);
        }
        return null;
    }

    private String fetchVisitorData() {
        if (cachedVisitorData != null && !cachedVisitorData.isEmpty()) {
            return cachedVisitorData;
        }
        String[] endpoints = new String[]{
                "https://www.youtube.com/sw.js_data",
                "https://music.youtube.com/"
        };
        for (String url : endpoints) {
            try {
                Request req = new Request.Builder()
                        .url(url)
                        .get()
                        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36")
                        .header("Accept-Language", "en-US,en;q=0.9")
                        .build();
                try (Response res = okHttpClient.newCall(req).execute()) {
                    if (res.isSuccessful() && res.body() != null) {
                        String body = res.body().string();
                        java.util.regex.Matcher m1 = java.util.regex.Pattern.compile("\"(?:VISITOR_DATA|visitorData)\"\\s*:\\s*\"([^\"]+)\"").matcher(body);
                        if (m1.find()) {
                            cachedVisitorData = m1.group(1);
                            Log.d(TAG, "Fetched InnerTube visitorData from " + url);
                            return cachedVisitorData;
                        }
                        java.util.regex.Matcher m2 = java.util.regex.Pattern.compile("(Cg[t-zA-Z0-9_-]{18,})").matcher(body);
                        if (m2.find()) {
                            cachedVisitorData = m2.group(1);
                            Log.d(TAG, "Fetched InnerTube sw.js_data visitorData");
                            return cachedVisitorData;
                        }
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "fetchVisitorData notice (" + url + "): " + e.getMessage());
            }
        }
        return null;
    }

    private String generateCpn() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        Random rnd = new Random();
        StringBuilder sb = new StringBuilder(16);
        for (int i = 0; i < 16; i++) {
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        }
        return sb.toString();
    }

    public String resolveInnerTubeStream(String videoId) {
        if (videoId == null || videoId.isEmpty()) return null;

        String visitorData = fetchVisitorData();

        // 1. Priority Client: VISIONOS_0_1 (Client ID 101) with visitorData
        String url = tryInnerTubeClient(
                videoId,
                "https://music.youtube.com/youtubei/v1/player?prettyPrint=false",
                "VISIONOS",
                "0.1",
                "101",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
                "Apple",
                "RealityDevice14,1",
                "VISION_OS",
                "1.3",
                "MOBILE",
                null,
                visitorData,
                0L // VISIONOS does not require bounded media range chunks unless needed
        );
        if (url != null) return url;

        // 2. ANDROID_VR 1.43.32 (Client ID 28) - uses 512KB chunked bounded ranges
        url = tryInnerTubeClient(
                videoId,
                "https://music.youtube.com/youtubei/v1/player?prettyPrint=false",
                "ANDROID_VR",
                "1.43.32",
                "28",
                "com.google.android.apps.youtube.vr.oculus/1.43.32 (Linux; U; Android 12; en_US; Quest 3; Build/SQ3A.220605.009.A1; Cronet/107.0.5284.2)",
                "Oculus",
                "Quest 3",
                "Android",
                "12",
                null,
                "32",
                visitorData,
                512L * 1024L
        );
        if (url != null) return url;

        // 3. ANDROID_VR 1.61.48 (Client ID 28) - uses 512KB chunked bounded ranges
        url = tryInnerTubeClient(
                videoId,
                "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
                "ANDROID_VR",
                "1.61.48",
                "28",
                "com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12; en_US; Quest 3; Build/SQ3A.220605.009.A1; Cronet/132.0.6808.3)",
                "Oculus",
                "Quest 3",
                "Android",
                "12",
                null,
                "32",
                visitorData,
                512L * 1024L
        );
        if (url != null) return url;

        // 4. IOS 21.26.4 (Client ID 5) - uses 512KB bounded ranges
        url = tryInnerTubeClient(
                videoId,
                "https://music.youtube.com/youtubei/v1/player?prettyPrint=false",
                "IOS",
                "21.26.4",
                "5",
                "com.google.ios.youtube/21.26.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
                "Apple",
                "iPhone16,2",
                "iOS",
                "18.3.2.22D82",
                "MOBILE",
                null,
                visitorData,
                512L * 1024L
        );
        return url;
    }

    private String tryInnerTubeClient(
            String videoId,
            String endpointUrl,
            String clientName,
            String clientVersion,
            String clientIdHeader,
            String userAgent,
            String deviceMake,
            String deviceModel,
            String osName,
            String osVersion,
            String platform,
            String androidSdkVersion,
            String visitorData,
            long rangeChunkBytes
    ) {
        try {
            JSONObject clientObj = new JSONObject();
            clientObj.put("clientName", clientName);
            clientObj.put("clientVersion", clientVersion);
            if (deviceMake != null) clientObj.put("deviceMake", deviceMake);
            if (deviceModel != null) clientObj.put("deviceModel", deviceModel);
            if (osName != null) clientObj.put("osName", osName);
            if (osVersion != null) clientObj.put("osVersion", osVersion);
            if (platform != null) clientObj.put("platform", platform);
            if (androidSdkVersion != null) clientObj.put("androidSdkVersion", Integer.parseInt(androidSdkVersion));
            if (visitorData != null && !visitorData.isEmpty()) clientObj.put("visitorData", visitorData);
            clientObj.put("gl", "US");
            clientObj.put("hl", "en");

            JSONObject contextObj = new JSONObject();
            contextObj.put("client", clientObj);
            contextObj.put("request", new JSONObject().put("internalExperimentFlags", new JSONArray()).put("useSsl", true));
            contextObj.put("user", new JSONObject().put("lockedSafetyMode", false));

            String cpn = generateCpn();
            JSONObject payload = new JSONObject();
            payload.put("context", contextObj);
            payload.put("videoId", videoId);
            payload.put("cpn", cpn);
            payload.put("contentCheckOk", true);
            payload.put("racyCheckOk", true);

            MediaType jsonMediaType = MediaType.parse("application/json; charset=utf-8");
            RequestBody body = RequestBody.create(payload.toString(), jsonMediaType);

            Request.Builder reqBuilder = new Request.Builder()
                    .url(endpointUrl)
                    .post(body)
                    .header("User-Agent", userAgent)
                    .header("X-Goog-Api-Format-Version", "2")
                    .header("X-YouTube-Client-Name", clientIdHeader)
                    .header("X-YouTube-Client-Version", clientVersion)
                    .header("Accept", "application/json");

            if (visitorData != null && !visitorData.isEmpty()) {
                reqBuilder.header("X-Goog-Visitor-Id", visitorData);
            }

            try (Response response = okHttpClient.newCall(reqBuilder.build()).execute()) {
                if (response.isSuccessful() && response.body() != null) {
                    String respStr = response.body().string();
                    JSONObject json = new JSONObject(respStr);
                    JSONObject playability = json.optJSONObject("playabilityStatus");
                    String status = playability != null ? playability.optString("status", "") : "";
                    Log.d(TAG, "InnerTube [" + clientName + " " + clientVersion + "] playabilityStatus=" + status + " for " + videoId);

                    if (!"OK".equalsIgnoreCase(status)) {
                        return null;
                    }

                    JSONObject streamingData = json.optJSONObject("streamingData");
                    if (streamingData != null) {
                        JSONArray adaptiveFormats = streamingData.optJSONArray("adaptiveFormats");
                        if (adaptiveFormats != null) {
                            String format140 = null;
                            String format251 = null;
                            String anyAudio = null;

                            for (int i = 0; i < adaptiveFormats.length(); i++) {
                                JSONObject f = adaptiveFormats.getJSONObject(i);
                                String mime = f.optString("mimeType", "");
                                String sUrl = f.optString("url", "");
                                int itag = f.optInt("itag", 0);

                                if (!sUrl.isEmpty() && mime.contains("audio")) {
                                    if (itag == 140) format140 = sUrl;
                                    else if (itag == 251) format251 = sUrl;
                                    else if (anyAudio == null) anyAudio = sUrl;
                                }
                            }

                            String chosenUrl = format140 != null ? format140 : (format251 != null ? format251 : anyAudio);
                            if (chosenUrl != null) {
                                if (!chosenUrl.contains("cpn=")) {
                                    chosenUrl = chosenUrl + (chosenUrl.contains("?") ? "&" : "?") + "cpn=" + cpn;
                                }
                                currentStreamUserAgent = userAgent;
                                currentRangeChunkBytes = rangeChunkBytes;
                                Log.d(TAG, "Native InnerTube [" + clientName + " " + clientVersion + "] resolved stream for " + videoId + " (chunkBytes=" + rangeChunkBytes + ")");
                                return chosenUrl;
                            }
                        }
                    }
                } else {
                    Log.w(TAG, "InnerTube [" + clientName + "] HTTP status: " + response.code());
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in tryInnerTubeClient [" + clientName + "] for " + videoId, e);
        }
        return null;
    }

    private String resolveQobuzStreamFallback(String title, String artist) {
        String query = ((artist != null ? artist : "") + " " + (title != null ? title : "")).trim();
        if (query.isEmpty()) return null;

        // 1. Try JUMO Qobuz Provider first (https://jumo-dl.pages.dev)
        try {
            String jumoSearchUrl = "https://jumo-dl.pages.dev/search?query=" + java.net.URLEncoder.encode(query, "UTF-8") + "&offset=0&limit=10&region=FR";
            Request jumoSearchReq = new Request.Builder()
                    .url(jumoSearchUrl)
                    .get()
                    .header("Accept", "application/json")
                    .header("Referer", "https://jumo-dl.pages.dev/")
                    .header("User-Agent", "Mozilla/5.0")
                    .build();
            try (Response jRes = okHttpClient.newCall(jumoSearchReq).execute()) {
                if (jRes.isSuccessful() && jRes.body() != null) {
                    String jStr = jRes.body().string();
                    if (!jStr.trim().startsWith("<")) {
                        JSONObject jRoot = new JSONObject(jStr);
                        JSONObject tracksObj = jRoot.optJSONObject("tracks");
                        JSONArray items = tracksObj != null ? tracksObj.optJSONArray("items") : null;
                        if (items != null && items.length() > 0) {
                            String trackId = items.getJSONObject(0).optString("id", "");
                            if (!trackId.isEmpty()) {
                                String jumoDlUrl = "https://jumo-dl.pages.dev/fetch?track_id=" + trackId + "&format_id=5&region=FR";
                                Request jumoDlReq = new Request.Builder()
                                        .url(jumoDlUrl)
                                        .get()
                                        .header("Accept", "application/json")
                                        .header("Origin", "https://jumo-dl.pages.dev")
                                        .header("Referer", "https://jumo-dl.pages.dev/")
                                        .header("User-Agent", "Mozilla/5.0")
                                        .build();
                                try (Response jDlRes = okHttpClient.newCall(jumoDlReq).execute()) {
                                    if (jDlRes.isSuccessful() && jDlRes.body() != null) {
                                        String dlBody = jDlRes.body().string();
                                        if (!dlBody.trim().startsWith("<")) {
                                            JSONObject dlObj = new JSONObject(dlBody);
                                            String sUrl = dlObj.optString("url", "");
                                            if (!sUrl.isEmpty()) {
                                                currentStreamUserAgent = "Mozilla/5.0";
                                                currentRangeChunkBytes = 0L;
                                                Log.d(TAG, "Resolved stream via Qobuz Jumo provider");
                                                return sUrl;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Qobuz Jumo fallback notice: " + e.getMessage());
        }

        // 2. Try Trypt / Kenny / Squid Qobuz Providers
        String[] bases = new String[]{
                "https://trypt-hifi-dl-456461932686.us-west1.run.app",
                "https://qobuz.kennyy.com.br",
                "https://qobuz.squid.wtf"
        };
        for (String base : bases) {
            try {
                String searchUrl = base + "/api/get-music?q=" + java.net.URLEncoder.encode(query, "UTF-8") + "&offset=0";
                Request searchReq = new Request.Builder()
                        .url(searchUrl)
                        .get()
                        .header("Accept", "application/json")
                        .header("Referer", base + "/")
                        .header("User-Agent", "Mozilla/5.0")
                        .header("Token-Country", "US")
                        .build();
                try (Response res = okHttpClient.newCall(searchReq).execute()) {
                    if (!res.isSuccessful() || res.body() == null) continue;
                    String bodyStr = res.body().string();
                    if (bodyStr.trim().startsWith("<")) continue;
                    JSONObject root = new JSONObject(bodyStr);
                    if (!root.optBoolean("success", false)) continue;
                    JSONArray items = root.optJSONObject("data") != null && root.optJSONObject("data").optJSONObject("tracks") != null
                            ? root.optJSONObject("data").optJSONObject("tracks").optJSONArray("items") : null;
                    if (items == null || items.length() == 0) continue;
                    String trackId = items.getJSONObject(0).optString("id", "");
                    if (trackId.isEmpty()) continue;

                    String dlUrl = base + "/api/download-music?track_id=" + trackId + "&quality=5";
                    Request dlReq = new Request.Builder()
                            .url(dlUrl)
                            .get()
                            .header("Accept", "application/json")
                            .header("Origin", base)
                            .header("Referer", base + "/")
                            .header("User-Agent", "Mozilla/5.0")
                            .header("Token-Country", "US")
                            .build();
                    try (Response dlRes = okHttpClient.newCall(dlReq).execute()) {
                        if (!dlRes.isSuccessful() || dlRes.body() == null) continue;
                        String dlStr = dlRes.body().string();
                        if (dlStr.trim().startsWith("<")) continue;
                        JSONObject dlRoot = new JSONObject(dlStr);
                        if (dlRoot.optBoolean("success", false) && dlRoot.optJSONObject("data") != null) {
                            String streamUrl = dlRoot.optJSONObject("data").optString("url", "");
                            if (!streamUrl.isEmpty()) {
                                currentStreamUserAgent = "Mozilla/5.0";
                                currentRangeChunkBytes = 0L;
                                Log.d(TAG, "Resolved stream via Qobuz provider (" + base + ")");
                                return streamUrl;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Qobuz fallback notice (" + base + "): " + e.getMessage());
            }
        }
        return null;
    }

    private void setMediaSessionBuffering() {
        if (mediaSession == null) return;
        try {
            long actions = PlaybackStateCompat.ACTION_PLAY |
                    PlaybackStateCompat.ACTION_PAUSE |
                    PlaybackStateCompat.ACTION_PLAY_PAUSE |
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                    PlaybackStateCompat.ACTION_SEEK_TO |
                    PlaybackStateCompat.ACTION_STOP |
                    PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID |
                    PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH;

            mediaSession.setPlaybackState(
                    new PlaybackStateCompat.Builder()
                            .setActions(actions)
                            .setState(PlaybackStateCompat.STATE_BUFFERING, 0, 1.0f)
                            .build()
            );
        } catch (Exception ignored) {}
    }

    private void saveFavoritesAndPlaylistsToStorage(String favsJson, String playlistsJson) {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("supermusic_native_prefs", Context.MODE_PRIVATE);
            android.content.SharedPreferences.Editor editor = prefs.edit();
            if (favsJson != null) editor.putString("cached_favorites", favsJson);
            if (playlistsJson != null) editor.putString("cached_playlists", playlistsJson);
            editor.apply();
        } catch (Exception e) {
            Log.e(TAG, "Error saving favorites/playlists to storage", e);
        }
    }

    private void loadFavoritesAndPlaylistsFromStorage() {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("supermusic_native_prefs", Context.MODE_PRIVATE);
            String favsStr = prefs.getString("cached_favorites", null);
            if (favsStr != null && !favsStr.isEmpty()) {
                JSONArray arr = new JSONArray(favsStr);
                synchronized (nativeFavorites) {
                    nativeFavorites.clear();
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject obj = arr.getJSONObject(i);
                        NativeTrackItem item = new NativeTrackItem();
                        item.title = obj.optString("title", "SuperMusic PRO");
                        item.artist = obj.optString("artist", "Artista");
                        item.cover = obj.optString("cover", "");
                        item.videoId = obj.optString("videoId", "");
                        if (item.videoId.isEmpty() && obj.has("id")) {
                            String sid = obj.optString("id", "");
                            if (sid.startsWith("yt_")) item.videoId = sid.substring(3);
                        }
                        item.url = obj.optString("localAudioUrl", obj.optString("url", ""));
                        nativeFavorites.add(item);
                    }
                }
            }

            String plStr = prefs.getString("cached_playlists", null);
            if (plStr != null && !plStr.isEmpty()) {
                JSONArray arr = new JSONArray(plStr);
                synchronized (nativePlaylists) {
                    nativePlaylists.clear();
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject obj = arr.getJSONObject(i);
                        NativePlaylistItem pl = new NativePlaylistItem();
                        pl.id = obj.optString("id", "pl_" + i);
                        pl.name = obj.optString("name", "Playlist " + (i + 1));
                        pl.cover = obj.optString("cover", "");
                        JSONArray songs = obj.optJSONArray("songs");
                        if (songs != null) {
                            for (int s = 0; s < songs.length(); s++) {
                                JSONObject sobj = songs.getJSONObject(s);
                                NativeTrackItem sitem = new NativeTrackItem();
                                sitem.title = sobj.optString("title", "SuperMusic PRO");
                                sitem.artist = sobj.optString("artist", "Artista");
                                sitem.cover = sobj.optString("cover", "");
                                sitem.videoId = sobj.optString("videoId", "");
                                if (sitem.videoId.isEmpty() && sobj.has("id")) {
                                    String sid = sobj.optString("id", "");
                                    if (sid.startsWith("yt_")) sitem.videoId = sid.substring(3);
                                }
                                sitem.url = sobj.optString("localAudioUrl", sobj.optString("url", ""));
                                pl.tracks.add(sitem);
                            }
                        }
                        nativePlaylists.add(pl);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error loading favorites/playlists from storage", e);
        }
    }

    private void initDefaultCatalog() {
        // Zero static hardcoded presets: all trending and new release tracks are loaded
        // dynamically live on startup from YouTube Music / charts without dead fallbacks.
    }

    public void syncFromApp(JSArray queueArr, int currentIndex, JSArray favsArr, JSArray playlistsArr, JSArray catalogArr) {
        synchronized (nativeQueue) {
            if (queueArr != null) {
                nativeQueue.clear();
                for (int i = 0; i < queueArr.length(); i++) {
                    try {
                        org.json.JSONObject obj = queueArr.getJSONObject(i);
                        NativeTrackItem item = new NativeTrackItem();
                        item.title = obj.optString("title", "SuperMusic PRO");
                        item.artist = obj.optString("artist", "Artista");
                        item.cover = obj.optString("cover", "");
                        item.videoId = obj.optString("videoId", "");
                        if (item.videoId.isEmpty() && obj.has("id")) {
                            String sid = obj.optString("id", "");
                            if (sid.startsWith("yt_")) item.videoId = sid.substring(3);
                        }
                        item.url = obj.optString("localAudioUrl", obj.optString("url", ""));
                        nativeQueue.add(item);
                    } catch (Exception ignored) {}
                }
                nativeQueueIndex = Math.max(0, Math.min(currentIndex, nativeQueue.size() - 1));
            }

            if (favsArr != null) {
                synchronized (nativeFavorites) {
                    nativeFavorites.clear();
                    for (int i = 0; i < favsArr.length(); i++) {
                        try {
                            org.json.JSONObject obj = favsArr.getJSONObject(i);
                            NativeTrackItem item = new NativeTrackItem();
                            item.title = obj.optString("title", "SuperMusic PRO");
                            item.artist = obj.optString("artist", "Artista");
                            item.cover = obj.optString("cover", "");
                            item.videoId = obj.optString("videoId", "");
                            if (item.videoId.isEmpty() && obj.has("id")) {
                                String sid = obj.optString("id", "");
                                if (sid.startsWith("yt_")) item.videoId = sid.substring(3);
                            }
                            item.url = obj.optString("localAudioUrl", obj.optString("url", ""));
                            nativeFavorites.add(item);
                        } catch (Exception ignored) {}
                    }
                }
            }

            if (playlistsArr != null) {
                synchronized (nativePlaylists) {
                    nativePlaylists.clear();
                    for (int i = 0; i < playlistsArr.length(); i++) {
                        try {
                            org.json.JSONObject obj = playlistsArr.getJSONObject(i);
                            NativePlaylistItem pl = new NativePlaylistItem();
                            pl.id = obj.optString("id", "pl_" + i);
                            pl.name = obj.optString("name", "Playlist " + (i + 1));
                            pl.cover = obj.optString("cover", "");
                            org.json.JSONArray songs = obj.optJSONArray("songs");
                            if (songs != null) {
                                for (int s = 0; s < songs.length(); s++) {
                                    org.json.JSONObject sobj = songs.getJSONObject(s);
                                    NativeTrackItem sitem = new NativeTrackItem();
                                    sitem.title = sobj.optString("title", "SuperMusic PRO");
                                    sitem.artist = sobj.optString("artist", "Artista");
                                    sitem.cover = sobj.optString("cover", "");
                                    sitem.videoId = sobj.optString("videoId", "");
                                    if (sitem.videoId.isEmpty() && sobj.has("id")) {
                                        String sid = sobj.optString("id", "");
                                        if (sid.startsWith("yt_")) sitem.videoId = sid.substring(3);
                                    }
                                    sitem.url = sobj.optString("localAudioUrl", sobj.optString("url", ""));
                                    pl.tracks.add(sitem);
                                }
                            }
                            nativePlaylists.add(pl);
                        } catch (Exception ignored) {}
                    }
                }
            }

            saveFavoritesAndPlaylistsToStorage(
                    favsArr != null ? favsArr.toString() : null,
                    playlistsArr != null ? playlistsArr.toString() : null
            );

            if (catalogArr != null && catalogArr.length() > 0) {
                synchronized (nativeTrending) {
                    synchronized (nativeNewReleases) {
                        synchronized (nativeCatalog) {
                            nativeTrending.clear();
                            nativeNewReleases.clear();
                            nativeCatalog.clear();
                            for (int i = 0; i < catalogArr.length(); i++) {
                                try {
                                    org.json.JSONObject obj = catalogArr.getJSONObject(i);
                                    NativeTrackItem item = new NativeTrackItem();
                                    item.title = obj.optString("title", "SuperMusic PRO");
                                    item.artist = obj.optString("artist", "Artista");
                                    item.cover = obj.optString("cover", "");
                                    item.videoId = obj.optString("videoId", "");
                                    if (item.videoId.isEmpty() && obj.has("id")) {
                                        String sid = obj.optString("id", "");
                                        if (sid.startsWith("yt_")) item.videoId = sid.substring(3);
                                    }
                                    nativeCatalog.add(item);
                                    if (i < 10) {
                                        nativeTrending.add(item);
                                    } else if (i < 20) {
                                        nativeNewReleases.add(item);
                                    }
                                } catch (Exception ignored) {}
                            }
                        }
                    }
                }
            }
        }

        mainHandler.post(() -> {
            notifyChildrenChanged(MEDIA_ROOT_ID);
            notifyChildrenChanged(TAB_ALL);
            notifyChildrenChanged(TAB_MUSIC);
            notifyChildrenChanged(TAB_TRENDING);
            notifyChildrenChanged(TAB_FAVORITES);
            notifyChildrenChanged(MEDIA_ID_QUEUE);
            notifyChildrenChanged(MEDIA_ID_FAVORITES);
            notifyChildrenChanged(MEDIA_ID_PLAYLISTS);
            notifyChildrenChanged(MEDIA_ID_TRENDING);
            notifyChildrenChanged(MEDIA_ID_NEW_RELEASES);
            notifyChildrenChanged(MEDIA_ID_MOST_PLAYED);
            notifyChildrenChanged(MEDIA_ID_DAILY_MIX);
        });
    }

    private int findTrackIndexInList(List<NativeTrackItem> list, String videoId, String title) {
        if (list == null || list.isEmpty()) return -1;
        for (int i = 0; i < list.size(); i++) {
            NativeTrackItem item = list.get(i);
            if (videoId != null && !videoId.isEmpty() && videoId.equals(item.videoId)) return i;
            if (title != null && !title.isEmpty() && title.equalsIgnoreCase(item.title)) return i;
        }
        return -1;
    }

    private void handleAction(String action) {
        if (ACTION_PLAY.equals(action)) {
            if (exoPlayer != null) exoPlayer.play();
            MusicNotificationPlugin.dispatchMediaAction("play");
            return;
        }
        if (ACTION_PAUSE.equals(action)) {
            if (exoPlayer != null) exoPlayer.pause();
            MusicNotificationPlugin.dispatchMediaAction("pause");
            return;
        }
        if (ACTION_STOP.equals(action)) {
            stopPlaybackService();
            return;
        }

        if (ACTION_NEXT.equals(action)) {
            NativeTrackItem nextTrack = null;
            int nextIndex = -1;

            synchronized (nativeQueue) {
                if (nativeQueueIndex + 1 < nativeQueue.size()) {
                    nativeQueueIndex++;
                    nextIndex = nativeQueueIndex;
                    nextTrack = nativeQueue.get(nativeQueueIndex);
                } else if (nativeQueue.size() > 1) {
                    // Autonomous wrap-around within active context
                    nativeQueueIndex = 0;
                    nextIndex = 0;
                    nextTrack = nativeQueue.get(0);
                }
            }

            // Continuous search progression: load +20 tracks when search queue reaches end
            if (nextTrack == null && lastSearchQuery != null && !lastSearchQuery.trim().isEmpty() && lastSearchLimit < 100) {
                try {
                    int newLimit = lastSearchLimit + 20;
                    lastSearchLimit = newLimit;
                    List<InnerTubeTrack> moreTracks = fetchInnerTubeTracks(lastSearchQuery, newLimit);
                    if (moreTracks != null && moreTracks.size() > nativeQueue.size()) {
                        synchronized (nativeQueue) {
                            for (int m = nativeQueue.size(); m < moreTracks.size(); m++) {
                                InnerTubeTrack tr = moreTracks.get(m);
                                NativeTrackItem nItem = new NativeTrackItem();
                                nItem.title = tr.title;
                                nItem.artist = tr.artist;
                                nItem.cover = tr.thumbnail;
                                nItem.videoId = tr.videoId;
                                nItem.url = "";
                                nativeQueue.add(nItem);
                            }
                            if (nativeQueueIndex + 1 < nativeQueue.size()) {
                                nativeQueueIndex++;
                                nextIndex = nativeQueueIndex;
                                nextTrack = nativeQueue.get(nativeQueueIndex);
                            }
                        }
                    }
                } catch (Exception ignored) {}
            }

            // Fallback: If queue only had 1 song or was exhausted, advance seamlessly in trending or catalog
            if (nextTrack == null) {
                synchronized (nativeTrending) {
                    if (!nativeTrending.isEmpty()) {
                        int pos = findTrackIndexInList(nativeTrending, currentVideoId, currentTitle);
                        int nextPos = (pos != -1 && pos + 1 < nativeTrending.size()) ? (pos + 1) : 0;
                        nextTrack = nativeTrending.get(nextPos);
                        synchronized (nativeQueue) {
                            nativeQueue.clear();
                            nativeQueue.addAll(nativeTrending);
                            nativeQueueIndex = nextPos;
                            nextIndex = nextPos;
                        }
                    }
                }
            }

            if (nextTrack == null) {
                synchronized (nativeCatalog) {
                    if (!nativeCatalog.isEmpty()) {
                        int pos = findTrackIndexInList(nativeCatalog, currentVideoId, currentTitle);
                        int nextPos = (pos != -1 && pos + 1 < nativeCatalog.size()) ? (pos + 1) : 0;
                        nextTrack = nativeCatalog.get(nextPos);
                        synchronized (nativeQueue) {
                            nativeQueue.clear();
                            nativeQueue.addAll(nativeCatalog);
                            nativeQueueIndex = nextPos;
                            nextIndex = nextPos;
                        }
                    }
                }
            }

            if (nextTrack != null) {
                currentTitle = nextTrack.title != null ? nextTrack.title : "SuperMusic PRO";
                currentArtist = nextTrack.artist != null ? nextTrack.artist : "Artista";
                currentCover = nextTrack.cover != null ? nextTrack.cover : "";
                currentVideoId = nextTrack.videoId != null ? nextTrack.videoId : "";
                hasRetriedNatively = false;
                isPlaying = true;

                setMediaSessionBuffering();
                startForegroundWithNotification();
                playTrackNatively(nextTrack.url, nextTrack.videoId);
                MusicNotificationPlugin.dispatchTrackChanged(currentTitle, currentArtist, currentCover, currentVideoId, nextIndex);
            } else {
                if (exoPlayer != null) {
                    exoPlayer.seekTo(0);
                    exoPlayer.play();
                }
            }
            MusicNotificationPlugin.dispatchMediaAction("next");
            return;
        }

        if (ACTION_PREV.equals(action)) {
            if (exoPlayer != null && exoPlayer.getCurrentPosition() > 3000) {
                exoPlayer.seekTo(0);
                MusicNotificationPlugin.dispatchMediaAction("previous");
                return;
            }

            NativeTrackItem prevTrack = null;
            int prevIndex = -1;

            synchronized (nativeQueue) {
                if (nativeQueueIndex > 0 && nativeQueueIndex < nativeQueue.size()) {
                    nativeQueueIndex--;
                    prevIndex = nativeQueueIndex;
                    prevTrack = nativeQueue.get(nativeQueueIndex);
                } else if (nativeQueue.size() > 1) {
                    // Autonomous wrap-around to end of active context
                    nativeQueueIndex = nativeQueue.size() - 1;
                    prevIndex = nativeQueueIndex;
                    prevTrack = nativeQueue.get(nativeQueueIndex);
                }
            }

            if (prevTrack == null) {
                synchronized (nativeTrending) {
                    if (!nativeTrending.isEmpty()) {
                        int pos = findTrackIndexInList(nativeTrending, currentVideoId, currentTitle);
                        int prevPos = (pos > 0) ? (pos - 1) : (nativeTrending.size() - 1);
                        prevTrack = nativeTrending.get(prevPos);
                        synchronized (nativeQueue) {
                            nativeQueue.clear();
                            nativeQueue.addAll(nativeTrending);
                            nativeQueueIndex = prevPos;
                            prevIndex = prevPos;
                        }
                    }
                }
            }

            if (prevTrack == null) {
                synchronized (nativeCatalog) {
                    if (!nativeCatalog.isEmpty()) {
                        int pos = findTrackIndexInList(nativeCatalog, currentVideoId, currentTitle);
                        int prevPos = (pos > 0) ? (pos - 1) : (nativeCatalog.size() - 1);
                        prevTrack = nativeCatalog.get(prevPos);
                        synchronized (nativeQueue) {
                            nativeQueue.clear();
                            nativeQueue.addAll(nativeCatalog);
                            nativeQueueIndex = prevPos;
                            prevIndex = prevPos;
                        }
                    }
                }
            }

            if (prevTrack != null) {
                currentTitle = prevTrack.title != null ? prevTrack.title : "SuperMusic PRO";
                currentArtist = prevTrack.artist != null ? prevTrack.artist : "Artista";
                currentCover = prevTrack.cover != null ? prevTrack.cover : "";
                currentVideoId = prevTrack.videoId != null ? prevTrack.videoId : "";
                hasRetriedNatively = false;
                isPlaying = true;

                setMediaSessionBuffering();
                startForegroundWithNotification();
                playTrackNatively(prevTrack.url, prevTrack.videoId);
                MusicNotificationPlugin.dispatchTrackChanged(currentTitle, currentArtist, currentCover, currentVideoId, prevIndex);
            } else {
                if (exoPlayer != null) {
                    exoPlayer.seekTo(0);
                    exoPlayer.play();
                }
            }
            MusicNotificationPlugin.dispatchMediaAction("previous");
            return;
        }
    }

    private void updateMediaSessionState() {
        if (mediaSession == null) return;

        try {
            boolean hasActiveTrack = isPlaying || (exoPlayer != null && exoPlayer.getPlaybackState() != Player.STATE_IDLE && exoPlayer.getPlaybackState() != Player.STATE_ENDED);
            if (!hasActiveTrack && (currentVideoId == null || currentVideoId.isEmpty())) {
                long initialActions = PlaybackStateCompat.ACTION_PLAY |
                        PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID |
                        PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH |
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;

                mediaSession.setPlaybackState(
                        new PlaybackStateCompat.Builder()
                                .setActions(initialActions)
                                .setState(PlaybackStateCompat.STATE_NONE, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f)
                                .build()
                );
                mediaSession.setMetadata(null);
                return;
            }

            int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
            if (exoPlayer != null && exoPlayer.getPlaybackState() == Player.STATE_BUFFERING) {
                state = PlaybackStateCompat.STATE_BUFFERING;
            }
            long actions = PlaybackStateCompat.ACTION_PLAY |
                    PlaybackStateCompat.ACTION_PAUSE |
                    PlaybackStateCompat.ACTION_PLAY_PAUSE |
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                    PlaybackStateCompat.ACTION_SEEK_TO |
                    PlaybackStateCompat.ACTION_STOP |
                    PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID |
                    PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH;

            long currentPositionMs = exoPlayer != null ? exoPlayer.getCurrentPosition() : PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN;

            mediaSession.setPlaybackState(
                    new PlaybackStateCompat.Builder()
                            .setActions(actions)
                            .setState(state, currentPositionMs, 1.0f)
                            .build()
            );

            MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
                    .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                    .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                    .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "SuperMusic PRO");

            if (exoPlayer != null && exoPlayer.getDuration() > 0) {
                metaBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, exoPlayer.getDuration());
            }

            if (cachedCoverBitmap != null) {
                metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, cachedCoverBitmap);
            }

            mediaSession.setMetadata(metaBuilder.build());
        } catch (Exception e) {
            Log.e(TAG, "Error updating MediaSession state", e);
        }
    }

    private void startForegroundSafely(Notification notification) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                );
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            isInForeground = true;
        } catch (Exception e) {
            Log.e(TAG, "startForeground error, trying ServiceCompat: " + e.getMessage(), e);
            try {
                int fgsType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
                ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, fgsType);
                isInForeground = true;
            } catch (Exception e2) {
                Log.e(TAG, "ServiceCompat.startForeground error: " + e2.getMessage(), e2);
            }
        }
    }

    private void startForegroundWithNotification() {
        Notification notification = buildNotification(cachedCoverBitmap);
        if (!isInForeground) {
            startForegroundSafely(notification);
        } else {
            try {
                NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager != null) {
                    manager.notify(NOTIFICATION_ID, notification);
                }
            } catch (Exception ignored) {}
        }

        // Load cover art in background if changed (deduplicated)
        if (currentCover != null && !currentCover.isEmpty()
                && !currentCover.equals(cachedCoverUrl)
                && !currentCover.equals(loadingCoverUrl)) {
            final String urlToLoad = currentCover;
            loadingCoverUrl = urlToLoad;
            coverExecutor.execute(() -> {
                Bitmap bitmap = loadBitmapFromUrl(urlToLoad);
                if (bitmap != null && urlToLoad.equals(currentCover)) {
                    mainHandler.post(() -> {
                        cachedCoverBitmap = bitmap;
                        cachedCoverUrl = urlToLoad;
                        updateMediaSessionState();
                        try {
                            Notification updatedNotif = buildNotification(bitmap);
                            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                            if (manager != null) {
                                manager.notify(NOTIFICATION_ID, updatedNotif);
                            }
                        } catch (Exception ignored) {}
                    });
                }
            });
        }
    }

    private Notification buildNotification(@Nullable Bitmap coverBitmap) {
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                this, 0, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        PendingIntent prevPending = createActionPendingIntent(ACTION_PREV, 1);
        PendingIntent playPausePending = createActionPendingIntent(isPlaying ? ACTION_PAUSE : ACTION_PLAY, 2);
        PendingIntent nextPending = createActionPendingIntent(ACTION_NEXT, 3);
        PendingIntent deletePending = createActionPendingIntent(ACTION_STOP, 4);

        int playPauseIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playPauseTitle = isPlaying ? "Pausa" : "Riproduci";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setSubText("SuperMusic PRO")
                .setContentIntent(contentPendingIntent)
                .setDeleteIntent(deletePending)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(isPlaying)
                .setOnlyAlertOnce(true)
                .addAction(android.R.drawable.ic_media_previous, "Precedente", prevPending)
                .addAction(playPauseIcon, playPauseTitle, playPausePending)
                .addAction(android.R.drawable.ic_media_next, "Successivo", nextPending);

        if (mediaSession != null) {
            builder.setStyle(new MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2));
        }

        if (coverBitmap != null) {
            builder.setLargeIcon(coverBitmap);
        }

        return builder.build();
    }

    private PendingIntent createActionPendingIntent(String action, int requestCode) {
        Intent intent = new Intent(this, MusicPlayerService.class);
        intent.setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getService(this, requestCode, intent, flags);
    }

    private Bitmap loadBitmapFromUrl(String urlString) {
        try {
            URL url = new URL(urlString);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setDoInput(true);
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.connect();
            InputStream input = connection.getInputStream();
            Bitmap raw = BitmapFactory.decodeStream(input);
            if (raw != null && (raw.getWidth() > 256 || raw.getHeight() > 256)) {
                Bitmap scaled = Bitmap.createScaledBitmap(raw, 256, 256, true);
                if (scaled != raw) raw.recycle();
                return scaled;
            }
            return raw;
        } catch (Exception e) {
            return null;
        }
    }

    private void stopPlaybackService() {
        isPlaying = false;
        isInForeground = false;
        if (exoPlayer != null) {
            try {
                exoPlayer.pause();
                exoPlayer.stop();
                exoPlayer.clearMediaItems();
            } catch (Exception ignored) {}
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
        try {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
            stopSelf();
        } catch (Exception ignored) {}
        MusicNotificationPlugin.dispatchPlaybackState(false);
    }

    @Override
    public void onDestroy() {
        if (instance == this) {
            instance = null;
        }
        progressHandler.removeCallbacks(progressRunnable);
        try { executorService.shutdownNow(); } catch (Exception ignored) {}
        try { coverExecutor.shutdownNow(); } catch (Exception ignored) {}
        if (exoPlayer != null) {
            try { exoPlayer.release(); } catch (Exception ignored) {}
            exoPlayer = null;
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
        super.onDestroy();
    }

    public static class InnerTubeTrack {
        public final String videoId;
        public final String title;
        public final String artist;
        public final String thumbnail;

        public InnerTubeTrack(String videoId, String title, String artist, String thumbnail) {
            this.videoId = videoId;
            this.title = title;
            this.artist = artist;
            this.thumbnail = thumbnail;
        }
    }

    private void playQueueTrack(String mediaId) {
        try {
            String[] parts = mediaId.split(":", 6);
            if (parts.length >= 2) {
                int index = Integer.parseInt(parts[1]);
                synchronized (nativeQueue) {
                    if (index >= 0 && index < nativeQueue.size()) {
                        nativeQueueIndex = index;
                        NativeTrackItem t = nativeQueue.get(index);
                        currentTitle = t.title != null ? t.title : "SuperMusic PRO";
                        currentArtist = t.artist != null ? t.artist : "Artista";
                        currentCover = t.cover != null ? t.cover : "";
                        currentVideoId = t.videoId != null ? t.videoId : "";
                        hasRetriedNatively = false;
                        isPlaying = true;

                        setMediaSessionBuffering();
                        startForegroundWithNotification();
                        playTrackNatively(t.url, t.videoId);
                        MusicNotificationPlugin.dispatchTrackChanged(currentTitle, currentArtist, currentCover, currentVideoId, nativeQueueIndex);
                        return;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing queue track: " + mediaId, e);
        }
    }

    private void playFavoriteTrack(String mediaId) {
        try {
            String[] parts = mediaId.split(":", 6);
            if (parts.length >= 2) {
                int index = Integer.parseInt(parts[1]);
                synchronized (nativeQueue) {
                    if (index >= 0 && index < nativeFavorites.size()) {
                        nativeQueue.clear();
                        nativeQueue.addAll(nativeFavorites);
                        nativeQueueIndex = index;
                        NativeTrackItem t = nativeQueue.get(index);
                        currentTitle = t.title != null ? t.title : "SuperMusic PRO";
                        currentArtist = t.artist != null ? t.artist : "Artista";
                        currentCover = t.cover != null ? t.cover : "";
                        currentVideoId = t.videoId != null ? t.videoId : "";
                        hasRetriedNatively = false;
                        isPlaying = true;

                        setMediaSessionBuffering();
                        startForegroundWithNotification();
                        playTrackNatively(t.url, t.videoId);
                        MusicNotificationPlugin.dispatchTrackChanged(currentTitle, currentArtist, currentCover, currentVideoId, nativeQueueIndex);
                        return;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing favorite track: " + mediaId, e);
        }
    }

    private void playPlaylistTrack(String mediaId) {
        try {
            String[] parts = mediaId.split(":", 7);
            if (parts.length >= 3) {
                int pIndex = Integer.parseInt(parts[1]);
                int sIndex = Integer.parseInt(parts[2]);
                synchronized (nativeQueue) {
                    if (pIndex >= 0 && pIndex < nativePlaylists.size()) {
                        NativePlaylistItem pl = nativePlaylists.get(pIndex);
                        if (sIndex >= 0 && sIndex < pl.tracks.size()) {
                            nativeQueue.clear();
                            nativeQueue.addAll(pl.tracks);
                            nativeQueueIndex = sIndex;
                            NativeTrackItem t = nativeQueue.get(sIndex);
                            currentTitle = t.title != null ? t.title : "SuperMusic PRO";
                            currentArtist = t.artist != null ? t.artist : "Artista";
                            currentCover = t.cover != null ? t.cover : "";
                            currentVideoId = t.videoId != null ? t.videoId : "";
                            hasRetriedNatively = false;
                            isPlaying = true;

                            setMediaSessionBuffering();
                            startForegroundWithNotification();
                            playTrackNatively(t.url, t.videoId);
                            MusicNotificationPlugin.dispatchTrackChanged(currentTitle, currentArtist, currentCover, currentVideoId, nativeQueueIndex);
                            return;
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing playlist track: " + mediaId, e);
        }
    }

    private void playCategoryTrack(String mediaId) {
        try {
            String[] parts = mediaId.split(":", 7);
            if (parts.length >= 3) {
                String parentId = Uri.decode(parts[1]);
                int index = Integer.parseInt(parts[2]);
                List<NativeTrackItem> list = null;
                synchronized (categoryCache) {
                    list = categoryCache.get(parentId);
                }
                if (list != null && index >= 0 && index < list.size()) {
                    synchronized (nativeQueue) {
                        nativeQueue.clear();
                        nativeQueue.addAll(list);
                        nativeQueueIndex = index;
                    }
                    NativeTrackItem t = list.get(index);
                    currentTitle = t.title != null ? t.title : "SuperMusic PRO";
                    currentArtist = t.artist != null ? t.artist : "Artista";
                    currentCover = t.cover != null ? t.cover : "";
                    currentVideoId = t.videoId != null ? t.videoId : "";
                    hasRetriedNatively = false;
                    isPlaying = true;

                    setMediaSessionBuffering();
                    startForegroundWithNotification();
                    playTrackNatively(t.url, t.videoId);
                    MusicNotificationPlugin.dispatchTrackChanged(currentTitle, currentArtist, currentCover, currentVideoId, nativeQueueIndex);
                    return;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing category track: " + mediaId, e);
        }
        playAndroidAutoTrack(mediaId);
    }

    private void playAndroidAutoTrack(String mediaId) {
        try {
            String[] parts = mediaId.split(":", 5);
            if (parts.length >= 2) {
                String vidOrType = parts[1];
                String title = parts.length > 2 ? Uri.decode(parts[2]) : "SuperMusic PRO";
                String artist = parts.length > 3 ? Uri.decode(parts[3]) : "Artista";
                String cover = parts.length > 4 ? Uri.decode(parts[4]) : "";

                currentTitle = title;
                currentArtist = artist;
                currentCover = cover;
                currentVideoId = "query".equals(vidOrType) ? "" : vidOrType;
                hasRetriedNatively = false;
                isPlaying = true;

                // If this track belongs to a cached search or category list, populate nativeQueue so Next/Prev and continuous playback work!
                boolean foundInContext = false;
                synchronized (categoryCache) {
                    for (List<NativeTrackItem> catList : categoryCache.values()) {
                        int pos = findTrackIndexInList(catList, currentVideoId, currentTitle);
                        if (pos != -1) {
                            synchronized (nativeQueue) {
                                nativeQueue.clear();
                                nativeQueue.addAll(catList);
                                nativeQueueIndex = pos;
                            }
                            foundInContext = true;
                            break;
                        }
                    }
                }
                if (!foundInContext) {
                    synchronized (nativeTrending) {
                        int pos = findTrackIndexInList(nativeTrending, currentVideoId, currentTitle);
                        if (pos != -1) {
                            synchronized (nativeQueue) {
                                nativeQueue.clear();
                                nativeQueue.addAll(nativeTrending);
                                nativeQueueIndex = pos;
                            }
                        }
                    }
                }

                setMediaSessionBuffering();
                startForegroundWithNotification();
                playTrackNatively(null, currentVideoId);
                MusicNotificationPlugin.dispatchTrackChanged(currentTitle, currentArtist, currentCover, currentVideoId, nativeQueueIndex);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing Android Auto track: " + mediaId, e);
        }
    }

    private void playDjSmartMix() {
        try {
            NativeTrackItem target = null;
            synchronized (nativeQueue) {
                if (!nativeFavorites.isEmpty()) {
                    nativeQueue.clear();
                    nativeQueue.addAll(nativeFavorites);
                    Collections.shuffle(nativeQueue);
                    nativeQueueIndex = 0;
                    target = nativeQueue.get(0);
                } else if (!nativeTrending.isEmpty()) {
                    nativeQueue.clear();
                    nativeQueue.addAll(nativeTrending);
                    Collections.shuffle(nativeQueue);
                    nativeQueueIndex = 0;
                    target = nativeQueue.get(0);
                } else if (!nativeCatalog.isEmpty()) {
                    nativeQueue.clear();
                    nativeQueue.addAll(nativeCatalog);
                    Collections.shuffle(nativeQueue);
                    nativeQueueIndex = 0;
                    target = nativeQueue.get(0);
                } else {
                    List<MediaBrowserCompat.MediaItem> fallbacks = getDefaultFallbackItems();
                    if (!fallbacks.isEmpty()) {
                        nativeQueue.clear();
                        for (MediaBrowserCompat.MediaItem item : fallbacks) {
                            NativeTrackItem nti = new NativeTrackItem();
                            nti.title = item.getDescription().getTitle() != null ? item.getDescription().getTitle().toString() : "SuperMusic PRO";
                            nti.artist = item.getDescription().getSubtitle() != null ? item.getDescription().getSubtitle().toString() : "Artista";
                            nti.cover = item.getDescription().getIconUri() != null ? item.getDescription().getIconUri().toString() : "";
                            String mediaId = item.getDescription().getMediaId();
                            if (mediaId != null && mediaId.startsWith("track:")) {
                                String[] p = mediaId.split(":", 5);
                                if (p.length >= 2) nti.videoId = p[1];
                            }
                            nativeQueue.add(nti);
                        }
                        nativeQueueIndex = 0;
                        if (!nativeQueue.isEmpty()) target = nativeQueue.get(0);
                    }
                }
            }
            if (target != null) {
                currentTitle = target.title != null ? target.title : "SuperMusic PRO";
                currentArtist = target.artist != null ? target.artist : "DJ Smart Mix";
                currentCover = target.cover != null ? target.cover : "";
                currentVideoId = target.videoId != null ? target.videoId : "";
                hasRetriedNatively = false;
                isPlaying = true;

                setMediaSessionBuffering();
                startForegroundWithNotification();
                playTrackNatively(target.url, target.videoId);
                MusicNotificationPlugin.dispatchTrackChanged(currentTitle, currentArtist, currentCover, currentVideoId, nativeQueueIndex);
            }
        } catch (Exception e) {
            Log.e(TAG, "playDjSmartMix error", e);
        }
    }

    private void playAndroidAutoSearch(String query) {
        setMediaSessionBuffering();
        executorService.execute(() -> {
            lastSearchQuery = query;
            lastSearchLimit = 25;
            List<InnerTubeTrack> tracks = fetchInnerTubeTracks(query, 25);
            if (!tracks.isEmpty()) {
                List<NativeTrackItem> nativeList = new ArrayList<>();
                synchronized (nativeQueue) {
                    nativeQueue.clear();
                    for (InnerTubeTrack tr : tracks) {
                        NativeTrackItem item = new NativeTrackItem();
                        item.title = tr.title;
                        item.artist = tr.artist;
                        item.cover = tr.thumbnail;
                        item.videoId = tr.videoId;
                        item.url = "";
                        nativeQueue.add(item);
                        nativeList.add(item);
                    }
                    nativeQueueIndex = 0;
                }
                synchronized (categoryCache) {
                    categoryCache.put("search:" + query, nativeList);
                }
                InnerTubeTrack first = tracks.get(0);
                mainHandler.post(() -> {
                    currentTitle = first.title;
                    currentArtist = first.artist;
                    currentCover = first.thumbnail;
                    currentVideoId = first.videoId;
                    hasRetriedNatively = false;
                    isPlaying = true;

                    setMediaSessionBuffering();
                    startForegroundWithNotification();
                    playTrackNatively(null, first.videoId);
                    MusicNotificationPlugin.dispatchTrackChanged(currentTitle, currentArtist, currentCover, currentVideoId, 0);
                });
            } else {
                mainHandler.post(this::playDjSmartMix);
            }
        });
    }

    private MediaBrowserCompat.MediaItem createGenreCategoryItem(String id, String title, String subtitle) {
        Bundle extras = new Bundle();
        extras.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
        MediaDescriptionCompat.Builder builder = new MediaDescriptionCompat.Builder()
                .setMediaId(id)
                .setTitle(title)
                .setSubtitle(subtitle)
                .setExtras(extras);
        if (id.startsWith("search:Nuove")) {
            builder.setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_new_releases"));
        } else if (id.startsWith("search:Hit") || id.contains("pop")) {
            builder.setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_trending"));
        } else if (id.contains("dance")) {
            builder.setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_dj"));
        } else {
            builder.setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_tab_music"));
        }
        return new MediaBrowserCompat.MediaItem(builder.build(), MediaBrowserCompat.MediaItem.FLAG_BROWSABLE);
    }

    private List<MediaBrowserCompat.MediaItem> getDefaultFallbackItems() {
        return new ArrayList<>();
    }

    private List<InnerTubeTrack> fetchInnerTubeTracks(String query, int limit) {
        List<InnerTubeTrack> list = new ArrayList<>();
        if (query == null || query.trim().isEmpty()) return list;

        try {
            JSONObject clientObj = new JSONObject();
            clientObj.put("clientName", "WEB_REMIX");
            clientObj.put("clientVersion", "1.20240901.01.00");
            clientObj.put("hl", "it");
            clientObj.put("gl", "IT");

            JSONObject payload = new JSONObject();
            payload.put("context", new JSONObject().put("client", clientObj));
            payload.put("query", query);
            payload.put("params", "EgWKAQIIAWoKEAkQBRAKEAMQBA==");

            RequestBody body = RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8"));
            Request request = new Request.Builder()
                    .url("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
                    .post(body)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
                    .build();

            try (Response response = okHttpClient.newCall(request).execute()) {
                if (response.isSuccessful() && response.body() != null) {
                    String respStr = response.body().string();
                    JSONObject root = new JSONObject(respStr);
                    parseMusicItems(root, list, limit);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error fetching InnerTube tracks for query: " + query, e);
        }
        return list;
    }

    private void parseMusicItems(Object node, List<InnerTubeTrack> list, int limit) {
        if (node == null || list.size() >= limit) return;

        if (node instanceof JSONObject) {
            JSONObject obj = (JSONObject) node;
            if (obj.has("musicResponsiveListItemRenderer")) {
                JSONObject r = obj.optJSONObject("musicResponsiveListItemRenderer");
                if (r != null) {
                    String videoId = "";
                    JSONObject playData = r.optJSONObject("playlistItemData");
                    if (playData != null) {
                        videoId = playData.optString("videoId", "");
                    }
                    if (videoId.isEmpty()) {
                        JSONObject nav = r.optJSONObject("navigationEndpoint");
                        if (nav != null) {
                            JSONObject watch = nav.optJSONObject("watchEndpoint");
                            if (watch != null) {
                                videoId = watch.optString("videoId", "");
                            }
                        }
                    }
                    if (videoId.isEmpty()) {
                        JSONObject overlay = r.optJSONObject("overlay");
                        if (overlay != null) {
                            JSONObject thumbOverlay = overlay.optJSONObject("musicItemThumbnailOverlayRenderer");
                            if (thumbOverlay != null) {
                                JSONObject content = thumbOverlay.optJSONObject("content");
                                if (content != null) {
                                    JSONObject playBtn = content.optJSONObject("musicPlayButtonRenderer");
                                    if (playBtn != null) {
                                        JSONObject nav = playBtn.optJSONObject("playNavigationEndpoint");
                                        if (nav != null) {
                                            JSONObject watch = nav.optJSONObject("watchEndpoint");
                                            if (watch != null) {
                                                videoId = watch.optString("videoId", "");
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    String title = "";
                    String artist = "";
                    String thumb = "";

                    JSONArray flexCols = r.optJSONArray("flexColumns");
                    if (flexCols != null && flexCols.length() > 0) {
                        JSONObject col0 = flexCols.optJSONObject(0);
                        if (col0 != null) {
                            JSONObject flexRenderer = col0.optJSONObject("musicResponsiveListItemFlexColumnRenderer");
                            if (flexRenderer != null) {
                                JSONObject textObj = flexRenderer.optJSONObject("text");
                                if (textObj != null) {
                                    JSONArray runs = textObj.optJSONArray("runs");
                                    if (runs != null && runs.length() > 0) {
                                        title = runs.optJSONObject(0).optString("text", "");
                                    }
                                }
                            }
                        }
                        if (flexCols.length() > 1) {
                            JSONObject col1 = flexCols.optJSONObject(1);
                            if (col1 != null) {
                                JSONObject flexRenderer = col1.optJSONObject("musicResponsiveListItemFlexColumnRenderer");
                                if (flexRenderer != null) {
                                    JSONObject textObj = flexRenderer.optJSONObject("text");
                                    if (textObj != null) {
                                        JSONArray runs = textObj.optJSONArray("runs");
                                        if (runs != null && runs.length() > 0) {
                                            artist = runs.optJSONObject(0).optString("text", "");
                                        }
                                    }
                                }
                            }
                        }
                    }

                    JSONObject thumbObj = r.optJSONObject("thumbnail");
                    if (thumbObj != null) {
                        JSONObject musicThumb = thumbObj.optJSONObject("musicThumbnailRenderer");
                        if (musicThumb != null) {
                            JSONObject tObj = musicThumb.optJSONObject("thumbnail");
                            if (tObj != null) {
                                JSONArray thumbs = tObj.optJSONArray("thumbnails");
                                if (thumbs != null && thumbs.length() > 0) {
                                    thumb = thumbs.optJSONObject(thumbs.length() - 1).optString("url", "");
                                }
                            }
                        }
                    }

                    if (!videoId.isEmpty() && !title.isEmpty()) {
                        list.add(new InnerTubeTrack(videoId, title, artist.isEmpty() ? "SuperMusic" : artist, thumb));
                    }
                }
            }

            java.util.Iterator<String> keys = obj.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                parseMusicItems(obj.opt(k), list, limit);
            }
        } else if (node instanceof JSONArray) {
            JSONArray arr = (JSONArray) node;
            for (int i = 0; i < arr.length(); i++) {
                parseMusicItems(arr.opt(i), list, limit);
            }
        }
    }

    @Nullable
    @Override
    public BrowserRoot onGetRoot(@NonNull String clientPackageName, int clientUid, @Nullable Bundle rootHints) {
        Log.d(TAG, "Android Auto onGetRoot for client: " + clientPackageName);

        boolean hasActiveTrack = isPlaying || (exoPlayer != null && exoPlayer.getPlaybackState() != Player.STATE_IDLE && exoPlayer.getPlaybackState() != Player.STATE_ENDED);
        if (!hasActiveTrack && (currentVideoId == null || currentVideoId.isEmpty()) && mediaSession != null) {
            long initialActions = PlaybackStateCompat.ACTION_PLAY |
                    PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID |
                    PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH |
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;
            mediaSession.setPlaybackState(
                    new PlaybackStateCompat.Builder()
                            .setActions(initialActions)
                            .setState(PlaybackStateCompat.STATE_NONE, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f)
                            .build()
            );
            mediaSession.setMetadata(null);
        }

        Bundle extras = new Bundle();
        extras.putBoolean("android.media.browse.SEARCH_SUPPORTED", true);
        extras.putBoolean("android.media.browse.CONTENT_STYLE_SUPPORTED", true);
        // 1 = LIST (Rettangoli a righe con copertina e testo)
        // 2 = GRID (Quadratoni)
        extras.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
        extras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
        return new BrowserRoot(MEDIA_ROOT_ID, extras);
    }

    @Override
    public void onLoadChildren(@NonNull String parentId, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        Log.d(TAG, "Android Auto onLoadChildren for parentId: " + parentId);

        // 1. ROOT -> Mostra esattamente 4 Tab / Pills in alto (come Spotify: Tutti, Musica, Tendenze, Preferiti)
        if (MEDIA_ROOT_ID.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();

            Bundle bAll = new Bundle();
            bAll.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat descAll = new MediaDescriptionCompat.Builder()
                    .setMediaId(TAB_ALL)
                    .setTitle("Tutti")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_tab_all"))
                    .setExtras(bAll)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(descAll, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            Bundle bMusic = new Bundle();
            bMusic.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat descMusic = new MediaDescriptionCompat.Builder()
                    .setMediaId(TAB_MUSIC)
                    .setTitle("Musica")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_tab_music"))
                    .setExtras(bMusic)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(descMusic, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            Bundle bTrend = new Bundle();
            bTrend.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat descTrend = new MediaDescriptionCompat.Builder()
                    .setMediaId(TAB_TRENDING)
                    .setTitle("Tendenze")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_tab_trending"))
                    .setExtras(bTrend)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(descTrend, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            Bundle bFav = new Bundle();
            bFav.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat descFav = new MediaDescriptionCompat.Builder()
                    .setMediaId(TAB_FAVORITES)
                    .setTitle("Preferiti")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_tab_favorites"))
                    .setExtras(bFav)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(descFav, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            result.sendResult(items);
            return;
        }

        // 2. TAB "TUTTI" (All) -> Layout a griglia 2 colonne stile Spotify Home con 8 card + DJ Banner
        if (TAB_ALL.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();

            // Card 1: Liked Songs / Brani Preferiti
            int fCount = 0;
            synchronized (nativeFavorites) { fCount = nativeFavorites.size(); }
            Bundle bFav = new Bundle();
            bFav.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dFav = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_FAVORITES)
                    .setTitle("Brani Preferiti")
                    .setSubtitle(fCount > 0 ? (fCount + " brani salvati") : "I tuoi brani con il cuore")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_favorites"))
                    .setExtras(bFav)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dFav, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            // Card 2: Canzoni da Viaggio / Hit del Momento
            Bundle bTr = new Bundle();
            bTr.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dTr = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_TRENDING)
                    .setTitle("Hit del Momento")
                    .setSubtitle("Le canzoni più ascoltate in Italia")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_trending"))
                    .setExtras(bTr)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dTr, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            // Card 3: Ultime Uscite (Discover)
            Bundle bRel = new Bundle();
            bRel.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dRel = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_NEW_RELEASES)
                    .setTitle("Ultime Uscite")
                    .setSubtitle("I nuovi singoli e uscite fresche")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_new_releases"))
                    .setExtras(bRel)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dRel, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            // Card 4: Coda di Riproduzione
            int qCount = 0;
            synchronized (nativeQueue) { qCount = nativeQueue.size(); }
            Bundle bQueue = new Bundle();
            bQueue.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dQueue = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_QUEUE)
                    .setTitle("Coda di Riproduzione")
                    .setSubtitle(qCount > 0 ? (qCount + " brani in sequenza") : "Coda attiva dall'app")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_queue"))
                    .setExtras(bQueue)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dQueue, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            // Card 5: Playlist Personali
            int pCount = 0;
            synchronized (nativePlaylists) { pCount = nativePlaylists.size(); }
            Bundle bPl = new Bundle();
            bPl.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dPl = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_PLAYLISTS)
                    .setTitle("Le Mie Playlist")
                    .setSubtitle(pCount > 0 ? (pCount + " playlist create") : "Le tue playlist personali")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_playlists"))
                    .setExtras(bPl)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dPl, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            // Card 6: I Più Ascoltati (On Repeat)
            Bundle bMost = new Bundle();
            bMost.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dMost = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_MOST_PLAYED)
                    .setTitle("I Più Ascoltati")
                    .setSubtitle("I brani che riascolti più spesso")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_most_played"))
                    .setExtras(bMost)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dMost, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            // Card 7: Mix Giornaliero (Daylist)
            Bundle bDay = new Bundle();
            bDay.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dDay = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_DAILY_MIX)
                    .setTitle("Mix Giornaliero")
                    .setSubtitle("Selezione smart per il tuo viaggio")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_daylist"))
                    .setExtras(bDay)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dDay, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            // Card 8: Cerca Musica
            Bundle bSearch = new Bundle();
            bSearch.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dSearch = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_SEARCH)
                    .setTitle("Cerca Musica")
                    .setSubtitle("Generi musicali e artisti")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_tab_music"))
                    .setExtras(bSearch)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dSearch, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            // Card 9: BANNER SPOTIFY DJ: "DJ SuperMusic" (Playable)
            Bundle bDj = new Bundle();
            bDj.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
            MediaDescriptionCompat dDj = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_DJ)
                    .setTitle("⚡ DJ SuperMusic")
                    .setSubtitle("Lascia scegliere la musica al DJ • Tocca per avviare")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_dj"))
                    .setExtras(bDj)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dDj, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));

            result.sendResult(items);
            return;
        }

        // 3. TAB "MUSICA" -> Libreria musicale
        if (TAB_MUSIC.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();

            int qCount = 0;
            synchronized (nativeQueue) { qCount = nativeQueue.size(); }
            Bundle bQueue = new Bundle();
            bQueue.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dQueue = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_QUEUE)
                    .setTitle("📋 Coda di Riproduzione")
                    .setSubtitle(qCount > 0 ? (qCount + " brani in sequenza") : "Coda corrente")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_queue"))
                    .setExtras(bQueue)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dQueue, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            int pCount = 0;
            synchronized (nativePlaylists) { pCount = nativePlaylists.size(); }
            Bundle bPl = new Bundle();
            bPl.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dPl = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_PLAYLISTS)
                    .setTitle("🎵 Le Mie Playlist")
                    .setSubtitle(pCount > 0 ? (pCount + " playlist salvate") : "Le tue playlist personali")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_playlists"))
                    .setExtras(bPl)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dPl, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            int fCount = 0;
            synchronized (nativeFavorites) { fCount = nativeFavorites.size(); }
            Bundle bFav = new Bundle();
            bFav.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dFav = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_FAVORITES)
                    .setTitle("❤️ Brani Preferiti")
                    .setSubtitle(fCount > 0 ? (fCount + " canzoni") : "I tuoi preferiti")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_favorites"))
                    .setExtras(bFav)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dFav, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            Bundle bMost = new Bundle();
            bMost.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dMost = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_MOST_PLAYED)
                    .setTitle("🎧 I Più Ascoltati")
                    .setSubtitle("I brani che riascolti più spesso")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_most_played"))
                    .setExtras(bMost)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dMost, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            Bundle bSearch = new Bundle();
            bSearch.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            MediaDescriptionCompat dSearch = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_SEARCH)
                    .setTitle("🔍 Cerca Musica")
                    .setSubtitle("Generi musicali e artisti")
                    .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_tab_music"))
                    .setExtras(bSearch)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(dSearch, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            result.sendResult(items);
            return;
        }

        // 4. TAB "TENDENZE" o CARTELLA "HIT DEL MOMENTO"
        if (TAB_TRENDING.equals(parentId) || MEDIA_ID_TRENDING.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            synchronized (nativeTrending) {
                for (NativeTrackItem t : nativeTrending) {
                    Bundle itemExtras = new Bundle();
                    itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                    MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                            .setMediaId("track:" + (t.videoId != null ? t.videoId : "") + ":" + Uri.encode(t.title) + ":" + Uri.encode(t.artist) + ":" + Uri.encode(t.cover != null ? t.cover : ""))
                            .setTitle(t.title)
                            .setSubtitle(t.artist)
                            .setIconUri(t.cover != null && !t.cover.isEmpty() ? Uri.parse(t.cover) : null)
                            .setExtras(itemExtras)
                            .build();
                    items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
                }
            }
            if (!items.isEmpty()) {
                result.sendResult(items);
                return;
            }
            result.detach();
            executorService.execute(() -> {
                List<InnerTubeTrack> tracks = fetchInnerTubeTracks("Hit del momento Italia", 20);
                List<MediaBrowserCompat.MediaItem> dyn = new ArrayList<>();
                synchronized (nativeTrending) {
                    nativeTrending.clear();
                    for (InnerTubeTrack tr : tracks) {
                        NativeTrackItem item = new NativeTrackItem();
                        item.title = tr.title;
                        item.artist = tr.artist;
                        item.cover = tr.thumbnail;
                        item.videoId = tr.videoId;
                        item.url = "";
                        nativeTrending.add(item);

                        Bundle itemExtras = new Bundle();
                        itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                                .setMediaId("track:" + tr.videoId + ":" + Uri.encode(tr.title) + ":" + Uri.encode(tr.artist) + ":" + Uri.encode(tr.thumbnail))
                                .setTitle(tr.title)
                                .setSubtitle(tr.artist)
                                .setIconUri(tr.thumbnail != null && !tr.thumbnail.isEmpty() ? Uri.parse(tr.thumbnail) : null)
                                .setExtras(itemExtras)
                                .build();
                        dyn.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
                    }
                }
                mainHandler.post(() -> result.sendResult(dyn));
            });
            return;
        }

        // 5. ULTIME USCITE
        if (MEDIA_ID_NEW_RELEASES.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            synchronized (nativeNewReleases) {
                for (NativeTrackItem t : nativeNewReleases) {
                    Bundle itemExtras = new Bundle();
                    itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                    MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                            .setMediaId("track:" + (t.videoId != null ? t.videoId : "") + ":" + Uri.encode(t.title) + ":" + Uri.encode(t.artist) + ":" + Uri.encode(t.cover != null ? t.cover : ""))
                            .setTitle(t.title)
                            .setSubtitle(t.artist)
                            .setIconUri(t.cover != null && !t.cover.isEmpty() ? Uri.parse(t.cover) : null)
                            .setExtras(itemExtras)
                            .build();
                    items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
                }
            }
            if (!items.isEmpty()) {
                result.sendResult(items);
                return;
            }
            result.detach();
            executorService.execute(() -> {
                List<InnerTubeTrack> tracks = fetchInnerTubeTracks("Nuove Uscite Italia", 20);
                List<MediaBrowserCompat.MediaItem> dyn = new ArrayList<>();
                synchronized (nativeNewReleases) {
                    nativeNewReleases.clear();
                    for (InnerTubeTrack tr : tracks) {
                        NativeTrackItem item = new NativeTrackItem();
                        item.title = tr.title;
                        item.artist = tr.artist;
                        item.cover = tr.thumbnail;
                        item.videoId = tr.videoId;
                        item.url = "";
                        nativeNewReleases.add(item);

                        Bundle itemExtras = new Bundle();
                        itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                                .setMediaId("track:" + tr.videoId + ":" + Uri.encode(tr.title) + ":" + Uri.encode(tr.artist) + ":" + Uri.encode(tr.thumbnail))
                                .setTitle(tr.title)
                                .setSubtitle(tr.artist)
                                .setIconUri(tr.thumbnail != null && !tr.thumbnail.isEmpty() ? Uri.parse(tr.thumbnail) : null)
                                .setExtras(itemExtras)
                                .build();
                        dyn.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
                    }
                }
                mainHandler.post(() -> result.sendResult(dyn));
            });
            return;
        }

        // 6. I PIÙ ASCOLTATI
        if (MEDIA_ID_MOST_PLAYED.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            synchronized (nativeFavorites) {
                if (!nativeFavorites.isEmpty()) {
                    for (int i = 0; i < Math.min(15, nativeFavorites.size()); i++) {
                        NativeTrackItem t = nativeFavorites.get(i);
                        Bundle itemExtras = new Bundle();
                        itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                                .setMediaId("fav_track:" + i + ":" + (t.videoId != null ? t.videoId : "") + ":" + Uri.encode(t.title) + ":" + Uri.encode(t.artist) + ":" + Uri.encode(t.cover != null ? t.cover : ""))
                                .setTitle(t.title)
                                .setSubtitle(t.artist)
                                .setIconUri(t.cover != null && !t.cover.isEmpty() ? Uri.parse(t.cover) : null)
                                .setExtras(itemExtras)
                                .build();
                        items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
                    }
                }
            }
            if (items.isEmpty()) {
                synchronized (nativeTrending) {
                    for (int i = 0; i < Math.min(15, nativeTrending.size()); i++) {
                        NativeTrackItem t = nativeTrending.get(i);
                        Bundle itemExtras = new Bundle();
                        itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                                .setMediaId("track:" + (t.videoId != null ? t.videoId : "") + ":" + Uri.encode(t.title) + ":" + Uri.encode(t.artist) + ":" + Uri.encode(t.cover != null ? t.cover : ""))
                                .setTitle(t.title)
                                .setSubtitle(t.artist)
                                .setIconUri(t.cover != null && !t.cover.isEmpty() ? Uri.parse(t.cover) : null)
                                .setExtras(itemExtras)
                                .build();
                        items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
                    }
                }
            }
            result.sendResult(items);
            return;
        }

        // 7. MIX GIORNALIERO (Daylist)
        if (MEDIA_ID_DAILY_MIX.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            List<NativeTrackItem> pool = new ArrayList<>();
            synchronized (nativeFavorites) { pool.addAll(nativeFavorites); }
            synchronized (nativeTrending) { pool.addAll(nativeTrending); }
            Collections.shuffle(pool);
            for (int i = 0; i < Math.min(20, pool.size()); i++) {
                NativeTrackItem t = pool.get(i);
                Bundle itemExtras = new Bundle();
                itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                        .setMediaId("track:" + (t.videoId != null ? t.videoId : "") + ":" + Uri.encode(t.title) + ":" + Uri.encode(t.artist) + ":" + Uri.encode(t.cover != null ? t.cover : ""))
                        .setTitle(t.title)
                        .setSubtitle(t.artist)
                        .setIconUri(t.cover != null && !t.cover.isEmpty() ? Uri.parse(t.cover) : null)
                        .setExtras(itemExtras)
                        .build();
                items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
            }
            result.sendResult(items);
            return;
        }

        if (MEDIA_ID_QUEUE.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            synchronized (nativeQueue) {
                for (int i = 0; i < nativeQueue.size(); i++) {
                    NativeTrackItem t = nativeQueue.get(i);
                    Bundle itemExtras = new Bundle();
                    itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                    MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                            .setMediaId("queue_track:" + i + ":" + (t.videoId != null ? t.videoId : "") + ":" + Uri.encode(t.title) + ":" + Uri.encode(t.artist) + ":" + Uri.encode(t.cover != null ? t.cover : ""))
                            .setTitle((i + 1) + ". " + t.title)
                            .setSubtitle(t.artist)
                            .setIconUri(t.cover != null && !t.cover.isEmpty() ? Uri.parse(t.cover) : null)
                            .setExtras(itemExtras)
                            .build();
                    items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
                }
            }
            if (items.isEmpty()) {
                Bundle itemExtras = new Bundle();
                itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                        .setMediaId(MEDIA_ID_NOW_PLAYING)
                        .setTitle("Coda vuota")
                        .setSubtitle("Avvia un brano o una playlist dall'app")
                        .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_queue"))
                        .setExtras(itemExtras)
                        .build();
                items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
            }
            result.sendResult(items);
            return;
        }

        if (MEDIA_ID_FAVORITES.equals(parentId) || TAB_FAVORITES.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            synchronized (nativeFavorites) {
                for (int i = 0; i < nativeFavorites.size(); i++) {
                    NativeTrackItem t = nativeFavorites.get(i);
                    Bundle itemExtras = new Bundle();
                    itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                    MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                            .setMediaId("fav_track:" + i + ":" + (t.videoId != null ? t.videoId : "") + ":" + Uri.encode(t.title) + ":" + Uri.encode(t.artist) + ":" + Uri.encode(t.cover != null ? t.cover : ""))
                            .setTitle(t.title)
                            .setSubtitle(t.artist)
                            .setIconUri(t.cover != null && !t.cover.isEmpty() ? Uri.parse(t.cover) : null)
                            .setExtras(itemExtras)
                            .build();
                    items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
                }
            }
            if (items.isEmpty()) {
                Bundle itemExtras = new Bundle();
                itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                        .setMediaId(MEDIA_ID_NOW_PLAYING)
                        .setTitle("Nessun brano preferito")
                        .setSubtitle("Aggiungi i brani ai preferiti con il cuore nell'app")
                        .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_favorites"))
                        .setExtras(itemExtras)
                        .build();
                items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
            }
            result.sendResult(items);
            return;
        }

        if (MEDIA_ID_PLAYLISTS.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            synchronized (nativePlaylists) {
                for (int i = 0; i < nativePlaylists.size(); i++) {
                    NativePlaylistItem pl = nativePlaylists.get(i);
                    Bundle itemExtras = new Bundle();
                    itemExtras.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
                    MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                            .setMediaId("playlist:" + i)
                            .setTitle(pl.name)
                            .setSubtitle(pl.tracks.size() + " brani")
                            .setIconUri(pl.cover != null && !pl.cover.isEmpty() ? Uri.parse(pl.cover) : null)
                            .setExtras(itemExtras)
                            .build();
                    items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));
                }
            }
            if (items.isEmpty()) {
                Bundle itemExtras = new Bundle();
                itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                        .setMediaId(MEDIA_ID_NOW_PLAYING)
                        .setTitle("Nessuna playlist creata")
                        .setSubtitle("Crea una playlist nell'app")
                        .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_card_playlists"))
                        .setExtras(itemExtras)
                        .build();
                items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
            }
            result.sendResult(items);
            return;
        }

        if (parentId.startsWith("playlist:")) {
            try {
                int pIndex = Integer.parseInt(parentId.substring("playlist:".length()));
                List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
                synchronized (nativePlaylists) {
                    if (pIndex >= 0 && pIndex < nativePlaylists.size()) {
                        NativePlaylistItem pl = nativePlaylists.get(pIndex);
                        for (int s = 0; s < pl.tracks.size(); s++) {
                            NativeTrackItem t = pl.tracks.get(s);
                            Bundle itemExtras = new Bundle();
                            itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                            MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                                    .setMediaId("pl_track:" + pIndex + ":" + s + ":" + (t.videoId != null ? t.videoId : "") + ":" + Uri.encode(t.title) + ":" + Uri.encode(t.artist) + ":" + Uri.encode(t.cover != null ? t.cover : ""))
                                    .setTitle(t.title)
                                    .setSubtitle(t.artist)
                                    .setIconUri(t.cover != null && !t.cover.isEmpty() ? Uri.parse(t.cover) : null)
                                    .setExtras(itemExtras)
                                    .build();
                            items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
                        }
                    }
                }
                result.sendResult(items);
                return;
            } catch (Exception ignored) {}
        }

        if (MEDIA_ID_GENRES.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            items.add(createGenreCategoryItem("genre:pop", "🎤 Pop Hits", "I migliori brani pop italiani e internazionali"));
            items.add(createGenreCategoryItem("genre:rap", "🎧 Rap & Urban", "Trap, rap italiano e hip-hop"));
            items.add(createGenreCategoryItem("genre:rock", "🎸 Rock Classics", "I grandi classici del rock"));
            items.add(createGenreCategoryItem("genre:dance", "⚡ Dance & EDM", "Musica elettronica e ritmi dance"));
            items.add(createGenreCategoryItem("genre:latin", "🌴 Reggaeton & Latin", "I ritmi più caldi del momento"));
            items.add(createGenreCategoryItem("genre:chill", "☕ Relax & Chill", "Brani acustici e ambient"));
            result.sendResult(items);
            return;
        }

        if (MEDIA_ID_SEARCH.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            items.add(createGenreCategoryItem("search:Nuove Uscite", "✨ Nuove Uscite", "Le ultime novità musicali"));
            items.add(createGenreCategoryItem("search:Hit Italia", "🇮🇹 Canzoni Italiane", "I brani più amati in Italia"));
            items.add(createGenreCategoryItem("search:Estate", "☀️ Tormentoni & Summer", "I pezzi più ballati"));
            items.add(createGenreCategoryItem("search:Anni 90 2000", "📻 Nostalgia 90-2000", "I successi indimenticabili"));
            result.sendResult(items);
            return;
        }

        // ParentId is a category to query dynamically!
        result.detach();
        executorService.execute(() -> {
            String query = "Hit del momento Italia";
            int limitToFetch = 20;
            if (MEDIA_ID_TRENDING.equals(parentId)) {
                query = "Hit del momento Italia";
            } else if (parentId.startsWith("genre:")) {
                String sub = parentId.substring("genre:".length());
                if ("pop".equals(sub)) query = "Pop Hits Nuove Uscite";
                else if ("rap".equals(sub)) query = "Rap Trap Italiano Hit";
                else if ("rock".equals(sub)) query = "Rock Classics Hits";
                else if ("dance".equals(sub)) query = "Dance EDM House Hits";
                else if ("latin".equals(sub)) query = "Reggaeton Latino Hits";
                else if ("chill".equals(sub)) query = "Acoustic Relax Lo-Fi";
            } else if (parentId.startsWith("more_search:")) {
                try {
                    String[] parts = parentId.split(":", 3);
                    if (parts.length >= 2) query = Uri.decode(parts[1]);
                    if (parts.length >= 3) limitToFetch = Integer.parseInt(parts[2]);
                } catch (Exception ignored) {}
            } else if (parentId.startsWith("search:")) {
                query = parentId.substring("search:".length());
            }

            lastSearchQuery = query;
            lastSearchLimit = limitToFetch;

            List<InnerTubeTrack> tracks = fetchInnerTubeTracks(query, limitToFetch);
            List<NativeTrackItem> nativeList = new ArrayList<>();
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            for (int s = 0; s < tracks.size(); s++) {
                InnerTubeTrack t = tracks.get(s);
                NativeTrackItem nItem = new NativeTrackItem();
                nItem.title = t.title;
                nItem.artist = t.artist;
                nItem.cover = t.thumbnail;
                nItem.videoId = t.videoId;
                nItem.url = "";
                nativeList.add(nItem);

                Bundle itemExtras = new Bundle();
                itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                        .setMediaId("cat_track:" + Uri.encode(parentId) + ":" + s + ":" + (t.videoId != null ? t.videoId : "") + ":" + Uri.encode(t.title) + ":" + Uri.encode(t.artist) + ":" + Uri.encode(t.thumbnail != null ? t.thumbnail : ""))
                        .setTitle(t.title)
                        .setSubtitle(t.artist)
                        .setIconUri(t.thumbnail != null && !t.thumbnail.isEmpty() ? Uri.parse(t.thumbnail) : null)
                        .setExtras(itemExtras)
                        .build();
                items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
            }

            synchronized (categoryCache) {
                categoryCache.put(parentId, nativeList);
                if (parentId.startsWith("more_search:")) {
                    categoryCache.put("search:" + query, nativeList);
                }
            }

            // Append "➕ Carica altri 20 brani" button if results found
            if (!items.isEmpty() && tracks.size() >= limitToFetch && limitToFetch < 100) {
                int nextLimit = limitToFetch + 20;
                Bundle moreExtras = new Bundle();
                moreExtras.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
                MediaDescriptionCompat moreDesc = new MediaDescriptionCompat.Builder()
                        .setMediaId("more_search:" + Uri.encode(query) + ":" + nextLimit)
                        .setTitle("➕ Carica altri 20 brani (" + nextLimit + ")")
                        .setSubtitle("Tocca per espandere l'elenco di brani")
                        .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_tab_music"))
                        .setExtras(moreExtras)
                        .build();
                items.add(new MediaBrowserCompat.MediaItem(moreDesc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));
            }

            if (items.isEmpty()) {
                items.addAll(getDefaultFallbackItems());
            }

            mainHandler.post(() -> result.sendResult(items));
        });
    }

    @Override
    public void onSearch(@NonNull String query, Bundle extras, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        Log.d(TAG, "Android Auto onSearch: " + query);
        result.detach();
        executorService.execute(() -> {
            lastSearchQuery = query;
            lastSearchLimit = 20;
            List<InnerTubeTrack> tracks = fetchInnerTubeTracks(query, 20);
            List<NativeTrackItem> nativeList = new ArrayList<>();
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            String searchParentId = "search:" + query;
            for (int s = 0; s < tracks.size(); s++) {
                InnerTubeTrack t = tracks.get(s);
                NativeTrackItem nItem = new NativeTrackItem();
                nItem.title = t.title;
                nItem.artist = t.artist;
                nItem.cover = t.thumbnail;
                nItem.videoId = t.videoId;
                nItem.url = "";
                nativeList.add(nItem);

                Bundle itemExtras = new Bundle();
                itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                        .setMediaId("cat_track:" + Uri.encode(searchParentId) + ":" + s + ":" + (t.videoId != null ? t.videoId : "") + ":" + Uri.encode(t.title) + ":" + Uri.encode(t.artist) + ":" + Uri.encode(t.thumbnail != null ? t.thumbnail : ""))
                        .setTitle(t.title)
                        .setSubtitle(t.artist)
                        .setIconUri(t.thumbnail != null && !t.thumbnail.isEmpty() ? Uri.parse(t.thumbnail) : null)
                        .setExtras(itemExtras)
                        .build();
                items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
            }
            synchronized (categoryCache) {
                categoryCache.put(searchParentId, nativeList);
            }
            if (!items.isEmpty() && tracks.size() >= 20) {
                Bundle moreExtras = new Bundle();
                moreExtras.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
                MediaDescriptionCompat moreDesc = new MediaDescriptionCompat.Builder()
                        .setMediaId("more_search:" + Uri.encode(query) + ":40")
                        .setTitle("➕ Carica altri 20 brani (40)")
                        .setSubtitle("Tocca per espandere l'elenco di brani")
                        .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/drawable/ic_tab_music"))
                        .setExtras(moreExtras)
                        .build();
                items.add(new MediaBrowserCompat.MediaItem(moreDesc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));
            }
            if (items.isEmpty()) {
                items.addAll(getDefaultFallbackItems());
            }
            mainHandler.post(() -> result.sendResult(items));
        });
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        if (intent != null && "android.media.browse.MediaBrowserService".equals(intent.getAction())) {
            return super.onBind(intent);
        }
        return super.onBind(intent);
    }
}
