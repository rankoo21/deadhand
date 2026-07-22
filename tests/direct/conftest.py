import json
import os
from pathlib import Path

import pytest

_real_unlink = os.unlink


def _tolerant_unlink(path, *args, **kwargs):
    try:
        return _real_unlink(path, *args, **kwargs)
    except PermissionError:
        return None


os.unlink = _tolerant_unlink
CONTRACT = str(Path(__file__).resolve().parents[2] / "contracts" / "TestLensContract.py")


def analysis(verdict="covered", confidence="high", statuses=None):
    statuses = statuses or {
        "happy_path": "covered",
        "errors": "covered",
        "permissions": "covered",
        "edge_cases": "covered",
    }
    checks = {}
    for name, status in statuses.items():
        checks[name] = {
            "status": status,
            "evidence": "test_create_returns_saved_record",
            "missing_test": "Add a focused test for " + name + ".",
        }
    return json.dumps({
        "verdict": verdict,
        "confidence": confidence,
        "checks": checks,
        "missing_test_cases": [] if verdict == "covered" else ["Add the uncovered scenario."],
        "explanation": "The supplied tests cover the stated behavior at the selected depth.",
    })


def payload(requirement="A signed-in editor can create a record.", tests="test_create_returns_saved_record", risk="Authorization errors must not leak data."):
    return json.dumps({
        "feature_requirement": requirement,
        "tests_summary": tests,
        "risk_context": risk,
    })


@pytest.fixture
def deploy(direct_deploy, direct_vm, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_llm(r".*", analysis())
    return contract
