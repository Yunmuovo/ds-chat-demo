package com.yunmuovo.dschat;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.widget.Toast;

import java.io.OutputStream;

/**
 * 接收网页生成的 blob（dataURL 形式），用系统「保存到…」对话框让用户选择位置写入。
 * 相比直接写公共下载目录，SAF 不受各家 ROM 的存储策略影响，用户也能自己选文件夹。
 */
public class FileSaver {

    static final int REQUEST_SAVE_FILE = 2001;

    private final Activity activity;
    private byte[] pendingBytes;
    private String pendingName = "deepseek_data.zip";

    public FileSaver(Activity activity) {
        this.activity = activity;
    }

    private void toast(String message) {
        new Handler(Looper.getMainLooper()).post(
                () -> Toast.makeText(activity, message, Toast.LENGTH_LONG).show());
    }

    /** 页面用来报告进度的轻量日志，直接弹 toast，便于定位导出卡在哪一步 */
    @android.webkit.JavascriptInterface
    public void log(String message) {
        toast("[导出] " + message);
    }

    @android.webkit.JavascriptInterface
    public void save(String fileName, String mimeType, String dataUrl) {
        try {
            int comma = dataUrl == null ? -1 : dataUrl.indexOf(',');
            if (comma < 0) {
                toast("导出失败：数据不完整");
                return;
            }
            pendingBytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
            pendingName = sanitize(fileName);
            String mime = mimeType == null || mimeType.isEmpty() ? "application/zip" : mimeType;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mime);
            intent.putExtra(Intent.EXTRA_TITLE, pendingName);
            activity.startActivityForResult(intent, REQUEST_SAVE_FILE);
        } catch (Exception error) {
            toast("导出失败：" + error.getClass().getSimpleName());
        }
    }

    /** 由 Activity 在 onActivityResult 里回调 */
    void onResult(int resultCode, Intent data) {
        byte[] bytes = pendingBytes;
        pendingBytes = null;
        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
            toast("已取消保存");
            return;
        }
        Uri target = data.getData();
        if (bytes == null) {
            toast("导出失败：没有待保存的内容");
            return;
        }
        new Thread(() -> {
            try (OutputStream out = activity.getContentResolver().openOutputStream(target)) {
                if (out == null) {
                    throw new IllegalStateException("openOutputStream returned null");
                }
                out.write(bytes);
                toast("已保存：" + pendingName);
            } catch (Exception error) {
                toast("保存失败：" + error.getClass().getSimpleName());
            }
        }).start();
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
