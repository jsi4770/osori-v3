package com.suin.fincoach.nlparse.model.localmodel;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import ai.djl.huggingface.tokenizers.Encoding;
import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.djl.huggingface.tokenizers.jni.CharSpan;
import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import ai.onnxruntime.OrtSession.Result;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;

/**
 * 자연어 파싱 자체 모델(KLUE-RoBERTa 공유 인코더 + 2-head) 추론.
 * <p>
 * server/ml/nlparse/onnx_infer.py 의 절차를 그대로 JVM 으로 옮긴 것 —
 * (1) "[지출] "/"[수입] " 프리픽스 → (2) tokenizer.json 토크나이즈 →
 * (3) model.int8.onnx 실행 → (4) type 으로 카테고리 마스킹 후 argmax →
 * (5) BIO argmax 로 merchant span 디코딩.
 * <p>
 * {@code nlparse.localmodel.enabled=true} 이고 {@code nlparse.localmodel.dir} 아래에
 * model.int8.onnx / tokenizer.json / labels.json 이 있을 때만 빈으로 뜬다.
 * 로딩 실패는 삼키고 {@link #isReady()} false 로 둔다(파싱 본류에 영향 없음).
 */
@Component
@ConditionalOnProperty(name = "nlparse.localmodel.enabled", havingValue = "true")
@Slf4j
public class NlLocalModel {

	public record Prediction(String category, String merchant, long inferMillis) {}

	private static final Map<String, String> TYPE_PREFIX = Map.of("OUT", "[지출] ", "IN", "[수입] ");

	@Value("${nlparse.localmodel.dir:}")
	private String modelDir;

	@Value("${nlparse.localmodel.file:model.int8.onnx}")
	private String modelFile;

	// 버킷에서 모델 3종(모델파일/tokenizer.json/labels.json)을 내려받기 위한 설정. 컨테이너 파일시스템이
	// 재배포마다 초기화되므로(볼륨 없음) 부팅 때마다 modelDir 에 없으면 다시 받는다. 값이 비어있으면
	// 다운로드를 건너뛰고 modelDir 에 파일이 이미 있다고 가정한다(로컬 개발 등).
	@Value("${nlparse.bucket.endpoint:}")
	private String bucketEndpoint;

	@Value("${nlparse.bucket.region:}")
	private String bucketRegion;

	@Value("${nlparse.bucket.name:}")
	private String bucketName;

	@Value("${nlparse.bucket.access-key:}")
	private String bucketAccessKey;

	@Value("${nlparse.bucket.secret-key:}")
	private String bucketSecretKey;

	@Value("${nlparse.bucket.url-style:path}")
	private String bucketUrlStyle;

	private OrtEnvironment env;
	private OrtSession session;
	private HuggingFaceTokenizer tokenizer;
	private List<String> categories;                 // cat_logits 인덱스 순서
	private Map<String, List<Integer>> typeAllowed;  // type -> 허용 카테고리 인덱스
	private boolean hasTokenTypeIds;
	private volatile boolean ready = false;

	@PostConstruct
	void load() {
		if (modelDir == null || modelDir.isBlank()) {
			log.warn("nlparse.localmodel.dir 미설정 — 자체 모델 비활성");
			return;
		}
		try {
			Path dir = Paths.get(modelDir);
			Files.createDirectories(dir);
			ensureModelFiles(dir);
			loadLabels(dir.resolve("labels.json"));
			tokenizer = HuggingFaceTokenizer.newInstance(dir.resolve("tokenizer.json"));
			env = OrtEnvironment.getEnvironment();
			OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
			opts.setIntraOpNumThreads(1);
			session = env.createSession(dir.resolve(modelFile).toString(), opts);
			hasTokenTypeIds = session.getInputNames().contains("token_type_ids");
			ready = true;
			log.info("자체 모델 로드 완료: {} (inputs={}, cats={})",
					dir.resolve(modelFile), session.getInputNames(), categories.size());
		} catch (Exception e) {
			log.error("자체 모델 로드 실패 — 비활성 상태로 계속: {}", e.toString());
		}
	}

