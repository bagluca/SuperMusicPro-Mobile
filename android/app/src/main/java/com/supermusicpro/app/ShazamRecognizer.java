package com.supermusicpro.app;

import android.annotation.SuppressLint;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Base64;
import android.util.Log;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.CRC32;

/**
 * Pure JVM Shazam Audio Fingerprinting & Song Recognition Engine
 * for SuperMusic PRO.
 */
public class ShazamRecognizer {
    private static final String TAG = "ShazamRecognizer";

    private static final int SAMPLE_RATE = 16000;
    private static final int FFT_SIZE = 2048;
    private static final int FFT_OUTPUT_SIZE = FFT_SIZE / 2 + 1; // 1025
    private static final int MAX_PEAKS = 255;
    private static final double MAX_TIME_SECONDS = 12.0;
    private static final int RING_BUF_SIZE = 256;

    private static final int BAND_250_520 = 0;
    private static final int BAND_520_1450 = 1;
    private static final int BAND_1450_3500 = 2;
    private static final int BAND_3500_5500 = 3;

    private static final double[] HANNING = new double[FFT_SIZE];
    static {
        for (int i = 0; i < FFT_SIZE; i++) {
            HANNING[i] = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * (i + 1) / 2049.0));
        }
    }

    private static final String[] USER_AGENTS = new String[]{
            "Dalvik/2.1.0 (Linux; U; Android 5.0.2; VS980 4G Build/LRX22G)",
            "Dalvik/1.6.0 (Linux; U; Android 4.4.2; SM-T210 Build/KOT49H)",
            "Dalvik/2.1.0 (Linux; U; Android 5.1.1; SM-P905V Build/LMY47X)",
            "Dalvik/2.1.0 (Linux; U; Android 6.0.1; SM-G920F Build/MMB29K)",
            "Dalvik/2.1.0 (Linux; U; Android 5.0; SM-G900F Build/LRX21T)"
    };

    private static final String[] TIMEZONES = new String[]{
            "Europe/Rome",
            "Europe/Paris",
            "Europe/London",
            "America/New_York"
    };

    private static final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build();

    private static final AtomicBoolean isCancelled = new AtomicBoolean(false);

    public static void cancel() {
        isCancelled.set(true);
    }

    public static class RecognitionMatch {
        public String title;
        public String artist;
        public String album;
        public String cover;
        public String videoId;
        public int duration;
    }

    /**
     * Records audio from microphone, generates Shazam FFT signature at 4.5s and 9s,
     * queries Shazam Discovery v5 API, and resolves playable YouTube videoId via InnerTube.
     */
    @SuppressLint("MissingPermission")
    public static RecognitionMatch recognizeFromMic() throws Exception {
        isCancelled.set(false);

        int recordSampleRate = SAMPLE_RATE;
        int minBufSize = AudioRecord.getMinBufferSize(
                recordSampleRate,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
        );

        if (minBufSize <= 0) {
            recordSampleRate = 44100;
            minBufSize = AudioRecord.getMinBufferSize(
                    recordSampleRate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
            );
        }

        int bufferSize = Math.max(minBufSize * 2, 8192);
        AudioRecord audioRecord = new AudioRecord(
                MediaRecorder.AudioSource.MIC,
                recordSampleRate,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
        );

        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
            audioRecord.release();
            throw new Exception("Impossibile inizializzare il microfono");
        }

        ByteArrayOutputStream pcmBuffer = new ByteArrayOutputStream();
        byte[] readBuf = new byte[bufferSize];
        boolean triedFirstPass = false;
        long startTime = System.currentTimeMillis();
        long maxDurationMs = 9500L;
        long firstPassMs = 4500L;

        try {
            audioRecord.startRecording();
            Log.d(TAG, "AudioRecord started at " + recordSampleRate + "Hz");

            while (!isCancelled.get() && (System.currentTimeMillis() - startTime) < maxDurationMs) {
                int read = audioRecord.read(readBuf, 0, readBuf.length);
                if (read > 0) {
                    pcmBuffer.write(readBuf, 0, read);
                }

                long elapsed = System.currentTimeMillis() - startTime;
                if (!triedFirstPass && elapsed >= firstPassMs && pcmBuffer.size() >= recordSampleRate * 2 * 3) {
                    triedFirstPass = true;
                    byte[] currentBytes = pcmBuffer.toByteArray();
                    byte[] samples16k = (recordSampleRate == SAMPLE_RATE)
                            ? currentBytes
                            : resampleTo16kHz(currentBytes, recordSampleRate);
                    RecognitionMatch match = queryShazamWithSamples(samples16k);
                    if (match != null) {
                        Log.d(TAG, "Matched on first pass (4.5s): " + match.title + " - " + match.artist);
                        return match;
                    }
                }
            }
        } finally {
            try { audioRecord.stop(); } catch (Exception ignored) {}
            try { audioRecord.release(); } catch (Exception ignored) {}
        }

        if (isCancelled.get()) {
            throw new Exception("Riconoscimento annullato");
        }

        byte[] finalBytes = pcmBuffer.toByteArray();
        if (finalBytes.length < 4096) {
            throw new Exception("Audio registrato insufficiente");
        }

        byte[] samples16k = (recordSampleRate == SAMPLE_RATE)
                ? finalBytes
                : resampleTo16kHz(finalBytes, recordSampleRate);

        RecognitionMatch finalMatch = queryShazamWithSamples(samples16k);
        if (finalMatch != null) {
            Log.d(TAG, "Matched on second pass (9.5s): " + finalMatch.title + " - " + finalMatch.artist);
            return finalMatch;
        }

        return null;
    }

    private static RecognitionMatch queryShazamWithSamples(byte[] samples16k) {
        try {
            if (samples16k.length % 2 != 0) {
                byte[] even = new byte[samples16k.length - 1];
                System.arraycopy(samples16k, 0, even, 0, even.length);
                samples16k = even;
            }
            long sampleDurationMs = (samples16k.length / 2L) * 1000L / SAMPLE_RATE;
            String signatureUri = generateSignatureFromI16(samples16k);

            long timestamp = System.currentTimeMillis() / 1000L;
            String uuid1 = UUID.randomUUID().toString().toUpperCase();
            String uuid2 = UUID.randomUUID().toString();
            Random rnd = new Random();

            JSONObject geo = new JSONObject();
            geo.put("altitude", rnd.nextDouble() * 400.0 + 100.0);
            geo.put("latitude", rnd.nextDouble() * 180.0 - 90.0);
            geo.put("longitude", rnd.nextDouble() * 360.0 - 180.0);

            JSONObject sig = new JSONObject();
            sig.put("samplems", sampleDurationMs);
            sig.put("timestamp", timestamp);
            sig.put("uri", signatureUri);

            JSONObject payload = new JSONObject();
            payload.put("geolocation", geo);
            payload.put("signature", sig);
            payload.put("timestamp", timestamp);
            payload.put("timezone", TIMEZONES[rnd.nextInt(TIMEZONES.length)]);

            String url = "https://amp.shazam.com/discovery/v5/en/US/android/-/tag/" + uuid1 + "/" + uuid2
                    + "?sync=true&webv3=true&sampling=true&connected=&shazamapiversion=v3&sharehub=true&video=v3";

            Request req = new Request.Builder()
                    .url(url)
                    .post(RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8")))
                    .header("User-Agent", USER_AGENTS[rnd.nextInt(USER_AGENTS.length)])
                    .header("Content-Language", "en_US")
                    .header("Accept", "application/json")
                    .build();

            try (Response res = httpClient.newCall(req).execute()) {
                if (!res.isSuccessful() || res.body() == null) {
                    Log.w(TAG, "Shazam HTTP status: " + res.code());
                    return null;
                }
                String bodyStr = res.body().string();
                JSONObject root = new JSONObject(bodyStr);
                JSONObject track = root.optJSONObject("track");
                if (track == null) {
                    return null;
                }

                String title = track.optString("title", "");
                String artist = track.optString("subtitle", "");
                if (title.isEmpty()) return null;

                String cover = "";
                JSONObject images = track.optJSONObject("images");
                if (images != null) {
                    cover = images.optString("coverarthq", images.optString("coverart", images.optString("background", "")));
                }
                if (cover.isEmpty()) {
                    cover = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500";
                }

                String album = "Singolo Riconosciuto";
                JSONArray sections = track.optJSONArray("sections");
                if (sections != null) {
                    for (int i = 0; i < sections.length(); i++) {
                        JSONObject sec = sections.optJSONObject(i);
                        if (sec != null && "SONG".equalsIgnoreCase(sec.optString("type"))) {
                            JSONArray meta = sec.optJSONArray("metadata");
                            if (meta != null) {
                                for (int j = 0; j < meta.length(); j++) {
                                    JSONObject m = meta.optJSONObject(j);
                                    if (m != null && "Album".equalsIgnoreCase(m.optString("title"))) {
                                        album = m.optString("text", album);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                RecognitionMatch match = new RecognitionMatch();
                match.title = title;
                match.artist = artist.isEmpty() ? "Artista" : artist;
                match.album = album;
                match.cover = cover;
                match.duration = 200;
                match.videoId = searchInnerTubeVideoIdForMatch(match.artist + " " + match.title);
                return match;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying Shazam", e);
            return null;
        }
    }

    private static String searchInnerTubeVideoIdForMatch(String query) {
        try {
            JSONObject clientObj = new JSONObject();
            clientObj.put("clientName", "WEB_REMIX");
            clientObj.put("clientVersion", "1.20240901.01.00");
            clientObj.put("hl", "it");
            clientObj.put("gl", "IT");

            JSONObject payload = new JSONObject();
            payload.put("context", new JSONObject().put("client", clientObj));
            payload.put("query", query);

            Request request = new Request.Builder()
                    .url("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
                    .post(RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8")))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
                    .header("X-YouTube-Client-Name", "67")
                    .header("X-YouTube-Client-Version", "1.20240901.01.00")
                    .header("Origin", "https://music.youtube.com")
                    .header("Referer", "https://music.youtube.com/")
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (response.isSuccessful() && response.body() != null) {
                    String respStr = response.body().string();
                    java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("\"videoId\"\\s*:\\s*\"([a-zA-Z0-9_-]{11})\"").matcher(respStr);
                    if (matcher.find()) {
                        return matcher.group(1);
                    }
                }
            }
        } catch (Exception ignored) {}
        return "";
    }

    private static byte[] resampleTo16kHz(byte[] inputBytes, int srcSampleRate) {
        int numSrcSamples = inputBytes.length / 2;
        short[] srcSamples = new short[numSrcSamples];
        ByteBuffer.wrap(inputBytes).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(srcSamples);

        double ratio = (double) srcSampleRate / (double) SAMPLE_RATE;
        int numDstSamples = (int) (numSrcSamples / ratio);
        ByteBuffer outBuf = ByteBuffer.allocate(numDstSamples * 2).order(ByteOrder.LITTLE_ENDIAN);

        for (int i = 0; i < numDstSamples; i++) {
            double srcPos = i * ratio;
            int idx = (int) srcPos;
            double frac = srcPos - idx;
            short s1 = srcSamples[Math.min(idx, numSrcSamples - 1)];
            short s2 = srcSamples[Math.min(idx + 1, numSrcSamples - 1)];
            short interpolated = (short) (s1 + frac * (s2 - s1));
            outBuf.putShort(interpolated);
        }
        return outBuf.array();
    }

    public static String generateSignatureFromI16(byte[] samples) {
        short[] pcm = new short[samples.length / 2];
        ByteBuffer.wrap(samples).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(pcm);
        return new SignatureGeneratorState().process(pcm);
    }

    private static class FrequencyPeak {
        final int fftPassNumber;
        final int peakMagnitude;
        final int correctedPeakFrequencyBin;

        FrequencyPeak(int fftPassNumber, int peakMagnitude, int correctedPeakFrequencyBin) {
            this.fftPassNumber = fftPassNumber;
            this.peakMagnitude = peakMagnitude;
            this.correctedPeakFrequencyBin = correctedPeakFrequencyBin;
        }
    }

    private static class SignatureGeneratorState {
        private final int[] samplesRing = new int[FFT_SIZE];
        private int samplesPos = 0;

        private final double[][] fftOutputs = new double[RING_BUF_SIZE][FFT_OUTPUT_SIZE];
        private int fftPos = 0;

        private final double[][] spreadFfts = new double[RING_BUF_SIZE][FFT_OUTPUT_SIZE];
        private int spreadPos = 0;
        private int spreadNumWritten = 0;

        private int numSamples = 0;

        @SuppressWarnings("unchecked")
        private final List<FrequencyPeak>[] bandPeaks = new List[]{
                new ArrayList<FrequencyPeak>(),
                new ArrayList<FrequencyPeak>(),
                new ArrayList<FrequencyPeak>(),
                new ArrayList<FrequencyPeak>()
        };
        private int totalPeaks = 0;

        String process(short[] pcm) {
            int offset = 0;
            while (offset + 128 <= pcm.length) {
                double elapsedSec = (double) numSamples / SAMPLE_RATE;
                if (elapsedSec >= MAX_TIME_SECONDS && totalPeaks >= MAX_PEAKS) break;

                numSamples += 128;
                feedSamples(pcm, offset, 128);
                doFFT();
                doPeakSpreadingAndRecognition();
                offset += 128;
            }
            return encodeSignature();
        }

        private void feedSamples(short[] pcm, int start, int count) {
            for (int k = start; k < start + count; k++) {
                samplesRing[samplesPos] = pcm[k];
                samplesPos = (samplesPos + 1) % FFT_SIZE;
            }
        }

        private void doFFT() {
            double[] windowed = new double[FFT_SIZE];
            for (int i = 0; i < FFT_SIZE; i++) {
                windowed[i] = samplesRing[(samplesPos + i) % FFT_SIZE] * HANNING[i];
            }
            double[] result = computeRfft(windowed);
            System.arraycopy(result, 0, fftOutputs[fftPos], 0, FFT_OUTPUT_SIZE);
            fftPos = (fftPos + 1) % RING_BUF_SIZE;
        }

        private void doPeakSpreadingAndRecognition() {
            doPeakSpreading();
            if (spreadNumWritten >= 47) {
                doPeakRecognition();
            }
        }

        private void doPeakSpreading() {
            int lastFftIdx = (fftPos - 1 + RING_BUF_SIZE) % RING_BUF_SIZE;
            double[] spread = new double[FFT_OUTPUT_SIZE];
            System.arraycopy(fftOutputs[lastFftIdx], 0, spread, 0, FFT_OUTPUT_SIZE);

            for (int pos = 0; pos < FFT_OUTPUT_SIZE - 2; pos++) {
                spread[pos] = Math.max(spread[pos], Math.max(spread[pos + 1], spread[pos + 2]));
            }

            int[] timeOffsets = new int[]{-1, -3, -6};
            for (int pos = 0; pos < FFT_OUTPUT_SIZE; pos++) {
                double maxVal = spread[pos];
                for (int offset : timeOffsets) {
                    int idx = ((spreadPos + offset) % RING_BUF_SIZE + RING_BUF_SIZE) % RING_BUF_SIZE;
                    double oldVal = spreadFfts[idx][pos];
                    if (oldVal > maxVal) maxVal = oldVal;
                    spreadFfts[idx][pos] = maxVal;
                }
            }

            System.arraycopy(spread, 0, spreadFfts[spreadPos], 0, FFT_OUTPUT_SIZE);
            spreadPos = (spreadPos + 1) % RING_BUF_SIZE;
            spreadNumWritten++;
        }

        private void doPeakRecognition() {
            double[] fftMinus46 = fftOutputs[(fftPos - 46 + RING_BUF_SIZE * 2) % RING_BUF_SIZE];
            double[] spreadMinus49 = spreadFfts[(spreadPos - 49 + RING_BUF_SIZE * 2) % RING_BUF_SIZE];

            int[] neighborOffsets = new int[]{-10, -7, -4, -3, 1, 2, 5, 8};
            int[] otherOffsets = new int[]{-53, -45, 165, 172, 179, 186, 193, 200, 214, 221, 228, 235, 242, 249};

            for (int binPos = 10; binPos < FFT_OUTPUT_SIZE - 8; binPos++) {
                double fftVal = fftMinus46[binPos];
                if (fftVal < 1.0 / 64.0 || fftVal < spreadMinus49[binPos]) continue;

                double maxNeighborSpread49 = 0.0;
                for (int neighborOffset : neighborOffsets) {
                    double v = spreadMinus49[binPos + neighborOffset];
                    if (v > maxNeighborSpread49) maxNeighborSpread49 = v;
                }
                if (fftVal <= maxNeighborSpread49) continue;

                double maxNeighborOther = maxNeighborSpread49;
                for (int otherOffset : otherOffsets) {
                    int spreadIdx = ((spreadPos + otherOffset) % RING_BUF_SIZE + RING_BUF_SIZE) % RING_BUF_SIZE;
                    double v = spreadFfts[spreadIdx][binPos - 1];
                    if (v > maxNeighborOther) maxNeighborOther = v;
                }
                if (fftVal <= maxNeighborOther) continue;

                int fftNumber = spreadNumWritten - 46;

                double peakMag = Math.log(Math.max(1.0 / 64.0, fftVal)) * 1477.3 + 6144.0;
                double peakMagBefore = Math.log(Math.max(1.0 / 64.0, fftMinus46[binPos - 1])) * 1477.3 + 6144.0;
                double peakMagAfter = Math.log(Math.max(1.0 / 64.0, fftMinus46[binPos + 1])) * 1477.3 + 6144.0;

                double peakVariation1 = peakMag * 2.0 - peakMagBefore - peakMagAfter;
                double peakVariation2 = (peakMagAfter - peakMagBefore) * 32.0 / peakVariation1;

                double correctedBin = binPos * 64.0 + peakVariation2;
                double frequencyHz = correctedBin * (16000.0 / 2.0 / 1024.0 / 64.0);

                int band;
                if (frequencyHz < 250.0) continue;
                else if (frequencyHz < 520.0) band = BAND_250_520;
                else if (frequencyHz < 1450.0) band = BAND_520_1450;
                else if (frequencyHz < 3500.0) band = BAND_1450_3500;
                else if (frequencyHz <= 5500.0) band = BAND_3500_5500;
                else continue;

                bandPeaks[band].add(new FrequencyPeak(
                        fftNumber,
                        (int) peakMag,
                        (int) correctedBin
                ));
                totalPeaks++;
            }
        }

        private String encodeSignature() {
            ByteArrayOutputStream contentsStream = new ByteArrayOutputStream();

            for (int bandId = 0; bandId <= 3; bandId++) {
                List<FrequencyPeak> peaks = bandPeaks[bandId];
                if (peaks.isEmpty()) continue;

                ByteArrayOutputStream peakBuf = new ByteArrayOutputStream();
                int prevFftPassNumber = 0;

                for (FrequencyPeak peak : peaks) {
                    int diff = peak.fftPassNumber - prevFftPassNumber;
                    if (diff >= 255) {
                        peakBuf.write(0xFF);
                        writeLittleEndian32(peakBuf, peak.fftPassNumber);
                        prevFftPassNumber = peak.fftPassNumber;
                    }
                    peakBuf.write(peak.fftPassNumber - prevFftPassNumber);
                    writeLittleEndian16(peakBuf, peak.peakMagnitude);
                    writeLittleEndian16(peakBuf, peak.correctedPeakFrequencyBin);
                    prevFftPassNumber = peak.fftPassNumber;
                }

                byte[] peakBytes = peakBuf.toByteArray();
                writeLittleEndian32(contentsStream, 0x60030040 + bandId);
                writeLittleEndian32(contentsStream, peakBytes.length);
                contentsStream.write(peakBytes, 0, peakBytes.length);

                int padBytes = (4 - peakBytes.length % 4) % 4;
                for (int p = 0; p < padBytes; p++) {
                    contentsStream.write(0);
                }
            }

            byte[] contents = contentsStream.toByteArray();
            int sizeMinusHeader = contents.length + 8;
            int samplesAndOffset = (int) (numSamples + SAMPLE_RATE * 0.24);

            ByteBuffer headerBuf = ByteBuffer.allocate(48).order(ByteOrder.LITTLE_ENDIAN);
            headerBuf.putInt(0xcafe2580);
            headerBuf.putInt(0);
            headerBuf.putInt(sizeMinusHeader);
            headerBuf.putInt(0x94119c00);
            headerBuf.putInt(0);
            headerBuf.putInt(0);
            headerBuf.putInt(0);
            headerBuf.putInt(3 << 27);
            headerBuf.putInt(0);
            headerBuf.putInt(0);
            headerBuf.putInt(samplesAndOffset);
            headerBuf.putInt((15 << 19) + 0x40000);
            byte[] headerBytes = headerBuf.array();

            ByteArrayOutputStream fullBuf = new ByteArrayOutputStream(56 + contents.length);
            fullBuf.write(headerBytes, 0, headerBytes.length);
            writeLittleEndian32(fullBuf, 0x40000000);
            writeLittleEndian32(fullBuf, contents.length + 8);
            fullBuf.write(contents, 0, contents.length);

            byte[] fullBytes = fullBuf.toByteArray();

            CRC32 crc = new CRC32();
            crc.update(fullBytes, 8, fullBytes.length - 8);
            int crc32Value = (int) crc.getValue();

            fullBytes[4] = (byte) (crc32Value & 0xFF);
            fullBytes[5] = (byte) ((crc32Value >> 8) & 0xFF);
            fullBytes[6] = (byte) ((crc32Value >> 16) & 0xFF);
            fullBytes[7] = (byte) ((crc32Value >> 24) & 0xFF);

            String base64 = Base64.encodeToString(fullBytes, Base64.NO_WRAP);
            return "data:audio/vnd.shazam.sig;base64," + base64;
        }
    }

    private static void writeLittleEndian32(ByteArrayOutputStream out, int value) {
        out.write(value & 0xFF);
        out.write((value >>> 8) & 0xFF);
        out.write((value >>> 16) & 0xFF);
        out.write((value >>> 24) & 0xFF);
    }

    private static void writeLittleEndian16(ByteArrayOutputStream out, int value) {
        out.write(value & 0xFF);
        out.write((value >>> 8) & 0xFF);
    }

    private static double[] computeRfft(double[] windowed) {
        int n = windowed.length;
        double[] re = new double[n];
        System.arraycopy(windowed, 0, re, 0, n);
        double[] im = new double[n];

        int j = 0;
        for (int i = 1; i < n; i++) {
            int bit = n >>> 1;
            while ((j & bit) != 0) {
                j ^= bit;
                bit >>>= 1;
            }
            j ^= bit;
            if (i < j) {
                double tmp = re[i]; re[i] = re[j]; re[j] = tmp;
                tmp = im[i]; im[i] = im[j]; im[j] = tmp;
            }
        }

        int len = 2;
        while (len <= n) {
            int halfLen = len >>> 1;
            double ang = -Math.PI / halfLen;
            double wBaseRe = Math.cos(ang);
            double wBaseIm = Math.sin(ang);
            int i = 0;
            while (i < n) {
                double wRe = 1.0;
                double wIm = 0.0;
                for (int k = 0; k < halfLen; k++) {
                    int u = i + k;
                    int v = u + halfLen;
                    double evenRe = re[u];
                    double evenIm = im[u];
                    double oddRe = re[v] * wRe - im[v] * wIm;
                    double oddIm = re[v] * wIm + im[v] * wRe;
                    re[u] = evenRe + oddRe;
                    im[u] = evenIm + oddIm;
                    re[v] = evenRe - oddRe;
                    im[v] = evenIm - oddIm;
                    double newWRe = wRe * wBaseRe - wIm * wBaseIm;
                    wIm = wRe * wBaseIm + wIm * wBaseRe;
                    wRe = newWRe;
                }
                i += len;
            }
            len <<= 1;
        }

        double scaleFactor = 1.0 / (1 << 17);
        double minVal = 1e-10;
        double[] out = new double[FFT_OUTPUT_SIZE];
        for (int idx = 0; idx < FFT_OUTPUT_SIZE; idx++) {
            double r = re[idx];
            double img = im[idx];
            double mag = (r * r + img * img) * scaleFactor;
            out[idx] = Math.max(mag, minVal);
        }
        return out;
    }
}
