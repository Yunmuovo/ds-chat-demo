package com.yunmuovo.dschat;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 接收网页分块传来的 ZIP 数据：边收边写临时文件，最后移动到「下载」目录。
 * 分块传输避免把几十 MB 的归档转成一整条 base64 字符串（低内存时会 OOM）。
 */
public class FileSaver {

    private final Context context;
    private File tempFile;
    private FileOutputStream tempOut;
    private long received;

    public FileSaver(Context context) {
        this.context = context.getApplicationContext();
    }

    private void toast(String message) {
        new Handler(Looper.getMainLooper()).post(
                () -> Toast.makeText(context, message, Toast.LENGTH_LONG).show());
    }

    /** 页面用来报告进度的轻量日志 */
    @android.webkit.JavascriptInterface
    public void log(String message) {
        toast("[导出] " + message);
    }

    /** 开始接收：创建临时文件 */
    @android.webkit.JavascriptInterface
    public void begin(String fileName, long totalBytes) {
        try {
            closeQuietly();
            tempFile = new File(context.getCacheDir(), "export-" + System.currentTimeMillis() + ".zip");
            tempOut = new FileOutputStream(tempFile);
            received = 0;
            toast("[导出] 开始写入 " + (totalBytes / 1048576) + "MB");
        } catch (Throwable error) {
            toast("导出失败：无法创建临时文件 " + error.getClass().getSimpleName());
        }
    }

    /** 追加一块（base64） */
    @android.webkit.JavascriptInterface
    public void append(String base64Chunk) {
        try {
            if (tempOut == null) {
                toast("导出失败：写入会话已失效");
                return;
            }
            byte[] bytes = Base64.decode(base64Chunk, Base64.DEFAULT);
            tempOut.write(bytes);
            received += bytes.length;
        } catch (Throwable error) {
            toast("导出失败：写入出错 " + error.getClass().getSimpleName());
            closeQuietly();
        }
    }

    /** 接收完成：保存到「下载」目录 */
    @android.webkit.JavascriptInterface
    public void finish(String fileName, String mimeType) {
        try {
            if (tempOut == null || tempFile == null) {
                toast("导出失败：没有收到数据");
                return;
            }
            tempOut.flush();
            closeQuietly();
            String name = sanitize(fileName);
            String mime = mimeType == null || mimeType.isEmpty() ? "application/zip" : mimeType;
            boolean saved = saveToDownloads(tempFile, name, mime);
            if (saved) {
                toast("已保存到「下载」：" + name + "（" + (received / 1048576) + "MB）");
            } else {
                // 兜底：放到 App 自己的外部目录，至少文件不丢
                File dir = new File(context.getExternalFilesDir(null), "exports");
                if (dir.exists() || dir.mkdirs()) {
                    File target = new File(dir, name);
                    if (copy(tempFile, target)) {
                        toast("已保存到：" + target.getAbsolutePath());
                        return;
                    }
                }
                toast("导出失败：无法写入文件");
            }
        } catch (Throwable error) {
            toast("导出失败：" + error.getClass().getSimpleName() + " " + error.getMessage());
        } finally {
            if (tempFile != null) {
                //noinspection ResultOfMethodCallIgnored
                tempFile.delete();
            }
        }
    }

    private boolean saveToDownloads(File source, String name, String mime) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.MIME_TYPE, mime);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                ContentResolver resolver = context.getContentResolver();
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    return false;
                }
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) {
                        return false;
                    }
                    copy(source, out);
                }
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                return true;
            }
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists() && !dir.mkdirs()) {
                return false;
            }
            return copy(source, new File(dir, name));
        } catch (Throwable error) {
            return false;
        }
    }

    private static boolean copy(File source, File target) {
        try (java.io.FileInputStream in = new java.io.FileInputStream(source);
             FileOutputStream out = new FileOutputStream(target)) {
            copy(in, out);
            return true;
        } catch (Throwable error) {
            return false;
        }
    }

    private static void copy(java.io.InputStream in, OutputStream out) throws java.io.IOException {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = in.read(buffer)) > 0) {
            out.write(buffer, 0, read);
        }
    }

    private void closeQuietly() {
        try {
            if (tempOut != null) {
                tempOut.close();
            }
        } catch (Throwable ignored) {
            // 忽略关闭异常
        }
        tempOut = null;
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
