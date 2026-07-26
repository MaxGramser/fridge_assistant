"""Portions: building, consuming, auto-complete, restore, resizing, codes."""

import asyncio
import copy
import unittest

from tests.hastubs import fake_hass, load_module

store_mod = load_module("store")
codes = load_module("codes")
const = load_module("const")


def make_store() -> "store_mod.FridgeStore":
    store = store_mod.FridgeStore(fake_hass("nl"))
    store._seed = store._read_seed()
    return store


def add(store, portions=None, name="Lasagne"):
    data = {"name": name, "location": "freezer"}
    if portions is not None:
        data["portions"] = portions
    return store.add_item(store.build_item(data))


class TestSplitPortionCode(unittest.TestCase):
    def test_plain_code(self):
        self.assertEqual(codes.split_portion_code("AB12"), ("AB12", None))

    def test_sub_code(self):
        self.assertEqual(codes.split_portion_code("ab12-3"), ("AB12", 3))

    def test_digits_first_sub_code(self):
        self.assertEqual(codes.split_portion_code("12AB-11"), ("12AB", 11))

    def test_garbage(self):
        self.assertEqual(codes.split_portion_code(""), ("", None))

    def test_portion_code_roundtrip(self):
        self.assertEqual(
            codes.split_portion_code(codes.portion_code("AB12", 2)), ("AB12", 2)
        )


class TestBuildItemPortions(unittest.TestCase):
    def test_default_is_one_open_portion(self):
        item = add(make_store())
        self.assertEqual(item["portions"], [{"n": 1, "status": "open"}])

    def test_three_portions(self):
        item = add(make_store(), portions=3)
        self.assertEqual([p["n"] for p in item["portions"]], [1, 2, 3])
        self.assertTrue(all(p["status"] == "open" for p in item["portions"]))

    def test_clamped_to_max(self):
        item = add(make_store(), portions=999)
        self.assertEqual(len(item["portions"]), const.MAX_PORTIONS)


class TestConsumePortion(unittest.TestCase):
    def test_specific_portion(self):
        store = make_store()
        item = add(store, portions=3)
        result = store.consume_portion(item["id"], portion=2, by="u1", by_name="Max")
        self.assertEqual(result["portion"], 2)
        self.assertEqual(result["remaining"], 2)
        self.assertFalse(result["completed"])
        p2 = next(p for p in item["portions"] if p["n"] == 2)
        self.assertEqual(p2["status"], "eaten")
        self.assertEqual(p2["by_name"], "Max")
        event = store.history[0]
        self.assertEqual(event["action"], const.ACTION_PORTION_EATEN)
        self.assertEqual(event["portion"], 2)
        self.assertEqual(event["item_id"], item["id"])

    def test_next_open_portion(self):
        store = make_store()
        item = add(store, portions=3)
        store.consume_portion(item["id"], portion=1)
        result = store.consume_portion(item["id"])
        self.assertEqual(result["portion"], 2)

    def test_last_portion_completes_item_with_single_event(self):
        store = make_store()
        item = add(store, portions=2)
        store.consume_portion(item["id"], portion=1)
        result = store.consume_portion(item["id"], portion=2)
        self.assertTrue(result["completed"])
        self.assertEqual(result["remaining"], 0)
        self.assertNotIn(item["id"], store.items)
        # One portion event + one completion event — not two rows per scan.
        self.assertEqual(len(store.history), 2)
        completion = store.history[0]
        self.assertEqual(completion["action"], const.ACTION_EATEN)
        self.assertEqual(completion["portion"], 2)

    def test_single_portion_item_completes_directly(self):
        store = make_store()
        item = add(store)
        result = store.consume_portion(item["id"])
        self.assertTrue(result["completed"])
        self.assertEqual(len(store.history), 1)
        self.assertEqual(store.history[0]["action"], const.ACTION_EATEN)

    def test_all_tossed_completes_as_tossed(self):
        store = make_store()
        item = add(store, portions=2)
        store.consume_portion(item["id"], portion=1, action=const.ACTION_TOSSED)
        result = store.consume_portion(item["id"], portion=2, action=const.ACTION_TOSSED)
        self.assertTrue(result["completed"])
        self.assertEqual(store.history[0]["action"], const.ACTION_TOSSED)

    def test_mixed_completes_as_eaten(self):
        store = make_store()
        item = add(store, portions=2)
        store.consume_portion(item["id"], portion=1, action=const.ACTION_TOSSED)
        result = store.consume_portion(item["id"], portion=2, action=const.ACTION_EATEN)
        self.assertEqual(store.history[0]["action"], const.ACTION_EATEN)
        self.assertTrue(result["completed"])

    def test_error_keys(self):
        store = make_store()
        item = add(store, portions=2)
        self.assertEqual(store.consume_portion("nope"), "item_not_found")
        self.assertEqual(store.consume_portion(item["id"], portion=9), "portion_not_found")
        store.consume_portion(item["id"], portion=1)
        self.assertEqual(store.consume_portion(item["id"], portion=1), "portion_consumed")

    def test_snapshot_is_isolated_from_live_item(self):
        store = make_store()
        item = add(store, portions=3)
        store.consume_portion(item["id"], portion=1)
        snapshot = store.history[0]["item"]
        store.consume_portion(item["id"], portion=2)
        statuses = {p["n"]: p["status"] for p in snapshot["portions"]}
        self.assertEqual(statuses[2], "open")  # snapshot unchanged by later eat


