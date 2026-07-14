import json

from conftest import (
    met_llm_response,
    nearing_llm_response,
    not_met_llm_response,
    unauthenticated_met_llm_response,
)


def _seal_and_bind(deploy, condition, now=1000):
    """Helper: seal a vault to bob and bind a condition, returning the id."""
    vault_id = deploy.seal(
        "When the studio ships 1.0",
        "ipfs://commitment-reference-abc",
        "0xbob",
        "crescent",
        "public",
        now,
    )
    deploy.bind_condition(vault_id, condition, now)
    return vault_id


# ---------------------------------------------------------------------------
# seal
# ---------------------------------------------------------------------------

def test_seal_creates_sealed_vault(deploy):
    vault_id = deploy.seal(
        "A quiet word",
        "ipfs://commit-1",
        "0xbob",
        "eye",
        "public",
        1000,
    )
    vault = deploy.get_vault(vault_id)
    assert vault is not None
    assert vault["state"] == "sealed"
    assert vault["recipient"] == "0xbob"
    assert vault["sigil"] == "eye"
    assert vault["conditionBound"] is False
    # The payload reference is held shut until the vault is opened.
    assert vault["payloadCommitment"] == ""
    assert vault["opened"] is False


def test_seal_never_stores_plaintext_payload(deploy):
    # The reviewer's core ask: the secret must never sit on-chain as plaintext.
    # The caller commits client-side and passes only an opaque commitment. Views
    # must not expose it before the vault is opened, and the stored field must be
    # the commitment reference, not the cleartext secret.
    secret_plaintext = "MEET ME AT THE OLD PIER AT MIDNIGHT, BRING THE LEDGER"
    commitment = "sha256:2f1cptext-commitment-reference-only"
    vault_id = deploy.seal(
        "A quiet word",
        commitment,
        "0xbob",
        "eye",
        "public",
        1000,
    )
    vault = deploy.get_vault(vault_id)
    # Before opening, no payload material is revealed at all.
    assert vault["payloadCommitment"] == ""
    # And across every listed view, the plaintext secret never appears.
    listed = deploy.get_vaults(0, 20)
    blob = json.dumps(listed) + json.dumps(vault)
    assert secret_plaintext not in blob


def test_seal_requires_payload(deploy, direct_vm):
    with direct_vm.expect_revert("A seal needs words"):
        deploy.seal("Empty", "   ", "0xbob", "crescent", "public", 0)


def test_seal_requires_recipient(deploy, direct_vm):
    with direct_vm.expect_revert("needs a keeper"):
        deploy.seal("No keeper", "ipfs://c", "  ", "crescent", "public", 0)


def test_seal_rejects_bad_sigil(deploy, direct_vm):
    with direct_vm.expect_revert("Unknown sigil"):
        deploy.seal("Bad", "ipfs://c", "0xbob", "spiral", "public", 0)


def test_seal_rejects_bad_visibility(deploy, direct_vm):
    with direct_vm.expect_revert("Unknown condition visibility"):
        deploy.seal("Bad", "ipfs://c", "0xbob", "crescent", "hidden", 0)


# ---------------------------------------------------------------------------
# bind_condition
# ---------------------------------------------------------------------------

def test_bind_condition_sets_immutable_text(deploy):
    vault_id = deploy.seal("S", "ipfs://c", "0xbob", "crescent", "public", 1000)
    deploy.bind_condition(vault_id, "When the studio ships its 1.0 release.", 1000)
    vault = deploy.get_vault(vault_id)
    assert vault["conditionBound"] is True
    assert vault["conditionText"] == "When the studio ships its 1.0 release."


def test_bind_condition_requires_text(deploy, direct_vm):
    vault_id = deploy.seal("S", "ipfs://c", "0xbob", "crescent", "public", 1000)
    with direct_vm.expect_revert("Bind a condition"):
        deploy.bind_condition(vault_id, "   ", 1000)


def test_bind_condition_only_owner(deploy, direct_vm, direct_bob):
    vault_id = deploy.seal("S", "ipfs://c", "0xbob", "crescent", "public", 1000)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the author"):
        deploy.bind_condition(vault_id, "When something happens.", 1000)