	@SuppressWarnings("unchecked")
	private void loadLabels(Path labelsJson) throws Exception {
		JSONObject root = (JSONObject) new JSONParser().parse(Files.readString(labelsJson));
		categories = new ArrayList<>();
		for (Object c : (JSONArray) root.get("categories")) {
			categories.add((String) c);
		}
		typeAllowed = new LinkedHashMap<>();
		JSONObject ta = (JSONObject) root.get("type_allowed");
		for (Object k : ta.keySet()) {
			List<Integer> idx = new ArrayList<>();
			for (Object name : (JSONArray) ta.get(k)) {
				idx.add(categories.indexOf((String) name));
			}
			typeAllowed.put((String) k, idx);
		}
	}

	// 버킷 설정이 없으면(로컬 개발 등) 건너뛴다. 있으면 modelFile/tokenizer.json/labels.json 중
	// dir 에 없는 것만 받는다(재시도 시 이미 받은 건 다시 안 받음).
	private void ensureModelFiles(Path dir) throws Exception {
		if (bucketEndpoint.isBlank() || bucketName.isBlank() || bucketAccessKey.isBlank() || bucketSecretKey.isBlank()) {
			return;
		}
		for (String key : List.of(modelFile, "tokenizer.json", "labels.json")) {
			Path dest = dir.resolve(key);
			if (Files.exists(dest) && Files.size(dest) > 0) {
				continue;
			}
			log.info("nlparse 모델 파일 버킷에서 다운로드: {}", key);
			downloadObject(key, dest);
		}
	}

	private void downloadObject(String key, Path dest) throws Exception {
		URI endpoint = URI.create(bucketEndpoint);
		String host;
		String canonicalUri;
		if ("vhost".equalsIgnoreCase(bucketUrlStyle)) {
			host = bucketName + "." + endpoint.getHost();
			canonicalUri = "/" + key;
		} else {
			host = endpoint.getHost();
			canonicalUri = "/" + bucketName + "/" + key;
		}
		String url = endpoint.getScheme() + "://" + host + canonicalUri;

		String payloadHash = sha256Hex(new byte[0]);
		ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
		String amzDate = now.format(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));
		String dateStamp = now.format(DateTimeFormatter.ofPattern("yyyyMMdd"));

		String canonicalHeaders = "host:" + host + "\n"
				+ "x-amz-content-sha256:" + payloadHash + "\n"
				+ "x-amz-date:" + amzDate + "\n";
		String signedHeaders = "host;x-amz-content-sha256;x-amz-date";
		String canonicalRequest = String.join("\n",
				"GET", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash);

		String credentialScope = dateStamp + "/" + bucketRegion + "/s3/aws4_request";
		String stringToSign = String.join("\n",
				"AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest.getBytes(StandardCharsets.UTF_8)));

		byte[] signingKey = hmacSha256(hmacSha256(hmacSha256(hmacSha256(
				("AWS4" + bucketSecretKey).getBytes(StandardCharsets.UTF_8), dateStamp),
				bucketRegion), "s3"), "aws4_request");
		String signature = HexFormat.of().formatHex(hmacSha256(signingKey, stringToSign));

		String authorization = "AWS4-HMAC-SHA256 Credential=" + bucketAccessKey + "/" + credentialScope
				+ ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;

		HttpRequest req = HttpRequest.newBuilder(URI.create(url))
				.header("x-amz-date", amzDate)
				.header("x-amz-content-sha256", payloadHash)
				.header("Authorization", authorization)
				.timeout(Duration.ofMinutes(3))
				.GET()
				.build();

		Path tmp = Files.createTempFile(dest.getParent(), dest.getFileName().toString(), ".part");
		try {
			HttpResponse<Path> resp = HttpClient.newHttpClient()
					.send(req, HttpResponse.BodyHandlers.ofFile(tmp, java.nio.file.StandardOpenOption.CREATE,
							java.nio.file.StandardOpenOption.TRUNCATE_EXISTING, java.nio.file.StandardOpenOption.WRITE));
			if (resp.statusCode() != 200) {
				throw new IllegalStateException("버킷 다운로드 실패 " + key + ": HTTP " + resp.statusCode());
			}
			Files.move(tmp, dest, StandardCopyOption.REPLACE_EXISTING);
		} finally {
			Files.deleteIfExists(tmp);
		}
	}

	private static byte[] hmacSha256(byte[] key, String data) throws Exception {
		return hmacSha256(key, data.getBytes(StandardCharsets.UTF_8));
	}

