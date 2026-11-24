import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("reclaim", Path(__file__).with_name("reclaim-dev-images.py"))
reclaim = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reclaim)


def ref(app, digit):
    return f"docker.io/library/asesoria-inmobiliaria-{app}:dev-" + digit * 40


def template(app, digit):
    return {"spec": {"containers": [{"name":app, "image":ref(app,digit)}]}}


class ReclaimTests(unittest.TestCase):
    def test_current_previous_live_and_missing_rollback(self):
        deployments = [{"metadata":{"name":app, "uid":app}, "spec":{"template":template(app,"c")}}
                       for app in ("api","web")]
        replicas = [{"metadata":{"ownerReferences":[{"uid":"api"}],
                                "annotations":{"deployment.kubernetes.io/revision":str(revision)}},
                     "spec":{"replicas":count,"template":template("api",digit)}}
                    for revision, digit, count in [(1,"a",1),(2,"b",0),(3,"c",1)]]
        active, protected = reclaim.revisions(deployments, replicas)
        self.assertEqual(active, {"api":"c"*40})
        self.assertTrue({"a"*40,"b"*40,"c"*40}.issubset(protected))
        with self.assertRaises(ValueError):
            reclaim.application_tag({"spec":{"containers":[{"name":"api","image":"other/image"}]}},"api")

    def test_only_old_unused_dev_labels_can_be_removed(self):
        calls = []

        def run(cmd, **kwargs):
            calls.append(cmd)
            return SimpleNamespace(returncode=int(cmd[0]=="git" and cmd[-2]=="e"*40))

        with patch.object(reclaim.subprocess,"run",side_effect=run):
            reclaim.retire([ref("api","a"),ref("api","b"),ref("api","e"),ref("web","a"),"minio:latest",
                            ref("api","a").replace("dev-","prod-")],
                           {"api":"c"*40},{"b"*40},["remove"])
        self.assertEqual([c for c in calls if c[0]=="remove"],[["remove",ref("api","a")]])

    def test_disk_pressure_uses_only_named_app_tags_and_waits_for_recovery(self):
        workload = {"metadata":{"name":"api","uid":"api"},"spec":{"template":template("api","c")}}
        previous = {"metadata":{"ownerReferences":[{"uid":"api"}]},"spec":{"template":template("api","b")}}
        nodes = {"items":[{"metadata":{"name":"dev-node"},"status":{"conditions":[{"type":"DiskPressure","status":"True"}]}}]}

        def output(*args):
            if "nodes" in args: return reclaim.json.dumps(nodes)
            if "deployment" in args: return reclaim.json.dumps({"items":[workload]})
            if "rs" in args: return reclaim.json.dumps({"items":[previous]})
            if "pods" in args: return ref("api","d")
            if args[0] == "git": return "e" * 40
            return ref("api","a")

        with patch.object(reclaim,"output",side_effect=output), patch.object(reclaim,"STATE") as state, \
             patch.object(reclaim.shutil,"disk_usage",return_value=SimpleNamespace(total=100,free=5)), \
             patch.object(reclaim,"retire") as retire, patch.object(reclaim.subprocess,"run") as run:
            (state / "verified-sha").read_text.return_value = "f"*40
            reclaim.main()
            for call in retire.call_args_list:
                self.assertTrue({ch*40 for ch in "bcdef"}.issubset(call.args[2]))
            self.assertEqual(retire.call_count, 2)
            self.assertIn("node/dev-node", run.call_args.args[0])

    def test_healthy_disk_and_multiple_nodes_do_not_remove_anything(self):
        with patch.object(reclaim,"output",return_value='{"items":[{"status":{"conditions":[]}}]}'), \
             patch.object(reclaim.shutil,"disk_usage",return_value=SimpleNamespace(total=100,free=30)), \
             patch.object(reclaim,"retire") as retire:
            reclaim.main()
            retire.assert_not_called()
        with patch.object(reclaim,"output",return_value='{"items":[{},{}]}'), self.assertRaises(RuntimeError):
            reclaim.main()