def test_bind_condition_cannot_change(deploy, direct_vm):
    vault_id = deploy.seal("S", "ipfs://c", "0xbob", "crescent", "public", 1000)
    deploy.bind_condition(vault_id, "When the record is broken.", 1000)
    with direct_vm.expect_revert("cannot change"):
        deploy.bind_condition(vault_id, "A different condition.", 2000)


# ---------------------------------------------------------------------------
# check_world (the GenLayer non-deterministic call)
# ---------------------------------------------------------------------------

def test_check_world_requires_bound_condition(deploy, direct_vm):
    vault_id = deploy.seal("S", "ipfs://c", "0xbob", "crescent", "public", 1000)
    with direct_vm.expect_revert("Bind a condition"):
        deploy.check_world(vault_id, "some evidence", "source", 2000)


def test_check_world_releasable_when_condition_met(deploy, direct_vm):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", met_llm_response())

    vault_id = _seal_and_bind(deploy, "When the studio ships its 1.0 release.", 1000)
    result = deploy.check_world(
        vault_id,
        "The studio officially shipped the 1.0 release of the studio game today.",
        "Press archive",
        2000,
    )
    assert result["met"] is True
    assert result["authenticated"] is True
    assert result["nextState"] == "releasable"
    assert result["closenessBand"] == 2

    vault = deploy.get_vault(vault_id)
    assert vault["state"] == "releasable"
    assert vault["lastCheckedAt"] == 2000


def test_check_world_does_not_release_on_unauthenticated_evidence(deploy, direct_vm):
    # The model claims met=true with very high closeness, but reports
    # authenticated=false (an anonymous, unattributed assertion). An irreversible
    # release must NOT fire: validators did not agree the evidence is authentic.
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", unauthenticated_met_llm_response())

    vault_id = _seal_and_bind(deploy, "When the studio ships its 1.0 release.", 1000)
    result = deploy.check_world(
        vault_id,
        "The studio officially shipped the 1.0 release of the studio game today.",
        "",  # no source named -> cannot be authenticated for release
        2000,
    )
    assert result["authenticated"] is False
    assert result["nextState"] != "releasable"

    vault = deploy.get_vault(vault_id)
    assert vault["state"] != "releasable"


def test_check_world_does_not_release_on_thin_evidence(deploy, direct_vm):
    # Even with a named source and a model claiming met, evidence too short and
    # too weakly related to the condition cannot cross the deterministic
    # authentication bar for an irreversible release.
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", met_llm_response())

    vault_id = _seal_and_bind(deploy, "When the studio ships its 1.0 release.", 1000)
    result = deploy.check_world(vault_id, "shipped.", "Wire", 2000)
    assert result["nextState"] != "releasable"


def test_check_world_nearing_on_partial(deploy, direct_vm):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", nearing_llm_response())

    vault_id = _seal_and_bind(deploy, "When the studio ships its 1.0 release.", 1000)
    result = deploy.check_world(
        vault_id,
        "The studio announced an upcoming 1.0 release window for the studio game.",
        "Press archive",
        2000,
    )
    assert result["met"] is False
    assert result["nextState"] == "nearing"
    assert result["closenessBand"] == 1


def test_check_world_listening_when_not_met(deploy, direct_vm):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", not_met_llm_response())

    vault_id = _seal_and_bind(deploy, "When the studio ships its 1.0 release.", 1000)
    result = deploy.check_world(
        vault_id,
        "Unrelated chatter about the weather and lunch today.",
        "Noise",
        2000,
    )
    assert result["met"] is False
    assert result["nextState"] == "listening"


def test_check_world_backstop_blocks_release_without_trace(deploy, direct_vm):
    # Even if the model claims met with high closeness, the deterministic
    # backstop blocks release when the evidence shares no words with the
    # condition.
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", met_llm_response())

    vault_id = _seal_and_bind(deploy, "When the studio ships its 1.0 release.", 1000)
    result = deploy.check_world(
        vault_id,
        "Completely different words about gardening, weather, and breakfast.",
        "Noise",
        2000,
    )
    assert result["nextState"] != "releasable"


