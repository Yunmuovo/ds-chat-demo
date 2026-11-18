package com.yunmuovo.dschat;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * 最小文件 Provider：把 App 内的备份文件以 content:// 形式暴露给分享面板，
 * 避免引入 AndroidX 的 FileProvider。
 */
public class BackupProvider extends ContentProvider {

    static Uri uriFor(android.content.Context context, String name) {
        return Uri.parse("content://" + context.getPackageName() + ".backups/" + Uri.encode(name));
    }

    private File fileFor(Uri uri) {
        String name = uri.getLastPathSegment();
        if (name == null) {
            return null;
        }
        File dir = new File(getContext().getExternalFilesDir(null), "backups");
        File file = new File(dir, name);
        // 只允许备份目录内的文件
        return file.getParentFile() != null && file.getParentFile().equals(dir) ? file : null;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = fileFor(uri);
        if (file == null || !file.exists()) {
            throw new FileNotFoundException(String.valueOf(uri));
        }
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        return "application/zip";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs,
                        String sortOrder) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException();
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException();
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException();
    }
}
