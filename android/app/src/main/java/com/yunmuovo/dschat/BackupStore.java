package com.yunmuovo.dschat;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.Comparator;

/**
 * App 内的备份仓库：导出文件存在应用目录，列表 / 分享 / 删除 / 还原都在应用内完成。
 * 文件位于 getExternalFilesDir("backups")，卸载应用会一起删除，重要备份请用「分享」另存。
 */
public class BackupStore {

    private static final int CHUNK = 512 * 1024;

    private final Context context;
    private final WebView webView;

    public BackupStore(Context context, WebView webView) {
        this.context = context.getApplicationContext();
        this.webView = webView;
    }

    private void toast(String message) {
        new Handler(Looper.getMainLooper()).post(
                () -> Toast.makeText(context, message, Toast.LENGTH_LONG).show());
    }

    /** 清理上次异常中断残留的导出临时文件 */
    void cleanupTemp() {
        File[] files = context.getCacheDir()
                .listFiles((d, n) -> n.startsWith("export-") && n.endsWith(".zip"));
        if (files != null) {
            for (File file : files) {
                //noinspection ResultOfMethodCallIgnored
                file.delete();
            }
        }
    }

    private File dir() {
        File dir = new File(context.getExternalFilesDir(null), "backups");
        if (!dir.exists() && !dir.mkdirs()) {
            toast("无法创建备份目录");
        }
        return dir;
    }

    /** 生成不重名的目标文件 */
    File uniqueFile(String fileName) {
        String name = sanitize(fileName);
        File target = new File(dir(), name);
        int index = 1;
        while (target.exists()) {
            String base = name.endsWith(".zip") ? name.substring(0, name.length() - 4) : name;
            target = new File(dir(), base + "-" + index + ".zip");
            index++;
        }
        return target;
    }

    @JavascriptInterface
    public String list() {
        try {
            File[] files = dir().listFiles((d, n) -> n.endsWith(".zip"));
            if (files == null) {
                files = new File[0];
            }
            Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
            JSONArray array = new JSONArray();
            for (File file : files) {
                JSONObject item = new JSONObject();
                item.put("name", file.getName());
                item.put("size", file.length());
                item.put("time", file.lastModified());
                array.put(item);
            }
            return array.toString();
        } catch (Throwable error) {
            return "[]";
        }
    }

    /** 备份与缓存占用（字节），用于设置页展示 */
    @JavascriptInterface
    public String usage() {
        try {
            JSONObject result = new JSONObject();
            result.put("backups", directorySize(dir()));
            result.put("cache", directorySize(context.getCacheDir()));
            result.put("count", countBackups());
            return result.toString();
        } catch (Throwable error) {
            return "{}";
        }
    }

    /** 清理导出临时文件与 WebView 缓存 */
    @JavascriptInterface
    public void clearCache() {
        try {
            File cache = context.getCacheDir();
            File[] files = cache.listFiles((d, n) -> n.startsWith("export-") && n.endsWith(".zip"));
            long total = 0;
            if (files != null) {
                for (File file : files) {
                    long size = file.length();
                    if (file.delete()) {
                        total += size;
                    }
                }
            }
            final long freed = total;
            new Handler(Looper.getMainLooper()).post(() -> {
                if (webView != null) {
                    webView.clearCache(true);
                }
                toast("已清理 " + (freed / 1048576) + "MB 临时文件与网页缓存");
            });
        } catch (Throwable error) {
            toast("清理失败：" + error.getClass().getSimpleName());
        }
    }

    private static long directorySize(File dir) {
        long total = 0;
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                total += file.isDirectory() ? directorySize(file) : file.length();
            }
        }
        return total;
    }

    private int countBackups() {
        File[] files = dir().listFiles((d, n) -> n.endsWith(".zip"));
        return files == null ? 0 : files.length;
    }

    @JavascriptInterface
    public void share(String name) {
        File file = new File(dir(), sanitize(name));
        if (!file.exists()) {
            toast("备份文件不存在");
            return;
        }
        Uri uri = BackupProvider.uriFor(context, file.getName());
        new Handler(Looper.getMainLooper()).post(() -> {
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType("application/zip");
            share.putExtra(Intent.EXTRA_STREAM, uri);
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(share, "导出完成：" + file.getName());
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                context.startActivity(chooser);
            } catch (Throwable error) {
                toast("没有可分享的应用");
            }
        });
    }

    @JavascriptInterface
    public boolean remove(String name) {
        File file = new File(dir(), sanitize(name));
        return file.exists() && file.delete();
    }

    /** 读出备份并分块推给页面，由页面组装成 File 走现有导入流程 */
    @JavascriptInterface
    public void restore(String name) {
        File file = new File(dir(), sanitize(name));
        if (!file.exists()) {
            toast("备份文件不存在");
            return;
        }
        new Thread(() -> {
            Handler handler = new Handler(Looper.getMainLooper());
            try (InputStream in = new FileInputStream(file)) {
                byte[] buffer = new byte[CHUNK];
                int read;
                int index = 0;
                while ((read = in.read(buffer)) > 0) {
                    byte[] chunk = Arrays.copyOf(buffer, read);
                    String base64 = Base64.encodeToString(chunk, Base64.NO_WRAP);
                    final int i = index;
                    handler.post(() -> webView.evaluateJavascript(
                            "window.__dsBackupChunk&&window.__dsBackupChunk(" + i + ","
                                    + base64.length() + ",'" + base64 + "')", null));
                    index++;
                    // 稍作等待，避免主线程被海量 JS 调用压垮
                    Thread.sleep(10);
                }
                final int total = index;
                handler.post(() -> webView.evaluateJavascript(
                        "window.__dsBackupDone&&window.__dsBackupDone(" + total + ","
                                + JSONObject.quote(file.getName()) + ")", null));
            } catch (Throwable error) {
                handler.post(() -> webView.evaluateJavascript(
                        "window.__dsBackupError&&window.__dsBackupError('"
                                + error.getClass().getSimpleName() + "')", null));
            }
        }).start();
    }

    /** 供 FileSaver 落盘使用 */
    boolean copyInto(File source, File target) {
        try (InputStream in = new FileInputStream(source);
             OutputStream out = new FileOutputStream(target)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) > 0) {
                out.write(buffer, 0, read);
            }
            return true;
        } catch (Throwable error) {
            return false;
        }
    }

    private static String sanitize(String fileName) {
        String name = fileName == null ? "" : fileName.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return name.isEmpty() ? "deepseek_data.zip" : name;
    }
}
