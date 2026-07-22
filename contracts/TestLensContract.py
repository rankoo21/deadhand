# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
from dataclasses import dataclass

ERROR_EXPECTED = "[EXPECTED]"
ERROR_LLM = "[LLM_ERROR]"
VERDICTS = ("covered", "partial", "insufficient")
CONFIDENCE = ("low", "medium", "high")
STATUSES = ("covered", "partial", "missing")
DIMENSIONS = ("happy_path", "errors", "permissions", "edge_cases")
MAX_REQUEST_ID = 96
MAX_REQUIREMENT = 3000
MAX_TESTS = 10000
MAX_RISK_CONTEXT = 3000
MAX_PAYLOAD = 17000
MAX_EXPLANATION = 600
MAX_EVIDENCE = 260
MAX_SUGGESTION = 300
MAX_TIMESTAMP = 4_000_000_000_000_000
PAGE_MAX = 20


def _expected(message: str):
    raise gl.vm.UserError(ERROR_EXPECTED + " " + message)


def _llm_error(message: str):
    raise gl.vm.UserError(ERROR_LLM + " " + message)


def _clean(value, limit: int) -> str:
    return ("" if value is None else str(value).strip())[:limit]


def _safe_request_id(value) -> str:
    if not isinstance(value, str):
        _expected("request_id must be a string")
    clean = value.strip()
    if not clean or len(clean) > MAX_REQUEST_ID:
        _expected("request_id length is invalid")
    for char in clean:
        if not (char.isalnum() or char in "-_."):
            _expected("request_id contains unsafe characters")
    return clean


def _validate_payload(payload_json: str) -> dict:
    if not isinstance(payload_json, str):
        _expected("payload_json must be a string")
    if len(payload_json) > MAX_PAYLOAD:
        _expected("payload_json is too long")
    try:
        payload = json.loads(payload_json)
    except Exception:
        _expected("payload_json is malformed")
    if not isinstance(payload, dict):
        _expected("payload_json must decode to an object")
    for field in ("feature_requirement", "tests_summary"):
        if field not in payload or not isinstance(payload[field], str):
            _expected(field + " must be a string")
    if "risk_context" in payload and not isinstance(payload["risk_context"], str):
        _expected("risk_context must be a string")
    requirement = payload["feature_requirement"].strip()
    tests = payload["tests_summary"].strip()
    risk = payload.get("risk_context", "").strip()
    if not requirement:
        _expected("feature_requirement is required")
    if not tests:
        _expected("tests_summary is required")
    if len(requirement) > MAX_REQUIREMENT:
        _expected("feature_requirement is too long")
    if len(tests) > MAX_TESTS:
        _expected("tests_summary is too long")
    if len(risk) > MAX_RISK_CONTEXT:
        _expected("risk_context is too long")
    return {"feature_requirement": requirement, "tests_summary": tests, "risk_context": risk}


