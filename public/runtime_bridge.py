"""Codebound game bridge; executed inside the bundled browser Python runtime."""
import ast
import builtins
import json
import sys
import traceback


def run_case(code, level):
    events, output = [], []
    cells = level["map"]
    start = next(({"x": x, "y": y} for y, row in enumerate(cells)
                  for x, char in enumerate(row) if char == "S"), {"x": 1, "y": 1})
    state = {"player": start, "energy": level.get("energy", 100), "collected": 0,
             "batteries": [{"x": x, "y": y} for y, row in enumerate(cells)
                           for x, char in enumerate(row) if char == "B"]}
    current_line, ticks, actions = 0, 0, 0
    variables, namespace = {}, {}
    inputs = iter(level.get("input", []))

    def snapshot(kind, text=None):
        if len(events) >= 650:
            return
        event = {"kind": kind, "line": current_line, "state": json.loads(json.dumps(state)),
                 "variables": dict(variables)}
        if text is not None:
            event["text"] = text
        events.append(event)

    def collect_variables(frame):
        variables.clear()
        for name, value in frame.f_locals.items():
            if name.startswith("_") or name == "robot":
                continue
            if type(value) in (int, float, str, bool, type(None)):
                variables[name] = str(value)[:120] if type(value) is str else value
            elif type(value) in (list, tuple) and len(value) <= 20:
                variables[name] = repr(value)[:120]
            if len(variables) >= 16:
                break

    def trace(frame, event, arg):
        nonlocal ticks, current_line
        if frame.f_code.co_filename != "<student>":
            return trace
        if event == "line":
            ticks += 1
            if ticks > 3000:
                raise RuntimeError("执行步骤太多：请检查循环的结束条件，或缩小循环次数。")
            current_line = frame.f_lineno
            collect_variables(frame)
            snapshot("line")
        return trace

    def printed(*args, sep=" ", end="\n", **kwargs):
        text = sep.join(str(value) for value in args) + end
        if sum(len(item) for item in output) + len(text) > 12000:
            raise RuntimeError("输出内容太多了，请减少打印次数。")
        output.append(text)
        snapshot("output", text)

    def read_input(prompt=""):
        if prompt:
            printed(prompt, end="")
        try:
            return str(next(inputs))
        except StopIteration:
            raise EOFError("输入数据已经读完了；检查 input() 的调用次数。") from None

    class Robot:
        @property
        def energy(self):
            return state["energy"]

        def _move(self, dx, dy, steps=1):
            nonlocal actions
            if type(steps) is not int or not 0 <= steps <= 50:
                raise ValueError("移动步数需要是 0 到 50 之间的整数。")
            for _ in range(steps):
                actions += 1
                if actions > 150:
                    raise RuntimeError("动作次数太多，请检查循环是否会停止。")
                x, y = state["player"]["x"] + dx, state["player"]["y"] + dy
                if not (0 <= y < len(cells) and 0 <= x < len(cells[y])) or cells[y][x] == "#":
                    raise ValueError("前面是墙壁，Byte 走不过去。检查移动方向与步数。")
                state["player"] = {"x": x, "y": y}
                snapshot("move")

        def right(self, steps=1):
            self._move(1, 0, steps)

        def left(self, steps=1):
            self._move(-1, 0, steps)

        def up(self, steps=1):
            self._move(0, -1, steps)

        def down(self, steps=1):
            self._move(0, 1, steps)

        def collect(self):
            if state["player"] not in state["batteries"]:
                raise ValueError("脚下没有电池。先移动到电池所在的位置，再收集。")
            state["batteries"].remove(state["player"])
            state["collected"] += 1
            snapshot("collect")

        def charge(self):
            nonlocal actions
            actions += 1
            if actions > 150:
                raise RuntimeError("充电次数太多，请检查 while 的条件。")
            state["energy"] = min(100, state["energy"] + 20)
            snapshot("charge")

        def at_goal(self):
            p = state["player"]
            return cells[p["y"]][p["x"]] == "G"

        def say(self, text):
            printed(text)

    namespace.update({"robot": Robot(), "print": printed, "input": read_input,
                      "__builtins__": builtins.__dict__})
    error, nodes = None, []
    try:
        if len(code) > 20000:
            raise ValueError("代码超过 20000 字符，请先缩短代码。")
        tree = ast.parse(code, filename="<student>")
        nodes = list({type(node).__name__ for node in ast.walk(tree)})
        sys.settrace(trace)
        exec(compile(tree, "<student>", "exec"), namespace, namespace)
    except BaseException as exc:
        sys.settrace(None)
        line = getattr(exc, "lineno", None) or current_line
        for frame in traceback.extract_tb(exc.__traceback__):
            if frame.filename == "<student>":
                line = frame.lineno
        detail = str(exc)
        kind = type(exc).__name__
        if isinstance(exc, IndentationError):
            message = "缩进没有对齐。if、for、while 后面的代码通常需要缩进 4 个空格。"
        elif isinstance(exc, SyntaxError):
            message = "这一行的语法有问题。检查英文括号、引号，以及 if / for / while 后面的冒号。"
            if "expected ':'" in detail:
                message = "这一行末尾缺少英文冒号 :。补上后，下一行缩进 4 个空格。"
            if any(char in code for char in "（）：，‘’“”"):
                message += " 代码符号请使用英文输入法；引号里的中文不受影响。"
        elif isinstance(exc, NameError):
            message = "这个名字还没有定义。检查拼写，并确认变量在使用前已经赋值。"
        elif isinstance(exc, AttributeError):
            message = "没有找到这个动作或属性。检查 right、left、up、down、collect、charge 的拼写。"
        elif isinstance(exc, TypeError):
            message = "数据类型或参数不合适。检查数字和文字是否混用，以及函数参数是否正确。"
        elif isinstance(exc, ZeroDivisionError):
            message = "除数不能是 0。先检查参与运算的数字。"
        else:
            message = detail or "程序提前结束了，请检查代码。"
        error = {"line": line, "type": kind, "message": message, "detail": detail[:600]}
    finally:
        sys.settrace(None)
    for name, value in namespace.items():
        if not name.startswith("_") and name not in ("robot", "print", "input") and type(value) in (int, float, str, bool, type(None)):
            variables[name] = str(value)[:120] if type(value) is str else value
    snapshot("end")
    return {"state": state, "events": events, "output": "".join(output),
            "variables": variables, "nodes": nodes, "error": error}


def execute_request(request_json):
    request = json.loads(request_json)
    level = request["level"]
    result = run_case(request["code"], level)
    result["checks"] = []
    if result["error"] is None:
        for case in level.get("cases", []):
            variant = dict(level)
            variant["input"] = case["input"]
            checked = run_case(request["code"], variant)
            result["checks"].append({"passed": checked["error"] is None and checked["output"].strip() == case["output"].strip(),
                                     "error": checked["error"]})
    return json.dumps(result, ensure_ascii=False, allow_nan=False)
