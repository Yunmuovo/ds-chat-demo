package com.yunmuovo.dschat;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AlphaAnimation;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

/**
 * 一个最小外壳：用 WebView 打开线上站点。
 * 站点更新后无需重新发版；API Key 与对话保存在本机 WebView 存储里。
 */
public class MainActivity extends Activity {

    /** 站点地址；换域名只改这里 */
    private static final String HOME_URL = "https://yunmuovo.github.io/ds-chat-demo/";

    private static final int REQUEST_FILE_CHOOSER = 1001;

    private WebView webView;
    private FrameLayout splash;
    private TextView splashText;
    private ProgressBar splashBar;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setBackgroundColor(Color.WHITE);
        root.addView(webView);

        splash = buildSplash();
        root.addView(splash, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        // 跟随页面的 viewport 布局，并按 100% 字号渲染：
        // 否则系统字体放大后文字被放大，底部开关会因放不下而收起文字只留图标。
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setTextZoom(100);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                // http(s) 之外的协议（如 mailto、tel）交给系统处理
                if (!scheme.equals("http") && !scheme.equals("https")) {
                    openExternally(uri);
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                hideSplash();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) {
                    showLoadError("无法连接：" + error.getDescription());
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                            android.webkit.WebResourceResponse response) {
                if (request.isForMainFrame()) {
                    showLoadError("服务器返回 " + response.getStatusCode() + "，请稍后重试");
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    startActivityForResult(intent, REQUEST_FILE_CHOOSER);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "没有可用的文件选择器", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) ->
                openExternally(Uri.parse(url)));

        if (savedInstanceState == null) {
            webView.loadUrl(HOME_URL);
        } else {
            webView.restoreState(savedInstanceState);
            hideSplash();
        }
    }

    /** 加载中盖一层：鲸鱼图标 + 转圈 + 文案，避免白屏让人以为卡住 */
    private FrameLayout buildSplash() {
        FrameLayout box = new FrameLayout(this);
        box.setBackgroundColor(Color.WHITE);

        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setGravity(Gravity.CENTER_HORIZONTAL);

        float density = getResources().getDisplayMetrics().density;
        int iconSize = (int) (88 * density);
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.mipmap.ic_launcher);
        column.addView(icon, new LinearLayout.LayoutParams(iconSize, iconSize));

        splashBar = new ProgressBar(this);
        LinearLayout.LayoutParams barParams =
                new LinearLayout.LayoutParams((int) (32 * density), (int) (32 * density));
        barParams.topMargin = (int) (28 * density);
        column.addView(splashBar, barParams);

        splashText = new TextView(this);
        splashText.setText("正在加载…");
        splashText.setTextColor(Color.parseColor("#8A8F99"));
        splashText.setTextSize(13);
        LinearLayout.LayoutParams textParams =
                new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT);
        textParams.topMargin = (int) (10 * density);
        column.addView(splashText, textParams);

        FrameLayout.LayoutParams columnParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        columnParams.gravity = Gravity.CENTER;
        box.addView(column, columnParams);
        return box;
    }

    private void hideSplash() {
        if (splash == null || splash.getVisibility() != View.VISIBLE) {
            return;
        }
        AlphaAnimation fade = new AlphaAnimation(1f, 0f);
        fade.setDuration(220);
        fade.setFillAfter(true);
        splash.startAnimation(fade);
        splash.setVisibility(View.GONE);
    }

    /** 加载失败：停掉转圈，给出原因，点一下重试 */
    private void showLoadError(String message) {
        if (splash == null) {
            return;
        }
        splash.setVisibility(View.VISIBLE);
        splash.setAlpha(1f);
        splash.clearAnimation();
        if (splashBar != null) {
            splashBar.setVisibility(View.GONE);
        }
        if (splashText != null) {
            splashText.setText(message + "\n\n轻触屏幕重试");
            splashText.setTextColor(Color.parseColor("#4D6BFE"));
            splashText.setTypeface(Typeface.DEFAULT, Typeface.NORMAL);
            splashText.setGravity(Gravity.CENTER);
        }
        splash.setOnClickListener(v -> {
            if (splashBar != null) {
                splashBar.setVisibility(View.VISIBLE);
            }
            if (splashText != null) {
                splashText.setText("正在加载…");
                splashText.setTextColor(Color.parseColor("#8A8F99"));
            }
            splash.setOnClickListener(null);
            webView.loadUrl(HOME_URL);
        });
    }

    /** 用系统浏览器打开外部链接与下载 */
    private void openExternally(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "没有可打开该链接的应用", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_FILE_CHOOSER || fileCallback == null) {
            return;
        }
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                result = new Uri[count];
                for (int i = 0; i < count; i++) {
                    result[i] = data.getClipData().getItemAt(i).getUri();
                }
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }
}
