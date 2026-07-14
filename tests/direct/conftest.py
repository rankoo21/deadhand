import json
import os
from pathlib import Path

import pytest

# Workaround for a gltest bug on Windows: the direct-mode loader redirects stdin
# to a temp file with os.dup2, then immediately calls os.unlink on it. Windows
# refuses to delete a file that is still open (the descriptor is now stdin),
# raising PermissionError [WinError 32]. We tolerate that single case; the temp
# file is harmless and gets reclaimed when the run ends.
_real_unlink = os.unlink


def _tolerant_unlink(path, *args, **kwargs):
    try:
        return _real_unlink(path, *args, **kwargs)
    except PermissionError:
        return None


os.unlink = _tolerant_unlink

CONTRACT = str(Path(__file__).resolve().parents[2] / "contracts" / "DeadhandContract.py")


def met_llm_response() -> str:
    """A keeper interpretation that authenticates and confirms the condition."""
    return json.dumps(
        {
            "authenticated": True,
            "met": True,
            "closeness": 92,
            "rationale": "The evidence states the studio officially shipped its 1.0 release.",
        }
    )


def nearing_llm_response() -> str:
    """A keeper interpretation that sees the condition drawing near but unmet."""
    return json.dumps(
        {
            "authenticated": True,
            "met": False,
            "closeness": 55,
            "rationale": "The evidence mentions an upcoming release but no confirmation yet.",
        }
    )


def not_met_llm_response() -> str:
    """A keeper interpretation that finds no confirmation."""
    return json.dumps(
        {
            "authenticated": False,
            "met": False,
            "closeness": 8,
            "rationale": "The evidence does not confirm the condition.",
        }
    )


def unauthenticated_met_llm_response() -> str:
    """A model that CLAIMS the condition is met with high closeness but cannot
    authenticate it. The deterministic gate and the agreed authenticated flag
    must still block an irreversible release on weak or unattributed evidence."""
    return json.dumps(
        {
            "authenticated": False,
            "met": True,
            "closeness": 96,
            "rationale": "An anonymous post asserts it happened, but nothing is attributed.",
        }
    )


@pytest.fixture
def deploy(direct_deploy, direct_vm, direct_alice):
    """Deploy the Deadhand contract with alice as the contract owner and a sane
    default mock LLM (no confirmation), so tests opt into a release explicitly."""
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_llm(r".*", not_met_llm_response())
    return contract
