package expo.modules.atptransfer

import android.content.Context
import android.graphics.BitmapFactory
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import java.io.DataInputStream
import java.io.EOFException
import org.json.JSONObject

internal object FileInspector {
    private fun animated(context: Context, source: Uri, mime: String): Boolean {
        if (mime != "image/png" && mime != "image/webp") return false
        val stream = DataInputStream(context.contentResolver.openInputStream(source))
        fun skip(n: Long) { var left = n; while (left > 0) { val count = stream.skip(left); if (count == 0L) { if (stream.read() == -1) throw EOFException(); left-- } else left -= count } }
        stream.use {
            try {
                skip(if (mime == "image/png") 8 else 12)
                while (true) {
                    val type: String; val length: Long
                    if (mime == "image/png") { length = stream.readInt().toLong() and 0xffffffffL; type = String(ByteArray(4).also { stream.readFully(it) }, Charsets.US_ASCII) }
                    else { type = String(ByteArray(4).also { stream.readFully(it) }, Charsets.US_ASCII); length = Integer.reverseBytes(stream.readInt()).toLong() and 0xffffffffL }
                    if (type == "acTL" || type == "ANIM") return true
                    if (type == "IEND") return false
                    skip(length + if (mime == "image/png") 4 else (length % 2))
                }
            } catch (_: EOFException) { return false }
        }
    }
    fun inspect(context: Context, uri: String): String {
        val source = Uri.parse(uri)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(source).use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth > 0 && bounds.outHeight > 0) {
            val mime = bounds.outMimeType ?: ""
            require(mime in listOf("image/jpeg", "image/png", "image/webp", "image/heic", "image/heif")) { "지원하지 않는 사진 형식입니다." }
            require(bounds.outWidth.toLong() * bounds.outHeight.toLong() <= 100000000L) { "사진은 최대 100메가픽셀입니다." }
            require(!animated(context, source, mime)) { "움직이는 이미지는 지원하지 않습니다." }
            return JSONObject().put("mime", mime).put("kind", "photo").put("width", bounds.outWidth).put("height", bounds.outHeight).toString()
        }
        val meta = MediaMetadataRetriever()
        val extractor = MediaExtractor()
        try {
            meta.setDataSource(context, source)
            val mime = meta.extractMetadata(MediaMetadataRetriever.METADATA_KEY_MIMETYPE) ?: ""
            require(mime in listOf("video/mp4", "video/quicktime")) { "MP4 또는 MOV 영상을 선택해 주세요." }
            val duration = meta.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0
            require(duration in 1..60000) { "영상은 60초 이하로 선택해 주세요." }
            extractor.setDataSource(context, source, null)
            var video = false
            for (i in 0 until extractor.trackCount) {
                val format = extractor.getTrackFormat(i)
                val track = format.getString(MediaFormat.KEY_MIME) ?: ""
                if (track.startsWith("video/")) {
                    require(track in listOf("video/avc", "video/hevc")) { "H.264 또는 HEVC 영상을 선택해 주세요." }
                    video = true
                } else if (track.startsWith("audio/")) require(track == "audio/mp4a-latm") { "AAC 음성 또는 무음 영상을 선택해 주세요." }
            }
            require(video) { "영상 트랙을 확인할 수 없습니다." }
            return JSONObject().put("mime", mime).put("kind", "video").put("durationMs", duration).toString()
        } finally { extractor.release(); meta.release() }
    }
}
