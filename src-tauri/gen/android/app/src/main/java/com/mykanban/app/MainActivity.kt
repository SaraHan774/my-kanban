package com.mykanban.app

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import org.json.JSONArray
import org.json.JSONObject
import android.util.Base64
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicReference

class MainActivity : TauriActivity() {
    lateinit var safHelper: SafHelper

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        safHelper = SafHelper(this)
        super.onCreate(savedInstanceState)
    }

    /**
     * Called by WryActivity when the Tauri WebView is created and ready.
     * This is the reliable hook to inject our JS interface.
     */
    override fun onWebViewCreate(webView: WebView) {
        webView.addJavascriptInterface(SafBridge(this), "AndroidSaf")
        android.util.Log.d("MyKanban", "SAF bridge injected via onWebViewCreate")
    }

    /**
     * JavaScript interface exposed as window.AndroidSaf
     */
    class SafBridge(private val activity: MainActivity) {

        @JavascriptInterface
        fun pickDirectory(): String {
            val latch = CountDownLatch(1)
            val result = AtomicReference<String?>(null)

            activity.runOnUiThread {
                activity.safHelper.pickDirectory { uri ->
                    result.set(uri?.toString())
                    latch.countDown()
                }
            }

            latch.await()
            return result.get() ?: ""
        }

        @JavascriptInterface
        fun readTextFile(treeUri: String, path: String): String {
            return activity.safHelper.readTextFile(treeUri, path) ?: ""
        }

        @JavascriptInterface
        fun writeTextFile(treeUri: String, path: String, content: String): Boolean {
            return activity.safHelper.writeTextFile(treeUri, path, content)
        }

        @JavascriptInterface
        fun readBinaryFile(treeUri: String, path: String): String {
            val bytes = activity.safHelper.readBinaryFile(treeUri, path) ?: return ""
            return Base64.encodeToString(bytes, Base64.NO_WRAP)
        }

        @JavascriptInterface
        fun writeBinaryFile(treeUri: String, path: String, base64Data: String): Boolean {
            val bytes = Base64.decode(base64Data, Base64.NO_WRAP)
            return activity.safHelper.writeBinaryFile(treeUri, path, bytes)
        }

        @JavascriptInterface
        fun listDirectory(treeUri: String, path: String): String {
            val entries = activity.safHelper.listDirectory(treeUri, path) ?: return "[]"
            val arr = JSONArray()
            for (entry in entries) {
                val obj = JSONObject()
                obj.put("name", entry["name"])
                obj.put("kind", entry["kind"])
                arr.put(obj)
            }
            return arr.toString()
        }

        @JavascriptInterface
        fun exists(treeUri: String, path: String): Boolean {
            return activity.safHelper.exists(treeUri, path)
        }

        @JavascriptInterface
        fun createDirectory(treeUri: String, path: String): Boolean {
            return activity.safHelper.createDirectory(treeUri, path)
        }

        @JavascriptInterface
        fun delete(treeUri: String, path: String): Boolean {
            return activity.safHelper.delete(treeUri, path)
        }
    }
}
