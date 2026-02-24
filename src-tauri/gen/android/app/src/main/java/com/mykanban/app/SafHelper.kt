package com.mykanban.app

import android.content.Intent
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.documentfile.provider.DocumentFile

/**
 * SAF (Storage Access Framework) Helper
 * Provides file I/O operations via Android's DocumentFile API.
 * This enables access to Google Drive, external storage, and other
 * document providers.
 */
class SafHelper(private val activity: ComponentActivity) {

    private var pendingCallback: ((Uri?) -> Unit)? = null

    val dirPickerLauncher: ActivityResultLauncher<Intent> =
        activity.registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            val uri = result.data?.data
            if (uri != null) {
                // Take persistable permission so we can access this URI across app restarts
                val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or
                        Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                activity.contentResolver.takePersistableUriPermission(uri, flags)
            }
            pendingCallback?.invoke(uri)
            pendingCallback = null
        }

    fun pickDirectory(callback: (Uri?) -> Unit) {
        pendingCallback = callback
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
            // Show all storage providers including internal storage, SD card, etc.
            putExtra("android.content.extra.SHOW_ADVANCED", true)
            putExtra("android.content.extra.FANCY", true)
            putExtra("android.content.extra.SHOW_FILESIZE", true)
        }
        dirPickerLauncher.launch(intent)
    }

    fun readTextFile(treeUriStr: String, relativePath: String): String? {
        val treeUri = Uri.parse(treeUriStr)
        val doc = findDocument(treeUri, relativePath) ?: return null
        return activity.contentResolver.openInputStream(doc.uri)?.bufferedReader()?.use {
            it.readText()
        }
    }

    fun writeTextFile(treeUriStr: String, relativePath: String, content: String): Boolean {
        val treeUri = Uri.parse(treeUriStr)
        val parts = relativePath.split("/")
        val fileName = parts.last()
        val dirParts = parts.dropLast(1)

        // Ensure parent directories exist
        var parent = DocumentFile.fromTreeUri(activity, treeUri) ?: return false
        for (part in dirParts) {
            val existing = parent.findFile(part)
            parent = if (existing != null && existing.isDirectory) {
                existing
            } else {
                parent.createDirectory(part) ?: return false
            }
        }

        // Find or create the file
        val existingFile = parent.findFile(fileName)
        val file = if (existingFile != null && existingFile.isFile) {
            existingFile
        } else {
            val mimeType = if (fileName.endsWith(".md")) "text/markdown"
            else if (fileName.endsWith(".json")) "application/json"
            else "text/plain"
            parent.createFile(mimeType, fileName) ?: return false
        }

        activity.contentResolver.openOutputStream(file.uri, "wt")?.bufferedWriter()?.use {
            it.write(content)
        }
        return true
    }

    fun readBinaryFile(treeUriStr: String, relativePath: String): ByteArray? {
        val treeUri = Uri.parse(treeUriStr)
        val doc = findDocument(treeUri, relativePath) ?: return null
        return activity.contentResolver.openInputStream(doc.uri)?.use {
            it.readBytes()
        }
    }

    fun writeBinaryFile(treeUriStr: String, relativePath: String, data: ByteArray): Boolean {
        val treeUri = Uri.parse(treeUriStr)
        val parts = relativePath.split("/")
        val fileName = parts.last()
        val dirParts = parts.dropLast(1)

        var parent = DocumentFile.fromTreeUri(activity, treeUri) ?: return false
        for (part in dirParts) {
            val existing = parent.findFile(part)
            parent = if (existing != null && existing.isDirectory) {
                existing
            } else {
                parent.createDirectory(part) ?: return false
            }
        }

        val existingFile = parent.findFile(fileName)
        val file = if (existingFile != null && existingFile.isFile) {
            existingFile
        } else {
            val mimeType = guessMimeType(fileName)
            parent.createFile(mimeType, fileName) ?: return false
        }

        activity.contentResolver.openOutputStream(file.uri, "wt")?.use {
            it.write(data)
        }
        return true
    }

    fun listDirectory(treeUriStr: String, relativePath: String): List<Map<String, String>>? {
        val treeUri = Uri.parse(treeUriStr)
        val dir = if (relativePath.isEmpty()) {
            DocumentFile.fromTreeUri(activity, treeUri)
        } else {
            findDocument(treeUri, relativePath)
        } ?: return null

        if (!dir.isDirectory) return null

        return dir.listFiles().map { file ->
            mapOf(
                "name" to (file.name ?: ""),
                "kind" to if (file.isDirectory) "directory" else "file"
            )
        }
    }

    fun exists(treeUriStr: String, relativePath: String): Boolean {
        val treeUri = Uri.parse(treeUriStr)
        return findDocument(treeUri, relativePath) != null
    }

    fun createDirectory(treeUriStr: String, relativePath: String): Boolean {
        val treeUri = Uri.parse(treeUriStr)
        val parts = relativePath.split("/")
        var parent = DocumentFile.fromTreeUri(activity, treeUri) ?: return false
        for (part in parts) {
            val existing = parent.findFile(part)
            parent = if (existing != null && existing.isDirectory) {
                existing
            } else {
                parent.createDirectory(part) ?: return false
            }
        }
        return true
    }

    fun delete(treeUriStr: String, relativePath: String): Boolean {
        val treeUri = Uri.parse(treeUriStr)
        val doc = findDocument(treeUri, relativePath) ?: return false
        return doc.delete()
    }

    private fun findDocument(treeUri: Uri, relativePath: String): DocumentFile? {
        var doc = DocumentFile.fromTreeUri(activity, treeUri) ?: return null
        if (relativePath.isEmpty()) return doc
        val parts = relativePath.split("/")
        for (part in parts) {
            doc = doc.findFile(part) ?: return null
        }
        return doc
    }

    private fun guessMimeType(fileName: String): String {
        return when {
            fileName.endsWith(".md") -> "text/markdown"
            fileName.endsWith(".json") -> "application/json"
            fileName.endsWith(".txt") -> "text/plain"
            fileName.endsWith(".png") -> "image/png"
            fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") -> "image/jpeg"
            fileName.endsWith(".gif") -> "image/gif"
            fileName.endsWith(".webp") -> "image/webp"
            else -> "application/octet-stream"
        }
    }
}
