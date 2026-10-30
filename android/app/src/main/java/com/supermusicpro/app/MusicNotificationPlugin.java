package com.supermusicpro.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Bridge;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
        name = "MusicNotification",
        permissions = {
                @Permission(
                        strings = { Manifest.permission.RECORD_AUDIO },
                        alias = "microphone"
                )
        }
)
public class MusicNotificationPlugin extends Plugin {
    private static MusicNotificationPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) {
            instance = null;
        }
        super.handleOnDestroy();
    }

    public static MusicNotificationPlugin getInstance() {
        return instance;
    }

    private static boolean isBridgeReady() {
        if (instance == null) return false;
        Bridge bridge = instance.getBridge();
        if (bridge == null || bridge.getWebView() == null) return false;
        if (instance.getActivity() != null && (instance.getActivity().isDestroyed() || instance.getActivity().isFinishing())) {
            return false;
        }
        return true;
    }

    public static boolean dispatchMediaAction(String action) {
        if (isBridgeReady()) {
            JSObject data = new JSObject();
            data.put("action", action);
            instance.notifyListeners("onMediaAction", data);
            return true;
        }
        return false;
    }

    public static void dispatchPlaybackProgress(double currentTime, long duration) {
        if (isBridgeReady()) {
            JSObject data = new JSObject();
            data.put("currentTime", currentTime);
            data.put("duration", duration);
            instance.notifyListeners("onPlaybackProgress", data);
        }
    }

    public static void dispatchPlaybackState(boolean isPlaying) {
        if (isBridgeReady()) {
            JSObject data = new JSObject();
            data.put("isPlaying", isPlaying);
            instance.notifyListeners("onPlaybackState", data);
        }
    }

    public static void dispatchPlaybackError(String error) {
        if (isBridgeReady()) {
            JSObject data = new JSObject();
            data.put("error", error);
            instance.notifyListeners("onPlaybackError", data);
        }
    }

    public static void dispatchTrackChanged(String title, String artist, String cover, String videoId, int queueIndex) {
        if (isBridgeReady()) {
            JSObject data = new JSObject();
            data.put("title", title);
            data.put("artist", artist);
            data.put("cover", cover);
            data.put("videoId", videoId);
            data.put("queueIndex", queueIndex);
            instance.notifyListeners("onNativeTrackChanged", data);
        }
    }

    @PluginMethod
    public void recognizeSong(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermsCallback");
        } else {
            startRecognitionThread(call);
        }
    }

    @PermissionCallback
    private void microphonePermsCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startRecognitionThread(call);
        } else {
            call.reject("Permesso microfono necessario per riconoscere i brani");
        }
    }

    private void startRecognitionThread(PluginCall call) {
        new Thread(() -> {
            try {
                ShazamRecognizer.RecognitionMatch match = ShazamRecognizer.recognizeFromMic();
                JSObject ret = new JSObject();
                if (match != null && match.title != null && !match.title.isEmpty()) {
                    ret.put("matched", true);
                    ret.put("title", match.title);
                    ret.put("artist", match.artist);
                    ret.put("album", match.album);
                    ret.put("cover", match.cover);
                    ret.put("videoId", match.videoId != null ? match.videoId : "");
                    ret.put("id", (match.videoId != null && !match.videoId.isEmpty()) ? "yt_" + match.videoId : "shazam_" + System.currentTimeMillis());
                    ret.put("duration", match.duration);
                    ret.put("source", "Shazam Match");
                } else {
                    ret.put("matched", false);
                }
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Errore durante il riconoscimento");
            }
        }).start();
    }

    @PluginMethod
    public void cancelRecognition(PluginCall call) {
        ShazamRecognizer.cancel();
        call.resolve();
    }

    @PluginMethod
    public void playTrack(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        String url = call.getString("url", "");
        String videoId = call.getString("videoId", "");
        String title = call.getString("title", "SuperMusic PRO");
        String artist = call.getString("artist", "Artista");
        String cover = call.getString("cover", "");

        Intent intent = new Intent(context, MusicPlayerService.class);
        intent.setAction(MusicPlayerService.ACTION_PLAY_URL);
        intent.putExtra(MusicPlayerService.EXTRA_URL, url);
        intent.putExtra(MusicPlayerService.EXTRA_VIDEO_ID, videoId);
        intent.putExtra(MusicPlayerService.EXTRA_TITLE, title);
        intent.putExtra(MusicPlayerService.EXTRA_ARTIST, artist);
        intent.putExtra(MusicPlayerService.EXTRA_COVER, cover);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Error playing track via service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void seek(PluginCall call) {
        Double posSec = call.getDouble("position");
        long seekMs = 0;
        if (posSec != null) {
            seekMs = (long) (posSec * 1000.0);
        } else {
            Integer ms = call.getInt("seekMs", 0);
            seekMs = ms != null ? ms : 0;
        }

        MusicPlayerService svc = MusicPlayerService.getInstance();
        if (svc != null) {
            svc.seekDirect(seekMs);
        } else {
            Context context = getContext();
            if (context != null) {
                Intent intent = new Intent(context, MusicPlayerService.class);
                intent.setAction(MusicPlayerService.ACTION_SEEK);
                intent.putExtra(MusicPlayerService.EXTRA_SEEK_MS, seekMs);
                context.startService(intent);
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double vol = call.getDouble("volume", 1.0);
        float volFloat = vol != null ? vol.floatValue() : 1.0f;

        MusicPlayerService svc = MusicPlayerService.getInstance();
        if (svc != null) {
            svc.setVolumeDirect(volFloat);
        } else {
            Context context = getContext();
            if (context != null) {
                Intent intent = new Intent(context, MusicPlayerService.class);
                intent.setAction(MusicPlayerService.ACTION_SET_VOLUME);
                intent.putExtra(MusicPlayerService.EXTRA_VOLUME, volFloat);
                context.startService(intent);
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        MusicPlayerService svc = MusicPlayerService.getInstance();
        if (svc != null) {
            svc.pauseDirect();
        } else {
            Context context = getContext();
            if (context != null) {
                Intent intent = new Intent(context, MusicPlayerService.class);
                intent.setAction(MusicPlayerService.ACTION_PAUSE);
                context.startService(intent);
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        MusicPlayerService svc = MusicPlayerService.getInstance();
        if (svc != null) {
            svc.resumeDirect();
        } else {
            Context context = getContext();
            if (context != null) {
                Intent intent = new Intent(context, MusicPlayerService.class);
                intent.setAction(MusicPlayerService.ACTION_PLAY);
                context.startService(intent);
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void updatePlayback(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        String title = call.getString("title", "SuperMusic PRO");
        String artist = call.getString("artist", "Artista");
        String cover = call.getString("cover", "");
        boolean isPlaying = Boolean.TRUE.equals(call.getBoolean("isPlaying", true));

        Intent intent = new Intent(context, MusicPlayerService.class);
        intent.setAction(MusicPlayerService.ACTION_UPDATE);
        intent.putExtra(MusicPlayerService.EXTRA_TITLE, title);
        intent.putExtra(MusicPlayerService.EXTRA_ARTIST, artist);
        intent.putExtra(MusicPlayerService.EXTRA_COVER, cover);
        intent.putExtra(MusicPlayerService.EXTRA_PLAYING, isPlaying);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Error starting music service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void syncAppData(PluginCall call) {
        try {
            JSArray queueArr = call.getArray("queue");
            int currentIndex = call.getInt("currentIndex", 0);
            JSArray favsArr = call.getArray("favorites");
            JSArray playlistsArr = call.getArray("playlists");
            JSArray catalogArr = call.getArray("catalog");

            MusicPlayerService svc = MusicPlayerService.getInstance();
            if (svc != null) {
                svc.syncFromApp(queueArr, currentIndex, favsArr, playlistsArr, catalogArr);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Error syncing app data: " + e.getMessage());
        }
    }

    @PluginMethod
    public void minimizeApp(PluginCall call) {
        if (getActivity() != null) {
            getActivity().moveTaskToBack(true);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context context = getContext();
        if (context != null) {
            Intent intent = new Intent(context, MusicPlayerService.class);
            intent.setAction(MusicPlayerService.ACTION_STOP);
            context.startService(intent);
        }
        call.resolve();
    }
}