def _parse_model_json(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    text = str(raw)
    first = text.find("{")
    last = text.rfind("}")
    if first < 0 or last <= first:
        _llm_error("model returned no JSON object")
    try:
        parsed = json.loads(text[first:last + 1])
    except Exception:
        _llm_error("model returned invalid JSON")
    if not isinstance(parsed, dict):
        _llm_error("model result must be an object")
    return parsed


def _grounded_evidence(tests: str, proposed) -> str:
    candidate = " ".join(_clean(proposed, MAX_EVIDENCE).split())
    lines = [" ".join(line.strip().split())[:MAX_EVIDENCE] for line in tests.splitlines() if line.strip()]
    if not lines:
        return ""
    lowered = candidate.lower()
    for line in lines:
        if lowered and (line.lower() in lowered or lowered in line.lower()):
            return line
    return lines[0]


def _normalize_result(raw, payload: dict) -> dict:
    data = _parse_model_json(raw)
    verdict = _clean(data.get("verdict"), 20).lower()
    confidence = _clean(data.get("confidence"), 20).lower()
    if verdict not in VERDICTS:
        _llm_error("model verdict is invalid")
    if confidence not in CONFIDENCE:
        _llm_error("model confidence is invalid")
    checks_in = data.get("checks", data.get("dimensions", {}))
    if not isinstance(checks_in, dict):
        _llm_error("model checks must be an object")
    checks = {}
    for name in DIMENSIONS:
        item = checks_in.get(name)
        if not isinstance(item, dict):
            _llm_error("model omitted check " + name)
        status = _clean(item.get("status"), 20).lower()
        if status not in STATUSES:
            _llm_error("model check status is invalid")
        checks[name] = {
            "status": status,
            "evidence": _grounded_evidence(payload["tests_summary"], item.get("evidence", "")),
            "missing_test": _clean(item.get("missing_test"), MAX_SUGGESTION) or "Add a focused test for this category.",
        }
    missing_in = data.get("missing_test_cases", [])
    if not isinstance(missing_in, list):
        _llm_error("missing_test_cases must be an array")
    missing = []
    for value in missing_in[:12]:
        text = _clean(value, MAX_SUGGESTION)
        if text and text not in missing:
            missing.append(text)
    explanation = _clean(data.get("explanation"), MAX_EXPLANATION)
    if not explanation:
        _llm_error("model explanation is required")
    return {"verdict": verdict, "confidence": confidence, "checks": checks, "missing_test_cases": missing, "explanation": explanation}


def _prompt(payload: dict) -> str:
    return """You are TestLens, a strict software test-coverage reviewer. Compare the feature requirement with only the supplied tests summary and optional risk context. Do not use outside facts, URLs, APIs, or assumptions. Missing evidence is not coverage. Judge four categories: happy_path, errors, permissions, edge_cases. Return JSON only in this exact shape: {\"verdict\":\"covered|partial|insufficient\",\"confidence\":\"low|medium|high\",\"checks\":{\"happy_path\":{\"status\":\"covered|partial|missing\",\"evidence\":\"literal test-summary excerpt\",\"missing_test\":\"focused addition\"},\"errors\":{...},\"permissions\":{...},\"edge_cases\":{...}},\"missing_test_cases\":[\"specific missing test\"],\"explanation\":\"grounded summary\"}. Overall verdict is covered only when all four checks are covered, insufficient when evidence is broadly absent, otherwise partial.\nFEATURE REQUIREMENT:\n""" + payload["feature_requirement"] + "\nTESTS SUMMARY:\n" + payload["tests_summary"] + "\nRISK CONTEXT:\n" + payload["risk_context"]


def _assess(payload: dict) -> dict:
    raw = gl.nondet.exec_prompt(_prompt(payload), response_format="json")
    return _normalize_result(raw, payload)


def _same_decision(left: dict, right: dict) -> bool:
    if left.get("verdict") != right.get("verdict") or left.get("confidence") != right.get("confidence"):
        return False
    left_checks = left.get("checks", {})
    right_checks = right.get("checks", {})
    if not isinstance(left_checks, dict) or not isinstance(right_checks, dict):
        return False
    for name in DIMENSIONS:
        if left_checks.get(name, {}).get("status") != right_checks.get(name, {}).get("status"):
            return False
    return True


def _consensus(payload: dict) -> dict:
    def leader_fn():
        return _assess(payload)

    def validator_fn(leaders_result: gl.vm.Result) -> bool:
        if not isinstance(leaders_result, gl.vm.Return):
            return False
        leader = leaders_result.calldata
        if not isinstance(leader, dict):
            return False
        try:
            validator = _assess(payload)
            return _same_decision(leader, validator)
        except Exception:
            return False

    return gl.vm.run_nondet_unsafe(leader_fn, validator_fn)


class TestLensContract(gl.Contract):
    results: TreeMap[str, str]
    result_order: DynArray[str]
    result_count: u256
    verdict_counts: TreeMap[str, u256]

    def __init__(self):
        self.result_count = u256(0)
        for verdict in VERDICTS:
            self.verdict_counts[verdict] = u256(0)

    def _key(self, sender: str, request_id: str) -> str:
        return str(sender).lower() + ":" + request_id

    @gl.public.write
    def submit_check(self, request_id: str, payload_json: str, now_ms: int) -> dict:
        clean_id = _safe_request_id(request_id)
        if not isinstance(now_ms, int) or now_ms < 0 or now_ms > MAX_TIMESTAMP:
            _expected("now_ms is out of range")
        sender = gl.message.sender_address.as_hex
        key = self._key(sender, clean_id)
        if key in self.results:
            _expected("request_id already exists for this sender")
        payload = _validate_payload(payload_json)
        agreed = _consensus(payload)
        if not isinstance(agreed, dict):
            _llm_error("consensus returned an invalid result")
        result = {
            "request_id": clean_id,
            "sender": sender,
            "verdict": agreed["verdict"],
            "confidence": agreed["confidence"],
            "checks": agreed["checks"],
            "missing_test_cases": agreed["missing_test_cases"],
            "explanation": agreed["explanation"],
            "submitted_at": now_ms,
        }
        self.results[key] = json.dumps(result, sort_keys=True, separators=(",", ":"))
        self.result_order.append(key)
        self.result_count += u256(1)
        self.verdict_counts[result["verdict"]] = u256(int(self.verdict_counts.get(result["verdict"]) or 0) + 1)
        return result

    @gl.public.view
    def get_result(self, request_id: str, sender: str = "") -> dict | None:
        clean_id = _safe_request_id(request_id)
        lookup_sender = sender.strip().lower() if isinstance(sender, str) and sender.strip() else gl.message.sender_address.as_hex
        key = self._key(lookup_sender, clean_id)
        raw = self.results.get(key)
        return json.loads(raw) if raw else None

    @gl.public.view
    def get_results(self, offset: int = 0, limit: int = PAGE_MAX) -> list:
        start = max(0, int(offset))
        size = int(limit)
        if size <= 0:
            return []
        if size > PAGE_MAX:
            size = PAGE_MAX
        total = len(self.result_order)
        output = []
        for position in range(start, min(total, start + size)):
            key = self.result_order[total - 1 - position]
            output.append(json.loads(self.results[key]))
        return output

    @gl.public.view
    def get_summary(self) -> dict:
        return {"total": int(self.result_count), "covered": int(self.verdict_counts.get("covered") or 0), "partial": int(self.verdict_counts.get("partial") or 0), "insufficient": int(self.verdict_counts.get("insufficient") or 0)}
