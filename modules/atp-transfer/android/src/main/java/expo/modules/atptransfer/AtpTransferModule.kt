package expo.modules.atptransfer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentValues
import android.content.Context
import android.content.pm.ServiceInfo
import android.net.Uri
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.core.app.NotificationCompat
import androidx.work.*
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.RandomAccessFile
import java.security.KeyStore
import java.security.MessageDigest
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

internal object Vault {
    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        return (ks.getKey("atp-transfer", null) as? SecretKey)
            ?: KeyGenerator.getInstance("AES", "AndroidKeyStore")
                .apply {
                    init(
                        KeyGenParameterSpec.Builder(
                                "atp-transfer",
                                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                            )
                            .setBlockModes("GCM")
                            .setEncryptionPaddings("NoPadding")
                            .build()
                    )
                }
                .generateKey()
    }

    fun put(c: Context, k: String, v: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val b = cipher.iv + cipher.doFinal(v.toByteArray())
        c.getSharedPreferences("atp-private", 0)
            .edit()
            .putString(k, Base64.encodeToString(b, Base64.NO_WRAP))
            .commit()
    }

    fun get(c: Context, k: String): String? {
        val raw = c.getSharedPreferences("atp-private", 0).getString(k, null) ?: return null
        return try {
            val b = Base64.decode(raw, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, b.copyOfRange(0, 12)))
            String(cipher.doFinal(b.copyOfRange(12, b.size)))
        } catch (e: Exception) {
            null
        }
    }
}

class AtpTransferModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("AtpTransfer")
        AsyncFunction("normalizeCapture") { uri: String, promise: Promise ->
            val context = appContext.reactContext!!
            Handler(Looper.getMainLooper()).post {
                CaptureNormalizer.start(context, uri, promise)
            }
            Unit
        }
        AsyncFunction("credentials") { json: String ->
            val s = JSONObject(json)
            Vault.put(appContext.reactContext!!, "session:${s.getString("userId")}", json)
        }
        AsyncFunction("session") { userId: String ->
            Vault.get(appContext.reactContext!!, "session:$userId")
        }
        AsyncFunction("inspect") { uri: String -> FileInspector.inspect(appContext.reactContext!!, uri) }
        AsyncFunction("digest") { uri: String ->
            val md = MessageDigest.getInstance("SHA-256")
            appContext.reactContext!!.contentResolver.openInputStream(Uri.parse(uri)).use { stream
                ->
                requireNotNull(stream)
                val b = ByteArray(1024 * 1024)
                while (true) {
                    val n = stream.read(b)
                    if (n < 0) break
                    md.update(b, 0, n)
                }
            }
            md.digest().joinToString("") { "%02x".format(it) }
        }
        AsyncFunction("enqueue") { json: String ->
            val c = appContext.reactContext!!
            val spec = JSONObject(json)
            val id = spec.getString("taskId")
            Vault.put(c, "task:$id", json)
            val request =
                OneTimeWorkRequestBuilder<TransferWorker>()
                    .setInputData(workDataOf("taskId" to id))
                    .setConstraints(
                        Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
                    )
                    .addTag("atp:${spec.getString("userId")}")
                    .build()
            WorkManager.getInstance(c)
                .enqueueUniqueWork("atp:$id", ExistingWorkPolicy.KEEP, request)
            Unit
        }
        AsyncFunction("statuses") { userId: String ->
            val c = appContext.reactContext!!
            val result = JSONArray()
            for (k in
                c.getSharedPreferences("atp-private", 0).all.keys.filter {
                    it.startsWith("task:")
                }) {
                val raw = Vault.get(c, k) ?: continue
                val o = JSONObject(raw)
                if (o.optString("userId") == userId) result.put(o)
            }
            result.toString()
        }
        Function("cancel") { id: String ->
            WorkManager.getInstance(appContext.reactContext!!).cancelUniqueWork("atp:$id")
            Unit
        }
        AsyncFunction("clearAccount") { userId: String ->
            val c = appContext.reactContext!!
            WorkManager.getInstance(c).cancelAllWorkByTag("atp:$userId")
            val prefs = c.getSharedPreferences("atp-private", 0)
            prefs.edit().remove("session:$userId").commit()
            for (k in prefs.all.keys.filter { it.startsWith("task:") }) {
                val o = Vault.get(c, k)?.let { JSONObject(it) } ?: continue
                if (o.optString("userId") == userId) {
                    val f = File(Uri.parse(o.getString("uri")).path!!)
                    if (f.canonicalPath.startsWith(c.filesDir.canonicalPath + "/")) f.delete()
                    prefs.edit().remove(k).commit()
                }
            }
        }
        AsyncFunction("saveToAlbum") { uri: String, mime: String, name: String ->
            val c = appContext.reactContext!!
            val video = mime.startsWith("video/")
            val values =
                ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                    put(MediaStore.MediaColumns.MIME_TYPE, mime)
                    put(
                        MediaStore.MediaColumns.RELATIVE_PATH,
                        if (video) "Movies/At that place" else "Pictures/At that place",
                    )
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
            val collection =
                if (video) MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            val output = requireNotNull(c.contentResolver.insert(collection, values))
            try {
                c.contentResolver.openInputStream(Uri.parse(uri)).use { input ->
                    requireNotNull(input)
                    c.contentResolver.openOutputStream(output).use { out ->
                        requireNotNull(out)
                        input.copyTo(out)
                    }
                }
                c.contentResolver.update(
                    output,
                    ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) },
                    null,
                    null,
                )
            } catch (e: Exception) {
                c.contentResolver.delete(output, null, null)
                throw e
            }
            output.toString()
        }
    }
}