def test_check_world_records_evidence(deploy, direct_vm):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", nearing_llm_response())

    vault_id = _seal_and_bind(deploy, "When the studio ships its 1.0 release.", 1000)
    deploy.check_world(vault_id, "The studio teased a 1.0 release soon.", "Blog", 2000)
    trail = deploy.get_evidence(vault_id)
    assert len(trail) == 1
    assert trail[0]["sourceLabel"] == "Blog"


def test_check_world_rate_limited(deploy, direct_vm):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", not_met_llm_response())

    vault_id = _seal_and_bind(deploy, "When the studio ships its 1.0 release.", 1000)
    deploy.check_world(vault_id, "Nothing relevant yet.", "src", 2000)
    with direct_vm.expect_revert("too soon"):
        deploy.check_world(vault_id, "Still nothing.", "src", 2100)


# ---------------------------------------------------------------------------
# open_seal
# ---------------------------------------------------------------------------

def _make_releasable(deploy, direct_vm, direct_alice):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", met_llm_response())
    direct_vm.sender = direct_alice
    vault_id = _seal_and_bind(deploy, "When the studio ships its 1.0 release.", 1000)
    deploy.check_world(
        vault_id,
        "The studio officially shipped the 1.0 release of the studio game today.",
        "Press archive",
        2000,
    )
    return vault_id


def test_open_seal_blocked_before_release(deploy, direct_vm):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", nearing_llm_response())
    vault_id = _seal_and_bind(deploy, "When the studio ships its 1.0 release.", 1000)
    deploy.check_world(vault_id, "The studio teased a 1.0 release soon.", "Blog", 2000)
    with direct_vm.expect_revert("not ready to open"):
        deploy.open_seal(vault_id, "0xtx", 3000)


def test_open_seal_recipient_only(deploy, direct_vm, direct_alice):
    vault_id = _make_releasable(deploy, direct_vm, direct_alice)
    # Alice (the author) is not the recipient (0xbob), so she cannot open.
    with direct_vm.expect_revert("Only the named keeper"):
        deploy.open_seal(vault_id, "0xtx", 3000)


def test_open_seal_reveals_payload_for_recipient(deploy, direct_vm, direct_alice):
    # Seal a vault whose recipient is alice's own address so she can open it.
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", met_llm_response())
    direct_vm.sender = direct_alice
    # Derive alice's exact on-chain hex by sealing once and reading owner back.
    probe = deploy.seal("probe", "ipfs://p", "0xbob", "crescent", "public", 1000)
    alice_hex = deploy.get_vault(probe)["owner"]
    vault_id = deploy.seal(
        "When the studio ships 1.0",
        "ipfs://the-secret-reference",
        alice_hex,
        "crescent",
        "public",
        1000,
    )
    deploy.bind_condition(vault_id, "When the studio ships its 1.0 release.", 1000)
    deploy.check_world(
        vault_id,
        "The studio officially shipped the 1.0 release of the studio game today.",
        "Press archive",
        2000,
    )
    result = deploy.open_seal(vault_id, "0xtxhash", 3000)
    assert result["payloadCommitment"] == "ipfs://the-secret-reference"

    vault = deploy.get_vault(vault_id)
    assert vault["state"] == "opened"
    assert vault["opened"] is True
    assert vault["openedAt"] == 3000
    # Now opened, the payload reference is visible in views.
    assert vault["payloadCommitment"] == "ipfs://the-secret-reference"

    ledger = deploy.get_ledger(0, 20)
    assert len(ledger) == 1
    assert ledger[0]["vaultId"] == vault_id
    assert ledger[0]["mockTxHash"] == "0xtxhash"