	private static byte[] hmacSha256(byte[] key, byte[] data) throws Exception {
		Mac mac = Mac.getInstance("HmacSHA256");
		mac.init(new SecretKeySpec(key, "HmacSHA256"));
		return mac.doFinal(data);
	}

	private static String sha256Hex(byte[] data) throws Exception {
		return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
	}

	public boolean isReady() {
		return ready;
	}

	/** 예측. 준비 안 됐거나 오류면 null (호출부가 조용히 무시하도록). */
	public Prediction predict(String text, String type) {
		if (!ready) {
			return null;
		}
		String tx = "IN".equalsIgnoreCase(type) ? "IN" : "OUT";
		String full = TYPE_PREFIX.get(tx) + text;
		long t0 = System.currentTimeMillis();
		try {
			Encoding enc = tokenizer.encode(full);
			long[] ids = enc.getIds();
			long[] mask = enc.getAttentionMask();
			int n = ids.length;

			Map<String, OnnxTensor> feed = new LinkedHashMap<>();
			feed.put("input_ids", OnnxTensor.createTensor(env, new long[][] { ids }));
			feed.put("attention_mask", OnnxTensor.createTensor(env, new long[][] { mask }));
			if (hasTokenTypeIds) {
				feed.put("token_type_ids", OnnxTensor.createTensor(env, new long[][] { new long[n] }));
			}

			String category;
			int[] bio;
			try (Result out = session.run(feed)) {
				float[][] catLogits = (float[][]) out.get("cat_logits").get().getValue();
				float[][][] bioLogits = (float[][][]) out.get("bio_logits").get().getValue();
				category = argmaxCategory(catLogits[0], tx);
				bio = argmaxBio(bioLogits[0], n);
			} finally {
				feed.values().forEach(OnnxTensor::close);
			}

			String merchant = decodeMerchant(enc, bio, full);
			return new Prediction(category, merchant, System.currentTimeMillis() - t0);
		} catch (Exception e) {
			log.debug("자체 모델 추론 실패: {}", e.toString());
			return null;
		}
	}

	private String argmaxCategory(float[] logits, String type) {
		List<Integer> allowed = typeAllowed.getOrDefault(type, null);
		int best = -1;
		float bestVal = Float.NEGATIVE_INFINITY;
		if (allowed != null) {
			for (int i : allowed) {
				if (logits[i] > bestVal) {
					bestVal = logits[i];
					best = i;
				}
			}
		} else {
			for (int i = 0; i < logits.length; i++) {
				if (logits[i] > bestVal) {
					bestVal = logits[i];
					best = i;
				}
			}
		}
		return categories.get(best);
	}

	private int[] argmaxBio(float[][] tokenLogits, int n) {
		int[] tags = new int[n];
		for (int j = 0; j < n; j++) {
			float[] l = tokenLogits[j];
			int m = 0;
			for (int k = 1; k < l.length; k++) {
				if (l[k] > l[m]) {
					m = k;
				}
			}
			tags[j] = m; // 0=O 1=B-MERCHANT 2=I-MERCHANT
		}
		return tags;
	}

	/** 첫 B..I span 을 원문(full)에서 잘라 반환. 없으면 null. */
	private String decodeMerchant(Encoding enc, int[] bio, String full) {
		CharSpan[] spans = enc.getCharTokenSpans();
		int start = -1;
		int end = -1;
		for (int j = 0; j < bio.length && j < spans.length; j++) {
			CharSpan cs = spans[j];
			if (cs == null) {
				continue; // 스페셜 토큰
			}
			if (bio[j] == 1) {
				start = cs.getStart();
				end = cs.getEnd();
				for (int k = j + 1; k < bio.length && k < spans.length; k++) {
					CharSpan cs2 = spans[k];
					if (cs2 == null) {
						continue;
					}
					if (bio[k] == 2) {
						end = cs2.getEnd();
					} else {
						break;
					}
				}
				break;
			}
		}
		if (start < 0 || end <= start || end > full.length()) {
			return null;
		}
		String m = full.substring(start, end).trim();
		return m.isEmpty() ? null : m;
	}

	@PreDestroy
	void close() {
		try {
			if (session != null) {
				session.close();
			}
			if (tokenizer != null) {
				tokenizer.close();
			}
		} catch (Exception ignored) {
			// best-effort
		}
	}
}
