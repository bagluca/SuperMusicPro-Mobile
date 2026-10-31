package com.supermusicpro.app;

import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static volatile boolean isActivityResumed = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MusicNotificationPlugin.class);
        super.onCreate(savedInstanceState);
        try {
            Window window = getWindow();
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.parseColor("#090d16"));
            window.setNavigationBarColor(Color.parseColor("#090d16"));
            if (window.getDecorView() != null) {
                window.getDecorView().setBackgroundColor(Color.parseColor("#090d16"));
            }

            // Unlock highest display refresh rate (120Hz) for smooth scrolling
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                        ? getDisplay()
                        : getWindowManager().getDefaultDisplay();
                if (display != null) {
                    Display.Mode[] modes = display.getSupportedModes();
                    Display.Mode CurrentMode = display.getMode();
                    float maxRefresh = CurrentMode.getRefreshRate();
                    int bestModeId = CurrentMode.getModeId();
                    for (Display.Mode mode : modes) {
                        if (mode.getPhysicalWidth() == CurrentMode.getPhysicalWidth()
                                && mode.getPhysicalHeight() == CurrentMode.getPhysicalHeight()
                                && mode.getRefreshRate() > maxRefresh) {
                            maxRefresh = mode.getRefreshRate();
                            bestModeId = mode.getModeId();
                        }
                    }
                    WindowManager.LayoutParams params = window.getAttributes();
                    params.preferredDisplayModeId = bestModeId;
                    params.preferredRefreshRate = maxRefresh;
                    window.setAttributes(params);
                }
            }
        } catch (Exception ignored) {}

        configureWebViewSettings();

        // Request POST_NOTIFICATIONS permission on Android 13+
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
                }
            }
        } catch (Exception ignored) {}
    }

    private void configureWebViewSettings() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.setLayerType(View.LAYER_TYPE_NONE, null);
                webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
                if (Build.VERSION.SDK_INT >= 35) {
                    webView.setRequestedFrameRate(View.REQUESTED_FRAME_RATE_CATEGORY_HIGH);
                }
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);

                String ua = settings.getUserAgentString();
                if (ua != null && ua.contains("; wv")) {
                    settings.setUserAgentString(ua.replace("; wv", "").replace("Version/4.0 ", ""));
                }

                android.webkit.CookieManager cookieManager = android.webkit.CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                cookieManager.setAcceptThirdPartyCookies(webView, true);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onStart() {
        super.onStart();
        configureWebViewSettings();
    }

    @Override
    public void onPause() {
        isActivityResumed = false;
        super.onPause();
        // Keep timers and JavaScript active when app goes into background for continuous audio playback
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().resumeTimers();
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onResume() {
        isActivityResumed = true;
        super.onResume();
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().resumeTimers();
            }
            MusicPlayerService svc = MusicPlayerService.getInstance();
            if (svc != null) {
                svc.syncWithUiNow();
                // Schedule delayed syncs to guarantee the WebView Javascript bridge is ready
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                    MusicPlayerService s = MusicPlayerService.getInstance();
                    if (s != null) s.syncWithUiNow();
                }, 350);
            }
        } catch (Exception ignored) {}
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (MusicNotificationPlugin.dispatchMediaAction("back_button")) {
            return;
        }
        moveTaskToBack(true);
    }

    @Override
    public void onDestroy() {
        try {
            Intent stopIntent = new Intent(this, MusicPlayerService.class);
            stopIntent.setAction(MusicPlayerService.ACTION_STOP);
            startService(stopIntent);
            stopService(stopIntent);
        } catch (Exception ignored) {}
        super.onDestroy();
    }
}