class TestRestore(unittest.TestCase):
    def test_restore_portion_event_reopens_portion(self):
        store = make_store()
        item = add(store, portions=3)
        result = store.consume_portion(item["id"], portion=2)
        restored = store.restore_item(result["event"]["id"])
        self.assertIsNotNone(restored)
        p2 = next(p for p in item["portions"] if p["n"] == 2)
        self.assertEqual(p2["status"], "open")
        self.assertNotIn("by", p2)
        self.assertEqual(len(store.history), 0)

    def test_restore_portion_event_fails_when_item_gone(self):
        store = make_store()
        item = add(store, portions=3)
        result = store.consume_portion(item["id"], portion=1)
        store.complete_item(item["id"], const.ACTION_EATEN)
        self.assertIsNone(store.restore_item(result["event"]["id"]))

    def test_restore_completion_reopens_final_portion(self):
        store = make_store()
        item = add(store, portions=2)
        store.consume_portion(item["id"], portion=1)
        result = store.consume_portion(item["id"], portion=2)
        restored = store.restore_item(result["event"]["id"])
        self.assertIn(item["id"], store.items)
        statuses = {p["n"]: p["status"] for p in restored["portions"]}
        self.assertEqual(statuses, {1: "eaten", 2: "open"})

    def test_restore_plain_completion_still_works(self):
        store = make_store()
        item = add(store)
        event = store.complete_item(item["id"], const.ACTION_EATEN)
        restored = store.restore_item(event["id"])
        self.assertEqual(restored["id"], item["id"])

    def test_delete_history_event_is_permanent(self):
        store = make_store()
        item = add(store)
        event = store.complete_item(item["id"], const.ACTION_EATEN)
        self.assertTrue(store.delete_history_event(event["id"]))
        self.assertEqual(store.history, [])
        self.assertIsNone(store.restore_item(event["id"]))
        self.assertFalse(store.delete_history_event(event["id"]))


class TestSetPortions(unittest.TestCase):
    def test_grow_appends_open_portions(self):
        store = make_store()
        item = add(store, portions=2)
        result = store.set_portions(item["id"], 4)
        self.assertFalse(result["completed"])
        self.assertEqual([p["n"] for p in item["portions"]], [1, 2, 3, 4])

    def test_shrink_removes_highest_open(self):
        store = make_store()
        item = add(store, portions=3)
        store.consume_portion(item["id"], portion=2)
        store.set_portions(item["id"], 2)
        self.assertEqual(
            {p["n"]: p["status"] for p in item["portions"]},
            {1: "open", 2: "eaten"},
        )

    def test_cannot_shrink_below_consumed(self):
        store = make_store()
        item = add(store, portions=3)
        store.consume_portion(item["id"], portion=1)
        store.consume_portion(item["id"], portion=2)
        result = store.set_portions(item["id"], 1)
        # Clamped to the 2 consumed portions -> no open ones left -> completes.
        self.assertTrue(result["completed"])
        self.assertNotIn(item["id"], store.items)

    def test_shrink_away_last_open_completes(self):
        store = make_store()
        item = add(store, portions=2)
        store.consume_portion(item["id"], portion=1)
        result = store.set_portions(item["id"], 1)
        self.assertTrue(result["completed"])
        self.assertEqual(result["completion_event"]["action"], const.ACTION_EATEN)

    def test_grow_after_consume_numbers_stay_stable(self):
        store = make_store()
        item = add(store, portions=2)
        store.consume_portion(item["id"], portion=2)
        store.set_portions(item["id"], 3)
        self.assertEqual([p["n"] for p in item["portions"]], [1, 2, 3])
        self.assertEqual(item["portions"][1]["status"], "eaten")

    def test_unknown_item(self):
        self.assertIsNone(make_store().set_portions("nope", 3))


class TestMigrationV3(unittest.TestCase):
    def test_v2_items_and_snapshots_get_portions(self):
        data = {
            "items": [{"id": "a1", "code": "AB12", "name": "Melk", "location": "fridge"}],
            "user_templates": [],
            "hidden": [],
            "history": [
                {"id": "e1", "action": "eaten",
                 "item": {"id": "b2", "code": "CD34", "name": "Soep"}},
            ],
        }
        store = store_mod.FridgeDataStore.__new__(store_mod.FridgeDataStore)
        migrated = asyncio.run(
            store._async_migrate_func(2, 1, copy.deepcopy(data))
        )
        self.assertEqual(
            migrated["items"][0]["portions"], [{"n": 1, "status": "open"}]
        )
        self.assertEqual(
            migrated["history"][0]["item"]["portions"], [{"n": 1, "status": "open"}]
        )

    def test_v1_runs_both_steps(self):
        data = {
            "items": [{"id": "a1", "code": "AB12", "name": "Melk",
                       "location": "koelkast", "category": "zuivel"}],
            "user_templates": [], "hidden": [], "history": [],
        }
        store = store_mod.FridgeDataStore.__new__(store_mod.FridgeDataStore)
        migrated = asyncio.run(store._async_migrate_func(1, 1, copy.deepcopy(data)))
        item = migrated["items"][0]
        self.assertEqual(item["location"], "fridge")
        self.assertEqual(item["portions"], [{"n": 1, "status": "open"}])


if __name__ == "__main__":
    unittest.main()
