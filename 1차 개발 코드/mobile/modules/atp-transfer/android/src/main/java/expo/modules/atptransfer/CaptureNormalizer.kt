package expo.modules.atptransfer

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.container.Mp4TimestampData
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.InAppMp4Muxer
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.Promise
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * CameraX may select AMR from a device profile. Only app captures are normalized; imported files
 * still follow the server's H.264/HEVC + AAC-or-silent contract.
 */
@UnstableApi
internal object CaptureNormalizer {
    private fun compatible(context: Context, uri: Uri): Boolean {
        val extractor = MediaExtractor()
        return try {
            extractor.setDataSource(context, uri, null)
            var video = false
            var valid = true
            for (i in 0 until extractor.trackCount) {
                val mime = extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME) ?: ""
                if (mime.startsWith("video/")) {
                    video = true
                    valid = valid && mime == MimeTypes.VIDEO_H264
                }
                if (mime.startsWith("audio/")) valid = valid && mime == MimeTypes.AUDIO_AAC
            }
            video && valid
        } finally {
            extractor.release()
        }
    }

    private fun capturedTime(context: Context, uri: Uri): Long? {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(context, uri)
            val date =
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE) ?: return null
            SimpleDateFormat("yyyyMMdd'T'HHmmss.SSS'Z'", Locale.ROOT)
                .apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                    isLenient = false
                }
                .parse(date)
                ?.time
        } catch (_: Exception) {
            null
        } finally {
            retriever.release()
        }
    }

    fun start(context: Context, source: String, promise: Promise) {
        var output: File? = null
        try {
            val uri = Uri.parse(source)
            require(uri.scheme == "file")
            val input = File(requireNotNull(uri.path)).canonicalFile
            require(input.path.startsWith(context.cacheDir.canonicalPath + File.separator))
            if (compatible(context, uri)) {
                promise.resolve(source)
                return
            }
            val captured = capturedTime(context, uri)
            val target = File.createTempFile("atp-capture-", ".mp4", context.cacheDir)
            output = target
            check(target.delete())
            val handler = Handler(Looper.getMainLooper())
            var finished = false
            var transformer: Transformer? = null
            val timeout = Runnable {
                if (!finished) {
                    finished = true
                    transformer?.cancel()
                    target.delete()
                    promise.reject("CAPTURE_TIMEOUT", "영상 준비 시간이 초과되었습니다. 다시 촬영해 주세요.", null)
                }
            }
            val listener =
                object : Transformer.Listener {
                    override fun onCompleted(composition: Composition, result: ExportResult) {
                        if (finished) return
                        finished = true
                        handler.removeCallbacks(timeout)
                        try {
                            check(compatible(context, Uri.fromFile(target)))
                            promise.resolve(Uri.fromFile(target).toString())
                        } catch (e: Exception) {
                            target.delete()
                            promise.reject(
                                "CAPTURE_FORMAT",
                                "이 기기에서 호환 영상을 준비하지 못했습니다. 무음 촬영을 시도해 주세요.",
                                e,
                            )
                        }
                    }

                    override fun onError(
                        composition: Composition,
                        result: ExportResult,
                        exception: ExportException,
                    ) {
                        if (finished) return
                        finished = true
                        handler.removeCallbacks(timeout)
                        target.delete()
                        promise.reject(
                            "CAPTURE_FORMAT",
                            "영상을 준비하지 못했습니다. 다시 촬영하거나 무음 촬영을 시도해 주세요.",
                            exception,
                        )
                    }
                }
            val muxer = InAppMp4Muxer.Factory { metadata ->
                if (captured != null) {
                    metadata.removeAll { it is Mp4TimestampData }
                    val timestamp = Mp4TimestampData.unixTimeToMp4TimeSeconds(captured)
                    metadata.add(Mp4TimestampData(timestamp, timestamp))
                }
            }
            val job =
                Transformer.Builder(context)
                    .setAudioMimeType(MimeTypes.AUDIO_AAC)
                    .setVideoMimeType(MimeTypes.VIDEO_H264)
                    .setEncoderFactory(
                        DefaultEncoderFactory.Builder(context).setEnableFallback(false).build()
                    )
                    .setMuxerFactory(muxer)
                    .addListener(listener)
                    .build()
            transformer = job
            job.start(EditedMediaItem.Builder(MediaItem.fromUri(uri)).build(), target.path)
            handler.postDelayed(timeout, 120_000)
        } catch (e: Exception) {
            output?.delete()
            promise.reject("CAPTURE_FORMAT", "촬영한 영상을 준비하지 못했습니다. 다시 촬영해 주세요.", e)
        }
    }
}