private class OfflineException : java.io.IOException()

class TransferWorker(c: Context, p: WorkerParameters) : CoroutineWorker(c, p) {
    companion object {
        val slots = Semaphore(3)
        val refreshLock = Any()
        val http = OkHttpClient.Builder().callTimeout(60, TimeUnit.SECONDS).build()
    }

    private fun sha(b: ByteArray) =
        MessageDigest.getInstance("SHA-256").digest(b).joinToString("") { "%02x".format(it) }

    override suspend fun doWork(): Result =
        withContext(Dispatchers.IO) {
            val taskId = inputData.getString("taskId") ?: return@withContext Result.failure()
            val raw =
                Vault.get(applicationContext, "task:$taskId") ?: return@withContext Result.failure()
            val spec = JSONObject(raw)
            fun persist(state: String, offset: Long = spec.optLong("offset")) {
                spec.put("localState", state)
                spec.put("offset", offset)
                Vault.put(applicationContext, "task:$taskId", spec.toString())
            }
            slots.acquire()
            try {
                val manager =
                    applicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
                        as NotificationManager
                manager.createNotificationChannel(
                    NotificationChannel("atp-upload", "파일 전송", NotificationManager.IMPORTANCE_LOW)
                )
                val notification =
                    NotificationCompat.Builder(applicationContext, "atp-upload")
                        .setSmallIcon(android.R.drawable.stat_sys_upload)
                        .setContentTitle("At that place · 파일 전송 중")
                        .setContentText("앱을 닫아도 전송 상태를 확인할 수 있어요.")
                        .setOngoing(true)
                        .build()
                setForeground(
                    ForegroundInfo(
                        taskId.hashCode(),
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
                    )
                )
                val base = spec.getString("baseUrl")
                require(android.net.Uri.parse(base).scheme == "https") { "HTTPS_REQUIRED" }
                var token =
                    Vault.get(applicationContext, "session:${spec.getString("userId")}")?.let {
                        JSONObject(it).getString("accessToken")
                    } ?: spec.getString("accessToken")
                val generation = spec.getInt("generation")
                val endpoint = "$base/v1/upload-tasks/$taskId/content"
                fun online(): Boolean {
                    val manager = applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                    val caps = manager.getNetworkCapabilities(manager.activeNetwork) ?: return false
                    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                }
                fun execute(request: Request): Response {
                    var last: Exception? = null
                    for (i in 0..3) {
                        if (isStopped) throw InterruptedException()
                        if (!online()) throw OfflineException()
                        try {
                            var r =
                                http
                                    .newCall(
                                        request
                                            .newBuilder()
                                            .header("Authorization", "Bearer $token")
                                            .build()
                                    )
                                    .execute()
                            if (r.code == 401) {
                                r.close()
                                synchronized(refreshLock) {
                                    val sessionKey = "session:${spec.getString("userId")}"
                                    val saved =
                                        Vault.get(applicationContext, sessionKey)?.let {
                                            JSONObject(it)
                                        } ?: throw java.io.IOException("AUTH_EXPIRED")
                                    if (saved.getString("accessToken") == token) {
                                        val refresh = saved.getString("refreshToken")
                                        val body =
                                            JSONObject().put("refreshToken", refresh).toString()
                                        http
                                            .newCall(
                                                Request.Builder()
                                                    .url("$base/v1/auth/refresh")
                                                    .header(
                                                        "Idempotency-Key",
                                                        "refresh-${sha(refresh.toByteArray())}",
                                                    )
                                                    .post(
                                                        body.toRequestBody(
                                                            "application/json".toMediaType()
                                                        )
                                                    )
                                                    .build()
                                            )
                                            .execute()
                                            .use { response ->
                                                if (!response.isSuccessful)
                                                    throw java.io.IOException("AUTH_EXPIRED")
                                                val renewed = response.body!!.string()
                                                Vault.put(applicationContext, sessionKey, renewed)
                                                token = JSONObject(renewed).getString("accessToken")
                                            }
                                    } else token = saved.getString("accessToken")
                                }
                                r =
                                    http
                                        .newCall(
                                            request
                                                .newBuilder()
                                                .header("Authorization", "Bearer $token")
                                                .build()
                                        )
                                        .execute()
                            }
                            if (r.code < 500) return r
                            r.close()
                        } catch (e: java.io.IOException) {
                            if (!online()) throw OfflineException()
                            last = e
                        }
                        if (i < 3) Thread.sleep((1L shl i) * 1000)
                    }
                    throw last ?: java.io.IOException("SERVICE_UNAVAILABLE")
                }
                val head =
                    execute(
                        Request.Builder()
                            .url(endpoint)
                            .header("Authorization", "Bearer $token")
                            .header("Upload-Generation", generation.toString())
                            .head()
                            .build()
                    )
                var offset: Long = 0
                head.use {
                    if (!it.isSuccessful) {
                        persist("HTTP_${it.code}")
                        return@withContext Result.failure()
                    }
                    offset = it.header("Upload-Offset")!!.toLong()
                }
                val file = File(Uri.parse(spec.getString("uri")).path!!)
                RandomAccessFile(file, "r").use { f ->
                    while (offset < f.length()) {
                        if (isStopped) throw InterruptedException()
                        val n = minOf(4194304L, f.length() - offset).toInt()
                        val b = ByteArray(n)
                        f.seek(offset)
                        f.readFully(b)
                        val req =
                            Request.Builder()
                                .url(endpoint)
                                .header("Authorization", "Bearer $token")
                                .header("Upload-Generation", generation.toString())
                                .header("Upload-Offset", offset.toString())
                                .header("Upload-Checksum", "sha256 ${sha(b)}")
                                .patch(
                                    b.toRequestBody("application/offset+octet-stream".toMediaType())
                                )
                                .build()
                        execute(req).use {
                            if (!it.isSuccessful) {
                                persist("HTTP_${it.code}", offset)
                                return@withContext Result.failure()
                            }
                            offset = it.header("Upload-Offset")!!.toLong()
                        }
                        persist("uploading", offset)
                    }
                }
                val body =
                    JSONObject()
                        .put("checksum", spec.getString("fingerprint"))
                        .put("actualBytes", file.length())
                        .toString()
                val commit =
                    execute(
                        Request.Builder()
                            .url("$base/v1/upload-tasks/$taskId/commit")
                            .header("Authorization", "Bearer $token")
                            .header(
                                "Idempotency-Key",
                                "commit-$taskId-${spec.getInt("generation")}",
                            )
                            .post(body.toRequestBody("application/json".toMediaType()))
                            .build()
                    )
                commit.use {
                    persist(if (it.isSuccessful) "verifying" else "HTTP_${it.code}", offset)
                    if (it.isSuccessful) Result.success() else Result.failure()
                }
            } catch (e: OfflineException) {
                persist("waiting_network")
                Result.retry()
            } catch (e: InterruptedException) {
                persist("paused")
                Result.failure()
            } catch (e: Exception) {
                persist("failed")
                Result.failure()
            } finally {
                slots.release()
            }
        }
}
