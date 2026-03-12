from acquisition.parsing import parse_sample_line, status_message_from_line
from persistence.settings_store import AppSettings


def test_parse_sample_line_json_and_csv_variants() -> None:
    j = parse_sample_line('{"t_ms":123,"f":[1,2,3,4]}', fallback_t_ms=999)
    assert j is not None
    assert j.t_ms == 123
    assert j.values == (1.0, 2.0, 3.0, 4.0)

    j_no_ts = parse_sample_line('{"f":[5,6,7,8]}', fallback_t_ms=321)
    assert j_no_ts is not None
    assert j_no_ts.t_ms == 321
    assert j_no_ts.values == (5.0, 6.0, 7.0, 8.0)

    csv_ts = parse_sample_line("500,10,20,30,40", fallback_t_ms=111)
    assert csv_ts is not None
    assert csv_ts.t_ms == 500
    assert csv_ts.values == (10.0, 20.0, 30.0, 40.0)

    csv_legacy = parse_sample_line("10,20,30,40", fallback_t_ms=777)
    assert csv_legacy is not None
    assert csv_legacy.t_ms == 777
    assert csv_legacy.values == (10.0, 20.0, 30.0, 40.0)


def test_status_line_detection() -> None:
    assert status_message_from_line("# boot ok") == "boot ok"
    assert status_message_from_line("ERR usage c <...>") == "ERR usage c <...>"
    assert status_message_from_line("ok 200") == "ok 200"
    assert status_message_from_line("random,data,1,2") is None


def test_settings_migration_defaults() -> None:
    migrated = AppSettings.from_dict(
        {
            "input_mode": "MODE_RAW",
            "units": "kg",
            "hand_default": "Left",
            "preferred_source": "invalid",
            "ui_theme": "dark",
        }
    )
    assert migrated.input_mode.value == "MODE_RAW"
    assert migrated.units.value == "kg"
    assert migrated.hand_default == "Left"
    assert migrated.preferred_source == "Serial"
    assert migrated.ui_theme == "light_clean"
    assert migrated.ble_device_id == ""
    assert migrated.ble_rx_uuid == ""
    assert migrated.ble_tx_uuid == ""

