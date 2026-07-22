import json

from conftest import analysis, payload


def submit(deploy, request_id="req-1", body=None, now_ms=1000):
    return deploy.submit_check(request_id, body or payload(), now_ms)


def set_analysis(direct_vm, response):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", response)


def test_valid_result_is_normalized_and_persisted(deploy):
    result = submit(deploy)
    assert result["request_id"] == "req-1"
    assert result["verdict"] == "covered"
    assert result["confidence"] == "high"
    assert set(result["checks"]) == {"happy_path", "errors", "permissions", "edge_cases"}
    assert result["checks"]["happy_path"]["evidence"] == "test_create_returns_saved_record"
    assert deploy.get_result("req-1") == result


def test_request_id_validation(deploy, direct_vm):
    for bad in ("", "   ", "unsafe/id", "space id"):
        with direct_vm.expect_revert("request_id"):
            submit(deploy, bad)
    submit(deploy, "r" * 96)
    with direct_vm.expect_revert("request_id length is invalid"):
        submit(deploy, "r" * 97)


def test_payload_json_validation(deploy, direct_vm):
    with direct_vm.expect_revert("payload_json is malformed"):
        submit(deploy, body="{bad")
    with direct_vm.expect_revert("must decode to an object"):
        submit(deploy, body="[]")
    with direct_vm.expect_revert("feature_requirement must be a string"):
        submit(deploy, body=json.dumps({"feature_requirement": 4, "tests_summary": "x"}))
    with direct_vm.expect_revert("tests_summary must be a string"):
        submit(deploy, body=json.dumps({"feature_requirement": "x"}))
    with direct_vm.expect_revert("risk_context must be a string"):
        submit(deploy, body=json.dumps({"feature_requirement": "x", "tests_summary": "y", "risk_context": []}))


def test_required_fields_and_boundaries(deploy, direct_vm):
    with direct_vm.expect_revert("feature_requirement is required"):
        submit(deploy, body=payload(requirement=" "))
    with direct_vm.expect_revert("tests_summary is required"):
        submit(deploy, body=payload(tests=" "))
    submit(deploy, "bounds", payload("r" * 3000, "t" * 10000, "c" * 3000))
    with direct_vm.expect_revert("feature_requirement is too long"):
        submit(deploy, "long-r", payload(requirement="r" * 3001))
    with direct_vm.expect_revert("tests_summary is too long"):
        submit(deploy, "long-t", payload(tests="t" * 10001))
    with direct_vm.expect_revert("risk_context is too long"):
        submit(deploy, "long-c", payload(risk="c" * 3001))


def test_timestamp_validation(deploy, direct_vm):
    with direct_vm.expect_revert("now_ms is out of range"):
        submit(deploy, now_ms=-1)


def test_idempotency_is_per_sender(deploy, direct_vm, direct_bob, direct_alice):
    first = submit(deploy, "same")
    with direct_vm.expect_revert("already exists for this sender"):
        submit(deploy, "same")
    direct_vm.sender = direct_bob
    second = submit(deploy, "same", now_ms=2000)
    assert second["request_id"] == first["request_id"]
    assert second["sender"] != first["sender"]
    assert deploy.get_result("same")["sender"] == second["sender"]
    direct_vm.sender = direct_alice
    assert deploy.get_result("same")["sender"] == first["sender"]


def test_pagination_and_summary(deploy, direct_vm):
    submit(deploy, "covered")
    set_analysis(direct_vm, analysis("partial", "medium", {"happy_path": "covered", "errors": "partial", "permissions": "missing", "edge_cases": "partial"}))
    submit(deploy, "partial")
    set_analysis(direct_vm, analysis("insufficient", "low", {"happy_path": "missing", "errors": "missing", "permissions": "missing", "edge_cases": "missing"}))
    submit(deploy, "insufficient")
    assert [item["request_id"] for item in deploy.get_results(0, 2)] == ["insufficient", "partial"]
    assert [item["request_id"] for item in deploy.get_results(2, 2)] == ["covered"]
    assert deploy.get_results(0, 0) == []
    assert deploy.get_summary() == {"total": 3, "covered": 1, "partial": 1, "insufficient": 1}


def test_malformed_llm_output_does_not_persist(deploy, direct_vm):
    set_analysis(direct_vm, "not json")
    with direct_vm.expect_revert("[LLM_ERROR]"):
        submit(deploy)
    assert deploy.get_results(0, 20) == []
    assert deploy.get_summary()["total"] == 0


def capture_validator(deploy, direct_vm, response):
    set_analysis(direct_vm, json.dumps(response))
    submit(deploy)


def canonical(verdict="partial", confidence="medium", override=None):
    statuses = {"happy_path": "covered", "errors": "partial", "permissions": "missing", "edge_cases": "partial"}
    if override:
        statuses.update(override)
    return json.loads(analysis(verdict, confidence, statuses))


def test_validator_accepts_matching_decision_with_different_prose(deploy, direct_vm):
    mine = canonical()
    capture_validator(deploy, direct_vm, mine)
    leader = canonical()
    leader["explanation"] = "Different prose is permitted when every stable decision matches."
    assert direct_vm.run_validator(leader_result=leader) is True


def test_validator_rejects_verdict_mismatch(deploy, direct_vm):
    mine = canonical()
    capture_validator(deploy, direct_vm, mine)
    leader = canonical(verdict="covered")
    assert direct_vm.run_validator(leader_result=leader) is False


def test_validator_accepts_same_verdict_with_differing_confidence(deploy, direct_vm):
    # Consensus compares only the load-bearing verdict, so honest confidence
    # variation still agrees instead of forcing UNDETERMINED.
    mine = canonical()
    capture_validator(deploy, direct_vm, mine)
    leader = canonical(confidence="high")
    assert direct_vm.run_validator(leader_result=leader) is True


def test_validator_accepts_same_verdict_with_differing_category_status(deploy, direct_vm):
    # Per-dimension statuses vary between independent LLM runs; a matching
    # verdict must still agree.
    mine = canonical()
    capture_validator(deploy, direct_vm, mine)
    for category in ("happy_path", "errors", "permissions", "edge_cases"):
        leader = canonical(override={category: "covered" if mine["checks"][category]["status"] != "covered" else "missing"})
        assert direct_vm.run_validator(leader_result=leader) is True


def test_validator_rejects_malformed_independent_analysis(deploy, direct_vm):
    mine = canonical()
    capture_validator(deploy, direct_vm, mine)
    set_analysis(direct_vm, "not json")
    assert direct_vm.run_validator(leader_result=mine) is False
