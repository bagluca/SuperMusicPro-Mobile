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
    public static final String MEDIA_ID_NOW_PLAYING = "supermusic_now_playing";
    public static final String MEDIA_ID_QUEUE = "supermusic_cat_queue";
    public static final String MEDIA_ID_FAVORITES = "supermusic_cat_favorites";
    public static final String MEDIA_ID_PLAYLISTS = "supermusic_cat_playlists";
    public static final String MEDIA_ID_TRENDING = "supermusic_cat_trending";
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

    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (MainActivity.isActivityResumed && exoPlayer != null && exoPlayer.isPlaying()) {
                long posMs = exoPlayer.getCurrentPosition();
                long durMs = exoPlayer.getDuration();
                long durSec = durMs > 0 ? durMs / 1000 : 180;
                MusicNotificationPlugin.dispatchPlaybackProgress((double) posMs / 1000.0, durSec);
            }
            progressHandler.postDelayed(this, 350);
        }
    };

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

        initDefaultCatalog();
        executorService.execute(() -> {
            try {
                List<InnerTubeTrack> liveTrending = fetchInnerTubeTracks("Top Hit Italia", 15);
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
                    mainHandler.post(() -> notifyChildrenChanged(MEDIA_ROOT_ID));
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
                    mainHandler.post(() -> notifyChildrenChanged(MEDIA_ROOT_ID));
                }
            } catch (Exception ignored) {}
        });

        progressHandler.post(progressRunnable);
    }

    private void initExoPlayer() {
        try {
            okHttpClient = new OkHttpClient.Builder()
                    .connectTimeout(15, TimeUnit.SECONDS)
                    .readTimeout(15, TimeUnit.SECONDS)
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
            mediaSession.setCallback(new MediaSessionCompat.Callback() {
                @Override
                public void onPlay() {
                    if (exoPlayer != null) exoPlayer.play();
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
                    }
                }

                @Override
                public void onPlayFromMediaId(String mediaId, Bundle extras) {
                    Log.d(TAG, "Android Auto onPlayFromMediaId: " + mediaId);
                    if (mediaId == null) return;
                    setMediaSessionBuffering();

                    if (MEDIA_ID_NOW_PLAYING.equals(mediaId)) {
                        if (exoPlayer != null) exoPlayer.play();
                    } else if (mediaId.startsWith("queue_track:")) {
                        playQueueTrack(mediaId);
                    } else if (mediaId.startsWith("fav_track:")) {
                        playFavoriteTrack(mediaId);
                    } else if (mediaId.startsWith("pl_track:")) {
                        playPlaylistTrack(mediaId);
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

    private void initDefaultCatalog() {
        synchronized (nativeTrending) {
            if (nativeTrending.isEmpty()) {
                String[][] trendData = new String[][] {
                        {"Balorda Nostalgia", "Olly, JVLI", "f4Mc-NYPHaQ", "https://i.ytimg.com/vi/f4Mc-NYPHaQ/hqdefault.jpg"},
                        {"Die With A Smile", "Lady Gaga, Bruno Mars", "kPa7bsKwL-c", "https://i.ytimg.com/vi/kPa7bsKwL-c/hqdefault.jpg"},
                        {"APT.", "ROSÉ & Bruno Mars", "ekr2nIex040", "https://i.ytimg.com/vi/ekr2nIex040/hqdefault.jpg"},
                        {"I P' ME, TU P' TE", "Geolier", "qon1NJ6D3co", "https://i.ytimg.com/vi/qon1NJ6D3co/hqdefault.jpg"},
                        {"Sinceramente", "Annalisa", "K_iaQPLdmJU", "https://i.ytimg.com/vi/K_iaQPLdmJU/hqdefault.jpg"},
                        {"TUTA GOLD", "Mahmood", "yr_Rwgdh59w", "https://i.ytimg.com/vi/yr_Rwgdh59w/hqdefault.jpg"},
                        {"100 Messaggi", "Lazza", "z8F0M4fI79k", "https://i.ytimg.com/vi/z8F0M4fI79k/hqdefault.jpg"},
                        {"Storie Brevi", "Tananai & Annalisa", "r7v7t191t6c", "https://i.ytimg.com/vi/r7v7t191t6c/hqdefault.jpg"},
                        {"Espresso", "Sabrina Carpenter", "eVli-tstM5E", "https://i.ytimg.com/vi/eVli-tstM5E/hqdefault.jpg"},
                        {"Birds of a Feather", "Billie Eilish", "d5gf9dXbPi0", "https://i.ytimg.com/vi/d5gf9dXbPi0/hqdefault.jpg"}
                };
                for (String[] t : trendData) {
                    NativeTrackItem item = new NativeTrackItem();
                    item.title = t[0];
                    item.artist = t[1];
                    item.videoId = t[2];
                    item.cover = t[3];
                    nativeTrending.add(item);
                }
            }
        }

        synchronized (nativeNewReleases) {
            if (nativeNewReleases.isEmpty()) {
                String[][] newData = new String[][] {
                        {"Per Due Come Noi", "Olly, Angelina Mango, JVLI", "zT2C_5gD5x0", "https://i.ytimg.com/vi/zT2C_5gD5x0/hqdefault.jpg"},
                        {"Amore Disperato", "Achille Lauro", "W1g9r2vj0F4", "https://i.ytimg.com/vi/W1g9r2vj0F4/hqdefault.jpg"},
                        {"Ora Che Non Ho Più Te", "Cesare Cremonini", "K2Qp8wR5z4k", "https://i.ytimg.com/vi/K2Qp8wR5z4k/hqdefault.jpg"},
                        {"Il Linguaggio del Corpo", "Paola & Chiara feat. BigMama", "X9vT2Q5k4nM", "https://i.ytimg.com/vi/X9vT2Q5k4nM/hqdefault.jpg"},
                        {"CLICK BOOM!", "Rose Villain", "8mCBkGR_PRc", "https://i.ytimg.com/vi/8mCBkGR_PRc/hqdefault.jpg"},
                        {"La Noia", "Angelina Mango", "ZntlqJju8xQ", "https://i.ytimg.com/vi/ZntlqJju8xQ/hqdefault.jpg"},
                        {"Paprika", "Ghali", "P4vT2Q5k4nM", "https://i.ytimg.com/vi/P4vT2Q5k4nM/hqdefault.jpg"},
                        {"Ghiaccio", "Tedua", "J9vT2Q5k4nM", "https://i.ytimg.com/vi/J9vT2Q5k4nM/hqdefault.jpg"}
                };
                for (String[] t : newData) {
                    NativeTrackItem item = new NativeTrackItem();
                    item.title = t[0];
                    item.artist = t[1];
                    item.videoId = t[2];
                    item.cover = t[3];
                    nativeNewReleases.add(item);
                }
            }
        }
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

            if (playlistsArr != null) {
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

            if (catalogArr != null && catalogArr.length() > 0) {
                synchronized (nativeTrending) {
                    synchronized (nativeNewReleases) {
                        nativeTrending.clear();
                        nativeNewReleases.clear();
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

        mainHandler.post(() -> {
            notifyChildrenChanged(MEDIA_ROOT_ID);
            notifyChildrenChanged(MEDIA_ID_QUEUE);
            notifyChildrenChanged(MEDIA_ID_FAVORITES);
            notifyChildrenChanged(MEDIA_ID_PLAYLISTS);
        });
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
            synchronized (nativeQueue) {
                if (nativeQueueIndex + 1 < nativeQueue.size()) {
                    nativeQueueIndex++;
                    NativeTrackItem next = nativeQueue.get(nativeQueueIndex);
                    currentTitle = next.title != null ? next.title : "SuperMusic PRO";
                    currentArtist = next.artist != null ? next.artist : "Artista";
                    currentCover = next.cover != null ? next.cover : "";
                    currentVideoId = next.videoId != null ? next.videoId : "";
                    hasRetriedNatively = false;
                    isPlaying = true;

                    setMediaSessionBuffering();
                    startForegroundWithNotification();
                    playTrackNatively(next.url, next.videoId);
                    MusicNotificationPlugin.dispatchTrackChanged(currentTitle, currentArtist, currentCover, currentVideoId, nativeQueueIndex);
                    return;
                }
            }
            MusicNotificationPlugin.dispatchMediaAction("next");
            return;
        }

        if (ACTION_PREV.equals(action)) {
            if (exoPlayer != null && exoPlayer.getCurrentPosition() > 3000) {
                exoPlayer.seekTo(0);
                return;
            }
            synchronized (nativeQueue) {
                if (nativeQueueIndex > 0 && nativeQueueIndex < nativeQueue.size()) {
                    nativeQueueIndex--;
                    NativeTrackItem prev = nativeQueue.get(nativeQueueIndex);
                    currentTitle = prev.title != null ? prev.title : "SuperMusic PRO";
                    currentArtist = prev.artist != null ? prev.artist : "Artista";
                    currentCover = prev.cover != null ? prev.cover : "";
                    currentVideoId = prev.videoId != null ? prev.videoId : "";
                    hasRetriedNatively = false;
                    isPlaying = true;

                    setMediaSessionBuffering();
                    startForegroundWithNotification();
                    playTrackNatively(prev.url, prev.videoId);
                    MusicNotificationPlugin.dispatchTrackChanged(currentTitle, currentArtist, currentCover, currentVideoId, nativeQueueIndex);
                    return;
                }
            }
            MusicNotificationPlugin.dispatchMediaAction("previous");
            return;
        }
    }

    private void updateMediaSessionState() {
        if (mediaSession == null) return;

        try {
            int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
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

                setMediaSessionBuffering();
                startForegroundWithNotification();
                playTrackNatively(null, currentVideoId);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing Android Auto track: " + mediaId, e);
        }
    }

    private void playAndroidAutoSearch(String query) {
        setMediaSessionBuffering();
        executorService.execute(() -> {
            List<InnerTubeTrack> tracks = fetchInnerTubeTracks(query, 10);
            if (!tracks.isEmpty()) {
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
                    }
                    nativeQueueIndex = 0;
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
                mainHandler.post(() -> {
                    currentTitle = query;
                    currentArtist = "SuperMusic PRO";
                    currentCover = "";
                    currentVideoId = "";
                    hasRetriedNatively = false;
                    isPlaying = true;

                    setMediaSessionBuffering();
                    startForegroundWithNotification();
                    playTrackNatively(null, null);
                });
            }
        });
    }

    private MediaBrowserCompat.MediaItem createGenreCategoryItem(String id, String title, String subtitle) {
        Bundle extras = new Bundle();
        extras.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                .setMediaId(id)
                .setTitle(title)
                .setSubtitle(subtitle)
                .setExtras(extras)
                .build();
        return new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE);
    }

    private List<MediaBrowserCompat.MediaItem> getDefaultFallbackItems() {
        List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
        String[][] presets = new String[][] {
                {"Sinceramente", "Annalisa"},
                {"Tuta Gold", "Mahmood"},
                {"100 Messaggi", "Lazza"},
                {"Storie Brevi", "Tananai & Annalisa"},
                {"I P' ME, TU P' TE", "Geolier"},
                {"Espresso", "Sabrina Carpenter"},
                {"Birds of a Feather", "Billie Eilish"}
        };
        for (String[] p : presets) {
            String title = p[0];
            String artist = p[1];
            Bundle itemExtras = new Bundle();
            itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
            MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                    .setMediaId("track:query:" + Uri.encode(title) + ":" + Uri.encode(artist) + ":")
                    .setTitle(title)
                    .setSubtitle(artist)
                    .setExtras(itemExtras)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
        }
        return items;
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

            RequestBody body = RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8"));
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

        if (MEDIA_ROOT_ID.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();

            // 1. SEZIONE PRINCIPALE: 🔥 MUSICA DI TENDENZA (Brani direttamente riproducibili a righe)
            synchronized (nativeTrending) {
                for (NativeTrackItem t : nativeTrending) {
                    Bundle itemExtras = new Bundle();
                    itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                    itemExtras.putString("android.media.browse.CONTENT_STYLE_GROUP_TITLE_HINT", "🔥 Musica di Tendenza");
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

            // 2. SEZIONE: ✨ ULTIME USCITE (Brani nuovi a righe)
            synchronized (nativeNewReleases) {
                for (NativeTrackItem t : nativeNewReleases) {
                    Bundle itemExtras = new Bundle();
                    itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                    itemExtras.putString("android.media.browse.CONTENT_STYLE_GROUP_TITLE_HINT", "✨ Ultime Uscite");
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

            // 3. SEZIONE: 🎧 LA MIA MUSICA (Coda, Preferiti, Playlist, Cerca)
            Bundle queueExtras = new Bundle();
            queueExtras.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            queueExtras.putString("android.media.browse.CONTENT_STYLE_GROUP_TITLE_HINT", "🎧 La Mia Musica");
            int qCount = 0;
            synchronized (nativeQueue) { qCount = nativeQueue.size(); }
            MediaDescriptionCompat descQueue = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_QUEUE)
                    .setTitle("📋 Coda di Riproduzione")
                    .setSubtitle(qCount > 0 ? (qCount + " brani in sequenza dall'app") : "I brani in coda")
                    .setExtras(queueExtras)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(descQueue, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            Bundle favExtras = new Bundle();
            favExtras.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            favExtras.putString("android.media.browse.CONTENT_STYLE_GROUP_TITLE_HINT", "🎧 La Mia Musica");
            int fCount = 0;
            synchronized (nativeFavorites) { fCount = nativeFavorites.size(); }
            MediaDescriptionCompat descFav = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_FAVORITES)
                    .setTitle("❤️ Brani Preferiti")
                    .setSubtitle(fCount > 0 ? (fCount + " canzoni salvate") : "I tuoi brani preferiti")
                    .setExtras(favExtras)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(descFav, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            Bundle plExtras = new Bundle();
            plExtras.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            plExtras.putString("android.media.browse.CONTENT_STYLE_GROUP_TITLE_HINT", "🎧 La Mia Musica");
            int pCount = 0;
            synchronized (nativePlaylists) { pCount = nativePlaylists.size(); }
            MediaDescriptionCompat descPl = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_PLAYLISTS)
                    .setTitle("🎵 Playlist Personali")
                    .setSubtitle(pCount > 0 ? (pCount + " playlist create") : "Le tue playlist")
                    .setExtras(plExtras)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(descPl, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            Bundle searchExtras = new Bundle();
            searchExtras.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1);
            searchExtras.putString("android.media.browse.CONTENT_STYLE_GROUP_TITLE_HINT", "🎧 La Mia Musica");
            MediaDescriptionCompat descSearch = new MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_SEARCH)
                    .setTitle("🔍 Cerca Musica")
                    .setSubtitle("Cerca qualsiasi brano o artista")
                    .setExtras(searchExtras)
                    .build();
            items.add(new MediaBrowserCompat.MediaItem(descSearch, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

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
                        .setExtras(itemExtras)
                        .build();
                items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
            }
            result.sendResult(items);
            return;
        }

        if (MEDIA_ID_FAVORITES.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            synchronized (nativeQueue) {
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
                        .setSubtitle("Aggiungi brani ai preferiti nell'app")
                        .setExtras(itemExtras)
                        .build();
                items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
            }
            result.sendResult(items);
            return;
        }

        if (MEDIA_ID_PLAYLISTS.equals(parentId)) {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            synchronized (nativeQueue) {
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
                synchronized (nativeQueue) {
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
            String query = "Top Hit Italia";
            if (MEDIA_ID_TRENDING.equals(parentId)) {
                query = "Top Hit Italia 2024";
            } else if (parentId.startsWith("genre:")) {
                String sub = parentId.substring("genre:".length());
                if ("pop".equals(sub)) query = "Pop Hits 2024";
                else if ("rap".equals(sub)) query = "Rap Italiano 2024";
                else if ("rock".equals(sub)) query = "Rock Classics";
                else if ("dance".equals(sub)) query = "Dance EDM Hits";
                else if ("latin".equals(sub)) query = "Reggaeton 2024";
                else if ("chill".equals(sub)) query = "Acoustic Relax";
            } else if (parentId.startsWith("search:")) {
                query = parentId.substring("search:".length());
            }

            List<InnerTubeTrack> tracks = fetchInnerTubeTracks(query, 20);
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            for (InnerTubeTrack t : tracks) {
                Bundle itemExtras = new Bundle();
                itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                        .setMediaId("track:" + t.videoId + ":" + Uri.encode(t.title) + ":" + Uri.encode(t.artist) + ":" + Uri.encode(t.thumbnail))
                        .setTitle(t.title)
                        .setSubtitle(t.artist)
                        .setIconUri(t.thumbnail != null && !t.thumbnail.isEmpty() ? Uri.parse(t.thumbnail) : null)
                        .setExtras(itemExtras)
                        .build();
                items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
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
            List<InnerTubeTrack> tracks = fetchInnerTubeTracks(query, 20);
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            for (InnerTubeTrack t : tracks) {
                Bundle itemExtras = new Bundle();
                itemExtras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);
                MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                        .setMediaId("track:" + t.videoId + ":" + Uri.encode(t.title) + ":" + Uri.encode(t.artist) + ":" + Uri.encode(t.thumbnail))
                        .setTitle(t.title)
                        .setSubtitle(t.artist)
                        .setIconUri(t.thumbnail != null && !t.thumbnail.isEmpty() ? Uri.parse(t.thumbnail) : null)
                        .setExtras(itemExtras)
                        .build();
                items.add(new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
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
