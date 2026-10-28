import importlib.util
import json
import sys
from pathlib import Path
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")
sys.dont_write_bytecode = True
root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("codebound_bridge", root / "public/runtime_bridge.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
sys.stdout.write(module.execute_request(sys.stdin.read()))