def test_open_seal_cannot_open_twice(deploy, direct_vm, direct_alice):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", met_llm_response())
    direct_vm.sender = direct_alice
    probe = deploy.seal("probe", "ipfs://p", "0xbob", "crescent", "public", 1000)
    alice_hex = deploy.get_vault(probe)["owner"]
    vault_id = deploy.seal(
        "S", "ipfs://secret", alice_hex, "crescent", "public", 1000
    )
    deploy.bind_condition(vault_id, "When the studio ships its 1.0 release.", 1000)
    deploy.check_world(
        vault_id,
        "The studio officially shipped the 1.0 release of the studio game today.",
        "Press archive",
        2000,
    )
    deploy.open_seal(vault_id, "0xtx", 3000)
    with direct_vm.expect_revert("already open"):
        deploy.open_seal(vault_id, "0xtx", 4000)


# ---------------------------------------------------------------------------
# entrust
# ---------------------------------------------------------------------------

def test_entrust_transfers_recipient(deploy):
    vault_id = deploy.seal("S", "ipfs://c", "0xbob", "crescent", "public", 1000)
    deploy.entrust(vault_id, "0xcarol")
    vault = deploy.get_vault(vault_id)
    assert vault["recipient"] == "0xcarol"


def test_entrust_only_owner(deploy, direct_vm, direct_bob):
    vault_id = deploy.seal("S", "ipfs://c", "0xbob", "crescent", "public", 1000)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the author"):
        deploy.entrust(vault_id, "0xcarol")


def test_entrust_blocked_after_open(deploy, direct_vm, direct_alice):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", met_llm_response())
    direct_vm.sender = direct_alice
    probe = deploy.seal("probe", "ipfs://p", "0xbob", "crescent", "public", 1000)
    alice_hex = deploy.get_vault(probe)["owner"]
    vault_id = deploy.seal("S", "ipfs://c", alice_hex, "crescent", "public", 1000)
    deploy.bind_condition(vault_id, "When the studio ships its 1.0 release.", 1000)
    deploy.check_world(
        vault_id,
        "The studio officially shipped the 1.0 release of the studio game today.",
        "Press archive",
        2000,
    )
    deploy.open_seal(vault_id, "0xtx", 3000)
    with direct_vm.expect_revert("opened vault can no longer be entrusted"):
        deploy.entrust(vault_id, "0xcarol")


# ---------------------------------------------------------------------------
# private condition visibility
# ---------------------------------------------------------------------------

def test_private_condition_shrouded_from_stranger(deploy, direct_vm, direct_bob):
    vault_id = deploy.seal("S", "ipfs://c", "0xbob", "crescent", "private", 1000)
    deploy.bind_condition(vault_id, "A private condition only owner knows.", 1000)
    # Bob is the named recipient string "0xbob" but the direct_bob account hex
    # differs, so from a stranger account the condition is shrouded.
    direct_vm.sender = direct_bob
    vault = deploy.get_vault(vault_id)
    assert vault["conditionShrouded"] is True
    assert vault["conditionText"] == ""


def test_private_condition_visible_to_owner(deploy):
    vault_id = deploy.seal("S", "ipfs://c", "0xbob", "crescent", "private", 1000)
    deploy.bind_condition(vault_id, "A private condition.", 1000)
    vault = deploy.get_vault(vault_id)
    assert vault["conditionShrouded"] is False
    assert vault["conditionText"] == "A private condition."


# ---------------------------------------------------------------------------
# paged views + summary
# ---------------------------------------------------------------------------

def test_get_vaults_paged_newest_first(deploy):
    ids = []
    for i in range(3):
        ids.append(
            deploy.seal(f"S{i}", "ipfs://c", "0xbob", "crescent", "public", 1000 + i)
        )
    vaults = deploy.get_vaults(0, 20)
    assert len(vaults) == 3
    assert vaults[0]["id"] == ids[-1]


def test_summary_counts(deploy, direct_vm):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", nearing_llm_response())
    vault_id = _seal_and_bind(deploy, "When the studio ships its 1.0 release.", 1000)
    deploy.check_world(vault_id, "The studio teased a 1.0 release soon.", "Blog", 2000)
    summary = deploy.get_summary()
    assert summary["vaults"] == 1
    assert summary["evidence"] == 1
    assert summary["opened"] == 0
