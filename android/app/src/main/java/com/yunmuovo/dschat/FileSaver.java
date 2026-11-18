package com.yunmuovo.dschat;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 接收网页生成的 blob（dataURL 形式）并写入「下载」目录。
 * WebView 不会自动下载 blob: 链接，所以由页面把内容读成 base64 再交给这里保存。
 */
public class FileSaver {

    private final Context context;

    public FileSaver(Context context) {
        this.context = context.getApplicationContext();
    }

    private void toast(String message) {
        new Handler(Looper.getMainLooper()).post(
                () -> Toast.makeText(context, message, Toast.LENGTH_LONG).show());
    }

    @JavascriptInterface
    public void save(String fileName, String mimeType, String dataUrl) {
        try {
            int comma = dataUrl.indexOf(',');
            if (comma < 0) {
                toast("导出失败：数据不完整");
                return;
            }
            byte[] bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
            String name = sanitize(fileName);
            String mime = mimeType == null || mimeType.isEmpty() ? "application/zip" : mimeType;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.MIME_TYPE, mime);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                ContentResolver resolver = context.getContentResolver();
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    toast("导出失败：无法写入下载目录");
                    return;
                }
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) {
                        throw new IllegalStateException("openOutputStream returned null");
                    }
                    out.write(bytes);
                }
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                toast("已保存到「下载」：" + name);
                showActions(uri, mime, name);
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS), "");
                if (!dir.exists() && !dir.mkdirs()) {
                    dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                }
                File target = new File(dir, name);
                try (FileOutputStream out = new FileOutputStream(target)) {
                    out.write(bytes);
                }
                toast("已保存到：" + target.getAbsolutePath());
            }
        } catch (Exception error) {
            toast("导出失败：" + error.getClass().getSimpleName());
        }
    }

    /** 导出成功后直接弹出系统的分享/发送面板，省得去文件管理器里翻 */
    private void showActions(Uri uri, String mime, String name) {
        new Handler(Looper.getMainLooper()).post(() -> {
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType(mime);
            share.putExtra(Intent.EXTRA_STREAM, uri);
            share.putExtra(Intent.EXTRA_SUBJECT, name);
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(share, "导出完成：" + name);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                context.startActivity(chooser);
            } catch (ActivityNotFoundException | SecurityException error) {
                toast("文件已保存，但没有可分享的应用");
            }
        });
    }

    /** 只保留文件名，去掉路径分隔符等危险字符 */
    private static String sanitize(String fileName) {
        String name = fileName == null ? "" : fileName.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        if (name.isEmpty()) {
            name = "deepseek_data.zip";
        }
        return name;
    }
}
