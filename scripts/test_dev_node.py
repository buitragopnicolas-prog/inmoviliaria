import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("wait_dev", Path(__file__).with_name("wait-dev-node.py"))
node_wait = importlib.util.module_from_spec(spec)
spec.loader.exec_module(node_wait)


def node(conditions, **config):
    return {"status":{"conditions":[{"type":key,"status":value} for key,value in conditions.items()]}, "spec":config}


class DevNodeTests(unittest.TestCase):
    def test_node_must_be_ready_without_hard_scheduling_restrictions(self):
        healthy = node({"Ready":"True"}, taints=[{"key":"soft","effect":"PreferNoSchedule"}])
        self.assertFalse(node_wait.node_blocks(healthy))
        blocked = node({"Ready":"False","DiskPressure":"True","MemoryPressure":"Unknown"}, unschedulable=True,
                       taints=[{"key":"maintenance","effect":"NoSchedule"}])
        result = node_wait.node_blocks(blocked)
        for reason in ("Ready=False","DiskPressure=True","MemoryPressure=Unknown",
                       "programación deshabilitada (cordon)","maintenance (NoSchedule)"):
            self.assertIn(reason,result)
        with patch.object(node_wait.subprocess,"check_output") as kubectl:
            for nodes, expected in (([blocked,healthy],""),([blocked],", ".join(result)),([],"sin nodos")):
                kubectl.return_value = json.dumps({"items":nodes})
                self.assertEqual(node_wait.scheduling_status(),expected)

    def test_recovery_resumes_and_persistent_restrictions_stop_the_deploy(self):
        with patch.object(node_wait,"scheduling_status",side_effect=["DiskPressure=True","DiskPressure=True",""]), \
                patch.object(node_wait.time,"sleep") as pause:
            node_wait.wait_for_node()
            self.assertEqual(pause.call_count,2)
        with patch.object(node_wait,"scheduling_status",return_value="maintenance (NoSchedule)"), \
                patch.object(node_wait.time,"sleep"), self.assertRaises(RuntimeError):
            node_wait.wait_for_node()
