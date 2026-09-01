#!/usr/bin/env node
// 합성 문장(seeds.json)을 실제 /nlparse/parse 엔드포인트로 순차 전송해, 진짜 파이프라인
// (Gemini 호출 + 정규식 이중체크 + 카테고리 정규화)을 통과한 (입력 -> 결과) 쌍을
// NL_PARSE_LOG에 쌓기 위한 러너. 절대 프로덕션(base URL)에 대량으로 돌리지 말 것 —
// 프로덕션은 코칭/챌린지와 공유하는 일일 Gemini 호출 한도(COACHING_LLM_DAILY_LIMIT)가
// 낮게 걸려 있어(운영 확인 시점 기준 18회) 실사용자 요청을 막아버릴 수 있다.
// 로컬 서버(coaching.llm.enabled=true + 유효한 gemini.api.key로 기동)를 대상으로 실행할 것.
//
// 사용법:
//   node scripts/nlparse-synth/run.mjs --user-id 1
//   node scripts/nlparse-synth/run.mjs --user-id 1 --limit 10 --delay 5000
//   node scripts/nlparse-synth/run.mjs --user-id 1 --dry-run
//   node scripts/nlparse-synth/run.mjs --user-id 1 --reset   # 처음부터 다시 전송
//
// seeds.json은 인덱스 기반으로 진행 상황을 추적하므로(progress.json), 항목을 중간에 끼워
// 넣지 말고 항상 배열 끝에 추가할 것 — 안 그러면 이미 보낸 문장이 다시 전송될 수 있다.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS_PATH = path.join(__dirname, "seeds.json");
const PROGRESS_PATH = path.join(__dirname, "progress.json");
const RESULTS_PATH = path.join(__dirname, "results.jsonl");

function parseArgs(argv) {
	const args = { base: "http://localhost:8080/fincoach", limit: 15, delay: 4000, dryRun: false, reset: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--base") args.base = argv[++i];
		else if (a === "--user-id") args.userId = Number(argv[++i]);
		else if (a === "--limit") args.limit = Number(argv[++i]);
		else if (a === "--delay") args.delay = Number(argv[++i]);
		else if (a === "--seeds") args.seedsPath = argv[++i];
		else if (a === "--dry-run") args.dryRun = true;
		else if (a === "--reset") args.reset = true;
		else {
			console.error(`알 수 없는 옵션: ${a}`);
			process.exit(1);
		}
	}
	if (!args.userId && !args.dryRun) {
		console.error("--user-id 는 필수입니다 (로컬 DB의 USERS.USER_ID). --dry-run 없이 실행하려면 반드시 지정하세요.");
		process.exit(1);
	}
	return args;
}

async function loadProgress() {
	try {
		const raw = await readFile(PROGRESS_PATH, "utf-8");
		return JSON.parse(raw);
	} catch {
		return { nextIndex: 0 };
	}
}

async function saveProgress(progress) {
	await writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2) + "\n");
}

async function appendResult(entry) {
	await writeFile(RESULTS_PATH, JSON.stringify(entry) + "\n", { flag: "a" });
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const seedsPath = args.seedsPath ?? SEEDS_PATH;
	const seeds = JSON.parse(await readFile(seedsPath, "utf-8"));

	let progress = args.reset ? { nextIndex: 0 } : await loadProgress();
	const startIndex = progress.nextIndex ?? 0;

	if (startIndex >= seeds.length) {
		console.log(`전체 ${seeds.length}건 모두 전송 완료됨. seeds.json에 새 문장을 추가하거나 --reset으로 다시 시작하세요.`);
		return;
	}

	const endIndex = Math.min(startIndex + args.limit, seeds.length);
	console.log(
		`총 ${seeds.length}건 중 ${startIndex}~${endIndex - 1}번 인덱스(${endIndex - startIndex}건) 전송 시도. ` +
			`base=${args.base}${args.dryRun ? " (dry-run)" : ""}`,
	);

	let sent = 0;
	let index = startIndex;
	for (; index < endIndex; index++) {
		const seed = seeds[index];

		if (args.dryRun) {
			console.log(`[dry-run] #${index} (${seed.type}) ${seed.text}`);
			continue;
		}

		const body = { userId: args.userId, text: seed.text, type: seed.type };
		let res;
		try {
			res = await fetch(`${args.base}/nlparse/parse`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
		} catch (e) {
			console.error(`#${index} 요청 실패(네트워크): ${e.message}. 서버가 켜져 있는지 확인하세요. 중단.`);
			break;
		}

		if (res.status === 429) {
			console.warn(`#${index} 일일 호출 한도 초과(429). 여기서 중단 — 다음 실행 시 이 항목부터 재시도됩니다.`);
			break;
		}

		const json = await res.json().catch(() => null);

		if (!res.ok || !json?.ok) {
			console.warn(`#${index} 파싱 실패 또는 서버 오류 (status=${res.status}): ${seed.text} ->`, json);
			await appendResult({ index, request: body, response: json, status: res.status, ts: new Date().toISOString() });
			// for문 자체가 이미 index를 1 증가시키므로 여기서 추가로 증가시키면 다음 시드가
			// 통째로 건너뛰어진다(실제로 #37이 이렇게 누락된 적 있음). 실패한 항목만 건너뛰고
			// 싶다면 이 자리에서 증가시키지 말 것.
			sent++;
			continue;
		}

		console.log(
			`#${index} [${seed.type}] "${seed.text}" -> 금액=${json.amount} 카테고리=${json.category} ` +
				`날짜=${json.date} confidence=${json.confidence} source=${json.source}`,
		);
		await appendResult({ index, request: body, response: json, status: res.status, ts: new Date().toISOString() });
		sent++;

		if (index < endIndex - 1) {
			await sleep(args.delay);
		}
	}

	if (!args.dryRun) {
		await saveProgress({ nextIndex: index });
		console.log(`이번 실행 ${sent}건 전송. 다음 실행은 인덱스 ${index}부터 이어서 진행됩니다 (총 ${seeds.length}건 중).`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
